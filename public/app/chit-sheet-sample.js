/* app/chit-sheet-sample.js — THE CHIT SHEET'S SAMPLE capability (design track): the detail drawn from fixed figures so the whole look can be walked before it is wired. Split out of chit-sheet.js, code moved verbatim.
 * OWNS      CBChitSheetSample.read (the sample chit read: header, detail, state log) · the figures are typed here, never worked out; nothing is saved
 * CALLED BY public/chit-sheet.js (open('sample') and ?cs=sample); loaded BEFORE it by accounts.html, app.html, crm.html, finance.html and tasks.html
 * FLOW      openChitSheet('sample') → CBChitSheetSample.read() → model() (chit-sheet.js) → the same paint as a real chit
 * CARD      12-ux-locale
 */
(function (root) {
  'use strict';
  function sampleRead() {
    var fivePercent = { taxable: 1076, cgst: 26.9, sgst: 26.9, tax: 53.8 };
    return {
      header: {
        chit_id: 'sample',
        purpose: 'order',
        current_status: 'pending',
        created_at: '2026-10-12T09:10:00Z',
        manual_subject: 'SO-1',
        all_recipients: [{ role: 'sender', display_name: 'Meena', entity_id: 'sample-meena' }],
        summary_json: {
          total_value: 1129.8,
          order_details: {
            channel: 'online',
            fulfilment: 'pickup',
            address: 'Pick up at the shop',
            requested_delivery: { date: '12 Oct' },
            remark: 'Ring first'
          },
          money: {
            total: 1129.8,
            taxable: 1076,
            tax: 53.8,
            cgst: 26.9,
            sgst: 26.9,
            supply: 'intra',
            by_rate: { 5: fivePercent },
            lines: [
              { total: 525, tax: 25, discount: 0 },
              { total: 604.8, tax: 28.8, discount: 64 }
            ]
          }
        }
      },
      detail: {
        line_items: [
          { particulars: 'Rice', quantity: 5, unit: 'kg', price: 100 },
          { particulars: 'Groundnut oil', quantity: 2, unit: 'L', price: 320, offers: [{ label: 'Festival 10% off', off: 64 }] }
        ]
      },
      state_log: [
        { action: 'created', created_at: '2026-10-12T09:10:00Z', by_name: 'Meena' },
        { action: 'delivered', created_at: '2026-10-12T09:10:05Z', by_name: 'ChitBridge' }
      ]
    };
  }

  root.CBChitSheetSample = { read: sampleRead };
})(typeof window !== 'undefined' ? window : globalThis);
