const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../logic.js");

test("requirement 3: calculates common free time for multiple people", () => {
  const availability = {
    1: { enabled: true, start: "08:00", end: "18:00" },
  };
  const participants = [
    {
      id: "a",
      availability,
      courses: [
        { course: "数学", day: 1, start: "09:00", end: "10:00" },
        { course: "英语", day: 1, start: "14:00", end: "17:00" },
      ],
    },
    {
      id: "b",
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

  assert.deepEqual(
    slots.map((slot) => [slot.startText, slot.endText, slot.duration]),
    [
      ["10:00", "12:00", 120],
      ["17:00", "18:00", 60],
    ]
  );
});

test("requirement 3: needs at least two selected participants", () => {
  const slots = logic.calculateCommonFree([{ id: "a" }], ["a"], {
    minFreeMinutes: 30,
    mergeGap: 15,
  });

  assert.deepEqual(slots, []);
});
