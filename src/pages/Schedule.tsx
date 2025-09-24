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
  const [shiftForm, setShiftForm] = useState({
    employee_id: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    notes: ''
  });
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

  const handleCreateShift = (date: Date) => {
    setSelectedDate(date);
    setShiftForm({
      employee_id: '',
      date: format(date, 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '17:00',
      location: '',
      notes: ''
    });
    setShowCreateDialog(true);
  };

  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const startDateTime = new Date(`${shiftForm.date}T${shiftForm.start_time}:00`);
      const endDateTime = new Date(`${shiftForm.date}T${shiftForm.end_time}:00`);

      const { error } = await supabase
        .from('shifts')
        .insert({
          employee_id: shiftForm.employee_id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          location: shiftForm.location || null,
          notes: shiftForm.notes || null
        });

      if (error) throw error;

      toast({
        title: "Framgång",
        description: "Pass har skapats framgångsrikt",
      });

      setShowCreateDialog(false);
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

      {/* Create Shift Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Skapa nytt pass</DialogTitle>
            <DialogDescription>
              Lägg till ett nytt pass för {selectedDate && format(selectedDate, 'EEEE d MMMM', { locale: sv })}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitShift}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Anställd</Label>
                <Select value={shiftForm.employee_id} onValueChange={(value) => setShiftForm(prev => ({ ...prev, employee_id: value }))}>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Starttid</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Sluttid</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Plats (valfritt)</Label>
                <Input
                  id="location"
                  value={shiftForm.location}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="t.ex. Lager, Reception, Kök"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Anteckningar (valfritt)</Label>
                <Textarea
                  id="notes"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Extra information om passet"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !shiftForm.employee_id}>
                {isSubmitting ? 'Skapar...' : 'Skapa pass'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;