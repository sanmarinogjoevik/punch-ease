import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, startOfDay } from 'date-fns';
import { formatTimeNorway, calculateDurationMinutes, isAfterClosingTime } from '@/lib/timeUtils';
import { supabase } from '@/integrations/supabase/client';

const NORWEGIAN_DAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

interface TimeEntry {
  id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  employee_id: string;
}

interface TimelistEntry {
  date: string;
  day: string;
  dayName: string;
  punchIn: string | null;
  punchOut: string | null;
  lunch: string;
  total: string;
  hasData: boolean;
}

interface TimelistTableProps {
  selectedMonth: string;
  employeeId: string;
  companySettings: any;
  shifts: any[];
  showActions?: boolean;
  onEditEntry?: (entry: TimelistEntry) => void;
  onDeleteEntry?: (entry: TimelistEntry) => void;
}

export default function TimelistTable({
  selectedMonth,
  employeeId,
  companySettings,
  shifts,
  showActions = false,
  onEditEntry,
  onDeleteEntry
}: TimelistTableProps) {
  const [timelistEntries, setTimelistEntries] = useState<TimelistEntry[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  // Reset state when employee changes
  useEffect(() => {
    setTimelistEntries([]);
    setTimeEntries([]);
  }, [employeeId]);

  useEffect(() => {
    if (employeeId && selectedMonth) {
      fetchTimeEntries();
    }
  }, [employeeId, selectedMonth]);

  useEffect(() => {
    if (employeeId && shifts) {
      generateTimelist();
    }
  }, [shifts, timeEntries, employeeId, selectedMonth, companySettings]);

  // Real-time subscription for time_entries
  useEffect(() => {
    if (!employeeId) return;

    const channel = supabase
      .channel(`time_entries_${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `employee_id=eq.${employeeId}`
        },
        () => {
          fetchTimeEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId, selectedMonth]);

  const fetchTimeEntries = async () => {
    if (!employeeId) return;
    
    try {
      const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
      const monthEnd = endOfMonth(monthStart);
      
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('timestamp', monthStart.toISOString())
        .lte('timestamp', monthEnd.toISOString())
        .order('timestamp', { ascending: true });
      
      if (error) {
        console.error('Error fetching time entries:', error);
        return;
      }
      
      setTimeEntries(data || []);
    } catch (error) {
      console.error('Error fetching time entries:', error);
    }
  };

  const generateTimelist = () => {
    if (!employeeId || !shifts) return;
    
    try {
      const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
      const monthEnd = endOfMonth(monthStart);
      
      const allDaysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      });

      // Group time entries by date
      const entriesByDate = new Map<string, TimeEntry[]>();
      timeEntries.forEach(entry => {
        const dateStr = format(parseISO(entry.timestamp), 'yyyy-MM-dd');
        if (!entriesByDate.has(dateStr)) {
          entriesByDate.set(dateStr, []);
        }
        entriesByDate.get(dateStr)!.push(entry);
      });

      const processedEntries = allDaysInMonth.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);
        
        // Check if store is closed for this date
        const today = startOfDay(new Date());
        const currentDate = startOfDay(date);
        const isPastDay = currentDate < today;
        const isStoreClosed = isPastDay || (currentDate.getTime() === today.getTime() && isAfterClosingTime(date, companySettings?.business_hours as any[]));
        
        // Find shift for this day
        const dayShift = shifts.find(shift => 
          shift.start_time.startsWith(dateStr)
        );
        
        // Get time entries for this day
        const dayEntries = entriesByDate.get(dateStr) || [];
        const punchInEntry = dayEntries.find(e => e.entry_type === 'punch_in');
        const punchOutEntry = dayEntries.find(e => e.entry_type === 'punch_out');
        
        let punchIn = null;
        let punchOut = null;
        let total = '';
        let lunch = '';
        let hasData = false;
        
        // Only show entries for days with a scheduled shift
        if (dayShift) {
          hasData = true;
          
          if (isStoreClosed) {
            // Store closed - always use schedule times from shift
            punchIn = formatTimeNorway(dayShift.start_time);
            punchOut = formatTimeNorway(dayShift.end_time);
            
            const totalMinutes = calculateDurationMinutes(dayShift.start_time, dayShift.end_time);
            const pauseMinutes = totalMinutes > 330 ? 30 : 0;
            
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            total = `${hours}:${minutes.toString().padStart(2, '0')}`;
            lunch = pauseMinutes > 0 ? `0:${pauseMinutes}` : '';
          } else if (punchInEntry && punchOutEntry) {
            // Store open and has actual punches - use actual times
            punchIn = formatTimeNorway(punchInEntry.timestamp);
            punchOut = formatTimeNorway(punchOutEntry.timestamp);
            
            const totalMinutes = calculateDurationMinutes(
              punchInEntry.timestamp, 
              punchOutEntry.timestamp
            );
            const pauseMinutes = totalMinutes > 330 ? 30 : 0;
            
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            total = `${hours}:${minutes.toString().padStart(2, '0')}`;
            lunch = pauseMinutes > 0 ? `0:${pauseMinutes}` : '';
          } else if (punchInEntry) {
            // Only punch in, no punch out - show ongoing
            punchIn = formatTimeNorway(punchInEntry.timestamp);
          } else {
            // No punches yet, show scheduled times
            punchIn = formatTimeNorway(dayShift.start_time);
            punchOut = formatTimeNorway(dayShift.end_time);
            
            const totalMinutes = calculateDurationMinutes(dayShift.start_time, dayShift.end_time);
            const pauseMinutes = totalMinutes > 330 ? 30 : 0;
            
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            total = `${hours}:${minutes.toString().padStart(2, '0')}`;
            lunch = pauseMinutes > 0 ? `0:${pauseMinutes}` : '';
          }
        }

        return {
          date: dateStr,
          day: date.getDate().toString(),
          dayName: NORWEGIAN_DAYS[dayOfWeek],
          punchIn,
          punchOut,
          lunch,
          total,
          hasData
        };
      });

      setTimelistEntries(processedEntries);
    } catch (error) {
      console.error('Error generating timelist:', error);
    }
  };

  const calculateTotalHours = () => {
    return timelistEntries.reduce((total, entry) => {
      if (entry.total && entry.total !== '') {
        const [hours, minutes] = entry.total.split(':').map(Number);
        return total + (hours * 60) + minutes;
      }
      return total;
    }, 0);
  };

  const formatTotalMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center border-r">DATUM</TableHead>
              <TableHead className="text-center border-r">DAG</TableHead>
              <TableHead className="text-center border-r">IN</TableHead>
              <TableHead className="text-center border-r">UT</TableHead>
              <TableHead className="text-center border-r">PAUSE</TableHead>
              <TableHead className="text-center border-r">TOTALT</TableHead>
              {showActions && (
                <TableHead className="text-center">ÅTGÄRD</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {timelistEntries.map((entry, index) => {
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const isToday = entry.date === todayStr;
              const isOngoing = isToday && entry.punchIn && !entry.punchOut;
              
              return (
                <TableRow 
                  key={entry.date} 
                  className={`
                    ${index % 2 === 0 ? 'bg-muted/20' : ''} 
                    ${isOngoing ? 'bg-primary/10 border-l-4 border-l-primary' : ''}
                  `}
                >
                  <TableCell className="text-center border-r font-mono">{entry.day}</TableCell>
                  <TableCell className="text-center border-r">
                    {entry.dayName}
                    {isOngoing && <span className="ml-2 text-xs text-primary font-semibold">(Pågående)</span>}
                  </TableCell>
                  <TableCell className="text-center border-r font-mono">
                    {entry.punchIn || '-'}
                  </TableCell>
                  <TableCell className="text-center border-r font-mono">
                    {entry.punchOut || '-'}
                  </TableCell>
                  <TableCell className="text-center border-r font-mono">
                    {entry.lunch || '-'}
                  </TableCell>
                  <TableCell className="text-center border-r font-mono font-semibold">
                    {entry.total || '-'}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditEntry?.(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {entry.hasData && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteEntry?.(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            
            {/* Total Row */}
            <TableRow className="border-t-2 font-bold">
              <TableCell colSpan={5} className="text-right border-r">
                TOTALT:
              </TableCell>
              <TableCell className="text-center border-r font-mono">
                {formatTotalMinutes(calculateTotalHours())}
              </TableCell>
              {showActions && <TableCell></TableCell>}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
