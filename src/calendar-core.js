"use strict";

function escapeICS(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\r\n?|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function foldLine(line) {
  const encoder = new TextEncoder();
  let current = "", size = 0, result = [];
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (size + length > 75) { result.push(current); current = " "; size = 1; }
    current += char; size += length;
  }
  result.push(current);
  return result.join("\r\n");
}

function stamp(date) { return date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"; }

function eventPlan(work, vaultName) {
  if (work.is_demo !== false || !work.work_id || work.status === "搁置") return null;
  if (!/^(?:CW-)?[a-zA-Z0-9][a-zA-Z0-9_-]{3,160}$/.test(work.work_id)) throw new Error("作品标识无效，请使用自动生成的唯一标识");
  if (!["选题", "写稿", "录制", "剪辑", "待发布", "待复盘", "已归档"].includes(work.status)) throw new Error("作品阶段无效");
  const date = ["待复盘", "已归档"].includes(work.status) ? work.published_date : work.publish_date;
  if (!date) return null;
  const parsed = new Date(String(date) + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("作品日期无效：" + (work.title || work.work_id));
  if (work.publish_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(work.publish_time)) throw new Error("作品发布时间无效：" + (work.title || work.work_id));
  const time = ["待复盘", "已归档"].includes(work.status) ? null : work.publish_time || null;
  const noteUrl = "obsidian://open?vault=" + encodeURIComponent(vaultName) + "&file=" + encodeURIComponent(work.path);
  return { work_id: work.work_id, title: work.title, platform: work.platform || "待定", status: work.status, date, time, noteUrl };
}

function buildICS(plan, cancelled = false, now = new Date()) {
  if (!plan?.work_id || !/^\d{4}-\d{2}-\d{2}$/.test(plan.date)) throw new Error("缺少有效的作品标识或排期日期");
  const day = new Date(plan.date + "T00:00:00Z");
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== plan.date || (plan.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.time))) throw new Error("排期日期或时间无效");
  const utc = new Date(plan.date + "T" + (plan.time || "00:00") + ":00+08:00");
  if (!Number.isFinite(utc.getTime())) throw new Error("排期时间无效");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Xie Lab//Creator Workbench//ZH", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    "UID:" + escapeICS(plan.work_id + "@creator-workbench"), "DTSTAMP:" + stamp(now), "LAST-MODIFIED:" + stamp(now),
    "X-CREATOR-WORK-ID:" + escapeICS(plan.work_id)];
  if (plan.time) {
    lines.push("DTSTART:" + stamp(utc), "DTEND:" + stamp(new Date(utc.getTime() + 30 * 60 * 1000)));
  } else {
    const next = new Date(plan.date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
    lines.push("DTSTART;VALUE=DATE:" + plan.date.replace(/-/g, ""), "DTEND;VALUE=DATE:" + next.toISOString().slice(0, 10).replace(/-/g, ""));
  }
  const title = (cancelled ? "【已取消排期】" : "【发布】") + plan.title;
  lines.push("SUMMARY:" + escapeICS(title), "DESCRIPTION:" + escapeICS("由 Obsidian 创作管理单向维护\n平台：" + plan.platform + "\n阶段：" + plan.status + "\n作品标识：" + plan.work_id + "\n打开作品：" + plan.noteUrl + "\n有时间的发布事件占位 30 分钟，仅用于排期提示。"),
    "URL:" + plan.noteUrl, "STATUS:" + (cancelled ? "CANCELLED" : "CONFIRMED"), "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function ownedCalendar(resourceUrl, calendarUrl) {
  const resource = new URL(resourceUrl), calendar = new URL(calendarUrl);
  return resource.origin === calendar.origin && resource.pathname.startsWith(calendar.pathname.replace(/\/?$/, "/"));
}

module.exports = { escapeICS, foldLine, stamp, eventPlan, buildICS, ownedCalendar };
