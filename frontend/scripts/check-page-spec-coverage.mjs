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
const SPECS_DIR = path.join(__dirname, '../tests/e2e');

if (!fs.existsSync(PAGES_DIR)) {
  console.log('check-page-spec-coverage: skipped (no pages directory yet)');
  process.exit(0);
}

// --- Route derivation convention (read this before authoring pages) ----------
//
// A page lives at src/pages/<...dirs>/<Name>Page.tsx and its route is derived
// purely from that path so the file tree IS the route table:
//
//   1. Drop the trailing "Page.tsx" from the filename, leaving <Name>.
//   2. Kebab-case every PascalCase/camelCase segment (both the directory names
//      and <Name>): "GameDetail" -> "game-detail", "Settings" -> "settings".
//   3. "Home" and "Index" are sentinel names that collapse to the empty segment
//      so an index page maps to its directory root (or "/" at the top level).
//   4. The route is "/" + the surviving kebab segments joined by "/".
//
// Examples:
//   src/pages/HomePage.tsx                 -> /
//   src/pages/LeaderboardPage.tsx          -> /leaderboard
//   src/pages/games/GameDetailPage.tsx     -> /games/game-detail
//   src/pages/account/SettingsPage.tsx     -> /account/settings
//   src/pages/games/IndexPage.tsx          -> /games
//
// A spec "covers" a page if its file text contains the page's route string
// (e.g. page.goto('/leaderboard')). This is a deliberately loose textual check:
// it does not parse the spec, only requires the route to appear somewhere.
// -----------------------------------------------------------------------------

const kebab = (segment) =>
  segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

const deriveRoute = (relativePath) => {
  const parts = relativePath.split(path.sep);
  const file = parts.pop();
  const name = file.replace(/Page\.tsx$/, '');

  const segments = [...parts.map(kebab)];
  if (name !== 'Home' && name !== 'Index') {
    segments.push(kebab(name));
  }

  return '/' + segments.filter(Boolean).join('/');
};

// Recursively collect every *Page.tsx under src/pages/ (Node built-ins only).
const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith('Page.tsx')) {
      out.push(full);
    }
  }
  return out;
};

const pageFiles = walk(PAGES_DIR);

const pages = pageFiles.map((file) => ({
  file,
  rel: path.relative(path.join(__dirname, '..'), file),
  route: deriveRoute(path.relative(PAGES_DIR, file)),
}));

// Read every spec file under tests/e2e/ (only *.spec.*, skip helpers/fixtures).
const specTexts = [];
if (fs.existsSync(SPECS_DIR)) {
  for (const file of fs.readdirSync(SPECS_DIR, { recursive: true })) {
    const rel = typeof file === 'string' ? file : String(file);
    if (!/\.spec\.[^.]+$/.test(rel)) continue;
    specTexts.push(fs.readFileSync(path.join(SPECS_DIR, rel), 'utf8'));
  }
}

const uncovered = pages.filter(
  (page) => !specTexts.some((text) => text.includes(page.route))
);

if (uncovered.length > 0) {
  console.error('check-page-spec-coverage: FAIL — pages with no e2e spec referencing their route:');
  for (const page of uncovered) {
    console.error(`  ${page.rel} -> expected route ${page.route}`);
  }
  console.error(`\n${uncovered.length} uncovered page(s). Add an e2e spec that references each route.`);
  process.exit(1);
}

console.log(`check-page-spec-coverage: OK — ${pages.length} page(s) covered by e2e specs`);
process.exit(0);
