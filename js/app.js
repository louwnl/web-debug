// Interface de l'aide au diagnostic : choix de l'OS, parcours guidé, catalogue,
// et session de dépannage (observations, notes, valeurs, compte rendu).
// Les données viennent de data/commandes.js et data/parcours.js (window.WEBDEBUG).

(function () {
  const { commandes, categories, parcours, couches } = window.WEBDEBUG;
  const NOMS_OS = { windows: "Windows", macos: "macOS", linux: "Linux" };

  // Libellés des valeurs à remplacer dans les commandes (<cible>, <passerelle>…).
  const LIBELLES_VALEURS = {
    cible: "Cible (nom ou IP)",
    passerelle: "Passerelle",
    interface: "Interface (ex. Ethernet, en0, eth0)",
    port: "Port",
    connexion: "Connexion NetworkManager",
    "mon-ip": "IP de la machine",
    "serveur-iperf": "Serveur iperf3",
    pid: "PID",
    valeur: "Valeur MTU",
  };
  const MOTIF_VALEUR = /<([a-z0-9-]+)>/gi;

  // --- Stockage local (absent en navigation privée stricte : on s'en passe) ---
  function lire(cle) {
    try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; }
  }
  function ecrire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* sans importance */ }
  }

  function nouvelleSession() {
    return {
      debut: new Date().toISOString(),
      // Étapes déjà franchies : [{ id, reponse }]. L'étape courante n'en fait pas partie.
      chemin: [],
      courante: parcours.depart,
      observations: {},
      notes: "",
      valeurs: {},
    };
  }

  function sessionValide(s) {
    return s && Array.isArray(s.chemin) && (parcours.etapes[s.courante] || parcours.conclusions[s.courante])
      && s.chemin.every((pas) => parcours.etapes[pas.id]);
  }

  const osEnregistre = lire("webdebug-os");
  const sessionEnregistree = lire("webdebug-session");
  const etat = {
    os: osEnregistre in NOMS_OS ? osEnregistre : "windows",
    session: sessionValide(sessionEnregistree) ? { ...nouvelleSession(), ...sessionEnregistree } : nouvelleSession(),
  };
  const sauver = () => ecrire("webdebug-session", etat.session);

  const el = {
    os: document.getElementById("os"),
    ongletGuide: document.getElementById("onglet-guide"),
    ongletCatalogue: document.getElementById("onglet-catalogue"),
    vueGuide: document.getElementById("vue-guide"),
    vueCatalogue: document.getElementById("vue-catalogue"),
    fil: document.getElementById("fil"),
    etape: document.getElementById("etape"),
    notes: document.getElementById("notes"),
    valeursGuide: document.getElementById("valeurs-guide"),
    valeursCatalogue: document.getElementById("valeurs-catalogue"),
    recherche: document.getElementById("recherche"),
    liste: document.getElementById("liste-commandes"),
  };

  // --- Outils d'affichage -----------------------------------------------------
  function echapper(texte) {
    return String(texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Remplace les valeurs connues ; celles qui restent gardent leurs chevrons.
  function remplir(texte) {
    return texte.replace(MOTIF_VALEUR, (tout, nom) => etat.session.valeurs[nom] || tout);
  }

  // Version HTML : valeurs remplies et valeurs manquantes sont mises en évidence.
  function remplirHtml(texte) {
    let html = "";
    let dernier = 0;
    for (const m of texte.matchAll(MOTIF_VALEUR)) {
      const valeur = etat.session.valeurs[m[1]];
      html += echapper(texte.slice(dernier, m.index));
      html += valeur
        ? `<span class="var remplie" title="${echapper(m[0])}">${echapper(valeur)}</span>`
        : `<span class="var">${echapper(m[0])}</span>`;
      dernier = m.index + m[0].length;
    }
    return html + echapper(texte.slice(dernier));
  }

  function valeursDe(textes) {
    const noms = new Set();
    for (const t of textes) for (const m of t.matchAll(MOTIF_VALEUR)) noms.add(m[1]);
    return [...noms];
  }

  function textesDeCommande(id) {
    const v = commandes[id].os[etat.os];
    return v ? [v.cmd] : [];
  }

  function blocCommande(id) {
    const c = commandes[id];
    const variante = c.os[etat.os];
    const corps = variante
      ? `<div class="ligne-cmd">
           <pre><code data-cmd-id="${id}">${remplirHtml(variante.cmd)}</code></pre>
           <button type="button" class="copier" data-cmd-id="${id}">Copier</button>
         </div>
         ${variante.note ? `<p class="note">${echapper(variante.note)}</p>` : ""}`
      : `<p class="absente">Pas d'équivalent sous ${NOMS_OS[etat.os]}.</p>`;
    return `<div class="commande">
      <h3>${echapper(c.titre)}</h3>
      ${corps}
      <details class="lecture"><summary>Comment lire le résultat</summary><p>${echapper(c.lecture)}</p></details>
    </div>`;
  }

  // Champs pour les valeurs utilisées par les commandes affichées.
  function afficherValeurs(conteneur, noms) {
    if (!noms.length) {
      conteneur.hidden = true;
      conteneur.innerHTML = "";
      return;
    }
    conteneur.hidden = false;
    conteneur.innerHTML = `<p class="titre-valeurs">Valeurs à remplacer dans les commandes</p>
      <div class="champs-valeurs">${noms.map((nom) => `<label>
        <span>${echapper(LIBELLES_VALEURS[nom] || nom)}</span>
        <input type="text" data-valeur="${echapper(nom)}" value="${echapper(etat.session.valeurs[nom] || "")}" placeholder="&lt;${echapper(nom)}&gt;" spellcheck="false" autocomplete="off">
      </label>`).join("")}</div>`;
  }

  // Après la saisie d'une valeur, on ne redessine que les commandes, pour garder le focus.
  function rafraichirCommandes() {
    document.querySelectorAll("code[data-cmd-id]").forEach((code) => {
      const v = commandes[code.dataset.cmdId].os[etat.os];
      if (v) code.innerHTML = remplirHtml(v.cmd);
    });
    document.querySelectorAll("[data-action-texte]").forEach((li) => {
      li.innerHTML = remplirHtml(li.dataset.actionTexte);
    });
  }

  // --- Parcours guidé ---------------------------------------------------------
  function titreDe(id) {
    return (parcours.etapes[id] || parcours.conclusions[id]).titre;
  }

  function afficherFil() {
    const { chemin } = etat.session;
    el.fil.innerHTML = chemin
      .map((pas, i) => `<li><button type="button" data-retour="${i}" title="Réponse : ${echapper(pas.reponse)}">${echapper(titreDe(pas.id))}</button></li>`)
      .join("");
    el.fil.hidden = chemin.length === 0;
  }

  function afficherEtape() {
    afficherFil();
    const { courante: id, chemin, observations } = etat.session;
    const etape = parcours.etapes[id];
    const navigation = chemin.length
      ? `<div class="actions-nav">
          <button type="button" class="secondaire" data-action="precedent">← Étape précédente</button>
          <button type="button" class="secondaire" data-action="recommencer">Recommencer le parcours</button>
        </div>`
      : "";

    if (!etape) {
      const fin = parcours.conclusions[id];
      afficherValeurs(el.valeursGuide, valeursDe(fin.actions));
      el.etape.innerHTML = `<article class="carte conclusion">
        <span class="couche">Diagnostic</span>
        <h2>${echapper(fin.titre)}</h2>
        <p>${echapper(fin.diagnostic)}</p>
        <h3>Que faire</h3>
        <ol>${fin.actions.map((a) => `<li data-action-texte="${echapper(a)}">${remplirHtml(a)}</li>`).join("")}</ol>
        <div class="actions-nav">
          <button type="button" class="principal" data-action="exporter">Copier le compte rendu</button>
          <button type="button" class="secondaire" data-action="telecharger">Télécharger (.txt)</button>
        </div>
        ${navigation}
      </article>`;
      return;
    }

    afficherValeurs(el.valeursGuide, valeursDe((etape.commandes || []).flatMap(textesDeCommande)));
    el.etape.innerHTML = `<article class="carte">
      <span class="couche">${echapper(couches[etape.couche])}</span>
      <h2>${echapper(etape.titre)}</h2>
      ${etape.aide ? `<p class="aide">${echapper(etape.aide)}</p>` : ""}
      ${(etape.commandes || []).map(blocCommande).join("")}
      <label class="observation">
        <span>Ce que j'observe (facultatif, repris dans le compte rendu)</span>
        <textarea data-observation="${id}" rows="2" placeholder="Ex. IP 169.254.12.4, pas de passerelle">${echapper(observations[id] || "")}</textarea>
      </label>
      <p class="question">${echapper(etape.question)}</p>
      <div class="reponses">
        ${etape.reponses.map((r, i) => `<button type="button" data-reponse="${i}">${echapper(r.texte)}</button>`).join("")}
      </div>
      ${navigation}
    </article>`;
  }

  function repondre(index) {
    const s = etat.session;
    const reponse = parcours.etapes[s.courante].reponses[index];
    s.chemin.push({ id: s.courante, reponse: reponse.texte });
    s.courante = reponse.suite;
    sauver();
    afficherEtape();
    el.etape.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function revenirA(index) {
    const s = etat.session;
    s.courante = s.chemin[index].id;
    s.chemin = s.chemin.slice(0, index);
    sauver();
    afficherEtape();
  }

  // --- Compte rendu -----------------------------------------------------------
  function compteRendu() {
    const s = etat.session;
    const date = (iso) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    const lignes = [
      "COMPTE RENDU DE DIAGNOSTIC RÉSEAU",
      `Début : ${date(s.debut)}    Fin : ${date(new Date().toISOString())}`,
      `Système dépanné : ${NOMS_OS[etat.os]}`,
    ];
    const valeurs = Object.entries(s.valeurs).filter(([, v]) => v);
    if (valeurs.length) lignes.push(`Valeurs : ${valeurs.map(([n, v]) => `${n} = ${v}`).join(", ")}`);

    lignes.push("", "ÉTAPES");
    const pas = [...s.chemin];
    if (parcours.etapes[s.courante]) pas.push({ id: s.courante, reponse: null });
    pas.forEach((p, i) => {
      const e = parcours.etapes[p.id];
      lignes.push(`${i + 1}. [${couches[e.couche]}] ${e.titre}`);
      if (s.observations[p.id]) lignes.push(`   Observé : ${s.observations[p.id].trim().replace(/\n/g, "\n             ")}`);
      lignes.push(p.reponse ? `   Réponse : ${p.reponse}` : "   (étape en cours, pas encore de réponse)");
    });

    const fin = parcours.conclusions[s.courante];
    lignes.push("", "DIAGNOSTIC");
    if (fin) {
      lignes.push(fin.titre, fin.diagnostic, "", "À faire :");
      fin.actions.forEach((a) => lignes.push(`- ${remplir(a)}`));
    } else {
      lignes.push("Pas encore de conclusion.");
    }

    if (s.notes.trim()) lignes.push("", "NOTES", s.notes.trim());
    return lignes.join("\n") + "\n";
  }

  async function copierTexte(texte) {
    try {
      await navigator.clipboard.writeText(texte);
    } catch (e) {
      // Repli pour les navigateurs qui refusent l'API (page ouverte depuis le disque, par exemple).
      const zone = document.createElement("textarea");
      zone.value = texte;
      document.body.appendChild(zone);
      zone.select();
      document.execCommand("copy");
      zone.remove();
    }
  }

  function confirmer(bouton, texte) {
    const avant = bouton.textContent;
    bouton.textContent = texte;
    setTimeout(() => { bouton.textContent = avant; }, 1500);
  }

  function telecharger() {
    const d = new Date();
    const deux = (n) => String(n).padStart(2, "0");
    const horodatage = `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}-${deux(d.getHours())}h${deux(d.getMinutes())}`;
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([compteRendu()], { type: "text/plain;charset=utf-8" }));
    lien.download = `diagnostic-reseau-${horodatage}.txt`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  }

  // --- Catalogue --------------------------------------------------------------
  function normaliser(texte) {
    return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function afficherCatalogue() {
    const termes = normaliser(el.recherche.value).split(/\s+/).filter(Boolean);
    const correspond = (id, c) => {
      const v = c.os[etat.os];
      const texte = normaliser([id, c.titre, categories[c.categorie], c.lecture, v ? v.cmd : "", v && v.note ? v.note : ""].join(" "));
      return termes.every((t) => texte.includes(t));
    };

    const affichees = [];
    const html = Object.entries(categories)
      .map(([cat, nom]) => {
        const trouvees = Object.entries(commandes).filter(([id, c]) => c.categorie === cat && correspond(id, c));
        if (!trouvees.length) return "";
        affichees.push(...trouvees.map(([id]) => id));
        return `<div class="categorie"><h2>${echapper(nom)}</h2>
          ${trouvees.map(([id]) => `<div class="carte">${blocCommande(id)}</div>`).join("")}
        </div>`;
      })
      .join("");
    el.liste.innerHTML = html || '<p class="vide">Aucune commande ne correspond.</p>';
    afficherValeurs(el.valeursCatalogue, valeursDe(affichees.flatMap(textesDeCommande)));
  }

  // --- Onglets ----------------------------------------------------------------
  function ouvrirOnglet(nom) {
    const guide = nom === "guide";
    el.ongletGuide.setAttribute("aria-selected", guide);
    el.ongletCatalogue.setAttribute("aria-selected", !guide);
    el.vueGuide.hidden = !guide;
    el.vueCatalogue.hidden = guide;
    // Les valeurs saisies dans une vue doivent apparaître dans l'autre.
    if (guide) afficherEtape();
    else { afficherCatalogue(); el.recherche.focus(); }
  }

  // --- Événements ---------------------------------------------------------------
  el.os.value = etat.os;
  el.os.addEventListener("change", () => {
    etat.os = el.os.value;
    ecrire("webdebug-os", etat.os);
    afficherEtape();
    afficherCatalogue();
  });

  el.ongletGuide.addEventListener("click", () => ouvrirOnglet("guide"));
  el.ongletCatalogue.addEventListener("click", () => ouvrirOnglet("catalogue"));
  el.recherche.addEventListener("input", afficherCatalogue);

  el.notes.value = etat.session.notes;

  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t === el.notes) {
      etat.session.notes = t.value;
    } else if (t.dataset.observation) {
      etat.session.observations[t.dataset.observation] = t.value;
    } else if (t.dataset.valeur) {
      etat.session.valeurs[t.dataset.valeur] = t.value.trim();
      rafraichirCommandes();
    } else {
      return;
    }
    sauver();
  });

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.classList.contains("copier")) {
      copierTexte(remplir(commandes[b.dataset.cmdId].os[etat.os].cmd)).then(() => confirmer(b, "Copié ✓"));
    } else if (b.dataset.reponse !== undefined) repondre(Number(b.dataset.reponse));
    else if (b.dataset.retour !== undefined) revenirA(Number(b.dataset.retour));
    else if (b.dataset.action === "precedent") revenirA(etat.session.chemin.length - 1);
    else if (b.dataset.action === "recommencer") revenirA(0);
    else if (b.dataset.action === "exporter") copierTexte(compteRendu()).then(() => confirmer(b, "Compte rendu copié ✓"));
    else if (b.dataset.action === "telecharger") telecharger();
    else if (b.dataset.action === "nouvelle-session") {
      // Pas de boîte de confirmation : un deuxième clic est demandé.
      if (b.dataset.confirme !== "1") {
        b.dataset.confirme = "1";
        b.textContent = "Cliquer encore pour tout effacer";
        setTimeout(() => { b.dataset.confirme = ""; b.textContent = "Nouvelle session"; }, 3000);
        return;
      }
      etat.session = nouvelleSession();
      sauver();
      el.notes.value = "";
      b.dataset.confirme = "";
      b.textContent = "Nouvelle session";
      afficherEtape();
      afficherCatalogue();
    }
  });

  afficherEtape();
  afficherCatalogue();

  // Mode hors ligne : seulement quand l'app est servie en http(s), pas ouverte depuis le disque.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* l'app marche aussi sans */ });
  }
})();
