import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Download, Edit, Trash2, Printer, Calendar, Clock, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useEmployeeMonthShifts, useShiftMutations, useShifts, useShiftsSubscription } from '@/hooks/useShifts';
import { useEmployees } from '@/hooks/useEmployees';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getDay, addWeeks, startOfWeek, startOfDay, subMonths, addMonths, subDays, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';

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

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  personal_number: string;
}

const NORWEGIAN_DAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

export default function Reports() {
  const { user, userRole } = useAuth();
  const { data: companySettings } = useCompanySettings();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [timelistEntries, setTimelistEntries] = useState<TimelistEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'timelista' | 'vaktlista'>('timelista');
  
  // Use the new hooks
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: shifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useEmployeeMonthShifts(
    selectedEmployee, 
    selectedMonth + '-01'
  );
  const { updateShift, deleteShift } = useShiftMutations();
  
  // Edit functionality
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDate, setEditingDate] = useState<string>('');
  const [editForm, setEditForm] = useState({
    punch_in: '',
    punch_out: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar view logic - Monthly
  const today = new Date();
  const currentMonth = new Date(selectedMonth + '-01');
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get the start of the week containing the first day of the month
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  // Get 6 weeks worth of days to ensure we show the full month
  const calendarEnd = addDays(calendarStart, 41); // 6 weeks = 42 days - 1
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  const { data: calendarShifts } = useShifts({
    startDate: calendarStart.toISOString(),
    endDate: calendarEnd.toISOString()
  });

  // Enable real-time subscription
  useShiftsSubscription();

  const loading = employeesLoading || shiftsLoading;

  // Generate timelist whenever shifts data changes
  useEffect(() => {
    if (selectedEmployee && shifts) {
      generateTimelist();
    }
  }, [shifts, selectedEmployee, selectedMonth, companySettings]);

  const generateTimelist = () => {
    if (!selectedEmployee || !shifts) return;
    
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
          const shiftStart = parseISO(dayShift.start_time);
          const shiftEnd = parseISO(dayShift.end_time);
          
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
            punchIn = format(shiftStart, 'HH:mm');
            hasData = true;
            
            if (storeHasClosed) {
              // Show scheduled OUT time when store closes for the day
              punchOut = format(shiftEnd, 'HH:mm');
              
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
      toast({
        title: "Fel",
        description: "Fel vid generering av timlista",
        variant: "destructive",
      });
    }
  };

  const handlePreviousMonth = () => {
    const currentDate = new Date(selectedMonth + '-01');
    const previousMonth = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    setSelectedMonth(format(previousMonth, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const currentDate = new Date(selectedMonth + '-01');
    const nextMonth = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
    setSelectedMonth(format(nextMonth, 'yyyy-MM'));
  };

  const handleEditEntry = (entry: TimelistEntry) => {
    setEditingDate(entry.date);
    setEditForm({
      punch_in: entry.punchIn || '',
      punch_out: entry.punchOut || ''
    });
    setShowEditDialog(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingDate || !selectedEmployee) return;
    
    setIsSubmitting(true);
    try {
      // Find existing shift for this day first
      const existingShift = shifts.find(shift => 
        shift.start_time.startsWith(editingDate)
      );

      if (existingShift) {
        // Update existing shift
        await updateShift.mutateAsync({
          id: existingShift.id,
          start_time: `${editingDate}T${editForm.punch_in}:00`,
          end_time: `${editingDate}T${editForm.punch_out}:00`
        });
      }

      setShowEditDialog(false);
    } catch (error: any) {
      console.error('Error updating shift:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entry: TimelistEntry) => {
    if (!selectedEmployee) return;
    
    try {
      // Find the shift for this day
      const dayShift = shifts.find(shift => 
        shift.start_time.startsWith(entry.date)
      );

      if (dayShift) {
        await deleteShift.mutateAsync(dayShift.id);
      }
    } catch (error: any) {
      console.error('Error deleting shift:', error);
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

  const exportTimelistToCSV = () => {
    if (!selectedEmployeeData || timelistEntries.length === 0) {
      toast({
        title: "Fel",
        description: "Välj en anställd och månad för att exportera",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Datum', 'Dag', 'In', 'Ut', 'Pause', 'Totalt'];
    const csvContent = [
      // Company info
      `${companySettings?.company_name || 'Mitt Företag AB'}`,
      `Timelista för ${selectedEmployeeData.first_name} ${selectedEmployeeData.last_name}`,
      `Period: ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: nb })}`,
      '',
      headers.join(','),
      ...timelistEntries.map(entry => [
        entry.day,
        entry.dayName,
        entry.punchIn || '',
        entry.punchOut || '',
        entry.lunch || '',
        entry.total || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timelista_${selectedEmployeeData.first_name}_${selectedEmployeeData.last_name}_${selectedMonth}.csv`;
    link.click();
  };

  const exportShiftListToCSV = () => {
    if (!calendarShifts || calendarShifts.length === 0) {
      toast({
        title: "Fel",
        description: "Inga vakter att exportera för denna period",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Datum', 'Anställd', 'Starttid', 'Sluttid', 'Plats', 'Anteckningar'];
    const csvContent = [
      // Company info
      `${companySettings?.company_name || 'Mitt Företag AB'}`,
      `Vaktlista`,
      `Period: ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: nb })}`,
      '',
      headers.join(','),
      ...calendarShifts.map(shift => [
        format(parseISO(shift.start_time), 'yyyy-MM-dd'),
        `${shift.profiles?.first_name || ''} ${shift.profiles?.last_name || ''}`,
        format(parseISO(shift.start_time), 'HH:mm'),
        format(parseISO(shift.end_time), 'HH:mm'),
        shift.location || '',
        shift.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vaktlista_${selectedMonth}.csv`;
    link.click();
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarShifts?.filter(shift => 
      format(parseISO(shift.start_time), 'yyyy-MM-dd') === dateStr
    ) || [];
  };

  // Group days by weeks for calendar view (6 weeks for full month view)
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const selectedEmployeeData = employees.find(emp => emp.user_id === selectedEmployee);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Rapporter
              </CardTitle>
              <p className="text-muted-foreground">
                Visa tidrapporter och vaktlistor för anställda
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'timelista' | 'vaktlista')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timelista">Timelista</TabsTrigger>
              <TabsTrigger value="vaktlista">Vaktlista</TabsTrigger>
            </TabsList>
            
            <TabsContent value="timelista" className="space-y-6">
              {/* Header */}
              <div className="text-center mb-6 border-b border-border pb-4">
                <h1 className="text-2xl font-bold">{companySettings?.company_name || 'Mitt Företag AB'}</h1>
                {companySettings?.address && <p className="text-sm text-muted-foreground">{companySettings.address}</p>}
                {(companySettings?.postal_code || companySettings?.city) && (
                  <p className="text-sm text-muted-foreground">{companySettings.postal_code} {companySettings.city}</p>
                )}
                {companySettings?.org_number && <p className="text-sm text-muted-foreground">Org.nr: {companySettings.org_number}</p>}
              </div>

              {/* Controls */}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                {/* Month Navigation */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-lg font-medium min-w-[120px] text-center">
                    {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: nb })}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Employee Selection */}
                <div className="flex-1">
                  <Label htmlFor="employee-select">Anställd</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger id="employee-select">
                      <SelectValue placeholder="Välj anställd" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(employee => (
                        <SelectItem key={employee.user_id} value={employee.user_id}>
                          {employee.first_name} {employee.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Skriv ut
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportTimelistToCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportera
                  </Button>
                </div>
              </div>

              {/* Employee Info */}
              {selectedEmployeeData && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Namn:</strong> {selectedEmployeeData.first_name} {selectedEmployeeData.last_name}
                      </div>
                      <div>
                        <strong>Personnummer:</strong> {selectedEmployeeData.personal_number || 'Ej angivet'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timelist Table */}
              {selectedEmployee && (
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
                          {userRole === 'admin' && (
                            <TableHead className="text-center">ÅTGÄRD</TableHead>
                          )}
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
                              <TableCell className="text-center border-r font-mono font-semibold">
                                {entry.total || '-'}
                              </TableCell>
                              {userRole === 'admin' && (
                                <TableCell className="text-center">
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditEntry(entry)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {entry.hasData && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteEntry(entry)}
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
                          {userRole === 'admin' && <TableCell></TableCell>}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Signature Section */}
              {selectedEmployee && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="mb-8">Anställds underskrift:</p>
                        <div className="border-b border-border h-8"></div>
                        <p className="text-sm text-muted-foreground mt-2">Datum</p>
                      </div>
                      <div>
                        <p className="mb-8">Chefs underskrift:</p>
                        <div className="border-b border-border h-8"></div>
                        <p className="text-sm text-muted-foreground mt-2">Datum</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="vaktlista" className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousMonth}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="text-lg font-semibold">
                    {format(currentMonth, 'MMMM yyyy', { locale: nb })}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="w-4 w-4 mr-2" />
                    Skriv ut
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportShiftListToCSV}>
                    <Download className="w-4 w-4 mr-2" />
                    Exportera
                  </Button>
                </div>
              </div>

              {/* Monthly Calendar Grid */}
              <Card>
                <CardHeader>
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(day => (
                      <div key={day} className="font-medium text-sm text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                      const dayShifts = getShiftsForDate(day);
                      const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                      const isCurrentMonth = format(day, 'yyyy-MM') === selectedMonth;
                      
                      return (
                        <div 
                          key={day.toISOString()} 
                          className={`
                            border rounded-lg p-2 min-h-[120px] transition-colors cursor-pointer hover:bg-muted/50
                            ${isToday ? 'border-primary bg-primary/5' : 'border-border'}
                            ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''}
                          `}
                        >
                          <div className="mb-2">
                            <div className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                              {format(day, 'd')}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            {dayShifts.map((shift) => (
                              <div 
                                key={shift.id} 
                                className="bg-primary/10 border border-primary/20 rounded p-1 text-xs"
                              >
                                <div className="font-medium text-xs truncate">
                                  {shift.profiles?.first_name} {shift.profiles?.last_name}
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="w-2 h-2" />
                                  <span className="text-xs">
                                    {format(parseISO(shift.start_time), 'HH:mm')} - {format(parseISO(shift.end_time), 'HH:mm')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera tider för {editingDate}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="punch_in" className="text-right">
                IN-tid
              </Label>
              <Input
                id="punch_in"
                type="time"
                value={editForm.punch_in}
                onChange={(e) => setEditForm(prev => ({ ...prev, punch_in: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="punch_out" className="text-right">
                UT-tid
              </Label>
              <Input
                id="punch_out"
                type="time"
                value={editForm.punch_out}
                onChange={(e) => setEditForm(prev => ({ ...prev, punch_out: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleUpdateEntry} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Uppdaterar...' : 'Spara ändringar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}