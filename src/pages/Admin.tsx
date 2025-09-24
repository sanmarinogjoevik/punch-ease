import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { 
  Users, 
  Clock, 
  Calendar, 
  BarChart3, 
  Plus, 
  Download, 
  AlertCircle,
  CheckCircle,
  Timer,
  TrendingUp
} from "lucide-react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { nb } from "date-fns/locale";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  personal_number: string | null;
  created_at: string;
  updated_at: string;
  user_roles: Array<{ role: string }>;
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

const Admin = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

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
    enabled: userRole === 'admin'
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

  // Calculate shift status (simplified - no punch tracking)
  const getShiftStatus = (shift: Shift) => {
    const now = new Date();
    const shiftStart = parseISO(shift.start_time);
    const shiftEnd = parseISO(shift.end_time);
    
    if (now < shiftStart) {
      return { status: 'upcoming', icon: Timer, label: 'Ikke startet' };
    } else if (now > shiftEnd) {
      return { status: 'completed', icon: CheckCircle, label: 'Avsluttet' };
    } else {
      return { status: 'active', icon: Clock, label: 'Pågår' };
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
        title: "Suksess",
        description: "Brukeren er nå admin",
      });
    } catch (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke gjøre brukeren til admin",
        variant: "destructive",
      });
    }
  };


  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Tilgang nektet</CardTitle>
            <CardDescription>
              Du har ikke tillatelse til å få tilgang til administrasjonssiden.
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

      {/* Dagens översikt - utan punch tracking */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planlagte vakter i dag</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{todaysShifts?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planlagte timer i dag</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalPlannedHours.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt ansatte</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Snabbknappar */}
      <Card>
        <CardHeader>
          <CardTitle>Hurtigknapper</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Legg til vakt
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Eksporter rapport
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dagens pass med status (utan punch tracking) */}
      <Card>
        <CardHeader>
          <CardTitle>Dagens vakter</CardTitle>
          <CardDescription>Oversikt over alle planlagte vakter i dag</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todaysShifts?.map((shift) => {
              const { status, icon: StatusIcon, label } = getShiftStatus(shift);
              const statusColors = {
                upcoming: 'text-blue-600 bg-blue-50 border-blue-200',
                active: 'text-green-600 bg-green-50 border-green-200',
                completed: 'text-gray-600 bg-gray-50 border-gray-200'
              };
              
              return (
                <div key={shift.id} className={`flex items-center justify-between p-3 border rounded-lg ${statusColors[status as keyof typeof statusColors]}`}>
                  <div>
                    <p className="font-medium">
                      {shift.profiles?.first_name} {shift.profiles?.last_name}
                    </p>
                    <p className="text-sm opacity-80">
                      {format(parseISO(shift.start_time), 'HH:mm', { locale: nb })} - {format(parseISO(shift.end_time), 'HH:mm', { locale: nb })}
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
              <p className="text-center text-muted-foreground py-6">Ingen vakter planlagt i dag</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vaktlista för veckan */}
      <Card>
        <CardHeader>
          <CardTitle>Ukens vakter</CardTitle>
          <CardDescription>Oversikt over kommende vakter</CardDescription>
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
                    {format(parseISO(shift.start_time), 'EEEE dd MMM, HH:mm', { locale: nb })} - {format(parseISO(shift.end_time), 'HH:mm', { locale: nb })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">Endre</Button>
                  <Button variant="ghost" size="sm" className="text-red-600">Ta bort</Button>
                </div>
              </div>
            )) || <p className="text-center text-muted-foreground py-6">Ingen vakter planlagt denne uken</p>}
          </div>
        </CardContent>
      </Card>

      {/* Anställda med roller */}
      <Card>
        <CardHeader>
          <CardTitle>Ansatte</CardTitle>
          <CardDescription>Administrer brukerroller og tillatelser</CardDescription>
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
                      {isAdmin ? 'Admin' : 'Ansatt'}
                    </Badge>
                    {!isAdmin && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => makeAdmin(employee.user_id)}
                      >
                        Gjør til admin
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notiser & varningar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Merknader og advarsler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Ingen advarsler akkurat nå</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Veckans statistik */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Ukens statistikk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{weeklyShifts?.length || 0}</p>
              <p className="text-sm text-blue-800">Antall vakter</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {weeklyShifts?.reduce((total, shift) => {
                  const start = parseISO(shift.start_time);
                  const end = parseISO(shift.end_time);
                  return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                }, 0).toFixed(1) || '0'}h
              </p>
              <p className="text-sm text-green-800">Totalt planlagte timer</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{employees?.length || 0}</p>
              <p className="text-sm text-purple-800">Aktive ansatte</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;