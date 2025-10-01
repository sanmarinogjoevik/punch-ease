import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useIsMobile } from '@/hooks/use-mobile';

export function UserProfile() {
  const { data: profile, isLoading } = useCurrentUserProfile();
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
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={profile?.avatar_url || undefined} alt={getFullName(profile?.first_name, profile?.last_name)} />
        <AvatarFallback>{getInitials(profile?.first_name, profile?.last_name)}</AvatarFallback>
      </Avatar>
      {!isMobile && (
        <span className="text-sm font-medium">
          {getFullName(profile?.first_name, profile?.last_name)}
        </span>
      )}
    </div>
  );
}
