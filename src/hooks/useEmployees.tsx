import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Employee {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone?: string | null;
  personal_number?: string | null;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

// Query keys
export const employeesKeys = {
  all: ['employees'] as const,
  byId: (id: string) => [...employeesKeys.all, id] as const,
};

// Hook to fetch all employees (excluding admins and superadmins) with JOIN
export const useEmployees = () => {
  return useQuery({
    queryKey: [...employeesKeys.all, 'no-admins'],
    queryFn: async (): Promise<Employee[]> => {
      // Fetch profiles with user_roles using JOIN and filter in SQL
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey!inner (
            role
          )
        `)
        .not('user_roles.role', 'in', '(admin,superadmin)')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching employees:', error.message);
        throw error;
      }

      console.log('Employees fetched (server-side filtered):', data?.length);

      return data || [];
    },
  });
};

// Hook to fetch a single employee by ID
export const useEmployee = (employeeId: string) => {
  return useQuery({
    queryKey: employeesKeys.byId(employeeId),
    queryFn: async (): Promise<Employee | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', employeeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error fetching employee:', error.message);
        throw error;
      }

      return data;
    },
    enabled: !!employeeId,
  });
};