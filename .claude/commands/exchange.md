---
description: Record a lot exchanged (sold off the plan or on completion), settled or rescinded, with the paperwork the compliance checks need.
---

1. Exchanged: `npm run pd -- exchange <project> <lot> <price> --buyer="Name" --deposit=10% --sunset=YYYY-MM-DD --disclosure=<date given> --gst-notice=<date given>`. Add `--foreign --firb=<ref>` for an overseas buyer and `--margin-scheme` when the contract has the written margin scheme agreement.
2. Say whether it counts toward the presale covenant and where the project now stands against the hurdle.
3. Settled: `npm run pd -- settle <project> <lot>`.
4. Rescinded: `npm run pd -- rescind <project> <lot> --reason=sunset|cooling-off|default|other`. Under a sunset clause it refuses unless the buyer's written consent (`--consent=<date>`) or a court order (`--court-order=<ref>`) is recorded. Never work around that: send the operator to their solicitor.
