Chart.defaults.color = "#c8ddff";
Chart.defaults.font.family = "Space Grotesk, system-ui, -apple-system, sans-serif";
Chart.defaults.font.size = 13;

const START_DATE = new Date("2026-02-18T04:00:00");
const CHALLENGE_DAYS = 70;
const TRAINING_TARGET_COUNT = 70;
const WEEKLY_TARGET_DELTA = -0.6;
const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "waga-single-entries-v1";
const TRAINING_STORAGE_KEY = "waga-training-entries-v1";
const TEST_TIME_KEY = "waga-test-time-v3";

const firebaseConfig = {
  apiKey: "AIzaSyA7JqE7bNPU6FHqJSad5lKwjm-c8ozY9rg",
  authDomain: "bieganie-f4ada.firebaseapp.com",
  databaseURL: "https://bieganie-f4ada-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bieganie-f4ada",
  storageBucket: "bieganie-f4ada.appspot.com",
  messagingSenderId: "798631807038",
  appId: "1:798631807038:web:fe21df42faead2b981696f"
};

let firebaseEnabled = false;
let entriesRef = null;
let trainingEntriesRef = null;
let entries = [];
let trainingEntries = [];
let chartInstance = null;
let trainingChartInstance = null;
let testTime = loadTestTimeState();
testTime.enabled = 0;
testTime.offsetDays = 0;

const weightInput = document.getElementById("weight-input");
const kcalInput = document.getElementById("kcal-input");
const saveBtn = document.getElementById("save-btn");
const kcalSaveBtn = document.getElementById("kcal-save-btn");
const entryCards = document.getElementById("entry-cards");
const weightEntryCard = document.getElementById("weight-entry-card");
const kcalEntryCard = document.getElementById("kcal-entry-card");
const testEnabled = document.getElementById("test-enabled");
const testOffset = document.getElementById("test-offset");
const testMinus = document.getElementById("test-minus");
const testPlus = document.getElementById("test-plus");
const testToday = document.getElementById("test-today");
const trainingTimeInput = document.getElementById("training-time-input");
const trainingDistanceInput = document.getElementById("training-distance-input");
const trainingSaveTimeBtn = document.getElementById("training-save-time-btn");
const trainingSaveDistanceBtn = document.getElementById("training-save-distance-btn");
const trainingTimeSaved = document.getElementById("training-time-saved");
const trainingEntryHint = document.getElementById("training-entry-hint");

setupModeTabs();
setupWeightTabs();
setupTrainingTabs();
setupInputs();
setupTrainingInputs();
setupTestControls();
setupStorage();
loadData();

function setupModeTabs() {
  const buttons = Array.from(document.querySelectorAll(".mode-tab"));
  buttons.forEach(btn => {
    btn.addEventListener("click", () => activateMode(btn.dataset.mode));
  });
}

function activateMode(mode) {
  document.querySelectorAll(".mode-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  document.querySelectorAll(".mode-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `mode-${mode}`);
  });
  document.getElementById("weight-tabs-wrap").classList.toggle("active", mode === "weight");
  document.getElementById("training-tabs-wrap").classList.toggle("active", mode === "training");
}

function setupWeightTabs() {
  document.querySelectorAll(".weight-tab").forEach(btn => {
    btn.addEventListener("click", () => activateWeightTab(btn.dataset.weightTab));
  });
}

function activateWeightTab(tabName) {
  document.querySelectorAll(".weight-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.weightTab === tabName);
  });
  document.querySelectorAll(".weight-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `weight-${tabName}`);
  });
}

function setupTrainingTabs() {
  document.querySelectorAll(".training-tab").forEach(btn => {
    btn.addEventListener("click", () => activateTrainingTab(btn.dataset.trainingTab));
  });
}

function activateTrainingTab(tabName) {
  document.querySelectorAll(".training-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.trainingTab === tabName);
  });
  document.querySelectorAll(".training-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `training-${tabName}`);
  });
}

function setupInputs() {
  weightInput.addEventListener("input", () => {
    const value = parseFloat(weightInput.value.replace(",", "."));
    saveBtn.disabled = Number.isNaN(value);
  });

  saveBtn.addEventListener("click", () => {
    const value = parseFloat(weightInput.value.replace(",", "."));
    if (Number.isNaN(value)) return;
    saveWeightEntry(value);
    weightInput.value = "";
    saveBtn.disabled = true;
  });

  kcalInput.addEventListener("input", () => {
    kcalSaveBtn.disabled = parseKcalInput(kcalInput.value) === null;
  });

  kcalSaveBtn.addEventListener("click", () => {
    const value = parseKcalInput(kcalInput.value);
    if (value === null) return;
    saveKcalEntry(value);
    kcalInput.value = "";
    kcalSaveBtn.disabled = true;
  });
}

