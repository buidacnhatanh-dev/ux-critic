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
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^@\\/lib\\/(db|pipeline)/]",
          message: "Screens read data only through DataClient (docs/10).",
        },
      ],
    },
  },
  {
    files: ["lib/data/live-*.ts", "app/api/**", "lib/pipeline/**", "lib/db/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "design/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
