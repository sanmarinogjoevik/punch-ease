import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AdminPunchDialog } from './AdminPunchDialog';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useQuery as useCompanySettingsQuery } from '@tanstack/react-query';

interface PunchedInEmployee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  punchInTime?: string;
}

export const LivePunchStatus = () => {
  const { isAdmin } = useAuth();
  const [punchedInEmployees, setPunchedInEmployees] = useState<PunchedInEmployee[]>([]);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const { data: currentUserProfile } = useCurrentUserProfile();

  // Hämta företagets stängningstid
  const { data: companySettings } = useCompanySettingsQuery({
    queryKey: ['company-settings', currentUserProfile?.company_id],
    queryFn: async () => {
      if (!currentUserProfile?.company_id) return null;
      
      const { data, error } = await supabase
        .from('company_settings')
        .select('business_hours')
        .eq('company_id', currentUserProfile.company_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentUserProfile?.company_id,
  });

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
      const todayPunchedInEmployeesMap = new Map<string, string>();
      employeeLatestEntries.forEach((entry, employeeId) => {
        if (entry.entry_type === 'punch_in') {
          const entryDate = new Date(entry.timestamp);
          if (entryDate >= todayStart) {
            todayPunchedInEmployeesMap.set(employeeId, entry.timestamp);
          }
        }
      });

      const todayPunchedInEmployees = Array.from(todayPunchedInEmployeesMap.keys());

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

      // Map profiles to PunchedInEmployee format with punch-in time
      const punchedInEmployees: PunchedInEmployee[] = profiles?.map(profile => ({
        id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        punchInTime: todayPunchedInEmployeesMap.get(profile.user_id)
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

  // Kontrollera om någon anställd är "stuck" (mer än 2 timmar efter stängning)
  const getStuckEmployees = () => {
    if (!companySettings?.business_hours || !Array.isArray(companySettings.business_hours) || !punchedInEmployees.length) return [];

    const now = new Date();
    const currentDay = now.getDay();
    const businessHours = companySettings.business_hours.find(
      (bh: any) => bh.day === currentDay
    ) as any;

    if (!businessHours || !businessHours.isOpen) return [];

    const [closeHour, closeMinute] = businessHours.closeTime.split(':').map(Number);
    const closingTime = new Date();
    closingTime.setHours(closeHour, closeMinute, 0, 0);

    // Lägg till 2 timmar till stängningstiden
    const twoHoursAfterClosing = new Date(closingTime.getTime() + 2 * 60 * 60 * 1000);

    // Om det är mer än 2 timmar efter stängning
    if (now > twoHoursAfterClosing) {
      return punchedInEmployees.filter(emp => {
        if (!emp.punchInTime) return false;
        const punchInTime = new Date(emp.punchInTime);
        // Om de punchade in innan stängning
        return punchInTime < closingTime;
      });
    }

    return [];
  };

  const stuckEmployees = getStuckEmployees();

  return (
    <>
      <Card className={`border-primary/20 ${stuckEmployees.length > 0 ? 'border-red-500 border-2' : ''} bg-gradient-to-r from-primary/5 to-accent/5`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary relative">
            <div className="flex items-center gap-2">
              {stuckEmployees.length > 0 ? (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              ) : (
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              )}
              <Clock className="w-5 h-5" />
              Live Status
              {stuckEmployees.length > 0 && (
                <Badge variant="destructive" className="ml-2 animate-pulse">
                  {stuckEmployees.length} stuck
                </Badge>
              )}
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
        {/* VARNING för stuck employees */}
        {stuckEmployees.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg dark:bg-red-950 dark:border-red-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="font-semibold text-red-800 dark:text-red-200">
                Varning: Anställda fastnade inpunchade!
              </span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mb-2">
              {stuckEmployees.length} anställd{stuckEmployees.length > 1 ? 'a' : ''} har varit inpunchad{stuckEmployees.length > 1 ? 'e' : ''} mer än 2 timmar efter stängningstid.
            </p>
            <div className="flex flex-wrap gap-2">
              {stuckEmployees.map((employee) => (
                <Badge 
                  key={employee.id} 
                  variant="destructive"
                  className="animate-pulse"
                >
                  {getDisplayName(employee)}
                </Badge>
              ))}
            </div>
          </div>
        )}

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
            {punchedInEmployees.map((employee) => {
              const isStuck = stuckEmployees.some(s => s.id === employee.id);
              return (
                <Badge 
                  key={employee.id} 
                  variant={isStuck ? "destructive" : "secondary"}
                  className={isStuck 
                    ? "animate-pulse" 
                    : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100"
                  }
                >
                  {getDisplayName(employee)}
                </Badge>
              );
            })}
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