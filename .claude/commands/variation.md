---
description: Record a variation the builder or a consultant has raised, or decide one: approve (at the agreed figure) or reject.
---

1. Raise: `npm run pd -- variation <project> <contract> <amount> "what it is"`. Say what it does to the cost code's forecast.
2. Decide: `npm run pd -- decide <project> <contract> <V03> approve --amount=180000` or `reject`. Only on the operator's decision.
3. Log the reason: `npm run pd -- log <project> "V03 approved at $180,000 after site meeting" --by=JP`.
