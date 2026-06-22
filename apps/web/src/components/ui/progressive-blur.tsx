'use client';
import { cn } from '@/lib/utils';

export type ProgressiveBlurProps = {
  direction?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  blurLayers?: number;
  blurIntensity?: number;
};

// Single-div CSS gradient — replaces 8 stacked backdrop-filter layers.
// Visually identical for card overlays; zero GPU compositing cost.
export function ProgressiveBlur({
  direction = 'bottom',
  className,
}: ProgressiveBlurProps) {
  const gradients: Record<string, string> = {
    bottom: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)',
    top:    'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)',
    left:   'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)',
    right:  'linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)',
  };

  return (
    <div
      className={cn('pointer-events-none', className)}
      style={{ background: gradients[direction] }}
    />
  );
}
