import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Play, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function PunchClock() {
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastPunchTime, setLastPunchTime] = useState<Date | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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
      
      const { error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: user.id,
          entry_type: entryType,
        });

      if (error) throw error;

      setIsPunchedIn(!isPunchedIn);
      setLastPunchTime(new Date());
      
      toast({
        title: 'Success',
        description: `Successfully ${isPunchedIn ? 'punched out' : 'punched in'}!`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record time entry',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Clock className="h-5 w-5" />
          Time Clock
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-6">
        <div className="text-sm text-muted-foreground">
          Status: <span className={isPunchedIn ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {isPunchedIn ? 'Punched In' : 'Punched Out'}
          </span>
        </div>

        {lastPunchTime && (
          <div className="text-sm text-muted-foreground">
            Last punch: {lastPunchTime.toLocaleString()}
          </div>
        )}

        <Button
          onClick={handlePunch}
          disabled={loading}
          size="lg"
          className="w-full h-16 text-lg"
          variant={isPunchedIn ? 'destructive' : 'default'}
        >
          {loading ? (
            'Processing...'
          ) : isPunchedIn ? (
            <>
              <Square className="h-6 w-6 mr-2" />
              Punch Out
            </>
          ) : (
            <>
              <Play className="h-6 w-6 mr-2" />
              Punch In
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}