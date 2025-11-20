import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEmployeeMonthShifts } from '@/hooks/useShifts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import TimelistTable from '@/components/TimelistTable';

export default function Timeliste() {
  const { user } = useAuth();
  const { data: userProfile } = useCurrentUserProfile();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [displayMode, setDisplayMode] = useState<'actual' | 'schedule'>('actual');
  
  const { data: shifts = [], isLoading: shiftsLoading } = useEmployeeMonthShifts(
    user?.id || '',
    selectedMonth
  );
  
  const { data: companySettings, isLoading: settingsLoading } = useCompanySettings();

  const isLoading = shiftsLoading || settingsLoading;

  const handlePreviousMonth = () => {
    const currentDate = new Date(selectedMonth + '-01');
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setSelectedMonth(format(previousMonth, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const currentDate = new Date(selectedMonth + '-01');
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setSelectedMonth(format(nextMonth, 'yyyy-MM'));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Laddar timelista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Min Timelista</h1>
        <p className="text-muted-foreground">
          {userProfile?.first_name} {userProfile?.last_name}
        </p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xl font-semibold min-w-[180px] text-center">
          {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: nb })}
        </div>
        <Button variant="outline" size="sm" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Display Mode Selector */}
      <div className="flex justify-center gap-2 mb-4">
        <Button
          variant={displayMode === 'actual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDisplayMode('actual')}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Verkliga tider
        </Button>
        <Button
          variant={displayMode === 'schedule' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDisplayMode('schedule')}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Endast schema
        </Button>
      </div>

      {/* Timelist Table */}
      {user && (
        <TimelistTable
          selectedMonth={selectedMonth}
          employeeId={user.id}
          companySettings={companySettings}
          shifts={shifts}
          showActions={false}
          displayMode={displayMode}
        />
      )}
    </div>
  );
}
