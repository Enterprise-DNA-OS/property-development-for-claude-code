---
description: Draft the construction progress letter to off the plan buyers on a project: where the build is, the expected completion, and what happens next.
---

1. Run `npm run pd -- project <code> --json` and `npm run pd -- lots <code> --sold --json`.
2. Write one `drafts/buyer-update-<project>.md` with a merge line per buyer (name, lot), in plain words: progress since the last letter, the expected completion month, what the buyer will hear next (inspection, settlement notice).
3. Never mention a sunset date, an extension or a rescission in a progress letter. That is for the solicitor.
4. `npm run docs -- buyer-update` renders one branded page per buyer from the same records. Never send anything.
