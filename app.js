(function () {
  "use strict";

  const logic = window.TimetableLogic;
  const STORAGE_KEY = "kexi-timetable-state-v1";
  const COLORS = ["#0b7a68", "#245f9e", "#aa5b08", "#b42318", "#49751a", "#8a4b21", "#0f6f89"];
  const PARTICIPANT_COLORS = COLORS;

  const elements = {
    activeMemberName: document.getElementById("active-member-name"),
    addParticipant: document.getElementById("add-participant"),
    availabilityList: document.getElementById("availability-list"),
    clearData: document.getElementById("clear-data"),
    commonMetrics: document.getElementById("common-metrics"),
    commonParticipantList: document.getElementById("common-participant-list"),
    commonPickerSummary: document.getElementById("common-picker-summary"),
    commonResults: document.getElementById("common-results"),
    commonResultsCount: document.getElementById("common-results-count"),
    copyTimetable: document.getElementById("copy-timetable"),
    courseCountLabel: document.getElementById("course-count-label"),
    courseDay: document.getElementById("course-day"),
    courseEnd: document.getElementById("course-end"),
    courseForm: document.getElementById("course-form"),
    courseList: document.getElementById("course-list"),
    courseName: document.getElementById("course-name"),
    courseStart: document.getElementById("course-start"),
    csvFile: document.getElementById("csv-file"),
    csvStatus: document.getElementById("csv-status"),
    dataSummary: document.getElementById("data-summary"),
    downloadTemplate: document.getElementById("download-template"),
    freeMemberName: document.getElementById("free-member-name"),
    freeMetrics: document.getElementById("free-metrics"),
    freeResults: document.getElementById("free-results"),
    freeResultsCount: document.getElementById("free-results-count"),
    loadSample: document.getElementById("load-sample"),
    mergeGap: document.getElementById("merge-gap"),
    minFree: document.getElementById("min-free"),
    participantList: document.getElementById("participant-list"),
    ruleSummary: document.getElementById("rule-summary"),
    selectAllCommon: document.getElementById("select-all-common"),
    tabButtons: Array.from(document.querySelectorAll("[data-tab]")),
    timetableText: document.getElementById("timetable-text"),
    toast: document.getElementById("toast"),
  };

  const panels = {
    1: document.getElementById("panel-1"),
    2: document.getElementById("panel-2"),
    3: document.getElementById("panel-3"),
  };

  let toastTimer = null;
  let state = loadState();

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultAvailability() {
    const availability = {};
    logic.DAYS.forEach((day) => {
      availability[day.id] = {
        enabled: day.id <= 5,
        start: "08:00",
        end: "22:00",
      };
    });
    return availability;
  }

  function cloneAvailability(availability) {
    return Object.fromEntries(
      Object.entries(availability).map(([day, value]) => [day, { ...value }])
    );
  }

  function makeCourse(course, day, start, end, id) {
    return {
      id: id || createId("course"),
      course,
      day: Number(day),
      start,
      end,
    };
  }

  function makeParticipant(name, color, courses, availability, id) {
    return {
      id: id || createId("person"),
      name,
      color,
      courses: courses || [],
      availability: availability || defaultAvailability(),
    };
  }

  function buildSampleState() {
    const lin = makeParticipant(
      "林同学",
      PARTICIPANT_COLORS[0],
      [
        makeCourse("高等数学", 2, "09:00", "09:45", "sample-lin-1"),
        makeCourse("高等数学", 2, "09:55", "10:40", "sample-lin-2"),
        makeCourse("数据结构", 1, "14:00", "15:35", "sample-lin-3"),
        makeCourse("大学英语", 3, "10:00", "11:35", "sample-lin-4"),
        makeCourse("计算机网络", 4, "15:00", "16:35", "sample-lin-5"),
      ],
      defaultAvailability(),
      "sample-lin"
    );

    const chen = makeParticipant(
      "陈同学",
      PARTICIPANT_COLORS[1],
      [
        makeCourse("大学物理", 1, "10:00", "11:35", "sample-chen-1"),
        makeCourse("高等数学", 2, "09:00", "10:35", "sample-chen-2"),
        makeCourse("大学英语", 3, "14:00", "15:35", "sample-chen-3"),
        makeCourse("数据库基础", 5, "09:00", "10:35", "sample-chen-4"),
      ],
      defaultAvailability(),
      "sample-chen"
    );

    return {
      version: 1,
      activeId: lin.id,
      commonSelection: [lin.id, chen.id],
      minFreeMinutes: 30,
      mergeGap: 15,
      participants: [lin, chen],
    };
  }

  function buildEmptyState() {
    const person = makeParticipant(
      "我的课表",
      PARTICIPANT_COLORS[0],
      [],
      defaultAvailability(),
      createId("person")
    );
    return {
      version: 1,
      activeId: person.id,
      commonSelection: [],
      minFreeMinutes: 30,
      mergeGap: 15,
      participants: [person],
    };
  }

  function normalizeState(raw) {
    if (!raw || !Array.isArray(raw.participants) || raw.participants.length === 0) {
      return buildSampleState();
    }

    const participants = raw.participants.map((participant, index) => ({
      id: participant.id || createId("person"),
      name: String(participant.name || `成员 ${index + 1}`).slice(0, 30),
      color: participant.color || PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
      availability: {
        ...defaultAvailability(),
        ...(participant.availability || {}),
      },
      courses: Array.isArray(participant.courses)
        ? participant.courses.map((course) =>
            makeCourse(
              logic.normalizeCourseName(course.course),
              Number(course.day),
              course.start,
              course.end,
              course.id || createId("course")
            )
          )
        : [],
    }));

    const activeId = participants.some((participant) => participant.id === raw.activeId)
      ? raw.activeId
      : participants[0].id;
    const validIds = new Set(participants.map((participant) => participant.id));
    const commonSelection = Array.isArray(raw.commonSelection)
      ? raw.commonSelection.filter((id) => validIds.has(id))
      : [];

    return {
      version: 1,
      activeId,
      commonSelection:
        commonSelection.length >= 2 ? commonSelection : participants.slice(0, 2).map((person) => person.id),
      minFreeMinutes: Number(raw.minFreeMinutes) || 30,
      mergeGap: Number(raw.mergeGap) || 0,
      participants,
    };
  }

  function loadState() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return buildSampleState();
      return normalizeState(JSON.parse(stored));
    } catch (error) {
      return buildSampleState();
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("浏览器无法保存数据，本次修改仅在当前页面有效。", true);
    }
  }

  function activeParticipant() {
    return (
      state.participants.find((participant) => participant.id === state.activeId) ||
      state.participants[0]
    );
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return entities[character];
    });
  }

  function initials(name) {
    const trimmed = String(name || "未").trim();
    if (!trimmed) return "未";
    const firstCharacters = Array.from(trimmed);
    return firstCharacters.slice(0, 2).join("").toUpperCase();
  }

  function showToast(message, isError) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", Boolean(isError));
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 3200);
  }

  function renderParticipantList() {
    elements.participantList.innerHTML = state.participants
      .map((participant) => {
        const isActive = participant.id === state.activeId;
        return `
          <div class="participant-item${isActive ? " is-active" : ""}" data-participant-id="${escapeHtml(
            participant.id
          )}">
            <button class="participant-select" type="button" data-action="select">
              <span class="participant-avatar" style="background:${escapeHtml(participant.color)}">${escapeHtml(
                initials(participant.name)
              )}</span>
              <span class="participant-copy">
                <strong>${escapeHtml(participant.name)}</strong>
                <span>${participant.courses.length} 节课程</span>
              </span>
            </button>
            <span class="participant-actions">
              <button class="icon-button" type="button" data-action="rename" title="重命名" aria-label="重命名">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              <button class="icon-button" type="button" data-action="delete" title="删除成员" aria-label="删除成员">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
                </svg>
              </button>
            </span>
          </div>
        `;
      })
      .join("");
  }

  function renderHeaderSummary() {
    const courseCount = state.participants.reduce(
      (total, participant) => total + participant.courses.length,
      0
    );
    elements.dataSummary.textContent = `${state.participants.length} 位成员 · ${courseCount} 门课程`;
  }

  function renderTimetablePanel() {
    const participant = activeParticipant();
    elements.activeMemberName.textContent = participant.name;
    elements.freeMemberName.textContent = participant.name;
    elements.timetableText.textContent = logic.buildTimetableText(participant, {
      mergeGap: state.mergeGap,
    });

    const sortedCourses = [...participant.courses].sort(
      (a, b) =>
        a.day - b.day ||
        logic.parseTimeToMinutes(a.start) - logic.parseTimeToMinutes(b.start)
    );
    elements.courseCountLabel.textContent = `当前成员共有 ${participant.courses.length} 节课程。`;

    if (sortedCourses.length === 0) {
      elements.courseList.innerHTML = `
        <div class="empty-state">
          <div><strong>暂无课程</strong>在上方手动添加，或导入 CSV 文件。</div>
        </div>
      `;
      return;
    }

    elements.courseList.innerHTML = sortedCourses
      .map((course) => {
        const day = logic.getDay(course.day);
        return `
          <div class="course-row">
            <span>
              <strong>${escapeHtml(course.course)}</strong>
              <span>${escapeHtml(day.long)}</span>
            </span>
            <span class="course-time">${escapeHtml(course.start)}-${escapeHtml(course.end)}</span>
            <button class="icon-button" type="button" data-course-id="${escapeHtml(
              course.id
            )}" title="删除课程" aria-label="删除课程">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        `;
      })
      .join("");
  }

  function renderAvailability() {
    const participant = activeParticipant();
    elements.availabilityList.innerHTML = logic.DAYS.map((day) => {
      const availability = participant.availability[day.id] || {
        enabled: false,
        start: "08:00",
        end: "22:00",
      };
      return `
        <div class="availability-row${availability.enabled ? "" : " is-disabled"}" data-day="${day.id}">
          <label class="availability-toggle">
            <input type="checkbox" data-field="enabled"${availability.enabled ? " checked" : ""} />
            <span>${escapeHtml(day.short)}</span>
          </label>
          <input
            class="time-input"
            type="time"
            data-field="start"
            value="${escapeHtml(availability.start)}"
            aria-label="${escapeHtml(day.long)}开始时间"
            ${availability.enabled ? "" : "disabled"}
          />
          <input
            class="time-input"
            type="time"
            data-field="end"
            value="${escapeHtml(availability.end)}"
            aria-label="${escapeHtml(day.long)}结束时间"
            ${availability.enabled ? "" : "disabled"}
          />
        </div>
      `;
    }).join("");
  }

  function renderSettings() {
    elements.mergeGap.value = String(state.mergeGap);
    elements.minFree.value = String(state.minFreeMinutes);
    const mergeLabel =
      state.mergeGap > 0 ? `课间不超过 ${state.mergeGap} 分钟时，同一课程会合并显示。` : "未启用课程合并。";
    elements.ruleSummary.textContent = `${mergeLabel} 少于 ${logic.formatDuration(
      state.minFreeMinutes
    )}的空闲不会进入结果。`;
  }

  function metricTemplate(label, value) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderFreeResults() {
    const participant = activeParticipant();
    const slots = logic.calculateFreeSlots(participant, {
      minFreeMinutes: state.minFreeMinutes,
      mergeGap: state.mergeGap,
    });
    const totalMinutes = slots.reduce((total, slot) => total + slot.duration, 0);
    const longest = slots.reduce((maximum, slot) => Math.max(maximum, slot.duration), 0);
    const enabledDays = logic.DAYS.filter(
      (day) => participant.availability[day.id] && participant.availability[day.id].enabled
    ).length;

    elements.freeMetrics.innerHTML = [
      metricTemplate("本周空闲", totalMinutes ? logic.formatDuration(totalMinutes) : "0 分钟"),
      metricTemplate("最长连续", longest ? logic.formatDuration(longest) : "0 分钟"),
      metricTemplate("可用天数", `${enabledDays} 天`),
      metricTemplate("课程条目", `${participant.courses.length} 节`),
    ].join("");

    elements.freeResultsCount.textContent = `${slots.length} 个时段`;
    if (slots.length === 0) {
      elements.freeResults.innerHTML = `
        <div class="empty-state">
          <div><strong>没有符合条件的空闲时段</strong>可以启用更多日期，或降低最短空闲时长。</div>
        </div>
      `;
      return;
    }

    elements.freeResults.innerHTML = logic.DAYS.map((day) => {
      const daySlots = slots.filter((slot) => slot.day === day.id);
      if (daySlots.length === 0) return "";
      return `
        <div class="day-result">
          <div class="day-label">
            <strong>${escapeHtml(day.long)}</strong>
            <span>${daySlots.length} 个时段</span>
          </div>
          <div class="slot-list">
            ${daySlots
              .map(
                (slot, index) => `
                  <div class="slot-item${index % 2 ? " is-amber" : ""}">
                    <div>
                      <div class="slot-time">${slot.startText}-${slot.endText}</div>
                      <div class="slot-note">连续空闲</div>
                    </div>
                    <span class="duration-chip">${escapeHtml(logic.formatDuration(slot.duration))}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  function ensureCommonSelection() {
    const validIds = new Set(state.participants.map((participant) => participant.id));
    state.commonSelection = state.commonSelection.filter((id) => validIds.has(id));
    if (state.commonSelection.length === 0 && state.participants.length >= 2) {
      state.commonSelection = state.participants.slice(0, 2).map((participant) => participant.id);
    }
  }

  function renderCommonParticipants() {
    ensureCommonSelection();
    elements.commonParticipantList.innerHTML = state.participants
      .map((participant) => {
        const checked = state.commonSelection.includes(participant.id);
        return `
          <label class="common-person">
            <input
              type="checkbox"
              value="${escapeHtml(participant.id)}"
              data-common-id="${escapeHtml(participant.id)}"
              ${checked ? "checked" : ""}
            />
            <span class="person-dot" style="background:${escapeHtml(participant.color)}">${escapeHtml(
              initials(participant.name)
            )}</span>
            <span class="common-person-copy">
              <strong>${escapeHtml(participant.name)}</strong>
              <span>${participant.courses.length} 节课程</span>
            </span>
          </label>
        `;
      })
      .join("");

    const selectedCount = state.commonSelection.length;
    elements.commonPickerSummary.textContent = `当前选择 ${selectedCount} 位成员。`;
    const allSelected = selectedCount === state.participants.length;
    elements.selectAllCommon.innerHTML = allSelected
      ? `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          清空
        `
      : `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m5 12 4 4L19 6" />
          </svg>
          全选
        `;
  }

  function renderCommonResults() {
    const selected = state.participants.filter((participant) =>
      state.commonSelection.includes(participant.id)
    );
    const slots = logic.calculateCommonFree(state.participants, state.commonSelection, {
      minFreeMinutes: state.minFreeMinutes,
      mergeGap: state.mergeGap,
    });
    const totalMinutes = slots.reduce((total, slot) => total + slot.duration, 0);
    const longest = slots.length ? slots[0].duration : 0;

    elements.commonMetrics.innerHTML = [
      metricTemplate("参与成员", `${selected.length} 位`),
      metricTemplate("共同时段", `${slots.length} 个`),
      metricTemplate("最长可约", longest ? logic.formatDuration(longest) : "0 分钟"),
      metricTemplate("本周合计", totalMinutes ? logic.formatDuration(totalMinutes) : "0 分钟"),
    ].join("");

    elements.commonResultsCount.textContent = `${slots.length} 个时段`;
    if (selected.length < 2) {
      elements.commonResults.innerHTML = `
        <div class="empty-state">
          <div><strong>至少选择两位成员</strong>勾选后会在这里列出共同空闲时间。</div>
        </div>
      `;
      return;
    }

    if (slots.length === 0) {
      elements.commonResults.innerHTML = `
        <div class="empty-state">
          <div><strong>暂时没有共同空闲</strong>可以降低最短空闲时长，或调整每日可用时间。</div>
        </div>
      `;
      return;
    }

    const names = selected.map((participant) => participant.name);
    elements.commonResults.innerHTML = slots
      .map(
        (slot, index) => `
          <article class="common-slot">
            <span class="rank">${index + 1}</span>
            <div>
              <h3>${escapeHtml(slot.dayLabel)} ${slot.startText}-${slot.endText}</h3>
              <p>${escapeHtml(logic.formatDuration(slot.duration))}，所有人的课表均无冲突。</p>
            </div>
            <div class="common-slot-meta">
              <span class="duration-chip">${escapeHtml(logic.formatDuration(slot.duration))}</span>
              <span class="person-chip">${escapeHtml(names.join("、"))}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderAll() {
    renderHeaderSummary();
    renderParticipantList();
    renderTimetablePanel();
    renderAvailability();
    renderSettings();
    renderFreeResults();
    renderCommonParticipants();
    renderCommonResults();
  }

  function activateTab(tabId) {
    const selected = String(tabId);
    elements.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === selected;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    Object.entries(panels).forEach(([id, panel]) => {
      const isActive = id === selected;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  function setCsvStatus(message, type) {
    elements.csvStatus.textContent = message;
    elements.csvStatus.classList.toggle("is-error", type === "error");
    elements.csvStatus.classList.toggle("is-success", type === "success");
  }

  function addCourseToActive(course) {
    const participant = activeParticipant();
    participant.courses.push(course);
    saveState();
    renderAll();
  }

  function detectCourseConflict(participant, course) {
    const start = logic.parseTimeToMinutes(course.start);
    const end = logic.parseTimeToMinutes(course.end);
    return participant.courses.find((existing) => {
      if (existing.day !== course.day) return false;
      const existingStart = logic.parseTimeToMinutes(existing.start);
      const existingEnd = logic.parseTimeToMinutes(existing.end);
      return start < existingEnd && end > existingStart;
    });
  }

  function handleCourseSubmit(event) {
    event.preventDefault();
    const participant = activeParticipant();
    const courseName = logic.normalizeCourseName(elements.courseName.value);
    const day = Number(elements.courseDay.value);
    const start = elements.courseStart.value;
    const end = elements.courseEnd.value;
    const startMinutes = logic.parseTimeToMinutes(start);
    const endMinutes = logic.parseTimeToMinutes(end);

    if (!courseName) {
      showToast("请输入课程名。", true);
      elements.courseName.focus();
      return;
    }
    if (startMinutes == null || endMinutes == null || startMinutes >= endMinutes) {
      showToast("结束时间必须晚于开始时间。", true);
      elements.courseEnd.focus();
      return;
    }

    const duplicate = participant.courses.find(
      (course) =>
        course.day === day &&
        course.course.toLowerCase() === courseName.toLowerCase() &&
        course.start === start &&
        course.end === end
    );
    if (duplicate) {
      showToast("这门课程已在相同时间添加过。", true);
      return;
    }

    const course = makeCourse(courseName, day, start, end);
    const conflict = detectCourseConflict(participant, course);
    addCourseToActive(course);
    elements.courseName.value = "";
    elements.courseName.focus();

    if (conflict) {
      showToast(`已添加，但与“${conflict.course}”时间重叠。`);
    } else {
      showToast("课程已添加。");
    }
  }

  function handleParticipantAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const item = button.closest("[data-participant-id]");
    if (!item) return;
    const participant = state.participants.find(
      (entry) => entry.id === item.dataset.participantId
    );
    if (!participant) return;

    if (button.dataset.action === "select") {
      state.activeId = participant.id;
      saveState();
      renderAll();
      return;
    }

    if (button.dataset.action === "rename") {
      const nextName = window.prompt("输入新的成员名称：", participant.name);
      if (nextName == null) return;
      const normalized = nextName.trim().slice(0, 30);
      if (!normalized) {
        showToast("成员名称不能为空。", true);
        return;
      }
      participant.name = normalized;
      saveState();
      renderAll();
      showToast("成员名称已更新。");
      return;
    }

    if (button.dataset.action === "delete") {
      if (state.participants.length === 1) {
        showToast("至少需要保留一位成员。", true);
        return;
      }
      const confirmed = window.confirm(`删除“${participant.name}”及其全部课程？`);
      if (!confirmed) return;

      state.participants = state.participants.filter((entry) => entry.id !== participant.id);
      state.commonSelection = state.commonSelection.filter((id) => id !== participant.id);
      if (state.activeId === participant.id) {
        state.activeId = state.participants[0].id;
      }
      saveState();
      renderAll();
      showToast("成员已删除。");
    }
  }

  function handleAvailabilityChange(event) {
    const field = event.target.dataset.field;
    if (!field) return;
    const row = event.target.closest("[data-day]");
    if (!row) return;
    const day = Number(row.dataset.day);
    const participant = activeParticipant();
    const current = participant.availability[day] || {
      enabled: false,
      start: "08:00",
      end: "22:00",
    };
    const next = { ...current };

    if (field === "enabled") {
      next.enabled = event.target.checked;
    } else {
      next[field] = event.target.value;
      const start = logic.parseTimeToMinutes(next.start);
      const end = logic.parseTimeToMinutes(next.end);
      if (start == null || end == null || start >= end) {
        showToast("可用时间的结束时间必须晚于开始时间。", true);
        renderAvailability();
        return;
      }
    }

    participant.availability[day] = next;
    saveState();
    renderAll();
  }

  function handleCourseListClick(event) {
    const button = event.target.closest("[data-course-id]");
    if (!button) return;
    const participant = activeParticipant();
    const course = participant.courses.find((entry) => entry.id === button.dataset.courseId);
    if (!course) return;
    participant.courses = participant.courses.filter((entry) => entry.id !== course.id);
    saveState();
    renderAll();
    showToast("课程已删除。");
  }

  async function handleCsvImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = logic.parseCsvText(text);
      if (result.courses.length > 0) {
        const participant = activeParticipant();
        participant.courses.push(
          ...result.courses.map((course) =>
            makeCourse(course.course, course.day, course.start, course.end)
          )
        );
        saveState();
        renderAll();
      }

      if (result.errors.length > 0) {
        const details = result.errors
          .slice(0, 3)
          .map((error) => (error.row ? `第 ${error.row} 行：${error.message}` : error.message))
          .join("；");
        setCsvStatus(
          `导入 ${result.courses.length} 门；${details}${result.errors.length > 3 ? "；其余请检查文件" : ""}`,
          result.courses.length ? "success" : "error"
        );
        showToast(result.courses.length ? "CSV 已部分导入，请检查异常行。" : "CSV 导入失败。", !result.courses.length);
      } else {
        setCsvStatus(`导入成功，共 ${result.courses.length} 门课程。`, "success");
        showToast(`已导入 ${result.courses.length} 门课程。`);
      }
    } catch (error) {
      setCsvStatus("无法读取该 CSV 文件。", "error");
      showToast("无法读取该 CSV 文件。", true);
    } finally {
      elements.csvFile.value = "";
    }
  }

  function downloadTemplate() {
    const content = [
      "\uFEFF课程名,星期几,开始时间,结束时间",
      "高等数学,星期二,09:00,09:45",
      "高等数学,星期二,09:55,10:40",
      "数据结构,星期一,14:00,15:35",
    ].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "课表模板.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyTimetable() {
    const text = elements.timetableText.textContent;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showToast("课表文本已复制。");
    } catch (error) {
      showToast("复制失败，请手动选择文本。", true);
    }
  }

  function handleAddParticipant() {
    const index = state.participants.length;
    const participant = makeParticipant(
      `成员 ${index + 1}`,
      PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
      [],
      defaultAvailability()
    );
    state.participants.push(participant);
    state.activeId = participant.id;
    saveState();
    renderAll();
    showToast("已新增成员。");
  }

  function handleClearData() {
    const confirmed = window.confirm("清空所有成员、课程和设置？此操作无法撤销。");
    if (!confirmed) return;
    state = buildEmptyState();
    saveState();
    setCsvStatus("尚未导入文件");
    renderAll();
    showToast("数据已清空。");
  }

  function handleLoadSample() {
    state = buildSampleState();
    saveState();
    setCsvStatus("已载入示例数据");
    renderAll();
    showToast("示例数据已载入。");
  }

  function bindEvents() {
    elements.tabButtons.forEach((button) => {
      button.addEventListener("click", () => activateTab(button.dataset.tab));
    });

    elements.courseForm.addEventListener("submit", handleCourseSubmit);
    elements.participantList.addEventListener("click", handleParticipantAction);
    elements.courseList.addEventListener("click", handleCourseListClick);
    elements.availabilityList.addEventListener("change", handleAvailabilityChange);
    elements.csvFile.addEventListener("change", handleCsvImport);
    elements.downloadTemplate.addEventListener("click", downloadTemplate);
    elements.copyTimetable.addEventListener("click", copyTimetable);
    elements.addParticipant.addEventListener("click", handleAddParticipant);
    elements.clearData.addEventListener("click", handleClearData);
    elements.loadSample.addEventListener("click", handleLoadSample);

    elements.mergeGap.addEventListener("change", () => {
      state.mergeGap = Number(elements.mergeGap.value);
      saveState();
      renderAll();
    });

    elements.minFree.addEventListener("change", () => {
      state.minFreeMinutes = Number(elements.minFree.value);
      saveState();
      renderAll();
    });

    elements.commonParticipantList.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-common-id]");
      if (!checkbox) return;
      const id = checkbox.dataset.commonId;
      if (checkbox.checked) {
        if (!state.commonSelection.includes(id)) state.commonSelection.push(id);
      } else {
        state.commonSelection = state.commonSelection.filter((entry) => entry !== id);
      }
      saveState();
      renderCommonParticipants();
      renderCommonResults();
    });

    elements.selectAllCommon.addEventListener("click", () => {
      const allSelected = state.commonSelection.length === state.participants.length;
      state.commonSelection = allSelected
        ? []
        : state.participants.map((participant) => participant.id);
      saveState();
      renderCommonParticipants();
      renderCommonResults();
    });

    elements.courseStart.addEventListener("change", () => {
      const start = logic.parseTimeToMinutes(elements.courseStart.value);
      const end = logic.parseTimeToMinutes(elements.courseEnd.value);
      if (start != null && (end == null || end <= start)) {
        elements.courseEnd.value = logic.minutesToTime(Math.min(23 * 60 + 59, start + 45));
      }
    });
  }

  bindEvents();
  renderAll();
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  activateTab(["1", "2", "3"].includes(requestedTab) ? requestedTab : "1");
})();
