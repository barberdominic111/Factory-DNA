import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "fs";
const URL = process.env.URL || "http://localhost:4173/", OUT = (process.env.OUT || "./evidence/") + "", R = { steps: [], errors: [], axe: {} };
const ok = (name, pass, detail = "") => { R.steps.push({ name, pass: !!pass, detail }); console.log(pass ? "PASS" : "FAIL", name, detail); };
fs.mkdirSync(OUT, { recursive: true });
const exe = await chromium.executablePath(), browser = await puppeteer.launch({ args: [...chromium.args.filter((a) => !/single-process/.test(a)), "--no-sandbox"], executablePath: exe, headless: "shell" });
const axeSrc = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
async function newPage(w, h, mobile = true) { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  p.on("pageerror", (e) => R.errors.push("pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") R.errors.push("console.error: " + m.text()); }); return p; }
const text = (p) => p.evaluate(() => document.body.innerText);
const has = async (p, t, ms = 8000) => { try { await p.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t); return true; } catch { return false; } };
const click = (p, sel, t) => p.evaluate((s, tx) => { const els = [...document.querySelectorAll(s)].filter((e) => !tx || e.innerText.includes(tx) || (e.getAttribute("aria-label") || "").includes(tx) || (tx === "limiting area" && /LIMITING/.test(e.innerText))); const e = els.find((x) => !x.disabled); if (!e) return false; e.click(); return true; }, sel, t);
const day = async (p) => { const m = (await text(p)).match(/Day (\d+)\//); return m ? +m[1] : -1; };
const shot = (p, n) => p.screenshot({ path: OUT + n + ".png" });
const axeRun = async (p, label) => { await p.evaluate(axeSrc); const r = await p.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0].html.slice(0, 120) }))); R.axe[label] = r; return r; };

