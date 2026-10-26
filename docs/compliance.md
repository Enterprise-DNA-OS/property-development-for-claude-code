# Compliance: the rules this system checks

`/compliance` (or `npm run pd -- compliance`) checks the records against the rules below and reports every breach or risk with the rule and its source. The rules cover off the plan sales in New South Wales and Victoria, GST on new residential property in Australia, overseas buyers in Australia, the security of payment laws in New South Wales and New Zealand, retention money in New Zealand, the lapsing of planning approvals, conditions of consent, and the lender's presale covenant.

This is a records check. It finds what the records say happened. It is not legal or tax advice, and it does not replace the solicitor, the accountant, the certifier or the lender. Confirm each rule against the current version of its source at [legislation.nsw.gov.au](https://legislation.nsw.gov.au/), [legislation.vic.gov.au](https://www.legislation.vic.gov.au/), [legislation.gov.au](https://www.legislation.gov.au/), [legislation.govt.nz](https://www.legislation.govt.nz/) and [ato.gov.au](https://www.ato.gov.au/) before you rely on it. When a rule changes, change it here, in the check in `scripts/pd.mjs` (`CHECKS`) and in the smoke test in the same edit.

| Rule | What a breach looks like in the data | Source |
|---|---|---|
| R1 Sunset rescission only with consent or a court order | A lot rescinded under a sunset clause in NSW or Victoria with no written purchaser consent and no court order recorded, or with the notice served less than 28 days before the rescission | Conveyancing Act 1919 (NSW) s66ZS; Sale of Land Act 1962 (Vic) s10B (ss10A to 10F) |
| R2 Sunset dates before forecast completion (risk) | An exchanged lot whose sunset date falls before the project's forecast completion while the plan is not registered | The contract; the same sections as R1, which stop the developer ending the contract on its own |
| R3 NSW off the plan disclosure statement | An NSW residential lot sold before the plan was registered with no disclosure statement recorded, or one given after the contract date | Conveyancing Act 1919 (NSW) s66ZM (the statement must be attached before the purchaser signs) |
| R4 Victorian off the plan deposit | A Victorian lot sold before the plan was registered with a deposit over 10% of the price, or a deposit not held on trust | Sale of Land Act 1962 (Vic) s9AA; s9AE gives the purchaser a right to rescind |
| R5 GST at settlement notice | An Australian residential lot exchanged or settled with no withholding notice recorded | Taxation Administration Act 1953 Schedule 1 s14-255 (the notice), s14-250 (the purchaser's withholding) |
| R6 Margin scheme agreed in writing | A sale on a project using the margin scheme with no written agreement on the contract | A New Tax System (Goods and Services Tax) Act 1999 s75-5(1A): agreed in writing on or before the supply, or later with the Commissioner's leave |
| R7 Overseas buyers | An overseas buyer of an Australian lot with no foreign investment approval number and no new dwelling exemption certificate on the project | Foreign Acquisitions and Takeovers Act 1975 (Cth), administered by the Foreign Investment Review Board |
| R8 Payment schedule in time | A payment claim with no payment schedule after the deadline, or one given late. Missing it makes the full claimed amount payable | Building and Construction Industry Security of Payment Act 1999 (NSW) s14(4) and s15 (10 business days); Construction Contracts Act 2002 (NZ) ss21 to 23 (the contract's time, or 20 working days) |
| R9 Payment by the due date | A payment claim unpaid after its due date | Security of Payment Act 1999 (NSW) s11(1A) (principal to head contractor, 15 business days at most); Construction Contracts Act 2002 (NZ) s18 (20 working days where the contract is silent) |
| R10 NZ retention money on trust | Retention held from a New Zealand contractor with no retention trust account recorded on the project | Construction Contracts Act 2002 (NZ) s18C (held on trust) and s18D (kept in a separate trust account, since the 2023 amendment) |
| R11 Approvals about to lapse (risk) | An approved consent or permit lapsing within 180 days with no works commenced | Environmental Planning and Assessment Act 1979 (NSW) s4.53 (five years unless physically commenced); Resource Management Act 1991 (NZ) s125 (five years unless given effect to or extended); Planning and Environment Act 1987 (Vic) s68 (as the permit's conditions say) |
| R12 Conditions met before the stage they gate | A before-construction condition still open on a project under construction, or a before-occupation condition still open once settled | The conditions of each consent |
| R13 Presale covenant | A project under construction whose qualifying presales are below the lender's hurdle | The facility agreement: the cover ratio, minimum deposit and overseas cap recorded on the project |

## The payment claim clocks

`jurisdiction_rules` holds the days for each place: NSW (schedule 10 business days, payment 15 business days for a principal paying a head contractor) and NZ (20 working days for each where the contract is silent). They count weekdays and do not take out public holidays or the Christmas shutdown, so the deadline shown is never later than the real one. A contract can set shorter times; record those with `/customise`.

Victoria, Queensland and the other states have their own security of payment acts with their own times. Add a row for each state you build in, with its source, before relying on R8 and R9 there.

## What it does not check

- Whether a disclosure statement or contract is correct, only that one was given.
- Stamp duty, land tax and foreign purchaser surcharges.
- Work health and safety, and the builder's licence and insurance (home warranty insurance where it applies).
- Strata and body corporate establishment, and the first annual general meeting.
- The New Zealand overseas investment rules for residential land, which work differently from the Australian ones.

Each is a reasonable `/customise` request once your solicitor has written the rule down.
