import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { extractDate, extractTime } from "@/lib/timeUtils";

interface ShiftWithEmployee {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  auto_punch_in: boolean;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface EditShiftDialogProps {
  shift: ShiftWithEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (shiftId: string, data: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
    notes: string;
    autoPunchIn: boolean;
  }) => void;
}

export function EditShiftDialog({ shift, open, onOpenChange, onSave }: EditShiftDialogProps) {
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [autoPunchIn, setAutoPunchIn] = useState(true);

  useEffect(() => {
    if (shift) {
      setStartDate(extractDate(shift.start_time));
      setStartTime(extractTime(shift.start_time));
      setEndDate(extractDate(shift.end_time));
      setEndTime(extractTime(shift.end_time));
      setLocation(shift.location || "");
      setNotes(shift.notes || "");
      setAutoPunchIn(shift.auto_punch_in);
    }
  }, [shift]);

  const handleSave = () => {
    if (!shift) return;
    
    onSave(shift.id, {
      startDate,
      startTime,
      endDate,
      endTime,
      location,
      notes,
      autoPunchIn,
    });
  };

  if (!shift) return null;

  const employeeName = shift.profiles
    ? `${shift.profiles.first_name || ""} ${shift.profiles.last_name || ""}`.trim()
    : "Ukjent ansatt";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Endre vakt - {employeeName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdato</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Starttid</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">Sluttdato</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Sluttid</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Plats (valgfritt)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="F.eks. Kontoret, Byggeplass A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Anteckninger (valgfritt)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eventuelle notater om vakten"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="autoPunchIn">Automatisk instämpling</Label>
            <Switch
              id="autoPunchIn"
              checked={autoPunchIn}
              onCheckedChange={setAutoPunchIn}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSave}>
              Spara ändringar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