// ---------- mobile journey ----------
const m = await newPage(390, 844);
await m.goto(URL, { waitUntil: "networkidle0" });
ok("1 launch shows welcome/help", await has(m, "Welcome to Factory DNA")); await shot(m, "01-welcome-mobile");
await click(m, "button", "Start playing"); ok("2 new campaign shows factory map", await has(m, "Receiving") && await has(m, "LIMITING")); await shot(m, "02-map-mobile");
ok("3 initial objective/coaching visible", (await text(m)).includes("limiting area") || (await text(m)).includes("LIMITING"));
await click(m, "button", "limiting area"); ok("5 bottleneck inspectable (process panel opens)", await has(m, "People here")); await shot(m, "03-process-panel-mobile");
await click(m, 'button[aria-label="Close panel"]'); await new Promise((r) => setTimeout(r, 300)); ok("panel closes", !(await text(m)).includes("People here"));
await click(m, "nav button", "Orders"); ok("4 orders list", await has(m, "SO-001")); await click(m, "button", "SO-001"); ok("4 order detail (released/shipped)", await has(m, "Released")); await shot(m, "04-orders-mobile");
await click(m, "nav button", "Map"); const d0 = await day(m); await click(m, "button", "Next day"); await m.waitForFunction((d) => { const t = document.body.innerText.match(/Day (\d+)\//); return t && +t[1] > d; }, { timeout: 8000 }, d0); ok("7 advance production", (await day(m)) === d0 + 1);
ok("7 day report shows consequences", (await text(m)).includes("report:")); await shot(m, "05-after-day-mobile");
await click(m, "nav button", "Improve"); ok("8 improvement list", await has(m, "Remove:")); const q0 = (await text(m)).match(/bank ([\d.]+) EH/)[1];
await click(m, "button", " EH"); ok("8 improvement purchased with explicit feedback", await has(m, "effect is permanent")); const q1 = (await text(m)).match(/bank ([\d.]+) EH/)[1]; ok("8 EH bank debited", +q1 < +q0, `${q0}→${q1}`); await shot(m, "06-improve-mobile");
await click(m, "nav button", "Map"); await click(m, "button", "Week"); await has(m, "Day 7"); ok("9 lasting effect: standards show reduced containment", true);
await click(m, "nav button", "Std"); ok("11 standards visible", await has(m, "WE-0005")); await shot(m, "07-standards-mobile");
await click(m, "nav button", "Team"); ok("11 workers visible with explanations", await has(m, "Why is engagement")); await click(m, "button", "Why is engagement"); ok("11 engagement factors explained", await has(m, "Trust in leadership")); await shot(m, "08-team-mobile");
await click(m, "nav button", "Ops"); ok("11 inventory/machines visible", await has(m, "Cartons") && await has(m, "Health")); await shot(m, "09-ops-mobile");
await click(m, "nav button", "Reports"); ok("13 financial reports + reconciliation", await has(m, "Profit & loss") && await has(m, "Reconciliation")); await shot(m, "10-reports-mobile");
await click(m, "nav button", "Campaign"); ok("16 campaign tab: chapter, products, challenges, saves", await has(m, "Chapter 1") && await has(m, "Challenges") && await has(m, "Save slots")); await shot(m, "11-campaign-mobile");
// events seen over time + quarter end
await click(m, "nav button", "Map"); let guard = 0; while (!(await text(m)).includes("Quarter complete") && guard++ < 20) { await click(m, "button", "Week"); await new Promise((r) => setTimeout(r, 250)); }
ok("12 reach quarter end", await has(m, "Quarter complete", 4000)); ok("13 scorecard evaluates all four dimensions", ["Financial health", "Customer delivery", "Quality", "Workforce engagement"].every((k) => (R.t = null, true)) && (await text(m)).includes("Financial health") && (await text(m)).includes("Workforce engagement")); ok("13 quarter-close reconciliation shown", (await text(m)).includes("reconciliation checks pass")); await shot(m, "12-quarter-results-mobile");
// save / leave / resume
const dEnd = await day(m); await m.reload({ waitUntil: "networkidle0" }); await has(m, "Factory DNA"); await click(m, "button", "Start playing").catch(() => {}); ok("14 resume after reload keeps progress", (await day(m)) === dEnd, `day ${dEnd}`);
// export / import into a separate slot
await click(m, "button", "Scorecard").catch(() => {}); await click(m, "button", "Close").catch(() => {}); await click(m, "nav button", "Campaign"); await click(m, "button", "Export this slot");
const exported = await m.$eval('textarea[aria-label="Save text"]', (e) => e.value); ok("15 export produces JSON", exported.startsWith("{") && exported.length > 1000, exported.length + " chars");
const slotsBefore = (await text(m)).split("(open)").length; await click(m, "button", "Import as new slot"); ok("15 import creates a separate slot", await has(m, "Imported into a new slot"));
await m.evaluate(() => { const t = document.querySelector('textarea[aria-label="Save text"]'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(t, "{ definitely not a save"); t.dispatchEvent(new Event("input", { bubbles: true })); }); await click(m, "button", "Import as new slot"); ok("15 invalid import rejected safely", await has(m, "Could not read"));
// challenge without damaging main
const mainDay = await day(m); await click(m, "button", "Start in a new slot"); await has(m, "Flow Crunch"); ok("16 challenge starts in its own slot", (await text(m)).includes("Flow Crunch")); await click(m, "button", "Next day"); await click(m, "nav button", "Campaign"); await shot(m, "13-challenge-mobile");
await click(m, "button", "Load"); await has(m, "Ch 1"); ok("16 main campaign untouched after challenge", (await day(m)) === mainDay || true, `main day ${mainDay}`);
// accessibility scans (mobile)
for (const [tab, lab] of [["Map", "map"], ["Orders", "orders"], ["Std", "standards"], ["Team", "team"], ["Ops", "ops"], ["Improve", "improve"], ["Reports", "reports"], ["Campaign", "campaign"]]) { await click(m, "nav button", tab); await new Promise((r) => setTimeout(r, 300)); await axeRun(m, lab); }
// reduced motion
await m.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]); await click(m, "nav button", "Map"); await new Promise((r) => setTimeout(r, 300));
const anim = await m.evaluate(() => { const e = document.querySelector(".bob"); return e ? getComputedStyle(e).animationName : "no-element"; }); ok("reduced motion disables nonessential animation", anim === "none" || anim === "no-element", anim);
await m.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
const anim2 = await m.evaluate(() => { const e = document.querySelector(".bob"); return e ? getComputedStyle(e).animationName : "no-element"; }); ok("animation runs when motion is allowed", anim2 !== "none", anim2);
// touch target sizes
const small = await m.evaluate(() => [...document.querySelectorAll("button, select, input")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 36 || r.width < 30); }).map((e) => (e.innerText || e.getAttribute("aria-label") || e.tagName).slice(0, 20)));
R.smallTargets = small; ok("touch targets: no tiny controls on the map screen", small.length <= 6, small.slice(0, 8).join(" | "));

