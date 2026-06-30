import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

const NAVY="#1B2A4A",GOLD="#F5A623",WHITE="#fff",LIGHT="#FFF9EE",MUTED="#6b7280",LINE="#e5e7eb",RED="#dc2626",GREEN="#16a34a",DG="linear-gradient(135deg,#1B2A4A,#243B67)",AG="linear-gradient(135deg,#F5A623,#F7BC55)";
const PASS="occ";
const CATS=["Account Management","Billing","Estimating","Integrations","Job Management","Onboarding","Pricing","Reporting","Settings","Users & Permissions","Other"];
const AUD=["Internal","External"];
const CHECK_ITEMS=[
  {id:"title",    label:"Article title filled"},
  {id:"subtitle", label:"Subtitle written"},
  {id:"category",    label:"Category set"},
  {id:"subcategory", label:"Subcategory set"},
  {id:"audience", label:"Audience selected"},
  {id:"intro",    label:"Article intro written"},
  {id:"steps",    label:"Steps added (≥1)"},
  {id:"scribe",   label:"Scribe source pasted"},
  {id:"tags",     label:"Tags generated"},
  {id:"reviewed", label:"Last reviewed date set"},
];

// ── STORAGE ──
function useLS(key, fb) {
  const [v, sv] = useState(() => {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; }
  });
  const save = u => { sv(u); try { localStorage.setItem(key, JSON.stringify(u)); } catch {} };
  return [v, save];
}

const fd = () => ({
  id: Date.now(), title: "", subtitle: "", category: "", subcategory: "", audience: [],
  lastReviewed: "", intro: "", steps: [{ id: Date.now() + 1, text: "", image: null, imageBase: null, imageShapes: [], imageAlt: "" }],
  notes: [], tags: [], related: [], rawHtml: "", status: "draft",
});

// ── AI CALL ──
async function callAI(prompt, onChunk, onDone, onErr) {
  try {
    const r = await fetch("/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, stream: true, messages: [{ role: "user", content: prompt }] })
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || `Error ${r.status}`); }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let out = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      const lines = dec.decode(value).split("\n").filter(l => l.startsWith("data:"));
      for (const line of lines) {
        const d = line.slice(5).trim(); if (d === "[DONE]") continue;
        try { const ev = JSON.parse(d); const t = ev?.delta?.text || ""; if (t) { out += t; onChunk(out); } } catch {}
      }
    }
    onDone(out);
  } catch (e) { onErr(e.message); }
}

// ── EXTRACT SCRIBE IMAGES ──


// ── BUILD FINAL HTML ──
function buildHTML(d) {
  const rev = d.lastReviewed
    ? new Date(d.lastReviewed).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not set";
  const mdBold = t => (t || "").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const stepsH = (d.steps || []).map((s, i) => `
    <div class="step-card">
      <div class="step-num">${i + 1}</div>
      <div class="step-body">
        <p>${mdBold(s.text || "")}</p>
        ${s.image ? `<img src="${s.image}" alt="${s.imageAlt || ""}" class="step-img"/>` : ""}
      </div>
    </div>`).join("");
  const tagsH = (d.tags || []).map(t => `<span class="tag">${t}</span>`).join("");

  const relH = (d.related || []).filter(Boolean).map(r => `<a href="#" class="rel-pill">${r}</a>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${d.title || "KB Article"}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#f9f8f6;color:#1B2A4A;padding:32px 16px}
.page{max-width:800px;margin:0 auto}
.kb-header{background:linear-gradient(135deg,#1B2A4A,#243B67);color:#fff;border-radius:12px 12px 0 0;padding:30px 32px 26px}
.kb-header h1{font-family:'DM Serif Display',Georgia,serif;font-size:28px;font-weight:400;line-height:1.3;margin-bottom:7px}
.kb-header .sub{font-size:14px;opacity:.72;line-height:1.55}
.kb-header .brand{font-size:11px;opacity:.4;margin-top:14px;text-align:right}
.meta-bar{background:#243B67;padding:9px 32px;display:flex;flex-wrap:wrap;gap:7px;border-bottom:3px solid #F5A623}
.pill{background:rgba(255,255,255,.13);color:#fff;font-size:11px;font-weight:600;padding:3px 11px;border-radius:20px}
.body-card{background:#fff;border-radius:0 0 12px 12px;padding:30px 32px 32px;border:1px solid #e5e7eb;border-top:none}
.intro{font-size:14px;line-height:1.78;color:#374151;margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #e5e7eb}
.section-head{font-size:17px;font-weight:600;color:#1B2A4A;border-left:4px solid #F5A623;padding-left:13px;margin:26px 0 15px}
.step-card{display:flex;gap:13px;margin-bottom:14px;background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}
.step-num{min-width:26px;height:26px;border-radius:50%;background:#F5A623;color:#1B2A4A;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
.step-body{flex:1}
.step-body p{font-size:14px;line-height:1.72;color:#374151}
.step-body p strong{color:#1B2A4A}
.step-img{width:100%;border-radius:7px;margin-top:10px;border:1px solid #e5e7eb;display:block}
.tags-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:22px;padding-top:18px;border-top:1px solid #e5e7eb}
.tag{background:#EFF6FF;color:#1d4ed8;font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500}
.related-section{margin-top:20px;padding-top:18px;border-top:1px solid #e5e7eb}
.related-section h3{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:9px}
.rel-pill{display:inline-block;padding:5px 13px;border:1.5px solid #F5A623;border-radius:20px;color:#1B2A4A;font-size:12px;font-weight:500;text-decoration:none;margin:3px}
.note-card{display:flex;gap:10px;margin-bottom:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:12px 14px}
.note-icon{font-size:14px;flex-shrink:0;margin-top:1px}
.note-body{font-size:13px;line-height:1.7;color:#92400e}
.footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:18px;padding-top:14px;border-top:1px solid #f3f4f6}
</style>
</head>
<body>
<div class="page">
  <div class="kb-header">
    <h1>${d.title || "Untitled Article"}</h1>
    ${d.subtitle ? `<div class="sub">${d.subtitle}</div>` : ""}
    <div class="brand">OCC Knowledge Base</div>
  </div>
  <div class="meta-bar">
    ${d.category ? `<span class="pill">📂 ${d.category}${d.subcategory ? ` › ${d.subcategory}` : ""}</span>` : ""}
    ${(d.audience || []).map(a => `<span class="pill">👥 ${a}</span>`).join("")}
    ${rev !== "Not set" ? `<span class="pill">📅 ${rev}</span>` : ""}
  </div>
  <div class="body-card">
    ${d.intro ? `<div class="intro">${d.intro.replace(/\n/g, "<br>")}</div>` : ""}
    <div class="section-head">Steps</div>
    ${stepsH}

    ${(d.tags || []).length ? `<div class="tags-row">${tagsH}</div>` : ""}
    ${(d.related || []).filter(Boolean).length ? `<div class="related-section"><h3>Related articles</h3>${relH}</div>` : ""}
    <div class="footer">Last reviewed: ${rev} · One Click Contractor Internal KB</div>
  </div>
</div>
</body>
</html>`;
}

// ── CHECKLIST STATUS ──
function getStatus(d) {
  return {
    title:    !!d.title?.trim(),
    subtitle: !!d.subtitle?.trim(),
    category: !!d.category?.trim(),
    subcategory: !!d.subcategory?.trim(),
    audience: (d.audience || []).length > 0,
    intro:    !!d.intro?.trim(),
    steps:    (d.steps || []).some(s => s.text?.trim()),
    scribe:   !!d.rawHtml?.trim(),
    tags:     (d.tags || []).length > 0,
    reviewed: !!d.lastReviewed,
  };
}

// ── ATOMS ──
const SL = ({ children, mt = 10 }) => (
  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, marginBottom: 4, marginTop: mt }}>{children}</div>
);
const Inp = ({ value, onChange, placeholder, full, mono, type = "text", style = {} }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${LINE}`, fontSize: 12, outline: "none", fontFamily: mono ? "monospace" : "inherit", background: WHITE, width: full ? "100%" : "auto", boxSizing: "border-box", ...style }}
    onFocus={e => e.target.style.borderColor = GOLD} onBlur={e => e.target.style.borderColor = LINE} />
);
const Sel = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ padding: "8px 8px", borderRadius: 7, border: `1.5px solid ${LINE}`, fontSize: 12, background: WHITE, fontFamily: "inherit", outline: "none", cursor: "pointer", width: "100%" }}>
    {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
  </select>
);
const Ta = React.forwardRef(({ value, onChange, placeholder, rows = 3, mono = false, style = {}, onBlur }, ref) => (
  <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${LINE}`, fontSize: mono ? 11 : 12, outline: "none", fontFamily: mono ? "monospace" : "inherit", resize: "vertical", width: "100%", lineHeight: 1.65, boxSizing: "border-box", ...style }}
    onFocus={e => e.target.style.borderColor = GOLD}
    onBlur={e => { e.target.style.borderColor = LINE; onBlur && onBlur(e); }} />
));
const Chip = ({ label, onRemove }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: LIGHT, border: `1px solid ${GOLD}`, color: NAVY, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, marginRight: 4, marginBottom: 4 }}>
    {label}<button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 11, lineHeight: 1, padding: "0 1px" }}>×</button>
  </span>
);
const AudChips = ({ sel, onChange }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
    {AUD.map(a => {
      const on = sel.includes(a);
      return <button key={a} onClick={() => onChange(on ? sel.filter(x => x !== a) : [...sel, a])}
        style={{ padding: "4px 11px", borderRadius: 20, border: `1.5px solid ${on ? GOLD : LINE}`, background: on ? LIGHT : WHITE, color: on ? NAVY : MUTED, fontSize: 11, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>{a}</button>;
    })}
  </div>
);
const AIBtn = ({ onClick, loading, label = "AI" }) => (
  <button onClick={onClick} disabled={loading}
    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #bfdbfe", background: loading ? "#f8fafc" : "#eff6ff", color: loading ? MUTED : "#1d4ed8", fontSize: 11, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>
    {loading ? "…" : label}
  </button>
);
const Btn = ({ onClick, children, variant = "ghost", style = {}, disabled = false }) => {
  const vs = { ghost: { background: WHITE, border: `1.5px solid ${LINE}`, color: "#374151" }, navy: { background: DG, color: WHITE, border: "none" }, gold: { background: AG, color: NAVY, border: "none" }, green: { background: GREEN, color: WHITE, border: "none" }, danger: { background: WHITE, border: `1.5px solid #fca5a5`, color: RED } };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: disabled ? .5 : 1, whiteSpace: "nowrap", ...vs[variant], ...style }}>{children}</button>;
};
const Toast = ({ msg, onClose }) => msg ? (
  <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: NAVY, color: WHITE, padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>
    {msg}<button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 15, padding: 0 }}>×</button>
  </div>
) : null;

