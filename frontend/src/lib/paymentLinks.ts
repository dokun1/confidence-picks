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

/** How a group collects dues. Exactly one per group. */
export type DuesPaymentMethod = 'venmo' | 'cashapp' | 'other';

/** The fields an admin can configure for collecting dues. */
export interface PaymentMethods {
  /** Which of the three is live. Null means the admin has not chosen yet. */
  method?: DuesPaymentMethod | null;
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
 * Reduce a memo to characters that survive any encoder: letters, digits and
 * hyphens. Spaces become hyphens; everything else is dropped.
 *
 * This exists because of how Venmo actually delivers a note to its app.
 * venmo.com is NOT treated as a universal link that iOS hands straight to the
 * app -- verified on device from Safari itself, which loaded the page and
 * prompted "Open in Venmo?" rather than intercepting. So the page's own
 * JavaScript builds the `venmo://paycharge?...` handoff, using a
 * form-urlencoder that writes spaces as `+`; the Venmo app then displays that
 * memo without form-decoding it, and the user reads "Fall+2026+dues".
 *
 * That bridge is the normal path, not an edge case, and percent-encoding
 * cannot survive it: %20 arrives re-encoded as `+` just the same. So the note
 * is made encoding-proof instead of encoded correctly -- a string that needs no
 * escaping cannot be re-escaped wrongly. "Fall 2026 dues" -> "Fall-2026-dues".
 * Verified rendering cleanly in the Venmo app, 2026-09-07.
 */
export function sanitizeNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-') // any run of other chars -> one hyphen
    .replace(/^-+|-+$/g, '');       // no leading/trailing hyphens
  return cleaned.length === 0 ? null : cleaned;
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
  // sanitizeNote guarantees the memo needs no percent-encoding, which is the
  // only way to survive Venmo's in-app-browser handoff intact. See its docstring.
  const safeNote = sanitizeNote(note);
  if (safeNote) {
    params.push(`note=${safeNote}`);
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
 * Whether the admin has finished configuring a way to pay: a method chosen AND
 * the value that method needs. Used to decide whether the banner can offer a
 * payment action or should only point at the settings tab.
 */
export function hasAnyPaymentMethod(methods: PaymentMethods): boolean {
  switch (methods.method) {
    case 'venmo':
      return normalizeHandle(methods.venmoHandle) !== null;
    case 'cashapp':
      return normalizeHandle(methods.cashappHandle) !== null;
    case 'other':
      return Boolean(methods.instructions && methods.instructions.trim().length > 0);
    default:
      return false;
  }
}

/**
 * The single deeplink for a group's chosen method, or null when the method is
 * 'other' (free-text instructions have no URL) or is not configured.
 *
 * Callers render at most one payment button; this is the one place that decides
 * which, so the banner and the settings panel can never disagree.
 */
export function buildPaymentLink(
  methods: PaymentMethods,
  amountCents: number | null | undefined,
  note?: string | null,
): string | null {
  switch (methods.method) {
    case 'venmo':
      return buildVenmoLink(methods.venmoHandle, amountCents, note);
    case 'cashapp':
      return buildCashAppLink(methods.cashappHandle, amountCents);
    default:
      // 'other' pays by instructions, which are prose, not a link.
      return null;
  }
}
