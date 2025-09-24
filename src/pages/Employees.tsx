import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, Phone, Mail, IdCard, UserCheck, UserX } from "lucide-react";

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

const Employees = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();

  // Fetch all profiles/employees
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
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
              Du har inte behörighet att komma åt anställdasidan.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-foreground">Laddar anställda...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Anställda</h1>
          <p className="text-muted-foreground">Hantera alla anställda och deras information</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Users className="w-4 h-4 mr-1" />
          {employees?.length || 0} Anställda
        </Badge>
      </div>

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle>Alla anställda</CardTitle>
          <CardDescription>Översikt över alla anställda och deras information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees?.map((employee) => {
              const userRole = employee.user_roles?.[0]?.role;
              const isAdmin = userRole === 'admin';
              
              return (
                <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-lg">
                          {employee.first_name} {employee.last_name}
                        </h3>
                        <Badge variant={isAdmin ? 'default' : 'secondary'}>
                          {isAdmin ? 'Admin' : 'Anställd'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>{employee.email}</span>
                        </div>
                        
                        {employee.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            <span>{employee.phone}</span>
                          </div>
                        )}
                        
                        {employee.personal_number && (
                          <div className="flex items-center gap-1">
                            <IdCard className="w-4 h-4" />
                            <span>{employee.personal_number}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Medlem sedan: {new Date(employee.created_at).toLocaleDateString('sv-SE')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isAdmin && userRole === 'admin' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => makeAdmin(employee.user_id)}
                      >
                        <UserCheck className="w-4 h-4 mr-2" />
                        Gör till admin
                      </Button>
                    )}
                    
                    {isAdmin && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <UserCheck className="w-4 h-4 mr-1" />
                        Administratör
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(!employees || employees.length === 0) && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Inga anställda hittades</h3>
          <p className="text-muted-foreground">
            Lägg till anställda från admin-panelen för att se dem här.
          </p>
        </div>
      )}
    </div>
  );
};

export default Employees;