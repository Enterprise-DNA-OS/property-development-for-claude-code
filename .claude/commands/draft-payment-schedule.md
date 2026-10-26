---
description: Draft the payment schedule for a payment claim: the claim it answers, the amount you will pay, and the reasons for paying less, so it is valid under the security of payment law.
---

1. Run `npm run pd -- claims --project=<code> --json` and find the claim. Read the contract and its variations: `npm run pd -- contracts --project=<code> --json`.
2. Ask the operator for the scheduled amount and the reason for each deduction (the QS assessment usually gives both). Do not invent reasons.
3. Write `drafts/payment-schedule-<project>-<ref>.md`: it must identify the payment claim (reference and date received), state the scheduled amount, and give the reasons for withholding the difference, item by item. Show the deadline it must be served by.
4. Never send it. Say: "Serve this before <deadline> the way the contract says notices are served." Once served, record it with `npm run pd -- schedule`.
