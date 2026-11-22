// Founder panel shell and components. English only. Slots only, no free-form HTML.
import { html, esc, raw, Raw } from "../lib/html";

const ICONS: Record<string, string> = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  leads: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  shops: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  outreach: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  stats: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  audit: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  arrow: '<path d="M9 6l6 6-6 6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>',
};
export const icon = (name: string, size = 18): Raw => raw(`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`);

export const STAGE_COLOR: Record<string, string> = { new: "#8A93A6", called: "#5B7BA8", permission: "#1F8A8A", demo_sent: "#3F5BA9", editing: "#B7791F", hot: "#E0661A", paid: "#167C4A", stalled: "#8C7B6B", lost: "#B4686B" };
export const STAGE_LABEL: Record<string, string> = { new: "New", called: "Called", permission: "Permission", demo_sent: "Demo sent", editing: "Editing", hot: "Hot", paid: "Paid", stalled: "Stalled", lost: "Lost" };
export const stageBadge = (s: string): Raw => html`<span class="badge" style="--c:${STAGE_COLOR[s] ?? "#8A93A6"}">${STAGE_LABEL[s] ?? s}</span>`;
export const statusBadge = (s: string): Raw => {
  const c = s === "live" ? "#167C4A" : s === "preview" ? "#3F5BA9" : s === "expired" ? "#8C7B6B" : "#B42318";
  return html`<span class="badge" style="--c:${c}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
};

/** IST date-time like "22 Nov, 21:57". */
export function fmt(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}
/** Start of the current day in IST, as an ISO UTC string (daily caps reset at IST midnight). */
export function istDayStartIso(now = new Date()): string {
  const off = 330 * 60_000;
  return new Date(Math.floor((now.getTime() + off) / 86_400_000) * 86_400_000 - off).toISOString();
}

export const CSS = `
:root{--bg:#F3F5F7;--surface:#fff;--ink:#14171F;--muted:#667085;--faint:#98A2B3;--line:#E4E7EC;--line2:#EEF0F3;--primary:#1E3A6E;--primary-h:#17305C;--accent:#E8A33D;--ok:#167C4A;--err:#B42318;--side:#141A2B;--side-t:#B8C0D4;--r:10px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/1.5 Inter,'Noto Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-.01em;margin:0}h2{font-size:15px;font-weight:650;margin:0}h3{font-size:14px;font-weight:600;margin:0}
.ic{flex:none}.muted{color:var(--muted)}.sm{font-size:13px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
.app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.side{background:var(--side);color:var(--side-t);display:flex;flex-direction:column;padding:20px 12px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:10px;padding:4px 10px 20px;color:#fff}
.mark{width:32px;height:32px;border-radius:9px;background:var(--accent);display:grid;place-items:center;color:var(--side);font-weight:800;font-size:16px}
.brand b{display:block;font-size:15px;line-height:1.1}.brand span{font-size:12px;color:var(--side-t)}
.nav{display:flex;flex-direction:column;gap:2px}
.nav a{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;color:var(--side-t);font-weight:500;position:relative}
.nav a:hover{background:rgba(255,255,255,.06);color:#fff;text-decoration:none}
.nav a[aria-current=page]{background:rgba(255,255,255,.09);color:#fff}
.nav a[aria-current=page]::before{content:"";position:absolute;left:-12px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--accent)}
.side .foot{margin-top:auto;padding-top:16px}
.side .foot button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:8px;cursor:pointer;color:var(--side-t);font-weight:500}
.side .foot button:hover{background:rgba(255,255,255,.06);color:#fff}
.dots{height:54px;margin:14px 6px 0;border-radius:8px;opacity:.5;background-image:radial-gradient(circle,#E8A33D 1.4px,transparent 1.6px);background-size:14px 14px;-webkit-mask-image:linear-gradient(90deg,#000,transparent);mask-image:linear-gradient(90deg,#000,transparent)}
.main{min-width:0}
.content{max-width:1120px;margin:0 auto;padding:28px 32px 56px}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.head p{margin:6px 0 0;color:var(--muted)}
.acts{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 16px;border-radius:9px;border:1px solid var(--primary);background:var(--primary);color:#fff;font:600 14px Inter,'Noto Sans',system-ui,sans-serif;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn:hover{background:var(--primary-h);text-decoration:none}
.btn.s{background:var(--surface);color:var(--ink);border-color:var(--line)}.btn.s:hover{background:#F8F9FB}
.btn.ok{background:var(--ok);border-color:var(--ok)}.btn.sm{min-height:34px;padding:0 12px;font-size:13px}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px}
.panel-h{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line2)}
.panel-b{padding:18px}
.stack{display:grid;gap:16px}
.cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}
.cols.even{grid-template-columns:1fr 1fr}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.kpi{padding:16px 18px}
.kpi .l{font-size:13px;color:var(--muted);font-weight:500}
.kpi .v{font-size:30px;line-height:1.15;font-weight:650;letter-spacing:-.02em;margin-top:6px}
.kpi .n{font-size:13px;color:var(--muted);margin-top:2px}
.kpi.hot{border-color:#F3D3B0;background:#FFF9F2}.kpi.hot .v{color:#C2540D}
.funnel{display:flex;height:14px;border-radius:99px;overflow:hidden;background:var(--line2);gap:2px}
.funnel i{display:block;min-width:6px}
.legend{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin-top:16px}
.legend a{display:flex;align-items:center;gap:8px;color:var(--ink);font-size:13px;padding:4px 0}
.legend a:hover{text-decoration:none;color:var(--primary)}
.legend i{width:10px;height:10px;border-radius:3px;background:var(--c)}.legend b{margin-left:auto;font-weight:650}
.tbl{width:100%;border-collapse:collapse}
.tbl th{text-align:left;font-size:12px;font-weight:600;color:var(--muted);padding:10px 18px;border-bottom:1px solid var(--line);background:#FAFBFC;white-space:nowrap}
.tbl td{padding:13px 18px;border-bottom:1px solid var(--line2);vertical-align:middle}
.tbl tr:last-child td{border-bottom:0}.tbl tbody tr:hover td{background:#FAFBFC}
.tbl .who{font-weight:600;color:var(--ink)}.tbl .who:hover{color:var(--primary)}
.tbl .r{text-align:right}
.badge{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#fff);border:1px solid color-mix(in srgb,var(--c) 28%,#fff);white-space:nowrap}
.badge::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--c)}
.score{display:flex;align-items:center;gap:8px;min-width:90px}.score i{display:block;height:6px;border-radius:99px;background:var(--accent)}.score em{font-style:normal;font-weight:600;font-size:13px;min-width:16px}
.ut{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:16px;overflow-x:auto}
.ut a{padding:10px 12px;color:var(--muted);font-weight:500;white-space:nowrap;border-bottom:2px solid transparent;margin-bottom:-1px}
.ut a:hover{color:var(--ink);text-decoration:none}.ut a[aria-current=page]{color:var(--primary);border-color:var(--primary);font-weight:600}
.ut a span{color:var(--faint);margin-left:4px;font-weight:500}
.tool{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.search{position:relative;flex:1;min-width:220px;max-width:420px}.search .ic{position:absolute;left:12px;top:11px;color:var(--faint)}.search input{padding-left:38px}
label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}
input,select,textarea{width:100%;min-height:40px;padding:9px 12px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:400 14px Inter,'Noto Sans',system-ui,sans-serif}
input:focus,select:focus,textarea:focus{outline:2px solid color-mix(in srgb,var(--primary) 35%,#fff);border-color:var(--primary)}
textarea{min-height:96px;resize:vertical}
.field{margin-bottom:14px}.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.hint{font-size:13px;color:var(--muted);margin:6px 0 0}
.inl{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.inl>div{flex:1;min-width:140px}.inl>.btn{flex:none}
.toast{display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-radius:10px;margin-bottom:18px;font-weight:500;background:#E9F6EF;color:#0F5C36;border:1px solid #BFE3CF}
.toast.e{background:#FDECEA;color:#8A1C13;border-color:#F4C2BD}
.empty{padding:36px 18px;text-align:center;color:var(--muted)}.empty b{display:block;color:var(--ink);font-size:15px;margin-bottom:4px}
.list{list-style:none;margin:0;padding:0}.list li{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line2)}.list li:last-child{border-bottom:0}.list .g{flex:1;min-width:0}.list .g b{display:block;font-weight:600}.list .g span{font-size:13px;color:var(--muted)}
.prog{height:8px;background:var(--line2);border-radius:99px;overflow:hidden;margin-top:10px}.prog i{display:block;height:100%;background:var(--primary);border-radius:99px}
.dl{display:grid;grid-template-columns:120px 1fr;gap:10px 16px;margin:0}.dl dt{color:var(--muted);font-size:13px}.dl dd{margin:0;font-weight:500;overflow-wrap:anywhere}
.chat{display:grid;gap:8px}.chat div{max-width:85%;padding:8px 12px;border-radius:12px;background:var(--line2);font-size:14px}.chat .out{margin-left:auto;background:#E4EAF6}
.shop{padding:16px 18px;border-bottom:1px solid var(--line2)}.shop:last-child{border-bottom:0}
details.more summary{cursor:pointer;color:var(--primary);font-weight:600;font-size:13px;list-style:none;display:inline-flex;gap:6px;align-items:center}details.more summary::-webkit-details-marker{display:none}
details.more[open] summary{margin-bottom:14px}
.login{min-height:100vh;display:grid;place-items:center;padding:20px}.login .box{width:100%;max-width:400px}.login .panel-b{padding:28px}
.login .brand{color:var(--ink);padding:0 0 20px}.login .brand span{color:var(--muted)}
@media (max-width:1000px){.kpis{grid-template-columns:1fr 1fr}.cols,.cols.even{grid-template-columns:1fr}.legend{grid-template-columns:1fr 1fr}}
@media (max-width:860px){
.app{grid-template-columns:1fr}
.side{position:sticky;height:auto;flex-direction:row;align-items:center;padding:8px 10px;gap:8px;z-index:20;overflow-x:auto}
.brand{padding:0 8px 0 4px}.brand span,.dots{display:none}
.nav{flex-direction:row;gap:2px}.nav a{padding:9px 12px;white-space:nowrap}.nav a[aria-current=page]::before{left:10px;right:10px;top:auto;bottom:0;height:3px;width:auto;border-radius:3px 3px 0 0}
.side .foot{margin:0 0 0 auto;padding:0}.side .foot button span{display:none}
.content{padding:20px 16px 48px}.fgrid{grid-template-columns:1fr}
.tbl th,.tbl td{padding:11px 12px}.hide-s{display:none}
}
@media (max-width:480px){.kpis{gap:10px}.kpi .v{font-size:26px}.legend{grid-template-columns:1fr}.dl{grid-template-columns:1fr;gap:2px}.dl dd{margin-bottom:10px}}
@media (prefers-reduced-motion:no-preference){.btn,.nav a{transition:background .15s ease-out,color .15s ease-out}}
`;

const NAV: [string, string, string][] = [
  ["overview", "Overview", "/admin"], ["leads", "Leads", "/admin/leads"], ["shops", "Shops", "/admin/shops"], ["outreach", "Outreach", "/admin/outreach"],
  ["stats", "Performance", "/admin/stats"], ["bot", "Bot usage", "/admin/bot-usage"], ["audit", "Audit log", "/admin/audit"],
];

export function adminPage(title: string, active: string, body: Raw | string, flash?: { m?: string; e?: string }): string {
  const nav = NAV.map(([k, label, href]) => html`<a href="${href}" ${k === active ? raw('aria-current="page"') : ""}>${icon(k)}<span>${label}</span></a>`);
  const toast = flash?.m ? html`<div class="toast" role="status">${flash.m}</div>` : flash?.e ? html`<div class="toast e" role="alert">${flash.e}</div>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Vedhin Admin</title><meta name="robots" content="noindex,nofollow"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"><style>${CSS}</style></head><body>
<div class="app"><aside class="side"><div class="brand"><div class="mark">V</div><div><b>Vedhin</b><span>Founder panel</span></div></div>
<nav class="nav" aria-label="Main">${nav.join("")}</nav><div class="dots" aria-hidden="true"></div>
<form class="foot" method="post" action="/admin/logout"><button type="submit">${icon("logout")}<span>Log out</span></button></form></aside>
<div class="main"><main class="content">${toast}${body}</main></div></div></body></html>`;
}

export function authPage(title: string, inner: Raw | string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Vedhin Admin</title><meta name="robots" content="noindex,nofollow"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"><style>${CSS}</style></head><body><div class="login"><div class="box"><div class="brand"><div class="mark">V</div><div><b>Vedhin</b><span>Founder panel</span></div></div>${inner}</div></div></body></html>`;
}

export const head = (title: string, sub?: string, actions?: Raw | string): Raw => html`<div class="head"><div><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ""}</div>${actions ? html`<div class="acts">${actions}</div>` : ""}</div>`;
export const kpi = (label: string, value: string | number, note?: string, cls = ""): Raw => html`<div class="panel kpi ${cls}"><div class="l">${label}</div><div class="v">${value}</div>${note ? html`<div class="n">${note}</div>` : ""}</div>`;
export const empty = (title: string, text: string, action?: Raw | string): Raw => html`<div class="empty"><b>${title}</b>${text}${action ? html`<div style="margin-top:14px">${action}</div>` : ""}</div>`;
