// cloud/worker.mjs
import { DurableObject } from "cloudflare:workers";

// src/schema.js
var statuses = ["open", "progress", "review", "closed"];
var severityNames = { critical: "\u05E7\u05E8\u05D9\u05D8\u05D9", high: "\u05D2\u05D1\u05D5\u05D4", medium: "\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9", low: "\u05E0\u05DE\u05D5\u05DA" };
var dateAt = (offset = 0) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(/* @__PURE__ */ new Date());
  const get = (k) => Number(p.find((x) => x.type === k).value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day") + offset)).toISOString().slice(0, 10);
};
var score = (severity, likelihood) => Number(severity || 0) * Number(likelihood || 0);
var levels = { critical: 20, high: 12, medium: 6 };
function riskLevel(n, limits = levels) {
  return n >= limits.critical ? "critical" : n >= limits.high ? "high" : n >= limits.medium ? "medium" : "low";
}
var field = (id, he, en, type = "text", options = null) => ({ id, he, en, type, options });
var notes = (id, he, en) => field(id, he, en, "textarea");
var list = (id, he, en, options) => field(id, he, en, "select", options);
var when = (id, he, en) => field(id, he, en, "date");
var common = [field("owner", "\u05D0\u05D7\u05E8\u05D0\u05D9", "Owner"), when("date", "\u05EA\u05D0\u05E8\u05D9\u05DA", "Date"), when("due", "\u05DE\u05D5\u05E2\u05D3 \u05D9\u05E2\u05D3 / \u05EA\u05D5\u05E7\u05E3", "Due / expiry"), notes("details", "\u05EA\u05D9\u05D0\u05D5\u05E8 \u05D5\u05D4\u05E2\u05E8\u05D5\u05EA", "Description and notes")];
var types = {
  risks: [list("method", "\u05E9\u05D9\u05D8\u05EA \u05D4\u05E2\u05E8\u05DB\u05D4", "Method", ["JSA", "HIRA", "HAZOP", "FMEA", "What If", "Bow-Tie"]), notes("hazard", "\u05D2\u05D5\u05E8\u05DD \u05E1\u05D9\u05DB\u05D5\u05DF \u05D5\u05DE\u05E9\u05D9\u05DE\u05D4", "Hazard and task"), field("impact", "\u05D7\u05D5\u05DE\u05E8\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D9\u05EA (1\u20135)", "Initial severity (1\u20135)", "number"), field("likelihood", "\u05D4\u05E1\u05EA\u05D1\u05E8\u05D5\u05EA \u05E8\u05D0\u05E9\u05D5\u05E0\u05D9\u05EA (1\u20135)", "Initial likelihood (1\u20135)", "number"), notes("controls", "\u05D0\u05DE\u05E6\u05E2\u05D9 \u05D1\u05E7\u05E8\u05D4", "Controls"), field("residualImpact", "\u05D7\u05D5\u05DE\u05E8\u05D4 \u05E9\u05D9\u05D5\u05E8\u05D9\u05EA (1\u20135)", "Residual severity (1\u20135)", "number"), field("residualLikelihood", "\u05D4\u05E1\u05EA\u05D1\u05E8\u05D5\u05EA \u05E9\u05D9\u05D5\u05E8\u05D9\u05EA (1\u20135)", "Residual likelihood (1\u20135)", "number")],
  inspections: [list("type", "\u05E1\u05D5\u05D2 \u05D1\u05D9\u05E7\u05D5\u05E8\u05EA", "Inspection type", ["\u05DE\u05E4\u05E2\u05DC", "\u05D0\u05EA\u05E8 \u05D1\u05E0\u05D9\u05D9\u05D4", "\u05DE\u05D7\u05E1\u05DF", "\u05E6\u05D9\u05D5\u05D3", "\u05DE\u05DB\u05D5\u05E0\u05D5\u05EA", "\u05D7\u05E9\u05DE\u05DC", "\u05DB\u05D9\u05D1\u05D5\u05D9 \u05D0\u05E9", "\u05E6\u05D9\u05D5\u05D3 \u05DE\u05D2\u05DF \u05D0\u05D9\u05E9\u05D9", "\u05E2\u05D1\u05D5\u05D3\u05D4 \u05D1\u05D2\u05D5\u05D1\u05D4", "\u05DE\u05DC\u05D2\u05D6\u05D5\u05EA", "\u05E4\u05D9\u05D2\u05D5\u05DE\u05D9\u05DD", "\u05D7\u05D5\u05DE\u05E8\u05D9\u05DD \u05DE\u05E1\u05D5\u05DB\u05E0\u05D9\u05DD", "\u05E1\u05D3\u05E8 \u05D5\u05E0\u05D9\u05E7\u05D9\u05D5\u05DF"]), notes("checklist", "\u05E8\u05E9\u05D9\u05DE\u05EA \u05D1\u05D3\u05D9\u05E7\u05D4 \u05D5\u05EA\u05D5\u05E6\u05D0\u05D5\u05EA", "Checklist and outcomes"), field("source", "\u05D0\u05E1\u05DE\u05DB\u05EA\u05D0 \u05E8\u05DC\u05D5\u05D5\u05E0\u05D8\u05D9\u05EA", "Source reference"), notes("correction", "\u05D4\u05DE\u05DC\u05E6\u05D4 \u05DC\u05EA\u05D9\u05E7\u05D5\u05DF", "Recommended action"), field("sign", "\u05E9\u05DD \u05DE\u05D0\u05E9\u05E8 / \u05D7\u05EA\u05D9\u05DE\u05D4 \u05DE\u05D5\u05E7\u05DC\u05D3\u05EA", "Reviewer / typed signature")],
  issues: [field("source", "\u05D0\u05E1\u05DE\u05DB\u05EA\u05D0 / \u05D1\u05D9\u05E7\u05D5\u05E8\u05EA \u05DE\u05E7\u05D5\u05E9\u05E8\u05EA", "Reference / linked inspection"), notes("correction", "\u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05EA\u05E7\u05E0\u05EA", "Corrective action"), notes("verification", "\u05E8\u05D0\u05D9\u05D4 \u05D5\u05D0\u05D9\u05DE\u05D5\u05EA \u05E1\u05D2\u05D9\u05E8\u05D4", "Closure evidence and verification")],
  plans: [field("period", "\u05EA\u05E7\u05D5\u05E4\u05D4", "Period"), notes("objectives", "\u05D9\u05E2\u05D3\u05D9\u05DD \u05D5\u05DE\u05D3\u05D3\u05D9\u05DD", "Objectives and metrics"), notes("actions", "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05D5\u05DC\u05D5\u05D7\u05D5\u05EA \u05D6\u05DE\u05E0\u05D9\u05DD", "Actions and schedule"), field("sign", "\u05E9\u05DD \u05DE\u05D0\u05E9\u05E8", "Reviewer")],
  incidents: [list("type", "\u05E1\u05D5\u05D2 \u05D0\u05D9\u05E8\u05D5\u05E2", "Incident type", ["\u05EA\u05D0\u05D5\u05E0\u05D4", "\u05DB\u05DE\u05E2\u05D8 \u05EA\u05D0\u05D5\u05E0\u05D4"]), field("time", "\u05E9\u05E2\u05D4", "Time", "time"), list("method", "\u05E9\u05D9\u05D8\u05EA \u05EA\u05D7\u05E7\u05D5\u05E8", "Investigation method", ["RCA", "5 Whys", "Fishbone"]), notes("facts", "\u05E2\u05D5\u05D1\u05D3\u05D5\u05EA \u05DE\u05D0\u05D5\u05DE\u05EA\u05D5\u05EA / \u05E8\u05E6\u05E3", "Verified facts / chronology"), notes("statements", "\u05E2\u05D3\u05D5\u05D9\u05D5\u05EA", "Statements"), notes("findings", "\u05DE\u05DE\u05E6\u05D0\u05D9\u05DD", "Findings"), notes("hypotheses", "\u05D4\u05E9\u05E2\u05E8\u05D5\u05EA / \u05D2\u05D5\u05E8\u05DE\u05D9 \u05E9\u05D5\u05E8\u05E9 \u05DC\u05D1\u05D3\u05D9\u05E7\u05D4", "Hypotheses / root causes to review"), notes("correction", "\u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D5\u05DE\u05E2\u05E7\u05D1", "Recommendations and follow-up")],
  training: [list("type", "\u05E1\u05D5\u05D2 \u05D4\u05D3\u05E8\u05DB\u05D4", "Training type", ["\u05DB\u05DC\u05DC\u05D9\u05EA", "\u05E2\u05D5\u05D1\u05D3 \u05D7\u05D3\u05E9", "\u05E2\u05D1\u05D5\u05D3\u05D4 \u05D1\u05D2\u05D5\u05D1\u05D4", "\u05D7\u05E9\u05DE\u05DC", "\u05DE\u05DC\u05D2\u05D6\u05D4", "\u05D7\u05D5\u05DE\u05E8\u05D9\u05DD \u05DE\u05E1\u05D5\u05DB\u05E0\u05D9\u05DD", "\u05DB\u05D9\u05D1\u05D5\u05D9 \u05D0\u05E9", "\u05E2\u05D6\u05E8\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4", "\u05D7\u05DC\u05DC \u05DE\u05D5\u05E7\u05E3", "\u05DE\u05DB\u05D5\u05E0\u05D5\u05EA", "\u05E7\u05D1\u05DC\u05E0\u05D9\u05DD"]), field("participant", "\u05DE\u05D6\u05D4\u05D4 \u05DE\u05E9\u05EA\u05EA\u05E3 \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4", "Sample participant ID"), when("refresh", "\u05EA\u05D0\u05E8\u05D9\u05DA \u05E8\u05E2\u05E0\u05D5\u05DF", "Refresher date"), notes("attendance", "\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D5\u05DE\u05D1\u05D7\u05DF \u05D9\u05D3\u05E2", "Attendance and knowledge check"), field("sign", "\u05E9\u05DD \u05DE\u05D3\u05E8\u05D9\u05DA / \u05D7\u05EA\u05D9\u05DE\u05D4 \u05DE\u05D5\u05E7\u05DC\u05D3\u05EA", "Instructor / typed signature"), field("external", "\u05D0\u05E1\u05DE\u05DB\u05EA\u05D0 \u05D7\u05D9\u05E6\u05D5\u05E0\u05D9\u05EA (\u05D0\u05DD \u05E7\u05D9\u05D9\u05DE\u05EA)", "External reference (if any)")],
  equipment: [list("type", "\u05E1\u05D5\u05D2 \u05E6\u05D9\u05D5\u05D3", "Equipment type", ["\u05DE\u05DC\u05D2\u05D6\u05D4", "\u05E2\u05D2\u05D5\u05E8\u05DF", "\u05DE\u05EA\u05E7\u05DF \u05D4\u05E8\u05DE\u05D4", "\u05DE\u05E2\u05DC\u05D9\u05EA", "\u05DE\u05D3\u05D7\u05E1", "\u05D3\u05D5\u05D3 \u05E7\u05D9\u05D8\u05D5\u05E8", "\u05E6\u05D9\u05D5\u05D3 \u05D7\u05E9\u05DE\u05DC\u05D9", "\u05E1\u05D5\u05DC\u05DD", "\u05E4\u05D9\u05D2\u05D5\u05DD", "\u05E6\u05D9\u05D5\u05D3 \u05DE\u05D2\u05DF \u05D0\u05D9\u05E9\u05D9", "\u05DB\u05D9\u05D1\u05D5\u05D9 \u05D0\u05E9"]), field("assetId", "\u05DE\u05E1\u05E4\u05E8 \u05E6\u05D9\u05D5\u05D3", "Asset ID"), field("model", "\u05D9\u05E6\u05E8\u05DF \u05D5\u05D3\u05D2\u05DD", "Manufacturer and model"), when("purchased", "\u05EA\u05D0\u05E8\u05D9\u05DA \u05E8\u05DB\u05D9\u05E9\u05D4", "Purchase date"), field("certificate", "\u05DE\u05E1\u05E4\u05E8 \u05EA\u05E2\u05D5\u05D3\u05D4", "Certificate reference"), list("condition", "\u05DB\u05E9\u05D9\u05E8\u05D5\u05EA \u05EA\u05E4\u05E2\u05D5\u05DC\u05D9\u05EA \u05DE\u05D3\u05D5\u05D5\u05D7\u05EA", "Reported condition", ["\u05DC\u05D0 \u05E0\u05D1\u05D3\u05E7", "\u05DB\u05E9\u05D9\u05E8 \u05DC\u05E4\u05D9 \u05D0\u05E1\u05DE\u05DB\u05EA\u05D0", "\u05DE\u05D5\u05E9\u05D1\u05EA"])],
  documents: [field("template", "\u05EA\u05D1\u05E0\u05D9\u05EA", "Template"), list("classification", "\u05E1\u05D9\u05D5\u05D5\u05D2 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9", "Use classification", ["\u05EA\u05D1\u05E0\u05D9\u05EA \u05DE\u05D5\u05DE\u05DC\u05E6\u05EA", "\u05E0\u05D5\u05D4\u05DC \u05E4\u05E0\u05D9\u05DE\u05D9", "\u05D7\u05D5\u05D1\u05D4 \u05D1\u05DB\u05E4\u05D5\u05E3 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05EA\u05D7\u05D5\u05DC\u05D4"]), field("source", "\u05D0\u05E1\u05DE\u05DB\u05EA\u05D0 (\u05D0\u05DD \u05DE\u05E1\u05D5\u05DE\u05DF \u05DB\u05D7\u05D5\u05D1\u05D4)", "Reference (if marked mandatory)"), notes("body", "\u05EA\u05D5\u05DB\u05DF \u05D4\u05DE\u05E1\u05DE\u05DA", "Document body"), field("sign", "\u05E9\u05DD \u05DE\u05D0\u05E9\u05E8 / \u05D7\u05EA\u05D9\u05DE\u05D4 \u05DE\u05D5\u05E7\u05DC\u05D3\u05EA", "Reviewer / typed signature")],
  images: [notes("observations", "\u05EA\u05E6\u05E4\u05D9\u05D5\u05EA \u05D5\u05D4\u05D0\u05D6\u05D5\u05E8 \u05D4\u05D7\u05E9\u05D5\u05D3", "Observations and region"), notes("review", "\u05D1\u05D3\u05D9\u05E7\u05D4 \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05EA \u05E0\u05D3\u05E8\u05E9\u05EA", "Professional review required"), field("x", "\u05DE\u05D9\u05E7\u05D5\u05DD \u05D0\u05D5\u05E4\u05E7\u05D9 (0\u2013100%)", "Horizontal position (0\u2013100%)", "number"), field("y", "\u05DE\u05D9\u05E7\u05D5\u05DD \u05D0\u05E0\u05DB\u05D9 (0\u2013100%)", "Vertical position (0\u2013100%)", "number")]
};
var recordKeys = Object.keys(types);
var fieldsFor = (m) => [...common, ...types[m] || []];
var assetModules = ["risks", "inspections", "issues", "incidents", "equipment", "documents", "images"];

