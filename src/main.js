"use strict";
const { Plugin, Modal, Setting, Notice, MarkdownRenderChild, stringifyYaml, setIcon } = require("obsidian");
const C = require("./core");
const { CreatorCalendarSync } = require("./calendar");
const W = require("./workspace");
const { loadSettings, SetupModal, WorkbenchSettings } = require("./settings");

const TEXT = {
  title: "作品标题", platform: "发布平台", format: "内容形式", priority: "优先级", status: "创作阶段",
  angle: "我的切入点", next_action: "下一步行动", task_due: "下一步截止", account_name: "账号名称", publish_date: "计划发布日期",
  publish_time: "计划发布时间", published_date: "实际发布日期", published_url: "发布链接", review_date: "计划复盘日期",
  review_completed_date: "完成复盘日期", metrics_date: "数据采集日期", data_window: "数据统计窗口",
  views: "阅读 / 播放量", likes: "点赞", comments: "评论", saves: "收藏", shares: "分享", followers_gain: "作品带来涨粉"
};
const SELECTS = {
  status: C.STAGES, platform: ["待定", "公众号", "小红书", "视频号", "B站", "抖音", "其他"],
  format: ["图文", "长文", "视频", "音频", "其他"], priority: ["高", "中", "低"]
};

function element(parent, tag, cls, text) {
  const child = document.createElement(tag);
  if (cls) child.className = cls;
  if (text !== undefined) child.textContent = String(text);
  parent.appendChild(child);
  return child;
}

function button(parent, text, handler, cls = "") {
  const btn = element(parent, "button", cls, text);
  btn.type = "button";
  btn.addEventListener("click", event => {
    event.preventDefault();
    Promise.resolve().then(() => handler(event)).catch(error => new Notice(error.message || String(error)));
  });
  return btn;
}

function field(parent, key, values, label = TEXT[key], options = null) {
  const setting = new Setting(parent).setName(label);
  const choices = options || SELECTS[key];
  if (choices) {
    const all = [...new Set([...choices, values[key]].filter(Boolean))];
    setting.addDropdown(control => {
      all.forEach(value => control.addOption(value, value));
      control.setValue(values[key] || all[0]).onChange(value => values[key] = value);
    });
  } else {
    setting.addText(control => {
      if (key.endsWith("date") || key === "task_due") control.inputEl.type = "date";
      else if (key === "publish_time") control.inputEl.type = "time";
      else if (C.METRICS.includes(key) || key.endsWith("target") || key === "followers") {
        control.inputEl.type = "number";
        control.inputEl.min = "0";
        control.inputEl.step = "1";
      }
      control.setValue(values[key] === null || values[key] === undefined ? "" : String(values[key]));
      control.onChange(value => values[key] = value.trim());
      control.inputEl.setAttribute("aria-label", label || key);
    });
  }
  return setting;
}

function workBody() {
  return [
    "## 选题与切入点", "", "- 面向谁：", "- 解决什么问题：", "- 我的切入点：", "- 这篇作品只讲清楚的一件事：", "",
    "## 参考拆解", "", "| 参考链接 | 吸引人的地方 | 可借鉴结构 | 我的新信息 / 不同观点 |", "| --- | --- | --- | --- |", "| | | | |", "",
    "## 标题候选", "", "1. ", "2. ", "3. ", "",
    "## 正文 / 脚本", "", "### 开头", "", "", "### 主体", "", "", "### 结尾", "", "",
    "## 制作清单", "", "- [ ] 明确选题与自己的切入点", "- [ ] 完成标题与脚本", "- [ ] 完成事实、引用与素材来源核查",
    "- [ ] 完成录制（图文作品可标注不适用）", "- [ ] 完成剪辑 / 图文排版", "- [ ] 完成封面、字幕与最终预览",
    "- [ ] 在平台完成发布并回填链接与实际日期", "- [ ] 记录数据并完成复盘", "",
    "## 素材与成品", "", "- 封面：", "- 视频 / 音频成品：", "- 原始素材：", "- 可编辑工程：", "- 参考文献 / 授权来源：", "",
    "## 复盘", "", "- 原来的预期：", "- 观察到的表现（注明统计时间窗口）：", "- 哪个标题、开头或结构值得保留：",
    "- 哪个问题还没有证据：", "- 下一篇可验证的改动：", "- 延伸选题：", "",
    "## 工作备注", "", ""
  ].join("\n");
}

