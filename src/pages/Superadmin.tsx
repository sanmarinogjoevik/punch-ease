import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Users, Calendar } from 'lucide-react';
import { CreateCompanyDialog } from '@/components/CreateCompanyDialog';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function Superadmin() {
  const { userRole } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Protect route
  if (userRole !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  // Fetch all companies
  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ['superadmin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch company statistics
  const { data: stats } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const [profilesResult, shiftsResult] = await Promise.all([
        supabase.from('profiles').select('company_id', { count: 'exact' }),
        supabase.from('shifts').select('company_id', { count: 'exact' })
      ]);

      return {
        totalEmployees: profilesResult.count || 0,
        totalShifts: shiftsResult.count || 0
      };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Superadmin Dashboard</h1>
          <p className="text-muted-foreground">Hantera alla företag i systemet</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nytt Företag
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt Företag</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies?.length || 0}</div>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt Skift</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalShifts || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Companies List */}
      <Card>
        <CardHeader>
          <CardTitle>Alla Företag</CardTitle>
          <CardDescription>
            Översikt över alla registrerade företag
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laddar företag...</div>
          ) : companies && companies.length > 0 ? (
            <div className="space-y-4">
              {companies.map((company) => (
                <Card key={company.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    <CardDescription>
                      {company.email && <div>Email: {company.email}</div>}
                      {company.phone && <div>Telefon: {company.phone}</div>}
                      {company.org_number && <div>Org.nr: {company.org_number}</div>}
                      {company.address && (
                        <div>
                          Adress: {company.address}
                          {company.postal_code && `, ${company.postal_code}`}
                          {company.city && ` ${company.city}`}
                        </div>
                      )}
                    </CardDescription>
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
        onSuccess={refetch}
      />
    </div>
  );
}