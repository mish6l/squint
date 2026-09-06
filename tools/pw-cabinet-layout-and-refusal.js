async page => {
  const out = {};
  const T = 'C:/Users/user/.claude/jobs/da6cb5ae/tmp/';
  const typeIn = async (id, v) => page.evaluate(([id, v]) => {
    const el = document.getElementById(id); el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [id, v]);
  const selectCustom = async () => page.evaluate(() => {
    const sel = document.getElementById('cabSel');
    sel.value = String(SQUINT.CABS.findIndex(c => c.custom));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const rowsVisible = () => page.evaluate(() => ['rowCustom', 'rowCustomH', 'rowCustomPx'].map(id => getComputedStyle(document.getElementById(id)).display));
  const overflow = () => page.evaluate(() => {
    // Any input whose scrollWidth exceeds its clientWidth is clipping its value;
    // any .val span taller than one line has wrapped.
    const ins = ['cabMM', 'cabHMM', 'cabPX'].map(id => { const e = document.getElementById(id); return { id, clip: e.scrollWidth > e.clientWidth, w: e.clientWidth, v: e.value }; });
    const vals = [...document.querySelectorAll('#rowCustom .val, #rowCustomH .val, #rowCustomPx .val')].map(e => ({ t: e.textContent, h: e.getBoundingClientRect().height, wrapped: e.getBoundingClientRect().height > 20 }));
    return { ins, vals, rail: getComputedStyle(document.documentElement).getPropertyValue('--railw') || '(default)' };
  });

  // ---- default rail width (302)
  await page.evaluate(() => { try { localStorage.removeItem('squint.railw'); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(700);
  await selectCustom(); await typeIn('cabHMM', 1000);
  out.default_rows = await rowsVisible(); out.default_overflow = await overflow();
  await page.locator('#cabUI').screenshot({ path: T + 'cabui-302.png' });

  // ---- minimum rail width (240) via the persisted key the boot honours
  await page.evaluate(() => { try { localStorage.setItem('squint.railw', '240'); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(700);
  await selectCustom(); await typeIn('cabHMM', 1000);
  out.min_rows = await rowsVisible(); out.min_overflow = await overflow();
  await page.locator('#cabUI').screenshot({ path: T + 'cabui-240.png' });
  await page.evaluate(() => { try { localStorage.removeItem('squint.railw'); } catch (e) {} });

  // ---- composeExport refusal WITH content loaded (the path the first run could not reach)
  await page.reload(); await page.waitForTimeout(700);
  await page.setInputFiles('#file', 'D:/Mishal/Claude Code/SQUINT/testcard.png');
  await page.waitForFunction(() => !!SQUINT.S.src, null, { timeout: 15000 });
  out.src = await page.evaluate(() => ({ name: SQUINT.S.name, w: SQUINT.S.srcW, h: SQUINT.S.srcH }));
  await selectCustom(); await typeIn('cabMM', 500); await typeIn('cabPX', 192); await typeIn('cabHMM', 750.9);
  let dl = false; const onDl = () => { dl = true; }; page.on('download', onDl);
  await page.evaluate(() => document.getElementById('pngBtn').click());
  await page.waitForTimeout(900);
  out.refuse = await page.evaluate(() => ({ toast: document.getElementById('toast').textContent, btn: document.getElementById('pngBtn').textContent, disabled: document.getElementById('pngBtn').disabled, absBlur: SQUINT.S.absBlur }));
  out.refuse_download_fired = dl;
  page.off('download', onDl);

  // ---- and the SAME path succeeds once the height is a whole number of LEDs
  await typeIn('cabHMM', 1000);
  const dlOk = page.waitForEvent('download', { timeout: 20000 });
  await page.evaluate(() => document.getElementById('pngBtn').click());
  const d = await dlOk; await d.saveAs(T + 'export-a.png'); out.export_ok = d.suggestedFilename();
  await page.waitForTimeout(300);
  out.export_btn_after = await page.evaluate(() => ({ btn: document.getElementById('pngBtn').textContent, disabled: document.getElementById('pngBtn').disabled, absBlur: SQUINT.S.absBlur }));

  return JSON.stringify(out, null, 1);
}
