import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface Beställning {
  id: string;
  bedriftskunde_id: string;
  beskrivning: string;
  referanse?: string;
  telefon?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  bedriftskunder?: {
    firmanamn: string;
    orgnr: string;
  };
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreateBeställning {
  bedriftskunde_id: string;
  beskrivning: string;
  referanse?: string;
  telefon?: string;
}

export const useBeställningar = () => {
  const [beställningar, setBeställningar] = useState<Beställning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  const fetchBeställningar = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('beställningar')
        .select(`
          *,
          bedriftskunder (firmanamn, orgnr)
        `)
        .order('created_at', { ascending: false });

      // If not admin, only show own orders
      if (userRole !== 'admin' && user) {
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const uniqueUserIds = [...new Set(data.map(b => b.created_by))];
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', uniqueUserIds);
        
        const profileMap = new Map(
          (profiles || []).map(p => [p.user_id, p])
        );
        
        const beställningarWithProfiles = data.map(beställning => {
          const profile = profileMap.get(beställning.created_by);
          return {
            ...beställning,
            profiles: profile ? {
              first_name: profile.first_name || '',
              last_name: profile.last_name || ''
            } : undefined
          };
        });
        
        setBeställningar(beställningarWithProfiles);
      } else {
        setBeställningar([]);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte hämta beställningar"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user, userRole]);

  const createBeställning = async (data: CreateBeställning) => {
    try {
      if (!user) {
        throw new Error('Du måste vara inloggad');
      }

      const { error } = await supabase
        .from('beställningar')
        .insert([{
          ...data,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Beställning skapad"
      });

      fetchBeställningar();
      return { success: true };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte skapa beställning"
      });
      return { success: false };
    }
  };

  const deleteBeställning = async (id: string) => {
    try {
      const { error } = await supabase
        .from('beställningar')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Beställning borttagen"
      });

      fetchBeställningar();
      return { success: true };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fel",
        description: error.message || "Kunde inte ta bort beställning"
      });
      return { success: false };
    }
  };

  useEffect(() => {
    if (user) {
      fetchBeställningar();

      const channel = supabase
        .channel('beställningar-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'beställningar'
          },
          () => {
            fetchBeställningar();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchBeställningar, user]);

  return {
    beställningar,
    isLoading,
    createBeställning,
    deleteBeställning,
    refetch: fetchBeställningar
  };
};

// Separate function for fetching company-specific orders
export const fetchBeställningarByBedriftskunde = async (bedriftskundeId: string): Promise<Beställning[]> => {
  if (!bedriftskundeId) {
    console.error('Invalid bedriftskundeId provided');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('beställningar')
      .select(`
        *,
        bedriftskunder (firmanamn, orgnr)
      `)
      .eq('bedriftskunde_id', bedriftskundeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching beställningar:', error);
      throw error;
    }
    
    // Fetch profiles separately
    if (data && data.length > 0) {
      const uniqueUserIds = [...new Set(data.map(b => b.created_by))];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', uniqueUserIds);
      
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );
      
      const beställningarWithProfiles = data.map(beställning => {
        const profile = profileMap.get(beställning.created_by);
        return {
          ...beställning,
          profiles: profile ? {
            first_name: profile.first_name || '',
            last_name: profile.last_name || ''
          } : undefined
        };
      });
      
      return beställningarWithProfiles;
    }
    
    return [];
  } catch (error) {
    console.error('Unexpected error in fetchBeställningarByBedriftskunde:', error);
    return [];
  }
};
