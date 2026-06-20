import { V0_1 } from '../governance/constitutions';
import { bornChit } from '../governance/chitBirth';
const sel = { vertical:'pharmacy', jurisdiction:'india', standard:'none', content:'own_only', erp:'tally' };
export const chitBirthScenarios = [
  { name:'available + authored partition the full field set', run() {
      const c = bornChit(V0_1, sel, 'purchase_order', 'me');
      return { pass: (c.available.length + c.toAuthor.length) === c.fields.length, detail:`${c.available.length} avail + ${c.toAuthor.length} author = ${c.fields.length}` };
  }},
  { name:'ERP fields show as available (no re-keying)', run() {
      const c = bornChit(V0_1, sel, 'purchase_order', 'me');
      return { pass: c.available.some(f => f.field === 'ext_ledger_ref'), detail:'ext_ledger_ref available' };
  }},
  { name:'jurisdiction-required field is Must', run() {
      const c = bornChit(V0_1, { ...sel, erp:'none' }, 'purchase_order', 'me');
      const g = c.fields.find(f=>f.field==='gstin');
      return { pass: !!g && g.moscow === 'Must', detail: g ? `gstin = ${g.moscow}` : 'no gstin' };
  }},
];
