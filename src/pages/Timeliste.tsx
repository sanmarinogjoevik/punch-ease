import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO, isAfter, isSameDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Clock, Calendar, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TimeEntry {
  id: string;
  timestamp: string;
  entry_type: 'punch_in' | 'punch_out';
  employee_id: string;
  created_at: string;
  employee_name?: string;
}

interface WorkSession {
  id: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  duration: number;
  status: 'active' | 'completed' | 'scheduled_only' | 'punch_only' | 'adjusted';
  isAdjusted: boolean;
  originalPunchIn?: string;
  originalPunchOut?: string;
  employeeName?: string;
}

interface WorkDay {
  date: string;
  totalHours: number;
  totalMinutes: number;
  shifts: number;
  startTime: string;
  endTime: string;
  isAdjusted: boolean;
  originalStartTime?: string;
  originalEndTime?: string;
  sessions: WorkSession[];
}

export default function Timeliste() {
  const { user } = useAuth();
  const { data: shifts, isLoading: shiftsLoading } = useShifts({ employeeId: user?.id });
  const { data: companySettings, isLoading: settingsLoading } = useCompanySettings();
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeEntriesLoading, setTimeEntriesLoading] = useState(true);

  const loading = shiftsLoading || settingsLoading || timeEntriesLoading;

  const fetchTimeEntries = async () => {
    if (!user?.id) return;
    
    try {
      setTimeEntriesLoading(true);
      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user.id)
        .order('timestamp', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      
      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error fetching time entries:', error);
      setTimeEntries([]);
    } finally {
      setTimeEntriesLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeEntries();
  }, [user?.id]);

  useEffect(() => {
    if (shifts && companySettings && timeEntries && !loading) {
      const processedWorkDays = processIntoWorkDays(timeEntries, shifts, companySettings.business_hours);
      setWorkDays(processedWorkDays);
    }
  }, [shifts, companySettings, timeEntries, loading]);

  const groupIntoWorkSessions = (timeEntries: TimeEntry[]): WorkSession[] => {
    const sessions: WorkSession[] = [];
    const entriesByDate = new Map<string, TimeEntry[]>();

    timeEntries.forEach(entry => {
      const date = format(parseISO(entry.timestamp), 'yyyy-MM-dd');
      if (!entriesByDate.has(date)) {
        entriesByDate.set(date, []);
      }
      entriesByDate.get(date)!.push(entry);
    });

    entriesByDate.forEach((entries, date) => {
      const sortedEntries = entries.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 0; i < sortedEntries.length; i += 2) {
        const punchIn = sortedEntries[i];
        const punchOut = sortedEntries[i + 1];

        if (punchIn?.entry_type === 'punch_in') {
          const session: WorkSession = {
            id: punchIn.id,
            date,
            punchIn: punchIn.timestamp,
            punchOut: punchOut?.entry_type === 'punch_out' ? punchOut.timestamp : undefined,
            duration: 0,
            status: punchOut ? 'completed' : 'active',
            isAdjusted: false,
            employeeName: punchIn.employee_name
          };

          if (session.punchIn && session.punchOut) {
            const start = new Date(session.punchIn);
            const end = new Date(session.punchOut);
            session.duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          }

          sessions.push(session);
        }
      }
    });

    return sessions;
  };

  const shouldUseScheduleTimes = (date: string, businessHours: any[]): boolean => {
    const sessionDate = parseISO(date);
    const now = new Date();
    const dayOfWeek = sessionDate.getDay();
    
    if (sessionDate < now && !isSameDay(sessionDate, now)) {
      return true;
    }
    
    if (isSameDay(sessionDate, now)) {
      const dayBusinessHours = businessHours.find(bh => bh.day === dayOfWeek);
      if (dayBusinessHours && dayBusinessHours.isOpen) {
        const [closeHour, closeMin] = dayBusinessHours.closeTime.split(':').map(Number);
        const closingTime = new Date(now);
        closingTime.setHours(closeHour, closeMin, 0, 0);
        return isAfter(now, closingTime);
      }
      return true;
    }
    
    return false;
  };

  const applyHybridLogic = (sessions: WorkSession[], shifts: any[], businessHours: any[]): WorkSession[] => {
    const shiftsByDate = new Map<string, any[]>();
    
    shifts.forEach(shift => {
      const date = format(parseISO(shift.start_time), 'yyyy-MM-dd');
      if (!shiftsByDate.has(date)) {
        shiftsByDate.set(date, []);
      }
      shiftsByDate.get(date)!.push(shift);
    });

    const enhancedSessions: WorkSession[] = [];
    const processedDates = new Set<string>();

    sessions.forEach(session => {
      const useSchedule = shouldUseScheduleTimes(session.date, businessHours);
      const dayShifts = shiftsByDate.get(session.date) || [];
      
      if (dayShifts.length > 0 && useSchedule) {
        dayShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        const enhancedSession: WorkSession = {
          ...session,
          scheduledStart: dayShifts[0].start_time,
          scheduledEnd: dayShifts[dayShifts.length - 1].end_time,
          isAdjusted: true,
          originalPunchIn: session.punchIn,
          originalPunchOut: session.punchOut,
          status: 'adjusted'
        };

        const scheduledStart = new Date(enhancedSession.scheduledStart!);
        const scheduledEnd = new Date(enhancedSession.scheduledEnd!);
        enhancedSession.duration = Math.round((scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60));
        
        enhancedSessions.push(enhancedSession);
      } else {
        // Only show punch data if not using schedule times OR if there's a schedule for the day
        const sessionDate = session.date;
        const dayShifts = shiftsByDate.get(sessionDate) || [];
        if (!useSchedule || dayShifts.length > 0) {
          enhancedSessions.push(session);
        }
      }
      
      processedDates.add(session.date);
    });

    shiftsByDate.forEach((dayShifts, date) => {
      if (!processedDates.has(date)) {
        dayShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        const scheduledStart = new Date(dayShifts[0].start_time);
        const scheduledEnd = new Date(dayShifts[dayShifts.length - 1].end_time);
        const duration = Math.round((scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60));
        
        enhancedSessions.push({
          id: `scheduled-${date}`,
          date,
          scheduledStart: dayShifts[0].start_time,
          scheduledEnd: dayShifts[dayShifts.length - 1].end_time,
          duration,
          status: 'scheduled_only',
          isAdjusted: false
        });
      }
    });

    return enhancedSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const processIntoWorkDays = (timeEntries: TimeEntry[], shifts: any[], businessHours: any[]): WorkDay[] => {
    const sessions = groupIntoWorkSessions(timeEntries);
    const enhancedSessions = applyHybridLogic(sessions, shifts, businessHours);
    
    const workDayMap = new Map<string, WorkSession[]>();
    
    enhancedSessions.forEach(session => {
      if (!workDayMap.has(session.date)) {
        workDayMap.set(session.date, []);
      }
      workDayMap.get(session.date)!.push(session);
    });

    const workDays: WorkDay[] = [];
    
    workDayMap.forEach((sessions, date) => {
      let totalMinutes = 0;
      let hasAdjusted = false;
      let originalStartTime: string | undefined;
      let originalEndTime: string | undefined;
      
      sessions.forEach(session => {
        totalMinutes += session.duration;
        if (session.isAdjusted) {
          hasAdjusted = true;
          if (!originalStartTime && session.originalPunchIn) {
            originalStartTime = session.originalPunchIn;
          }
          if (session.originalPunchOut) {
            originalEndTime = session.originalPunchOut;
          }
        }
      });

      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];
      
      const startTime = firstSession.scheduledStart || firstSession.punchIn || '';
      const endTime = lastSession.scheduledEnd || lastSession.punchOut || '';

      workDays.push({
        date,
        totalHours: Math.floor(totalMinutes / 60),
        totalMinutes: Math.round(totalMinutes % 60),
        shifts: sessions.length,
        startTime,
        endTime,
        isAdjusted: hasAdjusted,
        originalStartTime,
        originalEndTime,
        sessions
      });
    });

    return workDays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const formatTime = (timestamp: string) => {
    return format(parseISO(timestamp), 'HH:mm', { locale: nb });
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'EEEE d MMMM yyyy', { locale: nb });
  };

  const getWorkDayBadge = (workDay: WorkDay) => {
    if (workDay.isAdjusted) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Info className="h-3 w-3 mr-1" />
          Justerat enligt schema
        </Badge>
      );
    }
    
    const hasScheduled = workDay.sessions.some(s => s.scheduledStart);
    const hasPunch = workDay.sessions.some(s => s.punchIn);
    
    if (hasScheduled && !hasPunch) {
      return (
        <Badge variant="outline" className="text-xs">
          Endast schema
        </Badge>
      );
    }
    
    if (hasPunch && !hasScheduled) {
      return (
        <Badge variant="default" className="text-xs">
          Punch-tider
        </Badge>
      );
    }
    
    return null;
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
            <TooltipProvider>
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
                          {getWorkDayBadge(workDay)}
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {workDay.isAdjusted && workDay.originalStartTime && workDay.originalEndTime ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {formatTime(workDay.startTime)} - {formatTime(workDay.endTime)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Schemalagd tid</p>
                                  <p className="text-xs text-muted-foreground">
                                    Ursprunglig punch: {formatTime(workDay.originalStartTime)} - {formatTime(workDay.originalEndTime)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span>
                                {formatTime(workDay.startTime)} - {formatTime(workDay.endTime)}
                              </span>
                            )}
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
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}