const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../logic.js");

test("requirement 2: subtracts courses from each available day", () => {
  const slots = logic.calculateFreeSlots(
    {
      name: "林同学",
      availability: {
        1: { enabled: true, start: "08:00", end: "12:00" },
      },
      courses: [
        { course: "数学", day: 1, start: "09:00", end: "09:45" },
        { course: "数学", day: 1, start: "09:55", end: "10:40" },
      ],
    },
    { minFreeMinutes: 30, mergeGap: 15 }
  );

  assert.deepEqual(
    slots.map((slot) => [slot.startText, slot.endText]),
    [
      ["08:00", "09:00"],
      ["10:40", "12:00"],
    ]
  );
});

test("requirement 2: filters out short free fragments", () => {
  const slots = logic.calculateFreeSlots(
    {
      availability: {
        2: { enabled: true, start: "08:00", end: "10:00" },
      },
      courses: [
        { course: "英语", day: 2, start: "08:20", end: "09:40" },
      ],
    },
    { minFreeMinutes: 30, mergeGap: 0 }
  );

  assert.equal(slots.length, 0);
});
