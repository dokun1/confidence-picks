export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardElement = 'div' | 'section' | 'article';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Underlying element. Use `section`/`article` for semantic grouping. */
  as?: CardElement;
  /** Interior padding. Defaults to `lg` (24px). Use `none` to pad manually. */
  padding?: CardPadding;
  children?: React.ReactNode;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-sm',
  md: 'p-md',
  lg: 'p-lg',
};

const BASE_CLASSES =
  'bg-neutral-0 dark:bg-secondary-800 border border-border rounded-xl shadow-sm';

/**
 * Surface container with the standard border + elevation. Replaces the
 * `bg-neutral-0 dark:bg-secondary-800 border border-border rounded-xl shadow-sm`
 * combo that was hand-written inline across pages, so card styling lives in
 * one place and tracks the active theme automatically.
 */
export default function Card({
  as: Tag = 'div',
  padding = 'lg',
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <Tag className={`${BASE_CLASSES} ${PADDING_CLASSES[padding]} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
