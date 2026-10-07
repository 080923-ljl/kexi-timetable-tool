(function (global) {
  "use strict";

  const DAYS = [
    { id: 1, short: "周一", long: "星期一" },
    { id: 2, short: "周二", long: "星期二" },
    { id: 3, short: "周三", long: "星期三" },
    { id: 4, short: "周四", long: "星期四" },
    { id: 5, short: "周五", long: "星期五" },
    { id: 6, short: "周六", long: "星期六" },
    { id: 7, short: "周日", long: "星期日" },
  ];

  const CSV_ALIASES = {
    course: ["课程名", "课程名称", "科目", "课程", "名称", "course", "coursename", "subject"],
    day: ["星期几", "星期", "周几", "weekday", "week", "day"],
    start: ["开始时间", "开始", "起始时间", "start", "starttime", "begin"],
    end: ["结束时间", "结束", "终止时间", "end", "endtime", "finish"],
  };

  function normalizeKey(value) {
    return String(value == null ? "" : value)
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_\-（）()：:]/g, "");
  }

  function normalizeCourseName(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function parseWeekday(value) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value >= 1 && value <= 7 ? value : null;
    }

    const raw = String(value == null ? "" : value).trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (Number.isInteger(numeric)) {
      return numeric >= 1 && numeric <= 7 ? numeric : null;
    }

    const key = normalizeKey(raw);
    const aliases = new Map([
      ["星期一", 1],
      ["周一", 1],
      ["礼拜一", 1],
      ["monday", 1],
      ["mon", 1],
      ["星期二", 2],
      ["周二", 2],
      ["礼拜二", 2],
      ["tuesday", 2],
      ["tue", 2],
      ["星期三", 3],
      ["周三", 3],
      ["礼拜三", 3],
      ["wednesday", 3],
      ["wed", 3],
      ["星期四", 4],
      ["周四", 4],
      ["礼拜四", 4],
      ["thursday", 4],
      ["thu", 4],
      ["星期五", 5],
      ["周五", 5],
      ["礼拜五", 5],
      ["friday", 5],
      ["fri", 5],
      ["星期六", 6],
      ["周六", 6],
      ["礼拜六", 6],
      ["saturday", 6],
      ["sat", 6],
      ["星期日", 7],
      ["星期天", 7],
      ["周日", 7],
      ["周天", 7],
      ["礼拜日", 7],
      ["礼拜天", 7],
      ["sunday", 7],
      ["sun", 7],
    ]);

    return aliases.get(key) || null;
  }

  function parseTimeToMinutes(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value < 0 || value >= 24) return null;
      return Math.round(value * 60);
    }

    let raw = String(value == null ? "" : value)
      .trim()
      .replace(/：/g, ":")
      .replace(/\s+/g, "");
    if (!raw) return null;

    let meridiemOffset = 0;
    if (/^(下午|晚上)/.test(raw)) {
      meridiemOffset = 12;
      raw = raw.replace(/^(下午|晚上)/, "");
    } else if (/^(上午|早上|清晨)/.test(raw)) {
      raw = raw.replace(/^(上午|早上|清晨)/, "");
    }

    const ampm = raw.match(/^(.*?)(am|pm)$/i);
    if (ampm) {
      raw = ampm[1];
      if (ampm[2].toLowerCase() === "pm") meridiemOffset = 12;
    }

    let match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) match = raw.match(/^(\d{1,2})(\d{2})$/);
    if (!match) match = raw.match(/^(\d{1,2})$/);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = match[2] == null ? 0 : Number(match[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (minutes < 0 || minutes > 59) return null;

    if (meridiemOffset && hours < 12) hours += meridiemOffset;
    if (meridiemOffset && hours === 12 && raw.startsWith("0")) hours = 12;
    if (hours < 0 || hours > 23) return null;

    return hours * 60 + minutes;
  }

  function minutesToTime(minutes) {
    const normalized = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(field);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);

    return rows;
  }

  function findColumnIndex(header, aliases) {
    const normalized = header.map(normalizeKey);
    return normalized.findIndex((cell) => aliases.some((alias) => normalizeKey(alias) === cell));
  }

  function parseCsvText(text) {
    const rows = parseCsvRows(String(text || "").replace(/^\uFEFF/, ""));
    const errors = [];

    if (rows.length === 0) {
      return { courses: [], errors: [{ row: 0, message: "CSV 内容为空" }] };
    }

    const header = rows[0];
    let columns = {
      course: findColumnIndex(header, CSV_ALIASES.course),
      day: findColumnIndex(header, CSV_ALIASES.day),
      start: findColumnIndex(header, CSV_ALIASES.start),
      end: findColumnIndex(header, CSV_ALIASES.end),
    };

    let startRow = 1;
    const recognizedHeaders = Object.values(columns).filter((index) => index >= 0).length;
    if (recognizedHeaders < 3) {
      columns = { course: 0, day: 1, start: 2, end: 3 };
      startRow = 0;
    }

    const courses = [];
    for (let index = startRow; index < rows.length; index += 1) {
      const cells = rows[index];
      const rowNumber = index + 1;
      const course = normalizeCourseName(cells[columns.course]);
      const day = parseWeekday(cells[columns.day]);
      const startMinutes = parseTimeToMinutes(cells[columns.start]);
      const endMinutes = parseTimeToMinutes(cells[columns.end]);

      if (!course) {
        errors.push({ row: rowNumber, message: "课程名为空" });
        continue;
      }
      if (!day) {
        errors.push({ row: rowNumber, message: "星期几无法识别" });
        continue;
      }
      if (startMinutes == null || endMinutes == null) {
        errors.push({ row: rowNumber, message: "开始或结束时间无法识别" });
        continue;
      }
      if (startMinutes >= endMinutes) {
        errors.push({ row: rowNumber, message: "结束时间必须晚于开始时间" });
        continue;
      }

      courses.push({
        course,
        day,
        start: minutesToTime(startMinutes),
        end: minutesToTime(endMinutes),
      });
    }

    if (courses.length === 0 && errors.length === 0) {
      errors.push({ row: 0, message: "没有可导入的数据行" });
    }

    return { courses, errors };
  }

  function courseStart(course) {
    const parsed = parseTimeToMinutes(course.start);
    return parsed == null ? 0 : parsed;
  }

  function courseEnd(course) {
    const parsed = parseTimeToMinutes(course.end);
    return parsed == null ? 0 : parsed;
  }

  function mergeSameCourseSegments(courses, toleranceMinutes) {
    const tolerance = Math.max(0, Number(toleranceMinutes) || 0);
    const sorted = courses
      .map((course, index) => ({
        ...course,
        id: course.id || `segment-${index}`,
        course: normalizeCourseName(course.course),
        day: Number(course.day),
        startMinutes: courseStart(course),
        endMinutes: courseEnd(course),
      }))
      .filter((course) => course.course && course.day >= 1 && course.day <= 7 && course.startMinutes < course.endMinutes)
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

    const merged = [];
    for (const segment of sorted) {
      const previous = merged[merged.length - 1];
      const canMerge =
        previous &&
        previous.day === segment.day &&
        normalizeKey(previous.course) === normalizeKey(segment.course) &&
        segment.startMinutes <= previous.endMinutes + tolerance;

      if (canMerge) {
        previous.endMinutes = Math.max(previous.endMinutes, segment.endMinutes);
        previous.end = minutesToTime(previous.endMinutes);
        previous.sourceCount += segment.sourceCount || 1;
      } else {
        merged.push({
          ...segment,
          start: minutesToTime(segment.startMinutes),
          end: minutesToTime(segment.endMinutes),
          sourceCount: segment.sourceCount || 1,
        });
      }
    }

    return merged.map(({ startMinutes, endMinutes, ...segment }) => ({
      ...segment,
      start: minutesToTime(startMinutes),
      end: minutesToTime(endMinutes),
      duration: endMinutes - startMinutes,
    }));
  }

  function buildBusyIntervals(courses, mergeToleranceMinutes) {
    const mergedCourses = mergeSameCourseSegments(courses, mergeToleranceMinutes);
    const byDay = new Map();

    mergedCourses.forEach((course) => {
      if (!byDay.has(course.day)) byDay.set(course.day, []);
      byDay.get(course.day).push(course);
    });

    const intervals = [];
    byDay.forEach((dayCourses) => {
      const sorted = dayCourses.sort((a, b) => courseStart(a) - courseStart(b));
      sorted.forEach((course) => {
        const start = courseStart(course);
        const end = courseEnd(course);
        const previous = intervals[intervals.length - 1];
        if (previous && previous.day === course.day && start <= previous.end) {
          previous.end = Math.max(previous.end, end);
        } else {
          intervals.push({ day: course.day, start, end });
        }
      });
    });

    return intervals.sort((a, b) => a.day - b.day || a.start - b.start);
  }

  function subtractIntervals(window, busyIntervals) {
    const free = [];
    let cursor = window.start;

    busyIntervals
      .filter((interval) => interval.end > window.start && interval.start < window.end)
      .sort((a, b) => a.start - b.start)
      .forEach((interval) => {
        const busyStart = Math.max(window.start, interval.start);
        const busyEnd = Math.min(window.end, interval.end);
        if (busyStart > cursor) {
          free.push({ start: cursor, end: busyStart });
        }
        cursor = Math.max(cursor, busyEnd);
      });

    if (cursor < window.end) {
      free.push({ start: cursor, end: window.end });
    }

    return free;
  }

  function getEnabledAvailability(participant, day) {
    const availability = participant && participant.availability && participant.availability[day];
    if (!availability || !availability.enabled) return null;

    const start = parseTimeToMinutes(availability.start);
    const end = parseTimeToMinutes(availability.end);
    if (start == null || end == null || start >= end) return null;
    return { day, start, end };
  }

  function calculateFreeSlots(participant, options) {
    const settings = options || {};
    const minDuration = Math.max(1, Number(settings.minFreeMinutes) || 1);
    const mergeTolerance = Math.max(0, Number(settings.mergeGap) || 0);
    const busyIntervals = buildBusyIntervals((participant && participant.courses) || [], mergeTolerance);
    const slots = [];

    DAYS.forEach((day) => {
      const window = getEnabledAvailability(participant, day.id);
      if (!window) return;
      const dayBusy = busyIntervals.filter((interval) => interval.day === day.id);
      subtractIntervals(window, dayBusy).forEach((interval) => {
        const duration = interval.end - interval.start;
        if (duration < minDuration) return;
        slots.push({
          day: day.id,
          dayLabel: day.long,
          start: interval.start,
          end: interval.end,
          startText: minutesToTime(interval.start),
          endText: minutesToTime(interval.end),
          duration,
        });
      });
    });

    return slots.sort((a, b) => a.day - b.day || a.start - b.start);
  }

  function intersectIntervalLists(first, second) {
    const intersections = [];
    let left = 0;
    let right = 0;

    while (left < first.length && right < second.length) {
      const a = first[left];
      const b = second[right];
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (start < end) {
        intersections.push({ start, end });
      }

      if (a.end < b.end) left += 1;
      else right += 1;
    }

    return intersections;
  }

  function calculateCommonFree(participants, selectedIds, options) {
    const settings = options || {};
    const selected = (participants || []).filter((participant) => selectedIds.includes(participant.id));
    if (selected.length < 2) return [];

    const minDuration = Math.max(1, Number(settings.minFreeMinutes) || 1);
    const slots = [];

    DAYS.forEach((day) => {
      const allFreeByDay = selected.map((participant) =>
        calculateFreeSlots(participant, {
          minFreeMinutes: 1,
          mergeGap: settings.mergeGap,
        })
          .filter((slot) => slot.day === day.id)
          .map((slot) => ({ start: slot.start, end: slot.end }))
      );

      if (allFreeByDay.some((list) => list.length === 0)) return;
      let intersections = allFreeByDay[0];
      for (let index = 1; index < allFreeByDay.length; index += 1) {
        intersections = intersectIntervalLists(intersections, allFreeByDay[index]);
        if (intersections.length === 0) break;
      }

      intersections.forEach((interval) => {
        const duration = interval.end - interval.start;
        if (duration < minDuration) return;
        slots.push({
          day: day.id,
          dayLabel: day.long,
          start: interval.start,
          end: interval.end,
          startText: minutesToTime(interval.start),
          endText: minutesToTime(interval.end),
          duration,
        });
      });
    });

    return slots.sort((a, b) => b.duration - a.duration || a.day - b.day || a.start - b.start);
  }

  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours && mins) return `${hours}小时${mins}分`;
    if (hours) return `${hours}小时`;
    return `${mins}分钟`;
  }

  function buildTimetableText(participant, options) {
    const settings = options || {};
    const courses = (participant && participant.courses) || [];
    const merged = mergeSameCourseSegments(courses, settings.mergeGap);
    const lines = ["本周课表", `成员：${(participant && participant.name) || "未命名"}`];

    if (courses.length === 0) {
      lines.push("", "暂无课程");
      return lines.join("\n");
    }

    lines.push(`课程：${courses.length} 节 / 展示：${merged.length} 个时间块`, "");
    DAYS.forEach((day) => {
      const dayCourses = merged
        .filter((course) => course.day === day.id)
        .sort((a, b) => courseStart(a) - courseStart(b));
      if (dayCourses.length === 0) return;

      lines.push(day.long);
      dayCourses.forEach((course) => {
        const mergedLabel = course.sourceCount > 1 ? `（${course.sourceCount} 节已合并）` : "";
        lines.push(`  ${course.start}-${course.end}  ${course.course}${mergedLabel}`);
      });
      lines.push("");
    });

    return lines.join("\n").trim();
  }

  function getDay(dayId) {
    return DAYS.find((day) => day.id === Number(dayId)) || DAYS[0];
  }

  const api = {
    DAYS,
    buildBusyIntervals,
    buildTimetableText,
    calculateCommonFree,
    calculateFreeSlots,
    formatDuration,
    getDay,
    intersectIntervalLists,
    mergeSameCourseSegments,
    minutesToTime,
    normalizeCourseName,
    parseCsvText,
    parseTimeToMinutes,
    parseWeekday,
    subtractIntervals,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.TimetableLogic = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
