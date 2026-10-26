---
description: Bring a project across from EstateMaster: the feasibility, the budget and the sales register, each printed to Excel and saved as CSV. Dry run first, then import.
---

1. Make sure the project exists first (`/project`). A new one: `npm run pd -- project-new <CODE> "Name" --where=NSW`.
2. Dry run each file: `npm run pd -- import estatemaster feasibility <file.csv> --project=<CODE> --dry-run`, then `budget`, then `sales`. Show the counts and anything it could not read.
3. On a yes, run each without `--dry-run`. Running it twice is harmless.
4. Check the totals against the same EstateMaster reports: total revenue and cost on the feasibility, total budget, lots sold.
5. Column names and what maps: `docs/replace-estatemaster.md`. If the operator's export has other columns, map them in `scripts/pd.mjs` (`importCmd`) and add the case to the smoke test.
