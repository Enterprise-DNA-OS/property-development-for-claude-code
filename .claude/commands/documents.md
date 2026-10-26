---
description: Render the paperwork from the records, in the business's brand: the lender's monthly report, feasibility summaries for the board, and construction updates for buyers.
---

1. `npm run docs` renders every document. One kind: `npm run docs -- lender-report`, `-- feasibility-summary`, `-- buyer-update`.
2. Files land in `docs-out/<kind>/`. Print to PDF from the browser, or attach as is.
3. Business name, colours and the footer come from `brand.json`. A new document type is a new entry in `documents.json`.
