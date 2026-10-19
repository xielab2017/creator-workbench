const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const YAML = require('yaml');
const { JSDOM } = require('jsdom');

function frontmatter(text) {
  const match = String(text).match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  return match ? YAML.parse(match[1]) : {};
}

class Events {
  constructor() { this.listeners = new Map(); }
  on(name, handler) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(handler); return { target: this, name, handler }; }
  offref(ref) { ref.target.listeners.get(ref.name)?.delete(ref.handler); }
  trigger(name, ...args) { for (const handler of this.listeners.get(name) || []) handler(...args); }
}

class Vault extends Events {
  constructor() { super(); this.files = new Map(); this.configDir = '.obsidian'; }
  getName() { return 'Test Vault'; }
  getAbstractFileByPath(path) { return this.files.get(path) || null; }
  getMarkdownFiles() { return [...this.files.values()].filter(file => file.extension === 'md'); }
  async createFolder(path) { if (this.files.has(path)) throw new Error('Already exists: ' + path); const file = { path, children: [] }; this.files.set(path, file); this.trigger('create', file); return file; }
  async create(path, text) {
    if (this.files.has(path)) throw new Error('Already exists: ' + path);
    const name = path.split('/').at(-1), extension = name.split('.').at(-1);
    const file = { path, name, basename: name.slice(0, -(extension.length + 1)), extension, text };
    this.files.set(path, file); this.trigger('create', file); return file;
  }
  async createBinary(path, data) { const file = await this.create(path, ''); file.binary = data; return file; }
  getResourcePath(file) { return 'app://test/' + encodeURIComponent(file.path); }
}

