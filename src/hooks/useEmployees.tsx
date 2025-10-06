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

// Hook to fetch all employees (excluding admins and superadmins)
export const useEmployees = () => {
  return useQuery({
    queryKey: [...employeesKeys.all, 'no-admins'],
    queryFn: async (): Promise<Employee[]> => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name', { ascending: true });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError.message);
        throw profilesError;
      }

      if (!profiles || profiles.length === 0) {
        return [];
      }

      // Fetch all user roles for these profiles
      const userIds = profiles.map(p => p.user_id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError.message);
        throw rolesError;
      }

      // Filter out admins and superadmins on client side
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      const employees = profiles.filter(profile => {
        const role = roleMap.get(profile.user_id);
        return role && role !== 'admin' && role !== 'superadmin';
      });

      console.log('Employees fetched:', employees.length);

      return employees;
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