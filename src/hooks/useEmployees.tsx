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
  created_at: string;
  updated_at: string;
}

// Query keys
export const employeesKeys = {
  all: ['employees'] as const,
  byId: (id: string) => [...employeesKeys.all, id] as const,
};

// Hook to fetch all employees
export const useEmployees = () => {
  return useQuery({
    queryKey: employeesKeys.all,
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching employees:', error.message);
        throw error;
      }

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