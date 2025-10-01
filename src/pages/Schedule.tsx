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
import { Calendar, Plus, Clock, MapPin, User, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createUTCFromNorwegianTime, extractTime, formatTimeNorway } from "@/lib/timeUtils";

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
  auto_punch_in: boolean;
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
    auto_punch_in: boolean;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current month state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Month calculations
  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get the calendar grid (6 weeks to show complete month view)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
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

  // Fetch shifts for the current month
  const { data: shifts } = useQuery({
    queryKey: ['schedule-shifts', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('start_time', monthStart.toISOString())
        .lte('start_time', monthEnd.toISOString())
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

  // Get suggested shift times for an employee
  const getSuggestedTimes = async (employeeId: string): Promise<{ start_time: string; end_time: string }> => {
    if (!employeeId) {
      return { start_time: '11:00', end_time: '18:00' };
    }

    // First, try to get the most recent shift for this employee
    const { data: recentShift } = await supabase
      .from('shifts')
      .select('start_time, end_time')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentShift) {
      return {
        start_time: formatTimeNorway(recentShift.start_time),
        end_time: formatTimeNorway(recentShift.end_time)
      };
    }

    // If no shift for this employee, get the most common shift times across all shifts
    const { data: allShifts } = await supabase
      .from('shifts')
      .select('start_time, end_time')
      .order('created_at', { ascending: false })
      .limit(50);

    if (allShifts && allShifts.length > 0) {
      // Count occurrences of start_time and end_time
      const timeMap = new Map<string, number>();
      allShifts.forEach(shift => {
        const key = `${formatTimeNorway(shift.start_time)}-${formatTimeNorway(shift.end_time)}`;
        timeMap.set(key, (timeMap.get(key) || 0) + 1);
      });

      // Get the most common time combination
      let mostCommon = '';
      let maxCount = 0;
      timeMap.forEach((count, key) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = key;
        }
      });

      if (mostCommon) {
        const [start, end] = mostCommon.split('-');
        return { start_time: start, end_time: end };
      }
    }

    // Fallback to reasonable defaults
    return { start_time: '11:00', end_time: '18:00' };
  };

  const addEmployeeShift = () => {
    setEmployeeShifts(prev => [...prev, {
      employee_id: '',
      start_time: '11:00',
      end_time: '18:00',
      hours: 7,
      auto_punch_in: true
    }]);
  };

  const updateEmployeeShift = async (index: number, field: string, value: string) => {
    setEmployeeShifts(prev => {
      const updated = [...prev];
      
      if (field === 'auto_punch_in') {
        updated[index] = {
          ...updated[index],
          auto_punch_in: value === 'true'
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value
        };
      }
      
      // Recalculate hours if times changed
      if (field === 'start_time' || field === 'end_time') {
        updated[index].hours = calculateHours(updated[index].start_time, updated[index].end_time);
      }
      
      return updated;
    });

    // When employee is selected, fetch and populate suggested times
    if (field === 'employee_id' && value) {
      const suggestedTimes = await getSuggestedTimes(value);
      setEmployeeShifts(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          start_time: suggestedTimes.start_time,
          end_time: suggestedTimes.end_time,
          hours: calculateHours(suggestedTimes.start_time, suggestedTimes.end_time)
        };
        return updated;
      });
    }
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
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
          
          return {
            employee_id: shift.employee_id,
            start_time: createUTCFromNorwegianTime(dateStr, shift.start_time),
            end_time: createUTCFromNorwegianTime(dateStr, shift.end_time),
            location: null,
            notes: null,
            auto_punch_in: shift.auto_punch_in
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
      queryClient.invalidateQueries({ queryKey: ['schedule-shifts', format(currentMonth, 'yyyy-MM')] });

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

      queryClient.invalidateQueries({ queryKey: ['schedule-shifts', format(currentMonth, 'yyyy-MM')] });

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
      shift.start_time.substring(0, 10) === dateStr
    ) || [];
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Tilgang nektet</CardTitle>
            <CardDescription>
              Du har ikke tillatelse til å få tilgang til vaktlisten.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Group days by weeks for calendar grid
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Vaktliste</h1>
          <p className="text-muted-foreground">Administrer vakter för {format(currentMonth, 'MMMM yyyy', { locale: nb })}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium min-w-[140px] justify-center">
              <Calendar className="w-4 h-4" />
              {format(currentMonth, 'MMMM yyyy', { locale: nb })}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {week.map((day) => {
                  const dayShifts = getShiftsForDate(day);
                  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const isCurrentMonth = format(day, 'MM') === format(currentMonth, 'MM');
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`border rounded-lg p-2 min-h-[120px] cursor-pointer hover:bg-accent/50 transition-colors ${
                        isToday ? 'border-primary bg-primary/5' : 'border-border'
                      } ${
                        !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
                      }`}
                      onClick={() => handleCreateShift(day)}
                    >
                      <div className="mb-2">
                        <div className="font-medium text-xs text-muted-foreground">
                          {format(day, 'EEE', { locale: nb })}
                        </div>
                        <div className={`text-lg font-semibold ${
                          isToday ? 'text-primary' : isCurrentMonth ? '' : 'text-muted-foreground'
                        }`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        {dayShifts.map((shift) => (
                          <div 
                            key={shift.id} 
                            className="bg-primary/10 border border-primary/20 rounded p-1 text-xs hover:bg-primary/15 transition-colors group"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium text-xs truncate">
                                {shift.profiles?.first_name} {shift.profiles?.last_name}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteShift(shift.id);
                                }}
                                className="h-4 w-4 p-0 text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-2 h-2" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-2 h-2" />
                              <span className="text-xs">
                                {formatTimeNorway(shift.start_time)} - {formatTimeNorway(shift.end_time)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Shifts Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
          <DialogTitle>Legg til vakter</DialogTitle>
          <DialogDescription>
            Legg til vakter for {selectedDate && format(selectedDate, 'EEEE d MMMM', { locale: nb })}.
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
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`auto-punch-${index}`}
                          checked={shift.auto_punch_in}
                          onChange={(e) => updateEmployeeShift(index, 'auto_punch_in', e.target.checked.toString())}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor={`auto-punch-${index}`} className="text-sm font-normal cursor-pointer">
                          Automatisk punch-in
                        </Label>
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