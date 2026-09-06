// Oracle for boxTo()'s stage rule, lifted from the REAL squint.html source.
// A chained area reduce is exact only if no intermediate texel straddles a
// final output boundary. reduceStages(sw, dw) must return stage widths that are
// integer multiples of dw, each stage <= 64:1, ending exactly at dw -- and a
// double-precision overlap-weighted chain over those stages must equal the
// direct box filter per output pixel. The old rule (ceil(cw/64)) is run as a
// red-proof: it must FAIL the same oracle, or the oracle proves nothing.
//   node tools/test-reduce-stages-node.js squint.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const js = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
function grab(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = js.indexOf('{', i);
  for (; j < js.length; j++) { if (js[j] === '{') d++; else if (js[j] === '}') { d--; if (!d) break; } }
  return js.slice(i, j + 1);
}
const ctx = { Math }; vm.createContext(ctx);
const { reduceStages } = vm.runInContext(grab('reduceStages') + '\n({reduceStages})', ctx);
const oldRule = (sw, dw) => { const out = []; let cw = sw; while (cw > dw) { cw = Math.max(dw, Math.ceil(cw / 64)); out.push(cw); } return out; };

// Direct box filter of one row, double precision, true overlap weights.
function box(src, dw) { const cw = src.length, out = new Array(dw);
  for (let j = 0; j < dw; j++) { const a = j * cw / dw, b = (j + 1) * cw / dw; let s = 0, w = 0;
    for (let i = Math.floor(a); i < Math.min(cw, Math.ceil(b)); i++) { const ov = Math.min(b, i + 1) - Math.max(a, i); if (ov > 0) { s += src[i] * ov; w += ov; } }
    out[j] = s / w; } return out; }
function chain(src, stages) { let cur = src; for (const n of stages) cur = box(cur, n); return cur; }
function maxErr(a, b) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }

let pass = 0, fail = 0;
const eq = (label, ok, detail) => { (ok ? pass++ : fail++); console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail !== undefined ? ' => ' + detail : '')); };

// deterministic LCG so the 500 cases are the same every run
let seed = 20260906; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

console.log('--- structure: ends at dw, multiples of dw, ratio <= 64 ---');
{ let bad = 0, n = 0;
  for (let k = 0; k < 500; k++) { const cw = 2 + Math.floor(rnd() * 12000), dw = 1 + Math.floor(rnd() * Math.max(1, cw - 1));
    const st = reduceStages(cw, dw); n++;
    if (st.length === 0) { if (cw !== dw) bad++; continue; }
    if (st[st.length - 1] !== dw) bad++;
    let prev = cw; for (const s of st) { if (s % dw !== 0 || prev / s > 64 + 1e-12 || s >= prev) bad++; prev = s; } }
  eq(`500 random (cw,dw): every chain ends at dw, every stage a multiple of dw, every ratio <= 64 (bad)`, bad === 0, bad); }

console.log('--- the impulse the audit used: 130 -> 2 ---');
{ const src = new Array(130).fill(0); src[64] = 1;
  const direct = box(src, 2), st = reduceStages(130, 2), got = chain(src, st);
  eq(`stages 130->2 are ${JSON.stringify(st)} (old rule gave [3,2])`, st.length === 2 && st[0] === 4 && st[1] === 2, JSON.stringify(st));
  eq(`chain == direct [1/65, 0] (max err ${maxErr(got, direct).toExponential(2)})`, maxErr(got, direct) < 1e-9, JSON.stringify(got));
  const old = chain(src, oldRule(130, 2));
  eq(`red-proof: the OLD rule splits the impulse (max err ${maxErr(old, direct).toFixed(5)} > 1e-3)`, maxErr(old, direct) > 1e-3, JSON.stringify(old)); }

console.log('--- boundary impulses either side of every final bin edge ---');
{ let worst = 0, worstOld = 0, n = 0;
  for (const [cw, dw] of [[130, 2], [4095, 64], [4096, 64], [4097, 64], [5000, 32], [8000, 100], [3732, 55], [129, 2], [65, 1], [1000, 7], [2049, 16], [4097, 3], [12000, 5], [7000, 109]]) {
    const st = reduceStages(cw, dw), so = oldRule(cw, dw);
    for (let j = 1; j < dw; j++) { const edge = Math.floor(j * cw / dw);
      for (const at of [edge - 1, edge]) { const src = new Array(cw).fill(0); src[at] = 1; const d = box(src, dw);
        worst = Math.max(worst, maxErr(chain(src, st), d)); worstOld = Math.max(worstOld, maxErr(chain(src, so), d)); n++; } } }
  eq(`${n} boundary impulses: new rule max err ${worst.toExponential(2)} < 1e-9`, worst < 1e-9);
  eq(`red-proof: old rule max err ${worstOld.toFixed(5)} > 1e-3 on the same impulses`, worstOld > 1e-3); }

console.log('--- 500 random rows (the audit\'s 436/500 finding) ---');
{ let worst = 0, diffOld = 0;
  for (let k = 0; k < 500; k++) { const cw = 65 + Math.floor(rnd() * 6000), dw = 1 + Math.floor(rnd() * Math.max(1, Math.floor(cw / 65)));
    const src = Array.from({ length: cw }, () => rnd()); const d = box(src, dw);
    worst = Math.max(worst, maxErr(chain(src, reduceStages(cw, dw)), d));
    if (maxErr(chain(src, oldRule(cw, dw)), d) > 1e-9) diffOld++; }
  eq(`new rule: max |chain - direct| over 500 random reductions = ${worst.toExponential(2)} (< 1e-9)`, worst < 1e-9);
  eq(`red-proof: old rule differs from direct in ${diffOld}/500 (expect > 300)`, diffOld > 300); }

console.log('--- single-stage cases are unchanged: cw <= 64*dw gives exactly [dw] ---');
{ let bad = 0; for (const [cw, dw] of [[3840, 2304], [4096, 64], [64, 1], [130, 3], [2000, 1000], [1000, 1000]]) { const st = reduceStages(cw, dw); const want = cw > dw ? [dw] : []; if (JSON.stringify(st) !== JSON.stringify(want)) bad++; }
  eq('six ratios <= 64 reduce in one stage exactly as before (bad)', bad === 0, bad); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
