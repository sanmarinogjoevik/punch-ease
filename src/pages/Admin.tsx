import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

const Admin = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  // Fetch all profiles/employees
  const { data: employees } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: async () => {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // Then get user roles for each profile
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

  // Fetch recent time entries with manual join
  const { data: recentEntries } = useQuery({
    queryKey: ['admin-time-entries'],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (error) throw error;

      // Manually fetch profile data for each entry
      const entriesWithProfiles = await Promise.all(
        entries.map(async (entry) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', entry.employee_id)
            .single();
          
          return {
            ...entry,
            profiles: profile
          };
        })
      );
      
      return entriesWithProfiles as TimeEntry[];
    },
    enabled: userRole === 'admin'
  });

  // Fetch today's active shifts
  const { data: activeShifts } = useQuery({
    queryKey: ['admin-active-shifts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: userRole === 'admin'
  });

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Badge variant="secondary" className="text-sm">
          <Users className="w-4 h-4 mr-1" />
          Admin
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt anställda</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva skift idag</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeShifts?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Senaste in/ut</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentEntries?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rapporter</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Snart</div>
          </CardContent>
        </Card>
      </div>

      {/* Employees List */}
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

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Senaste in/ut-stämplingar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentEntries?.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">
                    {entry.profiles?.first_name} {entry.profiles?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{entry.profiles?.email}</p>
                </div>
                <div className="text-right">
                  <Badge variant={entry.entry_type === 'punch_in' ? 'default' : 'secondary'}>
                    {entry.entry_type === 'punch_in' ? 'IN' : 'UT'}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(entry.timestamp).toLocaleString('sv-SE')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;