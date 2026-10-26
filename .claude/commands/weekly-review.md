---
description: The Monday development meeting, written from three commands: the projects against their feasibilities, the money (claims and costs), and the attention list.
---

Run these three and write the review from what they return. Nothing they do not support goes in.

```
npm run pd -- projects
npm run pd -- claims
npm run pd -- attention
```

Then, no more than a page:

1. **The portfolio in one line.** From `npm run pd -- stats`: live projects, lots sold of total, forecast over budget, breaches.
2. **Each project.** Stage, approved margin against forecast margin, anything that moved since last week (read the notes on `/project`).
3. **Money out.** Payment claims and their clocks, variations waiting, cost codes over budget.
4. **Sales.** Presales against each lender's hurdle (`npm run pd -- presales`), sunset dates inside 90 days.
5. **Approvals.** Information requests due, approvals near lapse, conditions gating the next stage.
6. **Five things to do this week**, from the attention list, with why each made it.
7. **One thing to decide.** The single item that needs the director, not a process.

`npm run view -- week` renders the same numbers as a printable page.
