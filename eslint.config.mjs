import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Disabled because the rule cannot work with a root-level dynamic
      // segment, which we have since routes moved under `app/[locale]`.
      // The rule derives route regexes from folder names; `[locale]` becomes
      // /^\/((?!.+?\..+?).*?)$/, whose `.*?` matches across slashes. That
      // single regex therefore matches EVERY internal path, so any
      // `<a href="/...">` anywhere in the project is reported — e.g.
      // `/api/oauth/start` (a route handler that must do a real document
      // navigation for the OAuth redirect) and `/admin` (which now sits under
      // its own separate root layout). There is no way to configure around it:
      // the rule's `customPagesDirectory` option replaces only `pagesDirs`,
      // never the app-directory scan.
      // Re-enable if `app/[locale]` ever stops being a root-level dynamic
      // segment, or once the upstream regex is anchored per path segment.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
