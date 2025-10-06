import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatTimeNorway, isAfterClosingTime } from '@/lib/timeUtils';
import { processTimeEntry, type TimeEntry as TimeEntryType } from '@/lib/timeEntryUtils';

interface WorkSession {
  id: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  duration: string | null;
  employeeName?: string;
  source?: 'schedule' | 'actual' | 'none';
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
  }, [user, userRole, shiftsData, companySettings]);

  const fetchTimeEntries = async () => {
    if (!user) return;

    try {
      // Fetch time entries
      let query = supabase
        .from('time_entries')
        .select('*')
        .order('timestamp', { ascending: false });

      if (userRole !== 'admin') {
        query = query.eq('employee_id', user.id);
      }

      const { data: entriesData, error: entriesError } = await query;

      if (entriesError) {
        console.error('Error fetching time entries:', entriesError);
        return;
      }

      // Fetch employee names if admin
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

      // Process entries into sessions using shared logic
      const sessions = processEntriesIntoSessions(entriesData || [], profilesMap);
      setWorkSessions(sessions);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEntriesIntoSessions = (entries: any[], profilesMap: Map<string, string>): WorkSession[] => {
    const businessHours = companySettings?.business_hours as Array<{
      day: number;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    }> | undefined;

    // Group entries by employee and date
    const entriesByEmployeeAndDate = new Map<string, Map<string, any[]>>();
    
    entries.forEach(entry => {
      const entryDate = startOfDay(new Date(entry.timestamp));
      const dateKey = entryDate.toISOString();
      
      if (!entriesByEmployeeAndDate.has(entry.employee_id)) {
        entriesByEmployeeAndDate.set(entry.employee_id, new Map());
      }
      
      const employeeMap = entriesByEmployeeAndDate.get(entry.employee_id)!;
      if (!employeeMap.has(dateKey)) {
        employeeMap.set(dateKey, []);
      }
      
      employeeMap.get(dateKey)!.push(entry);
    });

    const sessions: WorkSession[] = [];

    // Process each employee's dates
    entriesByEmployeeAndDate.forEach((dateMap, employeeId) => {
      dateMap.forEach((dayEntries, dateKey) => {
        const date = new Date(dateKey);
        const now = new Date();
        const isToday = startOfDay(date).getTime() === startOfDay(now).getTime();

        // Sort entries by timestamp
        const sortedEntries = [...dayEntries].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const punchInEntry = sortedEntries.find(e => e.entry_type === 'punch_in');
        const punchOutEntry = sortedEntries.find(e => e.entry_type === 'punch_out');

        // Find matching shift
        const dayShift = shiftsData?.find(shift => {
          const shiftDate = startOfDay(new Date(shift.start_time));
          return shift.employee_id === employeeId && 
                 shiftDate.getTime() === date.getTime();
        });

        // Visa alltid entries med schema
        if (!dayShift) {
          // Ingen schema - kolla om butiken är stängd
          if (!punchInEntry) {
            return; // Ingen punch-data alls
          }
          
          // Kolla om det är efter stängning
          if (isAfterClosingTime(date, businessHours)) {
            return; // Dölj entries utan schema efter stängning
          }
        }

        // Use shared processing logic
        const processed = processTimeEntry(
          date,
          dayShift,
          punchInEntry,
          punchOutEntry,
          businessHours,
          isToday
        );

        if (processed.hasData) {
          // Format duration
          const hours = Math.floor(processed.totalMinutes / 60);
          const minutes = processed.totalMinutes % 60;
          
          const duration = processed.punchOut && !processed.isOngoing
            ? `${hours}h ${minutes}m`
            : processed.isOngoing
            ? `${hours}h ${minutes}m (pågående)`
            : null;

          sessions.push({
            id: punchInEntry?.id || `schedule-${dayShift?.id}`,
            date: format(new Date(processed.punchIn!), 'dd MMM yyyy', { locale: nb }),
            punchIn: processed.punchIn!,
            punchOut: processed.punchOut,
            duration,
            employeeName: profilesMap.get(employeeId),
            source: processed.source
          });
        }
      });
    });

    return sessions.sort((a, b) => 
      new Date(b.punchIn).getTime() - new Date(a.punchIn).getTime()
    );
  };

  const getSessionBadge = (session: WorkSession) => {
    if (!session.punchOut) {
      return (
        <Badge variant="outline" className="border-yellow-200 text-yellow-700 bg-yellow-50">
          Aktiv
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
        Fullført
      </Badge>
    );
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
                            {session.date}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 ${isMobile ? 'flex-col items-start gap-1' : ''}`}>
                            <div className="flex items-center gap-1">
                              <ArrowUp className="h-3 w-3 text-green-600" />
                              <span className="text-xs">
                                {formatTimeNorway(session.punchIn)}
                              </span>
                            </div>
                            {session.punchOut && (
                              <div className="flex items-center gap-1">
                                {!isMobile && <span className="text-muted-foreground">→</span>}
                                <ArrowDown className="h-3 w-3 text-red-600" />
                                <span className="text-xs">
                                  {formatTimeNorway(session.punchOut)}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {session.duration || <span className="text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getSessionBadge(session)}
                        </TableCell>
                        {userRole === 'admin' && (
                          <TableCell className="text-sm">
                            {session.employeeName || 'Ukjent ansatt'}
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
