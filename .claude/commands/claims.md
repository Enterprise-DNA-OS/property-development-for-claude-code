---
description: Payment claims and invoices not yet paid, with the security of payment clocks: when the payment schedule is due, when payment is due, and anything missed. Record a claim, a schedule or a payment.
---

1. Run `npm run pd -- claims` (`--all` for paid ones too, `--project=PARK` for one).
2. Lead with any SCHEDULE MISSED (the full claim is now payable) and every schedule due in the next five days.
3. A new claim: `npm run pd -- claim <project> "Supplier" <REF> <amount> --code=500 --contract=HC-01 --payment-claim --date=<received>`. It prints both deadlines.
4. The schedule: `npm run pd -- schedule <project> <REF> <amount> --retention=<held>`, then `/draft-payment-schedule` for the document.
5. Paid: `npm run pd -- pay <project> <REF>`.

The clocks are in `npm run pd -- rules`. They count weekdays and do not take out public holidays, so the real deadline is never earlier than shown. A contract can make them shorter.
