import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResponsiveWrapperProps {
  children: ReactNode;
  className?: string;
  mobileClassName?: string;
  desktopClassName?: string;
}

export function ResponsiveWrapper({ 
  children, 
  className, 
  mobileClassName, 
  desktopClassName 
}: ResponsiveWrapperProps) {
  const isMobile = useIsMobile();
  
  const finalClassName = cn(
    className,
    isMobile ? mobileClassName : desktopClassName
  );

  return (
    <div className={finalClassName}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  mobileCols?: number;
  tabletCols?: number;
  desktopCols?: number;
}

export function ResponsiveGrid({ 
  children, 
  className, 
  mobileCols = 1, 
  tabletCols = 2, 
  desktopCols = 3 
}: ResponsiveGridProps) {
  const gridClasses = cn(
    'grid gap-4',
    `grid-cols-${mobileCols}`,
    `md:grid-cols-${tabletCols}`,
    `lg:grid-cols-${desktopCols}`,
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
}