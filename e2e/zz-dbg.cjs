const base = require('fs').readFileSync(__dirname + '/till-r4-guards.cjs', 'utf8');
const cut = base.indexOf("console.log('\n── T4-01 · one sale");
let head = base.slice(0, cut);
head += `
  const { ctx, p } = await tillPage(b, WEB);
  const r = await p.evaluate(async () => {
    var out = [];
    await nextNumber(); await nextNumber();
    out.push('store ' + tillStore());
    out.push('plain ' + JSON.stringify(await DB.get('series')));
    var real = IDBDatabase.prototype.transaction, left = 1;
    IDBDatabase.prototype.transaction = function () { if (left-- > 0) throw new DOMException('closing', 'InvalidStateError'); return real.apply(this, arguments); };
    try { out.push('blip ' + JSON.stringify(await DB.get('series'))); } catch (e) { out.push('threw ' + e.message); }
    IDBDatabase.prototype.transaction = real;
    out.push('after ' + JSON.stringify(await DB.get('series')));
    out.push('mem ' + MEM.on + ' lastErr ' + JSON.stringify(DB.lastErr()));
    return out;
  });
  console.log(r.join('\n'));
  await b.close(); srv.close(); process.exit(0);
})();
`;
require('fs').writeFileSync(__dirname + '/zz-dbg-run.cjs', head);
