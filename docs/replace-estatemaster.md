# Moving off EstateMaster

A day or two for one person per project, in this order. Keep EstateMaster until the revenue, cost and profit from this system match the same EstateMaster reports for every project you have moved.

Most developers move one live project first, run a month of claims, a drawdown and a lender report through it, then move the rest.

## 1. Set up the business and the projects

Short lists, quicker to enter by asking Claude Code than to export:

- **Staff.** Initials, name and role.
- **Projects.** A short code (PARK), the name and address, where it is (NSW, VIC, QLD, NZ and so on), the kind (apartments, townhouses, land subdivision), the stage, who manages it, the target margin on cost.
- **The lender.** Facility limit, expiry, the presale cover the covenant needs, the minimum deposit that counts and any cap on overseas buyers.

Ask in plain words: "add Bayview Nine, code BAY, 9 apartments in Queensland, Dana manages it, target 20% on cost, Eastbank facility $6.2m needing 100% presale cover" and Claude Code writes the rows.

## 2. Export from EstateMaster

EstateMaster prints its reports to Excel. For each project, export these and save each sheet as CSV:

1. **The feasibility input or summary report** from Development Feasibility, one row per line item: the category, the description, the amount and, where your template shows it, the start month and the number of months.
2. **The budget or cost report** from Development Management, one row per cost code with its current budget.
3. **The sales register**: one row per lot with type, bedrooms, list price, status, purchaser, contract price, deposit, exchange date and sunset date.

Templates differ between businesses. If a column is called something else in yours, the import says which rows it could not read, and Claude Code can add your header in a minute.

## 3. Import

```
npm run pd -- import estatemaster feasibility feaso.csv --project=BAY --dry-run
npm run pd -- import estatemaster feasibility feaso.csv --project=BAY
npm run pd -- import estatemaster budget budget.csv --project=BAY
npm run pd -- import estatemaster sales sales.csv --project=BAY
```

The dry run writes nothing and reports anything it could not read. Running an import twice is harmless: feasibility lines match on their description within a version (pass `--version=N` to reload into the same draft), cost codes on their code, lots on their lot number. A feasibility import makes a new draft version; approve it with `npm run pd -- approve-feaso BAY 1` once the totals match.

### What maps

Columns are matched by name, ignoring case:

| This system | Headers it accepts |
|---|---|
| Feasibility line | Description, Item, Line Item, Name; Amount, Total, Total (ex GST), Amount (ex GST), Value; Category, Section, Group, Cost Category, Type; Start, Start Month, Month; Span, Months, Duration |
| Cost code | Code, Cost Code, Account; Description, Item, Name; Budget, Current Budget, Approved Budget, Amount |
| Lot | Lot, Lot No, Unit, Unit No, Lot Number; Type, Product; Beds, Bedrooms; List Price, Asking Price, Gross Price; Status, Sale Status; Purchaser, Buyer; Sale Price, Contract Price; Deposit (an amount or a percentage); Exchange Date, Contract Date; Sunset Date; Foreign Buyer, FIRB |

Lines are placed in a category from the category column and the description: sales, rent and other income on the revenue side; land, acquisition (stamp duty), professional fees, statutory (council fees and contributions), construction, contingency, marketing, selling (commission), finance and holding (rates and land tax) on the cost side. Anything else goes to "other" for you to place. Lot statuses map to available, hold (reserved, EOI), exchanged (sold, unconditional), settled and rescinded. Dates read as DD/MM/YYYY.

Example files in the shape the importer reads: `examples/estatemaster-feasibility.csv`, `examples/estatemaster-budget.csv`, `examples/estatemaster-sales.csv`.

## 4. Fill in what the exports do not carry

- **Contracts and variations.** The head contract and each consultant's appointment, with value, cost code and retention, then each variation with its status: `/contracts`, `/variation`.
- **Payment claims to date.** At least the claims not yet paid, so the clocks start running: `/claims`. Paid history can be one line per contract.
- **Approvals and conditions.** Each consent with its reference, decision date, lapse date and works commenced date, and the conditions still open: `/approvals`, `/conditions`.
- **The paperwork on each sale.** The dates the disclosure statement and GST withholding notice were given, the margin scheme agreement, and overseas buyers' approval numbers: `/exchange`.

## What does not come across

- **EstateMaster's cash flow engine in full.** This spreads each line evenly over its months and works out IRR, peak funding and residual land value from that. EstateMaster's S-curves, GST and stamp duty calculations, interest capitalisation and multi-stage cash flows are richer. Keep the EstateMaster file for each historic project, and for complex deals model the finance in your own spreadsheet and enter the result as a finance line.
- **Corporate consolidation.** This holds each project; a group view across entities is a `/new-view` or a customisation.
- **Report templates.** The documents here are the lender report, the feasibility summary and the buyer update. Others are an entry in `documents.json`.

## Check before you switch

For every project moved, put these next to the same EstateMaster reports:

```
npm run pd -- feaso BAY
npm run pd -- costs BAY
npm run pd -- lots BAY
npm run pd -- presales
```

Revenue, total cost, profit, the total budget and lots sold should match. Then run `/compliance`.
