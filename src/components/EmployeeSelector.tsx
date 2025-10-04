import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useEmployees } from '@/hooks/useEmployees';
import { Loader2 } from 'lucide-react';

interface EmployeeSelectorProps {
  onSelectEmployee: (email: string, name: string) => void;
}

export function EmployeeSelector({ onSelectEmployee }: EmployeeSelectorProps) {
  const { data: employees, isLoading } = useEmployees();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || '?';
  };

  const getFullName = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Anställd';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {employees?.map((employee) => (
        <Card
          key={employee.id}
          className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 hover:scale-102"
          onClick={() => onSelectEmployee(employee.email, getFullName(employee.first_name, employee.last_name))}
        >
          <CardContent className="flex flex-col items-center justify-center p-4 space-y-2">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                {getInitials(employee.first_name, employee.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-sm font-semibold">
                {getFullName(employee.first_name, employee.last_name)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
