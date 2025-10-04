import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Building2, Users, Calendar, Clock, BarChart3, LogOut } from 'lucide-react';
import { CreateCompanyDialog } from '@/components/CreateCompanyDialog';
import { SuperadminLivePunchStatus } from '@/components/SuperadminLivePunchStatus';
import { SuperadminTemperatureLogs } from '@/components/SuperadminTemperatureLogs';
import { useAuth } from '@/hooks/useAuth';
import { useCompanies } from '@/hooks/useCompanies';
import { useSuperadminStats } from '@/hooks/useSuperadminStats';
import { Navigate, useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay, addDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Superadmin() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Protect route
  if (userRole !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const { data: companies, refetch: refetchCompanies } = useCompanies();
  const { data: stats } = useSuperadminStats(selectedCompanyId);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Utloggad');
      navigate('/tenant-login');
    } catch (error) {
      toast.error('Kunde inte logga ut');
      console.error('Logout error:', error);
    }
  };

  // Fetch today's shifts
  const { data: todayShifts } = useQuery({
    queryKey: ['superadmin-today-shifts', selectedCompanyId],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      let query = supabase
        .from('shifts')
        .select(`
          *,
          profiles!inner(
            first_name,
            last_name,
            email,
            companies!inner(name)
          )
        `)
        .gte('start_time', startOfToday)
        .lte('start_time', endOfToday)
        .order('start_time');

      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch this week's shifts
  const { data: weekShifts } = useQuery({
    queryKey: ['superadmin-week-shifts', selectedCompanyId],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfWeek = endOfDay(addDays(today, 7)).toISOString();

      let query = supabase
        .from('shifts')
        .select(`
          *,
          profiles!inner(
            first_name,
            last_name,
            email,
            companies!inner(name)
          )
        `)
        .gte('start_time', startOfToday)
        .lte('start_time', endOfWeek)
        .order('start_time');

      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch all employees
  const { data: employees } = useQuery({
    queryKey: ['superadmin-employees', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          companies!inner(name),
          user_roles(role)
        `)
        .order('first_name');

      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Superadmin Dashboard</h1>
          <p className="text-muted-foreground">Hantera alla företag i systemet</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedCompanyId || 'all'}
            onValueChange={(value) => setSelectedCompanyId(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Välj företag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla företag</SelectItem>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nytt Företag
          </Button>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Logga ut
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planlagda Vakter Idag</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalShifts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planlagde Timer Idag</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalHours || 0}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt Anställda</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEmployees || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Live Punch Status */}
        <SuperadminLivePunchStatus companyId={selectedCompanyId} />

        {/* Temperature Logs */}
        <SuperadminTemperatureLogs companyId={selectedCompanyId} />

        {/* Today's Shifts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Dagens Vakter</CardTitle>
            </div>
            <CardDescription>Alla vakter schemalagda för idag</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {todayShifts && todayShifts.length > 0 ? (
                <div className="space-y-3">
                  {todayShifts.map((shift: any) => (
                    <div key={shift.id} className="border-b pb-3 last:border-0">
                      <div className="font-medium text-sm">
                        {shift.profiles.first_name} {shift.profiles.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(shift.start_time), 'HH:mm', { locale: sv })} - {format(new Date(shift.end_time), 'HH:mm', { locale: sv })}
                        {!selectedCompanyId && (
                          <span className="ml-2">({shift.profiles.companies.name})</span>
                        )}
                      </div>
                      {shift.location && (
                        <div className="text-xs text-muted-foreground mt-1">{shift.location}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Inga vakter idag
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* This Week's Shifts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Ukens Vakter</CardTitle>
            </div>
            <CardDescription>Kommande vakter nästa 7 dagar</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {weekShifts && weekShifts.length > 0 ? (
                <div className="space-y-3">
                  {weekShifts.map((shift: any) => (
                    <div key={shift.id} className="border-b pb-3 last:border-0">
                      <div className="font-medium text-sm">
                        {shift.profiles.first_name} {shift.profiles.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(shift.start_time), 'EEE d MMM, HH:mm', { locale: sv })}
                        {!selectedCompanyId && (
                          <span className="ml-2">({shift.profiles.companies.name})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Inga kommande vakter
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Employees */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Anställda</CardTitle>
            </div>
            <CardDescription>
              {selectedCompanyId ? 'Företagets anställda' : 'Alla anställda över alla företag'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {employees && employees.length > 0 ? (
                <div className="space-y-3">
                  {employees.map((employee: any) => (
                    <div key={employee.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div>
                        <div className="font-medium text-sm">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.email}
                          {!selectedCompanyId && (
                            <span className="ml-2">({employee.companies.name})</span>
                          )}
                        </div>
                      </div>
                      {employee.user_roles?.[0]?.role && (
                        <Badge variant="outline" className="text-xs">
                          {employee.user_roles[0].role}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Inga anställda registrerade
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Reports Link */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>Rapporter</CardTitle>
            </div>
            <CardDescription>Visa detaljerade rapporter och statistik</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                Se tidrapporter och statistik för {selectedCompanyId ? 'valt företag' : 'alla företag'}
              </p>
              <Button variant="outline" className="w-full">
                Visa Rapporter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Companies List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Alla Företag</CardTitle>
          </div>
          <CardDescription>
            Översikt över alla registrerade företag
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies && companies.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <Card key={company.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedCompanyId(company.id)}>
                  <CardHeader>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Inga företag registrerade ännu. Klicka på "Nytt Företag" för att komma igång.
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCompanyDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onSuccess={refetchCompanies}
      />
    </div>
  );
}
