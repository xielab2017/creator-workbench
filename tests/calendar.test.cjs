const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/calendar-core.js');
const { harness } = require('./harness.cjs');

const plan = { work_id: 'CW-test-unique-id', title: '标题，含中文；与换行\n检查', platform: '公众号', status: '写稿', date: '2026-12-31', time: '23:50', noteUrl: 'obsidian://open?vault=Test&file=Work' };
const credentials = { username: 'creator@example.com', password: 'test-only-password' };
function response(properties, href = '/calendar/') {
  return '<d:response><d:href>'+href+'</d:href><d:propstat><d:prop>'+properties+'</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
}
function xml(responses) { return '<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'+responses+'</d:multistatus>'; }
const collection = response('<d:displayname>创作排期</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype>');
async function configured(t, handler = async () => ({status:404,headers:{},text:''}), extra = {}) {
  const h = harness({schemaVersion:2,root:'创作管理',sync:{enabled:true,username:credentials.username,secretId:'creator-workbench-test-only',calendarName:'创作排期',serverUrl:'https://caldav.icloud.com/',calendarUrl:'https://p231-caldav.icloud.com.cn/calendar/',targets:{},...extra}}, handler);
  t.after(h.cleanup); await h.plugin.onload(); h.secrets.set('creator-workbench-test-only',credentials.password); return h;
}

test('Shanghai timed events, all-day year boundary and stable cancellation UID', () => {
  const timed = C.buildICS(plan, false, new Date('2026-10-19T00:00:00Z'));
  assert(timed.includes('DTSTART:20261231T155000Z')); assert(timed.includes('DTEND:20261231T162000Z'));
  const allDay = C.buildICS({...plan,time:null}); assert(allDay.includes('DTSTART;VALUE=DATE:20261231')); assert(allDay.includes('DTEND;VALUE=DATE:20270101'));
  const cancelled = C.buildICS(plan,true); assert(cancelled.includes('UID:CW-test-unique-id@creator-workbench')); assert(cancelled.includes('STATUS:CANCELLED'));
});

test('ICS folding is lossless UTF-8 and escaped CR cannot inject properties', () => {
  const line = 'SUMMARY:'+'中文标题'.repeat(60), folded = C.foldLine(line);
  for (const part of folded.split('\r\n')) assert(Buffer.byteLength(part) <= 75);
  assert.equal(folded.replace(/\r\n /g,''),line);
  assert.equal(C.escapeICS('a,b;c\\d\re\nf'),'a\\,b\\;c\\\\d\\ne\\nf');
  assert(!C.buildICS({...plan,title:'title\rATTENDEE:evil'}).includes('\rATTENDEE:evil'));
});

test('only explicit real works sync and published dates never invent actual time', () => {
  for (const is_demo of [undefined,null,'false','true',true]) assert.equal(C.eventPlan({is_demo,work_id:plan.work_id,status:'写稿',publish_date:plan.date},'Test'),null);
  assert.equal(C.eventPlan({is_demo:false,work_id:plan.work_id,status:'搁置',publish_date:plan.date},'Test'),null);
  const published = C.eventPlan({is_demo:false,work_id:plan.work_id,title:'Published',status:'待复盘',published_date:'2026-10-19',publish_time:'20:00',path:'test.md'},'Test');
  assert.equal(published.time,null); assert.equal(published.date,'2026-10-19');
  assert.throws(()=>C.eventPlan({is_demo:false,work_id:plan.work_id,status:'写稿',publish_date:'2026-02-30'},'Test'));
  assert.throws(()=>C.buildICS({...plan,date:'2026-02-30'}));
  assert.throws(()=>C.buildICS({...plan,time:'25:00'}));
});

