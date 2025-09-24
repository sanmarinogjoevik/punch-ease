import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Clock, 
  Calendar, 
  BarChart3, 
  Plus, 
  Download, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  TrendingUp
} from "lucide-react";
import { format, isToday, parseISO, startOfDay, endOfDay } from "date-fns";
import { sv } from "date-fns/locale";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  updated_at: string;
  user_roles: Array<{ role: string }>;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface Shift {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface ActiveEmployee {
  employee_id: string;
  punch_in_time: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

const Admin = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  // Fetch all profiles/employees
  const { data: employees } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      const profilesWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: role } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .single();
          
          return {
            ...profile,
            user_roles: role ? [role] : [{ role: 'employee' }]
          };
        })
      );
      
      return profilesWithRoles as Profile[];
    },
    enabled: userRole === 'admin'
  });

  // Fetch currently active employees (clocked in)
  const { data: activeEmployees } = useQuery({
    queryKey: ['admin-active-employees'],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('employee_id, timestamp, entry_type')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;

      // Group by employee and find who's currently clocked in
      const employeeStatus = new Map();
      
      entries.forEach(entry => {
        if (!employeeStatus.has(entry.employee_id)) {
          employeeStatus.set(entry.employee_id, {
            employee_id: entry.employee_id,
            last_action: entry.entry_type,
            timestamp: entry.timestamp
          });
        }
      });

      // Filter only those who are clocked in
      const activeEmployeeIds = Array.from(employeeStatus.values())
        .filter(emp => emp.last_action === 'punch_in')
        .map(emp => ({
          employee_id: emp.employee_id,
          punch_in_time: emp.timestamp
        }));

      // Get profile data for active employees
      const activeWithProfiles = await Promise.all(
        activeEmployeeIds.map(async (emp) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', emp.employee_id)
            .single();
          
          return {
            ...emp,
            profiles: profile
          };
        })
      );
      
      return activeWithProfiles as ActiveEmployee[];
    },
    enabled: userRole === 'admin',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch today's shifts
  const { data: todaysShifts } = useQuery({
    queryKey: ['admin-todays-shifts'],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('start_time', startOfToday)
        .lte('start_time', endOfToday)
        .order('start_time', { ascending: true });
      
      if (error) throw error;

      // Get profile data for each shift
      const shiftsWithProfiles = await Promise.all(
        shifts.map(async (shift) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', shift.employee_id)
            .single();
          
          return {
            ...shift,
            profiles: profile
          };
        })
      );
      
      return shiftsWithProfiles as Shift[];
    },
    enabled: userRole === 'admin',
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch this week's shifts
  const { data: weeklyShifts } = useQuery({
    queryKey: ['admin-weekly-shifts'],
    queryFn: async () => {
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));

      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('start_time', weekStart.toISOString())
        .lte('end_time', weekEnd.toISOString())
        .order('start_time', { ascending: true });
      
      if (error) throw error;

      const shiftsWithProfiles = await Promise.all(
        shifts.map(async (shift) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', shift.employee_id)
            .single();
          
          return {
            ...shift,
            profiles: profile
          };
        })
      );
      
      return shiftsWithProfiles as Shift[];
    },
    enabled: userRole === 'admin'
  });

  // Calculate shift status
  const getShiftStatus = (shift: Shift) => {
    const now = new Date();
    const shiftStart = parseISO(shift.start_time);
    const shiftEnd = parseISO(shift.end_time);
    
    const isActive = activeEmployees?.some(emp => emp.employee_id === shift.employee_id);
    
    if (now < shiftStart) {
      return { status: 'upcoming', icon: Timer, label: 'Ej startat' };
    } else if (now > shiftEnd) {
      return { status: 'completed', icon: CheckCircle, label: 'Avslutat' };
    } else if (isActive) {
      return { status: 'active', icon: CheckCircle, label: 'Inloggad' };
    } else {
      return { status: 'missed', icon: XCircle, label: 'Missad punch' };
    }
  };

  const makeAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', userId);

      if (error) throw error;
      
      toast({
        title: "Framgång",
        description: "Användaren är nu admin",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte göra användaren till admin",
        variant: "destructive",
      });
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Åtkomst nekad</CardTitle>
            <CardDescription>
              Du har inte behörighet att komma åt adminsidan.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalPlannedHours = todaysShifts?.reduce((total, shift) => {
    const start = parseISO(shift.start_time);
    const end = parseISO(shift.end_time);
    return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Badge variant="secondary" className="text-sm">
          <Users className="w-4 h-4 mr-1" />
          Admin
        </Badge>
      </div>

      {/* 1. Dagens översikt */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inloggade nu</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEmployees?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planerade pass idag</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{todaysShifts?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planerade timmar idag</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalPlannedHours.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt anställda</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Snabbknappar */}
      <Card>
        <CardHeader>
          <CardTitle>Snabbknappar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Lägg till pass
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Lägg till anställd
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportera rapport
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aktiva anställda just nu */}
      {activeEmployees && activeEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Aktiva pass just nu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeEmployees.map((emp) => (
                <div key={emp.employee_id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p className="font-medium">
                      {emp.profiles?.first_name} {emp.profiles?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{emp.profiles?.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="default" className="bg-green-600">
                      Inloggad
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sedan {format(parseISO(emp.punch_in_time), 'HH:mm', { locale: sv })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dagens pass med status */}
      <Card>
        <CardHeader>
          <CardTitle>Dagens pass</CardTitle>
          <CardDescription>Översikt över alla planerade pass idag</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todaysShifts?.map((shift) => {
              const { status, icon: StatusIcon, label } = getShiftStatus(shift);
              const statusColors = {
                upcoming: 'text-blue-600 bg-blue-50 border-blue-200',
                active: 'text-green-600 bg-green-50 border-green-200',
                missed: 'text-red-600 bg-red-50 border-red-200',
                completed: 'text-gray-600 bg-gray-50 border-gray-200'
              };
              
              return (
                <div key={shift.id} className={`flex items-center justify-between p-3 border rounded-lg ${statusColors[status as keyof typeof statusColors]}`}>
                  <div>
                    <p className="font-medium">
                      {shift.profiles?.first_name} {shift.profiles?.last_name}
                    </p>
                    <p className="text-sm opacity-80">
                      {format(parseISO(shift.start_time), 'HH:mm', { locale: sv })} - {format(parseISO(shift.end_time), 'HH:mm', { locale: sv })}
                    </p>
                    {shift.location && (
                      <p className="text-sm opacity-70">📍 {shift.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                </div>
              );
            })}
            {(!todaysShifts || todaysShifts.length === 0) && (
              <p className="text-center text-muted-foreground py-6">Inga pass planerade idag</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Vaktlista för veckan */}
      <Card>
        <CardHeader>
          <CardTitle>Veckans pass</CardTitle>
          <CardDescription>Översikt över kommande pass</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weeklyShifts?.map((shift) => (
              <div key={shift.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">
                    {shift.profiles?.first_name} {shift.profiles?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(shift.start_time), 'EEEE dd MMM, HH:mm', { locale: sv })} - {format(parseISO(shift.end_time), 'HH:mm', { locale: sv })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">Ändra</Button>
                  <Button variant="ghost" size="sm" className="text-red-600">Ta bort</Button>
                </div>
              </div>
            )) || <p className="text-center text-muted-foreground py-6">Inga pass planerade denna vecka</p>}
          </div>
        </CardContent>
      </Card>

      {/* 4. Anställda med roller */}
      <Card>
        <CardHeader>
          <CardTitle>Anställda</CardTitle>
          <CardDescription>Hantera användarroller och behörigheter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees?.map((employee) => {
              const userRole = employee.user_roles?.[0]?.role;
              const isAdmin = userRole === 'admin';
              
              return (
                <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isAdmin ? 'default' : 'secondary'}>
                      {isAdmin ? 'Admin' : 'Anställd'}
                    </Badge>
                    {!isAdmin && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => makeAdmin(employee.user_id)}
                      >
                        Gör till admin
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 5. Notiser & varningar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Notiser & Varningar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Placeholder för varningar */}
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Inga varningar för tillfället</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Veckans statistik */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Veckans statistik
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{weeklyShifts?.length || 0}</p>
              <p className="text-sm text-blue-800">Antal pass</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {weeklyShifts?.reduce((total, shift) => {
                  const start = parseISO(shift.start_time);
                  const end = parseISO(shift.end_time);
                  return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                }, 0).toFixed(1) || '0'}h
              </p>
              <p className="text-sm text-green-800">Totalt planerade timmar</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{employees?.length || 0}</p>
              <p className="text-sm text-purple-800">Aktiva anställda</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;