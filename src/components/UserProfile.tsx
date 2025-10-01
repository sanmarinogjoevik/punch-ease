import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

export function UserProfile() {
  const { data: profile, isLoading } = useCurrentUserProfile();
  const { signOut } = useAuth();
  const isMobile = useIsMobile();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || '?';
  };

  const getFullName = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName || ''} ${lastName || ''}`.trim() || 'Användare';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        {!isMobile && <div className="h-4 w-24 bg-muted animate-pulse rounded" />}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} alt={getFullName(profile?.first_name, profile?.last_name)} />
          <AvatarFallback>{getInitials(profile?.first_name, profile?.last_name)}</AvatarFallback>
        </Avatar>
        {!isMobile && (
          <span className="text-sm font-medium">
            {getFullName(profile?.first_name, profile?.last_name)}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Logga ut
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