function setupTrainingInputs() {
  trainingTimeInput.addEventListener("input", () => {
    refreshTrainingInputState();
  });

  trainingTimeInput.addEventListener("blur", () => {
    const seconds = parseDurationInput(trainingTimeInput.value);
    if (seconds === null) return;
    trainingTimeInput.value = formatDuration(seconds);
  });

  trainingDistanceInput.addEventListener("input", () => {
    refreshTrainingInputState();
  });

  trainingDistanceInput.addEventListener("blur", () => {
    const km = parseDistanceInput(trainingDistanceInput.value);
    if (km === null) return;
    trainingDistanceInput.value = formatDistanceKm(km);
  });

  trainingSaveTimeBtn.addEventListener("click", () => {
    const seconds = parseDurationInput(trainingTimeInput.value);
    if (seconds === null) return;
    saveTrainingTime(seconds);
    trainingTimeInput.value = "";
    refreshTrainingInputState();
  });

  trainingSaveDistanceBtn.addEventListener("click", () => {
    const km = parseDistanceInput(trainingDistanceInput.value);
    if (km === null) return;
    saveTrainingDistance(km);
    trainingDistanceInput.value = "";
    refreshTrainingInputState();
  });

  refreshTrainingInputState();
}

function setupTestControls() {
  testEnabled.value = String(testTime.enabled);
  testOffset.value = String(testTime.offsetDays);

  testEnabled.addEventListener("change", () => {
    testTime.enabled = Number(testEnabled.value) === 1 ? 1 : 0;
    saveTestTimeState();
    renderAll();
  });

  testOffset.addEventListener("change", () => {
    testTime.offsetDays = toInt(testOffset.value, 0);
    testOffset.value = String(testTime.offsetDays);
    saveTestTimeState();
    renderAll();
  });

  testMinus.addEventListener("click", () => {
    testTime.offsetDays -= 1;
    testOffset.value = String(testTime.offsetDays);
    saveTestTimeState();
    renderAll();
  });

  testPlus.addEventListener("click", () => {
    testTime.offsetDays += 1;
    testOffset.value = String(testTime.offsetDays);
    saveTestTimeState();
    renderAll();
  });

  testToday.addEventListener("click", () => {
    testTime.offsetDays = 0;
    testOffset.value = "0";
    saveTestTimeState();
    renderAll();
  });
}

function setupStorage() {
  try {
    if (firebaseConfig.apiKey) {
      firebase.initializeApp(firebaseConfig);
      entriesRef = firebase.database().ref("waga-entries");
      trainingEntriesRef = firebase.database().ref("waga-training-entries");
      firebaseEnabled = true;
    }
  } catch (err) {
    console.warn("Firebase init failed, fallback to localStorage", err);
    firebaseEnabled = false;
  }
}

function loadData() {
  if (firebaseEnabled && entriesRef && trainingEntriesRef) {
    entriesRef.on("value", snap => {
      entries = Object.values(snap.val() || {});
      sanitizeEntries();
      renderAll();
    });

    trainingEntriesRef.on("value", snap => {
      trainingEntries = Object.values(snap.val() || {});
      sanitizeTrainingEntries();
      renderAll();
    });
  } else {
    const localWeight = localStorage.getItem(STORAGE_KEY);
    entries = localWeight ? JSON.parse(localWeight) : [];
    sanitizeEntries();

    const localTraining = localStorage.getItem(TRAINING_STORAGE_KEY);
    trainingEntries = localTraining ? JSON.parse(localTraining) : [];
    sanitizeTrainingEntries();

    renderAll();
  }
}

function sanitizeEntries() {
  entries = entries
    .map(e => ({
      id: String(e.id || ""),
      dayAnchor: Number(e.dayAnchor),
      weight: parseWeightValue(e.weight),
      kcal: parseKcalValue(e.kcal),
      recordedAt: String(e.recordedAt || new Date().toISOString())
    }))
    .filter(e => Number.isFinite(e.dayAnchor) && e.id && (Number.isFinite(e.weight) || Number.isFinite(e.kcal)))
    .sort((a, b) => a.dayAnchor - b.dayAnchor || new Date(a.recordedAt) - new Date(b.recordedAt));
}

function sanitizeTrainingEntries() {
  trainingEntries = trainingEntries
    .map(e => ({
      id: String(e.id || ""),
      seconds: Number(e.seconds),
      distanceKm: parseDistanceValue(e.distanceKm),
      distanceRequired: inferDistanceRequired(e),
      recordedAt: String(e.recordedAt || new Date().toISOString())
    }))
    .filter(e => e.id && Number.isFinite(e.seconds) && e.seconds >= 0)
    .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
}

function renderAll() {
  renderSummary();
  renderMetrics();
  renderCurrentWeekTable();
  renderTestTimeNote();
  renderEntryState();
  renderChart();
  renderTable();

  renderTrainingSummary();
  renderTrainingMetrics();
  renderTrainingEntryState();
  renderTrainingChart();
  renderTrainingTable();
  renderTrainingRanking();
}

function renderSummary() {
  const displayAnchor = getDisplayAnchor();
  const dayNum = getDisplayDayNumber(displayAnchor.getTime());
  const week = Math.floor((dayNum - 1) / 7) + 1;
  const remain = Math.max(0, CHALLENGE_DAYS - (dayNum - 1));
  const progress = Math.round(Math.min(1, (dayNum - 1) / CHALLENGE_DAYS) * 100);
  document.getElementById("summary-card").innerHTML = `
    <div class="hero-title">DZIEN ${dayNum}</div>
    <div class="hero-sub">TYDZIEN ${week} | POZOSTALO ${remain} DNI</div>
    <div class="progress-line"><div class="fill" style="width:${progress}%;"></div></div>
  `;
}

