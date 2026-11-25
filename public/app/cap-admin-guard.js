/* public/app/cap-admin-guard.js — Profile and Settings: the unsaved-changes guard ("Not saved": Stay here · Discard · Save and continue). Split out of cap-admin.js (web split 1129).
 * OWNS      the snapshot of what is on screen (profSnapshot), which sections differ from it (profDirtySections), the three-outcome prompt (profGuard) and what each outcome does (profGuardDo, profSaveSections)
 * CALLED BY public/app/cap-admin.js (profileScreen, setGuard, setSnapshot: the maps PROF_FIELDS and SET_FIELDS and _profSnap stay there), loaded first through CAP_WITH.admin (app.html)
 * FLOW      a screen asks profGuard(go, map, names) before it navigates ──▶ nothing dirty: go() ──▶ else the prompt ──▶ profGuardDo(stay | discard | save) ──▶ saveProfile / saveSettings / saveAutoAssign
 * ID        ACC002
 * OWNER     cb-settings
 * CARD      28-platform-and-operations/settings
 * RISK      plain
 * Host globals: UI · PROF_FIELDS · _profSnap · tx · esc · modal · closeModal · toast · saveProfile · saveSettings · saveAutoAssign (all read when called, not when loaded).
 */
/** Re-read every profile field currently on screen. Called after each paint. */
function profSnapshot(map) {
  map = map || PROF_FIELDS;
  _profSnap = {};
  Object.keys(map).forEach(function (item) {
    map[item].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) _profSnap[pair[0]] = el.value;
    });
  });
}

/** Which sections have an on-screen field whose value differs from the snapshot. */
function profDirtySections(map) {
  map = map || PROF_FIELDS;
  var out = [];
  Object.keys(map).forEach(function (item) {
    var dirty = map[item].some(function (pair) {
      var el = document.getElementById(pair[0]);
      /* ⚠️ A FIELD NOT ON SCREEN IS NOT DIRTY. A collapsed section cannot have been edited, and treating its
         absence as a change would prompt on every single navigation. */
      return el && Object.prototype.hasOwnProperty.call(_profSnap, pair[0]) && el.value !== _profSnap[pair[0]];
    });
    if (dirty) out.push(item);
  });
  return out;
}

/**
 * profGuard(go) — run `go`, or ask first if something is unsaved.
 *
 * ⚠️ THE PROMPT NAMES WHAT IS UNSAVED. "You have unsaved changes" makes a person hunt through five collapsed
 * sections for something they may not have touched; naming the section turns the question into an answer.
 *
 * ⚠️ THREE OUTCOMES, NOT TWO. Save-and-go, discard-and-go, and STAY — because a person interrupted mid-edit
 * often wants neither. A two-button dialog forces a decision about the data in order to answer a question
 * about the navigation.
 */
function profGuard(go, map, nameMap) {
  /* ⚠️ THE MAP IS REMEMBERED FOR profGuardDo — it saves the dirty sections after the person chooses, and
     without this it would save PROFILE fields when the prompt came from Settings. */
  UI._guardMap = map || PROF_FIELDS;
  var dirty = profDirtySections(UI._guardMap);
  if (!dirty.length) return go();
  var Q = String.fromCharCode(39);
  var names = nameMap || { ident: tx('Identity'), profile: tx('Business'), governed: tx('Storefront') };
  var what = dirty
    .map(function (item) {
      return names[item] || item;
    })
    .join(', ');

  UI._profGo = go;
  /**
   * ⚠️ modal() TAKES ONE HTML STRING, NOT (title, body, buttons). I wrote the three-argument call from memory
   * and only the first would have rendered — the fourth remembered-signature mistake today, after
   * SESSION.identity_type, PURPOSE.profile and the borrowed `capped`. The house markup is mhd / mbody / mfoot,
   * as confirmAsk builds it; confirmAsk itself is two-button and this needs three.
   */
  modal(
    '<div class="mhd"><div class="t">' +
      esc(tx('Not saved')) +
      '</div></div>' +
      '<div class="mbody"><div style="font-size:var(--fs-2);line-height:1.55;color:var(--ink)">' +
      tx('You changed') +
      ' <b>' +
      esc(what) +
      '</b> ' +
      tx('and have not saved it.') +
      '</div></div>' +
      '<div class="mfoot">' +
      '<button data-cbsid="ACC002-B30" data-testid="prof-guard-stay" onclick="profGuardDo(' +
      Q +
      'stay' +
      Q +
      ')">' +
      esc(tx('Stay here')) +
      '</button>' +
      '<button data-cbsid="ACC002-B31" data-testid="prof-guard-discard" onclick="profGuardDo(' +
      Q +
      'discard' +
      Q +
      ')">' +
      esc(tx('Discard')) +
      '</button>' +
      '<button data-cbsid="ACC002-B32" class="pri" data-testid="prof-guard-save" onclick="profGuardDo(' +
      Q +
      'save' +
      Q +
      ')">' +
      esc(tx('Save and continue')) +
      '</button>' +
      '</div>'
  );
  /* ⚠️ ESCAPE AND THE BACKDROP MEAN STAY, NOT DISCARD. A dialog dismissed by accident must never be the thing
     that throws away work — the safe default is the one that changes nothing. */
  UI._modalDismiss = function () {
    UI._profGo = null;
  };
}

/** save each dirty section with the saver its screen owns; true when any save was refused (the saver answers false) */
async function profSaveSections(map, secs) {
  var refused = false;
  for (var index = 0; index < secs.length; index++) {
    var done = true;
    if (map === PROF_FIELDS) done = await saveProfile(secs[index]);
    else if (secs[index] === 'work') done = await saveSettings();
    else if (secs[index] === 'assign') done = await saveAutoAssign();
    if (done === false) refused = true;
  }
  return refused;
}
/** ⭐ EVERY OUTCOME CONFIRMS ITSELF. Athi: *"a confirmation message for both save and cancel."* Silence after
 *  discarding is indistinguishable from silence after saving, and the difference is the person's work. */
async function profGuardDo(which) {
  var goOn = UI._profGo;
  UI._profGo = null;
  if (typeof closeModal === 'function') closeModal();
  if (which === 'stay') {
    toast(tx('Staying — nothing was changed.'));
    return;
  }
  var map = UI._guardMap || PROF_FIELDS;
  if (which === 'save') {
    var secs = profDirtySections(map);
    /* ⚠️ WHICH SAVER DEPENDS ON WHICH SCREEN ASKED. A single saveProfile() here would have written Profile
       fields in response to a Settings prompt — the map is what tells them apart. */
    if (await profSaveSections(map, secs)) {
      toast(tx('Not saved — the reason is on the screen. Nothing was lost; you are still here.'));
      return; /* reviews5 GF-03 M1: a refused save stays on the screen with the edit in it, never navigates away over a 'Saved.' */
    }
    toast(tx('Saved.'));
  } else {
    profSnapshot(map); // whatever is on screen becomes the new baseline
    toast(tx('Changes discarded.'));
  }
  if (typeof goOn === 'function') goOn();
}
