const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../logic.js");

test("parses Chinese CSV headers and quoted course names", () => {
  const csv = [
    "课程名,星期几,开始时间,结束时间",
    '"高等数学, A班",周二,09:00,09:45',
    "数据结构,星期一,14:00,15:35",
  ].join("\n");

  const result = logic.parseCsvText(csv);

  assert.deepEqual(result.errors, []);
  assert.equal(result.courses.length, 2);
  assert.equal(result.courses[0].course, "高等数学, A班");
  assert.equal(result.courses[0].day, 2);
  assert.equal(result.courses[1].start, "14:00");
});

test("recognizes English headers, weekdays, and PM times", () => {
  const csv = [
    "courseName,weekday,startTime,endTime",
    "Operating Systems,Wednesday,2:00 PM,3:35 PM",
  ].join("\n");

  const result = logic.parseCsvText(csv);

  assert.equal(result.errors.length, 0);
  assert.equal(result.courses[0].day, 3);
  assert.equal(result.courses[0].start, "14:00");
  assert.equal(result.courses[0].end, "15:35");
});

test("merges consecutive periods of the same course within the break tolerance", () => {
  const merged = logic.mergeSameCourseSegments(
    [
      { course: "高等数学", day: 2, start: "09:00", end: "09:45" },
      { course: "高等数学", day: 2, start: "09:55", end: "10:40" },
      { course: "数据结构", day: 2, start: "10:40", end: "11:25" },
    ],
    15
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].start, "09:00");
  assert.equal(merged[0].end, "10:40");
  assert.equal(merged[0].sourceCount, 2);
});

test("calculates daily free slots around merged course blocks", () => {
  const participant = {
    name: "测试成员",
    availability: {
      1: { enabled: true, start: "08:00", end: "12:00" },
    },
    courses: [
      { course: "数学", day: 1, start: "09:00", end: "09:45" },
      { course: "数学", day: 1, start: "09:55", end: "10:40" },
    ],
  };

  const slots = logic.calculateFreeSlots(participant, { minFreeMinutes: 30, mergeGap: 15 });

  assert.deepEqual(
    slots.map((slot) => [slot.startText, slot.endText, slot.duration]),
    [
      ["08:00", "09:00", 60],
      ["10:40", "12:00", 80],
    ]
  );
});

test("sorts common free slots by duration descending", () => {
  const availability = {
    1: { enabled: true, start: "08:00", end: "18:00" },
  };
  const participants = [
    {
      id: "a",
      name: "A",
      availability,
      courses: [
        { course: "数学", day: 1, start: "09:00", end: "10:00" },
        { course: "英语", day: 1, start: "14:00", end: "17:00" },
      ],
    },
    {
      id: "b",
      name: "B",
      availability,
      courses: [
        { course: "物理", day: 1, start: "08:00", end: "09:00" },
        { course: "实验", day: 1, start: "12:00", end: "14:00" },
      ],
    },
  ];

  const slots = logic.calculateCommonFree(participants, ["a", "b"], {
    minFreeMinutes: 30,
    mergeGap: 15,
  });

  assert.equal(slots[0].startText, "10:00");
  assert.equal(slots[0].endText, "12:00");
  assert.equal(slots[0].duration, 120);
  assert.equal(slots[1].startText, "17:00");
  assert.equal(slots[1].endText, "18:00");
  assert.equal(slots[1].duration, 60);
  assert.ok(slots[0].duration >= slots[slots.length - 1].duration);
});

test("builds the required weekly timetable text view", () => {
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
  assert.match(text, /星期二/);
  assert.match(text, /09:00-10:40  高等数学（2 节已合并）/);
});
