// Runs the plan's Validation rows (a)-(e),(g) against the REAL function source
// extracted from squint.html - not a re-implementation. Pure geometry only;
// pixels/DOM need a browser.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const js = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];

function grab(name) {            // whole top-level function by brace matching
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = js.indexOf('{', i);
  for (; j < js.length; j++) { if (js[j] === '{') d++; else if (js[j] === '}') { d--; if (!d) break; } }
  return js.slice(i, j + 1);
}
const cabsSrc = js.slice(js.indexOf('const CABS=['), js.indexOf('];', js.indexOf('const CABS=[')) + 2);
const sLit = js.match(/wallMode:'cab',[^\n]*/)[0];

const src = [
  'const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));',
  'const S={wallW:6,wallH:3,pitchA:2.9,' + sLit + ' arrayOn:false,arrayGap:0,arrayN:1,procOn:false};',
  cabsSrc,
  ...['cab','cabPitch','fmtPitch','fmtM','cabPxY','cabMMY','cabRowsRes','cabTileTxt','tileMMY','syncFromCabinets','screenRes','gapPx','nativeRes'].map(grab),
  '({S,CABS,cab,cabPitch,fmtPitch,fmtM,cabPxY,cabMMY,cabRowsRes,cabTileTxt,tileMMY,syncFromCabinets,screenRes,gapPx,nativeRes})',
].join('\n');
const ctx = { Math, console }; vm.createContext(ctx);
const { S, CABS, cab, cabPitch, fmtPitch, fmtM, cabPxY, cabMMY, cabRowsRes, cabTileTxt, tileMMY, syncFromCabinets, nativeRes } = vm.runInContext(src, ctx, { filename: 'squint-geom' });

let pass = 0, fail = 0;
const eq = (label, got, want) => { const ok = Object.is(got, want) || got === want; (ok ? pass++ : fail++); console.log((ok ? 'PASS ' : 'FAIL ') + label + ' => ' + JSON.stringify(got) + (ok ? '' : '   (want ' + JSON.stringify(want) + ')')); };
const set = (o) => { Object.assign(S, o); syncFromCabinets(); };
const CUSTOM = CABS.findIndex(c => c.custom);
const snap = () => ({ pxY: cabPxY(), mmY: cabMMY(), wallW: S.wallW, wallH: S.wallH, pitch: fmtPitch(cabPitch()), ny: nativeRes(S.pitchA).ny, nx: nativeRes(S.pitchA).nx, tile: cabTileTxt(' across '), rr: cabRowsRes() });

console.log('--- (c) default Custom == preset 1 (500x500 192) ---');
set({ cabI: 1, cabX: 12, cabY: 6 }); const p1 = snap();
set({ cabI: CUSTOM, cabMM: 500, cabHMM: 500, cabPX: 192 }); const c0 = snap();
eq('(c) cabPxY', c0.pxY, p1.pxY); eq('(c) wallH', c0.wallH, p1.wallH); eq('(c) ny', c0.ny, p1.ny);
eq('(c) tile string identical to preset 1', c0.tile, p1.tile); eq('(c) tile string literal', c0.tile, '192 px across 500 mm');
eq('(c) res==0 (no clause, no warning)', c0.rr.res, 0);

console.log('--- (a) Custom 500/1000/192 @12x6 == preset 5 ---');
set({ cabI: 5, cabX: 12, cabY: 6 }); const p5 = snap();
set({ cabI: CUSTOM, cabMM: 500, cabHMM: 1000, cabPX: 192 }); const a = snap();
eq('(a) cabPxY', a.pxY, 384); eq('(a) == preset5 pxY', a.pxY, p5.pxY);
eq('(a) wallH', a.wallH, 6); eq('(a) ny', a.ny, 2304); eq('(a) nx', a.nx, 2304);
eq('(a) preset5 ny', p5.ny, 2304); eq('(a) preset5 tile string unchanged', p5.tile, '192 px across 500 mm');
eq('(a) custom tile string', a.tile, '192 × 384 px on 500 × 1000 mm'); eq('(a) res', a.rr.res, 0);

console.log('--- (b) Custom 600/337.5/231 == preset 6, cabY sweep ---');
const p6 = [], cu = [];
for (let y = 1; y <= 12; y++) { set({ cabI: 6, cabX: 12, cabY: y }); p6.push(snap()); }
for (let y = 1; y <= 12; y++) { set({ cabI: CUSTOM, cabMM: 600, cabHMM: 337.5, cabPX: 231, cabX: 12, cabY: y }); cu.push(snap()); }
for (let y = 1; y <= 8; y++) { eq(`(b) cabY=${y} ny custom==preset6`, cu[y-1].ny, p6[y-1].ny); }
for (let y = 1; y <= 12; y++) { eq(`(b) cabY=${y} custom ny == cabY*cabPxY (tiled)`, cu[y-1].ny, y*130); }
eq('(b) preset6 ny@6', p6[5].ny, 780); eq('(b) preset6 ny@9 keeps F1 residue 1169', p6[8].ny, 1169); eq('(b) custom ny@9 tiled 1170', cu[8].ny, 1170);
eq('(b) custom cabPxY', cu[5].pxY, 130); eq('(b) custom wallW', cu[5].wallW, 7.2); eq('(b) custom wallH = 6 tiles of 337.662', fmtPitch(cu[5].wallH), '2.026');
eq('(b) preset6 wallH stays 2.025', p6[5].wallH, 2.025);
eq('(b) custom res 0.0625', cu[5].rr.res, 0.0625); eq('(b) custom mmQ', fmtPitch(cu[5].rr.mmQ), '337.662');
eq('(b) preset6 tile string unchanged', p6[5].tile, '231 px across 600 mm'); eq('(b) preset6 mmY exact', p6[5].mmY, 337.5);
eq('(b) custom mmY exact (no float noise)', cu[5].mmY, 337.5);

