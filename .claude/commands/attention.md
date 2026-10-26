---
description: Everything that wants a decision today, worst first: compliance breaches, payment claim clocks, approvals, finance, costs over budget, margin, presales and sunset dates.
---

1. Run `npm run pd -- attention`.
2. Read it in order:
   - **Compliance** first. Each line is a rule the records say has been broken, with the action. A missed payment schedule (R8) means the full claim is payable: say so plainly and today.
   - **Claims.** Payment schedules due in the next few days. Missing one makes the whole claim payable.
   - **Risk.** Sunset dates before forecast completion, approvals about to lapse.
   - **Approvals and finance.** Council information requests past due, draft drawdowns, facilities expiring near completion.
   - **Costs and margin.** Variations waiting, cost codes over budget, projects or draft feasibilities under the target margin.
   - **Sales.** Presales short of the hurdle, deposits too small to count.
3. For each item give the one action and who owns it (the project's manager from `npm run pd -- projects`).
4. Anything that needs a letter is drafted to `drafts/`, never sent.

If the operator asks "what should I do today", pick the top three and say why those three.
