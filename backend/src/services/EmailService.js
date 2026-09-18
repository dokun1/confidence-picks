const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Apple withholds the real address for some Sign-in-with-Apple users, and
// User.createOrUpdateApple mints a placeholder on this domain. Sending to one is
// a guaranteed hard bounce, and bounce rate is what gets a sending domain
// throttled -- so this filter protects deliverability for everyone else.
const UNSENDABLE_SUFFIX = '@confidence-picks.local';

export function isSendableAddress(email) {
  return (
    typeof email === 'string' &&
    email.includes('@') &&
    !email.toLowerCase().endsWith(UNSENDABLE_SUFFIX)
  );
}

/**
 * A thin Resend client over native fetch. No SDK: this is one POST, and the
 * dependency would only add a version to keep current.
 *
 * `fetchImpl`, `env` and `logger` are injected so every branch is testable
 * without a network or process-wide environment mutation.
 */
export function createEmailService({ fetchImpl = fetch, env = process.env, logger = console } = {}) {
  // Dry run is the DEFAULT, and only the literal string 'false' turns it off, so
  // a missing or misspelled variable fails safe rather than mailing people.
  const dryRun = String(env.EMAIL_DRY_RUN ?? 'true').toLowerCase() !== 'false';
  const maxPerRun = Number.parseInt(env.EMAIL_MAX_PER_RUN || '80', 10);
  let sent = 0;

  return {
    dryRun,

    get sentCount() {
      return sent;
    },

    async send({ to, subject, html, text, unsubscribeUrl, idempotencyKey }) {
      if (!isSendableAddress(to)) {
        logger.warn(`[email] skipping unsendable address: ${to}`);
        return { id: null, skipped: 'unsendable-address' };
      }

      // Counted before the attempt, so a run that keeps failing still stops at
      // the cap rather than retrying forever against the provider.
      if (sent >= maxPerRun) {
        throw new Error(
          `EMAIL_MAX_PER_RUN (${maxPerRun}) reached — refusing to send more this run`
        );
      }
      sent += 1;

      if (dryRun) {
        logger.log(`[email][dry-run] to=${to} subject=${JSON.stringify(subject)}`);
        return { id: null, dryRun: true };
      }

      const res = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to,
          reply_to: env.EMAIL_REPLY_TO,
          subject,
          html,
          text,
          headers: {
            // RFC 8058 one-click unsubscribe. Gmail and Yahoo require this on
            // bulk mail, and it is what puts the "Unsubscribe" affordance in
            // the client chrome rather than only in our footer.
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend rejected the send: ${res.status} ${body}`);
      }
      const data = await res.json().catch(() => ({}));
      return { id: data.id ?? null };
    },
  };
}
