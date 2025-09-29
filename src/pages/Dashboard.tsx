import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PunchClock } from '@/components/PunchClock';
import { Calendar, Clock, Users, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
}

interface TimeEntry {
  id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  employee_id: string;
}

interface WorkSession {
  id: string;
  punch_in: TimeEntry;
  punch_out?: TimeEntry;
  duration?: number; // in minutes
}

interface ActiveEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  punch_time: string;
}

export default function Dashboard() {
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [recentWorkSessions, setRecentWorkSessions] = useState<WorkSession[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);
  const { user, userRole } = useAuth();
  const { data: companySettings } = useCompanySettings();

  useEffect(() => {
    if (user) {
      fetchEmployeeScheduleAndEntries();
      if (userRole === 'admin') {
        fetchActiveEmployees();
      }
    }
  }, [user, userRole]);

  const fetchEmployeeScheduleAndEntries = async () => {
    if (!user) return;

    try {
      // Get date range for last 30 days to current day
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Get today's date range
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(startOfToday);
      endOfToday.setDate(endOfToday.getDate() + 1);
      
      // Fetch today's shifts
      const { data: todayShiftsData, error: todayError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('start_time', startOfToday.toISOString())
        .lt('start_time', endOfToday.toISOString())
        .order('start_time', { ascending: true });

      if (todayError) throw todayError;
      setTodayShifts(todayShiftsData || []);

      // Fetch upcoming shifts (next 7 days, excluding today)
      const { data: upcomingShiftsData, error: upcomingError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('start_time', endOfToday.toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      if (upcomingError) throw upcomingError;
      setUpcomingShifts(upcomingShiftsData || []);

      // Fetch recent time entries
      const { data: timeEntriesData, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (timeEntriesError) throw timeEntriesError;

      // Fetch shifts for the same period
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: false });

      if (shiftsError) throw shiftsError;
      
      // Group entries into work sessions and apply hybrid logic
      const sessions = groupIntoWorkSessions(timeEntriesData || []);
      const hybridSessions = applyHybridLogic(sessions, shiftsData || []);
      setRecentWorkSessions(hybridSessions.slice(0, 5)); // Show last 5 sessions

    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const groupIntoWorkSessions = (entries: TimeEntry[]): WorkSession[] => {
    const sessions: WorkSession[] = [];
    
    // Sort by timestamp (oldest first for pairing)
    const sortedEntries = entries.sort((a, b) => 
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
          if (sortedEntries[j].entry_type === 'punch_out') {
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
          duration
        });
      }
      i++;
    }

    // Sort sessions by punch_in timestamp (newest first)
    return sessions.sort((a, b) => 
      new Date(b.punch_in.timestamp).getTime() - new Date(a.punch_in.timestamp).getTime()
    );
  };

  const fetchActiveEmployees = async () => {
    try {
      // Get all employees who are currently punched in
      const { data: punchedInData, error: punchedInError } = await supabase
        .from('time_entries')
        .select(`
          employee_id,
          timestamp,
          entry_type
        `)
        .order('timestamp', { ascending: false });

      if (punchedInError) throw punchedInError;

      // Find employees who are currently punched in
      const employeeStatus = new Map();
      punchedInData?.forEach((entry) => {
        if (!employeeStatus.has(entry.employee_id)) {
          employeeStatus.set(entry.employee_id, {
            isPunchedIn: entry.entry_type === 'punch_in',
            lastPunch: entry.timestamp
          });
        }
      });

      const punchedInEmployeeIds = Array.from(employeeStatus.entries())
        .filter(([_, status]) => status.isPunchedIn)
        .map(([id, status]) => ({ id, timestamp: status.lastPunch }));

      if (punchedInEmployeeIds.length === 0) {
        setActiveEmployees([]);
        return;
      }

      // Get profile information for punched in employees
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', punchedInEmployeeIds.map(emp => emp.id));

      if (profilesError) throw profilesError;

      const activeEmps = profilesData?.map(profile => {
        const punchInfo = punchedInEmployeeIds.find(emp => emp.id === profile.user_id);
        return {
          id: profile.user_id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email,
          punch_time: punchInfo?.timestamp || ''
        };
      }) || [];

      setActiveEmployees(activeEmps);
    } catch (error) {
      console.error('Error fetching active employees:', error);
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const shouldUseScheduleTimes = (date: Date): boolean => {
    if (!companySettings?.business_hours) return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // For past days, always use schedule times
    if (targetDate < today) {
      return true;
    }
    
    // For today, check if store has closed
    if (targetDate.getTime() === today.getTime()) {
      const dayOfWeek = now.getDay();
      const todayHours = companySettings.business_hours.find(h => h.day === dayOfWeek);
      
      if (!todayHours?.isOpen) return true;
      
      const [closeHour, closeMinute] = todayHours.closeTime.split(':').map(Number);
      const closeTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeHour, closeMinute);
      
      return now >= closeTime;
    }
    
    return false;
  };

  const applyHybridLogic = (sessions: WorkSession[], shifts: Shift[]): WorkSession[] => {
    const resultSessions: WorkSession[] = [];
    const allProcessedDates = new Set<string>();

    // Create a map of shifts by date
    const shiftDateMap = new Map<string, Shift[]>();
    shifts.forEach(shift => {
      const shiftDate = new Date(shift.start_time).toDateString();
      if (!shiftDateMap.has(shiftDate)) {
        shiftDateMap.set(shiftDate, []);
      }
      shiftDateMap.get(shiftDate)!.push(shift);
    });

    // Process existing punch sessions
    sessions.forEach(session => {
      const sessionDate = new Date(session.punch_in.timestamp);
      const sessionDateStr = sessionDate.toDateString();
      allProcessedDates.add(sessionDateStr);
      
      const useScheduleTimes = shouldUseScheduleTimes(sessionDate);
      
      if (useScheduleTimes) {
        // After closing: COMPLETELY IGNORE punch data, use ONLY schedule if it exists
        const dayShifts = shiftDateMap.get(sessionDateStr);
        if (dayShifts && dayShifts.length > 0) {
          const shift = dayShifts[0];
          const duration = Math.round((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60));

          resultSessions.push({
            id: 'schedule_' + shift.id,
            punch_in: {
              ...session.punch_in,
              id: 'schedule_in_' + shift.id,
              timestamp: shift.start_time
            },
            punch_out: {
              ...session.punch_in,
              id: 'schedule_out_' + shift.id,
              entry_type: 'punch_out' as const,
              timestamp: shift.end_time
            },
            duration
          });
        }
        // If no schedule exists for this date after closing, don't show anything
      } else {
        // During the day: Use ONLY punch times, completely ignore schedule
        resultSessions.push(session);
      }
    });

    // Add schedule-only entries for dates without any punch data (after closing only)
    shiftDateMap.forEach((dayShifts, shiftDateStr) => {
      const shiftDate = new Date(dayShifts[0].start_time);
      const useScheduleTimes = shouldUseScheduleTimes(shiftDate);

      if (useScheduleTimes && !allProcessedDates.has(shiftDateStr)) {
        const shift = dayShifts[0];
        const duration = Math.round((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60));

        resultSessions.push({
          id: 'schedule_only_' + shift.id,
          punch_in: {
            id: 'schedule_in_' + shift.id,
            entry_type: 'punch_in' as const,
            timestamp: shift.start_time,
            employee_id: user?.id || ''
          },
          punch_out: {
            id: 'schedule_out_' + shift.id,
            entry_type: 'punch_out' as const,
            timestamp: shift.end_time,
            employee_id: user?.id || ''
          },
          duration
        });
      }
    });

    return resultSessions.sort((a, b) => 
      new Date(b.punch_in.timestamp).getTime() - new Date(a.punch_in.timestamp).getTime()
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Velkommen tilbake! Her er din oversikt.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Punch Clock - Always visible */}
        <div className="md:col-span-2 lg:col-span-1">
          <PunchClock />
        </div>

        {/* Employee Dashboard */}
        {userRole === 'employee' && (
          <>
            {/* Today's Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Dagens Vakter
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayShifts.length > 0 ? (
                  <div className="space-y-3">
                    {todayShifts.map((shift) => (
                      <div key={shift.id} className="p-3 rounded-lg border">
                        <div className="font-medium">
                          {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                        </div>
                        {shift.location && (
                          <div className="text-sm text-muted-foreground">
                            📍 {shift.location}
                          </div>
                        )}
                        {shift.notes && (
                          <div className="text-sm text-muted-foreground">
                            💬 {shift.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Ingen vakter i dag
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Kommende Vakter
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingShifts.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingShifts.map((shift) => (
                      <div key={shift.id} className="p-3 rounded-lg border">
                        <div className="font-medium">
                          {new Date(shift.start_time).toLocaleDateString('nb-NO')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                        </div>
                        {shift.location && (
                          <div className="text-sm text-muted-foreground">
                            📍 {shift.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Ingen kommende vakter
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Work Sessions */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Siste Arbeidsvakter
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentWorkSessions.length > 0 ? (
                  <TooltipProvider>
                    <div className="space-y-3">
                      {recentWorkSessions.map((session) => (
                        <div key={session.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="font-medium">
                                {new Date(session.punch_in.timestamp).toLocaleDateString('nb-NO')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {session.punch_out ? (
                                <div className="flex items-center gap-1 text-green-600">
                                  <span className="text-sm">Avsluttet</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-yellow-600">
                                  <span className="text-sm">Pågående</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                            <div>
                              {formatTime(session.punch_in.timestamp)}
                              {session.punch_out && (
                                <span> - {formatTime(session.punch_out.timestamp)}</span>
                              )}
                            </div>
                            <div className="font-medium">
                              {session.duration !== undefined ? (
                                formatDuration(session.duration)
                              ) : (
                                <span className="text-yellow-600">Pågående</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TooltipProvider>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Ingen arbeidsvakter ennå
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Active Employees - Admin view */}
        {userRole === 'admin' && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Aktive Ansatte
              </CardTitle>
              <CardDescription>
                Ansatte som for øyeblikket er pålogget
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeEmployees.length > 0 ? (
                <div className="space-y-3">
                  {activeEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {employee.email}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-600">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">Aktiv</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Siden {formatTime(employee.punch_time)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Ingen ansatte er for øyeblikket pålogget
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}