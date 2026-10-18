# UX Critic

A design review tool. Drop in a screenshot of a screen you designed: code measures contrast and sizes from the pixels, Claude evaluates the screen against named UX principles, and every note is marked on the screenshot. It has two modes (`docs/10-demo-mode.md`): an online **demo** with prepared sample reviews, and a **live** mode on the owner's laptop.

## Run the demo

The demo never calls Claude, needs no API key and keeps a visitor's changes (push backs, checklist, deleted projects) only in their own browser.

On your machine (Node 24 and pnpm 12):

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Without `UXC_MODE=live` and an API key, the app always runs as the demo.

As the production build, the way Vercel serves it:

```bash
UXC_MODE=demo pnpm vercel-build && UXC_MODE=demo pnpm start
```

`vercel-build` runs `next build` and then `scripts/check-demo-build.ts`, which fails the build if it finds an API route, the database, the review pipeline, the Claude SDK, or an API key in the environment.

Tests for the demo:

| Command | What it checks |
|---|---|
| `pnpm test` | unit tests |
| `pnpm test:e2e` | every screen flow with axe: in demo mode, in live mode with fake AI (own database in `.e2e-data/`), and live without a key |
| `pnpm test:smoke` | the production build in demo mode: every screen with axe, no third party requests, API paths 404, robots, og:image |

`pnpm demo:og` recaptures the og:image (`app/opengraph-image.png`) from a running demo build: `node scripts/og-capture.ts http://localhost:3000`.

### Deploy to Vercel

1. Import the GitHub repository in Vercel (framework preset: Next.js, root directory: the repository root)
2. Set exactly these environment variables for Production and Preview: `UXC_MODE=demo` and `ENABLE_EXPERIMENTAL_COREPACK=1` (so Vercel uses the pnpm version in `package.json`)
3. Never add `ANTHROPIC_API_KEY` to Vercel. A demo build with a key fails on purpose
4. Deploy. Vercel runs `pnpm install` and `pnpm vercel-build`

## Run live mode

Live mode runs only on your laptop. It stores projects in `data/uxcritic.db` and screenshots in `data/screenshots/` (both gitignored), and sends screenshots to the Claude API and nowhere else.

1. Create `.env.local` (gitignored) with:

   ```
   UXC_MODE=live
   ANTHROPIC_API_KEY=your-key-here
   ```

   Optional: `UXC_MODEL` (default `claude-sonnet-5-5`), `UXC_TIMEOUT_MS` (default 60000), and `UXC_PRICE_INPUT_PER_M` / `UXC_PRICE_OUTPUT_PER_M` in euros for the spend line on My checklist
2. `pnpm db:migrate` (optional: the app also creates and updates the database when it starts)
3. `pnpm dev` and open http://localhost:3000

Without a key, live mode shows Connect Claude. `UXC_FAKE_AI=1` answers from fixtures instead of calling Claude (`lib/fake-ai.ts`); the live Playwright tests use it. After changing `lib/db/schema.ts`, run `pnpm db:generate` and commit the new migration in `lib/db/migrations/`.

## How this repository was built

1. Create a new empty folder, for example `ux-critic`
2. Unzip this package **into** it, so `CLAUDE.md` sits at the top of that folder
3. Open a terminal in the folder, run `git init`, then start Claude Code there
4. Open `docs/09-milestones.md` and paste the M0 prompt. Review, run `pnpm dev`, commit
5. `/clear`, paste the next prompt, and so on. One milestone at a time

M0 to M4 build the online demo and need no API key and no money. M5 to M7 add live mode on your laptop; you only need a Claude API key from M5.

What is inside:

* `CLAUDE.md` rules Claude Code reads automatically
* `docs/` the full spec, in reading order 00 to 10 (10 explains demo and live mode)
* `design/` the 15 screens as images, and `design/source/` the same screens as HTML for exact spacing and copy

Sample data in the designs (Checkout practice, NeighborGoods, FashionFlock, all numbers) is only for the mockups. The demo uses its own sample projects from docs/10.
