# confidence-picks admin (admin.confidence-picks.com)

A separate Next.js app, deployed as its own Vercel project (**Root Directory =
`admin`**), following the `findplayplace/admin` pattern.

- **Sign-in:** Auth.js v5, Google only, encrypted JWT session cookie, no database.
- **Who may enter:** emails in the backend's `ADMIN_EMAILS`. Checked at sign-in
  by `GET /api/admin-portal/allowlist/check`, which the portal calls with the
  shared `ADMIN_API_SECRET`. Fails closed: an unlisted account gets no session.
- **Pages:** drop `app/<route>/page.tsx`; `middleware.ts` protects it. Add a row
  to `components/AdminNav.tsx` to link it.

## Local dev

```bash
cp .env.example .env.local   # fill in
pnpm install
pnpm dev                     # http://localhost:3000
pnpm test                    # pure helpers, no network
```

`ADMIN_API_SECRET` must be identical on this project and the backend's Vercel
project; a mismatch fails closed on both sides.
