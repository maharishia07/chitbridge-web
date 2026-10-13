VERDICT: BUILD WITH CHANGES (docs/critique/SET1.md). Landing order: IX0 (#166), then the api twin (till master), then this.
New page `settings.html` (CB Settings): Your shop = the Profile's Business fields plus the vault's identity rows, MOVED from cap-admin into `app/cap-shop.js`, which both pages load. Country = cap-country, widened with mount(host, onDone).
CB_HOMES gains shop and country. The index-not-app allow-list loses acc-country-setup and till openGst, and billWarnFix narrows to its catalogue half (CAT1). The gov-panel CSS moved to one file.
The new walk `e2e/walk-settings.cjs` passes 15/15 on this runner. It covers save, a refused save, the vault, Country, and rule 13 (light and dark at 1366 and 390 px: contrast, clipping, scrolling, covered controls, no app.html, text budget of 140 characters and 2 sentences).
The walk caught Dark contrast failures, fixed the finance/crm way (data-themed re-points). Also run: till-open-gst passes. All static guards pass.
Open for later: the shared frame's top bar cuts the shop name short at 390 px on every small app (employees.html too). The walk reports it as a NOTE; not fixed here.
No route and no SQL. Better than Zoho/QuickBooks settings because the GSTIN, address and state the till checks have one writer each, and the server refuses with its own sentence.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
