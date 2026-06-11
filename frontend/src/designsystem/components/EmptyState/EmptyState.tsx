export interface EmptyStateProps {
  /** Optional icon, shown in an accent-tinted circle above the title. */
  icon?: React.ReactNode;
  /** Headline describing the empty condition. */
  title: React.ReactNode;
  /** Optional supporting copy. */
  description?: React.ReactNode;
  /** Optional call-to-action (e.g. a Button) shown below the copy. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Centered empty-state block: optional iconographic badge, a title, optional
 * description, and an optional action. Replaces bare `<p>No items yet</p>`
 * placeholders so empty screens (new groups, weeks with no games) feel
 * intentional rather than unfinished.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-md py-xl text-center ${className}`.trim()}
    >
      {icon && (
        <div className="mb-md flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent-on-subtle">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-lg font-semibold text-content">{title}</h3>
      {description && (
        <p className="mt-xxs max-w-sm text-content-muted">{description}</p>
      )}
      {action && <div className="mt-lg">{action}</div>}
    </div>
  );
}
