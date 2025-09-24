import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Clock, ArrowUp, ArrowDown } from 'lucide-react';

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

    // For each employee, pair punch-in and punch-out entries
    entriesByEmployee.forEach((employeeEntries, employeeId) => {
      // Sort by timestamp (oldest first for pairing)
      const sortedEntries = employeeEntries.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let i = 0;
      while (i < sortedEntries.length) {
        const entry = sortedEntries[i];
        
        if (entry.entry_type === 'punch_in') {
          // Look for matching punch_out
          let punchOut: TimeEntry | undefined;
          let j = i + 1;
          
          while (j < sortedEntries.length) {
            if (sortedEntries[j].entry_type === 'punch_out' && 
                sortedEntries[j].employee_id === entry.employee_id) {
              punchOut = sortedEntries[j];
              sortedEntries.splice(j, 1); // Remove the punch_out from array
              break;
            }
            j++;
          }

          // Calculate duration if we have both punch in and out
          let duration: number | undefined;
          if (punchOut) {
            const startTime = new Date(entry.timestamp);
            const endTime = new Date(punchOut.timestamp);
            duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
          }

          sessions.push({
            id: entry.id,
            punch_in: entry,
            punch_out: punchOut,
            duration,
            employee_name: entry.employee_name
          });
        }
        i++;
      }
    });

    // Sort sessions by punch_in timestamp (newest first)
    return sessions.sort((a, b) => 
      new Date(b.punch_in.timestamp).getTime() - new Date(a.punch_in.timestamp).getTime()
    );
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getSessionBadge = (session: WorkSession) => {
    if (!session.punch_out) {
      return (
        <Badge variant="outline" className="border-yellow-200 text-yellow-700 bg-yellow-50">
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
        Completed
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">
          {userRole === 'admin' ? 'All Work Sessions' : 'My Work Sessions'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work Session History</CardTitle>
        </CardHeader>
        <CardContent>
          {workSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No work sessions found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time Period</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  {userRole === 'admin' && <TableHead>Employee</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {workSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(session.punch_in.timestamp), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm">
                          {format(new Date(session.punch_in.timestamp), 'HH:mm:ss')}
                        </span>
                        {session.punch_out && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <ArrowDown className="h-4 w-4 text-red-600" />
                            <span className="text-sm">
                              {format(new Date(session.punch_out.timestamp), 'HH:mm:ss')}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
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
                      <TableCell>
                        {session.employee_name || 'Unknown Employee'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}