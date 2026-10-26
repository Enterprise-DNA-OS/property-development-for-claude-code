---
description: Build the next drawdown from the claims approved since the last one, and list what is waiting on a payment schedule.
---

1. Run `npm run pd -- drawdown <project>` (`--to=<date>` for the period end). It adds approved claims since the last drawdown's period, less retention.
2. Present the items and the total, and name any claim not yet scheduled.
3. Then `/draft-drawdown` for the cover letter. The QS certifies and a person submits it. Drawdown history: `npm run pd -- drawdowns`.
