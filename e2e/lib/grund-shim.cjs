/* grund-shim.cjs: run an e2e that requires '@playwright/test' with only playwright-core (the headless Chromium image on a SIT box). Usage: node e2e/lib/grund-shim.cjs e2e/<file>.cjs */
'use strict';
const Module = require('module'), fs = require('fs'), path = require('path');
const core = require('playwright-core');
const exe = (() => { try { const d = fs.readdirSync('/ms-playwright').filter((x) => /^chromium-/.test(x))[0]; return d ? '/ms-playwright/' + d + '/chrome-linux64/chrome' : undefined; } catch (_) { return undefined; } })();
const launch = core.chromium.launch.bind(core.chromium);
core.chromium.launch = (o) => launch(Object.assign({ executablePath: exe }, o || {}, { args: ['--no-sandbox'].concat((o && o.args) || []) }));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return resolve.call(this, req === '@playwright/test' ? 'playwright-core' : req, ...rest); };
process.argv.splice(1, 2, path.resolve(process.argv[2]));
require(path.resolve(process.argv[1]));
