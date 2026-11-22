// ATLAS free tools. Everything runs in the visitor's browser: nothing typed or dropped here is sent to ATLAS.
// Only the SignalDesk tool calls an outside service: the French State's public company register API.
(() => {
  const DOC = typeof document !== "undefined";
  const FR = !DOC || document.documentElement.lang !== "en";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const fold = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tr = (fr, en) => (FR ? fr : en);
  const row = (ok, text) => `<li class="t-${ok === null ? "info" : ok ? "ok" : "bad"}"><span class="t-ic" aria-hidden="true">${ok === null ? "i" : ok ? "✓" : "!"}</span><span>${text}</span></li>`;
  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---------- Localoom: French/English listing checker ----------
  const GLOSS = [["faïence", "earthenware"], ["grès", "stoneware"], ["porcelaine", "porcelain"], ["terre cuite", "terracotta"], ["lin", "linen"],
    ["laine", "wool"], ["mérinos", "merino"], ["coton", "cotton"], ["soie", "silk"], ["cachemire", "cashmere"], ["cuir pleine fleur", "full-grain"],
    ["acier inoxydable", "stainless steel"], ["inox", "stainless"], ["laiton", "brass"], ["cuivre", "copper"], ["chêne", "oak"], ["noyer", "walnut"],
    ["hêtre", "beech"], ["bois massif", "solid wood"], ["lave-vaisselle", "dishwasher"], ["fait main", "handmade|hand-made|hand made"], ["émaillé", "glaze"]];
  const HYPE = /\b(best|perfect|amazing|premium|luxury|luxurious|exceptional|stunning|ultimate|unique|world-class|incredible)\b/gi;
  const nums = (s) => (String(s).replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1").match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", "."));
  const units = (s) => new Set((fold(s).match(/\d\s?(cm|mm|ml|cl|kg|°c|%|m|l|g|w|v)\b/g) || []).map((u) => u.replace(/^\d\s?/, "")));
  function checkPair(fr, en) {
    const out = []; let pass = 0, total = 0;
    const t = (ok, text) => { total++; if (ok) pass++; out.push(row(ok, text)); };
    const a = nums(fr).sort(), b = nums(en).sort();
    const missing = a.filter((x) => { const i = b.indexOf(x); if (i < 0) return true; b.splice(i, 1); return false; });
    t(!missing.length && !b.length, missing.length || b.length
      ? tr(`Chiffres différents : ${esc(missing.join(", ") || "—")} absent(s) en anglais${b.length ? `, ${esc(b.join(", "))} en trop` : ""}.`, `Numbers differ: ${esc(missing.join(", ") || "—")} missing in English${b.length ? `, ${esc(b.join(", "))} extra` : ""}.`)
      : tr(`Les ${a.length} chiffres sont identiques dans les deux langues.`, `All ${a.length} numbers match in both languages.`));
    const uf = units(fr), ue = units(en), lostU = [...uf].filter((u) => !ue.has(u));
    t(!lostU.length, lostU.length ? tr(`Unité(s) absente(s) en anglais : ${esc(lostU.join(", "))}.`, `Unit(s) missing in English: ${esc(lostU.join(", "))}.`) : tr("Unités conservées.", "Units kept."));
    const ff = fold(fr), fe = fold(en), gl = GLOSS.filter(([f, e]) => new RegExp(`(^|[^a-z])${fold(f)}([^a-z]|$)`).test(ff) && !new RegExp(`\\b(${e})`).test(fe));
    t(!gl.length, gl.length ? tr(`Terme de métier à vérifier : ${gl.map(([f, e]) => `« ${esc(f)} » → <em>${esc(e.split("|")[0])}</em>`).join(", ")}.`, `Trade term to check: ${gl.map(([f, e]) => `“${esc(f)}” → <em>${esc(e.split("|")[0])}</em>`).join(", ")}.`) : tr("Termes de métier cohérents avec le glossaire.", "Trade terms consistent with the glossary."));
    const hype = [...new Set((en.match(HYPE) || []).map((w) => w.toLowerCase()))].filter((w) => !new RegExp(`\\b${w}\\b`, "i").test(fr));
    t(!hype.length, hype.length ? tr(`Mot(s) promotionnel(s) ajouté(s) en anglais : ${esc(hype.join(", "))}.`, `Promotional word(s) added in English: ${esc(hype.join(", "))}.`) : tr("Aucun superlatif ajouté.", "No superlative added."));
    const comma = en.match(/\b\d+,\d{1,2}\b/g);
    t(!comma, comma ? tr(`Virgule décimale française dans le texte anglais : ${esc(comma.join(", "))} (écrire 9.5).`, `French decimal comma in English text: ${esc(comma.join(", "))} (write 9.5).`) : tr("Séparateur décimal correct en anglais.", "Correct decimal separator in English."));
    const ratio = fr.trim() ? en.trim().length / fr.trim().length : 1;
    t(ratio > 0.6, ratio > 0.6 ? tr("Longueur cohérente avec le texte français.", "Length consistent with the French text.") : tr("Texte anglais nettement plus court : traduction peut-être incomplète.", "English text much shorter: translation may be incomplete."));
    return { out, pass, total };
  }
  function csvParse(text) {
    const rows = []; let r = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === "," || c === ";") { r.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; r.push(f); rows.push(r); r = []; f = ""; }
      else f += c;
    }
    if (f || r.length) { r.push(f); rows.push(r); }
    return rows.filter((x) => x.some((v) => v.trim()));
  }
  function localoom(root) {
    const fr = $("[name=fr]", root), en = $("[name=en]", root), res = $(".t-res", root), score = $(".t-score", root);
    const run = () => {
      const { out, pass, total } = checkPair(fr.value, en.value);
      res.innerHTML = `<ul class="t-list">${out.join("")}</ul>`;
      score.innerHTML = `<strong class="num">${pass}/${total}</strong> ${tr("contrôles réussis", "checks passed")}`;
      score.dataset.level = pass === total ? "ok" : pass >= total - 2 ? "mid" : "bad";
    };
    fr.addEventListener("input", debounce(run)); en.addEventListener("input", debounce(run)); run();
    $("[name=csv]", root)?.addEventListener("change", async (ev) => {
      const file = ev.target.files[0], box = $(".t-csv", root); if (!file) return;
      if (file.size > 5e6) { box.innerHTML = `<p>${tr("Fichier trop lourd (5 Mo max ici).", "File too large (5 MB max here).")}</p>`; return; }
      const rows = csvParse(await file.text()); const head = rows.shift() || [];
      let iF = head.findIndex((h) => /(^|[^a-z])fr|french|fran/i.test(h)), iE = head.findIndex((h) => /(^|[^a-z])en|english|angl/i.test(h));
      if (iF < 0 || iE < 0 || iF === iE) { iF = 1; iE = 2; }
      const iS = Math.max(0, head.findIndex((h) => /sku|ref|handle|id/i.test(h)));
      const bad = []; let ok = 0;
      rows.slice(0, 2000).forEach((r) => { const c = checkPair(r[iF] || "", r[iE] || ""); if (c.pass === c.total) ok++; else bad.push([r[iS] || "?", c.total - c.pass, c.out.filter((x) => x.includes("t-bad")).map((x) => x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).join(" · ")]); });
      box.innerHTML = `<p><strong class="num">${ok}/${ok + bad.length}</strong> ${tr("lignes sans écart", "rows with no issue")} — ${tr("colonnes", "columns")} « ${esc(head[iF] ?? iF)} » / « ${esc(head[iE] ?? iE)} ». ${tr("Le fichier n'a pas quitté votre navigateur.", "The file never left your browser.")}</p>`
        + (bad.length ? `<div class="t-scroll"><table class="t-table"><thead><tr><th>${tr("Référence", "Reference")}</th><th>${tr("Écarts", "Issues")}</th><th>${tr("Détail", "Detail")}</th></tr></thead><tbody>${bad.slice(0, 200).map(([s, n, d]) => `<tr><td class="mono">${esc(s)}</td><td class="num">${n}</td><td>${esc(d)}</td></tr>`).join("")}</tbody></table></div>` : "");
    });
  }

  // ---------- SignalDesk: official company card (French State register, live) ----------
  const TRANCHE = { "00": "0", "01": "1–2", "02": "3–5", "03": "6–9", "11": "10–19", "12": "20–49", "21": "50–99", "22": "100–199", "31": "200–249", "32": "250–499", "41": "500–999", "42": "1 000–1 999", "51": "2 000–4 999", "52": "5 000–9 999", "53": "10 000+" };
  const eur = (v) => new Intl.NumberFormat(FR ? "fr-FR" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  function card(c) {
    const today = new Date().toLocaleDateString(FR ? "fr-FR" : "en-GB");
    const age = c.date_creation ? Math.floor((Date.now() - new Date(c.date_creation)) / 3.15576e10) : null;
    const fin = c.finances ? Object.entries(c.finances).sort((a, b) => b[0] - a[0])[0] : null;
    const dir = (c.dirigeants || []).slice(0, 4).map((d) => esc([d.prenoms, d.nom, d.denomination].filter(Boolean).join(" ")) + (d.qualite ? ` <span class="t-mute">(${esc(d.qualite)})</span>` : "")).join("<br>");
    const src = `https://annuaire-entreprises.data.gouv.fr/entreprise/${encodeURIComponent(c.siren)}`;
    const sig = [];
    if (age !== null) sig.push(tr(`Créée il y a ${age} an${age > 1 ? "s" : ""} (${esc(c.date_creation)})`, `Founded ${age} year${age > 1 ? "s" : ""} ago (${esc(c.date_creation)})`));
    if (c.nombre_etablissements_ouverts > 1) sig.push(tr(`${c.nombre_etablissements_ouverts} établissements ouverts`, `${c.nombre_etablissements_ouverts} open sites`));
    if (fin) sig.push(tr(`Comptes ${esc(fin[0])} publiés`, `${esc(fin[0])} accounts published`));
    return `<article class="t-card">
<header><h3>${esc(c.nom_complet)}</h3><p class="mono">SIREN ${esc(c.siren)}</p></header>
${c.opposition_diffusion_commerciale ? `<p class="t-warn">${tr("Cette entreprise s'oppose à la prospection commerciale (statut Insee). Ne la démarchez pas.", "This company has opted out of commercial prospecting (Insee status). Do not contact it.")}</p>` : ""}
<dl class="facts">
<dt>${tr("État", "Status")}</dt><dd>${c.etat_administratif === "A" ? tr("Active", "Active") : tr("Fermée", "Closed")}</dd>
<dt>${tr("Activité (NAF)", "Activity (NAF)")}</dt><dd class="mono">${esc(c.activite_principale || "—")}</dd>
<dt>${tr("Catégorie", "Category")}</dt><dd>${esc(c.categorie_entreprise || "—")}</dd>
<dt>${tr("Effectif", "Headcount")}</dt><dd>${TRANCHE[c.tranche_effectif_salarie] ? esc(TRANCHE[c.tranche_effectif_salarie]) + tr(" salariés", " employees") + (c.annee_tranche_effectif_salarie ? ` (${esc(c.annee_tranche_effectif_salarie)})` : "") : tr("Non diffusé", "Not published")}</dd>
<dt>${tr("Siège", "Head office")}</dt><dd>${esc(c.siege?.adresse || "—")}</dd>
${fin ? `<dt>${tr("Chiffre d'affaires", "Revenue")} ${esc(fin[0])}</dt><dd class="num">${fin[1].ca != null ? eur(fin[1].ca) : "—"}${fin[1].resultat_net != null ? ` · ${tr("résultat", "net income")} ${eur(fin[1].resultat_net)}` : ""}</dd>` : ""}
${dir ? `<dt>${tr("Dirigeants", "Officers")}</dt><dd>${dir}</dd>` : ""}
</dl>
${sig.length ? `<p class="t-sig"><strong>${tr("Signaux publics", "Public signals")}</strong> ${sig.join(" · ")}</p>` : ""}
<p class="t-src">${tr("Source", "Source")} : <a href="${src}" rel="noopener" target="_blank">Annuaire des Entreprises (data.gouv.fr)</a> — ${tr("consulté le", "retrieved")} ${today}.</p>
</article>`;
  }
  function batch(root) {  // up to 20 names or SIRENs, one per line: registry status + prospecting opt-out, CSV export
    const f = $(".t-batch", root); if (!f) return;
    const out = $(".t-bres", root);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const lines = f.list.value.split(/\n/).map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 20);
      if (!lines.length) return; const rows = [];
      for (const [i, q] of lines.entries()) {
        out.innerHTML = `<p>${tr("Vérification", "Checking")} ${i + 1}/${lines.length}…</p>`;
        try {
          const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=1`); const c = (await r.json()).results?.[0];
          rows.push(c ? [q, c.nom_complet, c.siren, c.etat_administratif === "A" ? tr("active", "active") : tr("fermée", "closed"), c.opposition_diffusion_commerciale ? tr("OUI — ne pas démarcher", "YES — do not contact") : tr("non", "no"), c.siege?.libelle_commune || ""] : [q, tr("introuvable", "not found"), "", "", "", ""]);
        } catch { rows.push([q, tr("erreur registre", "register error"), "", "", "", ""]); }
        await new Promise((r) => setTimeout(r, 180));
      }
      const head = [tr("Recherche", "Query"), tr("Entreprise trouvée", "Company found"), "SIREN", tr("État", "Status"), tr("Opposition prospection", "Prospecting opt-out"), tr("Commune", "Town")];
      const opp = rows.filter((x) => /^(OUI|YES)/.test(x[4])).length;
      out.innerHTML = `<p><strong class="num">${opp}</strong> ${tr("entreprise(s) à ne pas démarcher sur", "company(ies) not to contact out of")} ${rows.length}. ${tr("Vérifiez que l'entreprise trouvée est bien celle visée.", "Check the company found is the one you meant.")}</p>
<p class="cta"><button class="btn ghost" type="button" data-bcsv>${tr("Exporter en CSV", "Export as CSV")}</button></p>
<div class="t-scroll"><table class="t-table"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((x) => `<tr${/^(OUI|YES)/.test(x[4]) ? ' class="t-optout"' : ""}>${x.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      $("[data-bcsv]", out).addEventListener("click", () => csvDownload("verification-registre.csv", [head, ...rows]));
    });
  }
  function signaldesk(root) {
    batch(root);
    const form = $("form", root), list = $(".t-res", root), st = $(".t-status", root);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault(); const q = form.q.value.trim(); if (q.length < 3) { st.textContent = tr("Saisissez au moins 3 caractères.", "Type at least 3 characters."); return; }
      st.textContent = tr("Recherche dans le registre officiel…", "Searching the official register…"); list.innerHTML = "";
      try {
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=5`);
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        st.textContent = d.total_results ? tr(`${d.total_results} résultat(s) — les 5 premiers :`, `${d.total_results} result(s) — first 5:`) : tr("Aucune entreprise trouvée.", "No company found.");
        list.innerHTML = (d.results || []).map((c, i) => `<details class="t-hit"${i === 0 ? " open" : ""}><summary><strong>${esc(c.nom_complet)}</strong> <span class="t-mute">${esc(c.siege?.libelle_commune || "")} · ${esc(c.siren)}</span></summary>${card(c)}</details>`).join("");
      } catch { st.textContent = tr("Registre momentanément indisponible. Réessayez dans un instant.", "Register temporarily unavailable. Please retry in a moment."); }
    });
  }

  // ---------- FlowPatch: payback calculator + automation readiness ----------
  function flowpatch(root) {
    const f = $("form", root), res = $(".t-res", root);
    const run = () => {
      const n = +f.n.value || 0, m = +f.m.value || 0, c = +f.c.value || 0, e = +f.e.value || 0;
      const hours = (n * m / 60) * 47, cost = hours * c * (1 + e / 100);
      const yes = [...f.querySelectorAll("input[type=checkbox]")].filter((x) => x.checked).length;
      const pay = cost > 0 ? (350 + 2000) / (cost / 12) : Infinity;
      const verdict = yes >= 4 ? tr("Bonne candidate : règles claires, données accessibles.", "Good candidate: clear rules, reachable data.")
        : yes >= 2 ? tr("Possible, mais commencez par le diagnostic pour lever les inconnues.", "Possible, but start with the diagnostic to clear the unknowns.")
        : tr("Pas encore prête : écrivez d'abord les règles et identifiez les données.", "Not ready yet: write the rules down and locate the data first.");
      res.innerHTML = `<div class="t-kpis"><div><span class="num">${Math.round(hours)} h</span><small>${tr("par an sur cette tâche", "per year on this task")}</small></div>
<div><span class="num">${Math.round(cost).toLocaleString(FR ? "fr-FR" : "en-US")} USD</span><small>${tr("coût annuel estimé, reprises comprises", "estimated yearly cost, rework included")}</small></div>
<div><span class="num">${isFinite(pay) ? (pay < 1 ? "< 1" : Math.ceil(pay)) : "—"} ${tr("mois", "months")}</span><small>${tr("pour rembourser diagnostic + réalisation (dès 2 350 USD)", "to pay back diagnostic + build (from USD 2,350)")}</small></div></div>
<p class="t-verdict" data-level="${yes >= 4 ? "ok" : yes >= 2 ? "mid" : "bad"}"><strong>${yes}/5</strong> — ${verdict}</p>
<p class="t-mute">${tr("Hypothèses : 47 semaines travaillées par an ; coût horaire chargé saisi en USD ; estimation indicative, pas une promesse de gain.", "Assumptions: 47 working weeks a year; loaded hourly cost entered in USD; an indicative estimate, not a promised saving.")}</p>`;
    };
    f.addEventListener("input", run); f.addEventListener("submit", (ev) => ev.preventDefault()); run();
  }

  // ---------- CareerLift: CV vs job offer analysis ----------
  const STOP = new Set(("a au aux avec ce ces dans de des du elle en et eux il je la le les leur lui ma mais me même mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous " +
    "c d j l m n s t y ete etre avoir fait faire plus tres tout tous toute toutes ainsi afin chez entre sans sous dont cette cet " +
    "the and or of to in for with on at by from as is are be will an our your you we this that these those it its their they them who what which " +
    "poste profil mission missions candidat candidate job role team equipe entreprise company cdi cdd temps plein full time years ans experience").split(" "));
  const RISKY = /(?<!\p{L})(fluent|bilingual|native|expert|guru|ninja|rockstar|passionate|dynamic|motivated|hard-working|team player|perfectionist|dynamique|motivée?|passionnée?|rigoureuse?|rigoureux|autonome|bilingue|courant)(?!\p{L})/giu;
  const PERSO = [[/\b(né|née|born)\b|\b\d{1,2}\/\d{1,2}\/(19|20)\d{2}\b/i, tr("date de naissance", "date of birth")], [/\b\d{2}\s?ans\b|\bage\s?:?\s?\d{2}\b/i, tr("âge", "age")],
    [/\b(marié|mariée|célibataire|married|single|divorcé)/i, tr("situation familiale", "marital status")], [/\bnationalit/i, tr("nationalité", "nationality")], [/\bphoto\b/i, "photo"]];
  const stem = (w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w);
  const lang = (s) => { const w = fold(s).split(/\W+/); const fr = w.filter((x) => ["le", "la", "les", "des", "et", "de", "du", "vous", "pour", "avec"].includes(x)).length;
    const en = w.filter((x) => ["the", "and", "you", "with", "for", "will", "our", "your", "of", "to"].includes(x)).length; return fr > en ? "fr" : en > fr ? "en" : ""; };
  const words = (s) => fold(s).replace(/[^a-z0-9+#.\-\s]/g, " ").split(/\s+/).map((w) => w.replace(/^[.\-]+|[.\-]+$/g, "")).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem);
  function careerlift(root) {
    const cv = $("[name=cv]", root), job = $("[name=job]", root), res = $(".t-res", root), score = $(".t-score", root);
    const run = () => {
      const jw = words(job.value), cw = new Set(words(cv.value)), freq = {};
      jw.forEach((w) => (freq[w] = (freq[w] || 0) + 1));
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 20).map(([w]) => w);
      const miss = top.filter((w) => !cw.has(w)), cov = top.length ? Math.round(((top.length - miss.length) / top.length) * 100) : 0;
      const lines = cv.value.split(/\n/).filter((l) => l.trim().length > 15), quant = lines.filter((l) => /\d/.test(l)).length;
      const risky = [...new Set((cv.value.match(RISKY) || []).map((w) => w.toLowerCase()))];
      const perso = PERSO.filter(([re]) => re.test(cv.value)).map(([, l]) => l);
      const n = (cv.value.match(/\S+/g) || []).length;
      score.innerHTML = `<strong class="num">${cov} %</strong> ${tr("des mots-clés de l'offre présents dans le CV", "of the job's keywords found in the CV")}`;
      score.dataset.level = cov >= 70 ? "ok" : cov >= 45 ? "mid" : "bad";
      const lc = lang(cv.value), lj = lang(job.value), mixed = lc && lj && lc !== lj;
      res.innerHTML = `<ul class="t-list">
${mixed ? row(null, tr("Le CV et l'offre ne sont pas dans la même langue : comparez l'offre avec la version de votre CV écrite dans sa langue.", "The CV and the job are not in the same language: compare the job with the version of your CV written in its language.")) : ""}
${row(miss.length < 6, miss.length ? tr(`Mots de l'offre absents du CV : ${miss.map(esc).join(", ")}. Ajoutez-les seulement s'ils décrivent une expérience réelle.`, `Job words missing from the CV: ${miss.map(esc).join(", ")}. Add them only if they describe real experience.`) : tr("Les mots importants de l'offre sont couverts.", "The job's key words are covered."))}
${row(quant >= lines.length * 0.3, tr(`${quant} ligne(s) sur ${lines.length} contiennent un chiffre (volume, délai, budget). Chiffrez ce qui est réel et vérifiable.`, `${quant} of ${lines.length} line(s) contain a number (volume, time, budget). Quantify what is real and verifiable.`))}
${row(!risky.length, risky.length ? tr(`Mots à justifier ou retirer : ${risky.map(esc).join(", ")} — un recruteur les vérifiera en entretien.`, `Words to back up or remove: ${risky.map(esc).join(", ")} — a recruiter will test them in interview.`) : tr("Pas d'adjectif creux ni de niveau non prouvé.", "No empty adjectives or unproven levels."))}
${row(!perso.length, perso.length ? tr(`Pour le Royaume-Uni et les États-Unis, retirez : ${perso.map(esc).join(", ")}.`, `For the UK and the US, remove: ${perso.map(esc).join(", ")}.`) : tr("Aucune information personnelle à retirer pour un CV anglophone.", "No personal details to remove for an English-language CV."))}
${row(n >= 250 && n <= 900, tr(`${n} mots : ${n < 250 ? "un peu court, détaillez vos réalisations" : n > 900 ? "long, resserrez sur ce qui sert l'offre" : "longueur adaptée"}.`, `${n} words: ${n < 250 ? "a little short, detail your achievements" : n > 900 ? "long, focus on what serves the job" : "suitable length"}.`))}
</ul>`;
    };
    cv.addEventListener("input", debounce(run, 350)); job.addEventListener("input", debounce(run, 350)); run();
  }

  // ---------- Soumissio: public tenders (BOAMP open data, live) ----------
  const BOAMP = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records";
  const qstr = (s) => String(s).replace(/["\\]/g, " ").trim();
  function csvDownload(name, rows) {
    const c = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + c], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function soumissio(root) {
    const form = $("form", root), list = $(".t-res", root), st = $(".t-status", root);
    let last = [];
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const q = qstr(form.q.value), dep = form.dep.value.trim().toUpperCase(), mode = form.mode.value;
      if (q.length < 3) { st.textContent = tr("Saisissez au moins 3 caractères.", "Type at least 3 characters."); return; }
      if (dep && !/^(\d{1,3}|2A|2B)$/.test(dep)) { st.textContent = tr("Département : un numéro comme 69, 2A ou 974.", "Département: a number like 69, 2A or 974."); return; }
      const where = [`search(objet, "${q}")`]; if (dep) where.push(`code_departement="${dep.replace(/^0(?=\d$)/, "")}"`);
      if (mode === "open") where.push("datelimitereponse>now()"); else where.push("titulaire is not null", "dateparution>=now(months=-12)");
      const p = new URLSearchParams({ limit: mode === "open" ? "50" : "100", where: where.join(" and "), order_by: mode === "open" ? "datelimitereponse asc" : "dateparution desc" });
      st.textContent = tr("Recherche dans le BOAMP…", "Searching BOAMP…"); list.innerHTML = "";
      try {
        const r = await fetch(`${BOAMP}?${p}`); if (!r.ok) throw new Error(String(r.status));
        const d = await r.json(); last = d.results || [];
        const today = new Date().toLocaleDateString(FR ? "fr-FR" : "en-GB");
        if (!last.length) { st.textContent = tr("Aucune annonce trouvée. Essayez un mot plus général.", "No notice found. Try a broader word."); return; }
        const csvBtn = `<p class="cta"><button class="btn ghost" type="button" data-csv>${tr("Exporter en CSV", "Export as CSV")}</button></p>`;
        if (mode === "open") {
          st.textContent = tr(`${d.total_count} appel(s) d'offres ouvert(s) — source BOAMP, consulté le ${today}.`, `${d.total_count} open tender(s) — source BOAMP, retrieved ${today}.`);
          list.innerHTML = csvBtn + `<ul class="t-tenders">${last.map((x) => {
            const days = Math.ceil((new Date(x.datelimitereponse) - Date.now()) / 864e5);
            const lvl = days <= 7 ? "bad" : days <= 14 ? "mid" : "ok";
            return `<li><span class="t-due" data-level="${lvl}"><strong class="num">J-${days}</strong><small>${esc(new Date(x.datelimitereponse).toLocaleDateString(FR ? "fr-FR" : "en-GB"))}</small></span>
<span class="t-tbody"><a href="${esc(x.url_avis)}" rel="noopener" target="_blank">${esc(x.objet)}</a><small>${esc(x.nomacheteur)} · ${tr("dép.", "dept")} ${esc((x.code_departement || []).join(", "))} · ${esc(x.procedure_libelle || x.type_procedure || "")} · ${esc((x.type_marche || []).join(", "))}</small></span></li>`; }).join("")}</ul>`;
        } else {
          const count = {}; last.forEach((x) => [...new Set(x.titulaire || [])].forEach((t) => { const k = t.trim().toUpperCase(); if (k) count[k] = (count[k] || 0) + 1; }));
          const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 12);
          st.textContent = tr(`${d.total_count} marché(s) attribué(s) sur 12 mois — analyse des ${last.length} plus récents, source BOAMP, consulté le ${today}.`, `${d.total_count} awarded contract(s) over 12 months — the latest ${last.length} analysed, source BOAMP, retrieved ${today}.`);
          list.innerHTML = csvBtn + `<h3 class="t-h3">${tr("Qui remporte ces marchés", "Who wins these contracts")}</h3><ol class="t-rank">${top.map(([n, c]) => `<li><span>${esc(n)}</span><strong class="num">${c}</strong></li>`).join("")}</ol>
<h3 class="t-h3">${tr("Derniers résultats", "Latest awards")}</h3><ul class="t-tenders">${last.slice(0, 15).map((x) => `<li><span class="t-tbody"><a href="${esc(x.url_avis)}" rel="noopener" target="_blank">${esc(x.objet)}</a><small>${esc(x.nomacheteur)} · ${esc(x.dateparution)} · ${tr("titulaire(s)", "winner(s)")} : ${esc([...new Set(x.titulaire || [])].join(", "))}</small></span></li>`).join("")}</ul>`;
        }
        $("[data-csv]", list).addEventListener("click", () => csvDownload(`boamp-${mode}-${q.slice(0, 20).replace(/\W+/g, "-")}.csv`,
          [["idweb", "objet", "acheteur", "departements", "parution", "date_limite", "procedure", "titulaires", "lien"],
           ...last.map((x) => [x.idweb, x.objet, x.nomacheteur, (x.code_departement || []).join(" "), x.dateparution, x.datelimitereponse || "", x.procedure_libelle || "", [...new Set(x.titulaire || [])].join(" | "), x.url_avis])]));
      } catch { st.textContent = tr("BOAMP momentanément indisponible. Réessayez dans un instant.", "BOAMP temporarily unavailable. Please retry in a moment."); }
    });
  }

  // ---------- Solvaro: client credit risk (BODACC open data + company register, live) ----------
  const BODACC = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
  const jparse = (v) => { if (!v) return {}; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return {}; } };
  const addMonths = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, d)); };
  const dfmt = (dt) => new Date(dt).toLocaleDateString(FR ? "fr-FR" : "en-GB", { timeZone: "UTC" });
  // Written rules, no AI: the newest official notice wins. Returns {level: bad|mid|ok, why, deadline?, days?, url?}
  const U = (u) => (/^https:\/\/www\.bodacc\.fr\//.test(u || "") ? u : "");  // only official links reach href
  function riskOf(recs, now = Date.now(), closed = false) {
    const by = (f) => recs.filter((r) => r.familleavis === f).sort((a, b) => (a.dateparution < b.dateparution ? 1 : -1));
    const col = by("collective")[0], rad = by("radiation")[0], dpc = by("dpc")[0];
    const age = (r) => (now - Date.parse(r.dateparution)) / 864e5;
    if (rad && (!col || rad.dateparution >= col.dateparution)) return { level: "bad", why: tr(`Radiée du registre (BODACC du ${dfmt(rad.dateparution)})`, `Deregistered (BODACC ${dfmt(rad.dateparution)})`), url: U(rad.url_complete) };
    if (col && age(col) < 3 * 365) {
      const j = jparse(col.jugement), nat = j.nature || j.famille || col.familleavis_lib || "";
      const out = { level: /sauvegarde/i.test(nat) && !/liquidation|redressement/i.test(nat) ? "mid" : "bad", why: nat, url: U(col.url_complete), detail: String(j.complementJugement || "").slice(0, 260), court: col.tribunal };
      if (/ouverture/i.test(`${j.famille} ${nat}`)) { const dl = addMonths(col.dateparution, 2); out.deadline = dl; out.days = Math.ceil((dl - now) / 864e5); }
      return out;
    }
    if (closed) return { level: "bad", why: tr("Fermée au registre des entreprises", "Closed in the company register") };
    if (col) return { level: "mid", why: tr(`Procédure collective ancienne (${col.dateparution.slice(0, 4)})`, `Older insolvency proceeding (${col.dateparution.slice(0, 4)})`), url: U(col.url_complete) };
    if (dpc && age(dpc) > 2 * 365) return { level: "mid", why: tr(`Aucuns comptes publiés depuis le ${dfmt(dpc.dateparution)}`, `No accounts published since ${dfmt(dpc.dateparution)}`), url: U(dpc.url_complete) };
    const cl = dpc && jparse(dpc.depot).dateCloture;
    return { level: "ok", why: dpc ? tr(`Aucune procédure · comptes${cl ? ` clos le ${dfmt(cl)}` : ""} publiés`, `No proceeding · accounts${cl ? ` closed ${dfmt(cl)}` : ""} published`) : tr("Aucune procédure publiée au BODACC", "No proceeding published in BODACC") };
  }
  const LV = { bad: tr("Rouge", "Red"), mid: tr("Orange", "Amber"), ok: tr("Vert", "Green") };
  function solvaro(root) {
    const form = $("form", root), list = $(".t-res", root), st = $(".t-status", root), mine = $(".t-mine", root), depL = $(".t-dep", root);
    form.addEventListener("change", () => { const d = form.mode.value === "dep"; mine.hidden = d; depL.hidden = !d; });
    const bod = async (where, limit) => {
      const p = new URLSearchParams({ where, limit: String(limit), order_by: "dateparution desc", select: "dateparution,familleavis,familleavis_lib,jugement,tribunal,commercant,registre,ville,depot,url_complete" });
      const r = await fetch(`${BODACC}?${p}`); if (!r.ok) throw new Error(String(r.status)); return (await r.json()).results || [];
    };
    const csvBtn = `<p class="cta"><button class="btn ghost" type="button" data-csv>${tr("Exporter en CSV", "Export as CSV")}</button></p>`;
    const dl = (x) => x.deadline ? `<small class="t-dl" data-level="${x.days < 0 ? "ok" : x.days <= 15 ? "bad" : "mid"}">${x.days < 0 ? tr(`Délai de déclaration de créance dépassé le ${dfmt(x.deadline)}`, `Claim deadline passed on ${dfmt(x.deadline)}`) : tr(`Déclarer votre créance avant le ${dfmt(x.deadline)} — J-${x.days}`, `File your claim by ${dfmt(x.deadline)} — D-${x.days}`)}</small>` : "";
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault(); list.innerHTML = ""; const today = dfmt(Date.now());
      try {
        if (form.mode.value === "dep") {
          const dep = form.dep.value.trim().toUpperCase();
          if (!/^(\d{2,3}|2A|2B)$/.test(dep)) { st.textContent = tr("Département : un numéro comme 69, 2A ou 974.", "Département: a number like 69, 2A or 974."); return; }
          st.textContent = tr("Recherche dans le BODACC…", "Searching BODACC…");
          const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
          const rows = await bod(`familleavis="collective" and numerodepartement="${dep}" and dateparution>=date'${since}'`, 60);
          // Sole traders are people: their names are masked even though BODACC is public.
          const items = rows.map((r) => {
            const x = riskOf([r]); const ei = !r.registre || /\(EI\)|EIRL|entrepreneur individuel/i.test(r.commercant || "");
            return { ...x, name: ei ? tr("Entrepreneur individuel (nom masqué)", "Sole trader (name hidden)") : r.commercant, siren: ei ? "" : String((r.registre || [""])[0]).replace(/\s/g, ""), city: r.ville, date: r.dateparution };
          });
          st.textContent = tr(`${items.length} jugement(s) publié(s) en 30 jours dans le ${dep} — source BODACC, consulté le ${today}.`, `${items.length} judgment(s) published in 30 days in ${dep} — source BODACC, retrieved ${today}.`);
          if (!items.length) return;
          list.innerHTML = csvBtn + `<ul class="t-tenders">${items.map((x) => `<li><span class="t-due" data-level="${x.level}"><strong>${esc(dfmt(x.date))}</strong></span><span class="t-tbody"><a href="${esc(x.url)}" rel="noopener" target="_blank">${esc(x.name)}</a><small>${esc(x.city || "")}${x.siren ? ` · SIREN ${esc(x.siren)}` : ""} · ${esc(x.why)}</small>${dl(x)}</span></li>`).join("")}</ul>`;
          $("[data-csv]", list).addEventListener("click", () => csvDownload(`bodacc-${dep}.csv`, [["date", "entreprise", "siren", "ville", "jugement", "date_limite_creance", "lien"], ...items.map((x) => [x.date, x.name, x.siren, x.city, x.why, x.deadline ? x.deadline.toISOString().slice(0, 10) : "", x.url])]));
          return;
        }
        const lines = form.list.value.split(/\n/).map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 20);
        if (!lines.length) { st.textContent = tr("Collez au moins un nom ou un SIREN.", "Paste at least one name or SIREN."); return; }
        const out = [];
        for (const [i, q] of lines.entries()) {
          st.textContent = tr(`Vérification ${i + 1}/${lines.length}…`, `Checking ${i + 1}/${lines.length}…`);
          try {
            const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=1`); const c = (await r.json()).results?.[0];
            if (!c) { out.push({ q, name: tr("Introuvable au registre", "Not found in the register"), level: "mid", why: tr("Vérifiez le nom ou donnez le SIREN", "Check the name or give the SIREN") }); continue; }
            const x = riskOf(await bod(`registre="${c.siren}"`, 40), Date.now(), c.etat_administratif !== "A");
            out.push({ q, name: c.nom_complet, siren: c.siren, city: c.siege?.libelle_commune || "", ...x });
          } catch { out.push({ q, name: q, level: "mid", why: tr("Source momentanément indisponible", "Source temporarily unavailable") }); }
          await new Promise((r) => setTimeout(r, 160));
        }
        const n = (l) => out.filter((x) => x.level === l).length;
        st.textContent = tr(`${out.length} client(s) : ${n("bad")} rouge, ${n("mid")} orange, ${n("ok")} vert — sources BODACC et registre, consulté le ${today}.`, `${out.length} client(s): ${n("bad")} red, ${n("mid")} amber, ${n("ok")} green — sources BODACC and register, retrieved ${today}.`);
        out.sort((a, b) => "bad mid ok".indexOf(a.level) - "bad mid ok".indexOf(b.level));
        list.innerHTML = csvBtn + `<ul class="t-tenders">${out.map((x) => `<li><span class="t-due" data-level="${x.level}"><strong>${LV[x.level]}</strong></span><span class="t-tbody">${x.url ? `<a href="${esc(x.url)}" rel="noopener" target="_blank">${esc(x.name)}</a>` : `<strong>${esc(x.name)}</strong>`}<small>${x.siren ? `SIREN ${esc(x.siren)} · ` : ""}${esc(x.city || "")}${x.court ? ` · ${esc(x.court)}` : ""}</small><em>${esc(x.why)}</em>${dl(x)}${x.detail ? `<details><summary>${tr("Extrait du jugement", "Judgment excerpt")}</summary><p>${esc(x.detail)}…</p></details>` : ""}</span></li>`).join("")}</ul>`;
        $("[data-csv]", list).addEventListener("click", () => csvDownload("solvaro-controle-clients.csv", [["saisie", "entreprise", "siren", "niveau", "signal", "date_limite_creance", "lien"], ...out.map((x) => [x.q, x.name, x.siren || "", LV[x.level], x.why, x.deadline ? x.deadline.toISOString().slice(0, 10) : "", x.url || ""])]));
      } catch { st.textContent = tr("BODACC momentanément indisponible. Réessayez dans un instant.", "BODACC temporarily unavailable. Please retry in a moment."); }
    });
  }

  // ---------- Hub: which service fits ----------
  function hub(root) {
    const f = $("form", root), res = $(".t-res", root), map = JSON.parse(root.dataset.map || "{}");
    f.addEventListener("change", () => {
      const m = map[f.need.value]; if (!m) return;
      res.innerHTML = `<p class="t-pick"><strong>${esc(m[0])}</strong> — ${esc(m[1])}</p><p class="cta"><a class="btn" href="${esc(m[2])}">${tr("Voir le service et son exemple", "See the service and its sample")}</a> <a class="btn ghost" href="${esc(m[3])}">${tr("Essayer l'outil gratuit", "Try the free tool")}</a></p>`;
    });
  }

  if (DOC) { const RUN = { localoom, signaldesk, flowpatch, careerlift, soumissio, solvaro, hub }; document.querySelectorAll("[data-tool]").forEach((el) => RUN[el.dataset.tool]?.(el)); }
  if (typeof module !== "undefined") module.exports = { checkPair, nums, csvParse, words, riskOf };  // node self-test only
})();
