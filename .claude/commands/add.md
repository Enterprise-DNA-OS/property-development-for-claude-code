---
description: Add records by asking: a project, a contract, a claim, a lot, a feasibility line. Routes to the right command.
---

Work out what the operator is adding, then use the command for it:

- A project: `/project` (`project-new`).
- A feasibility line or a new version: `/feaso`.
- A contract or a variation: `/contracts`, `/variation`.
- A payment claim or an invoice: `/claims`.
- A lot sale: `/exchange`.
- A cost code budget: `npm run pd -- budget <project> <code> <amount> "description"`.

If something has no command (a new approval, a new condition, a staff member), write the insert through `scripts/lib/db.mjs` after saying what you are adding, and propose a command if it will come up again.
