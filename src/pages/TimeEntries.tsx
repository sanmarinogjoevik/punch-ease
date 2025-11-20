import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShifts, useShiftsSubscription } from '@/hooks/useShifts';
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
import { formatTimeNorway, toNorwegianTime, getNorwegianNow, extractTime } from '@/lib/timeUtils';
import { processTimeEntry, type TimeEntry as TimeEntryType } from '@/lib/timeEntryUtils';

interface WorkSession {
  id: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  duration: string | null;
  employeeName?: string;
  source?: 'schedule' | 'actual' | 'none';
  isOngoing?: boolean;
}

export default function TimeEntries() {
  const { user, userRole } = useAuth();
  const { data: shiftsData } = useShifts(userRole === 'admin' ? {} : { employeeId: user?.id });
  useShiftsSubscription(); // Real-time updates for shifts
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

    // Grupp: punch-entries per ansatt + dato (i norsk tid)
    const entriesByEmployeeAndDate = new Map<string, Map<string, any[]>>();

    entries.forEach((entry) => {
      const norwegianDate = toNorwegianTime(entry.timestamp);
      const entryDate = startOfDay(norwegianDate);
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

    // Grupp: skift per ansatt + dato (vaktlista). Detta är det som styr VILKA dagar som visas.
    const shiftsByEmployeeAndDate = new Map<string, Map<string, any>>();

    shiftsData?.forEach((shift: any) => {
      const norwegianShiftDate = toNorwegianTime(shift.start_time);
      const shiftDate = startOfDay(norwegianShiftDate);
      const dateKey = shiftDate.toISOString();

      if (!shiftsByEmployeeAndDate.has(shift.employee_id)) {
        shiftsByEmployeeAndDate.set(shift.employee_id, new Map());
      }

      const employeeMap = shiftsByEmployeeAndDate.get(shift.employee_id)!;
      // Om det finns flera skift samma dag väljer vi första
      if (!employeeMap.has(dateKey)) {
        employeeMap.set(dateKey, shift);
      }
    });

    const sessions: WorkSession[] = [];
    const todayNorway = startOfDay(getNorwegianNow());

    // Processera ENBART dagar som har schema i vaktlistan
    shiftsByEmployeeAndDate.forEach((dateMap, employeeId) => {
      dateMap.forEach((dayShift, dateKey) => {
        const date = new Date(dateKey);
        const dayNorway = startOfDay(toNorwegianTime(date));
        const isToday = dayNorway.getTime() === todayNorway.getTime();
        const isFuture = dayNorway.getTime() > todayNorway.getTime();

        // Visa bara dagar som redan varit (inkl idag)
        if (isFuture) {
          return;
        }

        const employeeEntriesMap = entriesByEmployeeAndDate.get(employeeId);
        const dayEntries = employeeEntriesMap?.get(dateKey) ?? [];

        // Sortera punch-entries kronologiskt
        const sortedEntries = [...dayEntries].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const punchInEntry = sortedEntries.find((e) => e.entry_type === 'punch_in');
        const punchOutEntry = sortedEntries.find((e) => e.entry_type === 'punch_out');

        const processed = processTimeEntry(
          date,
          dayShift,
          punchInEntry,
          punchOutEntry,
          businessHours,
          isToday
        );

        if (processed.hasData) {
          const hours = Math.floor(processed.totalMinutes / 60);
          const minutes = processed.totalMinutes % 60;

          const duration = processed.punchOut && !processed.isOngoing
            ? `${hours}h ${minutes}m`
            : processed.isOngoing
            ? `${hours}h ${minutes}m (pågående)`
            : null;

          sessions.push({
            id: punchInEntry?.id || `schedule-${dayShift.id}`,
            date: format(new Date(processed.punchIn!), 'dd MMM yyyy', { locale: nb }),
            punchIn: processed.punchIn!,
            punchOut: processed.punchOut,
            duration,
            employeeName: profilesMap.get(employeeId),
            source: processed.source,
            isOngoing: processed.isOngoing,
          });
        }
      });
    });

    return sessions.sort(
      (a, b) => new Date(b.punchIn).getTime() - new Date(a.punchIn).getTime()
    );
  };

  const formatSessionTime = (time: string, source: 'schedule' | 'actual' | 'none') => {
    if (source === 'schedule') {
      // Schema-tider är redan i norsk tid, använd extractTime
      return extractTime(time);
    }
    // Actual punch-tider är UTC, konvertera till norsk tid
    return formatTimeNorway(time);
  };

  const getSessionBadge = (session: WorkSession) => {
    if (session.isOngoing) {
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
                                {formatSessionTime(session.punchIn, session.source!)}
                              </span>
                            </div>
                            {session.punchOut && (
                              <div className="flex items-center gap-1">
                                {!isMobile && <span className="text-muted-foreground">→</span>}
                                <ArrowDown className="h-3 w-3 text-red-600" />
                                <span className="text-xs">
                                  {formatSessionTime(session.punchOut, session.source!)}
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
