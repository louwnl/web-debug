// Interface de l'aide au diagnostic : choix de l'OS, parcours guidé et catalogue.
// Les données viennent de data/commandes.js et data/parcours.js (window.WEBDEBUG).

(function () {
  const { commandes, categories, parcours, couches } = window.WEBDEBUG;
  const NOMS_OS = { windows: "Windows", macos: "macOS", linux: "Linux" };

  const etat = {
    os: lireOs(),
    // Étapes déjà franchies : [{ id, reponse }], la dernière n'est pas l'étape courante.
    chemin: [],
    courante: parcours.depart,
  };

  const el = {
    os: document.getElementById("os"),
    ongletGuide: document.getElementById("onglet-guide"),
    ongletCatalogue: document.getElementById("onglet-catalogue"),
    vueGuide: document.getElementById("vue-guide"),
    vueCatalogue: document.getElementById("vue-catalogue"),
    fil: document.getElementById("fil"),
    etape: document.getElementById("etape"),
    recherche: document.getElementById("recherche"),
    liste: document.getElementById("liste-commandes"),
  };

  // --- Préférence d'OS, retenue d'une visite à l'autre -----------------------
  function lireOs() {
    try {
      const os = localStorage.getItem("webdebug-os");
      if (os in NOMS_OS) return os;
    } catch (e) { /* stockage indisponible : on garde la valeur par défaut */ }
    return "windows";
  }

  function enregistrerOs(os) {
    try { localStorage.setItem("webdebug-os", os); } catch (e) { /* sans importance */ }
  }

  // --- Outils d'affichage -----------------------------------------------------
  function echapper(texte) {
    return String(texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Met en évidence les valeurs à remplacer, notées <comme-ceci>.
  function colorerVariables(cmd) {
    return echapper(cmd).replace(/&lt;([a-z0-9-]+)&gt;/gi, '<span class="var">&lt;$1&gt;</span>');
  }

  function blocCommande(id, { titre = true } = {}) {
    const c = commandes[id];
    const variante = c.os[etat.os];
    const corps = variante
      ? `<div class="ligne-cmd">
           <pre><code>${colorerVariables(variante.cmd)}</code></pre>
           <button type="button" class="copier" data-cmd="${echapper(variante.cmd)}">Copier</button>
         </div>
         ${variante.note ? `<p class="note">${echapper(variante.note)}</p>` : ""}`
      : `<p class="absente">Pas d'équivalent sous ${NOMS_OS[etat.os]}.</p>`;
    return `<div class="commande">
      ${titre ? `<h3>${echapper(c.titre)}</h3>` : ""}
      ${corps}
      <details class="lecture"><summary>Comment lire le résultat</summary><p>${echapper(c.lecture)}</p></details>
    </div>`;
  }

  // --- Parcours guidé ---------------------------------------------------------
  function titreDe(id) {
    return (parcours.etapes[id] || parcours.conclusions[id]).titre;
  }

  function afficherFil() {
    el.fil.innerHTML = etat.chemin
      .map((pas, i) => `<li><button type="button" data-retour="${i}" title="Votre réponse : ${echapper(pas.reponse)}">${echapper(titreDe(pas.id))}</button></li>`)
      .join("");
    el.fil.hidden = etat.chemin.length === 0;
  }

  function afficherEtape() {
    afficherFil();
    const id = etat.courante;
    const etape = parcours.etapes[id];
    const navigation = `<div class="actions-nav">
      ${etat.chemin.length ? '<button type="button" class="secondaire" data-action="precedent">← Étape précédente</button>' : ""}
      ${etat.chemin.length ? '<button type="button" class="secondaire" data-action="recommencer">Recommencer</button>' : ""}
    </div>`;

    if (!etape) {
      const fin = parcours.conclusions[id];
      el.etape.innerHTML = `<article class="carte conclusion">
        <span class="couche">Diagnostic</span>
        <h2>${echapper(fin.titre)}</h2>
        <p>${echapper(fin.diagnostic)}</p>
        <h3>Que faire</h3>
        <ol>${fin.actions.map((a) => `<li>${colorerVariables(a)}</li>`).join("")}</ol>
        ${navigation}
      </article>`;
      return;
    }

    el.etape.innerHTML = `<article class="carte">
      <span class="couche">${echapper(couches[etape.couche])}</span>
      <h2>${echapper(etape.titre)}</h2>
      ${etape.aide ? `<p class="aide">${echapper(etape.aide)}</p>` : ""}
      ${(etape.commandes || []).map((c) => blocCommande(c)).join("")}
      <p class="question">${echapper(etape.question)}</p>
      <div class="reponses">
        ${etape.reponses.map((r, i) => `<button type="button" data-reponse="${i}">${echapper(r.texte)}</button>`).join("")}
      </div>
      ${navigation}
    </article>`;
  }

  function repondre(index) {
    const etape = parcours.etapes[etat.courante];
    const reponse = etape.reponses[index];
    etat.chemin.push({ id: etat.courante, reponse: reponse.texte });
    etat.courante = reponse.suite;
    afficherEtape();
    el.etape.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function revenirA(index) {
    etat.courante = etat.chemin[index].id;
    etat.chemin = etat.chemin.slice(0, index);
    afficherEtape();
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

    const html = Object.entries(categories)
      .map(([cat, nom]) => {
        const trouvees = Object.entries(commandes).filter(([id, c]) => c.categorie === cat && correspond(id, c));
        if (!trouvees.length) return "";
        return `<div class="categorie"><h2>${echapper(nom)}</h2>
          ${trouvees.map(([id]) => `<div class="carte">${blocCommande(id)}</div>`).join("")}
        </div>`;
      })
      .join("");
    el.liste.innerHTML = html || '<p class="vide">Aucune commande ne correspond.</p>';
  }

  // --- Copie dans le presse-papiers -----------------------------------------
  async function copier(bouton) {
    const texte = bouton.dataset.cmd;
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
    bouton.textContent = "Copié ✓";
    setTimeout(() => { bouton.textContent = "Copier"; }, 1500);
  }

  // --- Onglets ----------------------------------------------------------------
  function ouvrirOnglet(nom) {
    const guide = nom === "guide";
    el.ongletGuide.setAttribute("aria-selected", guide);
    el.ongletCatalogue.setAttribute("aria-selected", !guide);
    el.vueGuide.hidden = !guide;
    el.vueCatalogue.hidden = guide;
    if (!guide) el.recherche.focus();
  }

  // --- Événements ---------------------------------------------------------------
  el.os.value = etat.os;
  el.os.addEventListener("change", () => {
    etat.os = el.os.value;
    enregistrerOs(etat.os);
    afficherEtape();
    afficherCatalogue();
  });

  el.ongletGuide.addEventListener("click", () => ouvrirOnglet("guide"));
  el.ongletCatalogue.addEventListener("click", () => ouvrirOnglet("catalogue"));
  el.recherche.addEventListener("input", afficherCatalogue);

  document.addEventListener("click", (ev) => {
    const cible = ev.target.closest("button");
    if (!cible) return;
    if (cible.classList.contains("copier")) copier(cible);
    else if (cible.dataset.reponse !== undefined) repondre(Number(cible.dataset.reponse));
    else if (cible.dataset.retour !== undefined) revenirA(Number(cible.dataset.retour));
    else if (cible.dataset.action === "precedent") revenirA(etat.chemin.length - 1);
    else if (cible.dataset.action === "recommencer") revenirA(0);
  });

  afficherEtape();
  afficherCatalogue();
})();
