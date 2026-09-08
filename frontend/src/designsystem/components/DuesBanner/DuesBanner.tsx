import Banner from '../Banner';
import PaymentButton from '../PaymentButton';
import { buildVenmoLink, buildCashAppLink, formatCents } from '../../../lib/paymentLinks';

export interface DuesBannerProps {
  /** What the viewer owes, in integer cents. Null renders nothing. */
  amountCents: number | null;
  /** Display name of the member collecting dues, when one is set. */
  collectorName: string | null;
  venmoHandle: string | null;
  cashappHandle: string | null;
  /** Free-text alternative (Zelle, cash, check). Only affects the copy here. */
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
 * Payment buttons appear only for the services the admin actually configured.
 * When dues are collected some other way (Zelle, cash), no buttons render and
 * the banner sends the member to the details instead — the instructions are too
 * long to inline and would push the tab bar off a phone screen.
 *
 * "Details" is always present, because a member needs somewhere to see what
 * they owe and who else has paid regardless of how payment happens.
 */
export default function DuesBanner({
  amountCents,
  collectorName,
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

  const venmoUrl = buildVenmoLink(venmoHandle, amountCents, note);
  const cashAppUrl = buildCashAppLink(cashappHandle, amountCents);
  const hasInstructionsOnly = !venmoUrl && !cashAppUrl && Boolean(instructions?.trim());

  return (
    <Banner
      variant="warning"
      action={{ label: 'Details', onClick: onViewDetails }}
      actions={
        <>
          <PaymentButton provider="venmo" href={venmoUrl} amountLabel={amountLabel} size="sm" />
          <PaymentButton provider="cashapp" href={cashAppUrl} amountLabel={amountLabel} size="sm" />
        </>
      }
    >
      You owe {amountLabel} in dues
      {collectorName ? ` to ${collectorName}` : ''}.
      {hasInstructionsOnly ? ' See details for how to pay.' : ''}
    </Banner>
  );
}
