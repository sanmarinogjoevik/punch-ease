import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export const useSuperadminStats = (companyId: string | null) => {
  return useQuery({
    queryKey: ['superadmin-stats', companyId],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      // Build query for shifts today
      let shiftsQuery = supabase
        .from('shifts')
        .select('id, start_time, end_time', { count: 'exact' })
        .gte('start_time', startOfToday)
        .lte('start_time', endOfToday);

      if (companyId) {
        shiftsQuery = shiftsQuery.eq('company_id', companyId);
      }

      // Build query for employees
      let employeesQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact' });

      if (companyId) {
        employeesQuery = employeesQuery.eq('company_id', companyId);
      }

      const [shiftsResult, employeesResult] = await Promise.all([
        shiftsQuery,
        employeesQuery
      ]);

      if (shiftsResult.error) throw shiftsResult.error;
      if (employeesResult.error) throw employeesResult.error;

      // Calculate total hours from shifts
      const shifts = shiftsResult.data || [];
      const totalHours = shifts.reduce((sum, shift) => {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

      return {
        totalShifts: shiftsResult.count || 0,
        totalHours: Math.round(totalHours * 10) / 10,
        totalEmployees: employeesResult.count || 0
      };
    }
  });
};
