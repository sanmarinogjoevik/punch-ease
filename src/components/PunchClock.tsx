import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Play, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

export function PunchClock() {
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastPunchTime, setLastPunchTime] = useState<Date | null>(null);
  const [isAutomatic, setIsAutomatic] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (user) {
      checkPunchStatus();
    }
  }, [user]);

  const checkPunchStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastEntry = data[0];
        setIsPunchedIn(lastEntry.entry_type === 'punch_in');
        setLastPunchTime(new Date(lastEntry.timestamp));
        setIsAutomatic(lastEntry.is_automatic || false);
      }
    } catch (error) {
      console.error('Error checking punch status:', error);
    }
  };

  const handlePunch = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const entryType = isPunchedIn ? 'punch_out' : 'punch_in';
      const punchTimestamp = new Date().toISOString();
      
      const { error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: user.id,
          entry_type: entryType,
        });

      if (error) throw error;

      setIsPunchedIn(!isPunchedIn);
      setLastPunchTime(new Date());
      
      // If this is a punch-in, trigger automatic temperature logs
      if (entryType === 'punch_in') {
        console.log('Triggering automatic temperature logs after punch-in');
        try {
          const { error: functionError } = await supabase.functions.invoke('auto-temperature-logs', {
            body: { 
              employee_id: user.id,
              timestamp: punchTimestamp
            }
          });

          if (functionError) {
            console.error('Error creating automatic temperature logs:', functionError);
          } else {
            console.log('Automatic temperature logs created successfully');
          }
        } catch (logError) {
          console.error('Error invoking temperature log function:', logError);
        }
      }
      
      toast({
        title: 'Suksess',
        description: `Vellykket ${isPunchedIn ? 'logget ut' : 'logget inn'}!`,
      });
    } catch (error: any) {
      toast({
        title: 'Feil',
        description: error.message || 'Kunne inte registrere tidsregistrering',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
          <CardTitle className={`flex items-center justify-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
            <Clock className="h-5 w-5" />
            Tidsklokke
          </CardTitle>
      </CardHeader>
      <CardContent className={`text-center ${isMobile ? 'space-y-4' : 'space-y-6'}`}>
        <div className="text-sm text-muted-foreground">
          Status: <span className={isPunchedIn ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {isPunchedIn ? 'Pålogget' : 'Avlogget'}
          </span>
        </div>

        {lastPunchTime && (
          <div className="text-sm text-muted-foreground">
            Siste registrering: {lastPunchTime.toLocaleString('nb-NO')}
            {isAutomatic && isPunchedIn && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                Automatisk
              </span>
            )}
          </div>
        )}

        <Button
          onClick={handlePunch}
          disabled={loading}
          size={isMobile ? "default" : "lg"}
          className={`w-full ${isMobile ? 'h-12 text-base' : 'h-16 text-lg'}`}
          variant={isPunchedIn ? 'destructive' : 'default'}
        >
          {loading ? (
            'Behandler...'
          ) : isPunchedIn ? (
            <>
              <Square className={`${isMobile ? 'h-4 w-4' : 'h-6 w-6'} mr-2`} />
              Logg Ut
            </>
          ) : (
            <>
              <Play className={`${isMobile ? 'h-4 w-4' : 'h-6 w-6'} mr-2`} />
              Logg Inn
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}