import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Download, Edit, Trash2, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getDay } from 'date-fns';
import { sv } from 'date-fns/locale';

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

const COMPANY_INFO = {
  name: "San Marino Pizza AS",
  address: "Storgata 123",
  city: "1234 Oslo",
  orgNumber: "123456789"
};

const NORWEGIAN_DAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

export default function Reports() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timelistEntries, setTimelistEntries] = useState<TimelistEntry[]>([]);
  
  // Edit functionality
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDate, setEditingDate] = useState<string>('');
  const [editForm, setEditForm] = useState({
    punch_in: '',
    punch_out: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      generateTimelist();
    }
  }, [selectedMonth, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, personal_number')
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Fel vid hämtning av anställda');
    }
  };

  const generateTimelist = async () => {
    if (!selectedEmployee) return;
    
    setLoading(true);
    try {
      const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
      const monthEnd = endOfMonth(monthStart);
      
      // Get time entries for the selected month and employee
      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', selectedEmployee)
        .gte('timestamp', format(monthStart, 'yyyy-MM-dd'))
        .lte('timestamp', format(monthEnd, 'yyyy-MM-dd'))
        .order('timestamp');

      if (error) throw error;

      // Generate all days of the month
      const allDaysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd
      });

      // Process time entries into daily data
      const processedEntries = allDaysInMonth.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);
        const dayEntries = (timeEntries || []).filter(entry => 
          entry.timestamp.startsWith(dateStr)
        );

        // Find punch in and punch out for this day
        const punchInEntry = dayEntries.find(entry => entry.entry_type === 'punch_in');
        const punchOutEntry = dayEntries.find(entry => entry.entry_type === 'punch_out');
        
        const punchIn = punchInEntry ? format(parseISO(punchInEntry.timestamp), 'HH:mm') : null;
        const punchOut = punchOutEntry ? format(parseISO(punchOutEntry.timestamp), 'HH:mm') : null;
        
        // Calculate total hours and lunch break
        let total = '';
        let lunch = '';
        
        if (punchIn && punchOut) {
          const startTime = parseISO(punchInEntry!.timestamp);
          const endTime = parseISO(punchOutEntry!.timestamp);
          const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
          
          // Assume 30 min lunch for work days over 6 hours
          const lunchMinutes = totalMinutes > 360 ? 30 : 0;
          const workMinutes = totalMinutes - lunchMinutes;
          
          const hours = Math.floor(workMinutes / 60);
          const minutes = workMinutes % 60;
          total = `${hours}:${minutes.toString().padStart(2, '0')}`;
          lunch = lunchMinutes > 0 ? `0:${lunchMinutes}` : '';
        }

        return {
          date: dateStr,
          day: date.getDate().toString(),
          dayName: NORWEGIAN_DAYS[dayOfWeek],
          punchIn,
          punchOut,
          lunch,
          total,
          hasData: !!(punchIn && punchOut)
        };
      });

      setTimelistEntries(processedEntries);
    } catch (error) {
      console.error('Error generating timelist:', error);
      toast.error('Fel vid generering av timlista');
    } finally {
      setLoading(false);
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
      // Delete existing entries for this day
      await supabase
        .from('time_entries')
        .delete()
        .eq('employee_id', selectedEmployee)
        .gte('timestamp', `${editingDate}T00:00:00`)
        .lte('timestamp', `${editingDate}T23:59:59`);

      // Insert new entries if both times are provided
      if (editForm.punch_in && editForm.punch_out) {
        const { error } = await supabase
          .from('time_entries')
          .insert([
            {
              employee_id: selectedEmployee,
              entry_type: 'punch_in',
              timestamp: `${editingDate}T${editForm.punch_in}:00`
            },
            {
              employee_id: selectedEmployee,
              entry_type: 'punch_out',
              timestamp: `${editingDate}T${editForm.punch_out}:00`
            }
          ]);

        if (error) throw error;
      }

      toast.success('Tider uppdaterade');
      setShowEditDialog(false);
      generateTimelist();
    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast.error(error.message || 'Fel vid uppdatering');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entry: TimelistEntry) => {
    if (!selectedEmployee) return;
    
    try {
      await supabase
        .from('time_entries')
        .delete()
        .eq('employee_id', selectedEmployee)
        .gte('timestamp', `${entry.date}T00:00:00`)
        .lte('timestamp', `${entry.date}T23:59:59`);

      toast.success('Post borttagen');
      generateTimelist();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error(error.message || 'Fel vid borttagning');
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

  const selectedEmployeeData = employees.find(emp => emp.user_id === selectedEmployee);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold">{COMPANY_INFO.name}</h1>
        <p className="text-sm text-muted-foreground">{COMPANY_INFO.address}</p>
        <p className="text-sm text-muted-foreground">{COMPANY_INFO.city}</p>
        <p className="text-sm text-muted-foreground">Org.nr: {COMPANY_INFO.orgNumber}</p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Timlista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-lg font-medium min-w-[120px] text-center">
                {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: sv })}
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
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Skriv ut
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportera
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Info */}
      {selectedEmployeeData && (
        <Card className="mb-6">
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
                  <TableHead className="text-center border-r">LUNCH</TableHead>
                  <TableHead className="text-center border-r">TOTALT</TableHead>
                  {userRole === 'admin' && (
                    <TableHead className="text-center">ÅTGÄRD</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timelistEntries.map((entry, index) => (
                  <TableRow key={entry.date} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                    <TableCell className="text-center border-r font-mono">{entry.day}</TableCell>
                    <TableCell className="text-center border-r">{entry.dayName}</TableCell>
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
                ))}
                
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
        <Card className="mt-6">
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera arbetstid för {editingDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="punch-in">Stämpla in</Label>
              <Input
                id="punch-in"
                type="time"
                value={editForm.punch_in}
                onChange={(e) => setEditForm(prev => ({ ...prev, punch_in: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="punch-out">Stämpla ut</Label>
              <Input
                id="punch-out"
                type="time"
                value={editForm.punch_out}
                onChange={(e) => setEditForm(prev => ({ ...prev, punch_out: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleUpdateEntry} disabled={isSubmitting}>
              {isSubmitting ? 'Sparar...' : 'Spara'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}