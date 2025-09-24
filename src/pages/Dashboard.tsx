import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PunchClock } from '@/components/PunchClock';
import { Calendar, Clock, Users, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
}

interface TimeEntry {
  id: string;
  entry_type: string;
  timestamp: string;
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
  const [recentTimeEntries, setRecentTimeEntries] = useState<TimeEntry[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);
  const { user, userRole } = useAuth();

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
      // Get today's date range
      const today = new Date();
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

      // Fetch recent time entries (last 10)
      const { data: timeEntriesData, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (timeEntriesError) throw timeEntriesError;
      setRecentTimeEntries(timeEntriesData || []);

    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's your overview.
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
                  Dagens Pass
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
                    Inga pass idag
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Shifts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Kommande Pass
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingShifts.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingShifts.map((shift) => (
                      <div key={shift.id} className="p-3 rounded-lg border">
                        <div className="font-medium">
                          {new Date(shift.start_time).toLocaleDateString('sv-SE')}
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
                    Inga kommande pass
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Time Entries */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Senaste Stämplingar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentTimeEntries.length > 0 ? (
                  <div className="space-y-2">
                    {recentTimeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${entry.entry_type === 'punch_in' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="font-medium">
                            {entry.entry_type === 'punch_in' ? 'In' : 'Ut'}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(entry.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Inga stämplingar ännu
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
                Active Employees
              </CardTitle>
              <CardDescription>
                Employees currently punched in
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
                          <span className="font-medium">Active</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Since {formatTime(employee.punch_time)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  No employees currently punched in
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}