import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import { toNorwegianTime, getNorwegianNow, formatTimeNorway, extractTime } from '@/lib/timeUtils';
import { processTimeEntry, type TimeEntry as PunchEntryType, type Shift, type BusinessHours } from '@/lib/timeEntryUtils';
import { supabase } from '@/integrations/supabase/client';

const NORWEGIAN_DAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

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
  const [timeEntries, setTimeEntries] = useState<PunchEntryType[]>([]);

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
      // Gruppera punch-entries per dag i norsk tid
      const entriesByDate = new Map<string, PunchEntryType[]>();
      
      timeEntries.forEach((entry) => {
        const norwegianDate = toNorwegianTime(entry.timestamp);
        const entryDate = startOfDay(norwegianDate);
        const dateKey = entryDate.toISOString();
        
        if (!entriesByDate.has(dateKey)) {
          entriesByDate.set(dateKey, []);
        }
        entriesByDate.get(dateKey)!.push(entry);
      });

      // Gruppera skift per dag i norsk tid (vaktlista styr VILKA dagar som visas)
      const shiftsByDate = new Map<string, Shift>();
      
      shifts.forEach((shift: Shift) => {
        const norwegianShiftDate = toNorwegianTime(shift.start_time);
        const shiftDate = startOfDay(norwegianShiftDate);
        const dateKey = shiftDate.toISOString();
        
        // Om flera skift samma dag: ta första
        if (!shiftsByDate.has(dateKey)) {
          shiftsByDate.set(dateKey, shift);
        }
      });

      const businessHours = companySettings?.business_hours as BusinessHours[] | undefined;
      const todayNorway = startOfDay(getNorwegianNow());
      const newTimelist: TimelistEntry[] = [];

      // Bygg lista över ALLA dagar i månaden
      const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
      const monthEnd = endOfMonth(monthStart);
      const allDaysInMonth: Date[] = [];
      
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        allDaysInMonth.push(new Date(d));
      }

      // Iterera över ALLA dagar i månaden (inte bara schema-dagar)
      allDaysInMonth.forEach((date) => {
        const dayNorway = startOfDay(toNorwegianTime(date));
        const dateKey = dayNorway.toISOString();
        const isToday = dayNorway.getTime() === todayNorway.getTime();
        const isFuture = dayNorway.getTime() > todayNorway.getTime();

        // Visa bara dagar som redan varit (inkl idag)
        if (isFuture) return;

        // Hämta eventuellt skift för denna dag
        const dayShift = shiftsByDate.get(dateKey) ?? undefined;

        const dayEntries = entriesByDate.get(dateKey) ?? [];
        const sortedEntries = [...dayEntries].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const punchInEntry = sortedEntries.find(e => e.entry_type === 'punch_in');
        const punchOutEntry = sortedEntries.find(e => e.entry_type === 'punch_out');

        const processed = processTimeEntry(
          date,
          dayShift,
          punchInEntry,
          punchOutEntry,
          businessHours,
          isToday
        );

        // Dag & veckodag baserat på norsk tid
        const dayNumber = dayNorway.getDate().toString();
        const dayName = NORWEGIAN_DAYS[dayNorway.getDay()];
        const dateStr = format(dayNorway, 'yyyy-MM-dd');

        // Om ingen data finns, visa ändå en tom rad
        if (!processed.hasData) {
          newTimelist.push({
            date: dateStr,
            day: dayNumber,
            dayName,
            punchIn: null,
            punchOut: null,
            lunch: '',
            total: '',
            hasData: false,
          });
          return;
        }

        // Format för visning (samma idé som i TimeEntries)
        const formatForDisplay = (time: string | null): string | null => {
          if (!time) return null;
          return processed.source === 'schedule'
            ? extractTime(time)          // schema-tider är redan norsk tid
            : formatTimeNorway(time);    // punch-tider är UTC => konverteras
        };

        const punchInDisplay = formatForDisplay(processed.punchIn);
        const punchOutDisplay = formatForDisplay(processed.punchOut);

        const lunchDisplay =
          processed.lunchMinutes > 0
            ? `${Math.floor(processed.lunchMinutes / 60)}:${(processed.lunchMinutes % 60)
                .toString()
                .padStart(2, '0')}`
            : '';

        const totalMinutes = processed.totalMinutes;
        const totalDisplay = `${Math.floor(totalMinutes / 60)}:${(totalMinutes % 60)
          .toString()
          .padStart(2, '0')}`;

        newTimelist.push({
          date: dateStr,
          day: dayNumber,
          dayName,
          punchIn: punchInDisplay,
          punchOut: punchOutDisplay,
          lunch: lunchDisplay,
          total: totalDisplay,
          hasData: processed.hasData,
        });
      });

      // Sortera listan stigande på datum
      newTimelist.sort((a, b) => a.date.localeCompare(b.date));
      setTimelistEntries(newTimelist);
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
