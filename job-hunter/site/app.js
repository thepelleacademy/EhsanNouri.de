/* Job Hunter UI. Job data comes from third-party ads → NEVER use innerHTML with it (XSS). DOM APIs only. */
(function () {
  "use strict";

  // ---- named settings (edit freely) ----
  const DATA_URL = "data/jobs.json";
  const HOT_SCORE = 75;          // red glow + top badge
  const NEW_DAYS = 3;            // "New" filter window
  const STORAGE_KEY = "jobhunter.v1";
  const STORAGE_LANG = "jobhunter.lang";

  const I18N = {
    en: {
      title: "Job Hunter", search: "Search title, company, city…", minScore: "Min score",
      sortScore: "Best match", sortNew: "Newest", fNew: "New (3 days)", fEnglish: "English",
      fSmall: "Small / startup", fRemote: "Remote", fSaved: "Saved", fHidden: "Show hidden/applied",
      empty: "No jobs match these filters.", foot: "Scores are estimates. Company size/age is guessed by AI from the ad text — always verify.",
      lastRun: "Last run", all: "All sources", open: "Open ad", save: "Save", saved: "Saved", applied: "Applied", hide: "Hide",
      jobs: "jobs shown", total: "total in DB", fresh: "new in 3 days", strong: "strong (≥ 75)", at: "at",
      english: "English", startup: "Startup", remote: "Remote", bavaria: "Bavaria", german_required: "German required",
      german_moderate: "German needed", big_company: "Large company", staffing: "Staffing", large: "Large",
      micro: "micro company", small: "small company", medium: "mid-size", young: "young company", unknown: "",
      established: "", old: "",
    },
    fa: {
      title: "شکارچی شغل", search: "جست‌وجو در عنوان، شرکت، شهر…", minScore: "حداقل امتیاز",
      sortScore: "بهترین تطابق", sortNew: "جدیدترین", fNew: "جدید (۳ روز)", fEnglish: "انگلیسی",
      fSmall: "کوچک / استارتاپ", fRemote: "ریموت", fSaved: "ذخیره‌شده", fHidden: "نمایش مخفی/اقدام‌شده",
      empty: "هیچ آگهی‌ای با این فیلترها پیدا نشد.", foot: "امتیازها تخمینی‌اند. اندازه و سن شرکت را هوش مصنوعی از متن آگهی حدس می‌زند؛ حتماً خودت چک کن.",
      lastRun: "آخرین اجرا", all: "همه‌ی منابع", open: "باز کردن آگهی", save: "ذخیره", saved: "ذخیره شد", applied: "اقدام کردم", hide: "مخفی",
      jobs: "آگهی نمایش‌داده‌شده", total: "کل در پایگاه", fresh: "جدید در ۳ روز", strong: "قوی (≥ ۷۵)", at: "ساعت",
      english: "انگلیسی", startup: "استارتاپ", remote: "ریموت", bavaria: "بایرن", german_required: "آلمانی لازم است",
      german_moderate: "کمی آلمانی", big_company: "شرکت بزرگ", staffing: "کاریابی", large: "بزرگ",
      micro: "شرکت خیلی کوچک", small: "شرکت کوچک", medium: "شرکت متوسط", young: "شرکت جوان", unknown: "",
      established: "", old: "",
    },
  };

  const $ = (id) => document.getElementById(id);
  let lang = safeGet(STORAGE_LANG) || ((navigator.language || "").toLowerCase().startsWith("fa") ? "fa" : "en");
  let data = { jobs: [], generated_at: "" };
  let marks = loadMarks();

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function loadMarks() { try { return JSON.parse(safeGet(STORAGE_KEY) || "{}"); } catch (e) { return {}; } }
  function saveMarks() { safeSet(STORAGE_KEY, JSON.stringify(marks)); }
  const t = (k) => {
    const d = I18N[lang];
    if (d && k in d) return d[k];
    return k in I18N.en ? I18N.en[k] : k;
  };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }
  function daysAgo(iso) {
    if (!iso) return 999;
    const d = new Date(iso + "T00:00:00Z");
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }
  const isSmall = (j) => j.flags.includes("startup") || ["micro", "small"].includes(j.company_size) || ["startup", "young"].includes(j.company_age);

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    $("langBtn").textContent = lang === "fa" ? "EN" : "FA";
    document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
    buildSourceOptions();
    render();
  }

  function buildSourceOptions() {
    const sel = $("source"), cur = sel.value;
    sel.textContent = "";
    const all = el("option", "", t("all")); all.value = ""; sel.appendChild(all);
    [...new Set(data.jobs.map((j) => j.source))].sort().forEach((s) => { const o = el("option", "", s); o.value = s; sel.appendChild(o); });
    sel.value = cur;
  }

  function filtered() {
    const q = $("q").value.trim().toLowerCase();
    const min = +$("minScore").value;
    const src = $("source").value;
    return data.jobs.filter((j) => {
      const m = marks[j.id] || {};
      if (j.score < min) return false;
      if (src && j.source !== src) return false;
      if (q && !(j.title + " " + j.company + " " + j.location).toLowerCase().includes(q)) return false;
      if ($("fNew").checked && daysAgo(j.first_seen) > NEW_DAYS) return false;
      if ($("fEnglish").checked && !j.flags.includes("english")) return false;
      if ($("fSmall").checked && !isSmall(j)) return false;
      if ($("fRemote").checked && !j.remote) return false;
      if ($("fSaved").checked && !m.saved) return false;
      if (!$("fHidden").checked && (m.hidden || m.applied)) return false;
      return true;
    }).sort($("sort").value === "new"
      ? (a, b) => (b.first_seen || "").localeCompare(a.first_seen || "") || b.score - a.score
      : (a, b) => b.score - a.score);
  }

  function tagFor(flag) {
    const good = ["english", "startup", "remote", "bavaria"], bad = ["german_required", "big_company", "staffing"];
    const label = t(flag);
    if (!label) return null;
    return el("span", "tag " + (good.includes(flag) ? "good" : bad.includes(flag) ? "bad" : "warn"), label);
  }

  function card(j) {
    const m = marks[j.id] || {};
    const c = el("article", "card" + (j.score >= HOT_SCORE ? " hot" : "") + (m.hidden || m.applied ? " dim" : ""));
    const s = el("div", "score"); s.dataset.v = String(j.score); s.style.setProperty("--p", String(j.score));
    s.style.setProperty("--c", j.score >= HOT_SCORE ? "var(--red)" : j.score >= 60 ? "var(--cyan)" : "var(--blue)");
    c.appendChild(s);

    const body = el("div");
    const h = el("h2"); const a = el("a", "", j.title); a.href = safeUrl(j.url); a.target = "_blank"; a.rel = "noopener noreferrer";
    h.appendChild(a); body.appendChild(h);
    body.appendChild(el("div", "meta", [j.company || "?", j.location || "?", j.source, j.first_seen].filter(Boolean).join(" · ")));

    const tags = el("div", "tags");
    j.flags.forEach((f) => { const tg = tagFor(f); if (tg) tags.appendChild(tg); });
    [j.company_size, j.company_age].forEach((v) => { if (v && t(v)) tags.appendChild(el("span", "tag info", "≈ " + t(v))); });
    (j.red_flags || []).forEach((r) => tags.appendChild(el("span", "tag warn", r)));
    if (tags.childNodes.length) body.appendChild(tags);

    const reason = lang === "fa" ? (j.reason_fa || j.reason) : (j.reason || j.reason_fa);
    if (reason) body.appendChild(el("p", "reason" + (lang === "fa" ? " fa" : ""), reason));

    const act = el("div", "actions");
    const open = el("a", "btn primary", t("open")); open.href = safeUrl(j.url); open.target = "_blank"; open.rel = "noopener noreferrer";
    act.appendChild(open);
    [["saved", m.saved, "save"], ["applied", m.applied, "applied"], ["hidden", m.hidden, "hide"]].forEach(([key, on, label]) => {
      const b = el("button", "btn" + (on ? " on" : ""), key === "saved" && on ? t("saved") : t(label));
      b.type = "button";
      b.addEventListener("click", () => {
        marks[j.id] = Object.assign({}, marks[j.id], { [key]: !on }); saveMarks(); render();
      });
      act.appendChild(b);
    });
    body.appendChild(act);
    c.appendChild(body);
    return c;
  }

  function stat(value, label) { const d = el("div", "stat"); d.appendChild(el("b", "", String(value))); d.appendChild(el("span", "", label)); return d; }

  function render() {
    const rows = filtered();
    const list = $("list"); list.textContent = "";
    rows.forEach((j) => list.appendChild(card(j)));
    $("empty").hidden = rows.length > 0;
    $("count").textContent = rows.length + " " + t("jobs");
    const stats = $("stats"); stats.textContent = "";
    stats.appendChild(stat(data.jobs.length, t("total")));
    stats.appendChild(stat(data.jobs.filter((j) => daysAgo(j.first_seen) <= NEW_DAYS).length, t("fresh")));
    stats.appendChild(stat(data.jobs.filter((j) => j.score >= HOT_SCORE).length, t("strong")));
    stats.appendChild(stat(rows.length, t("jobs")));
    if (data.generated_at) {
      const d = new Date(data.generated_at);
      $("lastRun").textContent = t("lastRun") + ": " + d.toLocaleString(lang === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
    }
  }

  async function init() {
    ["q", "minScore", "source", "sort", "fNew", "fEnglish", "fSmall", "fRemote", "fSaved", "fHidden"].forEach((id) =>
      $(id).addEventListener("input", () => { $("minScoreOut").textContent = $("minScore").value; render(); }));
    $("langBtn").addEventListener("click", () => { lang = lang === "fa" ? "en" : "fa"; safeSet(STORAGE_LANG, lang); applyLang(); });
    try {
      const r = await fetch(DATA_URL, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      data = await r.json();
      data.jobs = (data.jobs || []).map((j) => Object.assign({ flags: [], red_flags: [] }, j));
    } catch (e) {
      $("lastRun").textContent = "data/jobs.json: " + e.message;
    }
    applyLang();
  }
  init();
})();
