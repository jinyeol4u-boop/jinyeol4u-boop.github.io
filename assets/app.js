import { evaluate, validateAnswers } from "/assets/rules.js";

const main = document.querySelector("main");
const homeTemplate = main.innerHTML;
const defaultTitle = document.title;
const description = document.querySelector('meta[name="description"]');
const canonical = document.querySelector('link[rel="canonical"]');
const defaultDescription = description?.content || "";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const labels = {
  likely: "우선 확인해 보세요",
  review: "조건을 더 확인해 주세요",
  info: "함께 알아두면 좋아요"
};

const categoryLabels = {
  all: "전체",
  pension: "연금",
  health: "건강·의료",
  housing: "주거",
  job: "일자리·교육",
  living: "생활비·환급"
};

const questions = [
  ["age", "만 나이가 어떻게 되시나요?", "40세부터 79세까지 이용할 수 있어요."],
  ["region", "어느 지역에 살고 계신가요?", "주민등록상 거주 지역을 선택해 주세요.", "서울 부산 대구 인천 광주 대전 울산 세종 경기 강원 충북 충남 전북 전남 경북 경남 제주".split(" ").map((x) => [x, x])],
  ["household", "누구와 함께 살고 계신가요?", "가구 유형을 선택해 주세요.", [["single", "혼자 살아요"], ["couple", "배우자와 살아요"], ["family", "그 외 가족과 살아요"], ["unknown", "잘 모르겠어요"]]],
  ["work", "현재 어떤 일을 하고 계신가요?", "가장 가까운 상태 하나를 선택해 주세요.", [["employee", "직장에 다니고 있어요"], ["self", "자영업·사업을 하고 있어요"], ["unemployed", "일자리를 찾고 있어요"], ["retired", "은퇴했거나 현재 일을 쉬어요"], ["unknown", "잘 모르겠어요"]]],
  ["income", "가구의 월소득은 어느 정도인가요?", "세전 소득의 대략적인 합계입니다. 법정 소득인정액과는 달라요.", [["low", "200만원 미만"], ["middle", "200만원 이상 ~ 400만원 미만"], ["high", "400만원 이상"], ["unknown", "잘 모르겠어요"]]],
  ["home", "어떤 집에 살고 계신가요?", "현재 거주 형태를 선택해 주세요.", [["rent", "전세·월세"], ["own", "자가"], ["other", "가족 집 등 그 외"], ["unknown", "잘 모르겠어요"]]],
  ["vulnerable", "기초생활수급자 또는 차상위계층인가요?", "행정기관에서 확인받은 경우에 선택해 주세요.", [["yes", "네"], ["no", "아니요"], ["unknown", "잘 모르겠어요"]]],
  ["interest", "어떤 혜택이 가장 궁금하세요?", "관심 분야를 먼저 보여드려요. 다른 혜택도 함께 확인할 수 있어요.", [["all", "모든 혜택"], ["pension", "연금"], ["health", "건강·의료"], ["housing", "주거"], ["job", "일자리·교육"], ["living", "생활비·환급"]]]
];

let answers = {};
let step = 0;
let results = null;
let navigationVersion = 0;

let benefitCache;

