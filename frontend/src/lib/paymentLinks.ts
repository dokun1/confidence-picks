/**
 * Builders for Venmo and Cash App payment deeplinks.
 *
 * Both services are addressed through their *universal* https links rather than
 * custom URL schemes (`venmo://paycharge?...`). Universal links degrade
 * correctly on their own: on a phone with the app installed the OS hands the
 * URL to the app with the payment prefilled; everywhere else the user lands on
 * the service's web page. A custom scheme cannot be feature-detected -- there is
 * no way to ask "is Venmo installed?" from a web page -- so a scheme link on a
 * device without the app produces a dead tap. Venmo has also broken its custom
 * scheme in the past. Universal links only.
 *
 * The two services do NOT accept the same shape, and the difference is visible
 * to users, so it is encoded here once rather than at each call site:
 *
 *   Venmo     https://venmo.com/<handle>?txn=pay&amount=20.00&note=Fall+dues
 *   Cash App  https://cash.app/$<cashtag>/20.00
 *
 * Cash App takes the amount as a PATH segment and supports no note/memo
 * parameter at all. That is a Cash App limitation, not an omission here.
 *
 * Every builder returns `null` rather than a partial URL when it lacks a handle
 * or an amount, so a caller can render nothing instead of an inert button.
 */

/** The fields an admin can configure for collecting dues. */
export interface PaymentMethods {
  venmoHandle?: string | null;
  cashappHandle?: string | null;
  instructions?: string | null;
}

/**
 * Strip the sigil users habitually paste along with their handle (`@dana` on
 * Venmo, `$dana` on Cash App) and trim whitespace. Returns null for anything
 * blank so "unset" is a single representable value.
 *
 * Only one leading sigil is removed: `@@dana` is a typo we surface rather than
 * silently repair into a handle the user did not type.
 */
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim().replace(/^[@$]/, '').trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Integer cents -> display string, e.g. 2000 -> "$20.00". */
export function formatCents(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Cents -> the plain decimal string both services expect in a URL ("20.00").
 * Deliberately not `formatCents`: neither service accepts a `$` or a thousands
 * separator in the amount.
 */
function centsToUrlAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Venmo web deeplink. `note` prefills the payment memo; spaces become `+` per
 * Venmo's documented format, and everything else is percent-encoded.
 */
export function buildVenmoLink(
  handle: string | null | undefined,
  amountCents: number | null | undefined,
  note?: string | null,
): string | null {
  const user = normalizeHandle(handle);
  if (!user || amountCents === null || amountCents === undefined) return null;

  const params = [`txn=pay`, `amount=${centsToUrlAmount(amountCents)}`];
  if (note && note.trim().length > 0) {
    // encodeURIComponent renders a space as %20; Venmo's documented format uses
    // `+`. Both work, but `+` keeps the URL legible if a user inspects it.
    params.push(`note=${encodeURIComponent(note.trim()).replace(/%20/g, '+')}`);
  }

  return `https://venmo.com/${encodeURIComponent(user)}?${params.join('&')}`;
}

/**
 * Cash App payment link. The amount is a path segment; there is no note
 * parameter, so any memo has to live in the group's instructions text instead.
 */
export function buildCashAppLink(
  cashtag: string | null | undefined,
  amountCents: number | null | undefined,
): string | null {
  const tag = normalizeHandle(cashtag);
  if (!tag || amountCents === null || amountCents === undefined) return null;

  return `https://cash.app/$${encodeURIComponent(tag)}/${centsToUrlAmount(amountCents)}`;
}

/**
 * Whether the admin has configured any way at all to pay. Used to decide
 * whether the banner offers payment actions or only points at the settings tab.
 */
export function hasAnyPaymentMethod(methods: PaymentMethods): boolean {
  return Boolean(
    normalizeHandle(methods.venmoHandle) ||
      normalizeHandle(methods.cashappHandle) ||
      (methods.instructions && methods.instructions.trim().length > 0),
  );
}
