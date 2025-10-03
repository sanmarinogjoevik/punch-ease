import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { LivePunchStatus } from "@/components/LivePunchStatus";
import { TodaysTemperatureLogs } from "@/components/TodaysTemperatureLogs";
import { EditShiftDialog } from "@/components/EditShiftDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useShiftMutations } from "@/hooks/useShifts";
import { createUTCFromNorwegianTime } from "@/lib/timeUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Clock, 
  Calendar, 
  BarChart3, 
  AlertCircle,
  CheckCircle,
  Timer,
  TrendingUp,
  Building2
} from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { formatTimeNorway } from "@/lib/timeUtils";

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
  company_id: string;
  user_roles: Array<{ role: string }>;
}

interface Shift {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  auto_punch_in: boolean;
  created_at: string;
  company_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  org_number: string | null;
}

const SuperAdmin = () => {
  const { user, userRole, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateShift, deleteShift } = useShiftMutations();
  const isMobile = useIsMobile();
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);

  // Fetch all companies
  const { data: companies } = useQuery({
    queryKey: ['superadmin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Company[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch all employees for selected company
  const { data: employees } = useQuery({
    queryKey: ['superadmin-employees', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', selectedCompanyId)
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
    enabled: isSuperAdmin && !!selectedCompanyId,
  });

  // Fetch today's shifts for selected company
  const { data: todaysShifts } = useQuery({
    queryKey: ['superadmin-today-shifts', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Fetch shifts first
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .gte('start_time', startOfToday.toISOString())
        .lte('start_time', endOfToday.toISOString())
        .order('start_time', { ascending: true });

      if (shiftsError) throw shiftsError;
      if (!shiftsData || shiftsData.length === 0) return [];

      // Then fetch profiles for all employees in those shifts
      const employeeIds = [...new Set(shiftsData.map(s => s.employee_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', employeeIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return shiftsData.map(shift => ({
        ...shift,
        profiles: profilesMap.get(shift.employee_id) || null
      })) as Shift[];
    },
    enabled: isSuperAdmin && !!selectedCompanyId,
  });

  // Fetch this week's shifts for selected company
  const { data: weekShifts } = useQuery({
    queryKey: ['superadmin-week-shifts', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      
      const today = new Date();
      const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
      const endOfThisWeek = endOfWeek(today, { weekStartsOn: 1 });

      // Fetch shifts first
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .gte('start_time', startOfThisWeek.toISOString())
        .lte('start_time', endOfThisWeek.toISOString())
        .order('start_time', { ascending: true });

      if (shiftsError) throw shiftsError;
      if (!shiftsData || shiftsData.length === 0) return [];

      // Then fetch profiles for all employees in those shifts
      const employeeIds = [...new Set(shiftsData.map(s => s.employee_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', employeeIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return shiftsData.map(shift => ({
        ...shift,
        profiles: profilesMap.get(shift.employee_id) || null
      })) as Shift[];
    },
    enabled: isSuperAdmin && !!selectedCompanyId,
  });

  // Global stats across all companies
  const { data: globalStats } = useQuery({
    queryKey: ['superadmin-global-stats'],
    queryFn: async () => {
      const [companiesResult, usersResult, shiftsResult] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('shifts').select('id', { count: 'exact', head: true })
          .gte('start_time', startOfDay(new Date()).toISOString())
          .lte('start_time', endOfDay(new Date()).toISOString()),
      ]);

      return {
        totalCompanies: companiesResult.count || 0,
        totalUsers: usersResult.count || 0,
        todaysShiftsCount: shiftsResult.count || 0,
      };
    },
    enabled: isSuperAdmin,
  });

  const getShiftStatus = (shift: Shift) => {
    const now = new Date();
    const startTime = parseISO(shift.start_time);
    const endTime = parseISO(shift.end_time);
    
    if (now < startTime) {
      return { status: 'upcoming', label: 'Kommende', color: 'bg-blue-500' };
    } else if (now >= startTime && now <= endTime) {
      return { status: 'active', label: 'Aktiv', color: 'bg-green-500' };
    } else {
      return { status: 'completed', label: 'Fullført', color: 'bg-gray-500' };
    }
  };

  const handleSaveShift = async (
    shiftId: string,
    data: {
      startDate: string;
      startTime: string;
      endDate: string;
      endTime: string;
      location: string;
      notes: string;
      autoPunchIn: boolean;
    }
  ) => {
    try {
      const utcStartTime = createUTCFromNorwegianTime(data.startDate, data.startTime);
      const utcEndTime = createUTCFromNorwegianTime(data.endDate, data.endTime);

      await updateShift.mutateAsync({
        id: shiftId,
        start_time: utcStartTime,
        end_time: utcEndTime,
        location: data.location,
        notes: data.notes,
        auto_punch_in: data.autoPunchIn,
      });

      toast({
        title: "Suksess",
        description: "Vakt oppdatert",
      });
      
      setEditingShift(null);
      queryClient.invalidateQueries({ queryKey: ['superadmin-today-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-week-shifts'] });
    } catch (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere vakt",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async () => {
    if (!deletingShiftId) return;
    
    try {
      await deleteShift.mutateAsync(deletingShiftId);
      
      toast({
        title: "Suksess",
        description: "Vakt slettet",
      });
      
      setDeletingShiftId(null);
      queryClient.invalidateQueries({ queryKey: ['superadmin-today-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-week-shifts'] });
    } catch (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke slette vakt",
        variant: "destructive",
      });
    }
  };

  if (!isSuperAdmin) {
    console.log("SuperAdmin access denied", { user, userRole, isSuperAdmin });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Ingen tilgang</CardTitle>
            <CardDescription>
              Du har ikke tilgang til superadmin-panelet.
              <br />
              <span className="text-xs">Role: {userRole || 'ingen'}</span>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SuperAdmin Dashboard</h1>
            <p className="text-muted-foreground">Administrer alle företag och användare</p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totalt Företag</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats?.totalCompanies || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totalt Användare</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dagens Skift (Alla)</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats?.todaysShiftsCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Company Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Välj Företag</CardTitle>
            <CardDescription>Välj ett företag för att se och hantera dess data</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCompanyId || undefined} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj ett företag" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name} ({company.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Company-specific content */}
        {selectedCompanyId && selectedCompany && (
          <>
            <div className="bg-muted/50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">
                {selectedCompany.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Org.nr: {selectedCompany.org_number || 'Ej angivet'} • Slug: {selectedCompany.slug}
              </p>
            </div>

            {/* Live Status and Temperature Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LivePunchStatus />
              <TodaysTemperatureLogs />
            </div>

            {/* Daily Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dagens Skift</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todaysShifts?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    schemalagda idag
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Planerade Timmar</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {todaysShifts?.reduce((total, shift) => {
                      const start = new Date(shift.start_time);
                      const end = new Date(shift.end_time);
                      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      return total + hours;
                    }, 0).toFixed(1) || 0}h
                  </div>
                  <p className="text-xs text-muted-foreground">
                    totalt idag
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Anställda</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employees?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    registrerade användare
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Today's Shifts */}
            <Card>
              <CardHeader>
                <CardTitle>Dagens Skift</CardTitle>
                <CardDescription>
                  Översikt över alla planerade skift idag
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!todaysShifts || todaysShifts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Inga skift schemalagda idag</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todaysShifts.map((shift) => {
                      const shiftStatus = getShiftStatus(shift);
                      return (
                        <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {shift.profiles?.first_name} {shift.profiles?.last_name}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {shiftStatus.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeNorway(shift.start_time)} - {formatTimeNorway(shift.end_time)}
                              </span>
                              {shift.location && (
                                <span>{shift.location}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingShift(shift)}
                            >
                              Redigera
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeletingShiftId(shift.id)}
                            >
                              Ta bort
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* This Week's Shifts */}
            <Card>
              <CardHeader>
                <CardTitle>Veckans Skift</CardTitle>
                <CardDescription>
                  Alla skift denna vecka
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!weekShifts || weekShifts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Inga skift denna vecka</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weekShifts.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {shift.profiles?.first_name} {shift.profiles?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(shift.start_time), "EEE d MMM • HH:mm", { locale: nb })} - {formatTimeNorway(shift.end_time)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employees List */}
            <Card>
              <CardHeader>
                <CardTitle>Anställda</CardTitle>
                <CardDescription>
                  Alla användare för {selectedCompany.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!employees || employees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Inga anställda registrerade</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {employees.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                        </div>
                        <Badge variant="outline">
                          {employee.user_roles?.[0]?.role || 'employee'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Edit Shift Dialog */}
      {editingShift && (
        <EditShiftDialog
          shift={editingShift}
          open={!!editingShift}
          onOpenChange={(open) => !open && setEditingShift(null)}
          onSave={handleSaveShift}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingShiftId} onOpenChange={(open) => !open && setDeletingShiftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kommer att permanent ta bort skiftet. Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShift}>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdmin;
