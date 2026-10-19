"use strict";
const { normalizePath } = require("obsidian");
const C = require("./core");
const templates = require("../assets/workspace.json");
const banner = require("../assets/banner.png");

function workspacePath(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw || raw.startsWith("/") || raw.includes("\\") || /[\x00-\x1f\x7f:*?"<>|#^\[\]]/.test(raw)) throw new Error("请输入知识库内的有效相对目录");
  if (raw.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) throw new Error("目录不能包含隐藏目录、空段或上级路径");
  return normalizePath(raw);
}

function renderTemplate(text, root, today) {
  return text.replaceAll("{{ROOT}}", root).replaceAll("{{TODAY}}", today).replaceAll("{{MONTH}}", today.slice(0, 7)).replace(/\{\{DAY([+-]\d+)\}\}/g, (_, offset) => {
    const date = new Date(today + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + Number(offset));
    return date.toISOString().slice(0, 10);
  });
}

async function folder(vault, path) {
  let current = "";
  for (const part of path.split("/")) {
    current += (current ? "/" : "") + part;
    const existing = vault.getAbstractFileByPath(current);
    if (existing && !("children" in existing)) throw new Error("目录位置已存在同名文件：" + current);
    if (!existing) await vault.createFolder(current);
  }
}

async function initialize(vault, requestedRoot, includeExamples = false, today = C.shanghaiDay()) {
  const root = workspacePath(requestedRoot);
  const plan = Object.entries(templates.files).filter(([path]) => includeExamples || !path.startsWith("示例作品/"))
    .map(([path, text]) => [root + "/" + renderTemplate(path, root, today), renderTemplate(text, root, today)]);
  const bannerPath = root + "/素材/创作横幅.png";
  // Check every destination before creating anything. Existing files are never overwritten.
  for (const [path] of [...plan, [bannerPath]]) {
    const existing = vault.getAbstractFileByPath(path);
    if (existing && "children" in existing) throw new Error("文件位置已存在同名目录：" + path);
    const parent = path.split("/").slice(0, -1);
    let current = "";
    for (const part of parent) {
      current += (current ? "/" : "") + part;
      const entry = vault.getAbstractFileByPath(current);
      if (entry && !("children" in entry)) throw new Error("目录位置已存在同名文件：" + current);
    }
  }
  let created = 0, skipped = 0;
  for (const [path, text] of plan) {
    if (vault.getAbstractFileByPath(path)) { skipped++; continue; }
    await folder(vault, path.slice(0, path.lastIndexOf("/")));
    await vault.create(path, text); created++;
  }
  if (!vault.getAbstractFileByPath(bannerPath)) {
    await folder(vault, root + "/素材");
    const bytes = Uint8Array.from(atob(banner), char => char.charCodeAt(0));
    await vault.createBinary(bannerPath, bytes.buffer); created++;
  } else skipped++;
  for (const name of ["作品", "账号数据", "月度目标"]) await folder(vault, root + "/" + name);
  return { root, created, skipped };
}

module.exports = { workspacePath, renderTemplate, folder, initialize };