class WorkModal extends Modal {
  constructor(plugin, work = null, initial = {}) {
    super(plugin.app);
    this.plugin = plugin;
    this.work = work;
    this.values = { title: "", platform: "待定", format: "图文", priority: "中", status: "选题", next_action: "补充自己的切入点", ...work, ...initial };
  }
  onOpen() {
    this.modalEl.classList.add("xcs-modal");
    element(this.contentEl, "h2", "", this.work ? "编辑作品与排期" : "新建作品");
    element(this.contentEl, "p", "xcs-muted", "同一篇笔记保存选题、稿件、素材、排期和复盘。日期均按北京时间。图文作品可跳过录制、剪辑阶段。");
    if (this.work?.is_demo) element(this.contentEl, "p", "xcs-demo-note", "当前编辑的是演示作品，不计入真实统计。新建作品会进入真实任务。");
    for (const key of ["title", "angle", "platform", "account_name", "format", "status", "priority", "next_action", "task_due"]) field(this.contentEl, key, this.values);
    element(this.contentEl, "h3", "", "排期与发布记录");
    for (const key of ["publish_date", "publish_time", "published_date", "published_url", "review_date", "review_completed_date"]) field(this.contentEl, key, this.values);
    const actions = element(this.contentEl, "div", "xcs-actions");
    button(actions, "保存", async () => {
      if (!String(this.values.title || "").trim()) throw new Error("请先填写作品标题");
      const patch = {};
      for (const key of Object.keys(TEXT).filter(k => !C.METRICS.includes(k) && !["metrics_date", "data_window"].includes(k))) patch[key] = this.values[key] || null;
      if (C.PUBLISHED.includes(patch.status) && !C.day(patch.published_date)) throw new Error("进入待复盘或归档前，请填写实际发布日期");
      if (patch.status === "已归档" && !C.day(patch.review_completed_date)) throw new Error("归档前请填写完成复盘日期");
      const file = this.work ? await this.plugin.updateWork(this.work, patch) : await this.plugin.createWork(patch);
      this.close();
      if (!this.work) await this.plugin.open(file.path);
      new Notice("作品已保存，所有视图会同步更新");
    }, "mod-cta");
    button(actions, "取消", () => this.close());
  }
  onClose() { this.contentEl.replaceChildren(); }
}

class MetricsModal extends Modal {
  constructor(plugin, work) {
    super(plugin.app);
    this.plugin = plugin;
    this.work = work;
    this.values = { ...work };
  }
  onOpen() {
    this.modalEl.classList.add("xcs-modal");
    element(this.contentEl, "h2", "", "记录作品表现");
    element(this.contentEl, "p", "xcs-muted", this.work.title + " · 未记录的指标留空；只在真实观测为零时填 0。");
    for (const key of ["metrics_date", "data_window", ...C.METRICS]) field(this.contentEl, key, this.values);
    element(this.contentEl, "p", "xcs-muted", "数据由你从平台后台录入；每篇作品保留最新快照。需要历史序列时，在作品正文追加快照表。统计窗口示例：发布后 24 小时、发布后 7 天。");
    button(this.contentEl, "保存数据", async () => {
      const patch = { metrics_date: this.values.metrics_date || null, data_window: this.values.data_window || null };
      for (const key of C.METRICS) patch[key] = this.values[key] === "" || this.values[key] === undefined || this.values[key] === null ? null : Number(this.values[key]);
      C.validatePatch(patch);
      if (C.METRICS.some(key => patch[key] !== null) && (!patch.metrics_date || !patch.data_window)) throw new Error("填写指标时，请同时填写采集日期和统计窗口");
      await this.plugin.updateWork(this.work, patch);
      this.close();
      new Notice("数据已保存");
    }, "mod-cta");
  }
  onClose() { this.contentEl.replaceChildren(); }
}

class GoalModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; }
  onOpen() {
    const today = C.shanghaiDay();
    this.month = today.slice(0, 7);
    const goal = this.plugin.goals(this.month);
    this.values = { ...goal };
    element(this.contentEl, "h2", "", this.month + " 月度目标");
    element(this.contentEl, "p", "xcs-muted", "留空表示尚未设定。完成进度只统计真实作品。");
    field(this.contentEl, "publish_target", this.values, "发布作品目标（篇）");
    field(this.contentEl, "review_target", this.values, "完成复盘目标（篇）");
    field(this.contentEl, "followers_gain_target", this.values, "净增粉丝目标（人，账号表中核对）");
    button(this.contentEl, "保存目标", async () => {
      const patch = { type: "creator-goal", month: this.month };
      for (const key of ["publish_target", "review_target", "followers_gain_target"]) {
        const value = this.values[key];
        if (value === "" || value === undefined || value === null) patch[key] = null;
        else {
          if (C.number(value) === null || !Number.isInteger(Number(value))) throw new Error("目标必须是非负整数，或留空");
          patch[key] = Number(value);
        }
      }
      await this.plugin.saveGoal(this.month, patch);
      this.close();
      new Notice("月度目标已保存");
    }, "mod-cta");
  }
  onClose() { this.contentEl.replaceChildren(); }
}

class AccountModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; this.values = { snapshot_date: C.shanghaiDay(), platform: "公众号" }; }
  onOpen() {
    element(this.contentEl, "h2", "", "新增账号数据快照");
    element(this.contentEl, "p", "xcs-muted", "记录平台后台的真实数值。每次新建快照，保留以前的记录。");
    field(this.contentEl, "account_name", this.values);
    field(this.contentEl, "platform", this.values);
    field(this.contentEl, "snapshot_date", this.values, "快照日期");
    field(this.contentEl, "followers", this.values, "粉丝总数（人）");
    button(this.contentEl, "保存快照", async () => {
      if (!this.values.account_name?.trim()) throw new Error("请填写账号名称");
      if (!C.day(this.values.snapshot_date)) throw new Error("请填写有效快照日期");
      if (C.number(this.values.followers) === null || !Number.isInteger(Number(this.values.followers))) throw new Error("请填写非负整数粉丝总数");
      await this.plugin.createAccount({ ...this.values, followers: Number(this.values.followers) });
      this.close();
      new Notice("账号快照已保存");
    }, "mod-cta");
  }
  onClose() { this.contentEl.replaceChildren(); }
}

