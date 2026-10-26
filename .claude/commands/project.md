---
description: One project in full: the approved feasibility against the forecast, the lender and the presale covenant, approvals, the cost report and recent notes. Add a new project.
---

1. Run `npm run pd -- project <code or name>`. A partial name works; if more than one matches, list them and ask.
2. Present it top to bottom. End with anything on this project from `npm run pd -- compliance --json` (filter on the project code).
3. A new project: `npm run pd -- project-new <CODE> "Name" --where=NSW --kind=apartments --manager=JP --target=20`. A new stage: `npm run pd -- stage <code> construction`.