test('discovery uses own SecretStorage and validates a direct named calendar without writes', async t => {
  const h = await configured(t, async () => ({status:207,text:xml(collection),headers:{}}));
  await h.plugin.calendar.connect();
  assert.equal(h.plugin.calendar.state.connected,true); assert.deepEqual(h.requests.map(r=>r.method),['PROPFIND']);
  assert.deepEqual(h.secretReads,['creator-workbench-test-only']);
  assert(!JSON.stringify(h.plugin.saved).includes(credentials.password));
});

test('automatic discovery follows principal and calendar-home-set', async t => {
  const bodies = [xml(response('<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>','/')),xml(response('<c:calendar-home-set><d:href>https://p231-caldav.icloud.com.cn/calendars/</d:href></c:calendar-home-set>','/principal/')),xml(response('<d:displayname>创作排期</d:displayname><d:resourcetype><c:calendar/></d:resourcetype>','/calendars/creator/'))];
  const h = await configured(t, async () => ({status:207,text:bodies.shift(),headers:{}}),{calendarUrl:''});
  await h.plugin.calendar.connect();
  assert.equal(h.requests.length,3); assert.equal(h.plugin.settings.sync.calendarUrl,'https://p231-caldav.icloud.com.cn/calendars/creator/');
});

test('failed DAV properties, wrong calendar names and malformed XML are rejected', async t => {
  const bad = xml('<d:response><d:href>/calendar/</d:href><d:propstat><d:prop><d:displayname>创作排期</d:displayname><d:resourcetype><c:calendar/></d:resourcetype></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>');
  const h = await configured(t,async()=>({status:207,text:bad,headers:{}}));
  await assert.rejects(()=>h.plugin.calendar.connect(),/不是指定的日历/); assert.equal(h.plugin.calendar.state.connected,false);
  const other = await configured(t,async()=>({status:207,text:'<!DOCTYPE a><a/>',headers:{}}));
  await assert.rejects(()=>other.plugin.calendar.connect(),/XML/);
});

test('HTTPS and iCloud host validation prevents credential transmission to other origins', async t => {
  const h = await configured(t);
  for (const url of ['http://caldav.icloud.com/','https://icloud.com.evil.test/','https://evil.test/','https://user:pass@caldav.icloud.com/','https://caldav.icloud.com:8443/','https://caldav.icloud.com/?token=secret']) await assert.rejects(()=>h.plugin.calendar.request(url,'GET',credentials));
  assert.equal(h.requests.length,0);
});

test('redirects are explicit and reject untrusted targets before forwarding credentials', async t => {
  const h = await configured(t,async()=>({status:302,headers:{location:'https://evil.test/steal'}}));
  await assert.rejects(()=>h.plugin.calendar.request('https://caldav.icloud.com/','PROPFIND',credentials)); assert.equal(h.requests.length,1);
  const trusted = await configured(t,async record=>record.url.includes('p231-')?{status:207,text:xml(collection),headers:{}}:{status:307,headers:{location:'https://p231-caldav.icloud.com.cn/calendar/'}});
  const result = await trusted.plugin.calendar.request('https://caldav.icloud.com/','PROPFIND',credentials);
  assert.equal(result.status,207); assert.equal(trusted.requests.length,2); assert(trusted.requests.every(r=>r.method==='PROPFIND'));
});

test('conditional create and ETag update never overwrite unowned resources', async t => {
  const queue = [{status:404,headers:{}},{status:201,headers:{}},{status:200,text:C.buildICS(plan),headers:{etag:'"v1"'}},{status:204,headers:{}}];
  const h = await configured(t,async()=>queue.shift());
  await h.plugin.calendar.upsert(plan,credentials); assert.equal(h.requests[1].headers['If-None-Match'],'*');
  await h.plugin.calendar.upsert({...plan,date:'2027-01-01'},credentials); assert.equal(h.requests[3].headers['If-Match'],'"v1"');
  assert.equal(h.requests[1].url,h.requests[3].url);
  const unowned = await configured(t,async()=>({status:200,text:'UID:someone-else\r\nX-CREATOR-WORK-ID:CW-test-unique-id-spoof',headers:{etag:'"v1"'}}));
  await assert.rejects(()=>unowned.plugin.calendar.upsert(plan,credentials),/非本作品/); assert.equal(unowned.requests.length,1);
});

