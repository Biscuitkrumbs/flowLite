const { chromium } = require(process.env.FLOW_PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('./server-harness.cjs');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

(async () => {
  const backend = createServer();
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    try { res.end(fs.readFileSync(file)); } catch { res.statusCode=404;res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.FLOW_BROWSER_EXE ? {executablePath:process.env.FLOW_BROWSER_EXE} : {})});
    const contexts = await Promise.all([browser.newContext({viewport:{width:390,height:780}}),browser.newContext({viewport:{width:390,height:780}})]);
    let offline = false, loseResponse = false, postCount = 0;
    for (const [i, context] of contexts.entries()) {
      await context.route('https://script.google.com/**', async route => {
        if (i === 0 && offline) return route.abort('internetdisconnected');
        const request = route.request();
        const result = request.method()==='POST' ? (++postCount,backend.post(JSON.parse(request.postData()).operation)) : backend.get();
        if (i === 0 && loseResponse && request.method()==='POST') { loseResponse=false;return route.abort('failed'); }
        await new Promise(resolve=>setTimeout(resolve,20));
        return route.fulfill({json:result});
      });
    }
    const [a,b] = await Promise.all(contexts.map(context=>context.newPage()));
    const errors=[];for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}/`;
    const settled = page => page.waitForFunction(()=>hasLoadedSharedData && !sync.inFlight && !sync.pending.length);
    await Promise.all([a.goto(url+'?cage=RC-044'),b.goto(url+'?cage=RC-017')]);
    await Promise.all([settled(a),settled(b)]);
    assert.equal(backend.get().data.cages.length,2);
    await Promise.all([a.locator('#packedButton').click(),b.locator('#workedButton').click()]);
    await Promise.all([settled(a),settled(b)]);
    const shared=backend.get().data;
    assert.ok(shared.cycles.find(c=>c.cageId==='RC-044').packedAt);
    assert.ok(shared.cycles.find(c=>c.cageId==='RC-017').workedAt);

    await a.locator('#editDetailsButton').click();await a.locator('#departmentInput').selectOption('Garden');await a.locator('#aisleInput').fill('42');await a.locator('#notesInput').fill('<img src=x onerror=alert(1)> Keep dry');await a.locator('#saveDetailsButton').click();await settled(a);
    await a.locator('#detailsButton').click();assert.match(await a.locator('#historyEvents').textContent(),/Details updated/);assert.equal(await a.locator('#historyEvents img').count(),0);await a.locator('#closeHistoryButton').click();
    await a.locator('#attentionButton').click();await a.locator('#attentionDialog button[value="Damaged stock"]').click();await settled(a);
    await a.locator('#detailsButton').click();await a.getByRole('button',{name:'Mark resolved',exact:true}).click();await settled(a);assert.equal(await a.getByRole('button',{name:'Mark resolved',exact:true}).count(),0);await a.locator('#closeHistoryButton').click();

    // An accepted action whose response is lost must be retried once by the same ID.
    loseResponse=true;await a.locator('#workedButton').click();await a.waitForFunction(()=>!sync.inFlight && sync.pending.length===1);
    await a.locator('#retrySyncButton').click();await settled(a);
    assert.equal(backend.get().data.events.filter(e=>e.cageId==='RC-044' && e.type==='worked').length,1);

    // Offline changes survive reload and replay without replacing other phones' changes.
    offline=true;await a.locator('#attentionButton').click();await a.locator('#attentionDialog button[value="Packaging"]').click();await a.waitForFunction(()=>!sync.inFlight && sync.pending.length===1);await a.reload();await a.waitForFunction(()=>hasLoadedSharedData && !sync.inFlight);
    assert.equal(await a.evaluate(()=>sync.pending.filter(op=>op.type==='attention').length),1);
    await b.locator('#emptyButton').click();await settled(b);
    offline=false;await a.locator('#retrySyncButton').click();await settled(a);
    assert.ok(backend.get().data.cycles.find(c=>c.cageId==='RC-017').closedAt);
    assert.equal(backend.get().data.events.filter(e=>e.cageId==='RC-044' && e.details?.reason==='Packaging').length,1);

    // Another phone closing this cycle prevents stale actions from modifying a new load.
    await b.goto(url+'?cage=RC-044');await settled(b);
    await b.locator('#emptyButton').click();await settled(b);
    await a.locator('#attentionButton').click();await a.locator('#attentionDialog button[value="Other"]').click();await a.waitForFunction(()=>!sync.inFlight && sync.pending[0]?.error);
    assert.equal(await a.locator('#closedCycleNotice').isVisible(),true);
    assert.equal(await a.locator('#discardPendingButton').isVisible(),true);
    await a.locator('#discardPendingButton').click();await settled(a);

    // Explicit demo mode never reads or writes shared data.
    const before=postCount;await a.goto(url+'?demo=1');await settled(a);await a.locator('#cageInput').fill('001');await a.locator('#openCageButton').click();await a.locator('#packedButton').click();assert.equal(postCount,before);assert.match(await a.locator('#sharedStatusText').textContent(),/Demo/);

    await a.locator('#qrLabelsButton').click();await a.locator('#qrStartInput').fill('044');await a.locator('#qrCountInput').fill('19');
    const promise=a.waitForEvent('download');await a.locator('#printQrLabelsButton').click();const download=await promise;await download.saveAs(path.resolve(root,'../../tmp/pdfs/browser-export-044-062.pdf'));
    assert.equal(download.suggestedFilename(),'Flow-labels-RC-044-RC-062.pdf');
    assert.deepEqual(errors,[]);
    console.log('Passed: two phone contexts; real UI actions; history/XSS; issue resolution; lost-response retry; offline reload; concurrent close; conflict recovery; isolated demo; PDF download.');
  } finally { if(browser)await browser.close();server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
