import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Clock, MapPin, User, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addDays, startOfDay } from "date-fns";
import { sv } from "date-fns/locale";

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Shift {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

const Schedule = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create Shift Dialog State
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [employeeShifts, setEmployeeShifts] = useState<Array<{
    employee_id: string;
    start_time: string;
    end_time: string;
    hours: number;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date range for 4 weeks ahead
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
  const scheduleEnd = addWeeks(weekStart, 4);
  const scheduleStart = weekStart;
  
  const weekDays = eachDayOfInterval({
    start: scheduleStart,
    end: scheduleEnd
  });

  // Fetch all employees
  const { data: employees } = useQuery({
    queryKey: ['schedule-employees'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, email')
        .order('first_name', { ascending: true });
      
      if (error) throw error;
      return profiles as Profile[];
    },
    enabled: userRole === 'admin'
  });

  // Fetch shifts for the next 4 weeks
  const { data: shifts } = useQuery({
    queryKey: ['schedule-shifts'],
    queryFn: async () => {
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('start_time', scheduleStart.toISOString())
        .lte('start_time', scheduleEnd.toISOString())
        .order('start_time', { ascending: true });
      
      if (error) throw error;

      // Get profile data for each shift
      const shiftsWithProfiles = await Promise.all(
        shifts.map(async (shift) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', shift.employee_id)
            .single();
          
          return {
            ...shift,
            profiles: profile
          };
        })
      );
      
      return shiftsWithProfiles as Shift[];
    },
  });

  const calculateHours = (startTime: string, endTime: string): number => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    const diffMs = end.getTime() - start.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal
  };

  const handleCreateShift = (date: Date) => {
    setSelectedDate(date);
    setEmployeeShifts([]);
    setShowCreateDialog(true);
  };

  const addEmployeeShift = () => {
    setEmployeeShifts(prev => [...prev, {
      employee_id: '',
      start_time: '09:00',
      end_time: '17:00',
      hours: 8
    }]);
  };

  const updateEmployeeShift = (index: number, field: string, value: string) => {
    setEmployeeShifts(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      
      // Recalculate hours if times changed
      if (field === 'start_time' || field === 'end_time') {
        updated[index].hours = calculateHours(updated[index].start_time, updated[index].end_time);
      }
      
      return updated;
    });
  };

  const removeEmployeeShift = (index: number) => {
    setEmployeeShifts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitShifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    
    setIsSubmitting(true);

    try {
      const shiftsToCreate = employeeShifts
        .filter(shift => shift.employee_id && shift.start_time && shift.end_time)
        .map(shift => {
          const startDateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${shift.start_time}:00`);
          const endDateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${shift.end_time}:00`);
          
          return {
            employee_id: shift.employee_id,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            location: null,
            notes: null
          };
        });

      if (shiftsToCreate.length === 0) {
        toast({
          title: "Fel",
          description: "Lägg till minst ett pass med anställd och tider",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('shifts')
        .insert(shiftsToCreate);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: `${shiftsToCreate.length} pass har skapats framgångsrikt`,
      });

      setShowCreateDialog(false);
      setEmployeeShifts([]);
      queryClient.invalidateQueries({ queryKey: ['schedule-shifts'] });

    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte skapa pass",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Pass har tagits bort",
      });

      queryClient.invalidateQueries({ queryKey: ['schedule-shifts'] });

    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte ta bort pass",
        variant: "destructive",
      });
    }
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts?.filter(shift => 
      format(parseISO(shift.start_time), 'yyyy-MM-dd') === dateStr
    ) || [];
  };

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Åtkomst nekad</CardTitle>
            <CardDescription>
              Du har inte behörighet att komma åt schemaläggningen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Group days by weeks
  const weeks = [];
  for (let i = 0; i < weekDays.length; i += 7) {
    weeks.push(weekDays.slice(i, i + 7));
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Schema</h1>
          <p className="text-muted-foreground">Hantera pass för de närmaste 4 veckorna</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          {format(scheduleStart, 'dd MMM', { locale: sv })} - {format(scheduleEnd, 'dd MMM yyyy', { locale: sv })}
        </div>
      </div>

      {/* Weekly Schedule Grid */}
      <div className="space-y-6">
        {weeks.map((week, weekIndex) => (
          <Card key={weekIndex}>
            <CardHeader>
              <CardTitle className="text-lg">
                Vecka {format(week[0], 'w', { locale: sv })} - {format(week[0], 'MMM yyyy', { locale: sv })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-4">
                {week.map((day) => {
                  const dayShifts = getShiftsForDate(day);
                  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const isPast = day < startOfDay(today);
                  
                  return (
                    <div key={day.toISOString()} className={`border rounded-lg p-3 min-h-[120px] ${isToday ? 'border-primary bg-primary/5' : 'border-border'} ${isPast ? 'bg-muted/50' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">
                            {format(day, 'EEE', { locale: sv })}
                          </div>
                          <div className={`text-lg ${isToday ? 'font-bold text-primary' : ''}`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                        {!isPast && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCreateShift(day)}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {dayShifts.map((shift) => (
                          <div key={shift.id} className="bg-primary/10 border border-primary/20 rounded p-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium truncate">
                                {shift.profiles?.first_name} {shift.profiles?.last_name}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteShift(shift.id)}
                                  className="h-4 w-4 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {format(parseISO(shift.start_time), 'HH:mm')} - {format(parseISO(shift.end_time), 'HH:mm')}
                              </span>
                            </div>
                            {shift.location && (
                              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{shift.location}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Shifts Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Lägg till pass</DialogTitle>
            <DialogDescription>
              Lägg till pass för {selectedDate && format(selectedDate, 'EEEE d MMMM', { locale: sv })}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto">
            <div className="space-y-4">
              {employeeShifts.map((shift, index) => {
                const employee = employees?.find(e => e.user_id === shift.employee_id);
                return (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Pass {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmployeeShift(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid gap-3">
                      <div>
                        <Label>Anställd</Label>
                        <Select 
                          value={shift.employee_id} 
                          onValueChange={(value) => updateEmployeeShift(index, 'employee_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Välj anställd" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees?.map((employee) => (
                              <SelectItem key={employee.user_id} value={employee.user_id}>
                                {employee.first_name} {employee.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor={`start-${index}`}>Från</Label>
                          <Input
                            id={`start-${index}`}
                            type="time"
                            value={shift.start_time}
                            onChange={(e) => updateEmployeeShift(index, 'start_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`end-${index}`}>Till</Label>
                          <Input
                            id={`end-${index}`}
                            type="time"
                            value={shift.end_time}
                            onChange={(e) => updateEmployeeShift(index, 'end_time', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Timmar</Label>
                          <div className="h-10 flex items-center px-3 py-2 border rounded-md bg-muted">
                            <span className="font-medium">{shift.hours}h</span>
                          </div>
                        </div>
                      </div>
                      
                      {employee && (
                        <div className="text-sm text-muted-foreground">
                          {employee.first_name} {employee.last_name} • {shift.start_time} - {shift.end_time} • {shift.hours} timmar
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              <Button
                type="button"
                variant="outline"
                onClick={addEmployeeShift}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Lägg till anställd
              </Button>
            </div>
          </div>
          
          <DialogFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Totalt: {employeeShifts.reduce((total, shift) => total + shift.hours, 0)} timmar
            </div>
            <Button 
              onClick={handleSubmitShifts} 
              disabled={isSubmitting || employeeShifts.length === 0}
            >
              {isSubmitting ? 'Skapar...' : `Skapa ${employeeShifts.length} pass`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;