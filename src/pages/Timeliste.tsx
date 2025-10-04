import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEmployeeMonthShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import { formatTimeNorway } from '@/lib/timeUtils';

const NORWEGIAN_DAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

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

export default function Timeliste() {
  const { user } = useAuth();
  const { data: userProfile } = useCurrentUserProfile();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [timelistEntries, setTimelistEntries] = useState<TimelistEntry[]>([]);
  
  const { data: shifts, isLoading: shiftsLoading } = useEmployeeMonthShifts(
    user?.id || '',
    selectedMonth
  );
  
  const { data: companySettings, isLoading: settingsLoading } = useCompanySettings();

  const isLoading = shiftsLoading || settingsLoading;

  useEffect(() => {
    if (!isLoading && shifts) {
      generateTimelist();
    }
  }, [shifts, companySettings, selectedMonth, isLoading]);

  const generateTimelist = () => {
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

      // Process shifts into daily data with dynamic display logic
      const now = new Date();
      const processedEntries = allDaysInMonth.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);
        
        // Find shift for this day
        const dayShift = shifts.find(shift => 
          shift.start_time.startsWith(dateStr)
        );
        
        // Get business hours for this day of week
        const businessHour = companySettings?.business_hours?.find(bh => bh.day === dayOfWeek);
        
        let punchIn = null;
        let punchOut = null;
        let total = '';
        let lunch = '';
        let hasData = false;
        
        if (dayShift) {
          // Använd formatTimeNorway för att konvertera UTC till norsk tid
          const startTimeStr = formatTimeNorway(dayShift.start_time);
          const endTimeStr = formatTimeNorway(dayShift.end_time);
          
          // Skapa Date-objekt för jämförelser
          const [startHour, startMinute] = startTimeStr.split(':').map(Number);
          const [endHour, endMinute] = endTimeStr.split(':').map(Number);
          
          const shiftStart = new Date(date);
          shiftStart.setHours(startHour, startMinute, 0, 0);
          
          const shiftEnd = new Date(date);
          shiftEnd.setHours(endHour, endMinute, 0, 0);
          
          // Dynamic logic based on business hours and current time
          const shiftHasStarted = now >= shiftStart;
          
          // Determine when to show OUT time - when store closes for the day
          let storeHasClosed = false;
          if (businessHour && businessHour.isOpen) {
            // Create closing time for this date
            const [closeHour, closeMinute] = businessHour.closeTime.split(':').map(Number);
            const storeCloseTime = new Date(date);
            storeCloseTime.setHours(closeHour, closeMinute, 0, 0);
            storeHasClosed = now >= storeCloseTime;
          } else {
            // Fallback to shift end time if no business hours configured
            storeHasClosed = now >= shiftEnd;
          }
          
          if (shiftHasStarted) {
            // Show IN time when shift has started
            punchIn = startTimeStr;
            hasData = true;
            
            if (storeHasClosed) {
              // Show scheduled OUT time when store closes for the day
              punchOut = endTimeStr;
              
              const totalMinutes = Math.floor((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60));
              
              // Automatically add 30 min pause for work days 8 hours or more (480 minutes)
              const pauseMinutes = totalMinutes >= 480 ? 30 : 0;
              const workMinutes = totalMinutes - pauseMinutes;
              
              const hours = Math.floor(workMinutes / 60);
              const minutes = workMinutes % 60;
              total = `${hours}:${minutes.toString().padStart(2, '0')}`;
              lunch = pauseMinutes > 0 ? `0:${pauseMinutes}` : '';
            }
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
    let totalMinutes = 0;
    timelistEntries.forEach(entry => {
      if (entry.total) {
        const [hours, minutes] = entry.total.split(':').map(Number);
        totalMinutes += hours * 60 + minutes;
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
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
                      {entry.total || '-'}
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
