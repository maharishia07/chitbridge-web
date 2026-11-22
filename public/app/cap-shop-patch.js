/* app/cap-shop-patch.js — the vault's merge-patch, split out of cap-shop.js (web split 1129), code moved verbatim.
 * OWNS      the vault's key rule and its diff: vaultUniqueKey · vaultKeys · vaultRowBody · vaultRowSame · vaultNewSectionPatch · vaultRowsPatch · vaultPatch (what changed since the base, as the api's merge-patch); the same key rule as the api's lib/vault-patch.js
 * CALLED BY cap-shop.js (saveVaultUI, vaultSaveQuiet) and cap-print.js (the signature's save); loaded first through CAP_WITH.shop (app.html) and a script tag before cap-shop.js (settings.html); pure functions, read when called
 * FLOW      vaultPatch(base, now) ──▶ { sections: { 'type|name': { rows: { 'key': row | null } } } } or null (nothing moved) ──▶ PUT the vault with the version
 * CARD      28-platform-and-operations/know-your-business
 * ID        LIB006
 * OWNER     cb-ux-locale
 * RISK      money-adjacent (a wrong key overwrites a neighbour's row; the api refuses a stale version)
 */
'use strict';
/** a unique key: the base, then #2, #3 … on a repeat (the api's vault-patch.uniqueKey) */
function vaultUniqueKey(base, seen) {
  var key = base,
    copy = 1;
  while (seen[key]) {
    copy += 1;
    key = base + '#' + copy;
  }
  seen[key] = true;
  return key;
}
/** sections keyed `type|label`, rows keyed `t:<tag>` else `n:<name>` — the api's vault-patch.keyed, one rule on both sides */
function vaultKeys(sections) {
  var keyed = {},
    seenSections = {};
  (sections || []).forEach(function (section) {
    var rows = {},
      seenRows = {};
    (section.rows || []).forEach(function (row) {
      rows[vaultUniqueKey(row.tag ? 't:' + String(row.tag).toLowerCase() : 'n:' + String(row.name || ''), seenRows)] = row;
    });
    keyed[vaultUniqueKey(String(section.type || 'other') + '|' + String(section.label || ''), seenSections)] = {
      type: section.type,
      label: section.label || '',
      rows: rows
    };
  });
  return keyed;
}
/** a row as the server stores it: name · value · tag (the provenance rides back untouched) */
function vaultRowBody(row) {
  var body = { name: row.name || '', value: row.value || '', tag: row.tag || '' };
  if (row.source) body.source = row.source;
  if (row.as_of) body.as_of = row.as_of;
  if (row.rung) body.rung = row.rung;
  return body;
}
/** do two rows carry the same name · value · tag? (an empty field equals a missing one) */
function vaultRowSame(before, after) {
  return (
    !!before &&
    !!after &&
    ['name', 'value', 'tag'].every(function (field) {
      return (before[field] || '') === (after[field] || '');
    })
  );
}
/** a section that is NEW: all its rows, as the server stores them */
function vaultNewSectionPatch(section) {
  var rows = {};
  Object.keys(section.rows).forEach(function (rowKey) {
    rows[rowKey] = vaultRowBody(section.rows[rowKey]);
  });
  return { type: section.type, label: section.label, rows: rows };
}
/** a section that exists on both sides: only the rows that were removed (null) or changed; null when no row moved */
function vaultRowsPatch(before, after) {
  var rows = {},
    moved = false;
  Object.keys(before.rows).forEach(function (rowKey) {
    if (!after.rows[rowKey]) {
      rows[rowKey] = null;
      moved = true;
    }
  });
  Object.keys(after.rows).forEach(function (rowKey) {
    if (!vaultRowSame(before.rows[rowKey], after.rows[rowKey])) {
      rows[rowKey] = vaultRowBody(after.rows[rowKey]);
      moved = true;
    }
  });
  return moved ? { rows: rows } : null;
}
/** the merge-patch from the copy read to the model now: only sections and rows that moved; null = removed; empty when nothing moved */
function vaultPatch(base, now) {
  var before = vaultKeys(base),
    is = vaultKeys(now),
    sections = {},
    any = false;
  Object.keys(before).forEach(function (key) {
    if (!is[key]) {
      sections[key] = null;
      any = true;
    }
  });
  Object.keys(is).forEach(function (key) {
    var section = before[key] ? vaultRowsPatch(before[key], is[key]) : vaultNewSectionPatch(is[key]);
    if (section) {
      sections[key] = section;
      any = true;
    }
  });
  return any ? { sections: sections } : null;
}