console.log('--- (d) 500/750.9/192 -> WARN ---');
set({ cabI: CUSTOM, cabMM: 500, cabHMM: 750.9, cabPX: 192, cabX: 12, cabY: 6 }); const d = snap();
eq('(d) cabPxY', d.pxY, 288); eq('(d) res>0.1', d.rr.res > 0.1, true); eq('(d) rows', d.rr.rows.toFixed(2), '288.35'); eq('(d) mmQ', fmtPitch(d.rr.mmQ), '750');
eq('(d) wall built from the tiled height: 6 x 750 mm = 4.5 m', d.wallH, 4.5); eq('(d) ny == 6*288 (was 1730)', d.ny, 1728);

console.log('--- (e) 500/760.2/192 -> quantised clause, 500/760/192 -> WARN ---');
set({ cabHMM: 760.2 }); const e = snap();
eq('(e) 760.2 res in (0.005,0.1]', e.rr.res > 0.005 && e.rr.res <= 0.1, true); eq('(e) want', e.rr.want, 292); eq('(e) mmQ', fmtPitch(e.rr.mmQ), '760.417');
eq('(e) ny == 6*292', e.ny, 1752);
set({ cabY: 20 }); eq('(e) Codex #1: @20 cabinets ny == 20*292 = 5840 (was 5838)', nativeRes(S.pitchA).ny, 5840); set({ cabY: 6 });
set({ cabHMM: 760 }); const e2 = snap();
eq('(e) 760 is a WARN (res 0.16)', e2.rr.res > 0.1, true);

console.log('--- (g) portrait 2x10 of 500x1000 ---');
set({ cabMM: 500, cabHMM: 1000, cabPX: 192, cabX: 2, cabY: 10 }); const g = snap();
eq('(g) nx', g.nx, 384); eq('(g) ny', g.ny, 3840);

console.log('--- NaN guard: cabHMM undefined / 0 -> square ---');
set({ cabMM: 500, cabPX: 192, cabX: 12, cabY: 6, cabHMM: undefined }); eq('undefined -> pxY 192', cabPxY(), 192); eq('undefined -> wallH 3', S.wallH, 3);
set({ cabHMM: 0 }); eq('0 -> pxY 192', cabPxY(), 192); eq('0 -> ny 1152', nativeRes(S.pitchA).ny, 1152);

console.log('--- float-noise route: mm*(h/mm) vs stored ---');
set({ cabMM: 51, cabHMM: 250, cabPX: 20, cabX: 1, cabY: 1 }); eq('51/250 mmY exact (typed, no mm*(h/mm) noise)', cabMMY(), 250);
// 250 mm at pitch 2.55 is 98.04 rows -> the wall is built at 98 x 2.55 = 249.9 mm (Codex #1), not the typed 250.
eq('51/250 wallH = tiled 0.2499', fmtM(S.wallH), '0.2499'); eq('51/250 ny == 1*98', nativeRes(S.pitchA).ny, 98);

console.log('--- Codex 4b: no tolerance branch -- pathological sub-epsilon residual at 1.5e9 rows ---');
set({ cabMM: 500, cabHMM: 500.000000001, cabPX: 192, cabX: 1, cabY: 1500000000 });
eq('4b tileMMY is the quantised 500 (typed 500.000000001 discarded)', tileMMY(), 500);
eq('4b ny == cabY*cabPxY at 1.5e9 rows', nativeRes(S.pitchA).ny, 1500000000 * 192);
set({ cabHMM: 1000, cabX: 12, cabY: 6 }); eq('4b exactness kept: 500/1000/192 wallH === 6', S.wallH, 6);
set({ cabHMM: 500 }); eq('4b exactness kept: 500/500/192 wallH === 3', S.wallH, 3);

console.log('--- Codex #2: caption metre formatter byte-identical for every preset value ---');
{ let bad = 0, n = 0;
  CABS.forEach((c) => { if (c.custom) return; const mmY = c.mm * (c.ar || 1) * (c.tall || 1);
    for (let k = 1; k <= 12; k++) for (const v of [k * c.mm / 1000, k * mmY / 1000]) { n++; if (String(v) !== fmtM(v)) bad++; } });
  eq(`fmtM == String(v) over ${n} preset metre values (mismatches)`, bad, 0);
  eq('fmtM 0.3375 (preset 6 @1)', fmtM(0.3375), '0.3375'); eq('fmtM 3.7125 (preset 6 @11)', fmtM(3.7125), '3.7125');
  eq('fmtM strips tiled noise', fmtM(3.802083333333333), '3.8021'); eq('fmtM 6', fmtM(6), '6'); }

console.log('--- all presets: mmY/pxY unchanged from table maths ---');
CABS.forEach((c, i) => { if (c.custom) return; set({ cabI: i, cabX: 12, cabY: 6 });
  eq(`preset ${i} mmY`, cabMMY(), c.mm * (c.ar || 1) * (c.tall || 1)); eq(`preset ${i} pxY`, cabPxY(), Math.max(1, Math.round(c.px * (c.ar || 1) * (c.tall || 1)))); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
