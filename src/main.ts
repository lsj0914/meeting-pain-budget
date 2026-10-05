import "./style.css";
import {
  type Config,
  type Results,
  type Slot,
  type Language,
  MAX_BYTES,
  InputError,
} from "./model";
import { validateConfig } from "./engine";
import { example } from "./examples";
import { calendar, csv, markdown, parse, serialize } from "./documents";
import { inside, localParts, offsetLabel, STEP } from "./time";

const KEY = "meeting-pain-budget:v1";
let config = example(),
  language: Language = "en",
  rejected: string | null = null,
  storageMessage = "",
  results: Results | null = null;
let activeConfig: Config | null = null,
  revision = 0,
  selected: number | null = null,
  view: "rotation" | "fixed" = "rotation",
  pending = false,
  error = "";
let allCandidates = false;
let timer: ReturnType<typeof setTimeout>;
try {
  language = localStorage.getItem(KEY + ":language") === "zh" ? "zh" : "en";
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      config = parse(raw);
    } catch {
      rejected = raw;
    }
  }
} catch {
  storageMessage = "storage";
}
const t = (en: string, zh: string) => (language === "zh" ? zh : en);
const esc = (v: unknown) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const points = (n: number) =>
  Number(n.toFixed(2)).toLocaleString(language === "zh" ? "zh-CN" : "en-US");
const percent = (n: number) => `${Math.round(n * 100)}%`;
const zoneName = (z: string) => z.split("/").at(-1)!.replaceAll("_", " ");
const weekdays = () =>
  language === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
worker.onmessage = (e) => {
  if (e.data.revision !== revision) return;
  pending = false;
  if (e.data.error) {
    error = t(
      "Calculation failed. Please check the team settings.",
      "计算失败，请检查团队设置。",
    );
    results = null;
  } else {
    results = e.data.results;
    selected =
      results!.rotation?.slots[0].start ??
      results!.candidates[0]?.start ??
      null;
  }
  renderResults();
  setStatus();
};
worker.onerror = () => {
  pending = false;
  error = t(
    "The calculator could not start. Reload the page to retry.",
    "计算器未能启动，请刷新页面重试。",
  );
  results = null;
  renderResults();
  setStatus();
};

