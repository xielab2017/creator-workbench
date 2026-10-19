"use strict";
const assert = require("node:assert/strict");
const C = require("../src/core.js");
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log("PASS " + name); };

check("Empty metrics stay missing, real zero stays zero", () => {
  assert.equal(C.number(null), null); assert.equal(C.number(""), null); assert.equal(C.number(0), 0);
  assert.equal(C.display(null), "—"); assert.equal(C.display(0), "0");
});
check("Incomplete or zero-denominator rates are not fabricated", () => {
  assert.equal(C.interactionRate({ views: 100, likes: 1, comments: 0, saves: 1 }), null);
  assert.equal(C.interactionRate({ views: 0, likes: 0, comments: 0, saves: 0, shares: 0 }), null);
  assert.equal(C.interactionRate({ views: 100, likes: 3, comments: 2, saves: 4, shares: 1 }), 0.1);
});
check("Demo works never contribute to monthly totals", () => {
  const works = [{ is_demo: true, status: "待复盘", published_date: "2026-10-19" }, { status: "待复盘", published_date: "2026-10-18" }, { status: "已归档", published_date: "2026-09-19", review_completed_date: "2026-10-18" }, { status: "待发布", publish_date: "2026-10-20" }];
  assert.deepEqual(C.monthlyStats(works, "2026-10-19"), { total: 3, making: 1, published: 1, reviewed: 1, needsReview: 1, overdue: 0 });
});
check("Calendar Monday start, year boundary, and leap year", () => {
  const october = C.monthGrid("2026-10");
  assert.equal(october.length, 42); assert.equal(october[0].date, "2026-09-28");
  assert.equal(C.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(C.shiftMonth("2026-01", -1), "2025-12");
  assert(C.monthGrid("2028-02").some(d => d.date === "2028-02-29"));
});
check("Scheduling changes only the planned date", () => {
  const work = { status: "剪辑", publish_date: "2026-10-23", publish_time: "20:00" };
  assert.deepEqual(C.schedulePatch(work, "2026-10-24"), { publish_date: "2026-10-24" });
  assert.equal(work.status, "剪辑"); assert.equal(work.publish_date, "2026-10-23");
  assert.throws(() => C.schedulePatch({ status: "待复盘" }, "2026-10-24"));
});
check("Published events use actual publication day", () => {
  assert.equal(C.eventDate({ status: "待复盘", publish_date: "2026-10-01", published_date: "2026-10-02" }), "2026-10-02");
});
check("Invalid dates, status, negative and fractional metrics rejected", () => {
  assert.equal(C.day("2026-02-30"), ""); assert.equal(C.day("2028-02-29"), "2028-02-29");
  assert.throws(() => C.validatePatch({ status: "unknown" }));
  assert.throws(() => C.validatePatch({ views: -1 }));
  assert.throws(() => C.validatePatch({ likes: 1.2 }));
  assert.throws(() => C.validatePatch({ publish_time: "25:00" }));
  assert.throws(() => C.validatePatch({ published_url: "javascript:alert(1)" }));
});
check("Shanghai month attribution is independent of host timezone", () => {
  assert.equal(C.shanghaiDay(new Date("2026-10-31T17:00:00Z")), "2026-11-01");
});
check("Archived work cannot be overdue, sorting prioritizes overdue work", () => {
  assert.equal(C.overdue({ status: "已归档", task_due: "2026-10-01" }, "2026-10-19"), false);
  const result = C.sortWork([{ title: "A", status: "写稿", priority: "高", task_due: "2026-10-20" }, { title: "B", status: "剪辑", priority: "中", task_due: "2026-10-18" }], "2026-10-19");
  assert.equal(result[0].title, "B");
});
console.log(`${checks} meaningful data-rule checks passed.`);
