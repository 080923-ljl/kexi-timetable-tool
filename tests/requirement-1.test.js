const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../logic.js");

test("requirement 1: imports timetable data from CSV", () => {
  const result = logic.parseCsvText(
    ["课程名,星期几,开始时间,结束时间", '"高等数学, A班",星期二,09:00,09:45'].join("\n")
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.courses[0].course, "高等数学, A班");
  assert.equal(result.courses[0].day, 2);
});

test("requirement 1: renders a merged weekly timetable text view", () => {
  const text = logic.buildTimetableText(
    {
      name: "林同学",
      courses: [
        { course: "高等数学", day: 2, start: "09:00", end: "09:45" },
        { course: "高等数学", day: 2, start: "09:55", end: "10:40" },
      ],
    },
    { mergeGap: 15 }
  );

  assert.match(text, /本周课表/);
  assert.match(text, /09:00-10:40  高等数学（2 节已合并）/);
});
