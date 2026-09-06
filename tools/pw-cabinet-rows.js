async page => {
  const out = {};
  const T = 'C:/Users/user/.claude/jobs/da6cb5ae/tmp/';
  const $ = (id) => `document.getElementById(${JSON.stringify(id)})`;
  // Type into a number input the way a user does: set value, fire 'input'.
  const typeIn = async (id, v) => page.evaluate(([id, v]) => {
    const el = document.getElementById(id); el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [id, v]);
  const selectCustom = async () => page.evaluate(() => {
    const sel = document.getElementById('cabSel');
    sel.value = String(SQUINT.CABS.findIndex(c => c.custom));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const state = () => page.evaluate(() => {
    const S = SQUINT.S, Q = SQUINT;
    const g = (id) => getComputedStyle(document.getElementById(id)).display;
    return { cabI: S.cabI, cabMM: S.cabMM, cabHMM: S.cabHMM, cabPX: S.cabPX, cabX: S.cabX, cabY: S.cabY,
      wallW: S.wallW, wallH: S.wallH, pitch: Q.cabPitch(), pxY: Q.cabPxY(), mmY: Q.cabMMY(),
      ny: Q.nativeRes(S.pitchA).ny, nx: Q.nativeRes(S.pitchA).nx, res: Q.cabRowsRes().res,
      rowCustom: g('rowCustom'), rowCustomPx: g('rowCustomPx'),
      hint: document.getElementById('cabHint').innerText,
      plan: document.getElementById('planOut') ? document.getElementById('planOut').innerText : '(no #planOut)' };
  });
  const toastText = () => page.evaluate(() => {
    const cands = [...document.querySelectorAll('#toast, .toast, [id*=toast], [class*=toast]')];
    return cands.map(e => e.innerText).filter(Boolean).join(' | ') || null;
  });

  // Always start from a fresh load of the file on disk - run-code otherwise
  // drives whatever build the tab loaded last time.
  await page.reload(); await page.waitForTimeout(800);
  out.build = await page.evaluate(() => ({ hasTileMMY: typeof SQUINT.syncFromCabinets === 'function' && /tileMMY/.test(SQUINT.syncFromCabinets.toString()), hasFmtM: /fmtM/.test(document.documentElement.outerHTML) }));

  // ---- (a) Custom 500/1000/192 @12x6 via real input events
  await selectCustom();
  await typeIn('cabMM', 500); await typeIn('cabHMM', 1000); await typeIn('cabPX', 192);
  out.a = await state();

  // ---- guide PNG for (a): intercept the download, save it
  const dlA = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate(() => SQUINT.exportTemplate());
  const dA = await dlA; await dA.saveAs(T + 'guide-a.png'); out.a_guide = dA.suggestedFilename();

  // ---- (b) Custom 600/337.5/231 vs preset 6
  await typeIn('cabMM', 600); await typeIn('cabHMM', 337.5); await typeIn('cabPX', 231);
  out.b_custom = await state();
  await page.evaluate(() => { const s = document.getElementById('cabSel'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  out.b_preset6 = await state();

  // ---- (d) 500/750.9/192 -> WARN + both exports refuse
  await selectCustom();
  await typeIn('cabMM', 500); await typeIn('cabPX', 192); await typeIn('cabHMM', 750.9);
  out.d = await state();
  let dlFired = false; page.once('download', () => { dlFired = true; });
  const rT = await page.evaluate(() => { const r = SQUINT.exportTemplate(); return r === undefined ? 'undefined' : String(r); });
  out.d_template_ret = rT; out.d_toast_after_template = await toastText();
  await page.evaluate(() => document.getElementById('pngBtn').click());
  await page.waitForTimeout(600);
  out.d_pngBtn = await page.evaluate(() => { const b = document.getElementById('pngBtn'); return { text: b.textContent, disabled: b.disabled, absBlur: SQUINT.S.absBlur }; });
  out.d_toast_after_png = await toastText();
  await page.waitForTimeout(400);
  out.d_download_fired = dlFired;

  // ---- (e) 760.2 -> quantised clause, no warning
  await typeIn('cabHMM', 760.2); out.e = await state();

  // ---- (g) portrait 2x10 of 500x1000 -> guide 384x3840
  await typeIn('cabHMM', 1000); await typeIn('cabX', 2); await typeIn('cabY', 10);
  out.g = await state();
  const dlG = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate(() => SQUINT.exportTemplate());
  const dG = await dlG; await dG.saveAs(T + 'guide-g.png'); out.g_guide = dG.suggestedFilename();

  // ---- (i) free-size crossover: rail repopulated; free height updates plan
  await typeIn('cabX', 12); await typeIn('cabY', 6);
  await page.evaluate(() => document.getElementById('modeFree').click());
  out.i_rail = await page.evaluate(() => ({ wallW: document.getElementById('wallW').value, wallH: document.getElementById('wallH').value, pitchA: document.getElementById('pitchA').value, mode: SQUINT.S.wallMode }));
  await typeIn('wallH', 4);
  out.i_after_free_edit = await page.evaluate(() => ({ wallH: SQUINT.S.wallH, ny: SQUINT.nativeRes(SQUINT.S.pitchA).ny, plan: (document.getElementById('planOut') || {}).innerText }));
  await page.evaluate(() => document.getElementById('modeCab').click());

  // ---- (c) reload, pick Custom, touch nothing -> identical to preset 1
  await page.reload(); await page.waitForTimeout(800);
  const p1 = await state();
  await selectCustom();
  const c = await state();
  out.c = { preset1_hint: p1.hint, custom_hint: c.hint, identical: p1.hint === c.hint, domHMM: await page.evaluate(() => document.getElementById('cabHMM').value), cabHMM: c.cabHMM, ny: c.ny, rows: [c.rowCustom, c.rowCustomPx] };

  // ---- (j) selftest after everything; cabinet keys untouched
  await typeIn('cabHMM', 1000);
  const before = await page.evaluate(() => ({ cabI: SQUINT.S.cabI, cabMM: SQUINT.S.cabMM, cabHMM: SQUINT.S.cabHMM, cabPX: SQUINT.S.cabPX }));
  out.j = await page.evaluate(() => SQUINT.selftest(true));
  out.j_keys_after = await page.evaluate(() => ({ cabI: SQUINT.S.cabI, cabMM: SQUINT.S.cabMM, cabHMM: SQUINT.S.cabHMM, cabPX: SQUINT.S.cabPX }));
  out.j_keys_before = before;

  // ---- screenshot of the Custom rows for the manual look
  await page.locator('#rowCustom').screenshot({ path: T + 'rows-default.png' }).catch(() => {});
  await page.locator('#cabUI').screenshot({ path: T + 'cabui-default.png' }).catch(() => {});

  return JSON.stringify(out, null, 1);
}
