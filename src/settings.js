"use strict";
const { Modal, PluginSettingTab, Setting, Notice } = require("obsidian");
const W = require("./workspace");
const { iCloudUrl } = require("./calendar");

function freshSync() {
  return { enabled: false, serverUrl: "https://caldav.icloud.com/", username: "", calendarName: "创作排期", calendarUrl: "", secretId: "creator-workbench-" + globalThis.crypto.randomUUID(), targets: {} };
}

function loadSettings(raw = {}) {
  const legacy = raw.schemaVersion !== 2;
  const sync = freshSync();
  if (!legacy && raw.sync) {
    for (const key of ["enabled", "serverUrl", "username", "calendarName", "calendarUrl", "secretId", "targets"]) if (raw.sync[key] !== undefined) sync[key] = raw.sync[key];
  }
  if (!/^creator-workbench-[a-z0-9-]+$/.test(sync.secretId || "")) sync.secretId = freshSync().secretId;
  sync.enabled = sync.enabled === true;
  if (!sync.targets || typeof sync.targets !== "object" || Array.isArray(sync.targets)) sync.targets = {};
  return { schemaVersion: 2, root: W.workspacePath(raw.root || "40_Writing/创作管理"), sync, migratedLegacy: legacy && !!raw.sync?.enabled };
}

function report(task) { return Promise.resolve().then(task).catch(error => new Notice(error.message || "操作未完成")); }

class SetupModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; this.root = plugin.root; this.examples = false; }
  onOpen() {
    this.modalEl.classList.add("creator-modal");
    this.contentEl.createEl("h2", { text: "初始化创作工作区" });
    this.contentEl.createEl("p", { text: "创建六个入口、模板、备用表格和横幅。已有文件会跳过；作品数据保存在普通笔记中。" });
    new Setting(this.contentEl).setName("保存目录").setDesc("知识库内的相对路径，可选择一个新目录。").addText(text => text.setValue(this.root).onChange(value => this.root = value));
    new Setting(this.contentEl).setName("加入演示作品").setDesc("7 篇演示只展示流程，不计入业绩，也不会同步到日历。").addToggle(toggle => toggle.setValue(false).onChange(value => this.examples = value));
    new Setting(this.contentEl).addButton(button => button.setButtonText("创建并打开").setCta().onClick(() => report(async () => {
      button.setDisabled(true);
      try {
        const result = await this.plugin.initializeWorkspace(this.root, this.examples);
        this.close();
        new Notice("工作区已就绪：新建 " + result.created + " 个文件，跳过 " + result.skipped + " 个已有文件");
        await this.plugin.open(this.plugin.root + "/00_工作台.md");
      } finally { button.setDisabled(false); }
    })));
  }
  onClose() { this.contentEl.replaceChildren(); }
}

class WorkbenchSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; this.password = ""; }
  display() {
    const { containerEl: el, plugin } = this;
    const sync = plugin.settings.sync;
    const values = { serverUrl: sync.serverUrl, username: sync.username, calendarName: sync.calendarName, calendarUrl: sync.calendarUrl };
    el.replaceChildren();
    new Setting(el).setName("创作工作区").setHeading();
    new Setting(el).setName("当前目录").setDesc(plugin.root).addButton(button => button.setButtonText("初始化 / 选择目录").onClick(() => new SetupModal(plugin).open()));
    new Setting(el).setName("打开工作台").addButton(button => button.setButtonText("打开").onClick(() => report(() => plugin.openWorkbench())));
    new Setting(el).setName("可选 iCloud 日历同步").setHeading();
    el.createEl("p", { text: "单向：作品笔记 → 指定 iCloud 日历。请先在 Mac Calendar 建立「创作排期」。下列连接使用本插件单独保存的凭据，不读取其他插件设置。" });
    for (const [key, name, desc] of [
      ["serverUrl", "CalDAV 服务器", "默认 https://caldav.icloud.com/；中国大陆账号可使用 https://caldav.icloud.com.cn/。"],
      ["username", "Apple 账号", "用于 iCloud CalDAV 认证的账号。"],
      ["calendarName", "日历名称", "必须与 Mac Calendar 中的 iCloud 日历名称一致。"],
      ["calendarUrl", "完整日历地址（可选）", "高级设置：已知 CalDAV 集合地址时填写；留空则自动发现。"]
    ]) new Setting(el).setName(name).setDesc(desc).addText(text => text.setValue(values[key] || "").onChange(value => values[key] = value.trim()));
    new Setting(el).setName("应用专用密码").setDesc("留空保留本插件已保存的密码；输入后点击保存。密码只写入 Obsidian SecretStorage。").addText(text => {
      text.inputEl.type = "password";
      text.inputEl.autocomplete = "new-password";
      text.setPlaceholder("输入新的应用专用密码").onChange(value => this.password = value);
    });
    new Setting(el).setName("保存连接设置").setDesc("修改连接会暂停自动同步。保存不会向云端写入事件。").addButton(button => button.setButtonText("保存").onClick(() => report(async () => {
      if (plugin.calendar.running) throw new Error("同步正在进行，请稍后保存连接设置");
      iCloudUrl(values.serverUrl);
      if (values.calendarUrl) iCloudUrl(values.calendarUrl);
      if (!values.username || !values.calendarName) throw new Error("请填写账号和日历名称");
      if (this.password) this.app.secretStorage.setSecret(sync.secretId, this.password);
      this.password = "";
      Object.assign(sync, values, { enabled: false });
      await plugin.saveSettings(); plugin.calendar.reset(); this.display();
      new Notice("连接设置已保存，请先测试连接，再启用自动同步");
    })));
    new Setting(el).setName("测试连接").setDesc("仅发现和核对指定日历，不创建测试事件。").addButton(button => button.setButtonText("测试连接").onClick(() => report(async () => {
      if (plugin.calendar.running) throw new Error("同步正在进行，请稍后测试连接");
      button.setDisabled(true);
      try { await plugin.calendar.connect(); new Notice(plugin.calendar.state.message); }
      finally { button.setDisabled(false); }
    })));
    new Setting(el).setName("自动同步排期").setDesc("启用后，真实作品的标题、平台、阶段、发布日和笔记链接会发送到 iCloud。正文和媒体不会发送。").addToggle(toggle => toggle.setValue(!!sync.enabled).onChange(value => report(async () => {
      if (value && !plugin.calendar.state.connected) { toggle.setValue(false); throw new Error("请先测试连接成功，再启用同步"); }
      sync.enabled = value; await plugin.saveSettings();
      if (value) plugin.queueCalendar();
      else { plugin.calendar.state.message = "自动同步已暂停，云端已有日程保留"; plugin.calendar.notify(); }
    })));
    new Setting(el).setName("清空本插件保存的密码").setDesc("暂停同步并清空本插件的 SecretStorage 值，不修改其他插件和云端日程。").addButton(button => button.setButtonText("清空密码").onClick(() => report(async () => {
      if (plugin.calendar.running) throw new Error("同步正在进行，请稍后清空密码");
      sync.enabled = false; this.app.secretStorage.setSecret(sync.secretId, ""); this.password = "";
      await plugin.saveSettings(); plugin.calendar.reset(); this.display();
      new Notice("本插件保存的密码已清空");
    })));
    el.createEl("p", { text: "Mac Calendar 会读取同一 iCloud 日历。Obsidian Full Calendar 可由你另行添加同一个 CalDAV 日历；本插件不会代其配置或安装。Obsidian 关闭期间不运行同步。" });
  }
  hide() { this.password = ""; }
}

module.exports = { freshSync, loadSettings, SetupModal, WorkbenchSettings };
