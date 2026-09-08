import Banner from '../Banner';
import PaymentButton from '../PaymentButton';
import { buildPaymentLink, formatCents } from '../../../lib/paymentLinks';
import type { DuesPaymentMethod } from '../../../lib/paymentLinks';

export interface DuesBannerProps {
  /** What the viewer owes, in integer cents. Null renders nothing. */
  amountCents: number | null;
  /** Display name of the member collecting dues, when one is set. */
  collectorName: string | null;
  /** The group's single payment method. Drives which button (if any) renders. */
  paymentMethod: DuesPaymentMethod | null;
  venmoHandle: string | null;
  cashappHandle: string | null;
  /** Free-text instructions, used when the method is 'other'. */
  instructions: string | null;
  /** Navigate to the group's dues detail — settings tab. */
  onViewDetails: () => void;
  /** Group name, used in the payment memo so the payer's Venmo feed reads well. */
  groupName?: string;
}

/**
 * The "you owe dues" notice shown at the top of a group page, mirroring the
 * picks-due banner's placement and warning tone.
 *
 * A group collects dues exactly one way, so at most ONE payment button renders.
 * When the method is 'other' the payment is prose (Zelle, cash, check) with no
 * URL to link to, and the banner sends the member to the details instead — the
 * instructions are too long to inline without pushing the tab bar off a phone.
 *
 * "Details" is always present, because a member needs somewhere to see what
 * they owe and who else has paid regardless of how payment happens.
 */
export default function DuesBanner({
  amountCents,
  collectorName,
  paymentMethod,
  venmoHandle,
  cashappHandle,
  instructions,
  onViewDetails,
  groupName,
}: DuesBannerProps) {
  // No amount means the admin turned dues on but has not said how much yet.
  // Nagging someone for an unspecified sum is worse than staying quiet.
  if (amountCents === null || amountCents === undefined) return null;

  const amountLabel = formatCents(amountCents);
  const note = groupName ? `${groupName} dues` : 'Pool dues';

  const payUrl = buildPaymentLink(
    { method: paymentMethod, venmoHandle, cashappHandle, instructions },
    amountCents,
    note,
  );
  const payByInstructions = paymentMethod === 'other' && Boolean(instructions?.trim());

  return (
    <Banner
      variant="warning"
      action={{ label: 'Details', onClick: onViewDetails }}
      actions={
        payUrl && paymentMethod !== 'other' ? (
          <PaymentButton
            provider={paymentMethod === 'cashapp' ? 'cashapp' : 'venmo'}
            href={payUrl}
            amountLabel={amountLabel}
            size="sm"
          />
        ) : null
      }
    >
      You owe {amountLabel} in dues
      {collectorName ? ` to ${collectorName}` : ''}.
      {payByInstructions ? ' See details for how to pay.' : ''}
    </Banner>
  );
}
