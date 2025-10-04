import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface ShiftWithEmployee {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  auto_punch_in: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface CreateShiftData {
  employee_id: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  auto_punch_in?: boolean;
  company_id: string;
}

export interface UpdateShiftData extends Partial<CreateShiftData> {
  id: string;
}

// Query keys
export const shiftsKeys = {
  all: ['shifts'] as const,
  byEmployee: (employeeId: string) => [...shiftsKeys.all, 'employee', employeeId] as const,
  byMonth: (month: string, employeeId?: string) => [...shiftsKeys.all, 'month', month, employeeId] as const,
  byDateRange: (startDate: string, endDate: string, employeeId?: string) => 
    [...shiftsKeys.all, 'range', startDate, endDate, employeeId] as const,
};

// Hook to fetch all shifts with optional filters
export const useShifts = (options?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
}) => {
  const { employeeId, startDate, endDate, month } = options || {};
  
  let queryKey;
  if (month && employeeId) {
    queryKey = shiftsKeys.byMonth(month, employeeId);
  } else if (month) {
    queryKey = shiftsKeys.byMonth(month);
  } else if (startDate && endDate) {
    queryKey = shiftsKeys.byDateRange(startDate, endDate, employeeId);
  } else if (employeeId) {
    queryKey = shiftsKeys.byEmployee(employeeId);
  } else {
    queryKey = shiftsKeys.all;
  }

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ShiftWithEmployee[]> => {
      // First get shifts
      let shiftsQuery = supabase
        .from('shifts')
        .select('*')
        .order('start_time', { ascending: true });

      if (employeeId) {
        shiftsQuery = shiftsQuery.eq('employee_id', employeeId);
      }

      if (month) {
        const monthStart = startOfMonth(new Date(month));
        const monthEnd = endOfMonth(new Date(month));
        shiftsQuery = shiftsQuery
          .gte('start_time', monthStart.toISOString())
          .lte('start_time', monthEnd.toISOString());
      } else if (startDate && endDate) {
        shiftsQuery = shiftsQuery
          .gte('start_time', startDate)
          .lte('start_time', endDate);
      }

      const { data: shifts, error: shiftsError } = await shiftsQuery;

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError.message);
        throw shiftsError;
      }

      if (!shifts || shifts.length === 0) {
        return [];
      }

      // Then get profiles for the employees
      const employeeIds = [...new Set(shifts.map(s => s.employee_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', employeeIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError.message);
        throw profilesError;
      }

      // Combine the data
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return shifts.map(shift => ({
        ...shift,
        profiles: profilesMap.get(shift.employee_id) || {
          first_name: 'Unknown',
          last_name: 'Employee',
          email: ''
        }
      }));
    },
  });
};

// Hook to fetch employee shifts for a specific month (used by Reports)
export const useEmployeeMonthShifts = (employeeId: string, month: string) => {
  return useShifts({ employeeId, month });
};

// Hook for shift mutations
export const useShiftMutations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createShift = useMutation({
    mutationFn: async (shiftData: CreateShiftData) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert([shiftData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all });
      toast({
        title: "Skift skapat",
        description: "Skiftet har skapats framgångsrikt.",
      });
    },
    onError: (error: any) => {
      console.error('Error creating shift:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa skiftet. Försök igen.",
        variant: "destructive",
      });
    },
  });

  const updateShift = useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateShiftData) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all });
      toast({
        title: "Skift uppdaterat",
        description: "Skiftet har uppdaterats framgångsrikt.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating shift:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera skiftet. Försök igen.",
        variant: "destructive",
      });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;
      return shiftId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all });
      toast({
        title: "Skift borttaget",
        description: "Skiftet har tagits bort framgångsrikt.",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting shift:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort skiftet. Försök igen.",
        variant: "destructive",
      });
    },
  });

  const createMultipleShifts = useMutation({
    mutationFn: async (shifts: CreateShiftData[]) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert(shifts)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shiftsKeys.all });
      toast({
        title: "Skift skapade",
        description: `${data?.length || 0} skift har skapats framgångsrikt.`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating multiple shifts:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa skiften. Försök igen.",
        variant: "destructive",
      });
    },
  });

  return {
    createShift,
    updateShift,
    deleteShift,
    createMultipleShifts,
  };
};

// Hook for real-time shifts subscription
export const useShiftsSubscription = () => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const channel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
        },
        () => {
          // Invalidate all shifts queries when data changes
          queryClient.invalidateQueries({ queryKey: shiftsKeys.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};