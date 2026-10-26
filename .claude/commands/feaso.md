---
description: A project's feasibility: every revenue and cost line with its timing, profit, margin on cost and on revenue, IRR, peak funding, residual land value and how far sales can fall. Start or change a version.
---

1. Run `npm run pd -- feaso <project>` (the approved version, or `--version=N`). Every version side by side: `npm run pd -- feasos <project>`.
2. Present the summary first (profit, margin on cost against the target, IRR, peak funding), then the lines.
3. To change a feasibility, never edit an approved one. Start a new version, which copies the approved lines: `npm run pd -- feaso-new <project> "what changed"`. Then change lines: `npm run pd -- line <project> cost construction "Construction (tender)" 7,937,000 --start=12 --span=18`. The same description updates the line.
4. When the director signs it off: `npm run pd -- approve-feaso <project> <version>`. Budgets by cost code do not follow automatically; ask before changing them with `npm run pd -- budget`.

All figures ex GST. The cash flow spreads each line evenly over its months; say that if anyone asks how the IRR is worked out.
