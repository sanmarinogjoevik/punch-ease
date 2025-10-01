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
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';

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
}

export default function TimeEntries() {
  const { user, userRole } = useAuth();
  const { data: shiftsData } = useShifts(userRole === 'admin' ? {} : { employeeId: user?.id });
  const { data: companySettings } = useCompanySettings();
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

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

    const resultSessions: WorkSession[] = [];
    
    // Group sessions by date AND employee (for admin) or just by date (for employee)
    const sessionsByKey = new Map<string, WorkSession[]>();
    sessions.forEach(session => {
      const sessionDate = format(new Date(session.punch_in.timestamp), 'yyyy-MM-dd');
      // Create unique key: for admin include employee_id, for employee just date
      const key = userRole === 'admin' 
        ? `${sessionDate}_${session.punch_in.employee_id}`
        : sessionDate;
      
      if (!sessionsByKey.has(key)) {
        sessionsByKey.set(key, []);
      }
      sessionsByKey.get(key)!.push(session);
    });

    // Create a map of shifts by date and employee
    const shiftKeyMap = new Map<string, any[]>();
    shiftsData.forEach(shift => {
      if (userRole === 'admin' || shift.employee_id === user?.id) {
        const shiftDate = format(new Date(shift.start_time), 'yyyy-MM-dd');
        // Create same unique key as for sessions
        const key = userRole === 'admin' 
          ? `${shiftDate}_${shift.employee_id}`
          : shiftDate;
        
        if (!shiftKeyMap.has(key)) {
          shiftKeyMap.set(key, []);
        }
        shiftKeyMap.get(key)!.push(shift);
      }
    });

    const allProcessedKeys = new Set<string>();

    // Process keys that have punch data
    sessionsByKey.forEach((keySessions, key) => {
      allProcessedKeys.add(key);
      const dateStr = key.split('_')[0]; // Extract date from key
      const useScheduleTimes = shouldUseScheduleTimes(dateStr);
      
      if (useScheduleTimes) {
        // After closing: Create ONLY ONE entry per key from schedule, ignore all punch data
        const keyShifts = shiftKeyMap.get(key);
        if (keyShifts && keyShifts.length > 0) {
          const shift = keyShifts[0];
          const shiftDuration = Math.round(
            (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60)
          );

          // Use first session for employee name reference
          const firstSession = keySessions[0];
          
          resultSessions.push({
            id: 'schedule_key_' + key,
            punch_in: {
              id: 'schedule_in_' + key,
              entry_type: 'punch_in' as const,
              timestamp: shift.start_time,
              employee_id: shift.employee_id,
              employee_name: firstSession.employee_name
            },
            punch_out: {
              id: 'schedule_out_' + key,
              entry_type: 'punch_out' as const,
              timestamp: shift.end_time,
              employee_id: shift.employee_id,
              employee_name: firstSession.employee_name
            },
            duration: shiftDuration,
            employee_name: firstSession.employee_name
          });
        }
        // If no schedule exists for this key after closing, don't show anything
      } else {
        // During the day: Show all punch sessions as they are
        keySessions.forEach(session => {
          resultSessions.push(session);
        });
      }
    });

    // Add schedule-only entries for keys without any punch data (after closing only)
    shiftKeyMap.forEach((keyShifts, key) => {
      const dateStr = key.split('_')[0]; // Extract date from key
      const useScheduleTimes = shouldUseScheduleTimes(dateStr);
      
      if (useScheduleTimes && !allProcessedKeys.has(key)) {
        const shift = keyShifts[0];
        const shiftDuration = Math.round(
          (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60)
        );

        // Get employee name from shift data or use fallback
        const employeeName = userRole === 'admin' 
          ? (shift.profiles?.first_name && shift.profiles?.last_name 
              ? `${shift.profiles.first_name} ${shift.profiles.last_name}` 
              : 'Ukjent ansatt')
          : (user?.user_metadata?.first_name + ' ' + user?.user_metadata?.last_name);

        resultSessions.push({
          id: 'schedule_only_' + key,
          punch_in: {
            id: 'schedule_in_' + key,
            entry_type: 'punch_in' as const,
            timestamp: shift.start_time,
            employee_id: shift.employee_id,
            employee_name: employeeName
          },
          punch_out: {
            id: 'schedule_out_' + key,
            entry_type: 'punch_out' as const,
            timestamp: shift.end_time,
            employee_id: shift.employee_id,
            employee_name: employeeName
          },
          duration: shiftDuration,
          employee_name: employeeName
        });
      }
    });

    return resultSessions.sort((a, b) => 
      new Date(b.punch_in.timestamp).getTime() - new Date(a.punch_in.timestamp).getTime()
    );
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
          {userRole === 'admin' ? 'Alle Arbeidsvakter' : 'Mine Arbeidsvakter'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? 'text-lg' : ''}>Arbeidsøkt Historikk</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {workSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen arbeidsøkter funnet.
            </div>
          ) : (
            <div className={isMobile ? 'overflow-x-auto' : ''}>
              <ScrollArea className={isMobile ? 'w-full' : ''}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={isMobile ? 'min-w-[100px]' : ''}>Dato</TableHead>
                      <TableHead className={isMobile ? 'min-w-[150px]' : ''}>Tidsperiode</TableHead>
                      <TableHead className={isMobile ? 'min-w-[80px]' : ''}>Varighet</TableHead>
                      <TableHead className={isMobile ? 'min-w-[80px]' : ''}>Status</TableHead>
                      {userRole === 'admin' && <TableHead className={isMobile ? 'min-w-[120px]' : ''}>Ansatt</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {format(new Date(session.punch_in.timestamp), isMobile ? 'dd/MM' : 'dd MMM yyyy', { locale: nb })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 ${isMobile ? 'flex-col items-start gap-1' : ''}`}>
                            <div className="flex items-center gap-1">
                              <ArrowUp className="h-3 w-3 text-green-600" />
                              <span className="text-xs">
                                {session.punch_in.timestamp.substring(11, 16)}
                              </span>
                            </div>
                            {session.punch_out && (
                              <div className="flex items-center gap-1">
                                {!isMobile && <span className="text-muted-foreground">→</span>}
                                <ArrowDown className="h-3 w-3 text-red-600" />
                                <span className="text-xs">
                                  {session.punch_out.timestamp.substring(11, 16)}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
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
                          <TableCell className="text-sm">
                            {session.employee_name || 'Ukjent ansatt'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}