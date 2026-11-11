'use strict';
/* A proof page whose data reads were refused or failed paints its "Try again" state, and the keyboard pack then scans one opener and reports 0 popups
   with a green row (sit-au run b, 11 Nov: tasks @390 3 -> 0, finance 4 -> 2). readFailures() names those reads so the row says "data not loaded". */
const isApi = (u) => u.split('?')[0].replace(/^https?:\/\/[^/]+/, '').indexOf('/api/') === 0;
function readFailures(responses) {
  return responses.filter((r) => r.method === 'GET' && r.status >= 400 && isApi(r.url)).map((r) => r.status + ' ' + r.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]);
}
module.exports = { readFailures };
