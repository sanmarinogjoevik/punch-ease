import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Thermometer } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { startOfToday, endOfToday } from 'date-fns';

interface SuperadminTemperatureLogsProps {
  companyId: string | null;
}

export function SuperadminTemperatureLogs({ companyId }: SuperadminTemperatureLogsProps) {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['superadmin-temperature-logs', companyId],
    queryFn: async () => {
      const today = new Date();
      const startOfDayDate = startOfToday();
      const endOfDayDate = endOfToday();

      let query = supabase
        .from('temperature_logs')
        .select(`
          *,
          profiles!inner(
            first_name,
            last_name,
            email,
            companies!inner(name)
          )
        `)
        .gte('timestamp', startOfDayDate.toISOString())
        .lte('timestamp', endOfDayDate.toISOString())
        .order('timestamp', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const getTemperatureColor = (temperature: number) => {
    if (temperature < 2) return 'bg-blue-500';
    if (temperature <= 4) return 'bg-green-500';
    if (temperature <= 8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-primary" />
          <CardTitle>Temperaturloggar Idag</CardTitle>
        </div>
        <CardDescription>
          {companyId ? 'Dagens temperaturloggar' : 'Alla temperaturloggar över alla företag'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Laddar loggar...</div>
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">Ett fel uppstod vid laddning av loggar</div>
        ) : logs && logs.length > 0 ? (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{log.equipment_name}</span>
                      <Badge className={`${getTemperatureColor(log.temperature)} text-white`}>
                        {log.temperature}°C
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'HH:mm', { locale: sv })}
                      {log.profiles && (
                        <span className="ml-2">
                          av {log.profiles.first_name || log.profiles.email}
                        </span>
                      )}
                      {!companyId && log.profiles?.companies && (
                        <span className="ml-2">
                          ({log.profiles.companies.name})
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Inga temperaturloggar registrerade idag
          </div>
        )}
      </CardContent>
    </Card>
  );
}