// ── GENERAL INFO TAB ──
function GeneralInfo({ draft, upd, drafts, onNew, onSelect, onDelete }) {
  const [relInput, setRelInput] = useState("");
  const addRel = () => { if (relInput.trim()) { upd({ related: [...(draft.related || []), relInput.trim()] }); setRelInput(""); } };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Drafts */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${LINE}` }}>
          <SL mt={0}>Saved drafts</SL>
          <div style={{ maxHeight: 110, overflowY: "auto", marginBottom: 8 }}>
            {drafts.length === 0 && <div style={{ fontSize: 12, color: MUTED, padding: "4px 0" }}>No drafts yet</div>}
            {drafts.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", borderBottom: `1px solid #f5f5f5` }}>
                <button onClick={() => onSelect(d)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: d.id === draft.id ? GOLD : NAVY, fontWeight: d.id === draft.id ? 700 : 400, fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.title || "Untitled"}
                </button>
                <button onClick={() => onDelete(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", fontSize: 12, padding: "0 3px", flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
          <button onClick={onNew}
            style={{ width: "100%", padding: "7px", border: `1.5px dashed ${LINE}`, borderRadius: 7, background: "none", fontSize: 12, color: MUTED, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUTED; }}>
            + New article
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <SL mt={0}>Article title *</SL>
            <Inp value={draft.title} onChange={v => upd({ title: v })} placeholder="e.g. How to Manage Users in OCC" full />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <SL>Description / subtitle</SL>
            <Inp value={draft.subtitle || ""} onChange={v => upd({ subtitle: v })} placeholder="One-line summary shown under the title" full />
          </div>
          <div>
            <SL>Category</SL>
            <Sel value={draft.category} onChange={v => upd({ category: v })} options={[{ v: "", l: "Select…" }, ...CATS.map(c => ({ v: c, l: c }))]} />
          </div>
          <div>
            <SL>Last reviewed</SL>
            <Inp type="date" value={draft.lastReviewed || ""} onChange={v => upd({ lastReviewed: v })} full />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <SL>Audience</SL>
            <AudChips sel={draft.audience || []} onChange={v => upd({ audience: v })} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <SL>Related articles</SL>
            <div style={{ marginBottom: 6 }}>
              {(draft.related || []).filter(Boolean).map((r, i) => (
                <Chip key={i} label={r} onRemove={() => upd({ related: (draft.related || []).filter((_, j) => j !== i) })} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <Inp value={relInput} onChange={setRelInput} placeholder="Article title…" full
                onKeyDown={e => e.key === "Enter" && addRel()} style={{ flex: 1, width: "auto" }} />
              <button onClick={addRel} style={{ padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${LINE}`, background: WHITE, fontSize: 12, cursor: "pointer" }}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CHECKLIST TAB ──
function Checklist({ draft }) {
  const status = getStatus(draft);
  const done = Object.values(status).filter(Boolean).length;
  const pct = Math.round(done / CHECK_ITEMS.length * 100);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Article readiness</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: pct === 100 ? GREEN : GOLD }}>{pct}%</div>
        </div>
        <div style={{ height: 6, borderRadius: 6, background: LINE, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? GREEN : GOLD, borderRadius: 6, transition: "width .3s" }} />
        </div>
        {CHECK_ITEMS.map(item => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 5, border: `1px solid ${status[item.id] ? "#86efac" : LINE}`, background: status[item.id] ? "#f0fdf4" : WHITE }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: status[item.id] ? GREEN : LINE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 700, color: WHITE }}>
              {status[item.id] ? "✓" : ""}
            </div>
            <span style={{ fontSize: 13, color: status[item.id] ? "#166534" : MUTED, fontWeight: status[item.id] ? 600 : 400 }}>{item.label}</span>
            {!status[item.id] && <span style={{ marginLeft: "auto", fontSize: 10, color: "#92400e", background: "#fffbeb", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>Pending</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NOTES PANEL (private, never exported) ──
function NotesPanel({ draftId }) {
  const storageKey = `kb-notes-${draftId}`;
  const [notes, setNotes] = useLS(storageKey, []);
  const [noteDrag] = [useDrag(notes, setNotes)];
  const addNote = () => setNotes([...notes, { id: Date.now(), text: "" }]);
  const updNote = (id, p) => setNotes(notes.map(n => n.id === id ? { ...n, ...p } : n));
  const delNote = id => setNotes(notes.filter(n => n.id !== id));
  const moveNote = (i, dir) => {
    const a = [...notes]; const ni = i + dir;
    if (ni < 0 || ni >= a.length) return; [a[i], a[ni]] = [a[ni], a[i]]; setNotes(a);
  };
  const drag = useDrag(notes, setNotes);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>📝 My Notes</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Private — never shown in the article or exports</div>
          </div>
          <button onClick={addNote}
            style={{ padding: "6px 13px", borderRadius: 7, border: "1.5px solid #fde68a", background: "#fffbeb", color: "#92400e", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            + Add note
          </button>
        </div>
        {notes.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: MUTED, fontSize: 13, border: "1.5px dashed #fde68a", borderRadius: 10, background: "#fffbeb" }}>
            No notes yet — add exceptions, edge cases, or reminders for yourself
          </div>
        )}
        {notes.map((note, i) => (
          <NoteCard key={note.id} note={note} index={i} total={notes.length}
            onUpd={p => updNote(note.id, p)} onDelete={() => delNote(note.id)}
            onMoveUp={() => moveNote(i, -1)} onMoveDown={() => moveNote(i, 1)}
            dragHandlers={drag} />
        ))}
      </div>
    </div>
  );
}

// ── CHECKLIST SIDEBAR (persistent across all tabs) ──
function ChecklistSidebar({ draft }) {
  const [open, setOpen] = useState(true); // open by default
  const status = getStatus(draft);
  const done = Object.values(status).filter(Boolean).length;
  const pct = Math.round(done / CHECK_ITEMS.length * 100);
  return (
    <div style={{
      width: open ? 210 : 34, flexShrink: 0, background: WHITE,
      borderLeft: `1px solid ${LINE}`, display: "flex", flexDirection: "column",
      transition: "width .2s", overflow: "hidden",
    }}>
      {/* Header — always visible, click to toggle */}
      <button onClick={() => setOpen(o => !o)}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: open ? "space-between" : "center",
          padding: "10px 8px", borderBottom: `1px solid ${LINE}`, flexShrink: 0, gap: 6, width: "100%" }}>
        {open
          ? <>
              <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, whiteSpace: "nowrap" }}>Checklist</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? GREEN : GOLD, marginLeft: "auto", marginRight: 4 }}>{pct}%</span>
              <span style={{ fontSize: 10, color: MUTED }}>‹</span>
            </>
          : <span style={{ fontSize: 12, color: MUTED, writingMode: "vertical-rl", letterSpacing: 1 }}>›</span>
        }
      </button>
      {open && (
        <>
          <div style={{ margin: "8px 10px 4px", height: 4, borderRadius: 4, background: LINE, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? GREEN : GOLD, borderRadius: 4, transition: "width .3s" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
            {CHECK_ITEMS.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "6px 2px", borderBottom: `1px solid #f5f5f5` }}>
                <div style={{ width: 15, height: 15, borderRadius: 4, background: status[item.id] ? GREEN : LINE, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  {status[item.id] && <span style={{ color: WHITE, fontSize: 9, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: status[item.id] ? "#166534" : MUTED, lineHeight: 1.35 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── SCRIBE HTML SOURCE (collapsible, auto-extract on paste) ──
function ScribeSource({ rawHtml, onChange, onExtract, extractLoad }) {
  const [open, setOpen] = useState(false);
  const hasContent = !!rawHtml.trim();

  const handleChange = v => {
    onChange(v);
    // auto-trigger extract when content is pasted in (length jumps by >200 chars)
    if (v.trim().length > 200 && v.trim() !== rawHtml.trim()) {
      setTimeout(() => onExtract(), 300);
    }
  };

  return (
    <div style={{ marginTop: 10, borderRadius: 9, border: `1px solid ${LINE}`, background: "#f8fafc", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED }}>Scribe source</span>
        {hasContent && <span style={{ fontSize: 9, background: GREEN, color: WHITE, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>pasted</span>}
        {hasContent && !open && <span style={{ fontSize: 10, color: MUTED }}>— click ⚡ Extract to pull steps</span>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 11px 10px" }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, lineHeight: 1.5 }}>
            Paste your Scribe HTML or Markdown export. Hit ⚡ Extract steps to pull steps automatically.
          </div>
          <Ta value={rawHtml} onChange={handleChange} placeholder="Paste Scribe HTML or Markdown export here…" rows={6} mono />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 7 }}>
            <button onClick={onExtract} disabled={extractLoad || !rawHtml.trim()}
              style={{ padding: "5px 11px", borderRadius: 6, border: "1px solid #93c5fd", background: extractLoad ? "#f1f5f9" : "#eff6ff", color: extractLoad ? MUTED : "#1d4ed8", fontSize: 11, fontWeight: 600, cursor: (extractLoad || !rawHtml.trim()) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: !rawHtml.trim() ? .5 : 1 }}>
              {extractLoad ? "Extracting steps…" : "⚡ Extract steps now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCRIBE IMAGE STRIP ──


// ── IMAGE ASSIGN MODAL ──
function ImgModal({ image, steps, onAssign, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: WHITE, borderRadius: 12, padding: 18, maxWidth: 460, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Assign image to step</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: MUTED }}>×</button>
        </div>
        <img src={image} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 7, border: `1px solid ${LINE}`, display: "block", marginBottom: 12 }} />
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Which step should this image go to?</div>
        {steps.length === 0 && <div style={{ fontSize: 12, color: MUTED, padding: "10px 0" }}>No steps yet — add steps first.</div>}
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => { onAssign(s.id, image); onClose(); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: `1.5px solid ${LINE}`, borderRadius: 8, background: WHITE, cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: NAVY, marginBottom: 5 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = LIGHT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.background = WHITE; }}>
            <span style={{ fontWeight: 700 }}>Step {i + 1}</span>{s.text ? " — " + s.text.replace(/\*\*/g, "").slice(0, 60) + (s.text.length > 60 ? "…" : "") : " (empty)"}
          </button>
        ))}
      </div>
    </div>
  );
}


// ── IMAGE ANNOTATOR ──────────────────────────────────────────────────────────
const ANN_COLORS = ["#E53E3E","#2563eb","#16a34a","#F5A623","#7c3aed","#000000"];
const HANDLE_R = 6; // resize handle radius

// ── pure draw ──
function drawShape(ctx, s, selected) {
  ctx.save();
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
  ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (s.type === "box") {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    if (selected) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      ctx.setLineDash([]);
      getBoxHandles(s).forEach(h => {
        ctx.fillStyle = "#fff"; ctx.beginPath();
        ctx.arc(h.x, h.y, HANDLE_R, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  } else if (s.type === "arrow") {
    const dx = s.x2-s.x1, dy = s.y2-s.y1, len = Math.hypot(dx,dy);
    if (len < 2) { ctx.restore(); return; }
    const angle = Math.atan2(dy,dx), hw = Math.max(10, Math.min(20, len*0.25));
    ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x2, s.y2);
    ctx.lineTo(s.x2 - hw*Math.cos(angle-0.45), s.y2 - hw*Math.sin(angle-0.45));
    ctx.lineTo(s.x2 - hw*Math.cos(angle+0.45), s.y2 - hw*Math.sin(angle+0.45));
    ctx.closePath(); ctx.fill();
    if (selected) {
      [{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}].forEach(h => {
        ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(h.x,h.y,HANDLE_R,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=s.color; ctx.lineWidth=2; ctx.stroke();
      });
    }
  } else if (s.type === "text") {
    const fs = s.size||16;
    ctx.font = `bold ${fs}px -apple-system,Arial,sans-serif`;
    const m = ctx.measureText(s.label);
    ctx.fillStyle = s.color;
    ctx.fillText(s.label, s.x, s.y);
    if (selected) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 1.5; ctx.setLineDash([3,2]);
      ctx.strokeRect(s.x-4, s.y-fs-2, m.width+8, fs+8);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function getBoxHandles(s) {
  const x2 = s.x+s.w, y2 = s.y+s.h, mx = s.x+s.w/2, my = s.y+s.h/2;
  return [
    {id:"nw",x:s.x,y:s.y},{id:"n",x:mx,y:s.y},{id:"ne",x:x2,y:s.y},
    {id:"e",x:x2,y:my},{id:"se",x:x2,y:y2},{id:"s",x:mx,y:y2},
    {id:"sw",x:s.x,y:y2},{id:"w",x:s.x,y:my},
  ];
}

function hitHandle(s, x, y) {
  if (s.type === "box") {
    for (const h of getBoxHandles(s)) {
      if (Math.hypot(x-h.x, y-h.y) <= HANDLE_R+3) return h.id;
    }
  }
  if (s.type === "arrow") {
    if (Math.hypot(x-s.x1, y-s.y1) <= HANDLE_R+4) return "p1";
    if (Math.hypot(x-s.x2, y-s.y2) <= HANDLE_R+4) return "p2";
  }
  return null;
}

function hitShape(s, x, y) {
  const PAD = 6;
  if (s.type === "box") {
    const nx = Math.min(s.x, s.x+s.w), ny = Math.min(s.y, s.y+s.h);
    const nx2 = Math.max(s.x, s.x+s.w), ny2 = Math.max(s.y, s.y+s.h);
    return x >= nx-PAD && x <= nx2+PAD && y >= ny-PAD && y <= ny2+PAD;
  }
  if (s.type === "arrow") {
    const len = Math.hypot(s.x2-s.x1, s.y2-s.y1);
    if (len < 1) return false;
    const t = ((x-s.x1)*(s.x2-s.x1) + (y-s.y1)*(s.y2-s.y1)) / (len*len);
    const tc = Math.max(0, Math.min(1, t));
    const px = s.x1 + tc*(s.x2-s.x1), py = s.y1 + tc*(s.y2-s.y1);
    return Math.hypot(x-px, y-py) <= PAD+4;
  }
  if (s.type === "text") {
    return x >= s.x-6 && x <= s.x+120 && y >= s.y-20 && y <= s.y+6;
  }
  return false;
}

function resizeBox(s, handleId, dx, dy) {
  let {x,y,w,h} = s;
  if (handleId.includes("e")) w += dx;
  if (handleId.includes("s")) h += dy;
  if (handleId.includes("w")) { x += dx; w -= dx; }
  if (handleId.includes("n")) { y += dy; h -= dy; }
  return {...s, x, y, w, h};
}

function AnnotatorModal({ src, initialShapes, onSave, onClose }) {
  const canvasRef  = useRef();
  const imgElRef     = useRef();
  const imgHistoryRef = useRef([]); // stack of {src, shapes} snapshots for undo
  const shapesRef  = useRef(initialShapes && initialShapes.length ? JSON.parse(JSON.stringify(initialShapes)) : []);
  const drawingRef = useRef(null);
  const toolRef    = useRef(null);        // null = select mode
  const colorRef   = useRef(ANN_COLORS[0]);
  const selIdxRef  = useRef(-1);
  const dragRef    = useRef(null);        // {mode:"move"|"resize"|"draw", handleId?, startX, startY, origShape}
  const mouseRef   = useRef({x:0,y:0});

  const [tool,     setToolUI]  = useState(null);
  const [color,    setColorUI] = useState(ANN_COLORS[0]);
  const [selIdx,   setSelIdx]  = useState(-1);
  const [count,    setCount]   = useState(0);
  const [ready,    setReady]   = useState(false);
  const [cursor,   setCursor]  = useState("default");
  // Text entry — all in refs so canvas can read them synchronously
  const textActiveRef = useRef(false);
  const textPosRef    = useRef({x:0, y:0});
  const textBufRef    = useRef("");
  const blinkRef      = useRef(null);
  const fontSizeRef   = useRef(16); // S=12 M=16 D=22
  const [textActive,   setTextActive]   = useState(false);
  const [fontSize,     setFontSizeUI]   = useState(16);

  // Crop state
  const cropRef    = useRef(null); // {x,y,w,h} during drag
  const [cropRect, setCropRect]   = useState(null);
  // Image adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast,   setContrast]   = useState(100);
  const [imgScale,   setImgScale]   = useState(100);
  const brightnessRef = useRef(100);
  const contrastRef   = useRef(100);

  const setTool  = t => {
    toolRef.current = t; setToolUI(t);
    selIdxRef.current = -1; setSelIdx(-1);
    if (t !== "crop") { cropRef.current = null; setCropRect(null); }
  };
  const setColor = c => {
    colorRef.current = c; setColorUI(c);
    if (selIdxRef.current >= 0) {
      shapesRef.current = shapesRef.current.map((s,i) => i===selIdxRef.current ? {...s,color:c} : s);
      setCount(n=>n+1); redraw();
    }
  };
  const handleBrightness = v => { brightnessRef.current = v; setBrightness(v); redraw(); };
  const handleContrast   = v => { contrastRef.current   = v; setContrast(v);   redraw(); };

  const setFontSize = sz => {
    fontSizeRef.current = sz; setFontSizeUI(sz);
    if (selIdxRef.current >= 0) {
      const s = shapesRef.current[selIdxRef.current];
      if (s && s.type === "text") {
        shapesRef.current = shapesRef.current.map((sh,i) => i===selIdxRef.current ? {...sh,size:sz} : sh);
        setCount(n=>n+1); redraw();
      }
    }
  };

  function redraw() {
    const canvas = canvasRef.current, img = imgElRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.filter = `brightness(${brightnessRef.current}%) contrast(${contrastRef.current}%)`;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    shapesRef.current.forEach((s,i) => drawShape(ctx, s, i===selIdxRef.current));
    if (drawingRef.current) drawShape(ctx, drawingRef.current, false);
    // Draw crop overlay — four dark rects around selection, keep crop area untouched
    if (cropRef.current) {
      const {x,y,w,h} = cropRef.current;
      const cw = canvas.width, ch = canvas.height;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0,   0,  cw,      y);          // top
      ctx.fillRect(0,   y+h, cw,     ch-(y+h));   // bottom
      ctx.fillRect(0,   y,  x,       h);           // left
      ctx.fillRect(x+w, y,  cw-(x+w), h);          // right
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.setLineDash([5,3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgElRef.current = img;
      const canvas = canvasRef.current; if (!canvas) return;
      const maxW=800, maxH=540, scale=Math.min(maxW/img.naturalWidth, maxH/img.naturalHeight, 1);
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      setReady(true); redraw();
    };
    img.onerror = () => setReady(true);
    img.src = src;
  }, [src]);

  useEffect(() => { if (ready) redraw(); }, [ready, count]);

  function getXY(e) {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const sx = c.width/r.width, sy = c.height/r.height;
    const ev = e.touches ? e.touches[0] : e;
    return { x:(ev.clientX-r.left)*sx, y:(ev.clientY-r.top)*sy };
  }

  function updateCursor(x, y) {
    if (toolRef.current) { setCursor(toolRef.current==="text"?"text":"crosshair"); return; }
    const si = selIdxRef.current;
    if (si >= 0) {
      const h = hitHandle(shapesRef.current[si], x, y);
      if (h) {
        const cursors = {nw:"nw-resize",n:"n-resize",ne:"ne-resize",e:"e-resize",se:"se-resize",s:"s-resize",sw:"sw-resize",w:"w-resize",p1:"move",p2:"move"};
        setCursor(cursors[h]||"move"); return;
      }
      if (hitShape(shapesRef.current[si], x, y)) { setCursor("move"); return; }
    }
    // Check hover over any shape
    for (let i=shapesRef.current.length-1; i>=0; i--) {
      if (hitShape(shapesRef.current[i], x, y)) { setCursor("pointer"); return; }
    }
    setCursor("default");
  }

  function handleMouseDown(e) {
    e.preventDefault();
    const {x,y} = getXY(e);

    // If text is active, clicking anywhere commits it and continues
    if (textActiveRef.current) { commitText(); }

    // TEXT tool — in-canvas entry
    if (toolRef.current === "text") { startTextEntry(x, y); return; }

    // CROP tool
    if (toolRef.current === "crop") {
      cropRef.current = {x, y, w:0, h:0};
      dragRef.current = {mode:"crop_draw", startX:x, startY:y};
      redraw(); return;
    }

    // DRAW tool
    if (toolRef.current === "box" || toolRef.current === "arrow") {
      drawingRef.current = toolRef.current === "box"
        ? {type:"box",   color:colorRef.current, x, y, w:0, h:0}
        : {type:"arrow", color:colorRef.current, x1:x, y1:y, x2:x, y2:y};
      dragRef.current = {mode:"draw"};
      return;
    }

    // SELECT mode
    const si = selIdxRef.current;
    if (si >= 0) {
      const h = hitHandle(shapesRef.current[si], x, y);
      if (h) {
        dragRef.current = {mode:"resize", handleId:h, startX:x, startY:y, origShape:{...shapesRef.current[si]}};
        return;
      }
      if (hitShape(shapesRef.current[si], x, y)) {
        dragRef.current = {mode:"move", startX:x, startY:y, origShape:{...shapesRef.current[si]}};
        return;
      }
    }
    // Try to select a shape (topmost first)
    for (let i=shapesRef.current.length-1; i>=0; i--) {
      if (hitShape(shapesRef.current[i], x, y)) {
        selIdxRef.current = i; setSelIdx(i);
        dragRef.current = {mode:"move", startX:x, startY:y, origShape:{...shapesRef.current[i]}};
        redraw(); return;
      }
    }
    // Click on empty — deselect
    selIdxRef.current = -1; setSelIdx(-1); redraw();
  }

  function handleMouseMove(e) {
    e.preventDefault();
    const {x,y} = getXY(e);
    mouseRef.current = {x,y};
    updateCursor(x,y);
    if (!dragRef.current) return;
    const dr = dragRef.current;

    if (dr.mode === "draw") {
      const d = drawingRef.current;
      if (!d) return;
      drawingRef.current = d.type==="box"
        ? {...d, w:x-d.x, h:y-d.y}
        : {...d, x2:x, y2:y};
      redraw(); return;
    }

    if (dr.mode === "crop_draw") {
      cropRef.current = {
        x: Math.min(dr.startX, x), y: Math.min(dr.startY, y),
        w: Math.abs(x - dr.startX), h: Math.abs(y - dr.startY)
      };
      redraw(); return;
    }

    const dx = x-dr.startX, dy = y-dr.startY;
    const orig = dr.origShape;
    const shapes = [...shapesRef.current];
    const si = selIdxRef.current;

    if (dr.mode === "move") {
      let s = {...orig};
      if (s.type==="box")   s = {...s, x:orig.x+dx, y:orig.y+dy};
      if (s.type==="arrow") s = {...s, x1:orig.x1+dx, y1:orig.y1+dy, x2:orig.x2+dx, y2:orig.y2+dy};
      if (s.type==="text")  s = {...s, x:orig.x+dx, y:orig.y+dy};
      shapes[si] = s;
    } else if (dr.mode === "resize") {
      shapes[si] = orig.type==="box"
        ? resizeBox(orig, dr.handleId, dx, dy)
        : orig.type==="arrow"
          ? {...orig, ...(dr.handleId==="p1"?{x1:orig.x1+dx,y1:orig.y1+dy}:{x2:orig.x2+dx,y2:orig.y2+dy})}
          : orig;
    }
    shapesRef.current = shapes;
    redraw();
  }

  function handleMouseUp(e) {
    if (!dragRef.current) return;
    const dr = dragRef.current;
    if (dr.mode === "draw" && drawingRef.current) {
      shapesRef.current = [...shapesRef.current, drawingRef.current];
      drawingRef.current = null;
      selIdxRef.current = -1; setSelIdx(-1);
      // Return to select mode after placing shape
      toolRef.current = null; setToolUI(null);
      setCount(n=>n+1); redraw();
    } else {
      setCount(n=>n+1);
    }
    dragRef.current = null;
  }

  // ── In-canvas text entry ──
  function startTextEntry(x, y) {
    textActiveRef.current = true;
    textPosRef.current = {x, y};
    textBufRef.current = "";
    setTextActive(true);
    startBlink();
    redrawWithCursor();
  }

  function startBlink() {
    stopBlink();
    blinkRef.current = setInterval(() => { redrawWithCursor(); }, 530);
  }

  function stopBlink() {
    if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null; }
  }

  function redrawWithCursor() {
    redraw();
    if (!textActiveRef.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const {x, y} = textPosRef.current;
    const buf = textBufRef.current;
    const fs = fontSizeRef.current;
    ctx.save();
    ctx.font = `bold ${fs}px -apple-system,Arial,sans-serif`;
    // Draw text directly — no background rect
    if (buf) {
      ctx.fillStyle = colorRef.current;
      ctx.fillText(buf, x, y);
    }
    // Blinking cursor
    const now = Date.now();
    if (Math.floor(now / 530) % 2 === 0) {
      const m = ctx.measureText(buf);
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + m.width + 2, y - fs + 2);
      ctx.lineTo(x + m.width + 2, y + 4);
      ctx.stroke();
    }
    // Dashed outline — just so you know where you're placing
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([4, 3]);
    const pm = ctx.measureText(buf || "|");
    ctx.strokeRect(x - 4, y - fs - 2, Math.max(pm.width + 8, 80), fs + 8);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function handleTextKey(e) {
    if (!textActiveRef.current) return;
    e.preventDefault();
    if (e.key === "Enter") { commitText(); return; }
    if (e.key === "Escape") { cancelText(); return; }
    if (e.key === "Backspace") {
      textBufRef.current = textBufRef.current.slice(0, -1);
    } else if (e.key.length === 1) {
      textBufRef.current += e.key;
    }
    redrawWithCursor();
  }

  function commitText() {
    stopBlink();
    const buf = textBufRef.current.trim();
    if (buf) {
      shapesRef.current = [...shapesRef.current, {
        type:"text", color:colorRef.current,
        x:textPosRef.current.x, y:textPosRef.current.y,
        label:buf, size:fontSizeRef.current
      }];
      setCount(n=>n+1);
    }
    textActiveRef.current = false;
    textBufRef.current = "";
    setTextActive(false);
    toolRef.current = null; setToolUI(null);
    redraw();
  }

  function cancelText() {
    stopBlink();
    textActiveRef.current = false;
    textBufRef.current = "";
    setTextActive(false);
    toolRef.current = null; setToolUI(null);
    redraw();
  }

  function deleteSelected() {
    if (selIdxRef.current < 0) return;
    shapesRef.current = shapesRef.current.filter((_,i)=>i!==selIdxRef.current);
    selIdxRef.current = -1; setSelIdx(-1); setCount(n=>n+1); redraw();
  }

  function pushHistory() {
    // Snapshot current image src + shapes before a destructive op
    const canvas = canvasRef.current; const img = imgElRef.current;
    if (!canvas || !img) return;
    const snap = document.createElement("canvas");
    snap.width = canvas.width; snap.height = canvas.height;
    snap.getContext("2d").drawImage(img, 0, 0);
    imgHistoryRef.current = [...imgHistoryRef.current, {
      src: snap.toDataURL("image/png"),
      shapes: JSON.parse(JSON.stringify(shapesRef.current)),
      canvasW: canvas.width, canvasH: canvas.height,
    }];
  }

  function undo() {
    // If there's an image history entry, pop it (crop/resize undo)
    if (imgHistoryRef.current.length > 0) {
      const prev = imgHistoryRef.current[imgHistoryRef.current.length - 1];
      imgHistoryRef.current = imgHistoryRef.current.slice(0, -1);
      const canvas = canvasRef.current; if (!canvas) return;
      const img = new Image();
      img.onload = () => {
        canvas.width = prev.canvasW; canvas.height = prev.canvasH;
        imgElRef.current = img;
        shapesRef.current = prev.shapes;
        brightnessRef.current = 100; setBrightness(100);
        contrastRef.current   = 100; setContrast(100);
        cropRef.current = null; setCropRect(null);
        toolRef.current = null; setToolUI(null);
        selIdxRef.current = -1; setSelIdx(-1);
        setCount(n=>n+1); redraw();
      };
      img.src = prev.src;
      return;
    }
    // Otherwise undo last annotation shape
    shapesRef.current = shapesRef.current.slice(0,-1);
    selIdxRef.current = -1; setSelIdx(-1); setCount(n=>n+1); redraw();
  }

  function applyCrop() {
    const cr = cropRef.current; if (!cr || cr.w < 4 || cr.h < 4) return;
    const canvas = canvasRef.current; const img = imgElRef.current; if (!canvas||!img) return;
    pushHistory(); // save state before crop so undo can restore it
    // Bake current canvas (with brightness/contrast) into a new image
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    tctx.filter = `brightness(${brightnessRef.current}%) contrast(${contrastRef.current}%)`;
    tctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    tctx.filter = "none";
    // Crop region
    const crop = document.createElement("canvas");
    crop.width = cr.w; crop.height = cr.h;
    crop.getContext("2d").drawImage(tmp, cr.x, cr.y, cr.w, cr.h, 0, 0, cr.w, cr.h);
    // Rebuild — new canvas size, shapes offset
    canvas.width = cr.w; canvas.height = cr.h;
    const newImg = new Image();
    newImg.onload = () => {
      imgElRef.current = newImg;
      brightnessRef.current = 100; setBrightness(100);
      contrastRef.current   = 100; setContrast(100);
      // Offset all shapes by crop origin
      shapesRef.current = shapesRef.current.map(s => {
        if (s.type==="box")   return {...s, x:s.x-cr.x, y:s.y-cr.y};
        if (s.type==="arrow") return {...s, x1:s.x1-cr.x, y1:s.y1-cr.y, x2:s.x2-cr.x, y2:s.y2-cr.y};
        if (s.type==="text")  return {...s, x:s.x-cr.x, y:s.y-cr.y};
        return s;
      });
      cropRef.current = null; setCropRect(null);
      toolRef.current = null; setToolUI(null);
      setCount(n=>n+1); redraw();
    };
    newImg.src = crop.toDataURL("image/png");
  }

  function applyResize(pct) {
    const canvas = canvasRef.current; const img = imgElRef.current; if (!canvas||!img) return;
    pushHistory(); // save state before resize
    const newW = Math.round(canvas.width * pct / 100);
    const newH = Math.round(canvas.height * pct / 100);
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = document.createElement("canvas");
    out.width = newW; out.height = newH;
    out.getContext("2d").drawImage(tmp, 0, 0, canvas.width, canvas.height, 0, 0, newW, newH);
    canvas.width = newW; canvas.height = newH;
    const newImg = new Image();
    newImg.onload = () => {
      imgElRef.current = newImg;
      shapesRef.current = shapesRef.current.map(s => {
        const r = pct/100;
        if (s.type==="box")   return {...s, x:s.x*r, y:s.y*r, w:s.w*r, h:s.h*r};
        if (s.type==="arrow") return {...s, x1:s.x1*r, y1:s.y1*r, x2:s.x2*r, y2:s.y2*r};
        if (s.type==="text")  return {...s, x:s.x*r, y:s.y*r};
        return s;
      });
      setCount(n=>n+1); redraw();
    };
    newImg.src = out.toDataURL("image/png");
  }

  function handleSave() {
    selIdxRef.current = -1; setSelIdx(-1);
    redraw();
    setTimeout(() => {
      const canvas = canvasRef.current; if (!canvas) return;
      onSave(canvas.toDataURL("image/png"), shapesRef.current);
    }, 30);
  }

  function handleKeyDown(e) {
    if (textActiveRef.current) { handleTextKey(e); return; }
    if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
    if (e.key === "Escape") { selIdxRef.current=-1; setSelIdx(-1); toolRef.current=null; setToolUI(null); redraw(); }
  }

  const hints = {
    null:  selIdx>=0 ? "Drag to move · Drag handles to resize · Delete/Backspace to remove · Click empty to deselect" : "Click a shape to select it",
    box:   "Drag to draw rectangle — releases to select mode",
    arrow: "Drag to draw arrow — releases to select mode",
    text:  "Click to place — type freely · Enter or click elsewhere to commit · Esc to cancel",
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div style={{background:WHITE,borderRadius:12,display:"flex",flexDirection:"column",maxWidth:860,width:"100%",maxHeight:"95vh",overflow:"hidden"}}>

        {/* Toolbar */}
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"8px 12px",borderBottom:`1px solid ${LINE}`,flexWrap:"wrap",flexShrink:0}}>
          {/* Select */}
          <button onClick={() => setTool(null)}
            style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${tool===null?NAVY:LINE}`,background:tool===null?NAVY:WHITE,color:tool===null?WHITE:NAVY,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            ↖ Select
          </button>
          <div style={{width:1,height:20,background:LINE}}/>
          {["box","arrow","text"].map(t=>(
            <button key={t} onClick={() => setTool(t)}
              style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${tool===t?NAVY:LINE}`,background:tool===t?NAVY:WHITE,color:tool===t?WHITE:NAVY,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {t==="box"?"□ Box":t==="arrow"?"→ Arrow":"T Text"}
            </button>
          ))}
          <div style={{width:1,height:20,background:LINE}}/>
          {ANN_COLORS.map(c=>(
            <button key={c} onClick={() => setColor(c)}
              style={{width:20,height:20,borderRadius:"50%",background:c,border:color===c?"3px solid #1B2A4A":"2px solid #e5e7eb",cursor:"pointer",flexShrink:0,padding:0}}
              title="Apply color to selected or next shape"/>
          ))}
          <div style={{width:1,height:20,background:LINE}}/>
          {/* Font size — only relevant for text tool or selected text */}
          {([12,16,22]).map((sz,i) => (
            <button key={sz} onClick={() => setFontSize(sz)}
              style={{padding:"3px 8px",borderRadius:5,border:`1.5px solid ${fontSize===sz?NAVY:LINE}`,background:fontSize===sz?NAVY:WHITE,color:fontSize===sz?WHITE:NAVY,fontSize:sz===12?9:sz===16?11:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>
              {sz===12?"S":sz===16?"M":"L"}
            </button>
          ))}
          <div style={{width:1,height:20,background:LINE}}/>
          <button onClick={() => setTool("crop")}
            style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${tool==="crop"?NAVY:LINE}`,background:tool==="crop"?NAVY:WHITE,color:tool==="crop"?WHITE:NAVY,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            ✂ Crop
          </button>
          {tool==="crop" && cropRef.current?.w > 4 && (
            <button onClick={applyCrop}
              style={{padding:"4px 10px",borderRadius:6,border:"none",background:GREEN,color:WHITE,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              ✓ Apply crop
            </button>
          )}
          <div style={{flex:1}}/>
          {selIdx>=0 && (
            <button onClick={deleteSelected}
              style={{padding:"4px 9px",borderRadius:6,border:"1.5px solid #fca5a5",background:WHITE,color:RED,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              🗑 Delete
            </button>
          )}
          <button onClick={undo} disabled={shapesRef.current.length===0 && imgHistoryRef.current.length===0}
            style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${LINE}`,background:WHITE,fontSize:11,cursor:shapesRef.current.length?"pointer":"not-allowed",color:shapesRef.current.length?NAVY:MUTED,fontFamily:"inherit"}}>
            ↩ Undo ({imgHistoryRef.current.length + shapesRef.current.length})
          </button>
          <button onClick={handleSave}
            style={{padding:"5px 13px",borderRadius:6,border:"none",background:AG,color:NAVY,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            ✓ Save
          </button>
          <button onClick={onClose}
            style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${LINE}`,background:WHITE,fontSize:11,cursor:"pointer",fontFamily:"inherit",color:MUTED}}>
            ✕ Close
          </button>
        </div>

        {/* Adjustments row */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px",borderBottom:`1px solid ${LINE}`,flexWrap:"wrap",flexShrink:0,background:"#f9fafb"}}>
          <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:".06em"}}>Adjust</span>
          <label style={{fontSize:10,color:MUTED,display:"flex",alignItems:"center",gap:5}}>
            ☀ Brightness
            <input type="range" min={50} max={200} step={1} value={brightness}
              onChange={e => handleBrightness(Number(e.target.value))}
              style={{width:80,accentColor:NAVY}}/>
            <span style={{fontSize:10,minWidth:28}}>{brightness}%</span>
          </label>
          <label style={{fontSize:10,color:MUTED,display:"flex",alignItems:"center",gap:5}}>
            ◑ Contrast
            <input type="range" min={50} max={200} step={1} value={contrast}
              onChange={e => handleContrast(Number(e.target.value))}
              style={{width:80,accentColor:NAVY}}/>
            <span style={{fontSize:10,minWidth:28}}>{contrast}%</span>
          </label>
          <label style={{fontSize:10,color:MUTED,display:"flex",alignItems:"center",gap:5}}>
            ⊞ Resize
          </label>
          {[75,50,25].map(pct => (
            <button key={pct} onClick={() => applyResize(pct)}
              style={{padding:"2px 7px",borderRadius:5,border:`1px solid ${LINE}`,background:WHITE,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:NAVY}}>
              {pct}%
            </button>
          ))}
          <button onClick={() => { brightnessRef.current=100; setBrightness(100); contrastRef.current=100; setContrast(100); redraw(); }}
            style={{padding:"2px 7px",borderRadius:5,border:`1px solid ${LINE}`,background:WHITE,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:MUTED}}>
            Reset
          </button>
        </div>

        {/* Canvas */}
        <div style={{flex:1,overflow:"auto",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",padding:16,position:"relative"}}>
          {!ready && <div style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading image…</div>}
          <canvas ref={canvasRef}
            style={{display:ready?"block":"none",maxWidth:"100%",cursor,borderRadius:4,userSelect:"none",outline:"none"}}
            tabIndex={0}
            onMouseDown={e => { canvasRef.current?.focus(); handleMouseDown(e); }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            onKeyDown={e => { e.stopPropagation(); handleKeyDown(e); }}/>
          {textActive && (
            <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",background:"rgba(27,42,74,.9)",color:"#fff",fontSize:10,padding:"4px 12px",borderRadius:20,pointerEvents:"none",whiteSpace:"nowrap"}}>
              Typing… Enter to place · Esc to cancel
            </div>
          )}
        </div>

        <div style={{padding:"6px 12px",borderTop:`1px solid ${LINE}`,fontSize:10,color:MUTED,flexShrink:0}}>
          {hints[tool]}
        </div>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

// ── STEP IMAGE — handles broken URLs gracefully ──
function StepImage({ image, imageBase, imageShapes, imageAlt, onUpd, imgRef }) {
  const [broken, setBroken] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  useEffect(() => { setBroken(false); }, [image]);

  if (!image) return (
    <button onClick={() => imgRef.current.click()}
      style={{ width: "100%", padding: "7px", border: `1.5px dashed ${LINE}`, borderRadius: 7, background: "#fafafa", fontSize: 11, color: MUTED, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUTED; }}>
      📷 Upload step image
    </button>
  );
  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      {annotating && (
        <AnnotatorModal src={image}
          initialShapes={imageShapes || []}
          onSave={(dataUrl, shapes) => { onUpd({ image: dataUrl, imageShapes: shapes }); setAnnotating(false); setBroken(false); }}
          onClose={() => setAnnotating(false)} />
      )}
      {broken ? (
        <div style={{ width: "100%", height: 80, borderRadius: 6, border: `1.5px dashed ${LINE}`, background: "#fef2f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <div style={{ fontSize: 18 }}>🖼️</div>
          <div style={{ fontSize: 11, color: RED }}>Image failed to load</div>
          <button onClick={() => imgRef.current.click()} style={{ fontSize: 10, color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Replace with upload</button>
        </div>
      ) : (
        <img src={image} alt={imageAlt}
          style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 6, border: `1px solid ${LINE}`, display: "block", background: "#f9fafb" }}
          onError={() => setBroken(true)} />
      )}
      <div style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 3 }}>
        {!broken && <button onClick={() => setAnnotating(true)} style={{ background: "rgba(99,102,241,.9)", color: WHITE, border: "none", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>✏️ Annotate</button>}
        <button onClick={() => imgRef.current.click()} style={{ background: "rgba(27,42,74,.85)", color: WHITE, border: "none", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>↻ Replace</button>
        <button onClick={() => onUpd({ image: null, imageAlt: "" })} style={{ background: "rgba(220,38,38,.85)", color: WHITE, border: "none", borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>✕</button>
      </div>
      <Inp value={imageAlt} onChange={v => onUpd({ imageAlt: v })} placeholder="Image alt text…" full style={{ marginTop: 5, fontSize: 11 }} />
    </div>
  );
}

// ── NOTE CARD ──
const NOTE_AMBER = "#92400e";
const NOTE_BG = "#fffbeb";
const NOTE_BORDER = "#fde68a";

function NoteCard({ note, index, total, onUpd, onDelete, onMoveUp, onMoveDown, dragHandlers }) {
  return (
    <div
      draggable
      onDragStart={dragHandlers.onDragStart(index)}
      onDragOver={dragHandlers.onDragOver(index)}
      onDrop={dragHandlers.onDrop}
      onDragEnd={dragHandlers.onDragEnd}
      style={{ border: `1.5px solid ${NOTE_BORDER}`, borderRadius: 10, marginBottom: 8, background: NOTE_BG, overflow: "hidden", cursor: "grab" }}>
      <div style={{ background: "#fef3c7", borderBottom: `1px solid ${NOTE_BORDER}`, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12 }}>⋮⋮</span>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F5A623", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: NAVY, flexShrink: 0 }}>{index + 1}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: NOTE_AMBER, flex: 1 }}>Note {index + 1}</span>
        <button onClick={onMoveUp} disabled={index === 0} style={{ background: "none", border: `1px solid ${NOTE_BORDER}`, borderRadius: 4, padding: "2px 6px", cursor: index === 0 ? "not-allowed" : "pointer", color: NOTE_AMBER, fontSize: 11, opacity: index === 0 ? .4 : 1 }}>↑</button>
        <button onClick={onMoveDown} disabled={index === total - 1} style={{ background: "none", border: `1px solid ${NOTE_BORDER}`, borderRadius: 4, padding: "2px 6px", cursor: index === total - 1 ? "not-allowed" : "pointer", color: NOTE_AMBER, fontSize: 11, opacity: index === total - 1 ? .4 : 1 }}>↓</button>
        <button onClick={onDelete} style={{ background: "none", border: "1.5px solid #fca5a5", borderRadius: 4, padding: "2px 7px", cursor: "pointer", color: RED, fontSize: 11 }}>✕</button>
      </div>
      <div style={{ padding: "9px 10px" }}>
        <Ta value={note.text} onChange={v => onUpd({ text: v })}
          placeholder="Add a note, exception, or callout for this article…" rows={2}
          style={{ background: NOTE_BG, borderColor: NOTE_BORDER }} />
      </div>
    </div>
  );
}

// ── DRAG HELPERS — generic list reorder ──
function useDrag(items, setItems) {
  const dragIdx = useRef(null);
  return {
    onDragStart: i => e => { dragIdx.current = i; e.dataTransfer.effectAllowed = "move"; },
    onDragOver: i => e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
    onDrop: e => {
      e.preventDefault();
      if (dragIdx.current === null) return;
      const arr = [...items];
      const [moved] = arr.splice(dragIdx.current, 1);
      const target = Number(e.currentTarget.dataset?.idx ?? dragIdx.current);
      arr.splice(target, 0, moved);
      setItems(arr);
      dragIdx.current = null;
    },
    onDragEnd: () => { dragIdx.current = null; },
  };
}

// ── STEP TEXT EDITOR — textarea + live bold preview ──
const BOLD_COLOR = "#0f6e56"; // teal-800 — distinct from navy body text

function renderBold(text) {
  // Split on **tokens**, render each segment
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: BOLD_COLOR, fontWeight: 700 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

function StepTextEditor({ text, onChange }) {
  const [editing, setEditing] = useState(false);
  const taRef = useRef();

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [editing]);

  const hasBold = text.includes("**");
  const isEmpty = !text.trim();

  return (
    <div style={{ marginBottom: 6 }}>
      {editing ? (
        <Ta ref={taRef} value={text} onChange={onChange}
          placeholder="Step — Describe the action. Wrap **button names** and **action verbs** in double asterisks."
          rows={2}
          onBlur={() => setEditing(false)}
          style={{ marginBottom: 0 }} />
      ) : (
        <div onClick={() => setEditing(true)}
          style={{ padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${LINE}`, fontSize: 12, lineHeight: 1.65, cursor: "text", background: isEmpty ? "#fafafa" : WHITE, color: isEmpty ? MUTED : NAVY, minHeight: 38 }}>
          {isEmpty
            ? "Step — Describe the action. Wrap **button names** and **action verbs** in double asterisks."
            : renderBold(text)}
        </div>
      )}
      {!editing && hasBold && (
        <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
          <span style={{ color: BOLD_COLOR, fontWeight: 700 }}>■</span> Bold tokens highlighted — click to edit
        </div>
      )}
    </div>
  );
}

// ── STEP CARD ──
function StepCard({ step, index, total, onUpd, onDelete, onMoveUp, onMoveDown, dragHandlers }) {
  const [aiLoad, setAiLoad] = useState(false);
  const imgRef = useRef();

  const improve = async () => {
    if (!step.text.trim()) return;
    setAiLoad(true);
    await callAI(
      `Rewrite this OCC Knowledge Base step following these exact rules:

1. Start with the word "Step" (plain, no asterisks)
2. Wrap EVERY action verb in **double asterisks**: Click, Select, Enable, Toggle, Enter, Navigate, Open, Save, Upload, Assign, etc.
3. Wrap EVERY UI element name in **double asterisks**: button names, toggle names, field names, tab names, menu items, section names
4. Keep to 1–2 clean sentences. Remove filler phrases like "In this step", "You will", "Please", "Now you can"
5. No notes, warnings, or caveats — those belong in SOPs not KB articles
6. Output ONLY the rewritten step text — no labels, no preamble, nothing else

Step to rewrite: "${step.text.replace(/\*\*/g, '')}"`,
      t => onUpd({ text: t }),
      t => { onUpd({ text: t }); setAiLoad(false); },
      () => setAiLoad(false)
    );
  };

  const handleImg = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onUpd({ image: ev.target.result, imageBase: ev.target.result, imageShapes: [], imageAlt: "" });
    reader.readAsDataURL(file); e.target.value = "";
  };

  return (
    <div
      draggable
      onDragStart={dragHandlers?.onDragStart(index)}
      onDragOver={dragHandlers?.onDragOver(index)}
      onDrop={dragHandlers?.onDrop}
      onDragEnd={dragHandlers?.onDragEnd}
      style={{ border: `1.5px solid ${LINE}`, borderRadius: 10, marginBottom: 9, background: WHITE, overflow: "hidden", cursor: "grab" }}>
      <div style={{ background: "#f9fafb", borderBottom: `1px solid ${LINE}`, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: MUTED }}>⋮⋮</span>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: AG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: NAVY, flexShrink: 0 }}>{index + 1}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, flex: 1 }}>Step {index + 1}</span>
        <button onClick={onMoveUp} disabled={index === 0} style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 4, padding: "2px 6px", cursor: index === 0 ? "not-allowed" : "pointer", color: MUTED, fontSize: 11, opacity: index === 0 ? .4 : 1 }}>↑</button>
        <button onClick={onMoveDown} disabled={index === total - 1} style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 4, padding: "2px 6px", cursor: index === total - 1 ? "not-allowed" : "pointer", color: MUTED, fontSize: 11, opacity: index === total - 1 ? .4 : 1 }}>↓</button>
        <button onClick={improve} disabled={aiLoad}
          style={{padding:"4px 9px",borderRadius:6,border:"1px solid #bfdbfe",background:aiLoad?"#f8fafc":"#eff6ff",color:aiLoad?MUTED:"#1d4ed8",fontSize:10,fontWeight:600,cursor:aiLoad?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {aiLoad ? "…" : "Improve"}
        </button>
        <button onClick={onDelete} style={{ background: "none", border: `1px solid #fca5a5`, borderRadius: 4, padding: "2px 7px", cursor: "pointer", color: RED, fontSize: 11 }}>✕</button>
      </div>
      <div style={{ padding: "9px 10px" }}>
        <StepTextEditor text={step.text} onChange={v => onUpd({ text: v })} />
        <StepImage image={step.image} imageBase={step.imageBase || step.image} imageShapes={step.imageShapes || []} imageAlt={step.imageAlt || ""} onUpd={onUpd} imgRef={imgRef} />
        <input type="file" ref={imgRef} accept="image/*" style={{ display: "none" }} onChange={handleImg} />
      </div>
    </div>
  );
}

