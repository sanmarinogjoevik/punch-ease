import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isAfter, isSameDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Clock, Calendar } from 'lucide-react';

interface WorkDay {
  date: string;
  totalHours: number;
  totalMinutes: number;
  shifts: number;
  startTime: string;
  endTime: string;
}

export default function Timeliste() {
  const { user } = useAuth();
  const { data: shifts, isLoading: shiftsLoading } = useShifts({ employeeId: user?.id });
  const { data: companySettings, isLoading: settingsLoading } = useCompanySettings();
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);

  const loading = shiftsLoading || settingsLoading;

  useEffect(() => {
    if (shifts && companySettings && !loading) {
      const processedWorkDays = processShiftsIntoWorkDays(shifts, companySettings.business_hours);
      setWorkDays(processedWorkDays);
    }
  }, [shifts, companySettings, loading]);

  const processShiftsIntoWorkDays = (shifts: any[], businessHours: any[]): WorkDay[] => {
    const now = new Date();
    const dayMap = new Map<string, any[]>();

    // Group shifts by date
    shifts.forEach(shift => {
      const date = format(parseISO(shift.start_time), 'yyyy-MM-dd');
      if (!dayMap.has(date)) {
        dayMap.set(date, []);
      }
      dayMap.get(date)!.push(shift);
    });

    const workDays: WorkDay[] = [];

    // Process each day
    dayMap.forEach((dayShifts, date) => {
      const dayDate = parseISO(date);
      const dayOfWeek = dayDate.getDay();
      
      // Find business hours for this day of week
      const dayBusinessHours = businessHours.find(bh => bh.day === dayOfWeek);
      
      // Check if we should show shifts for this day
      let shouldShowShifts = false;
      
      if (isSameDay(dayDate, now)) {
        // For today, check if we're past closing time
        if (dayBusinessHours && dayBusinessHours.isOpen) {
          const [closeHour, closeMin] = dayBusinessHours.closeTime.split(':').map(Number);
          const closingTime = new Date(now);
          closingTime.setHours(closeHour, closeMin, 0, 0);
          shouldShowShifts = isAfter(now, closingTime);
        } else {
          // If store is closed today, show shifts
          shouldShowShifts = true;
        }
      } else if (dayDate < now) {
        // Past days - always show
        shouldShowShifts = true;
      }
      // Future days - don't show

      if (shouldShowShifts && dayShifts.length > 0) {
        dayShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        let totalMinutes = 0;
        
        dayShifts.forEach(shift => {
          const startTime = new Date(shift.start_time);
          const endTime = new Date(shift.end_time);
          const shiftMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
          totalMinutes += shiftMinutes;
        });

        workDays.push({
          date,
          totalHours: Math.floor(totalMinutes / 60),
          totalMinutes: Math.round(totalMinutes % 60),
          shifts: dayShifts.length,
          startTime: dayShifts[0].start_time,
          endTime: dayShifts[dayShifts.length - 1].end_time,
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
                          {workDay.shifts} vakt{workDay.shifts !== 1 ? 'er' : ''}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatTime(workDay.startTime)} - {formatTime(workDay.endTime)}
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