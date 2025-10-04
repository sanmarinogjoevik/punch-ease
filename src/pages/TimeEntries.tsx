import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDuration, calculateDurationMinutes, formatTimeNorway } from '@/lib/timeUtils';

interface TimeEntry {
  id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  employee_id: string;
  employee_name?: string;
}

interface WorkSession {
  id: string;
  punch_in: TimeEntry;
  punch_out?: TimeEntry;
  duration?: number; // in minutes
  employee_name?: string;
}

export default function TimeEntries() {
  const { user, userRole } = useAuth();
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchTimeEntries();
  }, [user, userRole]);

  const fetchTimeEntries = async () => {
    if (!user) return;

    try {
      // First, fetch time entries
      let query = supabase
        .from('time_entries')
        .select('*')
        .order('timestamp', { ascending: false });

      // If not admin, only show user's own entries
      if (userRole !== 'admin') {
        query = query.eq('employee_id', user.id);
      }

      const { data: entriesData, error: entriesError } = await query;

      if (entriesError) {
        console.error('Error fetching time entries:', entriesError);
        return;
      }

      // If admin, fetch profile data for employee names
      let profilesMap = new Map();
      if (userRole === 'admin' && entriesData && entriesData.length > 0) {
        const employeeIds = Array.from(new Set(entriesData.map(entry => entry.employee_id)));
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', employeeIds);

        profilesMap = new Map(
          profilesData?.map(profile => [
            profile.user_id, 
            `${profile.first_name} ${profile.last_name}`
          ]) || []
        );
      }

      // Group entries into work sessions
      const sessions = groupIntoWorkSessions(entriesData || [], profilesMap);
      setWorkSessions(sessions);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupIntoWorkSessions = (entries: TimeEntry[], profilesMap: Map<string, string>): WorkSession[] => {
    const sessions: WorkSession[] = [];
    const entriesByEmployee = new Map<string, TimeEntry[]>();

    // Group entries by employee
    entries.forEach(entry => {
      if (!entriesByEmployee.has(entry.employee_id)) {
        entriesByEmployee.set(entry.employee_id, []);
      }
      entriesByEmployee.get(entry.employee_id)!.push({
        ...entry,
        employee_name: profilesMap.get(entry.employee_id)
      });
    });

    // For each employee, create sessions by pairing punch-ins with punch-outs
    entriesByEmployee.forEach((employeeEntries) => {
      // Sort by timestamp (oldest first)
      const sortedEntries = [...employeeEntries].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let i = 0;
      while (i < sortedEntries.length) {
        const entry = sortedEntries[i];
        
        if (entry.entry_type === 'punch_in') {
          // Find the next punch_out after this punch_in
          let nextPunchOut: TimeEntry | undefined;
          let nextPunchOutIndex = -1;
          
          for (let j = i + 1; j < sortedEntries.length; j++) {
            if (sortedEntries[j].entry_type === 'punch_out') {
              nextPunchOut = sortedEntries[j];
              nextPunchOutIndex = j;
              break;
            }
          }
          
          // Create session
          const duration = nextPunchOut 
            ? calculateDurationMinutes(entry.timestamp, nextPunchOut.timestamp)
            : undefined;
          
          sessions.push({
            id: entry.id,
            punch_in: entry,
            punch_out: nextPunchOut,
            duration,
            employee_name: entry.employee_name
          });
          
          // Skip to after the punch_out if found, otherwise just move to next entry
          i = nextPunchOutIndex !== -1 ? nextPunchOutIndex + 1 : i + 1;
        } else {
          // Skip standalone punch_outs
          i++;
        }
      }
    });

    // Sort sessions by punch_in timestamp (newest first)
    return sessions.sort((a, b) => 
      new Date(b.punch_in.timestamp).getTime() - new Date(a.punch_in.timestamp).getTime()
    );
  };

  const getSessionBadge = (session: WorkSession) => {
    if (!session.punch_out) {
      return (
        <Badge variant="outline" className="border-yellow-200 text-yellow-700 bg-yellow-50">
          Aktiv
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
        Fullført
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
          {userRole === 'admin' ? 'Alle Arbeidsvakter' : 'Mine Arbeidsvakter'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? 'text-lg' : ''}>Arbeidsøkt Historikk</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {workSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen arbeidsøkter funnet.
            </div>
          ) : (
            <div className={isMobile ? 'overflow-x-auto' : ''}>
              <ScrollArea className={isMobile ? 'w-full' : ''}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={isMobile ? 'min-w-[100px]' : ''}>Dato</TableHead>
                      <TableHead className={isMobile ? 'min-w-[150px]' : ''}>Tidsperiode</TableHead>
                      <TableHead className={isMobile ? 'min-w-[80px]' : ''}>Varighet</TableHead>
                      <TableHead className={isMobile ? 'min-w-[80px]' : ''}>Status</TableHead>
                      {userRole === 'admin' && <TableHead className={isMobile ? 'min-w-[120px]' : ''}>Ansatt</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {format(new Date(session.punch_in.timestamp), isMobile ? 'dd/MM' : 'dd MMM yyyy', { locale: nb })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 ${isMobile ? 'flex-col items-start gap-1' : ''}`}>
                            <div className="flex items-center gap-1">
                              <ArrowUp className="h-3 w-3 text-green-600" />
                              <span className="text-xs">
                                {formatTimeNorway(session.punch_in.timestamp)}
                              </span>
                            </div>
                            {session.punch_out && (
                              <div className="flex items-center gap-1">
                                {!isMobile && <span className="text-muted-foreground">→</span>}
                                <ArrowDown className="h-3 w-3 text-red-600" />
                                <span className="text-xs">
                                  {formatTimeNorway(session.punch_out.timestamp)}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {session.duration !== undefined ? (
                              formatDuration(session.duration)
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getSessionBadge(session)}
                        </TableCell>
                        {userRole === 'admin' && (
                          <TableCell className="text-sm">
                            {session.employee_name || 'Ukjent ansatt'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}