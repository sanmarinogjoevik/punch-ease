import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Download, AlertTriangle, Clock, FileText, Users, TrendingUp, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInHours, parseISO } from 'date-fns';
import { nb } from 'date-fns/locale';

interface TimeEntry {
  id: string;
  entry_type: 'punch_in' | 'punch_out';
  timestamp: string;
  employee_id: string;
  profiles: {
    first_name: string;
    last_name: string;
    personal_number: string;
  };
}

interface WorkDay {
  date: string;
  employee_id: string;
  employee_name: string;
  personal_number: string;
  total_hours: number;
  punch_in: string | null;
  punch_out: string | null;
  overtime_hours: number;
  rest_period_hours: number;
  breaks_taken: number;
  compliance_issues: string[];
}

interface OvertimeReport {
  employee_id: string;
  employee_name: string;
  weekly_overtime: number;
  daily_overtime: number;
  compensation_rate: number;
  approval_status: string;
  reason: string;
}

interface ComplianceWarning {
  type: 'max_daily' | 'max_weekly' | 'rest_period' | 'break_violation' | 'overtime_limit';
  employee_id: string;
  employee_name: string;
  date: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [reportType, setReportType] = useState<string>('daily');
  
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [overtimeReports, setOvertimeReports] = useState<OvertimeReport[]>([]);
  const [complianceWarnings, setComplianceWarnings] = useState<ComplianceWarning[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchEmployees();
    generateReports();
  }, [dateRange, selectedEmployee, reportType]);

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

  const generateReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        generateWorkDayReports(),
        generateOvertimeReports(),
        generateComplianceWarnings()
      ]);
    } catch (error) {
      console.error('Error generating reports:', error);
      toast.error('Fel vid generering av rapporter');
    } finally {
      setLoading(false);
    }
  };

  const generateWorkDayReports = async () => {
    try {
      // First get time entries
      const query = supabase
        .from('time_entries')
        .select('*')
        .gte('timestamp', dateRange.from)
        .lte('timestamp', dateRange.to)
        .order('timestamp');

      if (selectedEmployee !== 'all') {
        query.eq('employee_id', selectedEmployee);
      }

      const { data: timeEntries, error } = await query;
      if (error) throw error;

      // Then get profiles separately and join them
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, personal_number');

      if (profilesError) throw profilesError;

      // Join the data manually
      const timeEntriesWithProfiles = (timeEntries || []).map(entry => ({
        ...entry,
        profiles: profiles?.find(p => p.user_id === entry.employee_id) || {
          first_name: 'Okänd',
          last_name: 'Anställd',
          personal_number: ''
        }
      }));

      const processedWorkDays = processTimeEntriesToWorkDays(timeEntriesWithProfiles);
      setWorkDays(processedWorkDays);
    } catch (error) {
      console.error('Error generating work day reports:', error);
    }
  };

  const processTimeEntriesToWorkDays = (entries: TimeEntry[]): WorkDay[] => {
    const workDayMap = new Map<string, WorkDay>();

    entries.forEach(entry => {
      const date = format(parseISO(entry.timestamp), 'yyyy-MM-dd');
      const key = `${entry.employee_id}-${date}`;
      
      if (!workDayMap.has(key)) {
        workDayMap.set(key, {
          date,
          employee_id: entry.employee_id,
          employee_name: `${entry.profiles.first_name} ${entry.profiles.last_name}`,
          personal_number: entry.profiles.personal_number || '',
          total_hours: 0,
          punch_in: null,
          punch_out: null,
          overtime_hours: 0,
          rest_period_hours: 0,
          breaks_taken: 0,
          compliance_issues: []
        });
      }

      const workDay = workDayMap.get(key)!;
      
      if (entry.entry_type === 'punch_in') {
        if (!workDay.punch_in) {
          workDay.punch_in = entry.timestamp;
        }
      } else if (entry.entry_type === 'punch_out') {
        workDay.punch_out = entry.timestamp;
      }
    });

    // Calculate work hours and compliance issues
    workDayMap.forEach(workDay => {
      if (workDay.punch_in && workDay.punch_out) {
        const totalHours = differenceInHours(parseISO(workDay.punch_out), parseISO(workDay.punch_in));
        workDay.total_hours = totalHours;

        // Check for daily overtime (over 9 hours)
        if (totalHours > 9) {
          workDay.overtime_hours = totalHours - 9;
          workDay.compliance_issues.push('Övertid över 9 timmar per dag');
        }

        // Check for excessive daily hours (over 13 hours)
        if (totalHours > 13) {
          workDay.compliance_issues.push('Överskrider maximal arbetstid (13 timmar)');
        }

        // Check for insufficient breaks (should have 30 min break for work over 5.5 hours)
        if (totalHours > 5.5) {
          workDay.compliance_issues.push('Ingen registrerad paus för arbetsdag över 5,5 timmar');
        }
      }
    });

    return Array.from(workDayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  };

  const generateOvertimeReports = async () => {
    // Mock data for now - would be calculated from actual time entries
    const mockOvertimeReports: OvertimeReport[] = workDays
      .filter(day => day.overtime_hours > 0)
      .map(day => ({
        employee_id: day.employee_id,
        employee_name: day.employee_name,
        weekly_overtime: day.overtime_hours,
        daily_overtime: day.overtime_hours,
        compensation_rate: day.overtime_hours <= 2 ? 1.5 : 2.0,
        approval_status: 'Väntar på godkännande',
        reason: 'Hög arbetsbelastning'
      }));

    setOvertimeReports(mockOvertimeReports);
  };

  const generateComplianceWarnings = async () => {
    const warnings: ComplianceWarning[] = [];

    workDays.forEach(workDay => {
      workDay.compliance_issues.forEach(issue => {
        let severity: 'low' | 'medium' | 'high' = 'medium';
        let type: ComplianceWarning['type'] = 'max_daily';

        if (issue.includes('13 timmar')) {
          severity = 'high';
          type = 'max_daily';
        } else if (issue.includes('Övertid')) {
          severity = 'medium';
          type = 'overtime_limit';
        } else if (issue.includes('paus')) {
          severity = 'low';
          type = 'break_violation';
        }

        warnings.push({
          type,
          employee_id: workDay.employee_id,
          employee_name: workDay.employee_name,
          date: workDay.date,
          description: issue,
          severity
        });
      });
    });

    setComplianceWarnings(warnings);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('Ingen data att exportera');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rapporter</h1>
          <p className="text-muted-foreground">Arbetstidsrapporter enligt norsk arbetsmiljölag</p>
        </div>
        <Button onClick={generateReports} disabled={loading}>
          <TrendingUp className="w-4 h-4 mr-2" />
          {loading ? 'Genererar...' : 'Uppdatera rapporter'}
        </Button>
      </div>

      {/* Filterkontroller */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Rapportfilter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Från datum</label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Till datum</label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Anställd</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla anställda</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.user_id} value={employee.user_id}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Rapporttyp</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daglig</SelectItem>
                  <SelectItem value="weekly">Veckovis</SelectItem>
                  <SelectItem value="monthly">Månatlig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="arbetstid" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="arbetstid">Arbetstid</TabsTrigger>
          <TabsTrigger value="overtid">Övertid</TabsTrigger>
          <TabsTrigger value="efterlevnad">Efterlevnad</TabsTrigger>
          <TabsTrigger value="vila">Vila & Pauser</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Arbetstidsrapporter */}
        <TabsContent value="arbetstid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Arbetstidsregistrering
              </CardTitle>
              <CardDescription>
                Grundläggande arbetstidsrapporter enligt arbeidsmiljøloven § 10-6
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workDays.map((workDay, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{workDay.employee_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(workDay.date), 'EEEE d MMMM yyyy', { locale: nb })}
                      </div>
                      <div className="text-sm">
                        {workDay.punch_in && workDay.punch_out && (
                          <>
                            {format(parseISO(workDay.punch_in), 'HH:mm')} - {format(parseISO(workDay.punch_out), 'HH:mm')}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{workDay.total_hours.toFixed(1)}h</div>
                      {workDay.overtime_hours > 0 && (
                        <Badge variant="secondary">+{workDay.overtime_hours.toFixed(1)}h övertid</Badge>
                      )}
                      {workDay.compliance_issues.length > 0 && (
                        <Badge variant="destructive" className="mt-1">
                          {workDay.compliance_issues.length} varning(ar)
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Övertidsrapporter */}
        <TabsContent value="overtid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Övertidsrapporter
              </CardTitle>
              <CardDescription>
                Spårning och dokumentation av övertidsarbete med ersättningsberäkning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overtimeReports.map((report, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{report.employee_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Orsak: {report.reason}
                      </div>
                      <div className="text-sm">
                        Status: {report.approval_status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{report.daily_overtime.toFixed(1)}h övertid</div>
                      <div className="text-sm text-muted-foreground">
                        Ersättning: {(report.compensation_rate * 100)}%
                      </div>
                      <Badge variant="outline">
                        {report.compensation_rate === 1.5 ? 'Första 2h' : 'Över 2h'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Efterlevnadsrapporter */}
        <TabsContent value="efterlevnad" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Regelefterlevnad
              </CardTitle>
              <CardDescription>
                Varningar och överträdelser av arbetsmiljölagens bestämmelser
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceWarnings.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Inga regelöverträdelser upptäckta för vald period.
                    </AlertDescription>
                  </Alert>
                ) : (
                  complianceWarnings.map((warning, index) => (
                    <Alert key={index} className="border-l-4 border-l-orange-500">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{warning.employee_name}</div>
                            <div className="text-sm">{format(parseISO(warning.date), 'EEEE d MMMM yyyy', { locale: nb })}</div>
                            <div className="text-sm mt-1">{warning.description}</div>
                          </div>
                          <Badge variant={getSeverityColor(warning.severity)}>
                            {warning.severity === 'high' ? 'Hög' : warning.severity === 'medium' ? 'Medel' : 'Låg'}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vila och pauser */}
        <TabsContent value="vila" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Vila och Pauser
              </CardTitle>
              <CardDescription>
                Kontroll av vilotider och pausregler enligt arbetsmiljölagens krav
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-4">Daglig vila (11 timmar)</h3>
                  <div className="space-y-2">
                    <Alert>
                      <AlertDescription>
                        Kontroll av att alla anställda har minst 11 timmars sammanhängande vila mellan arbetsdagar.
                      </AlertDescription>
                    </Alert>
                    <div className="text-sm text-muted-foreground">
                      Automatisk kontroll implementeras i nästa version
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-4">Veckovila (35 timmar)</h3>
                  <div className="space-y-2">
                    <Alert>
                      <AlertDescription>
                        Kontroll av att alla anställda har minst 35 timmars sammanhängande vila per vecka.
                      </AlertDescription>
                    </Alert>
                    <div className="text-sm text-muted-foreground">
                      Automatisk kontroll implementeras i nästa version
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export för myndigheter
              </CardTitle>
              <CardDescription>
                Exportera rapporter för Arbeidstilsynet och andra myndigheter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => exportToCSV(workDays, 'arbetstid-rapport')}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Arbetstidsrapport (CSV)
                </Button>
                <Button
                  onClick={() => exportToCSV(overtimeReports, 'overtid-rapport')}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Övertidsrapport (CSV)
                </Button>
                <Button
                  onClick={() => exportToCSV(complianceWarnings, 'efterlevnad-rapport')}
                  className="flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Efterlevnadsrapport (CSV)
                </Button>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Information för myndigheter</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Alla arbetstidsuppgifter sparas i 2 år enligt lag</li>
                  <li>• Rapporter innehåller nödvändig information för Arbeidstilsynet</li>
                  <li>• Personuppgifter hanteras enligt GDPR</li>
                  <li>• Data är tillgänglig för inspektion på begäran</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}