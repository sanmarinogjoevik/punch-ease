import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AdminPunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Employee {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface TimeEntry {
  employee_id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
}

export const AdminPunchDialog = ({ open, onOpenChange }: AdminPunchDialogProps) => {
  const queryClient = useQueryClient();
  const [processingEmployeeId, setProcessingEmployeeId] = useState<string | null>(null);

  // Hämta alla anställda
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['all-employees-for-punch'],
    queryFn: async (): Promise<Employee[]> => {
      // Hämta admin user_ids
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      const adminUserIds = adminRoles?.map(r => r.user_id) || [];

      // Hämta alla profiler utom admins
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .not('user_id', 'in', `(${adminUserIds.join(',')})`);

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Hämta alla time entries för att avgöra vem som är inne/ute
  const { data: punchedInEmployees = new Set<string>() } = useQuery({
    queryKey: ['punched-in-status'],
    queryFn: async (): Promise<Set<string>> => {
      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select('employee_id, entry_type, timestamp')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Gruppera per anställd och hitta senaste entry
      const employeeLatestEntries = new Map<string, TimeEntry>();
      
      timeEntries?.forEach(entry => {
        if (!employeeLatestEntries.has(entry.employee_id)) {
          employeeLatestEntries.set(entry.employee_id, entry as TimeEntry);
        }
      });

      // Hitta de som är inne idag
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const punchedIn = new Set<string>();
      employeeLatestEntries.forEach((entry, employeeId) => {
        if (entry.entry_type === 'punch_in') {
          const entryDate = new Date(entry.timestamp);
          if (entryDate >= todayStart) {
            punchedIn.add(employeeId);
          }
        }
      });

      return punchedIn;
    },
    enabled: open,
  });

  // Mutation för att stämpla in/ut
  const punchMutation = useMutation({
    mutationFn: async ({ employeeId, entryType }: { employeeId: string; entryType: 'punch_in' | 'punch_out' }) => {
      // Get company_id from employee profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', employeeId)
        .single();

      if (!profile?.company_id) throw new Error('Company ID not found');

      const { error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: employeeId,
          company_id: profile.company_id,
          entry_type: entryType,
          timestamp: new Date().toISOString(),
          is_automatic: false, // Manuell admin-stämpling
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['punched-in-employees'] });
      queryClient.invalidateQueries({ queryKey: ['punched-in-status'] });
      
      const employee = employees.find(e => e.user_id === variables.employeeId);
      const name = employee?.first_name && employee?.last_name 
        ? `${employee.first_name} ${employee.last_name}`
        : employee?.email || 'Anställd';

      toast({
        title: variables.entryType === 'punch_in' ? 'Stämplat in' : 'Stämplat ut',
        description: `${name} har ${variables.entryType === 'punch_in' ? 'stämplats in' : 'stämplats ut'}`,
      });
      
      setProcessingEmployeeId(null);
    },
    onError: (error) => {
      console.error('Punch error:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte stämpla. Försök igen.',
        variant: 'destructive',
      });
      setProcessingEmployeeId(null);
    },
  });

  const handlePunch = (employeeId: string, entryType: 'punch_in' | 'punch_out') => {
    setProcessingEmployeeId(employeeId);
    punchMutation.mutate({ employeeId, entryType });
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    return '?';
  };

  const getDisplayName = (employee: Employee) => {
    if (employee.first_name && employee.last_name) {
      return `${employee.first_name} ${employee.last_name}`;
    }
    if (employee.first_name) return employee.first_name;
    return employee.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Admin: Stämpla in/ut anställda</DialogTitle>
          <DialogDescription>
            Välj en anställd och stämpla in eller ut manuellt
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loadingEmployees ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {employees.map((employee) => {
                const isPunchedIn = punchedInEmployees.has(employee.user_id);
                const isProcessing = processingEmployeeId === employee.user_id;

                return (
                  <div
                    key={employee.user_id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={employee.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(employee.first_name, employee.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getDisplayName(employee)}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={isPunchedIn ? "default" : "secondary"}
                        className={isPunchedIn ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                      >
                        {isPunchedIn ? 'Inne' : 'Ute'}
                      </Badge>

                      {isPunchedIn ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePunch(employee.user_id, 'punch_out')}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="w-4 h-4 mr-1" />
                              Stämpla ut
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handlePunch(employee.user_id, 'punch_in')}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <LogIn className="w-4 h-4 mr-1" />
                              Stämpla in
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
