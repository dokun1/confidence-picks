export interface PageHeaderProps {
  /** Primary page title (rendered as the page's h1). */
  title: React.ReactNode;
  /** Optional supporting copy under the title. */
  description?: React.ReactNode;
  /** Optional content above the title (e.g. a back link or breadcrumb). */
  eyebrow?: React.ReactNode;
  /** Optional right-aligned actions (e.g. primary/secondary buttons). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header: optional eyebrow, an h1 title, optional description,
 * and an optional right-aligned actions slot. Stacks on mobile, splits into a
 * title/actions row on desktop. Replaces the bespoke header markup each page
 * re-implemented.
 */
export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-sm md:flex-row md:items-start md:justify-between ${className}`.trim()}
    >
      <div className="space-y-xxs">
        {eyebrow && <div>{eyebrow}</div>}
        <h1 className="font-heading text-2xl font-bold text-content">{title}</h1>
        {description && <p className="text-content-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-sm">{actions}</div>}
    </header>
  );
}
