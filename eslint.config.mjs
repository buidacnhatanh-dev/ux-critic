import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const config = [
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // CLAUDE.md: never use tabindex greater than 0
      "jsx-a11y/tabindex-no-positive": "error",
      // Allow `const { dropped: _, ...rest } = row` to leave out a field.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value=/(^@\\/|\\.\\.\\/)lib\\/(db|pipeline)|^\\.\\.?\\/(db|pipeline)\\//]",
          message: "Screens read data only through DataClient (docs/10).",
        },
      ],
    },
  },
  {
    // Live server code: API routes and what they use. Never imported by screens.
    files: [
      "app/api/**",
      "lib/api/**",
      "lib/pipeline/**",
      "lib/db/**",
      "lib/fake-ai*",
      "scripts/**",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      ".next-e2e-live/**",
      ".next-e2e-setup/**",
      ".e2e-data/**",
      ".next-smoke/**",
      "node_modules/**",
      "design/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
