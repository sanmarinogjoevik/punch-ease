import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Clock, Calendar } from 'lucide-react';

interface TimeEntry {
  id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  employee_id: string;
}

interface WorkDay {
  date: string;
  totalHours: number;
  totalMinutes: number;
  sessions: number;
  firstPunch: string;
  lastPunch: string;
}

export default function Timeliste() {
  const { user } = useAuth();
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWorkDays();
    }
  }, [user]);

  const fetchWorkDays = async () => {
    try {
      setLoading(true);

      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user!.id)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching time entries:', error);
        return;
      }

      const groupedByDay = groupEntriesByDay(timeEntries || []);
      setWorkDays(groupedByDay);

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupEntriesByDay = (entries: TimeEntry[]): WorkDay[] => {
    const dayMap = new Map<string, TimeEntry[]>();

    // Group entries by date
    entries.forEach(entry => {
      const date = format(parseISO(entry.timestamp), 'yyyy-MM-dd');
      if (!dayMap.has(date)) {
        dayMap.set(date, []);
      }
      dayMap.get(date)!.push(entry);
    });

    const workDays: WorkDay[] = [];

    // Process each day
    dayMap.forEach((dayEntries, date) => {
      dayEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let totalMinutes = 0;
      let sessions = 0;
      let punchIn: TimeEntry | null = null;

      dayEntries.forEach(entry => {
        if (entry.entry_type === 'punch_in') {
          punchIn = entry;
        } else if (entry.entry_type === 'punch_out' && punchIn) {
          const punchInTime = new Date(punchIn.timestamp);
          const punchOutTime = new Date(entry.timestamp);
          const sessionMinutes = (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60);
          totalMinutes += sessionMinutes;
          sessions++;
          punchIn = null;
        }
      });

      if (dayEntries.length > 0) {
        workDays.push({
          date,
          totalHours: Math.floor(totalMinutes / 60),
          totalMinutes: Math.round(totalMinutes % 60),
          sessions,
          firstPunch: dayEntries[0].timestamp,
          lastPunch: dayEntries[dayEntries.length - 1].timestamp,
        });
      }
    });

    return workDays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const formatTime = (timestamp: string) => {
    return format(parseISO(timestamp), 'HH:mm', { locale: nb });
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'EEEE d MMMM yyyy', { locale: nb });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-foreground">Laster timeliste...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Timeliste</h1>
        </div>

        {workDays.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                Ingen arbeidsdager registrert ennå.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {workDays.map((workDay) => (
              <Card key={workDay.date} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {formatDate(workDay.date)}
                        </h3>
                        <Badge variant="outline">
                          {workDay.sessions} økt{workDay.sessions !== 1 ? 'er' : ''}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatTime(workDay.firstPunch)} - {formatTime(workDay.lastPunch)}
                          </span>
                        </div>
                        
                        <div className="text-sm">
                          <span className="text-muted-foreground">Arbeidstid: </span>
                          <span className="font-medium text-foreground">
                            {workDay.totalHours}t {workDay.totalMinutes}min
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {workDay.totalHours}:{workDay.totalMinutes.toString().padStart(2, '0')}
                      </div>
                      <div className="text-sm text-muted-foreground">timer</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}