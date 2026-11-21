// ATLAS front-end: brief, support and dossier pages. No tracking, no cookies. Token stays in the URL fragment + sessionStorage.
const API = "https://zkglztkplmzktemdjgnr.supabase.co/functions/v1";
const L = document.documentElement.lang === "en" ? "en" : "fr";
const T = {
  fr: { sending: "Envoi…", fix: "Merci de corriger les champs indiqués.", rate: "Trop de demandes depuis votre connexion. Réessayez dans une heure.", net: "Connexion impossible. Vos saisies sont conservées ; réessayez.",
        required: "Champ requis.", email: "Adresse e-mail invalide.", consent: "Merci d'accepter le traitement de vos données pour ce brief.",
        saved: "Brief reçu. Référence", keep: "Conservez ce lien privé : c'est votre seul accès au dossier (nous ne l'envoyons pas par e-mail). Toute personne qui le possède peut lire le dossier.",
        copy: "Copier le lien", copied: "Copié", open: "Ouvrir mon dossier", support_ok: "Message reçu. Réponse sous 2 jours ouvrés à l'adresse indiquée.",
        notfound: "Dossier introuvable ou lien incomplet. Vérifiez le lien reçu après l'envoi du brief.", none: "Aucun fichier pour l'instant.", pay: "Payer", paying: "Redirection vers Stripe…",
        paydis: "Le paiement s'ouvrira ici dès que le devis sera prêt.", indic: "(prix de la formule — devis à venir)", msgok: "Message envoyé.", up: "Envoyer", upok: "Fichier envoyé.", uperr: "Fichier refusé (formats : PDF, Word, Excel, CSV, TXT, images ; 15 Mo max).",
        states: { received: "Brief reçu", qualified: "Brief qualifié", quoted: "Devis disponible", paid: "Payé", in_production: "En production", in_review: "En relecture", delivered: "Livré", correction: "Correction en cours", closed: "Clos", rejected: "Non retenu", cancelled: "Annulé" } },
  en: { sending: "Sending…", fix: "Please fix the highlighted fields.", rate: "Too many requests from your connection. Please try again in an hour.", net: "Cannot connect. Your input is kept; please retry.",
        required: "Required.", email: "Invalid email address.", consent: "Please agree to the processing of your data for this brief.",
        saved: "Brief received. Reference", keep: "Keep this private link: it is your only access to the project (we do not email it). Anyone holding it can read the project.",
        copy: "Copy link", copied: "Copied", open: "Open my project", support_ok: "Message received. We reply within 2 business days to the address given.",
        notfound: "Project not found or incomplete link. Check the link you received after sending the brief.", none: "No files yet.", pay: "Pay", paying: "Redirecting to Stripe…",
        paydis: "Payment opens here once the quote is ready.", indic: "(package price — quote to follow)", msgok: "Message sent.", up: "Upload", upok: "File uploaded.", uperr: "File rejected (PDF, Word, Excel, CSV, TXT, images; 15 MB max).",
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
        brief.hidden = true;
        show(st, "ok", `<p><strong>${esc(T.saved)} ${esc(j.ref)}.</strong></p><p>${esc(T.keep)}</p><div class=secret id=lnk>${esc(link)}</div>
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
  const ref = h.get("ref") || sessionStorage.getItem("atlas-ref"), tok = h.get("t") || sessionStorage.getItem("atlas-t");
  if (h.get("ref")) { sessionStorage.setItem("atlas-ref", ref); sessionStorage.setItem("atlas-t", tok); }
  const H = { "x-dossier-token": tok || "" };
  const fmt = (c, cur) => new Intl.NumberFormat(L, { style: "currency", currency: (cur || "usd").toUpperCase() }).format(c / 100);
  async function load() {
    if (!ref || !tok) return show($("#dossier-status"), "bad", esc(T.notfound));
    let r; try { r = await fetch(`${API}/dossier?ref=${encodeURIComponent(ref)}`, { headers: H }); } catch { return show($("#dossier-status"), "bad", esc(T.net)); }
    if (r.status !== 200) return show($("#dossier-status"), "bad", esc(T.notfound));
    const d = await r.json();
    $("#d-ref").textContent = d.ref; $("#d-state").textContent = T.states[d.status] || d.status;
    $("#d-next").textContent = d.next_step || "";
    $("#d-amount").textContent = d.amount_due ? fmt(d.amount_due.amount_cents, d.amount_due.currency) + (d.status === "quoted" || d.status === "paid" ? "" : " " + T.indic) : "—";
    const pay = $("#d-pay"); pay.disabled = !d.payable; $("#d-paynote").textContent = d.payable ? "" : T.paydis;
    $("#d-events").innerHTML = d.events.map((e) => `<li><time>${esc(e.created_at.slice(0, 16).replace("T", " "))}</time>${esc(e.kind === "status" ? (T.states[e.body] || e.body) : e.body)}</li>`).join("");
    $("#d-files").innerHTML = d.files.length ? d.files.map((f) => `<li><span>${esc(f.label)} <span class=ext>v${f.version}</span></span>${f.url ? `<a href="${esc(f.url)}" rel=noopener>↓</a>` : ""}</li>`).join("") : `<li>${esc(T.none)}</li>`;
    dos.hidden = false;
  }
  $("#d-pay")?.addEventListener("click", async () => {
    const b = $("#d-pay"); b.disabled = true; b.textContent = T.paying;
    const { s, j } = await post("/checkout", { ref }, H);
    if (s === 200 && j.url) location.href = j.url; else { b.textContent = T.pay; $("#d-paynote").textContent = T.paydis; }
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