// src/local-data.js
var maxJson = 4 * 1024 * 1024;
var maxCloudJson = 12 * 1024 * 1024;
var format = "gold-safety-local";
var dateValue = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
var idValue = (s) => typeof s === "string" && /^[a-f0-9-]{36}$/.test(s);
var plain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
var text = (s, max, min = 0) => typeof s === "string" && s.trim().length >= min && s.length <= max;
var error = (code) => {
  throw Error(code);
};
var initialData = () => ({ format, version: 1, records: [], law: [], limits: { ...levels } });
var validLimits = (l) => plain(l) && ["medium", "high", "critical"].every((k) => Number.isInteger(l[k])) && l.medium >= 2 && l.medium < l.high && l.high < l.critical && l.critical <= 25;
var lawKeys = ["title", "category", "url", "section", "kind", "publication", "effective", "applies", "owner", "frequency", "proof", "summary", "before", "action", "consequences"];
function localDraft(d, id) {
  if (!plain(d) || !idValue(id) || !text(d.title, 180, 2) || !text(d.category, 180, 2) || !text(d.url, 800, 1)) error("draft");
  let u;
  try {
    u = new URL(d.url);
  } catch {
    error("url");
  }
  if (u.protocol !== "https:" || u.username || u.password || !["www.gov.il", "gov.il", "fs.knesset.gov.il", "main.knesset.gov.il", "www.osh.org.il", "osh.org.il"].includes(u.hostname)) error("url");
  for (const k of lawKeys) {
    if (!text(d[k] ?? "", 8e3)) error("draft");
  }
  for (const k of ["publication", "effective"]) if (d[k] && !dateValue(d[k])) error("draft");
  return { ...Object.fromEntries(lawKeys.map((k) => [k, (d[k] || "").trim()])), id, name: d.title.trim(), status: "draft", source: "\u05D8\u05D9\u05D5\u05D8\u05D4 \u05DE\u05E7\u05D5\u05DE\u05D9\u05EA \u2022 \u05DC\u05D0 \u05D0\u05D5\u05DE\u05EA\u05D4" };
}
function localRecord(r, limits) {
  if (!plain(r) || !recordKeys.includes(r.module) || !idValue(r.id) || !text(r.title, 150, 2) || !text(r.site, 100, 1) || !statuses.includes(r.status) || !Object.hasOwn(severityNames, r.severity) || !plain(r.data) || !text(r.updatedAt, 40) || !Number.isFinite(Date.parse(r.updatedAt))) error("record");
  const fs = fieldsFor(r.module), data = {};
  for (const f of fs) {
    const v = r.data[f.id] ?? "";
    if (!text(v, 8e3) || v && (f.type === "select" && !f.options.includes(v) || f.type === "date" && !dateValue(v) || f.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v) || f.type === "number" && (!/^\d{1,3}$/.test(v) || +v > (["x", "y"].includes(f.id) ? 100 : 5) || !["x", "y"].includes(f.id) && +v < 1))) error("record");
    data[f.id] = v;
  }
  if (r.module === "issues" && r.status === "closed" && !data.verification.trim()) error("closure");
  if (r.module === "documents" && data.classification === "\u05D7\u05D5\u05D1\u05D4 \u05D1\u05DB\u05E4\u05D5\u05E3 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05EA\u05D7\u05D5\u05DC\u05D4" && !data.source.trim()) error("reference");
  if (r.module === "risks" && (!data.hazard.trim() || !data.method || !data.impact || !data.likelihood)) error("record");
  if (r.module === "images" && !data.observations.trim()) error("record");
  if (r.status === "closed") data.closedOn = dateValue(r.data.closedOn) ? r.data.closedOn : dateAt();
  const image = r.image ?? null;
  if (image !== null && (!assetModules.includes(r.module) || !text(image, 14e5) || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))) error("image");
  return {
    id: r.id,
    module: r.module,
    title: r.title.trim(),
    site: r.site.trim(),
    status: r.status,
    severity: r.module === "risks" ? riskLevel(score(data.impact, data.likelihood), limits) : r.severity,
    data,
    updatedAt: new Date(r.updatedAt).toISOString(),
    image
  };
}
function parseBackup(json2, byteLimit = maxJson) {
  if (typeof json2 !== "string" || json2.length > byteLimit || new TextEncoder().encode(json2).length > byteLimit) error("size");
  let d;
  try {
    d = JSON.parse(json2);
  } catch {
    error("json");
  }
  if (!plain(d) || d.format !== format || d.version !== 1 || !Array.isArray(d.records) || !Array.isArray(d.law) || !validLimits(d.limits)) error("json");
  const limits = Object.fromEntries(["medium", "high", "critical"].map((k) => [k, d.limits[k]])), out = { ...initialData(), limits };
  out.records = d.records.map((r) => localRecord(r, limits));
  out.law = d.law.map((r) => localDraft(r, r?.id));
  for (const list2 of [out.records, out.law]) if (new Set(list2.map((r) => r.id)).size !== list2.length) error("json");
  return out;
}

