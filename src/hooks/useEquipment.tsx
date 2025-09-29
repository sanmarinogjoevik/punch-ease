import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Equipment {
  id: string;
  name: string;
  type: 'refrigerator' | 'freezer';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipment {
  name: string;
  type: 'refrigerator' | 'freezer';
  description?: string;
}

export function useEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchEquipment = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_active', true)
        .order('type')
        .order('name');

      if (error) throw error;
      
      setEquipment(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod vid hämtning av utrustning';
      setError(errorMessage);
      console.error('Error fetching equipment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createEquipment = async (equipmentData: CreateEquipment) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .insert([equipmentData])
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      setEquipment(prev => [...prev, data].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.name.localeCompare(b.name);
      }));

      toast({
        title: 'Skapad!',
        description: 'Utrustning har lagts till',
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod vid skapande av utrustning';
      toast({
        title: 'Fel',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateEquipment = async (id: string, updates: Partial<CreateEquipment>) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setEquipment(prev => 
        prev.map(item => item.id === id ? data : item)
      );

      toast({
        title: 'Uppdaterad!',
        description: 'Utrustning har uppdaterats',
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod vid uppdatering av utrustning';
      toast({
        title: 'Fel',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const deactivateEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Remove from local state
      setEquipment(prev => prev.filter(item => item.id !== id));

      toast({
        title: 'Inaktiverad!',
        description: 'Utrustning har inaktiverats',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod vid inaktivering av utrustning';
      toast({
        title: 'Fel',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const getActiveEquipment = () => {
    return equipment.filter(item => item.is_active);
  };

  const getEquipmentByType = (type: 'refrigerator' | 'freezer') => {
    return equipment.filter(item => item.type === type && item.is_active);
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  return {
    equipment,
    isLoading,
    error,
    fetchEquipment,
    createEquipment,
    updateEquipment,
    deactivateEquipment,
    getActiveEquipment,
    getEquipmentByType,
  };
}