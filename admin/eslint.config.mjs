import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next@15 ships a legacy `{ extends }` config, not a flat-config
// array, so it goes through FlatCompat. (Next 16's package exports a flat
// array directly; drop this shim when upgrading.)
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals"),
  { ignores: [".next/**", "node_modules/**"] },
];

export default config;
