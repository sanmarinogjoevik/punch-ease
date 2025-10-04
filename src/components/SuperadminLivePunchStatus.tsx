import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { startOfToday } from 'date-fns';

interface PunchedInEmployee {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company_name: string;
}

interface SuperadminLivePunchStatusProps {
  companyId: string | null;
}

export function SuperadminLivePunchStatus({ companyId }: SuperadminLivePunchStatusProps) {
  const [punchedInEmployees, setPunchedInEmployees] = useState<PunchedInEmployee[]>([]);

  const { data, refetch } = useQuery({
    queryKey: ['superadmin-punched-in', companyId],
    queryFn: async () => {
      const todayStart = startOfToday().toISOString();

      let query = supabase
        .from('time_entries')
        .select(`
          employee_id,
          entry_type,
          timestamp,
          profiles!inner(
            first_name,
            last_name,
            email,
            companies!inner(name)
          )
        `)
        .gte('timestamp', todayStart)
        .order('timestamp', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: entries, error } = await query;

      if (error) throw error;

      // Group by employee and find latest entry
      const employeeMap = new Map();
      entries?.forEach((entry: any) => {
        const empId = entry.employee_id;
        if (!employeeMap.has(empId) || 
            new Date(entry.timestamp) > new Date(employeeMap.get(empId).timestamp)) {
          employeeMap.set(empId, entry);
        }
      });

      // Filter only currently punched in
      const punchedIn = Array.from(employeeMap.values())
        .filter((entry: any) => entry.entry_type === 'in')
        .map((entry: any) => ({
          employee_id: entry.employee_id,
          first_name: entry.profiles.first_name,
          last_name: entry.profiles.last_name,
          email: entry.profiles.email,
          company_name: entry.profiles.companies.name
        }));

      return punchedIn;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  useEffect(() => {
    const channel = supabase
      .channel('superadmin-time-entries-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'time_entries'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    if (data) {
      setPunchedInEmployees(data);
    }
  }, [data]);

  const getDisplayName = (emp: PunchedInEmployee) => {
    if (emp.first_name && emp.last_name) {
      return `${emp.first_name} ${emp.last_name}`;
    }
    if (emp.first_name) return emp.first_name;
    return emp.email;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Live Punch Status</CardTitle>
          </div>
          <Badge variant="secondary" className="text-lg font-semibold">
            {punchedInEmployees.length}
          </Badge>
        </div>
        <CardDescription>
          {companyId ? 'Anställda som är instämplade nu' : 'Alla instämplade över alla företag'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {punchedInEmployees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {punchedInEmployees.map((emp) => (
              <Badge key={emp.employee_id} variant="outline" className="px-3 py-1">
                {getDisplayName(emp)}
                {!companyId && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({emp.company_name})
                  </span>
                )}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Inga anställda är för närvarande instämplade
          </p>
        )}
      </CardContent>
    </Card>
  );
}
