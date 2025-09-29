import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';

interface PunchedInEmployee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export const LivePunchStatus = () => {
  const [punchedInEmployees, setPunchedInEmployees] = useState<PunchedInEmployee[]>([]);

  // Query to get currently punched in employees
  const { data: employees, refetch } = useQuery({
    queryKey: ['punched-in-employees'],
    queryFn: async (): Promise<PunchedInEmployee[]> => {
      // Get the latest time entry for each employee
      const { data: latestEntries, error } = await supabase
        .from('time_entries')
        .select(`
          employee_id,
          entry_type,
          timestamp,
          profiles!inner(id, user_id, first_name, last_name, email)
        `)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching time entries:', error);
        throw error;
      }

      // Group by employee and find latest entry for each
      const employeeLatestEntries = new Map();
      
      latestEntries?.forEach(entry => {
        if (!employeeLatestEntries.has(entry.employee_id)) {
          employeeLatestEntries.set(entry.employee_id, entry);
        }
      });

      // Filter employees who are currently punched in (latest entry is punch_in)
      const punchedIn: PunchedInEmployee[] = [];
      employeeLatestEntries.forEach(entry => {
        if (entry.entry_type === 'punch_in') {
          punchedIn.push({
            id: entry.profiles.user_id,
            first_name: entry.profiles.first_name,
            last_name: entry.profiles.last_name,
            email: entry.profiles.email
          });
        }
      });

      return punchedIn;
    },
    refetchInterval: 30000, // Refetch every 30 seconds as backup
  });

  // Real-time subscription for time entries
  useEffect(() => {
    const channel = supabase
      .channel('time-entries-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'time_entries'
        },
        () => {
          // Refetch data when new time entry is added
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Update local state when query data changes
  useEffect(() => {
    if (employees) {
      setPunchedInEmployees(employees);
    }
  }, [employees]);

  const getDisplayName = (employee: PunchedInEmployee) => {
    if (employee.first_name && employee.last_name) {
      return `${employee.first_name} ${employee.last_name}`;
    }
    if (employee.first_name) {
      return employee.first_name;
    }
    return employee.email;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-primary">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <Clock className="w-5 h-5" />
            Live Status
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-2xl font-bold text-primary">
              {punchedInEmployees.length}
            </span>
            <span className="text-muted-foreground">
              {punchedInEmployees.length === 1 ? 'anställd inne' : 'anställda inne'}
            </span>
          </div>
        </div>
        
        {punchedInEmployees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {punchedInEmployees.map((employee) => (
              <Badge 
                key={employee.id} 
                variant="secondary" 
                className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100"
              >
                {getDisplayName(employee)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Inga anställda är inne just nu
          </p>
        )}
      </CardContent>
    </Card>
  );
};