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
    // Scoped to this one file only — everywhere else in `app/` the rule stays
    // on, and today there are no other violations (the guest widget uses
    // `next/link` throughout).
    //
    // The rule cannot work with a root-level dynamic segment, which we have
    // since routes moved under `app/[locale]`. It derives route regexes from
    // folder names; `[locale]` becomes /^\/((?!.+?\..+?).*?)$/, whose `.*?`
    // matches across slashes. That single regex therefore matches EVERY
    // internal path, so the two intentionally-plain anchors in this file are
    // falsely reported: `/api/oauth/start` (a Route Handler that must do a real
    // document navigation for the OAuth redirect) and `/admin` (which sits
    // under its own separate root layout). Hash anchors like `#features` are
    // not affected — the plugin's `normalizeURL` drops them before matching.
    // There is no way to configure around it: the rule's
    // `customPagesDirectory` option replaces only `pagesDirs`, never the
    // app-directory scan.
    // Re-enable if `app/[locale]` ever stops being a root-level dynamic
    // segment, or once the upstream regex is anchored per path segment.
    // NB: the pattern is glob-escaped. A literal "app/[locale]/page.tsx"
    // would NOT match this file — `[locale]` parses as a character class
    // (one char out of l/o/c/a/e). `[[]` and `[]]` are classes containing a
    // literal bracket; unlike a backslash escape, they work on Windows too.
    files: ["app/[[]locale[]]/page.tsx"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
