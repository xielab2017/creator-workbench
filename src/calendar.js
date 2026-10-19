"use strict";
const { Notice } = require("obsidian");
const { requestHTTPS } = require("./transport");
const CC = require("./calendar-core");

function iCloudUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("请输入有效的 iCloud HTTPS 地址"); }
  if (url.protocol !== "https:" || !/(^|\.)icloud\.com(\.cn)?$/i.test(url.hostname) || (url.port && url.port !== "443") || url.username || url.password || url.search || url.hash) throw new Error("仅支持不含凭据或查询参数的 iCloud HTTPS 日历地址");
  return url.href;
}

function xmlDocument(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("日历服务返回了不支持的 XML");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("日历服务返回的 XML 无效");
  return doc;
}

function responses(text) {
  return Array.from(xmlDocument(text).getElementsByTagNameNS("DAV:", "response"));
}

function property(item, namespace, name) {
  // Only successful propstat entries are usable; failed DAV properties can be present too.
  for (const stat of Array.from(item.getElementsByTagNameNS("DAV:", "propstat"))) {
    if (!/\s200\s/.test(stat.getElementsByTagNameNS("DAV:", "status")[0]?.textContent || "")) continue;
    const prop = stat.getElementsByTagNameNS("DAV:", "prop")[0];
    const node = prop?.getElementsByTagNameNS(namespace, name)[0];
    if (node) return node;
  }
  return null;
}

const PROPS = '<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><c:calendar-home-set/><d:displayname/><d:resourcetype/></d:prop></d:propfind>';

