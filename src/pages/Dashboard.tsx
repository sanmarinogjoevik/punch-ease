import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PunchClock } from '@/components/PunchClock';
import { Calendar, Clock, Users, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NextShift {
  id: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
}

interface ActiveEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  punch_time: string;
}

export default function Dashboard() {
  const [nextShift, setNextShift] = useState<NextShift | null>(null);
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);
  const { user, userRole } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNextShift();
      if (userRole === 'admin') {
        fetchActiveEmployees();
      }
    }
  }, [user, userRole]);

  const fetchNextShift = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1);

      if (error) throw error;
      setNextShift(data?.[0] || null);
    } catch (error) {
      console.error('Error fetching next shift:', error);
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

        {/* Next Shift - Employee view */}
        {userRole === 'employee' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Next Shift
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextShift ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <strong>Date:</strong> {new Date(nextShift.start_time).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Time:</strong> {formatTime(nextShift.start_time)} - {formatTime(nextShift.end_time)}
                  </div>
                  {nextShift.location && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Location:</strong> {nextShift.location}
                    </div>
                  )}
                  {nextShift.notes && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Notes:</strong> {nextShift.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  No upcoming shifts scheduled
                </div>
              )}
            </CardContent>
          </Card>
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