// ── CONTENT EDITOR ──
function ClearModal({ onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:WHITE, borderRadius:14, padding:32, maxWidth:380, width:"100%", textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,.25)" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:16, fontWeight:700, color:NAVY, marginBottom:10 }}>Clear everything?</div>
            <div style={{ fontSize:13, color:MUTED, lineHeight:1.7, marginBottom:24 }}>
              This will reset the title, subtitle, category, subcategory, audience, intro, <strong>all steps</strong>, tags, and the Scribe source back to a blank slate.
              <br/><br/>
              <span style={{ color:GREEN, fontWeight:600 }}>✓ Your saved drafts are not affected.</span>
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setOpen(false)}
                style={{ padding:"9px 24px", borderRadius:8, border:`1.5px solid ${LINE}`, background:WHITE, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#374151" }}>
                Cancel
              </button>
              <button onClick={() => { setOpen(false); onConfirm(); }}
                style={{ padding:"9px 24px", borderRadius:8, border:"none", background:RED, color:WHITE, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Yes, clear everything
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${LINE}`, display:"flex", justifyContent:"flex-end" }}>
        <button onClick={() => setOpen(true)}
          style={{ padding:"7px 16px", borderRadius:7, border:`1.5px solid #fca5a5`, background:WHITE, color:RED, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
          onMouseEnter={e => e.currentTarget.style.background="#fef2f2"}
          onMouseLeave={e => e.currentTarget.style.background=WHITE}>
          Clear form
        </button>
      </div>
    </>
  );
}

function ContentEditor({ draft, upd, resetDraft, drafts, onSelectDraft, onNewDraft }) {
  const [introLoad, setIntroLoad]     = useState(false);
  const [subtitleLoad, setSubtitleLoad] = useState(false);
  const [tagLoad, setTagLoad] = useState(false);
  const [extractLoad, setExtractLoad] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [assignImg, setAssignImg] = useState(null);

  const addStep = () => upd({ steps: [...(draft.steps || []), { id: Date.now(), text: "", image: null, imageBase: null, imageShapes: [], imageAlt: "" }] });
  const updStep = (id, p) => upd({ steps: (draft.steps || []).map(s => s.id === id ? { ...s, ...p } : s) });
  const delStep = id => upd({ steps: (draft.steps || []).filter(s => s.id !== id) });
  const moveStep = (i, dir) => {
    const a = [...(draft.steps || [])]; const n = i + dir;
    if (n < 0 || n >= a.length) return; [a[i], a[n]] = [a[n], a[i]]; upd({ steps: a });
  };
  const assignToStep = (stepId, src) => updStep(stepId, { image: src, imageBase: src, imageShapes: [], imageAlt: "" });
  const stepDrag = useDrag(draft.steps || [], steps => upd({ steps }));



  const genIntro = async () => {
    setIntroLoad(true);
    const stepsText = (draft.steps || []).filter(s => s.text.trim()).map((s, i) => `${i + 1}. ${s.text}`).join("\n") || "";
    await callAI(
      `Write a 2–4 sentence introduction for an OCC Knowledge Base article.
Cover: what the article is about, who it's for (${(draft.audience || []).join(", ") || "general users"}), and what they'll achieve.
Title: "${draft.title || "Untitled"}"
Category: ${draft.category || "General"}
${stepsText ? "Steps overview:\n" + stepsText : ""}
${draft.rawHtml ? "Source context:\n" + draft.rawHtml.slice(0, 1200) : ""}
Output only the intro paragraph(s), no headings or labels.`,
      t => upd({ intro: t }),
      t => { upd({ intro: t }); setIntroLoad(false); },
      () => setIntroLoad(false)
    );
  };

  const genSubtitle = async () => {
    if (!draft.title.trim()) return;
    setSubtitleLoad(true);
    await callAI(
      `Write a single concise subtitle (1 sentence, max 15 words) for this OCC Knowledge Base article.
Title: "${draft.title}"
Output only the subtitle text, nothing else.`,
      t => upd({ subtitle: t }),
      t => { upd({ subtitle: t }); setSubtitleLoad(false); },
      () => setSubtitleLoad(false)
    );
  };

  const genTags = async () => {
    setTagLoad(true);
    await callAI(
      `Generate 5–8 concise search tags for this OCC KB article.
Title: "${draft.title}"
Category: ${draft.category || ""}
Intro: ${(draft.intro || "").slice(0, 300)}
Return ONLY a JSON array of lowercase strings. No markdown fences, no preamble.
Example: ["user management","roles","admin","invite"]`,
      () => {},
      t => {
        setTagLoad(false);
        try {
          const a = JSON.parse(t.replace(/```json/g, "").replace(/```/g, "").trim());
          if (Array.isArray(a)) upd({ tags: [...new Set([...(draft.tags || []), ...a])] });
        } catch {}
      },
      () => setTagLoad(false)
    );
  };

  const extractSteps = async () => {
    if (!draft.rawHtml?.trim()) return;
    setExtractLoad(true);

    // AI extraction for HTML or Markdown
    await callAI(
      `You are extracting steps from a Scribe HTML export for an OCC Knowledge Base article.
Return a JSON array of step objects. Each object: { "text": "...", "imageAlt": "..." }

Rules for "text":
- Start with the word Step (no bold markers on it)
- Wrap EVERY button name, field name, toggle name, menu item, and section name in **double asterisks**
- Wrap EVERY action verb (Click, Select, Enable, Toggle, Enter, Navigate, Open, Save, etc.) in **double asterisks**
- One clear sentence describing what the user does — 1–2 sentences max
- No filler like "In this step" or "You will now" — start with the action
- No Scribe branding, nav text, watermarks, or generic headers

Rules for "imageAlt": brief description of what the screenshot shows, or empty string if none.

Strip all Scribe branding, nav, headers, footers from the content.

HTML:
${draft.rawHtml.slice(0, 7000)}

Return ONLY a valid JSON array, no preamble, no markdown fences.`,
      () => {},
      t => {
        setExtractLoad(false);
        try {
          const startIdx = t.indexOf("[");
          const endIdx = t.lastIndexOf("]");
          if (startIdx === -1 || endIdx === -1) { console.error("No JSON array found in response:", JSON.stringify(t.slice(0,50))); return; }
          const jsonStr = t.slice(startIdx, endIdx + 1);
          const a = JSON.parse(jsonStr);
          if (Array.isArray(a) && a.length) upd({ steps: a.map((s, i) => ({ id: Date.now() + i, text: s.text || "", image: null, imageBase: null, imageShapes: [], imageAlt: s.imageAlt || "" })) });
        } catch(e) { console.error("Extract parse error:", e); }
      },
      () => setExtractLoad(false)
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {assignImg && <ImgModal image={assignImg} steps={draft.steps || []} onAssign={assignToStep} onClose={() => setAssignImg(null)} />}

      {/* Drafts bar */}
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "#fafafa" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>Drafts</span>
        <div style={{ flex: 1, display: "flex", gap: 5, overflowX: "auto" }}>
          {drafts.map(d => (
            <button key={d.id} onClick={() => onSelectDraft(d)}
              style={{ padding: "3px 10px", borderRadius: 20, border: `1.5px solid ${d.id === draft.id ? GOLD : LINE}`, background: d.id === draft.id ? LIGHT : WHITE, color: d.id === draft.id ? NAVY : MUTED, fontSize: 11, fontWeight: d.id === draft.id ? 700 : 400, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
              {d.title || "Untitled"}
            </button>
          ))}
        </div>
        <button onClick={onNewDraft}
          style={{ padding: "3px 10px", borderRadius: 20, border: `1.5px dashed ${LINE}`, background: "none", fontSize: 11, color: MUTED, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUTED; }}>
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 13px" }}>
        {/* Article header fields */}
        <div style={{ marginBottom: 12, padding: "12px 12px", background: "#f9fafb", borderRadius: 9, border: `1px solid ${LINE}` }}>
          <SL mt={0}>Article title *</SL>
          <Inp value={draft.title} onChange={v => upd({ title: v })} placeholder="e.g. How to view all Signed Documents" full style={{ marginBottom: 8 }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <SL mt={0}>Subtitle</SL>
            <AIBtn onClick={genSubtitle} loading={subtitleLoad} label="AI subtitle" />
          </div>
          <Inp value={draft.subtitle || ""} onChange={v => upd({ subtitle: v })} placeholder="One-line summary shown under the title" full style={{ marginBottom: 8 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <SL mt={0}>Category</SL>
              <Inp value={draft.category || ""} onChange={v => upd({ category: v })} placeholder="e.g. Estimating" full />
            </div>
            <div>
              <SL mt={0}>Subcategory</SL>
              <Inp value={draft.subcategory || ""} onChange={v => upd({ subcategory: v })} placeholder="e.g. Templates" full />
            </div>
            <div>
              <SL mt={0}>Audience</SL>
              <AudChips sel={draft.audience || []} onChange={v => upd({ audience: v })} />
            </div>
            <div>
              <SL mt={0}>Last reviewed</SL>
              <Inp type="date" value={draft.lastReviewed || ""} onChange={v => upd({ lastReviewed: v })} full />
            </div>
          </div>
        </div>

        {/* Intro */}
        <div style={{ marginBottom: 12, padding: "10px 11px", background: "#f9fafb", borderRadius: 9, border: `1px solid ${LINE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <SL mt={0}>Article introduction</SL>
            <AIBtn onClick={genIntro} loading={introLoad} label="Draft intro" />
          </div>
          <Ta value={draft.intro || ""} onChange={v => upd({ intro: v })}
            placeholder="Write or AI-generate the article intro — shown as the opening paragraph in the final article." rows={4} />
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>Steps</div>
          </div>
          {(draft.steps || []).length === 0 && (
            <div style={{ textAlign: "center", padding: "20px 0", color: MUTED, fontSize: 12, border: `1.5px dashed ${LINE}`, borderRadius: 9 }}>
              No steps — add one or extract from Scribe HTML
            </div>
          )}
          {(draft.steps || []).map((step, i) => (
            <StepCard key={step.id} step={step} index={i} total={(draft.steps || []).length}
              onUpd={p => updStep(step.id, p)} onDelete={() => delStep(step.id)}
              onMoveUp={() => moveStep(i, -1)} onMoveDown={() => moveStep(i, 1)}
              dragHandlers={stepDrag} />
          ))}
          {(draft.steps || []).length > 0 && (
            <button onClick={addStep}
              style={{ width: "100%", padding: "8px", border: "none", borderRadius: 8, background: GOLD, color: NAVY, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 2 }}
              onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              + Add another step
            </button>
          )}
        </div>

        {/* Tags */}
        <div style={{ padding: "10px 11px", background: "#f9fafb", borderRadius: 9, border: `1px solid ${LINE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <SL mt={0}>Tags</SL>
            <button onClick={genTags} disabled={tagLoad}
              style={{padding:"4px 10px",borderRadius:6,border:"1px solid #bfdbfe",background:tagLoad?"#f8fafc":"#eff6ff",color:tagLoad?MUTED:"#1d4ed8",fontSize:11,fontWeight:600,cursor:tagLoad?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {tagLoad ? "Generating…" : "Generate tags"}
            </button>
          </div>
          <div style={{ marginBottom: 6 }}>
            {(draft.tags || []).map((t, i) => <Chip key={i} label={t} onRemove={() => upd({ tags: (draft.tags || []).filter((_, j) => j !== i) })} />)}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <Inp value={tagInput} onChange={setTagInput} placeholder="Add tag…" full
              onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { upd({ tags: [...(draft.tags || []), tagInput.trim().toLowerCase()] }); setTagInput(""); } }}
              style={{ flex: 1, width: "auto" }} />
            <button onClick={() => { if (tagInput.trim()) { upd({ tags: [...(draft.tags || []), tagInput.trim().toLowerCase()] }); setTagInput(""); } }}
              style={{ padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${LINE}`, background: WHITE, fontSize: 12, cursor: "pointer" }}>+</button>
          </div>
        </div>

        {/* Scribe HTML — right after tags, collapsible */}
        <ScribeSource rawHtml={draft.rawHtml || ""} onChange={v => upd({ rawHtml: v })} onExtract={extractSteps} extractLoad={extractLoad} />

        {/* Clear form */}
        <ClearModal onConfirm={() => resetDraft()} />
      </div>


    </div>
  );
}

// ── REVIEW PANEL ──
function ReviewPanel({ draft, completed, onSaveCompleted, onDeleteCompleted }) {
  const [html, setHtml] = useState(null);
  const [tab, setTab] = useState("preview");
  const [copied, setCopied] = useState(false);
  const [selLib, setSelLib] = useState(null);

  const update = () => setHtml(buildHTML(draft));
  const copy = () => {
    if (!html) return;
    navigator.clipboard?.writeText(html).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  const save = () => {
    if (!html) return;
    const art = { id: Date.now(), savedAt: new Date().toISOString(), title: draft.title || "Untitled", htmlContent: html, tags: draft.tags || [] };
    onSaveCompleted(art); setTab("library"); setSelLib(art.id);
  };
  const exportWord = () => {
    if (!html) return;
    const name = (draft.title || "KB-Article").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
    const bodyM  = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const styleM = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const body   = bodyM  ? bodyM[1]  : html;
    const styles = styleM ? `<style>${styleM[1]}</style>` : "";
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${draft.title || "KB Article"}</title>${styles}</head><body>${body}</body></html>`;
    const blob = new Blob(["\ufeff", doc], { type: "application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${name}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportFiles = async () => {
    if (!html) return;
    const name = (draft.title || "KB-Article").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

    // Helper: flatten imageBase + shapes onto a canvas and return a PNG data URL
    const flattenStep = (s) => new Promise(resolve => {
      const base = s.imageBase || s.image;
      if (!base) { resolve(null); return; }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        // Redraw all annotation shapes at full resolution
        (s.imageShapes || []).forEach(shape => {
          ctx.save();
          ctx.strokeStyle = shape.color; ctx.fillStyle = shape.color;
          const scale = img.naturalWidth / (s._canvasW || img.naturalWidth); // scale shapes to full res
          ctx.scale(scale, scale);
          ctx.lineWidth = 3 / scale; ctx.lineCap = "round"; ctx.lineJoin = "round";
          if (shape.type === "box") {
            ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
          } else if (shape.type === "arrow") {
            const dx = shape.x2-shape.x1, dy = shape.y2-shape.y1;
            const len = Math.hypot(dx, dy); if (len < 2) { ctx.restore(); return; }
            const angle = Math.atan2(dy, dx), hw = Math.max(10, Math.min(20, len*0.25));
            ctx.beginPath(); ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(shape.x2, shape.y2);
            ctx.lineTo(shape.x2 - hw*Math.cos(angle-0.45), shape.y2 - hw*Math.sin(angle-0.45));
            ctx.lineTo(shape.x2 - hw*Math.cos(angle+0.45), shape.y2 - hw*Math.sin(angle+0.45));
            ctx.closePath(); ctx.fill();
          } else if (shape.type === "text") {
            const fs = (shape.size || 16) / scale;
            ctx.font = `bold ${fs}px -apple-system,Arial,sans-serif`;
            const m = ctx.measureText(shape.label);
            ctx.fillStyle = shape.color;
            ctx.fillText(shape.label, shape.x, shape.y);
          }
          ctx.restore();
        });
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(s.image); // fallback to whatever we have
      img.src = base;
    });

    // Download HTML
    const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    // Flatten and download each step image
    for (let i = 0; i < (draft.steps || []).length; i++) {
      const s = draft.steps[i];
      if (!s.imageBase && !s.image) continue;
      const dataUrl = await flattenStep(s);
      if (!dataUrl) continue;
      const ia = document.createElement("a");
      ia.href = dataUrl; ia.download = `${name}_step-${i + 1}.png`;
      document.body.appendChild(ia); ia.click(); document.body.removeChild(ia);
      await new Promise(r => setTimeout(r, 80)); // small gap so browser doesn't throttle
    }
  };

  const Tab = ({ t, label }) => (
    <button onClick={() => setTab(t)}
      style={{ padding: "7px 10px", border: "none", background: "none", borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === t ? GOLD : MUTED, fontSize: 11, fontWeight: tab === t ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ background: WHITE, borderBottom: `1px solid ${LINE}`, padding: "0 8px", display: "flex", alignItems: "center", flexShrink: 0, flexWrap: "wrap", gap: 2 }}>
        <Tab t="preview" label="Preview" />
        <Tab t="html" label="HTML" />
        <Tab t="library" label={`Library (${completed.length})`} />
        <Tab t="notes" label="📝 My Notes" />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4, padding: "5px 0", flexWrap: "wrap" }}>
          <Btn onClick={update} variant="navy">↻ Update</Btn>
          {html && <Btn onClick={copy} variant="gold">{copied ? "✓ Copied" : "📋 Copy HTML"}</Btn>}
          {html && <Btn onClick={exportFiles} variant="ghost">⬇ Export ZIP</Btn>}
          {html && <Btn onClick={exportWord} variant="ghost">⬇ Word</Btn>}
        </div>
      </div>

      {tab === "preview" && (
        <div style={{ flex: 1, background: "#f0f2f5", overflow: "hidden" }}>
          {!html ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: MUTED }}>
              <div style={{ fontSize: 36 }}>👁</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Hit ↻ Update to generate preview</div>
              <div style={{ fontSize: 11 }}>Fill in the article fields first</div>
            </div>
          ) : (
            <iframe srcDoc={html} style={{ width: "100%", height: "100%", border: "none" }} title="KB Preview" />
          )}
        </div>
      )}

      {tab === "html" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {!html ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 12 }}>Hit ↻ Update first</div>
          ) : (
            <textarea value={html} onChange={e => setHtml(e.target.value)}
              style={{ flex: 1, padding: "12px", border: "none", fontSize: 11, fontFamily: "monospace", lineHeight: 1.5, resize: "none", outline: "none", background: "#1e293b", color: "#e2e8f0" }} />
          )}
        </div>
      )}

      {tab === "library" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {completed.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 40, color: MUTED }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 12 }}>No saved articles yet</div>
            </div>
          )}
          {completed.map(c => (
            <div key={c.id} onClick={() => setSelLib(selLib === c.id ? null : c.id)}
              style={{ border: `1.5px solid ${selLib === c.id ? GOLD : LINE}`, borderRadius: 9, padding: "10px 12px", background: selLib === c.id ? LIGHT : WHITE, cursor: "pointer", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: NAVY }}>{c.title}</div>
                <button onClick={e => { e.stopPropagation(); if (window.confirm("Delete this article?")) onDeleteCompleted(c.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", fontSize: 12 }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Saved {new Date(c.savedAt).toLocaleDateString()}</div>
              {selLib === c.id && (
                <div style={{ marginTop: 9 }}>
                  <iframe srcDoc={c.htmlContent} style={{ width: "100%", height: 240, border: `1px solid ${LINE}`, borderRadius: 6 }} title="preview" />
                  <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
                    <Btn onClick={() => navigator.clipboard?.writeText(c.htmlContent)} variant="gold">📋 Copy HTML</Btn>
                    <Btn onClick={() => { const b = new Blob([c.htmlContent], { type: "text/html" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${c.title || "article"}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} variant="ghost">⬇ HTML</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "notes" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <NotesPanel draftId={draft.id} />
        </div>
      )}
    </div>
  );
}

// ── ROOT ──
export default function App() {
  const [drafts, saveDrafts] = useLS("kb-drafts-v4", []);
  const [completed, saveCompleted] = useLS("kb-completed-v4", []);
  const [draft, setDraft] = useState(() => { try { const r = localStorage.getItem("kb-current-v4"); return r ? JSON.parse(r) : fd(); } catch { return fd(); } });
  const [toast, setToast] = useState(null);
  const [topTab, setTopTab] = useState("content");
  const undoStackRef = useRef([]); // array of draft snapshots

  // Persist current draft to localStorage on every change
  useEffect(() => { try { localStorage.setItem("kb-current-v4", JSON.stringify(draft)); } catch {} }, [draft]);

  const showToast = m => { setToast(m); setTimeout(() => setToast(null), 3000); };

  // upd — push snapshot to undo stack before every change
  const upd = patch => {
    setDraft(prev => {
      undoStackRef.current = [...undoStackRef.current.slice(-49), prev]; // keep last 50
      return { ...prev, ...patch };
    });
  };

  // undo — pop last snapshot
  const undoDraft = () => {
    if (undoStackRef.current.length === 0) { showToast("Nothing to undo"); return; }
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setDraft(prev);
    showToast("Undone ✓");
  };

  // saveDraft — always reads latest draft from state via functional update
  const saveDraft = () => {
    setDraft(current => {
      const exists = drafts.find(d => d.id === current.id);
      saveDrafts(exists ? drafts.map(d => d.id === current.id ? current : d) : [current, ...drafts]);
      return current; // no change to draft itself
    });
    showToast("Draft saved ✓");
  };

  const newDraft = () => { undoStackRef.current = []; setDraft(fd()); };
  const selectDraft = d => { undoStackRef.current = []; setDraft(d); };
  const deleteDraft = id => { saveDrafts(drafts.filter(d => d.id !== id)); if (draft.id === id) newDraft(); };
  const addToLib = art => { saveCompleted([art, ...completed]); showToast("Saved to library ✓"); };
  const deleteFromLib = id => saveCompleted(completed.filter(c => c.id !== id));


  const status = getStatus(draft);
  const doneCount = Object.values(status).filter(Boolean).length;
  const pct = Math.round(doneCount / CHECK_ITEMS.length * 100);

  const TopTab = ({ t, label, badge }) => (
    <button onClick={() => setTopTab(t)}
      style={{ padding: "9px 14px", border: "none", background: "none", borderBottom: topTab === t ? `2.5px solid ${GOLD}` : "2.5px solid transparent", color: topTab === t ? GOLD : MUTED, fontSize: 12, fontWeight: topTab === t ? 700 : 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
      {label}
      {badge !== undefined && (
        <span style={{ background: GOLD, color: NAVY, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>{badge}</span>
      )}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f7f8fa", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", overflow: "hidden" }}>
      <Toast msg={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div style={{ background: DG, color: WHITE, height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>📖</div>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-.2px" }}>KB Create-inator</div>
        <div style={{ fontSize: 11, opacity: .45, borderLeft: "1px solid rgba(255,255,255,.2)", paddingLeft: 10, marginLeft: 4 }}>One Click Contractor — Internal Ops</div>
        {draft.title && <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginLeft: 8, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✏️ {draft.title}</div>}
        <div style={{ flex: 1 }} />
        <button onClick={undoDraft}
          style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 6, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↩ Undo</button>
        <button onClick={saveDraft} style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>💾 Save draft</button>
      </div>

      {/* Top tab nav */}
      <div style={{ background: WHITE, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 14px", flexShrink: 0 }}>
        <TopTab t="content" label="✏️ Content & Steps" />
        <TopTab t="review" label="👁 Review & Export" />
      </div>

      {/* Main area — tab content + checklist sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Content tab */}
          {topTab === "content" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f0f2f5", padding: 10 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: WHITE, borderRadius: 12, border: `1px solid ${LINE}`, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ padding: "9px 14px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>✏️ Content & Steps</span>

                </div>
                <ContentEditor draft={draft} upd={upd} resetDraft={() => { undoStackRef.current = []; setDraft(fd()); }} drafts={drafts} onSelectDraft={selectDraft} onNewDraft={newDraft} />
              </div>
            </div>
          )}

          {/* Review tab */}
          {topTab === "review" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#f0f2f5", padding: 10 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: WHITE, borderRadius: 12, border: `1px solid ${LINE}`, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ padding: "9px 14px", borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>👁 Review & Export</span>
                </div>
                <ReviewPanel draft={draft} completed={completed} onSaveCompleted={addToLib} onDeleteCompleted={deleteFromLib} />
              </div>
            </div>
          )}

        </div>

        {/* Checklist sidebar — always visible */}
        <ChecklistSidebar draft={draft} />
      </div>
    </div>
  );
}