test('version conflicts and missing ETags stop writes', async t => {
  const queue = [{status:200,text:C.buildICS(plan),headers:{etag:'"v1"'}},{status:412,headers:{}}];
  const h = await configured(t,async()=>queue.shift());
  await assert.rejects(()=>h.plugin.calendar.upsert(plan,credentials),/并发修改/);
  const noVersion = await configured(t,async()=>({status:200,text:C.buildICS(plan),headers:{}}));
  await assert.rejects(()=>noVersion.plugin.calendar.upsert(plan,credentials),/版本标识/); assert.equal(noVersion.requests.length,1);
});

test('end-to-end mocked create, unchanged sync, reschedule and cancel preserve one UID', async t => {
  const remote = new Map(); let version = 0;
  const h = await configured(t,async r=>{
    if(r.method==='GET') return remote.has(r.url)?{status:200,text:remote.get(r.url),headers:{etag:'"'+version+'"'}}:{status:404,headers:{}};
    assert.equal(r.method,'PUT');
    if(remote.has(r.url)) assert.equal(r.headers['If-Match'],'"'+version+'"'); else assert.equal(r.headers['If-None-Match'],'*');
    remote.set(r.url,r.body);version++;return {status:201,headers:{}};
  });
  h.plugin.calendar.state.connected=true;
  const file = await h.plugin.createWork({title:'真实流程验证',status:'剪辑',publish_date:'2026-12-31',publish_time:'20:00'});
  await h.plugin.calendar.sync(); assert.equal(h.requests.length,2); assert.equal(remote.size,1);
  await h.plugin.calendar.sync(); assert.equal(h.requests.length,2);
  await h.plugin.updateWork(h.plugin.works()[0],{publish_date:'2027-01-01'}); await h.plugin.calendar.sync(); assert.equal(remote.size,1); assert([...remote.values()][0].includes('DTSTART:20270101T120000Z'));
  await h.plugin.updateWork(h.plugin.works()[0],{status:'搁置'}); await h.plugin.calendar.sync(); assert([...remote.values()][0].includes('STATUS:CANCELLED'));
  assert.equal(h.requests.filter(r=>r.method==='PUT').length,3); assert.equal(h.requests.filter(r=>r.method==='DELETE').length,0);
  assert.equal(h.plugin.calendar.state.count,0); assert(!file.text.includes(credentials.password));
});

test('demo-only sync, duplicate IDs and invalid dates perform zero event writes', async t => {
  const h = await configured(t); h.plugin.calendar.state.connected=true;
  await h.plugin.initializeWorkspace(h.plugin.root,true); await h.plugin.calendar.sync(); assert.equal(h.requests.length,0);
  const file = await h.plugin.createWork({title:'重复标识',status:'写稿',publish_date:'2026-12-31'});
  await h.vault.create(h.plugin.root+'/作品/duplicate.md',file.text); await h.plugin.calendar.sync();
  assert.match(h.plugin.calendar.state.message,/重复作品标识/); assert.equal(h.requests.length,0);
});

test('pausing or unloading prevents a pending PUT and no credentials enter notices', async t => {
  let h;
  h = await configured(t,async()=>{h.plugin.settings.sync.enabled=false;return{status:404,headers:{}};});
  await assert.rejects(()=>h.plugin.calendar.upsert(plan,credentials),/暂停/); assert.equal(h.requests.length,1);
  h.plugin.calendar.dispose(); await assert.rejects(()=>h.plugin.calendar.request('https://caldav.icloud.com/','GET',credentials),/停止/); assert.equal(h.requests.length,1);
  assert(!h.notices.join(' ').includes(credentials.password));
});