// cloud/worker.mjs
var headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
var json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
var failure = (status, error2) => json({ error: error2 }, status);
var paths = /* @__PURE__ */ new Map([["/api/login", "POST"], ["/api/logout", "POST"], ["/api/data", "GET,PUT"]]);
var cookieName = "__Host-goldsafety";
var enc = new TextEncoder();
var decoder = new TextDecoder("utf-8", { fatal: true });
var bytesHex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
var hash = async (s) => bytesHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
var ttl = 60 * 60 * 12;
var sessionCookie = (v, life) => `${cookieName}=${v}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${life}`;
var readCookie = (header) => header?.match(/(?:^|;\s*)__Host-goldsafety=([a-f0-9]{64})(?:;|$)/)?.[1];
async function readBounded(req, limit) {
  if (!req.body || Number(req.headers.get("content-length")) > limit) throw Error("size");
  if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) throw Error("type");
  const reader = req.body.getReader(), pieces = [];
  let size = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw Error("size");
      pieces.push(decoder.decode(value, { stream: true }));
    }
    pieces.push(decoder.decode());
    return pieces.join("");
  } catch (e) {
    try {
      await reader.cancel();
    } catch {
    }
    throw e;
  }
}
var worker_default = {
  async fetch(request, env) {
    const u = new URL(request.url), p = u.pathname;
    if (p !== "/api" && !p.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!paths.get(p)?.split(",").includes(request.method)) return failure(404, "route");
    if (request.method !== "GET" && request.headers.get("origin") !== u.origin) return failure(403, "origin");
    if (typeof env.GOLD_ACCESS_CODE !== "string" || env.GOLD_ACCESS_CODE.length < 24) return failure(503, "setup");
    if (p === "/api/data" && request.method === "PUT" && Number(request.headers.get("content-length")) > maxCloudJson) return failure(413, "size");
    return env.WORKSPACE.get(env.WORKSPACE.idFromName("gold-safety-owner-v1")).fetch(request);
  }
};
var GoldWorkspace = class extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS chunks (idx INTEGER PRIMARY KEY, data TEXT NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS revision (id INTEGER PRIMARY KEY CHECK(id=1), rev INTEGER NOT NULL)");
    this.sql.exec("INSERT OR IGNORE INTO revision VALUES (1,0)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, auth TEXT NOT NULL, expiry INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS attempts (client TEXT PRIMARY KEY, hits INTEGER NOT NULL, expiry INTEGER NOT NULL)");
  }
  row(q, ...a) {
    return this.sql.exec(q, ...a).toArray()[0];
  }
  revision() {
    return this.row("SELECT rev FROM revision WHERE id=1").rev;
  }
  async fetch(req) {
    try {
      return await this.handle(req);
    } catch (e) {
      if (e.message === "size") return failure(413, "size");
      if (e.message === "type") return failure(415, "json");
      return failure(500, "cloud");
    }
  }
  async handle(req) {
    const p = new URL(req.url).pathname, now = Date.now(), authStamp = await hash("gold-auth-v1:" + this.env.GOLD_ACCESS_CODE);
    if (p === "/api/login") {
      const peer = req.headers.get("CF-Connecting-IP") || "unknown";
      const client = await hash("rate:" + peer);
      let supplied;
      try {
        supplied = JSON.parse(await readBounded(req, 1024)).code;
      } catch {
        return failure(400, "login");
      }
      if (typeof supplied !== "string" || supplied.length > 160) return failure(400, "login");
      const secretKey = await crypto.subtle.importKey("raw", enc.encode(this.env.GOLD_ACCESS_CODE), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
      const signature = await crypto.subtle.sign("HMAC", secretKey, enc.encode(this.env.GOLD_ACCESS_CODE));
      if (!await crypto.subtle.verify("HMAC", secretKey, signature, enc.encode(supplied))) {
        this.sql.exec("DELETE FROM attempts WHERE expiry<=?", now);
        const per = this.row("SELECT hits FROM attempts WHERE client=?", client)?.hits || 0;
        const all = this.row("SELECT hits FROM attempts WHERE client='global'")?.hits || 0;
        if (per >= 8 || all >= 100) return failure(429, "rate");
        for (const key of [client, "global"]) this.sql.exec("INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(client) DO UPDATE SET hits=hits+1", key, now + 10 * 6e4);
        return failure(401, "login");
      }
      const token2 = bytesHex(crypto.getRandomValues(new Uint8Array(32))), digest2 = await hash(token2);
      this.sql.exec("DELETE FROM sessions WHERE expiry<=? OR auth<>?", now, authStamp);
      this.sql.exec("DELETE FROM sessions WHERE token IN (SELECT token FROM sessions ORDER BY expiry DESC LIMIT -1 OFFSET 19)");
      this.sql.exec("INSERT INTO sessions VALUES (?,?,?)", digest2, authStamp, now + ttl * 1e3);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie(token2, ttl) });
    }
    const token = readCookie(req.headers.get("cookie")), digest = token && await hash(token);
    if (!digest || !this.row("SELECT token FROM sessions WHERE token=? AND expiry>? AND auth=?", digest, now, authStamp)) return failure(401, "auth");
    if (p === "/api/logout") {
      this.sql.exec("DELETE FROM sessions WHERE token=?", digest);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
    }
    if (p === "/api/data" && req.method === "GET") {
      const rows = this.sql.exec("SELECT data FROM chunks ORDER BY idx").toArray(), rev = this.revision();
      const prefix = `{"rev":${rev},"data":`;
      let i = -1;
      const stream = new ReadableStream({ pull(c) {
        if (i === -1) c.enqueue(enc.encode(prefix));
        else if (i < rows.length) c.enqueue(enc.encode(rows[i].data));
        else {
          c.enqueue(enc.encode((rows.length ? "" : JSON.stringify(initialData())) + "}"));
          c.close();
        }
        i++;
      } });
      return new Response(stream, { headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
    }
    if (p === "/api/data" && req.method === "PUT") {
      const match = req.headers.get("if-match");
      if (!match || !/^"\d{1,15}"$/.test(match)) return failure(428, "revision");
      let data;
      try {
        data = parseBackup(await readBounded(req, maxCloudJson), maxCloudJson);
      } catch (e) {
        if (e.message === "size") throw e;
        return failure(400, "json");
      }
      if (!this.row("SELECT token FROM sessions WHERE token=? AND expiry>? AND auth=?", digest, Date.now(), authStamp)) return failure(401, "auth");
      const raw = JSON.stringify(data);
      if (enc.encode(raw).byteLength > maxCloudJson) throw Error("size");
      const parts = [];
      for (let i = 0; i < raw.length; ) {
        let j = Math.min(raw.length, i + 12e4);
        if (j < raw.length && raw.charCodeAt(j - 1) >= 55296 && raw.charCodeAt(j - 1) <= 56319) j--;
        parts.push(raw.slice(i, j));
        i = j;
      }
      const rev = this.ctx.storage.transactionSync(() => {
        const actual = this.revision();
        if (`"${actual}"` !== match) return null;
        this.sql.exec("DELETE FROM chunks");
        for (let i = 0; i < parts.length; i++) this.sql.exec("INSERT INTO chunks VALUES (?,?)", i, parts[i]);
        this.sql.exec("UPDATE revision SET rev=? WHERE id=1", actual + 1);
        return actual + 1;
      });
      return rev === null ? failure(409, "conflict") : json({ rev });
    }
    return failure(404, "route");
  }
};
export {
  GoldWorkspace,
  worker_default as default
};