class HubBlock extends MarkdownRenderChild {
  constructor(container, plugin, options) {
    super(container);
    this.plugin = plugin;
    this.options = options;
    this.state = { mode: null, search: "", platform: "全部平台", month: C.shanghaiDay().slice(0, 7) };
    this.timer = null;
  }
  onload() {
    const relevant = file => file?.path?.startsWith(this.plugin.root + "/");
    this.registerEvent(this.plugin.app.metadataCache.on("changed", file => { if (relevant(file)) this.queue(); }));
    for (const event of ["create", "delete", "rename"]) this.registerEvent(this.plugin.app.vault.on(event, (file, old) => { if (relevant(file) || old?.startsWith(this.plugin.root + "/")) this.queue(); }));
    this.registerEvent(this.plugin.app.workspace.on("xielab-creation-studio:calendar-status", () => this.queue()));
    this.render();
  }
  onunload() { if (this.timer) clearTimeout(this.timer); }
  queue() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.render(); }, 180);
  }
  selected() {
    const all = this.plugin.works();
    if (this.state.mode === null) this.state.mode = all.some(w => !w.is_demo) ? "real" : "demo";
    return all.filter(work => (this.state.mode === "demo" ? work.is_demo === true : work.is_demo !== true) &&
      (!this.state.search || [work.title, work.next_action, work.angle, work.account_name].some(v => String(v || "").includes(this.state.search))) &&
      (this.state.platform === "全部平台" || work.platform === this.state.platform));
  }
  render() {
    try {
      this.containerEl.replaceChildren();
      this.rootEl = element(this.containerEl, "div", "xcs-hub");
      const view = this.options.view || "dashboard";
      this.rootEl.dataset.view = view;
      this.navigation(view);
      const works = this.selected();
      this.toolbar(view);
      if (this.state.mode === "demo") element(this.rootEl, "div", "xcs-demo-note", "示例模式 · 卡片均为演示内容，不计入真实统计。点击「新建作品」开始记录自己的创作。");
      if (view === "dashboard") this.dashboard(works);
      else if (view === "ideas") this.ideas(works);
      else if (view === "production") this.board(works);
      else if (view === "calendar") this.calendar(works);
      else if (view === "library") this.library(works);
      else if (view === "analytics") this.analytics(works);
      else throw new Error("未知页面类型：" + view);
      const foot = element(this.rootEl, "div", "xcs-footer");
      this.noteLink(foot, this.plugin.root + "/使用说明.md", "使用说明");
      element(foot, "span", "", "数据保存在作品笔记中 · 日期按北京时间 · 平台数据手动录入");
    } catch (error) {
      element(this.containerEl, "p", "xcs-error", "创作视图未能加载：" + (error.message || error));
      console.error("[xielab-creation-studio]", error);
    }
  }
  navigation(view) {
    const hero = element(this.rootEl, "div", "xcs-hero");
    const banner = this.plugin.app.vault.getAbstractFileByPath(this.plugin.root + "/素材/创作横幅.png");
    if (banner) {
      hero.classList.add("has-banner");
      hero.style.backgroundImage = `linear-gradient(90deg, rgba(249,246,240,.90), rgba(249,246,240,.45) 47%, rgba(249,246,240,0) 72%), url("${this.plugin.app.vault.getResourcePath(banner)}")`;
    }
    element(hero, "div", "xcs-eyebrow", "创作管理 / 从灵感到复盘");
    const title = C.NAV.find(item => item[2] === view)?.[0] || "创作管理";
    element(hero, "h1", "", title);
    const subtitles = { dashboard: "看清作品表现，选定本月目标，推进下一步。", ideas: "把参考拆开，再写出只有你能提供的切入点。", production: "每篇作品一张卡片，拖动卡片推进制作。", calendar: "安排发布时间，让排期与创作进度保持一致。", library: "把稿件、成品、发布链接与复盘留在一起。", analytics: "记录作品与账号表现，让下一次创作有据可依。" };
    element(hero, "p", "", subtitles[view] || "");
    const signature = element(hero, "div", "xcs-hero-signature", "灵感有处安放 · 创作有迹可循");
    signature.setAttribute("aria-hidden", "true");
    const nav = element(this.rootEl, "nav", "xcs-nav");
    const icons = ["layout-dashboard", "lightbulb", "clapperboard", "calendar-days", "folder-open", "chart-no-axes-combined"];
    const colors = ["#a58852", "#8e7aa6", "#aa7975", "#648e86", "#7088a8", "#9b7890"];
    C.NAV.forEach(([name, file, key], index) => {
      const item = button(nav, "", () => this.plugin.open(this.plugin.root + "/" + file), key === view ? "is-active" : "");
      item.style.setProperty("--nav-accent", colors[index]);
      setIcon(element(item, "span", "xcs-nav-icon"), icons[index]);
      element(item, "span", "", name);
    });
  }
  toolbar(view) {
    const tools = element(this.rootEl, "div", "xcs-toolbar");
    button(tools, "新建作品", () => new WorkModal(this.plugin).open(), "mod-cta");
    const select = element(tools, "select", "");
    [["real", "真实作品"], ["demo", "演示作品"]].forEach(([value, label]) => { const option = element(select, "option", "", label); option.value = value; });
    select.value = this.state.mode;
    select.setAttribute("aria-label", "作品范围");
    select.onchange = () => { this.state.mode = select.value; this.render(); };
    if (["ideas", "production", "library", "analytics"].includes(view)) {
      const input = element(tools, "input", "xcs-search");
      input.type = "search";
      input.placeholder = "搜索作品或下一步";
      input.value = this.state.search;
      input.setAttribute("aria-label", "搜索作品或下一步");
      const apply = () => { this.state.search = input.value.trim(); this.render(); };
      input.onkeydown = event => { if (event.key === "Enter") apply(); };
      button(tools, "筛选", apply);
      const platform = element(tools, "select", "");
      for (const name of ["全部平台", ...new Set(this.plugin.works().map(w => w.platform).filter(Boolean))]) { const option = element(platform, "option", "", name); option.value = name; }
      platform.value = this.state.platform;
      platform.setAttribute("aria-label", "按平台筛选");
      platform.onchange = () => { this.state.platform = platform.value; this.render(); };
    }
    if (view === "dashboard") button(tools, "设置月度目标", () => new GoalModal(this.plugin).open());
    if (view === "analytics") button(tools, "记录账号快照", () => new AccountModal(this.plugin).open());
    if (view === "calendar") {
      button(tools, this.plugin.settings.sync.enabled ? "同步到 iCloud" : "查看日历连接说明", () => this.plugin.settings.sync.enabled ? this.plugin.calendar.sync(true) : this.plugin.open(this.plugin.root + "/日历同步说明.md"));
    }
    button(tools, "刷新", () => this.render(), "xcs-refresh");
  }
  noteLink(parent, path, label) {
    const anchor = element(parent, "a", "internal-link", label);
    anchor.href = "#";
    anchor.dataset.href = path;
    anchor.onclick = event => { event.preventDefault(); this.plugin.open(path).catch(error => new Notice(error.message)); };
    return anchor;
  }
  heading(text, description = "") {
    const h = element(this.rootEl, "div", "xcs-section-title");
    element(h, "h2", "", text);
    if (description) element(h, "p", "xcs-muted", description);
    return h;
  }
  empty(parent, message) { element(parent, "div", "xcs-empty", message); }
  table(parent, headers, rows) {
    const wrap = element(parent, "div", "xcs-table-wrap");
    const table = element(wrap, "table", "xcs-table");
    const head = element(table, "tr", "");
    headers.forEach(h => element(head, "th", "", h));
    rows.forEach(row => {
      const tr = element(table, "tr", "");
      row.forEach(value => { const td = element(tr, "td", ""); if (typeof value === "function") value(td); else element(td, "span", "", value ?? "—"); });
    });
    if (!rows.length) this.empty(wrap, "这里还没有记录。");
  }
  card(parent, work, compact = false) {
    const card = element(parent, "article", "xcs-card" + (compact ? " is-compact" : ""));
    card.draggable = true;
    card.dataset.stage = work.status;
    card.dataset.workPath = work.path;
    card.setAttribute("aria-label", work.title + "，" + work.status);
    card.addEventListener("dragstart", event => {
      event.stopPropagation();
      if (!event.dataTransfer) return;
      event.dataTransfer.setData("application/x-creator-work", work.path);
      event.dataTransfer.setData("text/plain", work.path);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
    const top = element(card, "div", "xcs-card-top");
    element(top, "span", "xcs-pill", work.platform || "待定平台");
    if (work.priority === "高") element(top, "span", "xcs-priority", "高优先");
    this.noteLink(card, work.path, work.title || work.name).classList.add("xcs-card-title");
    if (work.angle && !compact) element(card, "p", "xcs-card-angle", work.angle);
    element(card, "p", "xcs-next", "下一步：" + (work.next_action || "待补充具体行动"));
    const meta = element(card, "div", "xcs-card-meta");
    const due = C.day(work.task_due);
    if (due) element(meta, "span", C.overdue(work, C.shanghaiDay()) ? "xcs-overdue" : "", "截止 " + due.slice(5));
    const date = C.eventDate(work);
    if (date) element(meta, "span", "", (C.PUBLISHED.includes(work.status) ? "已发 " : "计划 ") + date.slice(5) + (work.publish_time && !C.PUBLISHED.includes(work.status) ? " " + work.publish_time : ""));
    const actions = element(card, "div", "xcs-card-actions");
    button(actions, "编辑", () => new WorkModal(this.plugin, work).open());
    button(actions, "数据", () => new MetricsModal(this.plugin, work).open());
    return card;
  }
  dashboard(works) {
    const today = C.shanghaiDay();
    const stats = C.monthlyStats(this.plugin.works(), today);
    const counts = element(this.rootEl, "div", "xcs-kpis");
    [["真实作品", stats.total, "全部创作记录", "files"], ["制作中", stats.making, "写稿至待发布", "clapperboard"], ["本月已发布", stats.published, "按实际发布日期", "send"], ["待复盘", stats.needsReview, "把经验变成下一步", "notebook-pen"]].forEach(([label, count, hint, icon], index) => {
      const tile = element(counts, "div", "xcs-kpi");
      tile.dataset.tone = index;
      setIcon(element(tile, "span", "xcs-kpi-icon"), icon);
      element(tile, "span", "", label);
      element(tile, "strong", "", count);
      element(tile, "small", "", hint);
    });
    this.heading(today.slice(0, 7) + " 月度目标", "目标与完成进度只统计真实作品，示例不计入。");
    const goal = this.plugin.goals(today.slice(0, 7));
    const grid = element(this.rootEl, "div", "xcs-goals");
    for (const [label, done, target] of [["发布作品", stats.published, goal.publish_target], ["完成复盘", stats.reviewed, goal.review_target]]) {
      const box = element(grid, "div", "xcs-goal");
      const value = C.number(target);
      element(box, "strong", "", label);
      element(box, "span", "", value === null ? "目标待设定" : `${done} / ${value} 篇`);
      if (value !== null && value > 0) { const progress = element(box, "progress", ""); progress.max = value; progress.value = Math.min(done, value); }
    }
    const followerBox = element(grid, "div", "xcs-goal");
    element(followerBox, "strong", "", "净增粉丝");
    element(followerBox, "span", "", C.number(goal.followers_gain_target) === null ? "目标待设定" : `目标 ${C.display(goal.followers_gain_target)} 人`);
    this.noteLink(followerBox, this.plugin.root + "/05_数据库.md", "到账号快照核对");
    this.heading("创作流水线", this.state.mode === "demo" ? "以下阶段数量来自演示作品。" : "点击阶段进入相应页面；作品阶段与日历状态同步。");
    const strip = element(this.rootEl, "div", "xcs-stage-strip");
    C.STAGES.slice(0, 7).forEach((stage, index) => {
      const item = button(strip, "", () => this.plugin.open(this.plugin.root + "/" + (stage === "选题" ? "01_选题池.md" : C.PUBLISHED.includes(stage) ? "04_作品库.md" : "02_创作台.md")));
      element(item, "span", "", `${index + 1}. ${stage}`);
      element(item, "strong", "", works.filter(w => w.status === stage).length);
    });
    this.heading("接下来做什么", "按逾期、优先级和下一步截止日期排序。点击标题继续写作，点击编辑更新下一步。");
    const next = C.sortWork(works.filter(w => !["已归档", "搁置"].includes(w.status)), today).slice(0, 6);
    this.table(this.rootEl, ["作品", "阶段", "下一步行动", "截止", "操作"], next.map(w => [td => this.noteLink(td, w.path, w.title), w.status, w.next_action || "待补充", td => element(td, "span", C.overdue(w, today) ? "xcs-overdue" : "", w.task_due || "—"), td => button(td, "编辑", () => new WorkModal(this.plugin, w).open())]));
    this.heading("作品表现", "展示最近发布的作品；平台指标由你录入，缺失值显示为 —。");
    const recent = works.filter(C.published).sort((a, b) => b.published_date.localeCompare(a.published_date)).slice(0, 4);
    this.table(this.rootEl, ["作品", "实际发布", "阅读 / 播放", "收藏", "统计窗口", "操作"], recent.map(w => [td => this.noteLink(td, w.path, w.title), w.published_date, C.display(w.views), C.display(w.saves), w.data_window || "—", td => button(td, "录入数据", () => new MetricsModal(this.plugin, w).open())]));
  }
  ideas(works) {
    const ideas = C.sortWork(works.filter(w => w.status === "选题"), C.shanghaiDay());
    this.heading("待打磨的选题", "参考 → 拆解 → 自己的切入点 → 决定开写。点开作品，可填写参考拆解和标题候选。");
    const grid = element(this.rootEl, "div", "xcs-idea-grid");
    ideas.forEach(work => {
      const card = this.card(grid, work);
      button(card, "开始写稿", () => this.plugin.changeStage(work, "写稿"), "xcs-start");
    });
    if (!ideas.length) this.empty(grid, "还没有待打磨的选题。点击新建作品，记下灵感和自己的切入点。");
    const parked = works.filter(w => w.status === "搁置");
    if (parked.length) {
      this.heading("暂时搁置", "保留想法，需要时重新进入选题。");
      this.table(this.rootEl, ["作品", "下一步", "操作"], parked.map(w => [td => this.noteLink(td, w.path, w.title), w.next_action || "—", td => button(td, "重新选题", () => this.plugin.changeStage(w, "选题"))]));
    }
  }
  board(works) {
    this.heading("制作进度看板", "拖动卡片改变阶段；日期、下一步和优先级可在卡片中编辑。图文作品可直接从写稿移到待发布。");
    const board = element(this.rootEl, "div", "xcs-board");
    C.STAGES.slice(0, 7).forEach((stage, index) => {
      const column = element(board, "section", "xcs-column");
      column.dataset.stage = stage;
      const header = element(column, "div", "xcs-column-header");
      element(header, "span", "", stage);
      const items = C.sortWork(works.filter(w => w.status === stage), C.shanghaiDay());
      element(header, "span", "xcs-count", items.length);
      column.addEventListener("dragover", event => { if (Array.from(event.dataTransfer?.types || []).includes("application/x-creator-work")) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; column.classList.add("is-drop-target"); } });
      column.addEventListener("dragleave", event => { if (!column.contains(event.relatedTarget)) column.classList.remove("is-drop-target"); });
      column.addEventListener("drop", event => {
        event.preventDefault(); event.stopPropagation(); column.classList.remove("is-drop-target");
        if (!event.dataTransfer) return;
        const work = this.plugin.works().find(w => w.path === event.dataTransfer.getData("application/x-creator-work"));
        if (work) this.plugin.changeStage(work, stage).catch(error => new Notice(error.message));
      });
      items.forEach(w => this.card(column, w, true));
      if (!items.length) this.empty(column, "拖入作品");
      button(column, "新建作品", () => new WorkModal(this.plugin, null, { status: index >= 5 ? "选题" : stage }).open(), "xcs-column-add");
    });
  }
  calendar(works) {
    const sync = this.plugin.calendar.state;
    const panel = element(this.rootEl, "div", "xcs-sync-status" + (sync.connected ? " is-connected" : ""));
    element(panel, "span", "xcs-sync-dot");
    element(panel, "span", "", sync.message);
    if (sync.lastSync) element(panel, "small", "", "最近同步 " + new Date(sync.lastSync).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }));
    this.heading("发布月历", "点击日期新建排期；拖动未发布卡片调整计划日期。已发布作品按实际日期显示。改排期会保留当前制作阶段。");
    const controls = element(this.rootEl, "div", "xcs-calendar-controls");
    button(controls, "上个月", () => { this.state.month = C.shiftMonth(this.state.month, -1); this.render(); });
    element(controls, "strong", "", this.state.month);
    button(controls, "下个月", () => { this.state.month = C.shiftMonth(this.state.month, 1); this.render(); });
    button(controls, "本月", () => { this.state.month = C.shanghaiDay().slice(0, 7); this.render(); });
    const grid = element(this.rootEl, "div", "xcs-calendar");
    ["一", "二", "三", "四", "五", "六", "日"].forEach(name => element(grid, "div", "xcs-weekday", name));
    const today = C.shanghaiDay();
    for (const cell of C.monthGrid(this.state.month)) {
      const dayEl = element(grid, "section", "xcs-day" + (!cell.current ? " is-other-month" : "") + (cell.date === today ? " is-today" : ""));
      dayEl.dataset.date = cell.date;
      const dateButton = button(dayEl, String(Number(cell.date.slice(8))), () => new WorkModal(this.plugin, null, { publish_date: cell.date }).open(), "xcs-day-number");
      dateButton.setAttribute("aria-label", cell.date + " 新建排期");
      works.filter(w => C.eventDate(w) === cell.date).sort((a,b) => String(a.publish_time || "").localeCompare(String(b.publish_time || ""))).forEach(work => {
        const event = element(dayEl, "div", "xcs-event");
        event.dataset.stage = work.status;
        event.draggable = !C.PUBLISHED.includes(work.status);
        event.addEventListener("dragstart", e => { e.stopPropagation(); if (!e.dataTransfer) return; e.dataTransfer.setData("application/x-creator-work", work.path); e.dataTransfer.effectAllowed = "move"; });
        element(event, "span", "xcs-event-stage", (work.publish_time && !C.PUBLISHED.includes(work.status) ? work.publish_time + " · " : "") + work.status);
        this.noteLink(event, work.path, work.title);
        button(event, "改排期", () => new WorkModal(this.plugin, work).open(), "xcs-event-edit");
      });
      dayEl.addEventListener("dragover", e => { if (Array.from(e.dataTransfer?.types || []).includes("application/x-creator-work")) { e.preventDefault(); e.stopPropagation(); dayEl.classList.add("is-drop-target"); } });
      dayEl.addEventListener("dragleave", e => { if (!dayEl.contains(e.relatedTarget)) dayEl.classList.remove("is-drop-target"); });
      dayEl.addEventListener("drop", async e => {
        e.preventDefault(); e.stopPropagation(); dayEl.classList.remove("is-drop-target");
        if (!e.dataTransfer) return;
        const work = this.plugin.works().find(w => w.path === e.dataTransfer.getData("application/x-creator-work"));
        if (!work) return;
        try { await this.plugin.updateWork(work, C.schedulePatch(work, cell.date)); new Notice("已调整计划发布日期，制作阶段保持不变"); } catch (error) { new Notice(error.message); }
      });
    }
    this.heading("尚未排期", "把下面的卡片拖到日期上，或点击编辑填写计划日期和时间。");
    const backlog = works.filter(w => !C.eventDate(w) && !C.PUBLISHED.includes(w.status) && w.status !== "搁置");
    const list = element(this.rootEl, "div", "xcs-idea-grid");
    backlog.forEach(w => this.card(list, w, true));
    if (!backlog.length) this.empty(list, "没有尚未排期的作品。");
  }
  library(works) {
    this.heading("作品总库", "标题打开完整笔记；正文、视频、原始素材与可编辑工程都可在同一笔记中链接或嵌入。");
    const ordered = [...works].sort((a, b) => (C.eventDate(b) || "").localeCompare(C.eventDate(a) || ""));
    this.table(this.rootEl, ["作品", "平台 / 形式", "阶段", "计划发布", "实际发布", "发布链接", "操作"], ordered.map(w => [
      td => this.noteLink(td, w.path, w.title), `${w.platform || "待定"} / ${w.format || "—"}`, w.status,
      w.publish_date || "—", w.published_date || "—", td => {
        if (w.published_url && /^https?:\/\//i.test(w.published_url)) { const link = element(td, "a", "external-link", "查看作品"); link.href = w.published_url; link.target = "_blank"; link.rel = "noopener noreferrer"; }
        else element(td, "span", "", "—");
      }, td => { button(td, "编辑", () => new WorkModal(this.plugin, w).open()); button(td, "数据", () => new MetricsModal(this.plugin, w).open()); }
    ]));
    const links = element(this.rootEl, "div", "xcs-actions");
    this.noteLink(links, this.plugin.root + "/视图/作品总表.base", "打开原生 Bases 表格");
    this.noteLink(links, this.plugin.root + "/99_模板/作品模板.md", "查看作品模板");
  }
  analytics(works) {
    this.heading("作品表现数据库", "每篇作品展示最新录入快照。比较前请统一平台、采集时点和统计窗口；空白数据不参与互动率计算。");
    this.table(this.rootEl, ["作品", "平台", "采集日期", "统计窗口", "阅读 / 播放", "点赞", "评论", "收藏", "分享", "涨粉", "互动 / 阅读播放", "操作"], works.map(w => [
      td => this.noteLink(td, w.path, w.title), w.platform || "—", w.metrics_date || "—", w.data_window || "—",
      ...C.METRICS.map(key => C.display(w[key])), C.interactionRate(w) === null ? "—" : (C.interactionRate(w) * 100).toFixed(1) + "%",
      td => button(td, "录入", () => new MetricsModal(this.plugin, w).open())
    ]));
    element(this.rootEl, "p", "xcs-muted", "互动 / 阅读播放 =（点赞 + 评论 + 收藏 + 分享）÷ 阅读 / 播放量。该比值统计互动次数，非去重用户转化率；四项互动数据或分母缺失时不计算，分母为 0 时不计算。");
    this.heading("账号数据快照", "点击「记录账号快照」新增记录，旧快照保留。净增粉丝请比较同一平台、同一账号、相同统计口径的两个时点。");
    const accounts = this.plugin.records("creator-account-snapshot").filter(a => !a.is_demo).sort((a, b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)));
    this.table(this.rootEl, ["账号记录", "平台", "账号", "快照日期", "粉丝总数"], accounts.map(a => [td => this.noteLink(td, a.path, a.name), a.platform, a.account_name, a.snapshot_date, C.display(a.followers)]));
    this.heading("复盘队列", "完成复盘后回填完成日期，并把作品移入已归档。记录下一篇可以验证的一个改动。");
    this.table(this.rootEl, ["作品", "复盘日期", "下一步", "操作"], works.filter(w => w.status === "待复盘").map(w => [td => this.noteLink(td, w.path + "#复盘", w.title), w.review_date || "待安排", w.next_action || "待补充", td => button(td, "完成复盘", () => new WorkModal(this.plugin, w, { status: "已归档" }).open())]));
    this.noteLink(this.rootEl, this.plugin.root + "/视图/账号快照.base", "打开账号原生 Bases 表格");
  }
}

