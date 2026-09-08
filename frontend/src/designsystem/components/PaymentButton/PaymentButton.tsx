export type PaymentProvider = 'venmo' | 'cashapp';

export interface PaymentButtonProps {
  /** Which service to brand the button as. */
  provider: PaymentProvider;
  /** The deeplink to open. When null the button is not rendered at all. */
  href: string | null;
  /** Optional amount label, e.g. "$20.00", appended after the provider name. */
  amountLabel?: string | null;
  /** Visual scale. `sm` suits a banner row; `md` suits the settings panel. */
  size?: 'sm' | 'md';
}

/**
 * A branded deeplink button for a single payment service.
 *
 * Brand colors are hard-coded rather than tokenized on purpose: Venmo blue and
 * Cash App green are third-party trademarks, not part of this product's palette,
 * and they must stay constant in light and dark mode so the button remains
 * recognizable as "the Venmo one". Everything else about the button (radius,
 * spacing, font, focus ring) comes from the design system.
 *
 * Both logos are inline SVG. External images are avoided so the button renders
 * with no network request and no layout shift, and so it cannot break if a CDN
 * is unreachable.
 *
 * The link opens in a new tab: on a phone the OS intercepts these universal
 * links and hands them to the installed app, and on desktop the user keeps the
 * pool page they were on.
 */

const BRAND: Record<
  PaymentProvider,
  { label: string; background: string; foreground: string; ring: string }
> = {
  venmo: {
    label: 'Venmo',
    background: '#008CFF',
    foreground: '#FFFFFF',
    ring: 'focus-visible:ring-[#008CFF]',
  },
  cashapp: {
    label: 'Cash App',
    background: '#00D632',
    foreground: '#FFFFFF',
    ring: 'focus-visible:ring-[#00D632]',
  },
};

const SIZE_CLASSES: Record<NonNullable<PaymentButtonProps['size']>, string> = {
  sm: 'px-sm py-xxxs text-sm h-9 gap-xxs',
  md: 'px-md py-xs text-base h-10 gap-xs',
};

const ICON_SIZE: Record<NonNullable<PaymentButtonProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

/** Venmo's mark: the stylized "V" reversed out of the brand-blue tile. */
function VenmoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="5" fill="#FFFFFF" />
      <path
        d="M17.3 5.4c.43.71.62 1.44.62 2.36 0 2.94-2.5 6.75-4.53 9.43H8.75L6.9 6.13l4.05-.39.98 7.9c.92-1.5 2.05-3.85 2.05-5.45 0-.88-.15-1.47-.39-1.96l3.71-.83Z"
        fill="#008CFF"
      />
    </svg>
  );
}

/** Cash App's mark: the "$" reversed out of the brand-green tile. */
function CashAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="6" fill="#FFFFFF" />
      <path
        d="M13.05 4.5a.6.6 0 0 1 .59.7l-.23 1.2c.79.22 1.5.6 2.06 1.1a.6.6 0 0 1 .03.86l-1.2 1.2a.6.6 0 0 1-.82.02 3.2 3.2 0 0 0-2.1-.77c-.78 0-1.32.32-1.32.83 0 .55.6.75 1.83 1.16 1.72.55 3.16 1.25 3.16 3.06 0 1.7-1.25 2.83-3.06 3.15l-.22 1.19a.6.6 0 0 1-.59.5h-1.4a.6.6 0 0 1-.59-.71l.23-1.22a5.2 5.2 0 0 1-2.35-1.28.6.6 0 0 1 0-.85l1.24-1.2a.6.6 0 0 1 .82-.01c.63.55 1.45.87 2.32.87.93 0 1.5-.36 1.5-.9 0-.55-.5-.74-1.9-1.22-1.5-.5-3.02-1.2-3.02-3.03 0-1.72 1.28-2.8 2.94-3.11l.23-1.24a.6.6 0 0 1 .59-.5h1.26Z"
        fill="#00D632"
      />
    </svg>
  );
}

const MARK: Record<PaymentProvider, typeof VenmoMark> = {
  venmo: VenmoMark,
  cashapp: CashAppMark,
};

export default function PaymentButton({
  provider,
  href,
  amountLabel,
  size = 'md',
}: PaymentButtonProps) {
  // A null href means the admin has not configured this service. Rendering a
  // disabled button would imply the option exists but is broken; rendering
  // nothing correctly says "this group does not take Venmo".
  if (!href) return null;

  const brand = BRAND[provider];
  const Mark = MARK[provider];
  const label = amountLabel ? `Pay ${amountLabel} with ${brand.label}` : `Pay with ${brand.label}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{ backgroundColor: brand.background, color: brand.foreground }}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap rounded-pill font-medium',
        'shadow-sm transition-all duration-normal ease-smooth',
        'hover:brightness-95 hover:shadow-base active:translate-y-px',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        SIZE_CLASSES[size],
        brand.ring,
      ].join(' ')}
    >
      <Mark className={ICON_SIZE[size]} />
      <span>{brand.label}</span>
    </a>
  );
}
