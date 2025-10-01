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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {employees?.map((employee) => (
        <Card
          key={employee.id}
          className="cursor-pointer hover:bg-accent hover:border-primary transition-all"
          onClick={() => onSelectEmployee(employee.email, getFullName(employee.first_name, employee.last_name))}
        >
          <CardContent className="flex flex-col items-center justify-center p-6 space-y-3">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(employee.first_name, employee.last_name)}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium text-center">
              {getFullName(employee.first_name, employee.last_name)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