const root = document.querySelector<HTMLDivElement>("#app")!;
function shell() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  root.innerHTML = `<a class="skip" href="#result">${t("Skip to results", "跳到结果")}</a>
  <header class="site-header"><a class="brand" href="./"><span class="brand-clock" aria-hidden="true"></span><span>Meeting Pain Budget</span></a><nav aria-label="${t("Site navigation", "网站导航")}"><a href="https://github.com/lsj0914/meeting-pain-budget" target="_blank" rel="noopener">GitHub <span aria-hidden="true">↗</span></a><button class="language" data-action="language">${t("中文", "English")}</button></nav></header>
  <main><section class="hero"><div><div class="eyebrow"><span class="live-dot"></span>${t("A LITTLE TOOL FOR GLOBAL TEAMS", "给跨时区团队的小工具")}</div><h1 aria-label="${t("Share the early mornings.", "早起晚睡，也该轮着来。")}">${t("Share the<br>early mornings.", "<span>早起晚睡，</span><span>也该轮着来。</span>")}</h1><p>${t("Same meeting. Different sacrifices.<br>Find a time, see who pays for it, then take turns.", "同一场会议，有人刚起床，有人快睡了。<br>找到合适的时间，再让不便轮着来。")}</p><div class="hero-tags"><span>${t("Real time zones", "真实时区")}</span><span>${t("A fairer rotation", "公平轮换")}</span><span>${t("No sign-in", "无需登录")}</span></div></div><div class="hero-art" aria-hidden="true"><span class="orbit-text">ONE TEAM · DIFFERENT DAYS</span><div class="art-clock"><i></i><b></b><em></em><span>12</span><small>6</small></div><div class="city-tag tag-a"><span>☀</span> ${t("Someone’s morning", "某人的清晨")}</div><div class="city-tag tag-b"><span>☾</span> ${t("Someone’s evening", "某人的傍晚")}</div><span class="art-note">${t("A little consideration goes a long way.", "把体谅放进日程表。")}</span></div></section>
  <section class="example-strip" aria-label="${t("Try an example", "试试示例")}"><span>${t("START WITH A STORY", "从一个场景开始")}</span><button data-example="two" aria-label="${t("New York ↔ Shanghai", "纽约 ↔ 上海")}">${t("New York ↔ Shanghai", "纽约 ↔ 上海")}</button><button data-example="three" aria-label="${t("Three cities", "三城团队")}">${t("Three cities", "三城团队")}</button><button data-example="night" aria-label="${t("Night-shift handover", "夜班交接")}">${t("Night-shift handover", "夜班交接")}</button></section>
  <div id="recovery"></div><div class="workspace"><section class="editor-panel" aria-labelledby="editor-title"><div class="section-title"><span class="step">01</span><div><h2 id="editor-title">${t("Set the team", "设置团队")}</h2><p>${t("Every person has a different day.", "每个人的一天都不一样。")}</p></div></div><div id="editor"></div></section><section id="result" class="result-panel" aria-labelledby="result-title"><div class="section-title"><span class="step">02</span><div><h2 id="result-title">${t("Find the balance", "找个平衡点")}</h2><p>${t("Make the trade-off visible.", "让时间背后的取舍看得见。")}</p></div><span id="status" class="status" aria-live="polite"></span></div><div id="results"></div></section></div>
  <section class="method" aria-labelledby="method-title"><div><span class="eyebrow">${t("THE SMALL PRINT, MADE READABLE", "规则说明")}</span><h2 id="method-title">${t("Fairness needs a definition.", "公平，需要说清楚。")}</h2><p>${t("These points describe inconvenience, not people’s worth. Adjust each person’s budget together before choosing a schedule.", "这些积分表示不便程度。先一起商量每个人的预算，再决定日程。")}</p></div><div class="policy-grid"><div><strong>0</strong><span>${t("Comfortable hours", "舒服时段")}</span></div><div><strong>2</strong><span>${t("Awake, outside hours", "清醒但不舒服")}</span></div><div><strong>8</strong><span>${t("During sleep", "睡眠时段")}</span></div><div><strong>+4</strong><span>${t("On a day off", "非工作日")}</span></div></div><p class="method-detail">${t("Points per hour, counted for the entire meeting in 15-minute segments. Sleep and day-off protection are hard constraints. Budgets are targets, not guarantees. The planner first reduces the largest (carried + new points) ÷ max(budget, 1), then total new points, then the spread of budget use. It searches a bounded set of schedules, so the result may not be globally optimal. A zero budget uses 1 in this comparison; any positive burden still exceeds that budget.", "以上均为每小时积分，按整场会议的每 15 分钟计算。保护睡眠和非工作日属于硬性限制。预算是目标，并非保证。首先降低最高的「历史 + 新增积分」÷ max(预算, 1)，再降低总新增积分和预算使用差距。算法搜索有限数量的日程，结果可能不是全局最优。零预算在比较中按 1 计算，但任何正积分都算超预算。")}</p></section>
  </main><footer><span>Meeting Pain Budget <span class="footer-dot">·</span> ${t("Built for a little more consideration.", "多一点体谅，少一点熬夜。")}</span><span>${t("Runs in your browser. No data is sent.", "数据留在浏览器，不会发送。")} <a href="https://github.com/lsj0914/meeting-pain-budget" target="_blank" rel="noopener">${t("Source", "源码")} ↗</a></span></footer>
  <input id="import-file" type="file" accept=".json,application/json" hidden><datalist id="zones">${["UTC", ...Intl.supportedValuesOf("timeZone")].map((z) => `<option value="${esc(z)}"></option>`).join("")}</datalist>`;
  renderEditor();
  renderRecovery();
  renderResults();
  setStatus();
}
function input(
  label: string,
  field: string,
  value: string | number,
  type = "text",
  extra = "",
) {
  return `<label>${label}<input data-field="${field}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function renderEditor() {
  document.querySelector("#editor")!.innerHTML =
    `<div class="meeting-fields">${input(t("Meeting name", "会议名称"), "title", config.title, "text", 'maxlength="120"')}
  <div class="field-pair">${input(t("First date", "第一次会议"), "date", config.date, "date", 'min="2000-01-01" max="2099-12-31"')}${input(t("Reference time zone", "参考时区"), "referenceZone", config.referenceZone, "text", 'list="zones" autocomplete="off"')}</div>
  <div class="field-pair">${input(t("Duration · minutes", "时长 · 分钟"), "duration", config.duration, "number", 'min="15" max="180" step="15"')}${input(t("Weekly meetings", "每周一次 · 共几次"), "occurrences", config.occurrences, "number", 'min="1" max="8" step="1"')}</div><p class="field-note">${t("Each week uses this reference zone’s calendar date.", "每周日期以参考时区为准。")}</p>
  <div class="protections"><label><input data-field="protectSleep" type="checkbox" ${config.protectSleep ? "checked" : ""}><span>${t("Protect sleep", "保护睡眠")}</span></label><label><input data-field="protectDays" type="checkbox" ${config.protectDays ? "checked" : ""}><span>${t("Protect days off", "保护非工作日")}</span></label></div></div>
  <div class="people-heading"><h3>${t("People", "参会人")} <span>${config.people.length}/12</span></h3><button class="text-button" data-action="add" ${config.people.length >= 12 ? "disabled" : ""}>+ ${t("Add person", "添加")}</button></div>
  <div class="people">${config.people
    .map(
      (
        p,
        i,
      ) => `<article class="person" data-person="${esc(p.id)}"><div class="person-top"><span class="avatar color-${i % 4}" aria-hidden="true">${esc((p.name || "?").slice(0, 1).toUpperCase())}</span><span class="person-number">${t("PERSON", "参会人")} ${String(i + 1).padStart(2, "0")}</span><button class="remove" data-action="remove" aria-label="${esc(t("Remove ", "移除 ") + p.name)}" ${config.people.length <= 2 ? "disabled" : ""}>×</button></div>
  <div class="field-pair">${input(t("Name", "姓名"), "name", p.name, "text", 'maxlength="80"')}${input(t("Time zone", "时区"), "zone", p.zone, "text", 'list="zones" autocomplete="off"')}</div>
  <div class="window-row"><span>${t("Comfortable hours", "舒服时段")}</span><div>${input(t("From", "开始"), "workStart", p.workStart, "time", 'step="900"')}${input(t("To", "结束"), "workEnd", p.workEnd, "time", 'step="900"')}</div></div>
  <div class="window-row"><span>${t("Sleep hours", "睡眠时段")}</span><div>${input(t("From", "开始"), "sleepStart", p.sleepStart, "time", 'step="900"')}${input(t("To", "结束"), "sleepEnd", p.sleepEnd, "time", 'step="900"')}</div></div>
  <fieldset class="days"><legend>${t("Working days", "工作日")}</legend>${weekdays()
    .map(
      (d, j) =>
        `<label><input type="checkbox" data-day="${j}" ${p.days.includes(j) ? "checked" : ""}><span>${d}</span></label>`,
    )
    .join("")}</fieldset>
  <div class="field-pair">${input(t("Already carried · pt", "历史负担 · 分"), "carriedPain", p.carriedPain, "number", 'min="0" max="10000" step="0.5"')}${input(t("Series budget · pt", "整个系列预算 · 分"), "budget", p.budget, "number", 'min="0" max="10000" step="0.5"')}</div></article>`,
    )
    .join("")}</div>
  <div class="draft-tools"><button data-action="save-json">${t("Save setup .json", "保存设置 .json")}</button><button data-action="import">${t("Load setup", "导入设置")}</button><span>${t("Valid changes save on this device.", "有效修改会保存在本机。")}</span></div>`;
}
function errorMessage(e: unknown): string {
  const code = e instanceof InputError ? e.code : "";
  const map: Record<string, string> = {
    text: t(
      "Give the meeting and every person a name. Keep names within 80 characters and the meeting title within 120.",
      "请填写会议和每个人的姓名。姓名最多 80 字，会议名称最多 120 字。",
    ),
    zone: t(
      "Choose a valid city time zone, such as Asia/Shanghai.",
      "请选择有效城市时区，例如 Asia/Shanghai。",
    ),
    date: t(
      "Choose a real date between 2000 and 2099.",
      "请选择 2000–2099 年之间的有效日期。",
    ),
    clock: t(
      "Use valid times in 15-minute steps, such as 09:00 or 09:15.",
      "时间请以 15 分钟为单位，例如 09:00 或 09:15。",
    ),
    overlap: t(
      "Comfortable hours and sleep must not overlap. Check the person’s time windows.",
      "舒服时段和睡眠时段不能重叠，请检查时间。",
    ),
    window: t(
      "A time window’s start and end must be different. Overnight windows are supported.",
      "时段的开始和结束不能相同，可以跨午夜。",
    ),
    number: t(
      "Use 15–180 minutes in 15-minute steps, 1–8 meetings, and finite budgets/history between 0 and 10,000. Keep all dates before 2100.",
      "时长须为 15–180 分钟且以 15 分钟递增，会议为 1–8 次，历史和预算为 0–10,000。所有日期须在 2100 年前。",
    ),
    days: t(
      "Select at least one working day for every person.",
      "每个人至少选择一个工作日。",
    ),
    people: t("Include 2–12 people.", "请设置 2–12 位参会人。"),
    size: t(
      "The setup is too large. Use a JSON file under 250 KB.",
      "设置文件过大，请使用小于 250 KB 的 JSON 文件。",
    ),
  };
  return (
    map[code] ??
    t(
      "This setup is not a supported version 1 file. Check the file and try again.",
      "文件格式无效或不是版本 1，请检查后重试。",
    )
  );
}
function save(c: Config) {
  if (rejected !== null) return;
  try {
    localStorage.setItem(KEY, serialize(c));
    storageMessage = "";
  } catch {
    storageMessage = "storage";
  }
}
function queue() {
  clearTimeout(timer);
  allCandidates = false;
  revision++;
  results = null;
  activeConfig = null;
  error = "";
  pending = false;
  try {
    activeConfig = validateConfig(config);
    save(activeConfig);
    pending = true;
    const id = revision,
      c = activeConfig;
    timer = setTimeout(
      () => worker.postMessage({ revision: id, config: c }),
      100,
    );
  } catch (e) {
    error = errorMessage(e);
  }
  renderResults();
  setStatus();
}
function setStatus() {
  document.querySelector("#status")!.textContent = error
    ? t("Check inputs", "检查输入")
    : pending
      ? t("Finding balance…", "正在计算…")
      : t("Up to date", "已更新");
}
function renderRecovery() {
  document.querySelector("#recovery")!.innerHTML =
    rejected === null
      ? ""
      : `<div class="recovery" data-testid="recovery"><div><strong>${t("Your saved draft needs attention.", "保存的草稿需要检查。")}</strong><p>${t("It could not be opened. The original is preserved; this page is showing an example until you replace it.", "草稿无法读取，原始内容已保留。当前显示示例，只有主动替换后才会覆盖。")}</p></div><button data-action="raw">${t("Download original", "下载原始内容")}</button><button data-action="replace">${t("Replace saved draft", "替换已存草稿")}</button></div>`;
}
function ribbon(slot: Slot, index: number) {
  const p = config.people[index],
    pain = slot.people[index],
    meeting = new Set<number>();
  for (let t0 = slot.start; t0 < slot.end; t0 += STEP)
    meeting.add(localParts(t0, p.zone).minute);
  return `<div class="day-view"><div class="day-title"><strong>${esc(p.name)}</strong><span>${esc(zoneName(p.zone))} <small>${esc(offsetLabel(pain.start.offset))}</small></span><b>${points(pain.points)} ${t("pt", "分")}</b></div><div class="local-time">${pain.start.time}<span> → </span>${pain.end.time}<small>${pain.start.date}${pain.end.date !== pain.start.date ? " → " + pain.end.date : ""}${pain.start.offset !== pain.end.offset ? " · " + offsetLabel(pain.end.offset) : ""}</small></div><div class="day-ribbon" data-testid="day-ribbon" role="img" aria-label="${esc(`${p.name}: ${pain.start.date} ${pain.start.time} to ${pain.end.date} ${pain.end.time}; ${pain.points} ${t("points", "分")}`)}">${Array.from({ length: 96 }, (_, i) => `<i class="${inside(i * 15, p.sleepStart, p.sleepEnd) ? "sleep" : inside(i * 15, p.workStart, p.workEnd) ? "comfortable" : "outside"} ${meeting.has(i * 15) ? "meeting" : ""}"></i>`).join("")}</div><div class="ribbon-hours"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div><p class="breakdown">${t("Sleep", "睡眠")} ${pain.sleepMinutes}${t("m", "分钟")} · ${t("Outside", "不舒服")} ${pain.outsideMinutes}${t("m", "分钟")} · ${t("Day off", "非工作日")} ${pain.offDayMinutes}${t("m", "分钟")}</p></div>`;
}
function renderResults() {
  const container = document.querySelector("#results")!;
  if (error) {
    container.innerHTML = `<div class="state-box invalid" role="alert"><span>!</span><h3>${t("A small fix first.", "先修正一个小地方。")}</h3><p>${esc(error)}</p><small>${t("Downloads pause until the setup is valid. Your last valid draft is preserved.", "设置有效前，下载暂停。最后一份有效草稿仍已保存。")}</small></div>${exportButtons(true)}`;
    return;
  }
  if (!results || !activeConfig) {
    container.innerHTML = `<div class="state-box" aria-busy="true"><span class="loading-clock" aria-hidden="true"></span><h3>${t("Looking at everyone’s day…", "正在查看每个人的一天…")}</h3><p>${t("Finding the small compromises that can be shared.", "寻找可以分摊的小小不便。")}</p></div>${exportButtons(true)}`;
    return;
  }
  const r = results,
    p = (view === "fixed" ? r.fixed : r.rotation) ?? r.rotation;
  const slot =
    r.candidates.find((s) => s.start === selected) ?? r.candidates[0];
  container.innerHTML = `${storageMessage ? `<p class="notice">${t("Browser storage is unavailable. Download your setup to keep it.", "浏览器存储不可用，请下载设置以保留。")}</p>` : ""}
  <div class="card single"><div class="card-heading"><div><span class="eyebrow">${t("ONE MEETING, UP CLOSE", "先看一场会议")}</span><h3>${slot ? `${slot.reference.time} <small>${esc(zoneName(config.referenceZone))}</small>` : t("No shared window", "没有共同窗口")}</h3></div><span class="date-pill">${esc(config.date)}</span></div>
  ${
    slot
      ? `<div class="legend"><span><i class="comfortable"></i>${t("Comfortable", "舒服")}</span><span><i class="outside"></i>${t("Outside", "不舒服")}</span><span><i class="sleep"></i>${t("Sleep", "睡眠")}</span><span><i class="meeting"></i>${t("Meeting", "会议")}</span></div>${config.people.map((_, i) => ribbon(slot, i)).join("")}
  <details class="candidates" open><summary>${t("Try another time", "试试其他时间")} <small>${r.candidates.length} ${t("valid options", "个有效选项")}</small></summary><div class="candidate-buttons">${r.candidates
    .slice(0, allCandidates ? undefined : 8)
    .map(
      (s) =>
        `<button data-slot="${s.start}" class="${s.start === slot.start ? "chosen" : ""}" aria-pressed="${s.start === slot.start}"><strong>${s.reference.time}</strong><small>${points(s.totalPain)} ${t("total pt", "总分")} · ${esc(offsetLabel(s.reference.offset))}</small></button>`,
    )
    .join(
      "",
    )}</div>${r.candidates.length > 8 ? `<button class="show-all" data-action="all-times">${allCandidates ? t("Show fewer times", "收起时间") : t("Show all " + r.candidates.length + " times", "显示全部 " + r.candidates.length + " 个时间")}</button>` : ""}<p>${t("This preview explores one meeting. The series below stays optimized.", "此处只预览单场会议，下方系列安排仍保持优化。")}</p></details>`
      : `<p>${t("No time satisfies everyone’s protected sleep and working days. Adjust the date, windows, or protection choices.", "没有时间同时满足所有人的保护条件。请调整日期、时段或保护选项。")}</p>`
  }</div>
  <div class="series-heading"><div><span class="eyebrow">${t("THE BIGGER PICTURE", "再看整个系列")}</span><h3>${t("Take turns, keep track.", "轮着来，记清楚。")}</h3></div><div class="view-tabs" role="group" aria-label="${t("Series comparison", "系列比较")}"><button data-view="rotation" class="${view === "rotation" ? "active" : ""}" aria-pressed="${view === "rotation"}">${t("Rotate", "轮换")}</button><button data-view="fixed" class="${view === "fixed" ? "active" : ""}" aria-pressed="${view === "fixed"}" ${r.fixed ? "" : "disabled"}>${t("Fixed", "固定")}</button></div></div>
  ${
    p
      ? `<div class="comparison"><div><span>${t("Best fixed time", "最佳固定时间")}</span><strong>${r.fixed ? percent(r.fixed.worstRatio) : "—"}</strong><small>${t("highest budget use", "最高预算使用率")}</small></div><div class="recommended"><span>${t("Shared rotation", "分摊轮换")}</span><strong data-testid="worst-rotation">${percent(r.rotation!.worstRatio)}</strong><small>${t("highest budget use", "最高预算使用率")}</small></div></div>
  <div class="card ledger" data-testid="ledger"><div class="card-heading"><h3>${t("The pain ledger", "不便账本")}</h3><span class="date-pill">${p.slots.length} ${t("weeks", "周")} · ${points(p.totalPain)} ${t("new pt", "新增分")}</span></div>${config.people
    .map((person, i) => {
      const total = person.carriedPain + p.newPain[i],
        ratio = total / Math.max(person.budget, 1);
      return `<div class="ledger-row"><div><strong>${esc(person.name)}</strong><span>${points(total)} / ${points(person.budget)} ${t("pt", "分")}</span></div><div class="budget-bar" role="img" aria-label="${esc(person.name + ": " + total + " / " + person.budget)}"><i style="width:${Math.min(100, (person.carriedPain / Math.max(person.budget, 1)) * 100)}%" class="carried"></i><i style="width:${Math.min(Math.max(0, 100 - (person.carriedPain / Math.max(person.budget, 1)) * 100), (p.newPain[i] / Math.max(person.budget, 1)) * 100)}%"></i></div><small>${points(person.carriedPain)} ${t("carried", "历史")} + ${points(p.newPain[i])} ${t("new", "新增")} <b class="${total > person.budget ? "over" : ""}">${total > person.budget ? t("Over budget", "超预算") : percent(ratio)}</b></small></div>`;
    })
    .join("")}
  <p class="ledger-note">${t("The shaded bar is carried burden; teal is new burden. Budgets cover the whole series.", "灰色为历史负担，青绿色为新增负担。预算覆盖整个会议系列。")}</p></div>
  <div class="schedule-wrap"><table data-testid="schedule"><caption>${view === "fixed" ? t("Fixed schedule", "固定日程") : t("Rotating schedule", "轮换日程")} <small>${esc(config.referenceZone)}</small></caption><thead><tr><th scope="col">${t("Week / Reference", "周 / 参考时间")}</th>${config.people.map((x) => `<th scope="col">${esc(x.name)}</th>`).join("")}</tr></thead><tbody>${p.slots.map((s, i) => `<tr><th scope="row"><span class="week-number">${String(i + 1).padStart(2, "0")}</span><span>${s.reference.date}<b>${s.reference.time}</b><small>${offsetLabel(s.reference.offset)}</small></span></th>${s.people.map((x) => `<td>${x.start.time} → ${x.end.time}<small>${x.start.date}${x.start.date !== x.end.date ? " → " + x.end.date : ""}</small><small>${offsetLabel(x.start.offset)}${x.start.offset !== x.end.offset ? " → " + offsetLabel(x.end.offset) : ""} · ${points(x.points)} ${t("pt", "分")}</small></td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="series-note">${t("Rotation compares the whole series. The fixed plan keeps one reference-zone wall-clock time; UTC times can change with daylight saving.", "轮换比较整个系列的负担。固定方案保持参考时区钟表时间不变；夏令时变化时，UTC 时间可能改变。")}</p>`
      : `<div class="state-box unavailable"><h3>${t("No complete series fits these rules.", "当前规则无法生成完整系列。")}</h3><p>${t("No eligible slots on", "以下参考日期没有有效时段")} ${r.unavailableDates.join(", ")}.</p><small>${t("Protection rules stay in place. Adjust the setup before exporting a series.", "保护条件保持生效。调整设置后才能导出系列。")}</small></div>`
  }
  ${exportButtons(!p)}<p class="export-note">${t("Exports use the selected series view. Calendar files use explicit UTC events. Reports are in English.", "导出当前选中的系列。日历使用逐场 UTC 事件；报告为英文。")}</p>`;
}
function exportButtons(disabled: boolean) {
  return `<div class="exports"><span>${t("TAKE IT WITH YOU", "把日程带走")}</span><button data-export="calendar" ${disabled ? "disabled" : ""}>${t("Calendar .ics", "日历 .ics")}</button><button data-export="csv" ${disabled ? "disabled" : ""}>${t("Ledger .csv", "账本 .csv")}</button><button data-export="markdown" ${disabled ? "disabled" : ""}>Markdown</button><button data-action="print" ${disabled ? "disabled" : ""}>${t("Print", "打印")}</button></div>`;
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
root.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement,
    field = el.dataset.field,
    id = el.closest<HTMLElement>("[data-person]")?.dataset.person;
  if (!field && el.dataset.day === undefined) return;
  if (id) {
    const p = config.people.find((x) => x.id === id)!;
    if (el.dataset.day !== undefined) {
      const day = Number(el.dataset.day);
      p.days = el.checked
        ? [...new Set([...p.days, day])]
        : p.days.filter((x) => x !== day);
    } else
      (p as unknown as Record<string, unknown>)[field!] =
        el.type === "number" ? el.valueAsNumber : el.value;
  } else
    (config as unknown as Record<string, unknown>)[field!] =
      el.type === "checkbox"
        ? el.checked
        : el.type === "number"
          ? el.valueAsNumber
          : el.value;
  queue();
});
root.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLButtonElement>("button");
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (el.dataset.example) {
    config = example(el.dataset.example);
    view = "rotation";
    renderEditor();
    queue();
  } else if (action === "all-times") {
    allCandidates = !allCandidates;
    renderResults();
  } else if (el.dataset.slot) {
    selected = Number(el.dataset.slot);
    renderResults();
  } else if (el.dataset.view) {
    view = el.dataset.view as typeof view;
    renderResults();
  } else if (action === "language") {
    language = language === "en" ? "zh" : "en";
    try {
      localStorage.setItem(KEY + ":language", language);
    } catch {
      /* Session language still works. */
    }
    shell();
    queue();
  } else if (action === "add") {
    config.people.push({
      ...example().people[0],
      id: crypto.randomUUID(),
      name: t("New person", "新成员"),
      zone: config.referenceZone,
      days: [1, 2, 3, 4, 5],
    });
    renderEditor();
    queue();
  } else if (action === "remove") {
    const id = el.closest<HTMLElement>("[data-person]")!.dataset.person;
    config.people = config.people.filter((p) => p.id !== id);
    renderEditor();
    queue();
  } else if (action === "save-json") {
    try {
      download(
        "meeting-pain-budget.json",
        serialize(config),
        "application/json",
      );
    } catch (e2) {
      error = errorMessage(e2);
      renderResults();
    }
  } else if (action === "import") {
    document.querySelector<HTMLInputElement>("#import-file")!.click();
  } else if (action === "raw" && rejected !== null) {
    download("meeting-pain-budget-original.txt", rejected, "text/plain");
  } else if (action === "replace") {
    try {
      const valid = validateConfig(config);
      localStorage.setItem(KEY, serialize(valid));
      rejected = null;
      storageMessage = "";
      renderRecovery();
    } catch (e2) {
      error = errorMessage(e2);
      renderResults();
    }
  } else if (action === "print") {
    window.print();
  } else if (
    el.dataset.export &&
    results &&
    activeConfig &&
    !pending &&
    !error
  ) {
    const p =
      (view === "fixed" ? results.fixed : results.rotation) ?? results.rotation;
    if (!p) return;
    const format = el.dataset.export;
    download(
      `meeting-pain-budget.${format === "calendar" ? "ics" : format === "markdown" ? "md" : "csv"}`,
      format === "calendar"
        ? calendar(activeConfig, p)
        : format === "markdown"
          ? markdown(activeConfig, p)
          : csv(activeConfig, p),
      format === "calendar"
        ? "text/calendar"
        : format === "markdown"
          ? "text/markdown"
          : "text/csv",
    );
  }
});
root.addEventListener("change", async (e) => {
  if ((e.target as HTMLElement).id !== "import-file") return;
  const el = e.target as HTMLInputElement,
    file = el.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_BYTES) throw new InputError("size");
    config = parse(await file.text());
    view = "rotation";
    renderEditor();
    queue();
  } catch (e2) {
    revision++;
    clearTimeout(timer);
    pending = false;
    results = null;
    activeConfig = null;
    error = errorMessage(e2);
    renderResults();
    setStatus();
  } finally {
    el.value = "";
  }
});
shell();
queue();
