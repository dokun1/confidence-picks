#!/usr/bin/env node

// Coverage invariant: every Page.tsx in src/pages/ must have at least one
// e2e spec referencing its route (DoD §7a). Enforced from goal-4 onward, once
// pages exist. Until then the pages directory is absent and the check is a
// no-op so goals 1-3 don't trip it.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGES_DIR = path.join(__dirname, '../src/pages');

if (!fs.existsSync(PAGES_DIR)) {
  console.log('check-page-spec-coverage: skipped (no pages directory yet)');
  process.exit(0);
}

// TODO(goal-4): pages directory exists — walk src/pages/ for every Page.tsx,
// derive each route, and assert at least one spec in tests/e2e/ references it.
// Exit non-zero on any uncovered page. Placeholder no-op until that lands.
process.exit(0);
