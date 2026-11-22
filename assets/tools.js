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
  function signaldesk(root) {
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

  // ---------- Hub: which service fits ----------
  function hub(root) {
    const f = $("form", root), res = $(".t-res", root), map = JSON.parse(root.dataset.map || "{}");
    f.addEventListener("change", () => {
      const m = map[f.need.value]; if (!m) return;
      res.innerHTML = `<p class="t-pick"><strong>${esc(m[0])}</strong> — ${esc(m[1])}</p><p class="cta"><a class="btn" href="${esc(m[2])}">${tr("Voir le service et son exemple", "See the service and its sample")}</a> <a class="btn ghost" href="${esc(m[3])}">${tr("Essayer l'outil gratuit", "Try the free tool")}</a></p>`;
    });
  }

  if (DOC) { const RUN = { localoom, signaldesk, flowpatch, careerlift, hub }; document.querySelectorAll("[data-tool]").forEach((el) => RUN[el.dataset.tool]?.(el)); }
  if (typeof module !== "undefined") module.exports = { checkPair, nums, csvParse, words };  // node self-test only
})();