async function getBenefits() {
  if (benefitCache) return benefitCache;
  const response = await fetch("/data/benefits.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("공식 혜택 정보를 불러오지 못했습니다.");
  benefitCache = await response.json();
  return benefitCache;
}

async function api(path, body) {
  const benefits = await getBenefits();
  if (path === "/api/benefits") return benefits;
  const detail = path.match(/^\/api\/benefits\/(\d+)$/);
  if (detail) {
    const benefit = benefits.find((item) => String(item.id) === detail[1]);
    if (!benefit) throw new Error("요청한 혜택 정보를 찾을 수 없습니다.");
    return benefit;
  }
  if (path === "/api/diagnose") {
    const answers = validateAnswers(body);
    return benefits.map((benefit) => evaluate(benefit, answers)).sort((a, b) => Number(b.preferred) - Number(a.preferred));
  }
  throw new Error("지원하지 않는 요청입니다.");
}

function setMeta(title, summary, path = location.pathname) {
  document.title = title;
  if (description) description.content = summary;
  if (canonical) canonical.href = new URL(path, location.origin).href;
}

function setCurrentNav() {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const target = new URL(link.href, location.origin).pathname;
    const active = target !== "/" && location.pathname.startsWith(target);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function show(html, { focus = true } = {}) {
  main.innerHTML = html;
  if (focus) {
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function navigate(href, replace = false) {
  const url = new URL(href, location.origin);
  history[replace ? "replaceState" : "pushState"]({}, "", url.pathname + url.search);
  route();
}

function notice() {
  return `<div class="app-notice" role="note"><strong>공식 확인 안내</strong><span>제도 정보는 공식 기관 자료를 기준으로 정리했습니다. 실제 자격·금액·기간은 신청 시점의 기관 심사와 최신 공고를 다시 확인해 주세요.</span></div>`;
}

function benefitCard(benefit) {
  const status = benefit.status || "info";
  return `<article class="benefit-card">
    <span class="badge ${esc(status)}">${esc(benefit.status ? labels[status] : categoryLabels[benefit.category] || "제도 안내")}</span>
    <h3>${esc(benefit.title)}</h3>
    <p>${esc(benefit.summary)}</p>
    ${benefit.reasons?.length ? `<p class="card-reason">${esc(benefit.reasons[0])}</p>` : ""}
    <a href="/benefits/${benefit.id}/" data-route aria-label="${esc(benefit.title)} 자세히 보기">자세히 보기 <span aria-hidden="true">→</span></a>
  </article>`;
}

function renderSources(rawSources) {
  let sources = [];
  try { sources = typeof rawSources === "string" ? JSON.parse(rawSources) : rawSources; } catch { sources = []; }
  if (!Array.isArray(sources) || !sources.length) return "";
  const links = sources.filter((source) => source && typeof source.title === "string" && typeof source.url === "string")
    .map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} <span aria-hidden="true">↗</span></a></li>`).join("");
  return links ? `<section class="source-list" aria-labelledby="sources-title"><h2 id="sources-title">확인한 공식 출처</h2><ul>${links}</ul></section>` : "";
}

function showHome() {
  show(homeTemplate);
  setMeta(defaultTitle, defaultDescription, "/");
}

function renderQuiz() {
  const [key, title, help, options] = questions[step];
  const input = key === "age"
    ? `<label class="field">만 나이<input aria-describedby="question-help" type="number" name="answer" min="40" max="79" step="1" required inputmode="numeric" autocomplete="off" value="${esc(answers[key] || "")}"></label>`
    : key === "region"
      ? `<label class="field">거주 지역<select name="answer" required><option value="">지역을 선택해 주세요</option>${options.map(([value, label]) => `<option value="${value}" ${answers[key] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`
      : `<div class="option-list">${options.map(([value, label]) => `<label class="option"><input type="radio" name="answer" value="${value}" required ${answers[key] === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</div>`;

  show(`<div class="app-shell narrow">
    <a class="back-link" href="/" data-route>← 홈으로</a>
    <div class="page-intro"><p class="kicker">무료 혜택 진단 · ${step + 1} / 8</p></div>
    <progress class="quiz-progress" value="${step + 1}" max="8" aria-label="8개 질문 중 ${step + 1}번째"></progress>
    <form id="quiz-form">
      <fieldset aria-describedby="question-help">
        <legend>${title}</legend>
        <p id="question-help" class="help-text">${help}</p>
        ${input}
      </fieldset>
      <p id="form-error" class="form-error" role="alert"></p>
      <div class="form-actions">
        ${step ? '<button class="secondary" type="button" id="previous-question">이전 질문</button>' : ""}
        <button type="submit">${step === 7 ? "내 혜택 확인하기" : "다음 질문 →"}</button>
      </div>
      <p class="privacy-note">진단은 무료입니다. 입력한 답변은 결과 계산에만 사용하며 저장하지 않습니다.</p>
    </form>
  </div>`);

  setMeta(`${step + 1}번째 질문 | 혜택마실 무료 진단`, "8가지 쉬운 질문으로 확인할 복지·지원제도를 찾아보세요.", "/diagnosis");

  document.querySelector("#previous-question")?.addEventListener("click", () => {
    const value = new FormData(document.querySelector("#quiz-form")).get("answer");
    if (value) answers[key] = key === "age" ? Number(value) : value;
    step -= 1;
    renderQuiz();
  });

  document.querySelector("#quiz-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("answer");
    answers[key] = key === "age" ? Number(value) : value;
    if (step < questions.length - 1) {
      step += 1;
      renderQuiz();
      return;
    }

    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "혜택을 확인하고 있어요…";
    try {
      results = await api("/api/diagnose", answers);
      navigate("/results");
    } catch (error) {
      document.querySelector("#form-error").textContent = error.message;
      button.disabled = false;
      button.textContent = "다시 확인하기";
    }
  });
}

function renderResults() {
  if (!results) {
    show(`<div class="app-shell narrow"><div class="empty-state"><h1>진단을 먼저 시작해 주세요</h1><p>답변은 저장하지 않으므로 새로고침하면 사라집니다.</p><div class="form-actions"><a class="button button-primary" href="/diagnosis/" data-route>무료 진단 시작</a></div></div></div>`);
    setMeta("진단 결과 | 혜택마실", "무료 혜택 진단을 먼저 시작해 주세요.", "/results");
    return;
  }

  const resultGroups = Object.entries(labels).map(([key, label]) => {
    const group = results.filter((benefit) => benefit.status === key);
    return `<section class="result-group"><h2>${label}</h2><div class="benefit-grid">${group.map(benefitCard).join("") || '<div class="empty-state"><p>이 분류에 해당하는 항목이 없습니다.</p></div>'}</div></section>`;
  }).join("");

  show(`<div class="app-shell">
    <a class="back-link" href="/" data-route>← 홈으로</a>
    <div class="page-intro"><p class="kicker">나의 진단 결과</p><h1>확인해 볼 혜택 ${results.length}개</h1><p>입력한 기본 조건을 비교한 안내이며 실제 수급 자격을 확정한 결과는 아닙니다.</p></div>
    ${results.some((benefit) => benefit.is_sample) ? notice() : ""}
    <div class="result-counts">${Object.entries(labels).map(([key, label]) => `<div class="result-count"><span>${label}</span><strong>${results.filter((benefit) => benefit.status === key).length}개</strong></div>`).join("")}</div>
    ${resultGroups}
    <div class="form-actions"><button id="restart-diagnosis">처음부터 다시 진단</button><a class="button button-secondary" href="/benefits/" data-route>모든 혜택 보기</a></div>
  </div>`);

  setMeta(`확인해 볼 혜택 ${results.length}개 | 혜택마실`, "입력한 생활 조건에 따라 우선 확인할 복지·지원제도를 정리했습니다.", "/results");
  document.querySelector("#restart-diagnosis").addEventListener("click", () => {
    answers = {};
    step = 0;
    results = null;
    navigate("/diagnosis");
  });
}

async function renderBenefits(version) {
  show('<div class="app-shell"><div class="loading" role="status">혜택 목록을 불러오고 있어요…</div></div>');
  const rows = await api("/api/benefits");
  if (version !== navigationVersion) return;

  const category = new URLSearchParams(location.search).get("category") || "all";
  const safeCategory = categoryLabels[category] ? category : "all";
  const filtered = safeCategory === "all" ? rows : rows.filter((item) => item.category === safeCategory);
  const filters = Object.entries(categoryLabels).map(([key, label]) => `<a class="${key === safeCategory ? "active" : ""}" href="/benefits/${key === "all" ? "" : `?category=${key}`}" data-route>${label}</a>`).join("");

  show(`<div class="app-shell">
    <a class="back-link" href="/" data-route>← 홈으로</a>
    <div class="page-intro"><p class="kicker">지원제도 안내</p><h1>혜택 둘러보기</h1><p>관심 분야를 선택해 제도를 살펴보고, 실제 신청 전에는 공식 기관의 최신 내용을 확인해 주세요.</p></div>
    ${notice()}
    <nav class="filter-row" aria-label="혜택 분야">${filters}</nav>
    <div class="benefit-grid">${filtered.map(benefitCard).join("") || '<div class="empty-state"><p>등록된 혜택이 없습니다.</p></div>'}</div>
  </div>`);

  const label = categoryLabels[safeCategory];
  setMeta(`${label === "전체" ? "복지·지원제도" : label + " 혜택"} 둘러보기 | 혜택마실`, `${label} 분야의 복지·지원제도를 한눈에 확인하세요.`, location.pathname + location.search);
}

async function renderBenefit(id, version) {
  show('<div class="app-shell narrow"><div class="loading" role="status">상세 내용을 불러오고 있어요…</div></div>');
  const benefit = await api(`/api/benefits/${id}`);
  if (version !== navigationVersion) return;
  const matched = results?.find((item) => item.id === benefit.id);

  show(`<div class="app-shell narrow">
    <a class="back-link" href="${results ? "/results/" : "/benefits/"}" data-route>← ${results ? "진단 결과" : "혜택 목록"}으로</a>
    <article class="detail-card">
      <span class="badge ${esc(matched?.status || "info")}">${esc(matched ? labels[matched.status] : categoryLabels[benefit.category] || "제도 안내")}</span>
      <h1>${esc(benefit.title)}</h1>
      <p class="lead">${esc(benefit.summary)}</p>
      ${notice()}
      ${matched ? `<h2>왜 이 결과가 나왔나요?</h2><ul>${matched.reasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>` : ""}
      <h2>어떤 혜택인가요?</h2><p class="detail-copy">${esc(benefit.description)}</p>
      <h2>지원 금액 안내</h2><p>${esc(benefit.amount_note)}</p>
      <div class="meta-list"><span>분야: ${esc(categoryLabels[benefit.category] || benefit.category)}</span><span>최종 확인일: ${esc(benefit.last_verified_at || "미확인")}</span></div>
      ${renderSources(benefit.sources_json)}
      <div class="form-actions"><a class="button button-primary" href="${esc(benefit.official_url)}" target="_blank" rel="noopener noreferrer">공식 기관에서 확인 ↗</a></div>
      <p class="privacy-note">새 창으로 열립니다. 기관 홈페이지에서 제도명, 신청 기간, 필요 서류를 다시 확인해 주세요.</p>
    </article>
  </div>`);

  setMeta(`${benefit.title} 안내 | 혜택마실`, benefit.summary, `/benefits/${id}`);
}

function renderNotFound() {
  show(`<div class="app-shell narrow"><div class="empty-state"><h1>페이지를 찾을 수 없어요</h1><p>주소를 다시 확인하거나 홈으로 돌아가 주세요.</p><div class="form-actions"><a class="button button-primary" href="/" data-route>홈으로</a></div></div></div>`);
  setMeta("페이지를 찾을 수 없음 | 혜택마실", "요청한 페이지를 찾을 수 없습니다.", location.pathname);
}

async function route() {
  const version = ++navigationVersion;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  setCurrentNav();
  try {
    if (path === "/") return showHome();
    if (path === "/diagnosis") return renderQuiz();
    if (path === "/results") return renderResults();
    if (path === "/benefits") return await renderBenefits(version);
    const detail = path.match(/^\/benefits\/(\d+)$/);
    if (detail) return await renderBenefit(detail[1], version);
    renderNotFound();
  } catch (error) {
    if (version !== navigationVersion) return;
    show(`<div class="app-shell narrow"><div class="error-state"><h1>불러오지 못했어요</h1><p role="alert">${esc(error.message)}</p><div class="form-actions"><a class="button button-primary" href="/" data-route>홈으로</a></div></div></div>`);
  }
  setCurrentNav();
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-route]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, location.origin);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  navigate(url.pathname + url.search);
});

window.addEventListener("popstate", route);
route();