function harness(rawSettings = {}, requestHTTPS = async () => { throw new Error('Unexpected network'); }) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://test.invalid' });
  const { document, HTMLElement } = dom.window;
  HTMLElement.prototype.createEl = function(tag, options = {}) { const el = document.createElement(tag); if (options.text) el.textContent = options.text; if (options.cls) el.className = options.cls; this.append(el); return el; };
  const notices = [], modals = [], requests = [], intervals = [], events = [];
  const vault = new Vault(), metadataCache = new Events(), workspace = new Events();
  const opened = [], secrets = new Map(), reads = [];
  const leaf = { view: { getViewType: () => 'markdown' }, openFile: async file => opened.push(file.path) };
  Object.assign(workspace, { getMostRecentLeaf: () => leaf, getLeaf: () => leaf, setActiveLeaf: () => {}, openLinkText: async path => opened.push(path), onLayoutReady: () => {} });
  metadataCache.getFileCache = file => ({ frontmatter: frontmatter(file.text) });
  const app = { vault, metadataCache, workspace, secretStorage: { setSecret: (id, value) => secrets.set(id, value), getSecret: id => { reads.push(id); return secrets.get(id) || null; } }, fileManager: { processFrontMatter: async (file, handler) => {
    const fm = frontmatter(file.text); handler(fm);
    file.text = '---\n' + YAML.stringify(fm) + '---\n' + file.text.replace(/^---\n[\s\S]*?\n---\n?/, '');
    metadataCache.trigger('changed', file);
  } } };
  class Plugin {
    constructor() { this.app = app; this.manifest = { id: 'creator-workbench' }; this.commands = []; }
    async loadData() { return structuredClone(rawSettings); }
    async saveData(value) { this.saved = structuredClone(value); }
    registerEvent(ref) { events.push(ref); }
    registerInterval(id) { intervals.push(id); }
    addSettingTab(tab) { this.tab = tab; }
    addCommand(command) { this.commands.push(command); }
    addRibbonIcon() {}
    registerMarkdownCodeBlockProcessor(name, processor) { this.processor = processor; }
  }
  class Modal {
    constructor() { this.app = app; this.modalEl = document.createElement('div'); this.contentEl = this.modalEl.createEl('div'); }
    open() { modals.push(this); document.body.append(this.modalEl); this.onOpen(); }
    close() { this.onClose?.(); this.modalEl.remove(); }
  }
  class MarkdownRenderChild { constructor(container) { this.containerEl = container; } registerEvent(ref) { events.push(ref); } }
  class PluginSettingTab { constructor() { this.app = app; this.containerEl = document.createElement('div'); } }
  class Control {
    constructor(el) { this.inputEl = el; }
    setValue(value) { this.inputEl.value = value; if (this.inputEl.type === 'checkbox') this.inputEl.checked = value; return this; }
    setPlaceholder(value) { this.inputEl.placeholder = value; return this; }
    onChange(fn) { this.inputEl.addEventListener('change', () => fn(this.inputEl.type === 'checkbox' ? this.inputEl.checked : this.inputEl.value)); return this; }
    setButtonText(value) { this.inputEl.textContent = value; return this; }
    setCta() { return this; }
    setDisabled(value) { this.inputEl.disabled = value; return this; }
    onClick(fn) { this.inputEl.addEventListener('click', fn); return this; }
    addOption(value, label) { const option = this.inputEl.createEl('option', { text: label }); option.value = value; return this; }
  }
  class Setting {
    constructor(el) { this.settingEl = el.createEl('div', { cls: 'setting-item' }); this.info = this.settingEl.createEl('div'); this.control = this.settingEl.createEl('div'); }
    setName(name) { this.info.createEl('span', { text: name }); return this; }
    setDesc(desc) { this.info.createEl('small', { text: desc }); return this; }
    setHeading() { return this; }
    addText(fn) { fn(new Control(this.control.createEl('input'))); return this; }
    addDropdown(fn) { fn(new Control(this.control.createEl('select'))); return this; }
    addToggle(fn) { const input = this.control.createEl('input'); input.type = 'checkbox'; fn(new Control(input)); return this; }
    addButton(fn) { fn(new Control(this.control.createEl('button'))); return this; }
  }
  const obsidian = { Plugin, Modal, MarkdownRenderChild, PluginSettingTab, Setting, Notice: class { constructor(message) { notices.push(message); } }, stringifyYaml: YAML.stringify, normalizePath: path => path, setIcon: (el, name) => el.dataset.icon = name };
  // Transport is mocked at the HTTPS boundary; every request remains visible to tests.
  const https = { request: (url, options, callback) => {
    const { EventEmitter } = require('node:events');
    const req = new EventEmitter(); let body = '';
    req.setTimeout = () => {}; req.write = chunk => body += chunk;
    req.destroy = error => { if (error) req.emit('error', error); };
    req.end = () => { const record = { url, ...options, body }; requests.push(record); Promise.resolve().then(() => requestHTTPS(record)).then(result => {
      const response = new EventEmitter(); response.statusCode = result.status; response.headers = result.headers || {}; response.destroy = () => {};
      callback(response); if (result.text) response.emit('data', Buffer.from(result.text)); response.emit('end');
    }).catch(error => req.emit('error', error)); };
    return req;
  } };
  const sandbox = { module: { exports: {} }, require: name => { if (name === 'obsidian') return obsidian; if (name === 'node:https') return https; throw new Error('Unexpected import ' + name); }, console, Buffer, URL, Date, TextEncoder, DOMParser: dom.window.DOMParser, document, window: dom.window, globalThis: { crypto: crypto.webcrypto }, setTimeout, clearTimeout, btoa, atob };
  vm.runInNewContext(fs.readFileSync(require.resolve('../main.js'), 'utf8'), sandbox, { filename: 'main.js' });
  const plugin = new sandbox.module.exports();
  const render = view => { const container = document.body.createEl('div'); let block; plugin.processor(JSON.stringify({ view }), container, { addChild: child => { block = child; child.onload(); } }); return { container, block }; };
  const cleanup = () => { plugin.onunload(); for (const id of intervals) dom.window.clearInterval(id); for (const ref of events) ref.target.offref(ref); dom.window.close(); };
  return { plugin, app, vault, dom, notices, modals, requests, secrets, secretReads: reads, opened, render, cleanup, YAML };
}

function transfer() { const data = new Map(); return { get types() { return [...data.keys()]; }, setData: (type, value) => data.set(type, value), getData: type => data.get(type) || '', effectAllowed: '', dropEffect: '' }; }
function dragEvent(window, element, type, dataTransfer) { const event = new window.Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(event, 'dataTransfer', { value: dataTransfer }); element.dispatchEvent(event); return event; }
async function tick() { await new Promise(resolve => setImmediate(resolve)); }

module.exports = { harness, frontmatter, transfer, dragEvent, tick };
