async page => {
  const out = {};
  const typeIn = async (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  await page.reload(); await page.waitForTimeout(800);

  // ---- Round-5 #1: preset 6 at 24x24 -> Free size -> the editable pitch holds full precision; re-entering it is a no-op
  await page.evaluate(() => { const s = document.getElementById('cabSel'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await typeIn('cabX', 24); await typeIn('cabY', 24);
  const before = await page.evaluate(() => ({ pitch: SQUINT.S.pitchA, nx: SQUINT.nativeRes(SQUINT.S.pitchA).nx, ny: SQUINT.nativeRes(SQUINT.S.pitchA).ny }));
  await page.evaluate(() => document.getElementById('modeFree').click());
  const field = await page.evaluate(() => ({ pitchA: document.getElementById('pitchA').value, wallW: document.getElementById('wallW').value, wallH: document.getElementById('wallH').value }));
  await typeIn('pitchA', field.pitchA);           // re-enter exactly what the field shows
  const after = await page.evaluate(() => ({ pitch: SQUINT.S.pitchA, nx: SQUINT.nativeRes(SQUINT.S.pitchA).nx, ny: SQUINT.nativeRes(SQUINT.S.pitchA).ny, pitchB: SQUINT.S.pitchB }));
  out.r5_1 = { before, field, after, nx_unchanged: before.nx === after.nx, pitch_unchanged: before.pitch === after.pitch };

  // ---- Round-5 #4a: a pitch chip click refreshes the plan (still in Free size)
  const planBeforeChip = await page.evaluate(() => document.getElementById('planOut').innerText.split('\n')[0]);
  await page.evaluate(() => { const chips = [...document.querySelectorAll('#pitchChips .chip')]; chips.find(c => c.textContent === '3.9').click(); });
  const planAfterChip = await page.evaluate(() => ({ plan: document.getElementById('planOut').innerText.split('\n')[0], nx: SQUINT.nativeRes(SQUINT.S.pitchA).nx, ny: SQUINT.nativeRes(SQUINT.S.pitchA).ny }));
  out.r5_4_chip = { planBeforeChip, planAfterChip, plan_matches_native: planAfterChip.plan.includes(`${planAfterChip.nx} × ${planAfterChip.ny}`) };

  // ---- Round-5 #4b: mapping change + source load refresh the plan (source scale line)
  await page.evaluate(() => document.getElementById('modeCab').click());
  await page.setInputFiles('#file', 'D:/Mishal/Claude Code/SQUINT/testcard.png');
  await page.waitForFunction(() => !!SQUINT.S.src, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const planAfterLoad = await page.evaluate(() => document.getElementById('planOut').innerText);
  await page.evaluate(() => { const f = document.getElementById('fitMode'); f.value = 'native'; if (f.value !== 'native') { f.value = [...f.options].map(o => o.value).find(v => /1:1|native/i.test(v)) || f.value; } f.dispatchEvent(new Event('change', { bubbles: true })); });
  const planAfterMap = await page.evaluate(() => ({ fitMode: SQUINT.S.fitMode, plan: document.getElementById('planOut').innerText }));
  out.r5_4_map = { planAfterLoad_has_source_line: /source|scale/i.test(planAfterLoad), fitMode: planAfterMap.fitMode, plan_changed_on_map: planAfterMap.plan !== planAfterLoad, planAfterMap: planAfterMap.plan };

  // ---- sanity: selftest + untouched-preset hint unchanged
  out.selftest = await page.evaluate(() => SQUINT.selftest(true).checks.map(c => c.value));
  return JSON.stringify(out, null, 1);
}
