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

export default function TimeEntries() {
  const { user, userRole } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
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
      if (userRole === 'admin' && entriesData && entriesData.length > 0) {
        const employeeIds = Array.from(new Set(entriesData.map(entry => entry.employee_id)));
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', employeeIds);

        const profilesMap = new Map(
          profilesData?.map(profile => [
            profile.user_id, 
            `${profile.first_name} ${profile.last_name}`
          ]) || []
        );

        const enrichedEntries = entriesData.map(entry => ({
          ...entry,
          employee_name: profilesMap.get(entry.employee_id) || 'Unknown Employee'
        }));

        setTimeEntries(enrichedEntries);
      } else {
        setTimeEntries(entriesData || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEntryIcon = (type: 'punch_in' | 'punch_out') => {
    return type === 'punch_in' ? (
      <ArrowUp className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-red-600" />
    );
  };

  const getEntryBadge = (type: 'punch_in' | 'punch_out') => {
    return type === 'punch_in' ? (
      <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
        Punch In
      </Badge>
    ) : (
      <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
        Punch Out
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
          {userRole === 'admin' ? 'All Time Entries' : 'My Time Entries'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Punch In/Out History</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No time entries found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  {userRole === 'admin' && <TableHead>Employee</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEntryIcon(entry.entry_type)}
                        <div>
                          <div className="font-medium">
                            {format(new Date(entry.timestamp), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(entry.timestamp), 'HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getEntryBadge(entry.entry_type)}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        {entry.employee_name || 'Unknown Employee'}
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