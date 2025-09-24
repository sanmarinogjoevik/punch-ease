import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isSameDay } from 'date-fns';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';

interface Coworker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  coworkers?: Coworker[];
}

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyShifts();
  }, [user]);

  const fetchMyShifts = async () => {
    if (!user) return;

    try {
      // Fetch upcoming shifts
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (upcomingError) {
        console.error('Error fetching upcoming shifts:', upcomingError);
      } else {
        const shiftsWithCoworkers = await Promise.all(
          (upcomingData || []).map(async (shift) => {
            const coworkers = await fetchCoworkersForShift(shift);
            return { ...shift, coworkers };
          })
        );
        setUpcomingShifts(shiftsWithCoworkers);
      }

      // Fetch past shifts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: pastData, error: pastError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .lt('end_time', new Date().toISOString())
        .gte('start_time', thirtyDaysAgo.toISOString())
        .order('start_time', { ascending: false });

      if (pastError) {
        console.error('Error fetching past shifts:', pastError);
      } else {
        const shiftsWithCoworkers = await Promise.all(
          (pastData || []).map(async (shift) => {
            const coworkers = await fetchCoworkersForShift(shift);
            return { ...shift, coworkers };
          })
        );
        setPastShifts(shiftsWithCoworkers);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoworkersForShift = async (shift: Omit<Shift, 'coworkers'>) => {
    const shiftDate = parseISO(shift.start_time);
    
    // Find other employees working on the same day
    const { data: coworkerShifts, error } = await supabase
      .from('shifts')
      .select(`
        employee_id,
        profiles:employee_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .neq('employee_id', user!.id)
      .gte('start_time', format(shiftDate, 'yyyy-MM-dd') + 'T00:00:00.000Z')
      .lt('start_time', format(shiftDate, 'yyyy-MM-dd') + 'T23:59:59.999Z');

    if (error) {
      console.error('Error fetching coworkers:', error);
      return [];
    }

    // Extract unique coworkers
    const uniqueCoworkers = coworkerShifts?.reduce((acc: Coworker[], shift) => {
      const profile = shift.profiles as any;
      if (profile && !acc.find(c => c.id === profile.id)) {
        acc.push({
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        });
      }
      return acc;
    }, []) || [];

    return uniqueCoworkers;
  };

  const getShiftBadge = (startTime: string, isPast = false) => {
    const date = parseISO(startTime);
    
    if (isPast) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">Completed</Badge>;
    }
    
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

  const renderShiftCard = (shift: Shift, isPast = false) => (
    <Card key={shift.id}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {format(parseISO(shift.start_time), 'EEEE, MMMM dd, yyyy')}
          </CardTitle>
          {getShiftBadge(shift.start_time, isPast)}
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

        {shift.coworkers && shift.coworkers.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium text-foreground mb-1">Working with:</div>
              <div className="space-y-1">
                {shift.coworkers.map((coworker) => (
                  <div key={coworker.id} className="flex items-center gap-2">
                    <span>
                      {coworker.first_name && coworker.last_name
                        ? `${coworker.first_name} ${coworker.last_name}`
                        : coworker.email}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {shift.notes && (
          <div className="text-sm text-muted-foreground">
            <strong>Notes:</strong> {shift.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">My Schedule</h1>
      </div>

      {/* Upcoming Shifts */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Upcoming Shifts</h2>
        {upcomingShifts.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming shifts scheduled.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {upcomingShifts.map((shift) => renderShiftCard(shift, false))}
          </div>
        )}
      </div>

      {/* Work History */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Work History (Last 30 Days)</h2>
        {pastShifts.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No work history found for the last 30 days.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pastShifts.map((shift) => renderShiftCard(shift, true))}
          </div>
        )}
      </div>
    </div>
  );
}