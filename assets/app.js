// ATLAS front-end: brief, support and dossier pages. No tracking, no cookies. Token stays in the URL fragment + sessionStorage.
const API = "https://zkglztkplmzktemdjgnr.supabase.co/functions/v1";
const L = document.documentElement.lang === "en" ? "en" : "fr";
const T = {
  fr: { sending: "Envoi…", fix: "Merci de corriger les champs indiqués.", rate: "Trop de demandes depuis votre connexion. Réessayez dans une heure.", net: "Connexion impossible. Vos saisies sont conservées ; réessayez.",
        required: "Champ requis.", email: "Adresse e-mail invalide.", consent: "Merci d'accepter le traitement de vos données pour ce brief.",
        saved: "Brief reçu. Référence", keep: "Conservez ce lien privé : c'est votre seul accès au dossier (nous ne l'envoyons pas par e-mail). Toute personne qui le possède peut lire le dossier.",
        copy: "Copier le lien", copied: "Copié", open: "Ouvrir mon dossier", support_ok: "Message reçu. Réponse sous 2 jours ouvrés à l'adresse indiquée.",
        notfound: "Dossier introuvable ou lien incomplet. Vérifiez le lien reçu après l'envoi du brief.", nodos: "Aucun dossier ouvert sur cet appareil. Ouvrez le lien privé affiché après l'envoi de votre brief, ou commencez par un brief gratuit.", newbrief: "Envoyer un brief", help: "Lien perdu ? Écrire au support", none: "Aucun fichier pour l'instant.", pay: "Payer", paying: "Redirection vers Stripe…",
        paydis: "Le paiement s'ouvrira ici dès que le devis sera prêt.", payerr: "Paiement momentanément indisponible. Réessayez dans quelques minutes ; si le problème persiste, écrivez-nous ci-dessous.", quotenow: "Si vous avez choisi une formule à prix fixe, votre devis vous attend déjà dans le dossier.", indic: "(prix de la formule — devis à venir)", msgok: "Message envoyé.", up: "Envoyer", upok: "Fichier envoyé.", uperr: "Fichier refusé (formats : PDF, Word, Excel, CSV, TXT, images ; 15 Mo max).",
        states: { received: "Brief reçu", qualified: "Brief qualifié", quoted: "Devis disponible", paid: "Payé", in_production: "En production", in_review: "En relecture", delivered: "Livré", correction: "Correction en cours", closed: "Clos", rejected: "Non retenu", cancelled: "Annulé" } },
  en: { sending: "Sending…", fix: "Please fix the highlighted fields.", rate: "Too many requests from your connection. Please try again in an hour.", net: "Cannot connect. Your input is kept; please retry.",
        required: "Required.", email: "Invalid email address.", consent: "Please agree to the processing of your data for this brief.",
        saved: "Brief received. Reference", keep: "Keep this private link: it is your only access to the project (we do not email it). Anyone holding it can read the project.",
        copy: "Copy link", copied: "Copied", open: "Open my project", support_ok: "Message received. We reply within 2 business days to the address given.",
        notfound: "Project not found or incomplete link. Check the link you received after sending the brief.", nodos: "No project open on this device. Open the private link shown after you sent your brief, or start with a free brief.", newbrief: "Send a brief", help: "Lost the link? Contact support", none: "No files yet.", pay: "Pay", paying: "Redirecting to Stripe…",
        paydis: "Payment opens here once the quote is ready.", payerr: "Payment is temporarily unavailable. Please try again in a few minutes; if it persists, write to us below.", quotenow: "If you chose a fixed-price option, your quote is already waiting in your project page.", indic: "(package price — quote to follow)", msgok: "Message sent.", up: "Upload", upok: "File uploaded.", uperr: "File rejected (PDF, Word, Excel, CSV, TXT, images; 15 MB max).",
        states: { received: "Brief received", qualified: "Brief qualified", quoted: "Quote ready", paid: "Paid", in_production: "In production", in_review: "In review", delivered: "Delivered", correction: "Correction in progress", closed: "Closed", rejected: "Not accepted", cancelled: "Cancelled" } },
}[L];
const $ = (s, r = document) => r.querySelector(s);
const show = (el, cls, html) => { el.className = "status show " + cls; el.innerHTML = html; if (cls === "ok") el.focus?.(); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
async function post(path, body, headers = {}) {
  const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}
function validate(form) {
  let ok = true;
  form.querySelectorAll(".err").forEach((e) => e.remove());
  form.querySelectorAll("[required]").forEach((f) => {
    let msg = "";
    if (f.type === "checkbox" ? !f.checked : !f.value.trim()) msg = f.type === "checkbox" ? T.consent : T.required;
    else if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value.trim())) msg = T.email;
    f.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg) { ok = false; const e = document.createElement("div"); e.className = "err"; e.id = f.id + "-err"; e.textContent = msg; f.setAttribute("aria-describedby", e.id); (f.closest(".radio") || f).after(e); }
  });
  if (!ok) form.querySelector("[aria-invalid=true]")?.focus();
  return ok;
}
// ---- brief ----
const brief = $("form#brief");
if (brief) {
  const key = "atlas-idem-" + brief.dataset.brand;
  const pre = new URLSearchParams(location.search).get("offer"); // plan card CTA → brief.html?offer=<key>
  const r = pre && [...brief.querySelectorAll("input[name=offer]")].find((x) => x.value === pre);
  if (r) r.checked = true;
  brief.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const st = $("#brief-status"), btn = brief.querySelector("button[type=submit]");
    if (!validate(brief)) return show(st, "bad", esc(T.fix));
    let idem = sessionStorage.getItem(key); if (!idem) { idem = crypto.randomUUID(); sessionStorage.setItem(key, idem); }
    const fd = new FormData(brief), b = {};
    brief.querySelectorAll("[data-brief]").forEach((f) => { if (f.value.trim()) b[f.name] = f.value.trim(); });
    btn.disabled = true; btn.textContent = T.sending;
    try {
      const { s, j } = await post("/intake", { brand: brief.dataset.brand, offer: fd.get("offer") || "quote", lang: L, name: fd.get("name"), email: fd.get("email"),
        company: fd.get("company"), country: fd.get("country"), consent: !!fd.get("consent"), website: fd.get("website"), brief: b, idempotency_key: idem });
      if (s === 201 && j.token) {
        sessionStorage.removeItem(key);
        const link = new URL(brief.dataset.dossier, location.href).href + "#ref=" + encodeURIComponent(j.ref) + "&t=" + encodeURIComponent(j.token);
        try { localStorage.setItem("atlas-ref", j.ref); localStorage.setItem("atlas-t", j.token); } catch {}  // returning client finds the dossier without the link
        brief.hidden = true;
        show(st, "ok", `<p><strong>${esc(T.saved)} ${esc(j.ref)}.</strong></p><p>${esc(T.quotenow)}</p><p>${esc(T.keep)}</p><div class=secret id=lnk>${esc(link)}</div>
          <p class=cta><button class="btn ghost" type=button id=cp>${esc(T.copy)}</button><a class="btn primary" href="${esc(link)}">${esc(T.open)}</a></p>`);
        $("#cp").onclick = async () => { await navigator.clipboard.writeText(link); $("#cp").textContent = T.copied; };
      } else if (s === 200 && j.duplicate) { show(st, "ok", `<p>${esc(T.saved)} ${esc(j.ref)}.</p>`); }
      else if (s === 422) { show(st, "bad", esc(T.fix) + " (" + esc((j.fields || []).join(", ")) + ")"); }
      else if (s === 429) { show(st, "bad", esc(T.rate)); }
      else show(st, "bad", esc(T.net));
    } catch { show(st, "bad", esc(T.net)); }
    btn.disabled = false; btn.textContent = btn.dataset.label;
  });
}
// ---- support ----
const sup = $("form#support");
if (sup) sup.addEventListener("submit", async (ev) => {
  ev.preventDefault(); const st = $("#support-status");
  if (!validate(sup)) return show(st, "bad", esc(T.fix));
  const fd = new FormData(sup);
  try {
    const { s } = await post("/support", { brand: fd.get("brand"), lang: L, name: fd.get("name"), email: fd.get("email"), dossier_ref: fd.get("dossier_ref"), message: fd.get("message"), website: fd.get("website") });
    if (s === 201) { sup.reset(); show(st, "ok", esc(T.support_ok)); } else show(st, "bad", esc(s === 429 ? T.rate : T.fix));
  } catch { show(st, "bad", esc(T.net)); }
});
// ---- dossier ----
const dos = $("#dossier");
if (dos) {
  const h = new URLSearchParams(location.hash.slice(1));
  const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ref = h.get("ref") || sessionStorage.getItem("atlas-ref") || ls("atlas-ref"), tok = h.get("t") || sessionStorage.getItem("atlas-t") || ls("atlas-t");
  if (h.get("ref")) { sessionStorage.setItem("atlas-ref", ref); sessionStorage.setItem("atlas-t", tok); }
  const H = { "x-dossier-token": tok || "" };
  const fmt = (c, cur) => {  // same style as the published prices: "180 USD" (fr) / "USD 180" (en)
    const n = new Intl.NumberFormat(L, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(c / 100), k = (cur || "usd").toUpperCase();
    return L === "fr" ? `${n} ${k}` : `${k} ${n}`;
  };
  async function load() {
    if (!ref || !tok) {  // visitor without a dossier on this device: explain and offer a way forward
      const sup = new URL((L === "en" ? "../../en/" : "../") + "support.html", location.href).href;
      return show($("#dossier-status"), "info", `<p>${esc(T.nodos)}</p><p class=cta><a class="btn" href="brief.html">${esc(T.newbrief)}</a> <a class="btn ghost" href="${esc(sup)}">${esc(T.help)}</a></p>`);
    }
    let r; try { r = await fetch(`${API}/dossier?ref=${encodeURIComponent(ref)}`, { headers: H }); } catch { return show($("#dossier-status"), "bad", esc(T.net)); }
    if (r.status !== 200) return show($("#dossier-status"), "bad", esc(T.notfound));
    const d = await r.json();
    $("#d-ref").textContent = d.ref; $("#d-state").textContent = T.states[d.status] || d.status;
    $("#d-next").textContent = d.next_step || "";
    $("#d-amount").textContent = d.amount_due ? fmt(d.amount_due.amount_cents, d.amount_due.currency) + (d.status === "quoted" || d.status === "paid" ? "" : " " + T.indic) : "—";
    const pay = $("#d-pay"); pay.disabled = !d.payable; $("#d-paynote").textContent = d.payable ? "" : T.paydis;
    const when = (iso) => new Intl.DateTimeFormat(L, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    $("#d-events").innerHTML = d.events.map((e) => `<li><time datetime="${esc(e.created_at)}">${esc(when(e.created_at))}</time>${esc(e.kind === "status" ? (T.states[e.body] || e.body) : e.body)}</li>`).join("");
    const STEP = { received: 0, qualified: 0, quoted: 1, paid: 2, in_production: 3, in_review: 4, correction: 4, delivered: 5, closed: 5 };
    const cur = STEP[d.status] ?? 0;
    document.querySelectorAll("#d-steps li").forEach((li, i) => {
      li.className = i < cur || d.status === "delivered" || d.status === "closed" ? "done" : i === cur ? "now" : "";
      if (i === cur) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    const sc = $(`#d-scope [data-offer="${CSS.escape(d.offer || "")}"]`);
    if (sc) { sc.hidden = false; $("#d-scope").hidden = false; }
    const bl = $("#d-brief"), labels = JSON.parse(bl?.dataset.labels || "{}");
    const rows = Object.entries(d.brief || {}).filter(([, v]) => typeof v === "string" && v.trim());
    if (bl) { bl.hidden = !rows.length; $("#d-brief-list").innerHTML = rows.map(([k, v]) => `<dt>${esc(labels[k] || k)}</dt><dd>${esc(v)}</dd>`).join(""); }
    $("#d-files").innerHTML = d.files.length ? d.files.map((f) => `<li><span>${esc(f.label)} <span class=ext>v${f.version}</span></span>${f.url ? `<a href="${esc(f.url)}" rel=noopener>↓</a>` : ""}</li>`).join("") : `<li>${esc(T.none)}</li>`;
    dos.hidden = false;
  }
  $("#d-pay")?.addEventListener("click", async () => {
    const b = $("#d-pay"); b.disabled = true; b.textContent = T.paying;
    const { s, j } = await post("/checkout", { ref }, H);
    if (s === 200 && j.url) location.href = j.url;
    else { b.textContent = T.pay; b.disabled = false; $("#d-paynote").textContent = s >= 500 || s === 0 ? T.payerr : T.paydis; }
  });
  $("#d-msg")?.addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target, st = $("#d-msg-status");
    if (!validate(f)) return show(st, "bad", esc(T.fix));
    const { s } = await post("/dossier", { ref, kind: f.kind.value, body: f.body.value }, H);
    if (s === 201) { f.reset(); show(st, "ok", esc(T.msgok)); load(); } else show(st, "bad", esc(T.net));
  });
  $("#d-up")?.addEventListener("submit", async (ev) => {
    ev.preventDefault(); const st = $("#d-up-status"), file = ev.target.file.files[0]; if (!file) return;
    const { s, j } = await post("/dossier", { ref, kind: "upload_request", filename: file.name, size: file.size }, H);
    if (s !== 201) return show(st, "bad", esc(T.uperr));
    const put = await fetch(j.upload_url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (put.ok) { ev.target.reset(); show(st, "ok", esc(T.upok)); load(); } else show(st, "bad", esc(T.uperr));
  });
  load();
}

// ---- demo films: play once when half visible, pause when it leaves; never autoplay under reduced motion ----
document.querySelectorAll(".film").forEach((fig) => {
  const v = fig.querySelector("video"), b = fig.querySelector(".film-btn"), [lPlay, lPause, lReplay] = b.dataset.l.split("|");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sync = () => { b.textContent = v.ended ? lReplay : v.paused ? lPlay : lPause; b.setAttribute("aria-pressed", String(!v.paused)); };
  let userPaused = false;
  b.addEventListener("click", () => { if (v.paused || v.ended) { userPaused = false; v.play(); } else { userPaused = true; v.pause(); } });
  ["play", "pause", "ended"].forEach((ev) => v.addEventListener(ev, sync));
  const bar = document.createElement("span"); bar.className = "film-bar"; bar.setAttribute("aria-hidden", "true"); fig.querySelector(".film-frame").append(bar);
  const tick = () => { bar.style.transform = `scaleX(${v.duration ? v.currentTime / v.duration : 0})`; if (!v.paused && !v.ended) requestAnimationFrame(tick); };
  v.addEventListener("play", () => requestAnimationFrame(tick)); v.addEventListener("seeked", tick); v.addEventListener("ended", tick);
  if (still || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && en.intersectionRatio >= 0.5) { if (!userPaused && !v.ended) v.play().catch(() => {}); }
    else if (!v.paused) v.pause();
  }, { threshold: [0, 0.5] }).observe(fig);
});
