// playwright-cli run-code payload: the render-honesty gate against the REAL file.
//   cd <repo>; python -m http.server 8731 --bind 127.0.0.1 &
//   playwright-cli open http://127.0.0.1:8731/squint.html --browser=chrome
//   playwright-cli run-code --filename=tools/pw-render-probe.js
// Rows: build fingerprint -> SQUINT.probe() (82 checks, independent expectations)
// -> selftest -> one END-TO-END row: a period-2 stripe image at Fit, exported
// through the real Save-PNG button, decoded in-page, and its wall region's mean
// asserted at 188 +/- 2. That last row is the client-facing artifact, not a
// framebuffer. No Node APIs are used inside this payload.
async page => {
  const out = {};
  await page.reload(); await page.waitForTimeout(800);
  out.build = await page.evaluate(() => ({
    reduceStages: /reduceStages/.test(SQUINT.GLE.boxTo.toString()),
    litReduce: /uLit/.test(SQUINT.GLE.reduceTo.toString()),
    probe: typeof SQUINT.probe === 'function',
    renderer: (() => { const g = SQUINT.GLE.gl, d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'hidden'; })(),
    maxTex: SQUINT.GLE.MAXTEX }));
  const t0 = Date.now();
  out.probe = await page.evaluate(() => { const r = SQUINT.probe(); return { pass: r.pass, n: r.checks.length,
    fails: r.checks.filter(c => !c.pass).map(c => ({ name: c.name, value: c.value, expected: c.expected, tol: c.tol })),
    maxDelta: r.maxDelta }; });
  out.probeMs = Date.now() - t0;
  out.selftest = await page.evaluate(() => SQUINT.selftest(true).checks.map(c => c.value));

  // ---- end-to-end: stripes at Fit through the real export button, decoded in-page
  await page.evaluate(() => {
    const w = 2304, h = 1152, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = x % 2 ? 255 : 0, i = 4 * (y * w + x); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    Object.assign(SQUINT.S, { src: c, srcW: w, srcH: h, isVideo: false, name: 'probe-stripes.png', mode: 'sim', fitMode: 'one',
      zoomMode: 'fit', panX: 0, panY: 0, figure: false, grid: true, blur: true, bits: 16, wallBright: 1, tileVar: 0,
      arrayOn: false, procOn: false, ambMode: 'manual', ambient: 0, offAxis: 0, fill: 0.5 });
    document.getElementById('drop').classList.add('hide');
    // capture the export blob without touching the filesystem
    window.__blobs = []; const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { window.__blobs.push(b); return orig(b); };
    SQUINT.draw();
  });
  out.fitGeo = await page.evaluate(() => { const g = SQUINT.geo(); return { cell: +g.cell.toFixed(3), decim: g.decim, dispReduce: g.dispReduce, failed: g.failed }; });
  const dl = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await page.evaluate(() => document.getElementById('pngBtn').click());
  await page.waitForFunction(() => window.__blobs.length > 0, null, { timeout: 20000 });
  const d = await dl; if (d) { out.exportFile = d.suggestedFilename(); try { await d.saveAs('C:/Users/user/.claude/jobs/da6cb5ae/tmp/render-probe-export.png'); } catch (e) {} }
  out.exportMean = await page.evaluate(async () => {
    const bmp = await createImageBitmap(window.__blobs[0]);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const geo = SQUINT.geo(); const x0 = Math.round(geo.ox) + 8, y0 = Math.round(geo.oy) + 8, w = Math.round(geo.nx * geo.cell) - 16, h = Math.round(geo.ny * geo.cell) - 16;
    const p = g.getImageData(x0, y0, w, h).data; let s = 0, n = 0, mn = 255, mx = 0;
    for (let i = 0; i < p.length; i += 4) { s += p[i]; n++; mn = Math.min(mn, p[i]); mx = Math.max(mx, p[i]); }
    return { width: bmp.width, height: bmp.height, wallRegion: [x0, y0, w, h], mean: +(s / n).toFixed(2), min: mn, max: mx, expected: 187.5 };
  });
  out.exportPass = Math.abs(out.exportMean.mean - 187.5) <= 2;
  await page.reload();
  return JSON.stringify(out, null, 1);
}