function renderTrainingSummary() {
  const completedCount = getCompletedTrainingCount();
  const nextTraining = completedCount + 1;
  const remain = Math.max(0, TRAINING_TARGET_COUNT - completedCount);
  const progress = Math.round(Math.min(1, completedCount / TRAINING_TARGET_COUNT) * 100);
  const pending = getPendingTrainingRow();
  const pendingNote = pending ? ` | CZEKA DYSTANS DLA TRENINGU ${pending.trainingIndex}` : "";
  document.getElementById("training-summary-card").innerHTML = `
    <div class="hero-title">TRENING ${nextTraining}</div>
    <div class="hero-sub">UKONCZONE ${completedCount} TRENINGOW | POZOSTALO ${remain}${pendingNote}</div>
    <div class="progress-line"><div class="fill" style="width:${progress}%;"></div></div>
  `;
}

function renderMetrics() {
  const weightEl = document.getElementById("metric-weight");
  const dailyEl = document.getElementById("metric-daily");
  const weeklyEl = document.getElementById("metric-weekly");
  const latest = getLatestWeightEntry();

  weightEl.className = "metric-value";
  dailyEl.className = "metric-value";
  weeklyEl.className = "metric-value";

  if (!latest) {
    weightEl.textContent = "Brak";
    dailyEl.textContent = "Brak";
    weeklyEl.textContent = "Brak";
    weightEl.classList.add("neutral");
    dailyEl.classList.add("neutral");
    weeklyEl.classList.add("neutral");
    return;
  }

  weightEl.textContent = formatWeight(latest.weight);
  weightEl.classList.add("good");

  const dailyDiff = getDailyDiff(latest);
  dailyEl.textContent = dailyDiff === null ? "Brak" : formatDeltaKg(dailyDiff);
  dailyEl.classList.add(getDailyTone(dailyDiff));

  const weeklyDiff = getWeeklyDiff(latest.dayAnchor);
  weeklyEl.textContent = weeklyDiff === null ? "Brak" : formatDeltaKg(weeklyDiff);
  const weeklyTone = getWeeklyTone(weeklyDiff);
  weeklyEl.classList.add(weeklyTone);
  if (weeklyTone === "gold") weeklyEl.classList.add("gold-glow");
}

function renderTrainingMetrics() {
  const lastEl = document.getElementById("training-metric-last");
  const recordEl = document.getElementById("training-metric-record");
  const latest = getLatestTraining();
  const recordSeconds = getTrainingRecordSeconds();

  lastEl.className = "metric-value";
  recordEl.className = "metric-value";

  if (!latest) {
    lastEl.textContent = "Brak";
    recordEl.textContent = "Brak";
    lastEl.classList.add("neutral");
    recordEl.classList.add("neutral");
    return;
  }

  lastEl.textContent = formatDuration(latest.seconds);
  lastEl.classList.add("good");
  recordEl.textContent = formatDuration(recordSeconds);
  recordEl.classList.add("gold");
  recordEl.classList.add("gold-glow");
}

function renderTrainingEntryState() {
  const pending = getPendingTrainingRow();
  const hasPending = Boolean(pending);
  trainingTimeInput.style.display = hasPending ? "none" : "";
  trainingSaveTimeBtn.style.display = hasPending ? "none" : "";
  trainingTimeSaved.style.display = hasPending ? "block" : "none";
  if (pending) {
    trainingEntryHint.textContent = `Trening ${pending.trainingIndex}: czas zapisany. Podaj dystans, aby przejsc dalej.`;
  } else {
    trainingEntryHint.textContent = "Najpierw zapisz czas, potem dystans w km.";
  }
  refreshTrainingInputState();
}

function refreshTrainingInputState() {
  const parsedTime = parseDurationInput(trainingTimeInput.value);
  const parsedDistance = parseDistanceInput(trainingDistanceInput.value);
  const pending = getPendingTrainingEntry();
  const hasPending = Boolean(pending);

  trainingSaveTimeBtn.disabled = hasPending || parsedTime === null;
  trainingDistanceInput.disabled = !hasPending;
  trainingSaveDistanceBtn.disabled = !hasPending || parsedDistance === null;
}

function renderTestTimeNote() {
  const note = document.getElementById("test-time-note");
  const now = getNow();
  if (testTime.enabled === 1) {
    const sign = testTime.offsetDays >= 0 ? "+" : "";
    note.textContent = `TRYB TESTOWY: 1 | Offset ${sign}${testTime.offsetDays} dni | Symulowana data: ${formatFullDate(now)}`;
  } else {
    note.textContent = `TRYB TESTOWY: 0 | Realna data: ${formatFullDate(now)}`;
  }
}

