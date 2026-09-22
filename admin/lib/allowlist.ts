// Is this email allowed into the portal? Asked of the confidence-picks backend,
// which owns the ADMIN_EMAILS list, using the shared ADMIN_API_SECRET.
//
// Fails CLOSED on every path: missing config, network error, non-2xx, empty
// email. This is the one guarantee an admin tool must make.

export interface AllowlistResult {
  allowed: boolean;
}

export type AllowlistCheck = (email: string) => Promise<AllowlistResult>;

export const serverAllowlistCheck: AllowlistCheck = async (email) => {
  const base = process.env.SERVER_API_URL;
  const secret = process.env.ADMIN_API_SECRET;
  if (!base || !secret) return { allowed: false };

  const url = `${base.replace(/\/$/, "")}/api/admin-portal/allowlist/check?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) return { allowed: false };
  const body = (await res.json()) as Partial<AllowlistResult>;
  return { allowed: body.allowed === true };
};

export async function isEmailAllowed(
  email: string | undefined | null,
  check: AllowlistCheck = serverAllowlistCheck,
): Promise<boolean> {
  if (!email) return false;
  try {
    const result = await check(email);
    return result.allowed === true;
  } catch {
    return false;
  }
}
