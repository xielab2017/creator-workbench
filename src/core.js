"use strict";

// Pure data rules shared by the Obsidian view and the verification script.
const STAGES = ["选题", "写稿", "录制", "剪辑", "待发布", "待复盘", "已归档", "搁置"];
const ACTIVE = ["写稿", "录制", "剪辑", "待发布"];
const PUBLISHED = ["待复盘", "已归档"];
const METRICS = ["views", "likes", "comments", "saves", "shares", "followers_gain"];
const NAV = [
  ["工作台", "00_工作台.md", "dashboard"],
  ["选题池", "01_选题池.md", "ideas"],
  ["创作台", "02_创作台.md", "production"],
  ["日历", "03_发布日历.md", "calendar"],
  ["作品库", "04_作品库.md", "library"],
  ["数据库", "05_数据库.md", "analytics"]
];

function day(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:$|[T ])/);
  if (!match) return "";
  const date = new Date(match[1] + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? match[1] : "";
}

function shanghaiDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = name => parts.find(p => p.type === name).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function number(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function display(value) {
  const n = number(value);
  return n === null ? "—" : new Intl.NumberFormat("zh-CN").format(n);
}

function interactionRate(work) {
  const views = number(work.views);
  const counts = [work.likes, work.comments, work.saves, work.shares].map(number);
  if (views === null || views === 0 || counts.some(n => n === null)) return null;
  return counts.reduce((a, b) => a + b, 0) / views;
}

function published(work) {
  return PUBLISHED.includes(work.status) && !!day(work.published_date);
}

function overdue(work, today) {
  return !!day(work.task_due) && work.task_due < today && !["已归档", "搁置"].includes(work.status);
}

function monthlyStats(works, today) {
  const real = works.filter(w => w.is_demo !== true);
  const month = today.slice(0, 7);
  return {
    total: real.length,
    making: real.filter(w => ACTIVE.includes(w.status)).length,
    published: real.filter(w => published(w) && day(w.published_date).startsWith(month)).length,
    reviewed: real.filter(w => day(w.review_completed_date).startsWith(month)).length,
    needsReview: real.filter(w => w.status === "待复盘").length,
    overdue: real.filter(w => overdue(w, today)).length
  };
}

function monthGrid(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("月份必须为 YYYY-MM");
  const [year, mon] = month.split("-").map(Number);
  if (mon < 1 || mon > 12) throw new Error("月份超出范围");
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, mon - 1, 1 - offset + index));
    return { date: date.toISOString().slice(0, 10), current: date.getUTCMonth() === mon - 1 };
  });
}

function shiftMonth(month, offset) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + offset, 1)).toISOString().slice(0, 7);
}

function eventDate(work) {
  // Published works stay on their actual publication date when a plan changes.
  return PUBLISHED.includes(work.status) ? day(work.published_date) : day(work.publish_date);
}

function schedulePatch(work, target) {
  if (!day(target)) throw new Error("发布日期格式不正确");
  if (PUBLISHED.includes(work.status)) throw new Error("已发布作品请在作品笔记中核对实际发布日期");
  return { publish_date: target };
}

function validatePatch(patch) {
  if (patch.status !== undefined && !STAGES.includes(patch.status)) throw new Error("未知创作阶段");
  for (const key of ["task_due", "publish_date", "published_date", "review_date", "review_completed_date", "metrics_date"]) {
    if (patch[key] && !day(patch[key])) throw new Error(key + " 必须为有效日期 YYYY-MM-DD");
  }
  if (patch.publish_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.publish_time)) throw new Error("发布时间必须为 HH:mm");
  for (const key of METRICS) {
    if (patch[key] !== null && patch[key] !== "" && patch[key] !== undefined && (number(patch[key]) === null || !Number.isInteger(Number(patch[key])))) {
      throw new Error(key + " 必须为非负整数；未记录时留空");
    }
  }
  if (patch.published_url && !/^https?:\/\//i.test(patch.published_url)) throw new Error("发布链接需要以 http:// 或 https:// 开头");
}

function sortWork(works, today) {
  const rank = { 高: 0, 中: 1, 低: 2 };
  return [...works].sort((a, b) => Number(overdue(b, today)) - Number(overdue(a, today)) || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || (day(a.task_due) || "9999").localeCompare(day(b.task_due) || "9999") || String(a.title).localeCompare(String(b.title), "zh-CN"));
}

function safeTitle(value) {
  return String(value || "未命名作品").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 85) || "未命名作品";
}

module.exports = { STAGES, ACTIVE, PUBLISHED, METRICS, NAV, day, shanghaiDay, number, display, interactionRate, published, overdue, monthlyStats, monthGrid, shiftMonth, eventDate, schedulePatch, validatePatch, sortWork, safeTitle };
