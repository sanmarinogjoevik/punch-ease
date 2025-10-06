import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";

export const ForceAllPunchOutButton = () => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUserProfile } = useCurrentUserProfile();

  const handleForceAllPunchOut = async () => {
    if (!currentUserProfile?.company_id) {
      toast({
        title: "Fel",
        description: "Kunde inte hitta ditt företags-ID",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Hämta dagens start
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Hämta alla time_entries för idag
      const { data: timeEntries, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('employee_id, entry_type, timestamp')
        .eq('company_id', currentUserProfile.company_id)
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false });

      if (timeEntriesError) throw timeEntriesError;

      if (!timeEntries || timeEntries.length === 0) {
        toast({
          title: "Ingen att puncha ut",
          description: "Inga anställda är för närvarande inpunchade.",
        });
        setIsProcessing(false);
        return;
      }

      // Hitta alla som är inpunchade (senaste entry är punch_in)
      const employeeLatestEntries = new Map();
      timeEntries.forEach(entry => {
        if (!employeeLatestEntries.has(entry.employee_id)) {
          employeeLatestEntries.set(entry.employee_id, entry);
        }
      });

      const punchedInEmployeeIds: string[] = [];
      employeeLatestEntries.forEach((entry, employeeId) => {
        if (entry.entry_type === 'punch_in') {
          punchedInEmployeeIds.push(employeeId);
        }
      });

      if (punchedInEmployeeIds.length === 0) {
        toast({
          title: "Ingen att puncha ut",
          description: "Inga anställda är för närvarande inpunchade.",
        });
        setIsProcessing(false);
        return;
      }

      // Puncha ut alla
      const now = new Date().toISOString();
      const punchOutPromises = punchedInEmployeeIds.map(employeeId => 
        supabase
          .from('time_entries')
          .insert({
            employee_id: employeeId,
            company_id: currentUserProfile.company_id,
            entry_type: 'punch_out',
            timestamp: now,
            is_automatic: false, // Manuell admin-åtgärd
          })
      );

      await Promise.all(punchOutPromises);

      toast({
        title: "Alla utpunchade",
        description: `${punchedInEmployeeIds.length} anställda har punchats ut.`,
      });

      // Uppdatera alla relaterade queries
      queryClient.invalidateQueries({ queryKey: ['punched-in-employees'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });

    } catch (error) {
      console.error('Error force punching out all employees:', error);
      toast({
        title: "Fel",
        description: "Kunde inte puncha ut anställda. Se konsolen för detaljer.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isProcessing}
        className="border-orange-500 text-orange-700 hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Puncha ut alla
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Puncha ut alla anställda?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kommer att puncha ut alla anställda som för närvarande är inpunchade.
              <br />
              <br />
              Detta kan inte ångras. Är du säker?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceAllPunchOut}
              disabled={isProcessing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isProcessing ? "Punckar ut..." : "Ja, puncha ut alla"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
