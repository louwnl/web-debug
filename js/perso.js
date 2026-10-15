// Commandes personnelles : ajoutées depuis l'app, gardées dans ce navigateur,
// exportables et importables en JSON. Chargé avant js/app.js pour que les
// commandes perso soient dans le catalogue dès le premier affichage.

(function () {
  const W = window.WEBDEBUG;
  const CLE = "webdebug-perso";
  const FORMAT = "web-debug-commandes";
  const OS = ["windows", "macos", "linux"];
  const CATEGORIE = "perso";

  function texte(v, max) {
    return typeof v === "string" ? v.trim().slice(0, max) : "";
  }

  // Remet une commande dans la forme du catalogue, ou renvoie null si elle est inutilisable.
  function nettoyer(c) {
    if (!c || typeof c !== "object") return null;
    const titre = texte(c.titre, 200);
    const os = {};
    for (const nom of OS) {
      const v = c.os && c.os[nom];
      const cmd = v && texte(v.cmd, 5000);
      os[nom] = cmd ? { cmd, ...(texte(v.note, 1000) ? { note: texte(v.note, 1000) } : {}) } : null;
    }
    if (!titre || OS.every((nom) => !os[nom])) return null;
    return { titre, categorie: CATEGORIE, lecture: texte(c.lecture, 3000), os, perso: true };
  }

  // Lit un export (objet déjà décodé). Renvoie { commandes, ignorees } ou lève une erreur lisible.
  function lireExport(donnees) {
    if (!donnees || donnees.format !== FORMAT || typeof donnees.commandes !== "object" || !donnees.commandes) {
      throw new Error("Ce fichier n'est pas un export de commandes web-debug.");
    }
    const commandes = {};
    let ignorees = 0;
    for (const [id, c] of Object.entries(donnees.commandes)) {
      const propre = /^perso-[a-z0-9-]{1,80}$/.test(id) ? nettoyer(c) : null;
      if (propre) commandes[id] = propre;
      else ignorees++;
    }
    return { commandes, ignorees };
  }

  function exporter(commandes) {
    const sortie = {};
    for (const [id, c] of Object.entries(commandes)) {
      sortie[id] = { titre: c.titre, lecture: c.lecture, os: c.os };
    }
    return { format: FORMAT, version: 1, exporte: new Date().toISOString(), commandes: sortie };
  }

  function nouvelId(titre, existants) {
    const base = "perso-" + (titre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "commande");
    let id = base;
    for (let i = 2; id in existants; i++) id = `${base}-${i}`;
    return id;
  }

  W.perso = { nettoyer, lireExport, exporter, nouvelId, FORMAT };

  // Le reste ne concerne que la page (les tests chargent ce fichier sans DOM).
  if (typeof document === "undefined") return;

  // --- Stockage et fusion dans le catalogue --------------------------------------
  function charger() {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE));
      return brut ? lireExport(brut).commandes : {};
    } catch (e) {
      return {};
    }
  }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(exporter(mes))); } catch (e) { /* sans importance */ }
  }

  // « Mes commandes » en tête du catalogue.
  const autres = { ...W.categories };
  for (const k of Object.keys(W.categories)) delete W.categories[k];
  Object.assign(W.categories, { [CATEGORIE]: "Mes commandes" }, autres);

  let mes = charger();
  const appliquer = () => {
    for (const id of Object.keys(W.commandes)) if (W.commandes[id].perso) delete W.commandes[id];
    Object.assign(W.commandes, mes);
  };
  appliquer();

  // --- Formulaire -------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const zone = document.getElementById("perso");
    const form = document.getElementById("form-perso");
    const etat = document.getElementById("perso-etat");
    const fichier = document.getElementById("perso-fichier");
    if (!zone || !form) return;
    let enCours = null; // id de la commande modifiée, null pour un ajout

    const rafraichir = () => { appliquer(); if (W.rafraichir) W.rafraichir(); };
    const dire = (msg) => { etat.textContent = msg; };

    function vider() {
      form.reset();
      enCours = null;
      form.querySelector("[data-perso-titre-form]").textContent = "Ajouter une commande";
      form.querySelector("[type=submit]").textContent = "Ajouter";
      form.querySelector("[data-action=perso-annuler]").hidden = true;
    }

    function modifier(id) {
      const c = mes[id];
      if (!c) return;
      enCours = id;
      form.elements.titre.value = c.titre;
      form.elements.lecture.value = c.lecture;
      for (const nom of OS) {
        form.elements[`cmd-${nom}`].value = c.os[nom] ? c.os[nom].cmd : "";
        form.elements[`note-${nom}`].value = c.os[nom] && c.os[nom].note ? c.os[nom].note : "";
      }
      form.querySelector("[data-perso-titre-form]").textContent = "Modifier « " + c.titre + " »";
      form.querySelector("[type=submit]").textContent = "Enregistrer";
      form.querySelector("[data-action=perso-annuler]").hidden = false;
      zone.open = true;
      dire("");
      zone.scrollIntoView({ block: "start", behavior: "smooth" });
      form.elements.titre.focus();
    }

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = form.elements;
      const brut = { titre: f.titre.value, lecture: f.lecture.value, os: {} };
      for (const nom of OS) brut.os[nom] = { cmd: f[`cmd-${nom}`].value, note: f[`note-${nom}`].value };
      const propre = nettoyer(brut);
      if (!propre) {
        dire("Il faut un titre et au moins une commande (pour un des trois systèmes).");
        return;
      }
      const id = enCours && mes[enCours] ? enCours : nouvelId(propre.titre, W.commandes);
      mes[id] = propre;
      sauver();
      rafraichir();
      dire(enCours ? `« ${propre.titre} » enregistrée.` : `« ${propre.titre} » ajoutée au catalogue.`);
      vider();
    });

    document.addEventListener("click", (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.persoModifier) modifier(b.dataset.persoModifier);
      else if (b.dataset.persoSupprimer) {
        const id = b.dataset.persoSupprimer;
        // Pas de boîte de confirmation : un deuxième clic est demandé.
        if (b.dataset.confirme !== "1") {
          b.dataset.confirme = "1";
          b.textContent = "Cliquer encore pour supprimer";
          setTimeout(() => { b.dataset.confirme = ""; b.textContent = "Supprimer"; }, 3000);
          return;
        }
        const titre = mes[id] ? mes[id].titre : "";
        delete mes[id];
        if (enCours === id) vider();
        sauver();
        rafraichir();
        dire(`« ${titre} » supprimée.`);
      } else if (b.dataset.action === "perso-annuler") {
        vider();
        dire("");
      } else if (b.dataset.action === "perso-exporter") {
        const n = Object.keys(mes).length;
        if (!n) { dire("Rien à exporter : aucune commande perso pour l'instant."); return; }
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(new Blob([JSON.stringify(exporter(mes), null, 2)], { type: "application/json" }));
        lien.download = `web-debug-mes-commandes-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
        dire(`${n} commande${n > 1 ? "s" : ""} exportée${n > 1 ? "s" : ""}.`);
      } else if (b.dataset.action === "perso-importer") {
        fichier.click();
      }
    });

    fichier.addEventListener("change", async () => {
      const f = fichier.files[0];
      fichier.value = "";
      if (!f) return;
      try {
        const { commandes, ignorees } = lireExport(JSON.parse(await f.text()));
        const n = Object.keys(commandes).length;
        const remplacees = Object.keys(commandes).filter((id) => id in mes).length;
        Object.assign(mes, commandes);
        sauver();
        rafraichir();
        dire(`${n} commande${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""}` +
          (remplacees ? `, dont ${remplacees} déjà présente${remplacees > 1 ? "s" : ""} et remplacée${remplacees > 1 ? "s" : ""}` : "") +
          (ignorees ? `, ${ignorees} ignorée${ignorees > 1 ? "s" : ""} (incomplète${ignorees > 1 ? "s" : ""})` : "") + ".");
      } catch (e) {
        dire(e instanceof SyntaxError ? "Ce fichier n'est pas du JSON valide." : e.message);
      }
    });
  });
})();
