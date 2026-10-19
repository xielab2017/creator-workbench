const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, frontmatter, transfer, dragEvent, tick } = require('./harness.cjs');

async function setup(t, examples = false) { const h = harness(); t.after(h.cleanup); await h.plugin.onload(); await h.plugin.initializeWorkspace('内容创作/个人工作台', examples); return h; }

test('first install offers setup without silently creating vault notes or using network', async t => {
  const h = harness(); t.after(h.cleanup); await h.plugin.onload();
  assert.equal(h.vault.files.size, 0); assert.equal(h.requests.length, 0); assert.equal(h.plugin.saved.sync.enabled, false);
  await h.plugin.openWorkbench(); assert.equal(h.modals.length, 1); assert.match(h.modals[0].contentEl.textContent, /初始化创作工作区/);
});

test('initialization creates complete linked workspace and PNG without external assets', async t => {
  const h = await setup(t);
  for (const name of ['00_工作台','01_选题池','02_创作台','03_发布日历','04_作品库','05_数据库']) assert(h.vault.getAbstractFileByPath(h.plugin.root + '/' + name + '.md'));
  const banner = h.vault.getAbstractFileByPath(h.plugin.root + '/素材/创作横幅.png');
  assert.equal(Buffer.from(banner.binary).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  for (const file of h.vault.files.values()) {
    if (file.children || !['md','base'].includes(file.extension)) continue;
    assert(!file.text.includes('{{ROOT}}')); assert(!file.text.includes('{{TODAY}}')); assert(!file.text.includes('页面使用提示'));
    if (file.extension === 'base') assert(h.YAML.parse(file.text).views.length);
    for (const match of file.text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const target = match[1].split('|')[0].split('#')[0];
      assert(h.vault.files.has(target) || h.vault.files.has(target + '.md'), 'Missing ' + target);
    }
  }
  assert.equal(h.plugin.works().length, 0); assert.equal(h.requests.length, 0);
});

test('repeated initialization preserves user content and only creates missing files', async t => {
  const h = await setup(t); const path = h.plugin.root + '/00_工作台.md';
  h.vault.files.get(path).text = 'User-authored content';
  const result = await h.plugin.initializeWorkspace(h.plugin.root, false);
  assert.equal(h.vault.files.get(path).text, 'User-authored content'); assert.equal(result.created, 0); assert(result.skipped > 0);
});

test('setup rejects hidden paths, traversal and parent files before writing', async t => {
  const h = await setup(t); const count = h.vault.files.size;
  for (const path of ['../outside','.obsidian/plugins','/absolute','a//b','a/../b','a\\b','x\ny']) await assert.rejects(() => h.plugin.initializeWorkspace(path, false));
  assert.equal(h.vault.files.size, count);
  await h.vault.create('blocked', 'original');
  await assert.rejects(() => h.plugin.initializeWorkspace('blocked/child', false));
  assert.equal(h.vault.files.get('blocked').text, 'original');
});

test('seven opt-in examples have unique IDs, missing metrics and zero real totals', async t => {
  const h = await setup(t, true); const works = h.plugin.works();
  assert.equal(works.length, 7); assert.equal(new Set(works.map(work => work.work_id)).size, 7);
  for (const work of works) { assert.equal(work.is_demo, true); for (const key of ['views','likes','comments','saves','shares','followers_gain']) assert.equal(work[key], null); }
  const { container } = h.render('dashboard'); assert(!container.querySelector('.xcs-error'));
  assert.deepEqual([...container.querySelectorAll('.xcs-kpi strong')].map(el => el.textContent), ['0','0','0','0']);
});

test('all six views render through the bundled Markdown processor', async t => {
  const h = await setup(t, true);
  for (const view of ['dashboard','ideas','production','calendar','library','analytics']) {
    const { container } = h.render(view);
    assert(container.querySelector('.xcs-hub[data-view="'+view+'"]')); assert.equal(container.querySelectorAll('.xcs-nav button').length, 6);
    assert(!container.querySelector('.xcs-error'), container.textContent);
  }
});

test('legacy dashboard fences remain readable while new pages use the independent fence', async t => {
  const h = await setup(t);
  const page = h.vault.getAbstractFileByPath(h.plugin.root + '/00_工作台.md');
  assert(page.text.includes('```creation-studio'));
  assert(h.render('dashboard','creator-hub').container.querySelector('.xcs-hub'));
  assert(h.render('dashboard','creation-studio').container.querySelector('.xcs-hub'));
});

test('dragging a card persists the stage in the work note without altering schedule', async t => {
  const h = await setup(t);
  const file = await h.plugin.createWork({ title: '可验证的作品', status: '选题', publish_date: '2026-12-31', next_action: '开始写稿' });
  const { container } = h.render('production'); const card = container.querySelector('.xcs-card'), column = container.querySelector('.xcs-column[data-stage="写稿"]');
  const data = transfer(); dragEvent(h.dom.window, card, 'dragstart', data);
  const over = dragEvent(h.dom.window, column, 'dragover', data); assert(over.defaultPrevented);
  dragEvent(h.dom.window, column, 'drop', data); await tick();
  assert.equal(frontmatter(file.text).status, '写稿'); assert.equal(frontmatter(file.text).publish_date, '2026-12-31');
});

test('dragging a scheduled event updates its date while retaining the production stage', async t => {
  const h = await setup(t); const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const file = await h.plugin.createWork({ title: '发布排期', status: '剪辑', publish_date: today, publish_time: '20:00' });
  const { container } = h.render('calendar'), event = container.querySelector('.xcs-event');
  const target = [...container.querySelectorAll('.xcs-day')].find(el => el.dataset.date !== today && el.dataset.date.slice(0,7) === today.slice(0,7));
  const data = transfer(); dragEvent(h.dom.window, event, 'dragstart', data); dragEvent(h.dom.window, target, 'drop', data); await tick();
  const fm = frontmatter(file.text); assert.equal(fm.publish_date, target.dataset.date); assert.equal(fm.status, '剪辑'); assert.equal(fm.publish_time, '20:00');
});

test('published stage transitions ask for actual publication and review dates', async t => {
  const h = await setup(t); const file = await h.plugin.createWork({ title: '日期核对', status: '待发布' });
  await h.plugin.changeStage(h.plugin.works()[0], '待复盘');
  assert.equal(frontmatter(file.text).status, '待发布'); assert.equal(h.modals.length, 1);
});

test('legacy configuration never imports another plugin secret and pauses cloud sync', async t => {
  const h = harness({root:'已有作品',sync:{enabled:true,accountSourceId:'other-plugin',calendarUrl:'https://p231-caldav.icloud.com.cn/private/',managed:{secret:'not imported'}}}); t.after(h.cleanup);
  await h.plugin.onload();
  assert.equal(h.plugin.settings.sync.enabled, false); assert.equal(h.plugin.settings.sync.calendarUrl, ''); assert.equal(h.requests.length, 0); assert.equal(h.secretReads.length, 0);
  assert.equal(h.plugin.root, '已有作品'); assert.equal(h.plugin.saved.sync.accountSourceId, undefined);
});

test('switching workspace pauses sync and does not change the old work', async t => {
  const h = await setup(t); const file = await h.plugin.createWork({ title:'旧目录作品',status:'写稿' }); const before = file.text;
  h.plugin.settings.sync.enabled = true;
  await h.plugin.initializeWorkspace('另一个目录', false);
  assert.equal(h.plugin.settings.sync.enabled, false); assert.equal(file.text, before); assert.equal(h.plugin.works().length, 0);
});
