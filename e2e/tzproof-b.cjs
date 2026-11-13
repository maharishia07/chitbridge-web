// TEMP proof wrapper (removed in the next commit): fixes node's clock so the 40-day-old bill instant falls at 2026-11-14T06:00:00Z and runs the till spec under TZ=UTC
process.env.TZ = 'UTC'; const real = Date.now; const off = Date.parse('2026-11-14T06:00:00Z') - real(); Date.now = () => real() + off;
require('./till-counter-faults.cjs');