module.exports = class CreatorWorkbench extends Plugin {
  async onload() {
    this.settings = loadSettings(await this.loadData() || {});
    this.root = this.settings.root;
    this.calendar = new CreatorCalendarSync(this);
    this.addSettingTab(new WorkbenchSettings(this.app, this));
    await this.saveSettings();
    const renderHub = (source, el, ctx) => {
      try { ctx.addChild(new HubBlock(el, this, source.trim() ? JSON.parse(source) : {})); }
      catch (error) { element(el, "p", "xcs-error", "视图配置错误：" + error.message); }
    };
    this.registerMarkdownCodeBlockProcessor("creation-studio", renderHub);
    this.registerMarkdownCodeBlockProcessor("creator-hub", renderHub);
    this.addCommand({ id: "open-workbench", name: "打开创作工作台", callback: () => this.openWorkbench().catch(error => new Notice(error.message)) });
    this.addCommand({ id: "initialize-workspace", name: "初始化创作工作区", callback: () => new SetupModal(this).open() });
    this.addCommand({ id: "new-work", name: "新建创作作品", callback: () => new WorkModal(this).open() });
    this.addCommand({ id: "open-calendar", name: "打开发布日历", callback: () => this.open(this.root + "/03_发布日历.md") });
    this.addCommand({ id: "sync-calendar", name: "同步创作排期到 iCloud", callback: () => { if (!this.settings.sync.enabled) { new Notice("请先在插件设置中连接日历并启用同步"); return; } return this.calendar.sync(true); } });
    this.registerEvent(this.app.metadataCache.on("changed", file => {
      if (file.path.startsWith(this.root + "/") && this.app.metadataCache.getFileCache(file)?.frontmatter?.type === "creator-work") this.queueCalendar();
    }));
    this.registerEvent(this.app.vault.on("delete", file => { if (file.path.startsWith(this.root + "/")) this.queueCalendar(); }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => { if (file.path.startsWith(this.root + "/") || oldPath.startsWith(this.root + "/")) this.queueCalendar(); }));
    this.registerInterval(window.setInterval(() => this.calendar.sync(false), 60000));
    this.app.workspace.onLayoutReady(() => this.queueCalendar());
    this.addRibbonIcon("panels-top-left", "创作管理工作台", () => this.openWorkbench().catch(error => new Notice(error.message)));
    if (this.settings.migratedLegacy) new Notice("发布版已暂停旧版日历连接，请在插件设置中单独配置；作品笔记和已有日程保留。", 10000);
  }
  onunload() { if (this.calendarTimer) clearTimeout(this.calendarTimer); this.calendar?.dispose(); }
  async saveSettings() { await this.saveData(this.settings); }
  async initializeWorkspace(root, examples) {
    if (this.calendar.running) throw new Error("同步正在进行，请稍后初始化或切换目录");
    const result = await W.initialize(this.app.vault, root, examples);
    if (this.root !== result.root) { this.settings.sync.enabled = false; this.calendar.reset(); }
    this.root = result.root; this.settings.root = result.root;
    await this.saveSettings();
    return result;
  }
  async openWorkbench() {
    if (!this.app.vault.getAbstractFileByPath(this.root + "/00_工作台.md")) { new SetupModal(this).open(); return; }
    await this.open(this.root + "/00_工作台.md");
  }
  queueCalendar() {
    if (this.calendarTimer) clearTimeout(this.calendarTimer);
    this.calendarTimer = setTimeout(() => { this.calendarTimer = null; this.calendar.sync(false); }, 1200);
  }
  records(type) {
    return this.app.vault.getMarkdownFiles().filter(file => file.path.startsWith(this.root + "/")).map(file => {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      return { ...fm, path: file.path, name: file.basename };
    }).filter(record => record.type === type);
  }
  works() { return this.records("creator-work").map(w => ({ ...w, title: w.title || w.name, status: w.status || "选题" })); }
  goals(month) { return this.records("creator-goal").find(goal => goal.month === month) || {}; }
  async open(path) {
    const [filePath, fragment] = path.split("#");
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) throw new Error("找不到笔记：" + filePath);
    let leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf || !["markdown", "bases"].includes(leaf.view.getViewType())) leaf = this.app.workspace.getLeaf("tab");
    const isPage = this.app.metadataCache.getFileCache(file)?.frontmatter?.type === "creator-page";
    await leaf.openFile(file, isPage ? { active: true, state: { mode: "preview" } } : { active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    if (fragment) await this.app.workspace.openLinkText(path, filePath, false);
  }
  async ensureFolder(path) {
    let current = "";
    for (const part of path.split("/").filter(Boolean)) {
      current += (current ? "/" : "") + part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
  async updateWork(work, patch) {
    C.validatePatch(patch);
    const file = this.app.vault.getAbstractFileByPath(work.path);
    if (!file || !work.path.startsWith(this.root + "/")) throw new Error("作品笔记已移动，请刷新后重试");
    await this.app.fileManager.processFrontMatter(file, fm => {
      if (fm.type !== "creator-work" || fm.work_id !== work.work_id) throw new Error("作品标识发生变化，请刷新后重试");
      Object.assign(fm, patch, { updated: C.shanghaiDay() });
    });
    return file;
  }
  async changeStage(work, stage) {
    if (stage === work.status) return;
    if ((C.PUBLISHED.includes(stage) && !C.day(work.published_date)) || (stage === "已归档" && !C.day(work.review_completed_date))) {
      new WorkModal(this, work, { status: stage }).open();
      new Notice(stage === "已归档" ? "核对实际发布与完成复盘日期后保存" : "请核对实际发布日期后保存；这里只记录发布状态");
      return;
    }
    await this.updateWork(work, { status: stage });
    new Notice("已移到「" + stage + "」");
  }
  uuid() { return globalThis.crypto.randomUUID(); }
  async createWork(patch) {
    C.validatePatch(patch);
    const directory = this.root + "/作品";
    await this.ensureFolder(directory);
    const id = this.uuid();
    const properties = { type: "creator-work", work_id: "CW-" + id, is_demo: false, ...patch, created: C.shanghaiDay(), updated: C.shanghaiDay() };
    return this.app.vault.create(`${directory}/${C.safeTitle(patch.title)}--${id}.md`, "---\n" + stringifyYaml(properties) + "---\n\n# " + patch.title + "\n\n" + workBody());
  }
  async saveGoal(month, patch) {
    await this.ensureFolder(this.root + "/月度目标");
    const path = this.root + "/月度目标/" + month + ".md";
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) await this.app.fileManager.processFrontMatter(file, fm => Object.assign(fm, patch));
    else await this.app.vault.create(path, "---\n" + stringifyYaml(patch) + "---\n\n# " + month + " 月度目标\n\n## 本月重点\n\n- \n\n## 月末复盘\n\n- 做对了什么：\n- 下月调整：\n");
  }
  async createAccount(patch) {
    await this.ensureFolder(this.root + "/账号数据");
    const path = `${this.root}/账号数据/${patch.snapshot_date}-${C.safeTitle(patch.account_name)}--${this.uuid()}.md`;
    const properties = { type: "creator-account-snapshot", ...patch, is_demo: false };
    await this.app.vault.create(path, "---\n" + stringifyYaml(properties) + "---\n\n# 账号数据快照\n\n## 数据来源与口径\n\n- 后台页面 / 导出文件：\n- 记录时间：\n- 粉丝指标定义：\n\n## 观察与下一步\n\n- \n");
  }
};
