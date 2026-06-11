/** @type {import('tailwindcss').Config} */
// Source of truth: design tokens in src/designsystem/tokens/*.json, compiled by
// scripts/generate-platform-tokens.js into the platform-tokens config below.
// The root config consumes that generated theme so editing tokens actually
// drives the build. (Previously this file hand-duplicated every token value,
// which silently diverged from the tokens it was meant to mirror.)
import platformTokens from './src/designsystem/platform-tokens/tailwind.config.js';

export default {
  content: ['./src/**/*.{html,js,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: platformTokens.theme.extend,
  },
  plugins: [],
};
