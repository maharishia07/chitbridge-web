/**
 * actor-hat.js — the actor's hat and the server's two "may hold work" answers, read once when the list from GET /api/actors is mapped.
 *
 * OWNS      hatAssignable (may this person hold a task) · jobAssignable (may this person hold a job chit) · actorHatFields (the hat and both flags of one mapped actor)
 * CALLED BY public/app.html (script tag in the first script line; mapApiActor, the assign pickers) · public/app/cap-admin.js · cap-workforce.js · cap-connector.js (hatAssignable)
 * FLOW      GET /api/actors row → actorHatFields(row) → { hat, assignable, jobAssignable } on the mapped actor → hatAssignable(actor) / jobAssignable(actor) answer from it
 * CARD      01-rail-core-the-chit/assign
 * OWNER     cb-people
 * RISK      plain
 *
 * Decides nothing: who may hold work is the SERVER's answer (`assignable`, `job_assignable` on every row, lib/assign-chit mayHold). A bare hat or level string (an old call, or a list from a server that does not send the flag yet)
 * falls back to the editor test, which is the same rule for a task. accessLevelOf stays in app.html (read at call time).
 */
/* eslint-disable no-unused-vars */
function hatAssignable(person) {
  if (person && typeof person === 'object' && typeof person.assignable === 'boolean') return person.assignable;
  return accessLevelOf(person && typeof person === 'object' ? person.hat : person) === 'editor';
}
/** may this person hold a JOB chit (a client of the firm)? the server's answer; a read-only seat may */
function jobAssignable(person) {
  return !!(person && typeof person === 'object' && person.jobAssignable === true);
}
/** the hat and the server's two flags of one api row, in the shape mapApiActor gives every actor */
function actorHatFields(row) {
  return {
    hat: row.hat || 'act',
    assignable: typeof row.assignable === 'boolean' ? row.assignable : undefined,
    jobAssignable: row.job_assignable === true
  };
}
