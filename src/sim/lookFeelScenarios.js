import { V0_1, V0_2 } from '../governance/constitutions';
import { resolveLens, label } from '../governance/lens';
const sel = { vertical:'pharmacy', jurisdiction:'india' };
export const lookFeelScenarios = [
  { name:'ta is rejected under v0.1 (capability-bounded), falls back', run() {
      const lens = resolveLens(V0_1, sel, { language:'ta' });
      return { pass: lens.languageRejected && lens.language === 'en', detail:'ta rejected → en' };
  }},
  { name:'ta is allowed under v0.2 and relabels', run() {
      const lens = resolveLens(V0_2, sel, { language:'ta' });
      const pass = !lens.languageRejected && label('amount', lens) !== label('amount', resolveLens(V0_1, sel, {}));
      return { pass, detail: pass ? `amount → ${label('amount', lens)}` : 'unexpected' };
  }},
  { name:'casual vocabulary changes wording, not fields', run() {
      const f = label('submit', resolveLens(V0_1, sel, { vocabulary:'formal' }));
      const cz = label('submit', resolveLens(V0_1, sel, { vocabulary:'casual' }));
      return { pass: f !== cz, detail:`${f} → ${cz}` };
  }},
];
