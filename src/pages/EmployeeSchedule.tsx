import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
}

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyShifts();
  }, [user]);

  const fetchMyShifts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching shifts:', error);
        return;
      }

      setShifts(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getShiftBadge = (startTime: string) => {
    const date = parseISO(startTime);
    
    if (isToday(date)) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Today</Badge>;
    } else if (isTomorrow(date)) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Tomorrow</Badge>;
    } else if (isThisWeek(date)) {
      return <Badge variant="outline">This Week</Badge>;
    } else {
      return <Badge variant="secondary">Upcoming</Badge>;
    }
  };

  const formatShiftTime = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  const formatShiftDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">My Schedule</h1>
      </div>

      {shifts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming shifts scheduled.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift) => (
            <Card key={shift.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {format(parseISO(shift.start_time), 'EEEE, MMMM dd, yyyy')}
                  </CardTitle>
                  {getShiftBadge(shift.start_time)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {formatShiftTime(shift.start_time, shift.end_time)}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {formatShiftDuration(shift.start_time, shift.end_time)}
                    </Badge>
                  </div>
                </div>

                {shift.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{shift.location}</span>
                  </div>
                )}

                {shift.notes && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Notes:</strong> {shift.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}