function renderEntryState() {
  const todayAnchor = getDayAnchor().getTime();
  const todayEntry = getEntryForDay(todayAnchor);
  const hasWeight = Number.isFinite(todayEntry?.weight);
  const hasKcal = Number.isFinite(todayEntry?.kcal);
  weightEntryCard.style.display = hasWeight ? "none" : "block";
  kcalEntryCard.style.display = hasKcal ? "none" : "block";
  entryCards.style.display = hasWeight && hasKcal ? "none" : "grid";
}

function renderChart() {
  const canvas = document.getElementById("weightChart");
  const data = buildChartData();
  const maxDay = getDisplayDayNumber(getDisplayAnchor().getTime());
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas, {
    type: "line",
    data,
    options: {
      animation: { duration: 400 },
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      elements: { line: { borderWidth: 3, tension: 0.35 }, point: { radius: 5, hoverRadius: 7, borderWidth: 2 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: ctx => `Dzien ${ctx[0].parsed.x}`, label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} kg` } }
      },
      scales: {
        x: { type: "linear", min: 1, max: maxDay, title: { display: true, text: "Dzien", color: "#c7d0dc" }, ticks: { color: "#c7d0dc", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { title: { display: true, text: "Waga [kg]", color: "#c7d0dc" }, ticks: { color: "#c7d0dc", callback: value => `${Number(value).toFixed(1)}` }, grid: { color: "rgba(255,255,255,0.04)" } }
      }
    }
  });
}

function renderTrainingChart() {
  const rows = getTrainingRowsWithIndex();
  const points = rows.map(row => ({ x: row.trainingIndex, y: row.seconds }));
  const canvas = document.getElementById("trainingChart");
  if (trainingChartInstance) trainingChartInstance.destroy();

  trainingChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Czas do 135 bpm",
          data: points,
          borderColor: "#64d3ff",
          backgroundColor: "#64d3ff",
          pointBorderColor: "#64d3ff",
          pointBackgroundColor: "#64d3ff",
          fill: false
        }
      ]
    },
    options: {
      animation: { duration: 400 },
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      elements: { line: { borderWidth: 3, tension: 0.35 }, point: { radius: 5, hoverRadius: 7, borderWidth: 2 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: ctx => `Trening ${ctx[0].parsed.x}`, label: ctx => `${ctx.dataset.label}: ${formatDuration(ctx.parsed.y)}` } }
      },
      scales: {
        x: { type: "linear", min: 1, max: Math.max(1, rows.length), title: { display: true, text: "Trening", color: "#c7d0dc" }, ticks: { color: "#c7d0dc", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { title: { display: true, text: "Czas [MM:SS]", color: "#c7d0dc" }, ticks: { color: "#c7d0dc", callback: value => formatDuration(Number(value)) }, grid: { color: "rgba(255,255,255,0.04)" } }
      }
    }
  });
}

function renderTable() {
  const wrap = document.getElementById("table-wrap");
  const rows = getChallengeTableRows();
  wrap.innerHTML = buildTableHTML(rows);
  attachDeleteHandlers(wrap);
}

function renderTrainingTable() {
  const wrap = document.getElementById("training-table-wrap");
  const rows = getTrainingRowsWithIndex();
  if (!rows.length) {
    wrap.innerHTML = '<div class="sheet-empty">Brak danych do tabeli.</div>';
    return;
  }
  wrap.innerHTML = buildTrainingTableHTML(rows);
  attachDeleteHandlers(wrap);
}

function renderTrainingRanking() {
  const wrap = document.getElementById("training-ranking-wrap");
  const rows = getTrainingRowsSortedBySecondsDesc();
  if (!rows.length) {
    wrap.innerHTML = '<div class="sheet-empty">Brak danych do rankingu.</div>';
    return;
  }
  wrap.innerHTML = buildTrainingRankingTableHTML(rows);
  attachDeleteHandlers(wrap);
}

function renderCurrentWeekTable() {
  const card = document.getElementById("week-table-card");
  const wrap = document.getElementById("week-table-wrap");
  const currentWeek = getWeekIndexFromAnchor(getDayAnchor().getTime());
  const weekRows = getEntriesByDayAsc().filter(e => getWeekIndexFromAnchor(e.dayAnchor) === currentWeek);

  if (!weekRows.length) {
    card.style.display = "none";
    wrap.innerHTML = "";
    return;
  }

  card.style.display = "block";
  wrap.innerHTML = buildTableHTML(weekRows);
  attachDeleteHandlers(wrap);
}

function getChallengeTableRows() {
  const rowsByDay = new Map(getEntriesByDayAsc().map(entry => [entry.dayAnchor, entry]));
  const rows = [];
  const startAnchor = START_DATE.getTime();
  const endAnchor = startAnchor + ((CHALLENGE_DAYS - 1) * DAY_MS);

  for (let anchor = startAnchor; anchor <= endAnchor; anchor += DAY_MS) {
    const existing = rowsByDay.get(anchor);
    if (existing) rows.push(existing);
    else rows.push({ id: "", dayAnchor: anchor, weight: null, recordedAt: "" });
  }

  return rows;
}

function buildTableHTML(rows) {
  const weekMeta = buildWeekMeta(rows);
  const baseline = getBaselineWeight();
  const dailyDelta = WEEKLY_TARGET_DELTA / 7;
  const out = [];
  out.push('<table class="sheet-table">');
  out.push('<thead><tr><th>#</th><th>Data</th><th class="weight-col">Kcal</th><th class="weight-col">Waga</th><th>Roznica</th><th>Srednia Tygodniowa</th><th>Roznica Tygodniowa</th><th class="actions">X</th></tr></thead><tbody>');

  rows.forEach((entry, idx) => {
    const dayNum = getDayNumber(new Date(entry.dayAnchor));
    const weekIdx = getWeekIndexFromAnchor(entry.dayAnchor);
    const daily = getDailyDiffByAnchor(entry.dayAnchor);
    const dailyTone = getDailyTone(daily);
    const dailyClass = daily === null ? "" : ` day-diff ${dailyTone}`;

    out.push("<tr>");
    out.push(`<td class="num">${dayNum}</td>`);
    out.push(`<td>${formatDateCell(new Date(entry.dayAnchor))}</td>`);
    let weightCell = "";
    if (Number.isFinite(entry.weight)) {
      weightCell = formatTableWeight(entry.weight);
    } else if (baseline !== null) {
      const forecast = baseline + ((dayNum - 1) * dailyDelta);
      weightCell = `<span class="forecast-hint">${formatTableWeight(forecast)}</span>`;
    }
    out.push(`<td class="num">${Number.isFinite(entry.kcal) ? formatKcal(entry.kcal) : ""}</td>`);
    out.push(`<td class="num weight-cell">${weightCell}</td>`);
    out.push(`<td class="num${dailyClass}">${daily === null ? "" : formatSignedTableDeltaOne(daily)}</td>`);

    const wm = weekMeta.get(weekIdx);
    if (wm && wm.firstRow === idx) {
      const avg = getWeekAverage(weekIdx);
      const diff = getWeeklyDiffForWeek(weekIdx);
      const diffTone = getWeeklyTone(diff);
      const diffGlowClass = diffTone === "gold" ? " gold-glow" : "";
      out.push(`<td class="week week-avg" rowspan="${wm.rowCount}">${avg === null ? "" : formatTableTwo(avg)}</td>`);
      out.push(`<td class="week week-diff ${diffTone}${diffGlowClass}" rowspan="${wm.rowCount}">${diff === null ? "" : formatSignedTableTwo(diff)}</td>`);
    }

    if (entry.id) out.push(`<td class="actions"><button class="delete-btn" type="button" data-entry-id="${entry.id}" aria-label="Usun wpis">X</button></td>`);
    else out.push('<td class="actions"></td>');
    out.push("</tr>");
  });

  out.push("</tbody></table>");
  return out.join("");
}

function buildTrainingTableHTML(rows) {
  const averageLastFive = getTrainingAverageLastRuns(5);
  const latest = getLatestTraining();
  const latestId = latest ? latest.id : "";
  const averageDiff = latest && averageLastFive !== null ? latest.seconds - averageLastFive : null;
  const averageTone = getTrainingTone(averageDiff);
  const averageDiffClass = averageDiff === null ? "" : ` week-diff ${averageTone}`;
  const out = [];
  out.push('<table class="sheet-table">');
  out.push('<thead><tr><th>#</th><th>Data</th><th class="weight-col">Czas do 135 bpm</th><th class="weight-col">Dystans [km]</th><th>Roznica</th><th>Srednia 5 biegow</th><th>Roznica do sredniej</th><th class="actions">X</th></tr></thead><tbody>');

  rows.forEach((entry, idx) => {
    const daily = getTrainingDailyDiffByTrainingIndex(entry.trainingIndex);
    const dailyTone = getTrainingTone(daily);
    const dailyClass = daily === null ? "" : ` day-diff ${dailyTone}`;
    const isLatest = entry.id === latestId;
    const timeClass = entry.id === latestId ? "num weight-cell last-result" : "num weight-cell";

    out.push(isLatest ? '<tr class="last-result-row">' : "<tr>");
    out.push(`<td class="num">${entry.trainingIndex}</td>`);
    out.push(`<td>${formatDateCell(new Date(entry.recordedAt))}</td>`);
    out.push(`<td class="${timeClass}">${formatDuration(entry.seconds)}</td>`);
    out.push(`<td class="num">${Number.isFinite(entry.distanceKm) ? formatDistanceKm(entry.distanceKm) : ""}</td>`);
    out.push(`<td class="num${dailyClass}">${daily === null ? "" : formatSignedDurationDelta(daily)}</td>`);
    if (idx === 0) {
      out.push(`<td class="week week-avg" rowspan="${rows.length}">${averageLastFive === null ? "" : formatDuration(averageLastFive)}</td>`);
      out.push(`<td class="week${averageDiffClass}" rowspan="${rows.length}">${averageDiff === null ? "" : formatSignedDurationDelta(averageDiff)}</td>`);
    }

    out.push(`<td class="actions"><button class="delete-btn" type="button" data-training-entry-id="${entry.id}" aria-label="Usun wpis">X</button></td>`);
    out.push("</tr>");
  });

  out.push("</tbody></table>");
  return out.join("");
}

function buildTrainingRankingTableHTML(rows) {
  const latest = getLatestTraining();
  const latestId = latest ? latest.id : "";
  const out = [];
  out.push('<table class="sheet-table">');
  out.push('<thead><tr><th>#</th><th>Data</th><th class="weight-col">Czas do 135 bpm</th><th class="actions">X</th></tr></thead><tbody>');

  rows.forEach(entry => {
    const isLatest = entry.id === latestId;
    const timeClass = isLatest ? "num weight-cell last-result" : "num weight-cell";
    out.push(isLatest ? '<tr class="last-result-row">' : "<tr>");
    out.push(`<td class="num">${entry.trainingIndex}</td>`);
    out.push(`<td>${formatDateCell(new Date(entry.recordedAt))}</td>`);
    out.push(`<td class="${timeClass}">${formatDuration(entry.seconds)}</td>`);
    out.push(`<td class="actions"><button class="delete-btn" type="button" data-training-entry-id="${entry.id}" aria-label="Usun wpis">X</button></td>`);
    out.push("</tr>");
  });

  out.push("</tbody></table>");
  return out.join("");
}

function attachDeleteHandlers(container) {
  container.querySelectorAll("[data-entry-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.entryId));
  });
  container.querySelectorAll("[data-training-entry-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteTrainingEntry(btn.dataset.trainingEntryId));
  });
}
function getNow() {
  const now = new Date();
  if (testTime.enabled !== 1) return now;
  return new Date(now.getTime() + testTime.offsetDays * DAY_MS);
}

function getDayAnchor(date = getNow()) {
  const d = new Date(date);
  const fourAM = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 4, 0, 0, 0);
  if (d < fourAM) fourAM.setDate(fourAM.getDate() - 1);
  return fourAM;
}

function getDayNumber(anchorDate) {
  const anchor = new Date(anchorDate);
  if (anchor < START_DATE) return 1;
  return Math.floor((anchor - START_DATE) / DAY_MS) + 1;
}

function getDisplayDayNumber(anchorMs) {
  return getDayNumber(new Date(anchorMs));
}

function getDisplayAnchor() {
  const today = getDayAnchor();
  const latest = getLatestEntryByDay();
  if (!latest) return today;
  return new Date(Math.max(today.getTime(), latest.dayAnchor));
}

function getEntriesByDayAsc() {
  const map = new Map();
  entries.forEach(e => {
    const prev = map.get(e.dayAnchor);
    if (!prev) {
      map.set(e.dayAnchor, { ...e });
      return;
    }

    const prevTime = new Date(prev.recordedAt).getTime();
    const nextTime = new Date(e.recordedAt).getTime();
    const useCurrentMeta = nextTime >= prevTime;
    map.set(e.dayAnchor, {
      id: useCurrentMeta ? e.id : prev.id,
      dayAnchor: e.dayAnchor,
      weight: Number.isFinite(e.weight) ? e.weight : prev.weight,
      kcal: Number.isFinite(e.kcal) ? e.kcal : prev.kcal,
      recordedAt: useCurrentMeta ? e.recordedAt : prev.recordedAt
    });
  });
  return Array.from(map.values()).sort((a, b) => a.dayAnchor - b.dayAnchor);
}

function getTrainingRowsWithIndex() {
  return trainingEntries.map((entry, idx) => ({ ...entry, trainingIndex: idx + 1 }));
}

function getPendingTrainingRow() {
  const rows = getTrainingRowsWithIndex();
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].distanceRequired && !Number.isFinite(rows[i].distanceKm)) return rows[i];
  }
  return null;
}

function getPendingTrainingEntry() {
  const pending = getPendingTrainingRow();
  if (!pending) return null;
  return trainingEntries.find(entry => entry.id === pending.id) || null;
}

function getCompletedTrainingCount() {
  return trainingEntries.filter(isTrainingEntryCompleted).length;
}

function getTrainingRowsSortedBySecondsDesc() {
  return [...getTrainingRowsWithIndex()].sort((a, b) => b.seconds - a.seconds || a.trainingIndex - b.trainingIndex);
}

function getTrainingAverageLastRuns(windowSize = 5) {
  if (!trainingEntries.length) return null;
  const sample = trainingEntries.slice(-windowSize);
  return sample.reduce((sum, entry) => sum + entry.seconds, 0) / sample.length;
}

function getLatestEntryByDay() {
  const rows = getEntriesByDayAsc();
  return rows.length ? rows[rows.length - 1] : null;
}

function getLatestWeightEntry() {
  const rows = getEntriesByDayAsc().filter(row => Number.isFinite(row.weight));
  return rows.length ? rows[rows.length - 1] : null;
}

function getLatestTraining() {
  return trainingEntries.length ? trainingEntries[trainingEntries.length - 1] : null;
}

function getTrainingRecordSeconds() {
  if (!trainingEntries.length) return null;
  return trainingEntries.reduce((max, entry) => (entry.seconds > max ? entry.seconds : max), trainingEntries[0].seconds);
}

function getEntryForDay(anchorMs) {
  const rows = getEntriesByDayAsc();
  for (let i = 0; i < rows.length; i += 1) if (rows[i].dayAnchor === anchorMs) return rows[i];
  return null;
}

function getTrainingEntryByTrainingIndex(trainingIndex) {
  return trainingEntries[trainingIndex - 1] || null;
}

function getDailyDiff(latest) {
  if (!latest) return null;
  if (!Number.isFinite(latest.weight)) return null;
  const yesterday = getEntryForDay(latest.dayAnchor - DAY_MS);
  if (!yesterday || !Number.isFinite(yesterday.weight)) return null;
  return latest.weight - yesterday.weight;
}

function getTrainingDailyDiffByTrainingIndex(trainingIndex) {
  const current = getTrainingEntryByTrainingIndex(trainingIndex);
  const previous = getTrainingEntryByTrainingIndex(trainingIndex - 1);
  if (!current || !previous) return null;
  return current.seconds - previous.seconds;
}

function getDailyDiffByAnchor(anchorMs) {
  const current = getEntryForDay(anchorMs);
  const yesterday = getEntryForDay(anchorMs - DAY_MS);
  if (!current || !yesterday) return null;
  if (!Number.isFinite(current.weight) || !Number.isFinite(yesterday.weight)) return null;
  return current.weight - yesterday.weight;
}

function getBaselineWeight() {
  const rows = getEntriesByDayAsc();
  const firstWithWeight = rows.find(row => Number.isFinite(row.weight));
  return firstWithWeight ? firstWithWeight.weight : null;
}

function getWeekIndexFromAnchor(anchorMs) {
  const dayNum = getDayNumber(new Date(anchorMs));
  return Math.max(0, Math.floor((dayNum - 1) / 7));
}

function getWeekAverage(weekIndex) {
  const weekStart = START_DATE.getTime() + weekIndex * 7 * DAY_MS;
  const weekEnd = weekStart + (7 * DAY_MS) - 1;
  const values = getEntriesByDayAsc()
    .filter(e => e.dayAnchor >= weekStart && e.dayAnchor <= weekEnd && Number.isFinite(e.weight))
    .map(e => e.weight);
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getPreviousWeekAverageWithData(fromWeekIndex) {
  for (let i = fromWeekIndex; i >= 0; i -= 1) {
    const avg = getWeekAverage(i);
    if (avg !== null) return avg;
  }
  return null;
}

function getWeeklyDiff(latestAnchorMs) {
  return getWeeklyDiffForWeek(getWeekIndexFromAnchor(latestAnchorMs));
}

function getWeeklyDiffForWeek(weekIndex) {
  const currentAvg = getWeekAverage(weekIndex);
  if (currentAvg === null) return null;
  const prevAvg = getPreviousWeekAverageWithData(weekIndex - 1);
  if (prevAvg !== null) return currentAvg - prevAvg;
  const base = getBaselineWeight();
  return base === null ? null : currentAvg - base;
}

function buildWeekMeta(rowsAsc) {
  const meta = new Map();
  rowsAsc.forEach((entry, idx) => {
    const week = getWeekIndexFromAnchor(entry.dayAnchor);
    if (!meta.has(week)) meta.set(week, { firstRow: idx, rowCount: 1 });
    else meta.get(week).rowCount += 1;
  });
  return meta;
}

function getDailyTone(value) {
  if (value === null) return "neutral";
  if (value < 0) return "good";
  if (value > 0) return "bad";
  return "neutral";
}

function getTrainingTone(value) {
  if (value === null) return "neutral";
  if (value > 0) return "good";
  if (value < 0) return "bad";
  return "neutral";
}

function getWeeklyTone(value) {
  if (value === null) return "neutral";
  if (value <= -0.6) return "gold";
  if (value < 0) return "good";
  if (value > 0) return "bad";
  return "neutral";
}

function saveWeightEntry(weight) {
  upsertEntryForDay({ weight: Number(weight) });
}

function saveKcalEntry(kcal) {
  upsertEntryForDay({ kcal: Number(kcal) });
}

function upsertEntryForDay(patch) {
  const now = getNow();
  const dayAnchor = getDayAnchor(now).getTime();
  const existing = getEntryForDay(dayAnchor);
  const id = existing?.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const entry = {
    id,
    dayAnchor,
    weight: Number.isFinite(existing?.weight) ? existing.weight : null,
    kcal: Number.isFinite(existing?.kcal) ? existing.kcal : null,
    recordedAt: now.toISOString()
  };

  if (Number.isFinite(patch.weight)) entry.weight = Number(patch.weight);
  if (Number.isFinite(patch.kcal)) entry.kcal = Math.round(Number(patch.kcal));
  if (!Number.isFinite(entry.weight) && !Number.isFinite(entry.kcal)) return;

  entries = entries.filter(e => e.dayAnchor !== dayAnchor);
  entries.push(entry);
  persistEntries();

  if (firebaseEnabled && entriesRef) {
    entriesRef.orderByChild("dayAnchor").equalTo(dayAnchor).once("value", snap => {
      const data = snap.val() || {};
      Object.keys(data).forEach(key => { if (key !== id) entriesRef.child(key).remove(); });
      entriesRef.child(id).set(entry);
    });
  }
}

function saveTrainingTime(seconds) {
  const pending = getPendingTrainingEntry();
  if (pending) {
    pending.seconds = Number(seconds);
    persistTrainingEntries();
    if (firebaseEnabled && trainingEntriesRef) trainingEntriesRef.child(pending.id).set(pending);
    return;
  }

  const now = getNow();
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  const entry = {
    id,
    seconds: Number(seconds),
    distanceKm: null,
    distanceRequired: true,
    recordedAt: now.toISOString()
  };

  trainingEntries.push(entry);
  persistTrainingEntries();
  if (firebaseEnabled && trainingEntriesRef) trainingEntriesRef.child(id).set(entry);
}

function saveTrainingDistance(distanceKm) {
  const pending = getPendingTrainingEntry();
  if (!pending) return;

  pending.distanceKm = Number(distanceKm);
  pending.distanceRequired = true;
  persistTrainingEntries();
  if (firebaseEnabled && trainingEntriesRef) trainingEntriesRef.child(pending.id).set(pending);
}

function persistTrainingEntries() {
  sanitizeTrainingEntries();
  if (!firebaseEnabled) localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(trainingEntries));
  renderAll();
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  persistEntries();
  if (firebaseEnabled && entriesRef) entriesRef.child(id).remove();
}

function persistEntries() {
  sanitizeEntries();
  if (!firebaseEnabled) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  renderAll();
}

function deleteTrainingEntry(id) {
  trainingEntries = trainingEntries.filter(e => e.id !== id);
  persistTrainingEntries();
  if (firebaseEnabled && trainingEntriesRef) trainingEntriesRef.child(id).remove();
}

function buildChartData() {
  const points = getEntriesByDayAsc()
    .filter(e => Number.isFinite(e.weight))
    .map(e => ({ x: getDisplayDayNumber(e.dayAnchor), y: e.weight }));
  const maxDay = getDisplayDayNumber(getDisplayAnchor().getTime());
  const baseline = getBaselineWeight();
  const forecastPoints = [];

  if (baseline !== null) {
    const dailyDelta = WEEKLY_TARGET_DELTA / 7;
    for (let day = 1; day <= maxDay; day += 1) {
      forecastPoints.push({ x: day, y: baseline + (day - 1) * dailyDelta });
    }
  }

  return {
    datasets: [
      {
        label: "Waga",
        data: points,
        borderColor: "#64d3ff",
        backgroundColor: "#64d3ff",
        pointBorderColor: "#64d3ff",
        pointBackgroundColor: "#64d3ff",
        fill: false
      },
      {
        label: "Prognoza",
        data: forecastPoints,
        borderColor: "rgba(255, 213, 106, 0.5)",
        backgroundColor: "rgba(255, 213, 106, 0.5)",
        borderWidth: 1.4,
        borderDash: [6, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false
      }
    ]
  };
}

function loadTestTimeState() {
  try {
    const raw = localStorage.getItem(TEST_TIME_KEY);
    if (!raw) return { enabled: 0, offsetDays: 0 };
    const parsed = JSON.parse(raw);
    return { enabled: Number(parsed.enabled) === 1 ? 1 : 0, offsetDays: toInt(parsed.offsetDays, 0) };
  } catch (_) {
    return { enabled: 0, offsetDays: 0 };
  }
}

function saveTestTimeState() {
  localStorage.setItem(TEST_TIME_KEY, JSON.stringify(testTime));
}

function parseDurationInput(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+)\s*:\s*([0-5]?\d)$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60) + seconds;
}

function parseDistanceInput(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const km = Number(text);
  if (!Number.isFinite(km) || km <= 0) return null;
  return km;
}

function parseDistanceValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function parseWeightValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function parseKcalInput(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const kcal = Number(text);
  if (!Number.isFinite(kcal) || kcal < 0) return null;
  return Math.round(kcal);
}

function parseKcalValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

function inferDistanceRequired(entry) {
  if (typeof entry?.distanceRequired === "boolean") return entry.distanceRequired;
  return Object.prototype.hasOwnProperty.call(entry || {}, "distanceKm");
}

function isTrainingEntryCompleted(entry) {
  if (!entry) return false;
  if (!Number.isFinite(entry.seconds) || entry.seconds < 0) return false;
  if (!entry.distanceRequired) return true;
  return Number.isFinite(entry.distanceKm);
}

function toInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}

function formatWeight(value) { return `${value.toFixed(2)} kg`; }
function formatDeltaKg(value) { const sign = value > 0 ? "+" : ""; return `${sign}${value.toFixed(2)} kg`; }
function formatDateCell(date) { return date.toLocaleDateString("pl-PL", { day: "numeric", month: "long" }); }
function formatFullDate(date) { return date.toLocaleString("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function formatTableWeight(value) { return value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 }); }
function formatSignedTableDeltaOne(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
}
function formatTableTwo(value) { return value.toFixed(2).replace(".", ","); }
function formatSignedTableTwo(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2).replace(".", ",")}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatKcal(value) {
  return Math.round(Number(value) || 0).toLocaleString("pl-PL");
}

function formatDistanceKm(value) {
  return Number(value).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatSignedDurationDelta(seconds) {
  const rounded = Math.round(Number(seconds) || 0);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${formatDuration(Math.abs(rounded))}`;
}
