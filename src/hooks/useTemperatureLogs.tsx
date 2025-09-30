import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemperatureLog {
  id: string;
  employee_id: string;
  equipment_name: string;
  temperature: number;
  timestamp: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreateTemperatureLog {
  equipment_name: string;
  temperature: number;
  notes?: string;
}

export const useTemperatureLogs = () => {
  const [temperatureLogs, setTemperatureLogs] = useState<TemperatureLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemperatureLogs = useCallback(async (startDate?: string, endDate?: string, equipmentName?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
        .from('temperature_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }
      
      if (equipmentName) {
        query = query.eq('equipment_name', equipmentName);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Get unique employee IDs to batch fetch profiles
      const uniqueEmployeeIds = [...new Set((data || []).map(log => log.employee_id))];
      
      // Batch fetch all profiles at once
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', uniqueEmployeeIds);
      
      // Create a map for quick lookup
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );
      
      // Attach profiles to logs using the map
      const logsWithProfiles = (data || []).map(log => {
        const profile = profileMap.get(log.employee_id);
        return {
          ...log,
          profiles: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || ''
          } : undefined
        };
      });
      
      setTemperatureLogs(logsWithProfiles);
    } catch (err) {
      console.error('Error fetching temperature logs:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTemperatureLog = async (logData: CreateTemperatureLog) => {
    try {
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Du måste vara inloggad');

      const { data, error } = await supabase
        .from('temperature_logs')
        .insert({
          employee_id: user.id,
          equipment_name: logData.equipment_name,
          temperature: logData.temperature,
          notes: logData.notes,
        })
        .select('*')
        .single();

      if (error) throw error;
      
      // Get employee name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();
      
      const logWithProfile = {
        ...data,
        profiles: profile ? {
          first_name: profile.first_name || '',
          last_name: profile.last_name || ''
        } : undefined
      };
      
      // Add to current list
      setTemperatureLogs(prev => [logWithProfile, ...prev]);
      return logWithProfile;
    } catch (err) {
      console.error('Error creating temperature log:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      throw err;
    }
  };

  const getTodaysLogs = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await fetchTemperatureLogs(
      today.toISOString(),
      tomorrow.toISOString()
    );
  }, [fetchTemperatureLogs]);

  useEffect(() => {
    getTodaysLogs();
  }, [getTodaysLogs]);

  return {
    temperatureLogs,
    isLoading,
    error,
    fetchTemperatureLogs,
    createTemperatureLog,
    getTodaysLogs,
  };
};