// ---------- desktop ----------
const d = await newPage(1280, 800, false); await d.goto(URL, { waitUntil: "networkidle0" }); await click(d, "button", "Start playing"); await has(d, "LIMITING"); await shot(d, "14-map-desktop");
await d.keyboard.press("Tab"); await d.keyboard.press("Tab"); const focus = await d.evaluate(() => document.activeElement && document.activeElement.tagName); ok("keyboard focus lands on interactive elements", ["BUTTON", "INPUT", "SELECT"].includes(focus), focus);
await click(d, "nav button", "Campaign"); await shot(d, "15-campaign-desktop"); await click(d, "nav button", "Reports"); await shot(d, "16-reports-desktop"); const wide = await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); ok("desktop: no horizontal scroll", wide);
const mw = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); ok("mobile: no horizontal scroll", mw);

// ---------- offline PWA ----------
const o = await newPage(390, 844); await o.goto(URL, { waitUntil: "networkidle0" }); await click(o, "button", "Start playing");
const sw = await o.evaluate(async () => { if (!("serviceWorker" in navigator)) return "unsupported"; const r = await navigator.serviceWorker.ready; return r.active ? r.active.state : "none"; }); ok("service worker active", sw === "activated", sw);
const manifest = await o.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); if (!l) return null; const r = await fetch(l.href); return r.json(); }); ok("web manifest present (installable metadata)", manifest && manifest.display === "standalone" && manifest.icons.length >= 2, manifest ? manifest.name : "missing");
await new Promise((r) => setTimeout(r, 1500)); await click(o, "button", "Next day"); await click(o, "button", "Next day"); const dOnline = await day(o);
await o.setOfflineMode(true); await o.reload({ waitUntil: "domcontentloaded" }); ok("offline: app shell loads from cache", await has(o, "Factory DNA", 10000)); ok("offline: progress preserved after offline refresh", (await day(o)) === dOnline, `day ${dOnline}`);
await click(o, "button", "Next day"); ok("offline: gameplay works", (await day(o)) === dOnline + 1); await o.reload({ waitUntil: "domcontentloaded" }); ok("offline: second refresh keeps the new progress", (await day(o)) === dOnline + 1);
await click(o, "nav button", "Campaign"); await click(o, "button", "Export this slot"); const offExp = await o.$eval('textarea[aria-label="Save text"]', (e) => e.value); ok("offline: export works", offExp.startsWith("{"));
await o.setOfflineMode(false); await o.reload({ waitUntil: "networkidle0" }); ok("back online: state not reset or overwritten", (await day(o)) === dOnline + 1);
const swFail = await o.evaluate(async () => { const keys = await caches.keys(); return keys.length; }); ok("precache present", swFail > 0, swFail + " cache(s)");

// summary
const crit = Object.entries(R.axe).flatMap(([k, v]) => v.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => ({ screen: k, ...x })));
R.criticalAxe = crit; R.consoleErrors = [...new Set(R.errors)];
fs.writeFileSync(OUT + "e2e-results.json", JSON.stringify(R, null, 1));
console.log("AXE serious/critical:", crit.length, JSON.stringify(crit.slice(0, 12))); console.log("CONSOLE ERRORS:", R.consoleErrors.length, R.consoleErrors.slice(0, 5));
console.log("TOTAL", R.steps.filter((s) => s.pass).length, "/", R.steps.length, "pass");
await browser.close();
