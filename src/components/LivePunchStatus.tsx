import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AdminPunchDialog } from './AdminPunchDialog';

interface PunchedInEmployee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export const LivePunchStatus = () => {
  const { isAdmin } = useAuth();
  const [punchedInEmployees, setPunchedInEmployees] = useState<PunchedInEmployee[]>([]);
  const [showAdminDialog, setShowAdminDialog] = useState(false);

  // Query to get currently punched in employees
  const { data: employees, refetch } = useQuery({
    queryKey: ['punched-in-employees'],
    queryFn: async (): Promise<PunchedInEmployee[]> => {
      // First get all time entries
      const { data: timeEntries, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('employee_id, entry_type, timestamp')
        .order('timestamp', { ascending: false });

      if (timeEntriesError) {
        console.error('Error fetching time entries:', timeEntriesError);
        throw timeEntriesError;
      }

      if (!timeEntries || timeEntries.length === 0) {
        return [];
      }

      // Group by employee and find latest entry for each
      const employeeLatestEntries = new Map();
      
      timeEntries.forEach(entry => {
        if (!employeeLatestEntries.has(entry.employee_id)) {
          employeeLatestEntries.set(entry.employee_id, entry);
        }
      });

      // Find employees who are currently punched in
      const punchedInEmployeeIds: string[] = [];
      employeeLatestEntries.forEach(entry => {
        if (entry.entry_type === 'punch_in') {
          punchedInEmployeeIds.push(entry.employee_id);
        }
      });

      if (punchedInEmployeeIds.length === 0) {
        return [];
      }

      // Get today's date range to filter old punch-ins
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Filter to only include employees punched in TODAY (safety check)
      const todayPunchedInEmployees: string[] = [];
      employeeLatestEntries.forEach((entry, employeeId) => {
        if (entry.entry_type === 'punch_in') {
          const entryDate = new Date(entry.timestamp);
          if (entryDate >= todayStart) {
            todayPunchedInEmployees.push(employeeId);
          }
        }
      });

      if (todayPunchedInEmployees.length === 0) {
        return [];
      }

      // Get profile information for all punched in employees (regardless of shifts)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', todayPunchedInEmployees);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Map profiles to PunchedInEmployee format
      const punchedInEmployees: PunchedInEmployee[] = profiles?.map(profile => ({
        id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email
      })) || [];

      return punchedInEmployees;
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
    <>
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary relative">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <Clock className="w-5 h-5" />
              Live Status
            </div>
            
            {/* Gömd admin-knapp */}
            {isAdmin && (
              <button
                onClick={() => setShowAdminDialog(true)}
                className="absolute top-0 right-0 w-16 h-16 opacity-0 cursor-default"
                aria-label="Admin punch control"
              />
            )}
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

    <AdminPunchDialog 
      open={showAdminDialog} 
      onOpenChange={setShowAdminDialog} 
    />
    </>
  );
};