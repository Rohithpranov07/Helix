import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type HTMLAttributes, createContext, useContext } from 'react';

type BadgeContextType = {
  themed: boolean;
};

const BadgeContext = createContext<BadgeContextType>({
  themed: false,
});

const useBadgeContext = () => {
  const context = useContext(BadgeContext);

  if (!context) {
    throw new Error('useBadgeContext must be used within a Badge');
  }

  return context;
};

export type AnnouncementProps = BadgeProps & {
  themed?: boolean;
};

export const Announcement = ({
  variant = 'outline',
  themed = false,
  className,
  ...props
}: AnnouncementProps) => (
  <BadgeContext.Provider value={{ themed }}>
    <Badge
      variant={variant}
      className={cn(
        // Industrial / tactical-telemetry badge — flat solid surface, hard edges,
        // no blur/translucency, no shadow. Inverts on hover like a terminal cursor.
        'group max-w-full items-stretch gap-0 rounded-none border-2 bg-background p-0',
        'font-mono text-[10px] font-bold uppercase tracking-[0.14em] shadow-none transition-colors duration-100',
        'hover:bg-foreground',
        themed && 'border-foreground',
        className
      )}
      {...props}
    />
  </BadgeContext.Provider>
);

export type AnnouncementTagProps = HTMLAttributes<HTMLDivElement>;

export const AnnouncementTag = ({
  className,
  ...props
}: AnnouncementTagProps) => {
  const { themed } = useBadgeContext();

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center truncate border-r-2 border-foreground bg-foreground px-2.5 py-1.5 text-background',
        themed && 'bg-background text-foreground',
        className
      )}
      {...props}
    />
  );
};

export type AnnouncementTitleProps = HTMLAttributes<HTMLDivElement>;

export const AnnouncementTitle = ({
  className,
  ...props
}: AnnouncementTitleProps) => (
  <div
    className={cn(
      'flex items-center gap-1.5 truncate px-2.5 py-1.5',
      "before:content-['['] before:opacity-50",
      "after:content-[']'] after:opacity-50",
      className
    )}
    {...props}
  />
);
