---
description: Check every project's records against the thirteen rules in docs/compliance.md: sunset clauses, off the plan disclosure and deposits, GST at settlement, the margin scheme, overseas buyers, payment claim clocks, retention trusts, approval lapses, conditions and the presale covenant.
---

1. Run `npm run pd -- compliance` (`--json` for every row, not just the first example).
2. Report as a table: rule, what was found, the worst example, the source. Breaches first, then risks, then clean.
3. For each breach, say what the record shows and who fixes it: the solicitor (sunset, disclosure, deposits), the accountant (GST notice, margin scheme), the development manager (claims, conditions, retention), the director (presale covenant). Draft any letter to `drafts/`, never send it.
4. If a rule in `docs/compliance.md` looks out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc, the check in `scripts/pd.mjs` (`CHECKS`) and the smoke test together.

A records check, not legal advice. The solicitor, the certifier and the lender make the calls.
