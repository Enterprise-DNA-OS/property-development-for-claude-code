---
description: Every approval: development consents, planning permits, resource consents, construction and building certificates, with information requests due, lapse dates, works commenced and open conditions. Update one.
---

1. Run `npm run pd -- approvals` (`--project=PARK` for one).
2. Lead with information requests past due and approvals lapsing with no works started.
3. Update: `npm run pd -- approval <project> <reference> --status=approved --decided=<date> --lapses=<date> --commenced=<date>`.
