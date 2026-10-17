# UX Critic build spec: how to use it

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
