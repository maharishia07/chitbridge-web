'use strict';
/* OWNS: the proof packs' WRITE GUARD (safety is the network). Every request of a pack's browser goes through guardDecision(); 'abort' = it never
   leaves the browser. A write verb to /api/ on ANY app host (the web origin AND the api origin: the local stack serves them on two ports) is aborted;
   a navigation off the app hosts is aborted. Same rule as the SIT sweep's sweep-guard.cjs, widened to a host list. Proof: node e2e/proof/guard.test.cjs */
const WRITE_VERBS = /^(POST|PUT|PATCH|DELETE)$/i;
function guardDecision(method, url, hosts, isNavigation) {
  let u; try { u = new URL(url); } catch (_) { return { act: 'fallback' }; }
  const mine = [].concat(hosts);
  if (mine.includes(u.host) && u.pathname.startsWith('/api/') && WRITE_VERBS.test(method)) return { act: 'abort', why: 'write', path: u.pathname };
  if (isNavigation && !mine.includes(u.host)) return { act: 'abort', why: 'offhost' };
  return { act: 'fallback' };
}
module.exports = { guardDecision, WRITE_VERBS };
