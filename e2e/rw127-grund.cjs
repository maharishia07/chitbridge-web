/* the RW1-27 e2e files on a box that has only playwright-core: TAG=till node e2e/rw127-grund.cjs (the till), else the chit sheet */
process.argv[2] = require('path').join(__dirname, (process.env.TAG === 'till' ? 'till-return-address' : 'chit-sheet') + '.cjs');
require('./lib/grund-shim.cjs');
