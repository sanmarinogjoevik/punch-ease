import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Phone, Mail, IdCard, UserCheck, UserX, Edit, Trash2 } from "lucide-react";
import { useState } from "react";

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
  const queryClient = useQueryClient();
  
  // Edit Employee Dialog State
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    personal_number: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
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

  const handleEditEmployee = (employee: Profile) => {
    setEditingEmployee(employee);
    setEditForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      email: employee.email,
      phone: employee.phone || '',
      personal_number: employee.personal_number || ''
    });
    setShowEditDialog(true);
  };

  const handlePersonalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    
    if (value.length > 6) {
      value = value.slice(0, 6) + '-' + value.slice(6, 11); // Allow 5 digits after dash
    }
    
    setEditForm(prev => ({ ...prev, personal_number: value }));
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          phone: editForm.phone,
          personal_number: editForm.personal_number
        })
        .eq('user_id', editingEmployee.user_id);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Anställd har uppdaterats framgångsrikt",
      });

      setShowEditDialog(false);
      setEditingEmployee(null);
      queryClient.invalidateQueries({ queryKey: ['employees'] });

    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte uppdatera anställd",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: Profile) => {
    try {
      // Call Edge Function to delete the employee
      const { error } = await supabase.functions.invoke('delete-employee', {
        body: { userId: employee.user_id }
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete employee');
      }

      toast({
        title: "Framgång",
        description: "Anställd har tagits bort framgångsrikt",
      });

      queryClient.invalidateQueries({ queryKey: ['employees'] });

    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte ta bort anställd",
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
        <h1 className="text-3xl font-bold">Ansatte</h1>
        <p className="text-muted-foreground">Administrer alle ansatte og deres informasjon</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Users className="w-4 h-4 mr-1" />
          {employees?.length || 0} Ansatte
        </Badge>
      </div>

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle>Alle ansatte</CardTitle>
          <CardDescription>Oversikt over alle ansatte og deres informasjon</CardDescription>
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
                          {isAdmin ? 'Admin' : 'Ansatt'}
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
                        Medlem siden: {new Date(employee.created_at).toLocaleDateString('nb-NO')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditEmployee(employee)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Rediger
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Slett
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Du er i ferd med å slette {employee.first_name} {employee.last_name}. 
                            Dette kan ikke angres og vil fjerne all data for denne ansatte.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteEmployee(employee)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Slett
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {!isAdmin && userRole === 'admin' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => makeAdmin(employee.user_id)}
                      >
                        <UserCheck className="w-4 h-4 mr-2" />
                        Gjør til admin
                      </Button>
                    )}
                    
                    {isAdmin && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <UserCheck className="w-4 h-4 mr-1" />
                        Administratør
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

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Redigera anställd</DialogTitle>
            <DialogDescription>
              Uppdatera informationen för {editingEmployee?.first_name} {editingEmployee?.last_name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_first_name">Förnamn</Label>
                  <Input
                    id="edit_first_name"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_last_name">Efternamn</Label>
                  <Input
                    id="edit_last_name"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email">E-post</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone">Telefon</Label>
                <Input
                  id="edit_phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_personal_number">Personnummer</Label>
                <Input
                  id="edit_personal_number"
                  placeholder="XXXXXX-XXXXX"
                  value={editForm.personal_number}
                  onChange={handlePersonalNumberChange}
                  pattern="[0-9]{6}-[0-9]{5}"
                  maxLength={12}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Uppdaterar...' : 'Uppdatera anställd'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;