class CreatorCalendarSync {
  constructor(plugin) {
    this.plugin = plugin; this.running = false; this.pending = false; this.disposed = false;
    this.state = { connected: false, message: "日历同步未启用，可在插件设置中连接 iCloud", lastSync: null, count: 0 };
  }
  get config() { return this.plugin.settings.sync; }
  get app() { return this.plugin.app; }
  dispose() { this.disposed = true; this.pending = false; }
  reset() { this.state.connected = false; this.state.message = "连接设置已更新，请测试连接后启用同步"; this.notify(); }
  notify() { this.app.workspace.trigger("xielab-creation-studio:calendar-status"); }
  credentials() {
    if (!this.config.username?.trim() || !this.config.secretId?.startsWith("xielab-creation-studio-")) throw new Error("请先在插件设置中保存 iCloud 账号和应用专用密码");
    const password = this.app.secretStorage.getSecret(this.config.secretId);
    if (!password) throw new Error("未找到本插件保存的应用专用密码，请在设置中重新填写");
    return { username: this.config.username.trim(), password };
  }
  async request(url, method, credentials, options = {}) {
    if (this.disposed) throw new Error("插件已停止，同步已中断");
    let target = iCloudUrl(url);
    const bytes = new TextEncoder().encode(credentials.username + ":" + credentials.password);
    const auth = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
    for (let attempt = 0; attempt < 5; attempt++) {
      let result;
      try { result = await requestHTTPS({ url: target, method, headers: { Authorization: "Basic " + auth, ...options.headers }, body: options.body }); }
      catch { throw new Error("无法连接 iCloud 日历，请检查网络后重试"); }
      if (this.disposed) throw new Error("插件已停止，同步已中断");
      if ([401, 403].includes(result.status)) throw new Error("iCloud 认证失败，请核对账号和应用专用密码");
      if (result.status >= 300 && result.status < 400) {
        if (!result.headers.location) throw new Error("iCloud 返回了缺少地址的重定向");
        target = iCloudUrl(new URL(result.headers.location, target).href);
        continue;
      }
      return result;
    }
    throw new Error("iCloud 重定向次数过多，请核对服务器地址");
  }
  async propfind(url, credentials, depth) {
    const response = await this.request(url, "PROPFIND", credentials, { headers: { Depth: String(depth), "Content-Type": "application/xml; charset=utf-8" }, body: PROPS });
    if (response.status !== 207) throw new Error("iCloud 日历发现失败（HTTP " + response.status + "）");
    return responses(response.text);
  }
  async connect() {
    const credentials = this.credentials();
    const name = this.config.calendarName?.trim() || "创作排期";
    let selected;
    if (this.config.calendarUrl) {
      const target = iCloudUrl(this.config.calendarUrl).replace(/\/?$/, "/");
      const list = await this.propfind(target, credentials, 0);
      selected = list.find(item => property(item, "DAV:", "resourcetype")?.getElementsByTagNameNS("urn:ietf:params:xml:ns:caldav", "calendar").length && property(item, "DAV:", "displayname")?.textContent?.trim() === name);
      if (!selected) throw new Error("所填地址不是指定的日历；请核对日历名称和 CalDAV 集合地址");
      this.config.calendarUrl = target;
    } else {
      const server = iCloudUrl(this.config.serverUrl || "https://caldav.icloud.com/");
      const first = await this.propfind(server, credentials, 0);
      const principal = first.map(item => property(item, "DAV:", "current-user-principal")?.getElementsByTagNameNS("DAV:", "href")[0]?.textContent).find(Boolean);
      if (!principal) throw new Error("未找到 iCloud 日历主体，请在高级设置填写完整日历地址");
      const principalUrl = iCloudUrl(new URL(principal, server).href);
      const owner = await this.propfind(principalUrl, credentials, 0);
      const home = owner.map(item => property(item, "urn:ietf:params:xml:ns:caldav", "calendar-home-set")?.getElementsByTagNameNS("DAV:", "href")[0]?.textContent).find(Boolean);
      if (!home) throw new Error("未找到 iCloud 日历目录，请填写完整日历地址");
      const homeUrl = iCloudUrl(new URL(home, principalUrl).href);
      const calendars = await this.propfind(homeUrl, credentials, 1);
      const matches = calendars.filter(item => property(item, "DAV:", "displayname")?.textContent?.trim() === name && property(item, "DAV:", "resourcetype")?.getElementsByTagNameNS("urn:ietf:params:xml:ns:caldav", "calendar").length);
      if (matches.length !== 1) throw new Error(matches.length ? "发现多个同名日历，请在高级设置指定完整地址" : "未找到指定日历，请先在 Mac Calendar 新建 iCloud「" + name + "」");
      const href = matches[0].getElementsByTagNameNS("DAV:", "href")[0]?.textContent;
      if (!href) throw new Error("日历没有返回有效地址");
      this.config.calendarUrl = iCloudUrl(new URL(href, homeUrl).href).replace(/\/?$/, "/");
    }
    await this.plugin.saveSettings();
    this.state.connected = true; this.state.message = "已连接 iCloud「" + name + "」"; this.notify();
    return credentials;
  }
  async upsert(plan, credentials, cancelled = false) {
    if (!this.config.enabled || this.disposed) throw new Error("日历同步已暂停");
    const url = this.config.calendarUrl + encodeURIComponent(plan.work_id) + ".ics";
    if (!CC.ownedCalendar(url, this.config.calendarUrl)) throw new Error("事件地址超出指定日历");
    const current = await this.request(url, "GET", credentials);
    const headers = { "Content-Type": "text/calendar; charset=utf-8" };
    if (current.status === 200) {
      const lines = current.text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
      if (!lines.includes("X-CREATOR-WORK-ID:" + CC.escapeICS(plan.work_id)) || !lines.includes("UID:" + CC.escapeICS(plan.work_id + "@creator-workbench"))) throw new Error("发现非本作品拥有的同名资源，未覆盖");
      const etag = current.headers.etag || current.headers.ETag;
      if (!etag) throw new Error("服务器未返回版本标识，停止覆盖以避免冲突");
      headers["If-Match"] = etag;
    } else if (current.status === 404) {
      if (cancelled) return;
      headers["If-None-Match"] = "*";
    } else throw new Error("读取排期失败（HTTP " + current.status + "）");
    if (!this.config.enabled || this.disposed) throw new Error("日历同步已暂停");
    const result = await this.request(url, "PUT", credentials, { headers, body: CC.buildICS(plan, cancelled) });
    if (result.status === 412) throw new Error("排期发生并发修改，请核对日历后再次同步");
    if (![200, 201, 204].includes(result.status)) throw new Error("保存 iCloud 排期失败（HTTP " + result.status + "）");
  }
  async sync(showNotice = false) {
    if (!this.config.enabled || this.disposed) return;
    if (this.running) { this.pending = true; return; }
    this.running = true;
    try {
      // Validate the complete local plan before any calendar writes.
      const plans = this.plugin.works().map(work => CC.eventPlan(work, this.app.vault.getName())).filter(Boolean);
      if (new Set(plans.map(plan => plan.work_id)).size !== plans.length) throw new Error("发现重复作品标识，请先修复后再同步");
      const credentials = this.state.connected && this.config.calendarUrl ? this.credentials() : await this.connect();
      const key = JSON.stringify([this.plugin.root, this.config.calendarUrl, this.config.username]);
      this.config.targets ||= {};
      const managed = this.config.targets[key] ||= {};
      for (const plan of plans) {
        if (!this.config.enabled || this.disposed) return;
        const hash = JSON.stringify(plan);
        if (managed[plan.work_id]?.hash === hash) continue;
        await this.upsert(plan, credentials);
        managed[plan.work_id] = { hash, plan, cancelled: false };
        await this.plugin.saveSettings();
      }
      const ids = new Set(plans.map(plan => plan.work_id));
      for (const [id, saved] of Object.entries(managed)) {
        if (!this.config.enabled || this.disposed) return;
        if (!ids.has(id) && !saved.cancelled) {
          await this.upsert(saved.plan, credentials, true);
          saved.cancelled = true; saved.hash = "cancelled";
          await this.plugin.saveSettings();
        }
      }
      this.state = { connected: true, count: plans.length, lastSync: new Date().toISOString(), message: "已连接 iCloud「" + this.config.calendarName + "」 · " + plans.length + " 篇真实排期" };
      this.notify();
      if (showNotice) new Notice(this.state.message);
    } catch (error) {
      this.state.connected = false; this.state.message = error.message || "日历同步失败"; this.notify();
      if (showNotice) new Notice(this.state.message);
    } finally {
      this.running = false;
      if (this.pending && !this.disposed) { this.pending = false; this.plugin.queueCalendar(); }
    }
  }
}

module.exports = { CreatorCalendarSync, iCloudUrl, xmlDocument, property, responses };
