import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, isAfter, parseISO, startOfDay, endOfDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Clock, ArrowUp, ArrowDown, Calendar } from 'lucide-react';

interface TimeEntry {
  id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  employee_id: string;
  employee_name?: string;
}

interface WorkSession {
  id: string;
  punch_in: TimeEntry;
  punch_out?: TimeEntry;
  duration?: number; // in minutes
  employee_name?: string;
  isAdjusted?: boolean; // true if times were replaced with schedule
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  originalPunchIn?: TimeEntry;
  originalPunchOut?: TimeEntry;
}

export default function TimeEntries() {
  const { user, userRole } = useAuth();
  const { data: shiftsData } = useShifts(userRole === 'admin' ? {} : { employeeId: user?.id });
  const { data: companySettings } = useCompanySettings();
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeEntries();
  }, [user, userRole, shiftsData]);

  const fetchTimeEntries = async () => {
    if (!user) return;

    try {
      // First, fetch time entries
      let query = supabase
        .from('time_entries')
        .select('*')
        .order('timestamp', { ascending: false });

      // If not admin, only show user's own entries
      if (userRole !== 'admin') {
        query = query.eq('employee_id', user.id);
      }

      const { data: entriesData, error: entriesError } = await query;

      if (entriesError) {
        console.error('Error fetching time entries:', entriesError);
        return;
      }

      // If admin, fetch profile data for employee names
      let profilesMap = new Map();
      if (userRole === 'admin' && entriesData && entriesData.length > 0) {
        const employeeIds = Array.from(new Set(entriesData.map(entry => entry.employee_id)));
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', employeeIds);

        profilesMap = new Map(
          profilesData?.map(profile => [
            profile.user_id, 
            `${profile.first_name} ${profile.last_name}`
          ]) || []
        );
      }

      // Group entries into work sessions and apply hybrid logic
      const sessions = groupIntoWorkSessions(entriesData || [], profilesMap);
      const hybridSessions = applyHybridLogic(sessions);
      setWorkSessions(hybridSessions);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupIntoWorkSessions = (entries: TimeEntry[], profilesMap: Map<string, string>): WorkSession[] => {
    const sessions: WorkSession[] = [];
    const entriesByEmployee = new Map<string, TimeEntry[]>();

    // Group entries by employee
    entries.forEach(entry => {
      if (!entriesByEmployee.has(entry.employee_id)) {
        entriesByEmployee.set(entry.employee_id, []);
      }
      entriesByEmployee.get(entry.employee_id)!.push({
        ...entry,
        employee_name: profilesMap.get(entry.employee_id)
      });
    });

    // For each employee, pair punch-in and punch-out entries
    entriesByEmployee.forEach((employeeEntries, employeeId) => {
      // Sort by timestamp (oldest first for pairing)
      const sortedEntries = employeeEntries.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let i = 0;
      while (i < sortedEntries.length) {
        const entry = sortedEntries[i];
        
        if (entry.entry_type === 'punch_in') {
          // Look for matching punch_out
          let punchOut: TimeEntry | undefined;
          let j = i + 1;
          
          while (j < sortedEntries.length) {
            if (sortedEntries[j].entry_type === 'punch_out' && 
                sortedEntries[j].employee_id === entry.employee_id) {
              punchOut = sortedEntries[j];
              sortedEntries.splice(j, 1); // Remove the punch_out from array
              break;
            }
            j++;
          }

          // Calculate duration if we have both punch in and out
          let duration: number | undefined;
          if (punchOut) {
            const startTime = new Date(entry.timestamp);
            const endTime = new Date(punchOut.timestamp);
            duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
          }

          sessions.push({
            id: entry.id,
            punch_in: entry,
            punch_out: punchOut,
            duration,
            employee_name: entry.employee_name
          });
        }
        i++;
      }
    });

    // Sort sessions by punch_in timestamp (newest first)
    return sessions.sort((a, b) => 
      new Date(b.punch_in.timestamp).getTime() - new Date(a.punch_in.timestamp).getTime()
    );
  };

  const shouldUseScheduleTimes = (sessionDate: string): boolean => {
    if (!companySettings?.business_hours) return false;
    
    const sessionDay = startOfDay(parseISO(sessionDate));
    const today = startOfDay(new Date());
    
    // Always use schedule times for past days
    if (sessionDay < today) return true;
    
    // For today, check if we're past closing time
    if (sessionDay.getTime() === today.getTime()) {
      const currentTime = new Date();
      const dayOfWeek = currentTime.getDay();
      
      const businessHours = companySettings.business_hours as any[];
      const todayHours = businessHours.find(h => h.day === dayOfWeek);
      
      if (!todayHours || !todayHours.isOpen) return true;
      
      const [closeHour, closeMinute] = todayHours.closeTime.split(':').map(Number);
      const closingTime = new Date();
      closingTime.setHours(closeHour, closeMinute, 0, 0);
      
      return isAfter(currentTime, closingTime);
    }
    
    return false;
  };

  const applyHybridLogic = (sessions: WorkSession[]): WorkSession[] => {
    if (!shiftsData || !companySettings) return sessions;

    return sessions.map(session => {
      const sessionDate = format(new Date(session.punch_in.timestamp), 'yyyy-MM-dd');
      
      if (!shouldUseScheduleTimes(sessionDate)) {
        return session; // Keep original punch times
      }

      // Find matching shift for this session
      const matchingShifts = shiftsData.filter(shift => {
        const shiftDate = format(new Date(shift.start_time), 'yyyy-MM-dd');
        return shiftDate === sessionDate && shift.employee_id === session.punch_in.employee_id;
      });

      if (matchingShifts.length === 0) {
        return session; // No schedule found, keep punch times
      }

      // For simplicity, use the first shift (could be enhanced to match by time)
      const shift = matchingShifts[0];
      const shiftDuration = Math.round(
        (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60)
      );

      return {
        ...session,
        isAdjusted: true,
        scheduleStartTime: shift.start_time,
        scheduleEndTime: shift.end_time,
        originalPunchIn: session.punch_in,
        originalPunchOut: session.punch_out,
        duration: shiftDuration,
        punch_in: {
          ...session.punch_in,
          timestamp: shift.start_time
        },
        punch_out: session.punch_out ? {
          ...session.punch_out,
          timestamp: shift.end_time
        } : {
          id: 'schedule_' + shift.id,
          entry_type: 'punch_out' as const,
          timestamp: shift.end_time,
          employee_id: shift.employee_id,
          employee_name: session.employee_name
        }
      };
    });
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getSessionBadge = (session: WorkSession) => {
    const badges = [];
    
    if (!session.punch_out) {
      badges.push(
        <Badge key="active" variant="outline" className="border-yellow-200 text-yellow-700 bg-yellow-50">
          Aktiv
        </Badge>
      );
    } else {
      badges.push(
        <Badge key="completed" variant="outline" className="border-green-200 text-green-700 bg-green-50">
          Fullført
        </Badge>
      );
    }

    if (session.isAdjusted) {
      badges.push(
        <TooltipProvider key="adjusted">
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 ml-2">
                <Calendar className="h-3 w-3 mr-1" />
                Justerat enligt schema
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p>Ursprungliga tider:</p>
                <p>In: {session.originalPunchIn && format(new Date(session.originalPunchIn.timestamp), 'HH:mm:ss')}</p>
                <p>Ut: {session.originalPunchOut && format(new Date(session.originalPunchOut.timestamp), 'HH:mm:ss')}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <div className="flex flex-wrap gap-1">{badges}</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">
          {userRole === 'admin' ? 'Alle Arbeidsvakter' : 'Mine Arbeidsvakter'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arbeidsøkt Historikk</CardTitle>
        </CardHeader>
        <CardContent>
          {workSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen arbeidsøkter funnet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Tidsperiode</TableHead>
                  <TableHead>Varighet</TableHead>
                  <TableHead>Status</TableHead>
                  {userRole === 'admin' && <TableHead>Ansatt</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {workSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(session.punch_in.timestamp), 'dd MMM yyyy', { locale: nb })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm">
                          {format(new Date(session.punch_in.timestamp), 'HH:mm:ss')}
                        </span>
                        {session.punch_out && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <ArrowDown className="h-4 w-4 text-red-600" />
                            <span className="text-sm">
                              {format(new Date(session.punch_out.timestamp), 'HH:mm:ss')}
                            </span>
                          </>
                        )}
                        {session.isAdjusted && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Calendar className="h-4 w-4 text-blue-600 ml-2" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <p>Visar schemalagda tider</p>
                                  <p>Ursprunglig punch in: {session.originalPunchIn && format(new Date(session.originalPunchIn.timestamp), 'HH:mm:ss')}</p>
                                  {session.originalPunchOut && (
                                    <p>Ursprunglig punch ut: {format(new Date(session.originalPunchOut.timestamp), 'HH:mm:ss')}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {session.duration !== undefined ? (
                          formatDuration(session.duration)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getSessionBadge(session)}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        {session.employee_name || 'Ukjent ansatt'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}