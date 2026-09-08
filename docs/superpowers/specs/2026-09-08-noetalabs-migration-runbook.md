# Migrating confidence-picks to noetalabs (GitHub + npm only)

Scope decided 2026-09-08: **GitHub repo and npm scope only.** Vercel, the
domain, Google OAuth and Apple Sign In all stay exactly where they are.

## Why this is cheap

The Vercel projects are **not git-linked** (`link: null` on both
`confidence-picks-frontend` and `confidence-picks-backend`). Deploys run through
`npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}` inside the workflows, so
Vercel neither knows nor cares which GitHub repo the Action runs in. Moving the
repo cannot break the deploy as long as the secrets exist in the new home.

The callback URLs are hardcoded to `https://api.confidence-picks.com/auth/*` and
the domain is not moving, so **no OAuth reconfiguration is needed**. No user has
to re-consent, and no Apple Sign In identifiers change.

## Prerequisites (David — account creation)

1. Create the GitHub org `noetalabs` (free; public repos are unlimited).
   Verified 2026-09-08: `noetalabs` does not currently exist on GitHub.
2. Create the npm org `noetalabs` (free for public packages).
   Verified 2026-09-08: the scope is unclaimed.

## Steps

### 1. Re-auth gh with the workflow scope

The `dokun1` token currently lacks `workflow`, which blocks pushing any change
under `.github/workflows/`.

```bash
gh auth refresh -h github.com -s workflow,admin:org
```

### 2. Transfer the repository

```bash
gh api -X POST repos/dokun1/confidence-picks/transfer -f new_owner=noetalabs
```

Issues, pull requests, stars and the commit history all move with it, and GitHub
serves a redirect from the old URL so existing clones keep working.

### 3. Re-add the Actions secrets

**Secrets do not transfer.** All 11 must be recreated or every workflow fails:

| Secret | Where to find the value |
|---|---|
| `VERCEL_TOKEN` | Vercel dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `team_LYCwJ74p0wPGPWP4ECrwWkm5` (unchanged) |
| `VERCEL_BACKEND_PROJECT_ID` | `prj_QHTVKEb4mliWGIThAtuepA67mz0x` |
| `VERCEL_FRONTEND_PROJECT_ID` | `prj_AYgGJ9V0vXBJUAuoNbAxdnUHvwj1` |
| `PROD_DATABASE_URL` | `backend/.env` |
| `APPLE_CLIENT_ID` | `backend/.env` |
| `APPLE_TEAM_ID` | `backend/.env` |
| `APPLE_KEY_ID` | `backend/.env` |
| `APPLE_PRIVATE_KEY` | the `.p8` file referenced by `APPLE_PRIVATE_KEY_PATH` |
| `WC_GROUP_ID` | existing repo secret (World Cup diagnostics) |
| `WC_REFRESH_TOKEN` | existing repo secret |

The five that live in `backend/.env` can be copied across without you reading
them aloud or pasting them anywhere:

```bash
cd backend
R=noetalabs/confidence-picks
for k in PROD_DATABASE_URL APPLE_CLIENT_ID APPLE_TEAM_ID APPLE_KEY_ID; do
  v=$(grep "^$k=" .env | cut -d= -f2- | tr -d '"')
  printf '%s' "$v" | gh secret set "$k" --repo "$R"
done
gh secret set APPLE_PRIVATE_KEY --repo "$R" < "$(grep '^APPLE_PRIVATE_KEY_PATH=' .env | cut -d= -f2- | tr -d '"')"
```

`WC_GROUP_ID` and `WC_REFRESH_TOKEN` are only readable from the old repo's
settings UI (GitHub never returns secret values via the API), so those two must
be re-entered by hand. If they are lost, the World Cup diagnostic workflows are
the only thing affected and they are all `workflow_dispatch`-only.

### 4. Point the local clone at the new remote

```bash
git remote set-url origin https://github.com/noetalabs/confidence-picks.git
git remote -v
```

### 5. Validate

Open the MCP pull request against the transferred repo. Its `backend-tests` and
`frontend-ci` runs are the cheapest possible proof that the secrets migration
worked — if a secret is missing, those fail before anything reaches production.

Do **not** merge to `main` until those two checks are green, because merging is
what triggers the two deploy workflows.

## What is deliberately not being done

- **Vercel stays on `dokun1's projects` (Hobby).** Moving it would force the
  Pro decision ($20/user/month for a real team) and add a cert re-issue window,
  for no functional gain while it is not git-linked.
- **The domain stays put.** Nothing in the deploy path depends on the repo owner.
- **Google and Apple credentials stay put.** Moving the Apple app between
  developer teams without Apple's transfer-identifier flow would give every
  existing Apple user a new `apple_id`, and since `users.apple_id` is the
  identity key, they would each become a brand-new user and lose their groups,
  picks and history. There is no reason to accept that risk here.
