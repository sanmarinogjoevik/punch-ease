import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEmployeeMonthShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, isSameDay, isToday } from 'date-fns';
import { nb } from 'date-fns/locale';
import { formatTimeNorway, calculateDurationMinutes, formatDuration } from '@/lib/timeUtils';
import { supabase } from '@/integrations/supabase/client';

const NORWEGIAN_DAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

interface TimelistEntry {
  date: string;
  day: string;
  dayName: string;
  punchIn: string | null;
  punchOut: string | null;
  lunch: string;
  totalMinutes: number;
  hasData: boolean;
}

export default function Timeliste() {
  const { user } = useAuth();
  const { data: userProfile } = useCurrentUserProfile();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [timelistEntries, setTimelistEntries] = useState<TimelistEntry[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  
  const { data: shifts, isLoading: shiftsLoading } = useEmployeeMonthShifts(
    user?.id || '',
    selectedMonth
  );
  
  const { data: companySettings, isLoading: settingsLoading } = useCompanySettings();

  const isLoading = shiftsLoading || settingsLoading;

  useEffect(() => {
    if (!isLoading && shifts && user) {
      fetchTimeEntriesAndGenerate();
    }
  }, [shifts, companySettings, selectedMonth, isLoading, user]);

  const fetchTimeEntriesAndGenerate = async () => {
    if (!user) return;
    
    const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    
    const { data: entries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', user.id)
      .gte('timestamp', monthStart.toISOString())
      .lte('timestamp', monthEnd.toISOString())
      .order('timestamp', { ascending: true });
    
    setTimeEntries(entries || []);
    generateTimelist(entries || []);
  };

  const generateTimelist = (entries: any[]) => {
    if (!shifts) {
      setTimelistEntries([]);
      return;
    }
    
    try {
      const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
      const monthEnd = endOfMonth(monthStart);
      
      // Generate all days of the month
      const allDaysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      });

      // Group time entries by date
      const entriesByDate: { [key: string]: any[] } = {};
      entries.forEach(entry => {
        const entryDate = format(parseISO(entry.timestamp), 'yyyy-MM-dd');
        if (!entriesByDate[entryDate]) {
          entriesByDate[entryDate] = [];
        }
        entriesByDate[entryDate].push(entry);
      });

      // Process shifts into daily data with actual time entries
      const processedEntries = allDaysInMonth.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);
        
        // Find shift for this day
        const dayShift = shifts.find(shift => 
          shift.start_time.startsWith(dateStr)
        );
        
        // Find actual punch in/out from time entries
        const entriesForDay = entriesByDate[dateStr] || [];
        const punchInEntry = entriesForDay.find(e => e.entry_type === 'punch_in');
        const punchOutEntry = entriesForDay.find(e => e.entry_type === 'punch_out');
        
        let punchIn = null;
        let punchOut = null;
        let totalMinutes = 0;
        let lunch = '';
        let hasData = false;
        
        if (punchInEntry || dayShift) {
          hasData = true;
          
          // Use actual punch time if available, otherwise use scheduled time
          if (punchInEntry) {
            punchIn = format(parseISO(punchInEntry.timestamp), 'HH:mm');
          } else if (dayShift) {
            punchIn = formatTimeNorway(dayShift.start_time);
          }
          
          // Check if this is an active session (punch in without punch out on today)
          const isActiveToday = isToday(date) && punchInEntry && !punchOutEntry;
          
          if (isActiveToday) {
            // Don't show OUT time for active shift
            punchOut = null;
            totalMinutes = 0;
          } else if (punchOutEntry) {
            // Use actual punch out time
            punchOut = format(parseISO(punchOutEntry.timestamp), 'HH:mm');
            
            // Calculate total hours from actual times
            const durationMinutes = calculateDurationMinutes(
              punchInEntry.timestamp, 
              punchOutEntry.timestamp
            );
            const lunchMinutes = durationMinutes >= 480 ? 30 : 0; // 30 min lunch if 8+ hours
            const workMinutes = Math.max(0, durationMinutes - lunchMinutes);
            totalMinutes = workMinutes;
            lunch = lunchMinutes > 0 ? `0:${lunchMinutes}` : '';
          } else if (dayShift) {
            // Use scheduled times as fallback
            punchOut = formatTimeNorway(dayShift.end_time);
            
            const durationMinutes = calculateDurationMinutes(dayShift.start_time, dayShift.end_time);
            const lunchMinutes = durationMinutes >= 480 ? 30 : 0;
            const workMinutes = Math.max(0, durationMinutes - lunchMinutes);
            totalMinutes = workMinutes;
            lunch = lunchMinutes > 0 ? `0:${lunchMinutes}` : '';
          }
        }

        return {
          date: dateStr,
          day: date.getDate().toString(),
          dayName: NORWEGIAN_DAYS[dayOfWeek],
          punchIn,
          punchOut,
          lunch,
          totalMinutes,
          hasData
        };
      });

      setTimelistEntries(processedEntries);
    } catch (error) {
      console.error('Error generating timelist:', error);
    }
  };

  const handlePreviousMonth = () => {
    const currentDate = new Date(selectedMonth + '-01');
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setSelectedMonth(format(previousMonth, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const currentDate = new Date(selectedMonth + '-01');
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setSelectedMonth(format(nextMonth, 'yyyy-MM'));
  };

  const calculateTotalHours = () => {
    const totalMinutes = timelistEntries.reduce((sum, entry) => sum + entry.totalMinutes, 0);
    return formatDuration(totalMinutes);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Laddar timelista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Min Timelista</h1>
        <p className="text-muted-foreground">
          {userProfile?.first_name} {userProfile?.last_name}
        </p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xl font-semibold min-w-[180px] text-center">
          {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: nb })}
        </div>
        <Button variant="outline" size="sm" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Timelist Table */}
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
                <TableHead className="text-center">TOTALT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timelistEntries.map((entry, index) => {
                // Check if this is an ongoing shift
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
                    <TableCell className="text-center font-mono font-semibold">
                      {entry.totalMinutes > 0 ? formatDuration(entry.totalMinutes) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* Total Row */}
              <TableRow className="bg-primary/5 font-bold border-t-2 border-t-primary">
                <TableCell colSpan={5} className="text-right pr-4">
                  TOTALT:
                </TableCell>
                <TableCell className="text-center font-mono text-lg">
                  {calculateTotalHours()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {timelistEntries.filter(e => e.hasData).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Inga pass hittades för denna månad
        </div>
      )}
    </div>
  );
}
