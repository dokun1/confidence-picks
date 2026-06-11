export type PageWidth = 'narrow' | 'medium' | 'wide';

export interface PageContainerProps {
  /** Content width tier: narrow (forms/auth), medium (reading), wide (data). */
  width?: PageWidth;
  className?: string;
  children: React.ReactNode;
}

const MAX_WIDTH_CLASSES: Record<PageWidth, string> = {
  narrow: 'max-w-2xl',
  medium: 'max-w-4xl',
  wide: 'max-w-6xl',
};

/**
 * Centers page content at a consistent width tier. Horizontal gutters and
 * vertical rhythm are owned by Layout's <main>, so this only constrains and
 * centers — replacing the ad-hoc `max-w-Xxl mx-auto px-* py-*` repeated on
 * every page.
 */
export default function PageContainer({
  width = 'wide',
  className = '',
  children,
}: PageContainerProps) {
  return (
    <div className={`mx-auto w-full ${MAX_WIDTH_CLASSES[width]} ${className}`.trim()}>
      {children}
    </div>
  );
}
