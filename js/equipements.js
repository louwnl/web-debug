// Onglet Équipements : commandes de base par marque (Cisco, Palo Alto, FortiGate…).
// Les données viennent de data/equipements.js. Valeurs à remplacer et équipement
// choisi sont gardés dans le navigateur.

(function () {
  const { equipements, libellesEquipements } = window.WEBDEBUG;
  const vue = document.getElementById("vue-equipements");
  const onglet = document.getElementById("onglet-equipements");
  if (!vue || !onglet || !equipements) return;

  const el = {
    choix: document.getElementById("equipement"),
    recherche: document.getElementById("recherche-equipement"),
    intro: document.getElementById("intro-equipement"),
    valeurs: document.getElementById("valeurs-equipement"),
    liste: document.getElementById("liste-equipement"),
  };
  const MOTIF = /<([a-z0-9-]+)>/gi;

  function lire(cle) {
    try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; }
  }
  function ecrire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* sans importance */ }
  }

  const choixEnregistre = lire("webdebug-equipement");
  const etat = {
    id: choixEnregistre in equipements ? choixEnregistre : Object.keys(equipements)[0],
    valeurs: lire("webdebug-equipement-valeurs") || {},
  };

  const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normaliser = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const remplir = (t) => t.replace(MOTIF, (tout, nom) => etat.valeurs[nom] || tout);

  function remplirHtml(texte) {
    let html = "";
    let dernier = 0;
    for (const m of texte.matchAll(MOTIF)) {
      const v = etat.valeurs[m[1]];
      html += echapper(texte.slice(dernier, m.index));
      html += v ? `<span class="var remplie" title="${echapper(m[0])}">${echapper(v)}</span>` : `<span class="var">${echapper(m[0])}</span>`;
      dernier = m.index + m[0].length;
    }
    return html + echapper(texte.slice(dernier));
  }

  // Les commandes affichées, à plat, pour la recherche et le bouton Copier.
  let affichees = [];

  function afficher() {
    const eq = equipements[etat.id];
    const termes = normaliser(el.recherche.value).split(/\s+/).filter(Boolean);
    const correspond = (g, c) => {
      const texte = normaliser([g.titre, c.titre, c.cmd, c.note || ""].join(" "));
      return termes.every((t) => texte.includes(t));
    };

    el.intro.textContent = eq.intro;
    affichees = [];
    const html = eq.groupes.map((g) => {
      const trouvees = g.commandes.filter((c) => correspond(g, c));
      if (!trouvees.length) return "";
      return `<div class="categorie"><h2>${echapper(g.titre)}</h2><div class="carte">
        ${trouvees.map((c) => {
          const i = affichees.push(c) - 1;
          return `<div class="commande">
            <h3>${echapper(c.titre)}</h3>
            <div class="ligne-cmd">
              <pre><code data-equipement-cmd="${i}">${remplirHtml(c.cmd)}</code></pre>
              <button type="button" class="copier-equipement" data-equipement-copier="${i}">Copier</button>
            </div>
            ${c.note ? `<p class="note">${echapper(c.note)}</p>` : ""}
          </div>`;
        }).join("")}
      </div></div>`;
    }).join("");
    el.liste.innerHTML = html || '<p class="vide">Aucune commande ne correspond.</p>';

    const noms = [...new Set(affichees.flatMap((c) => [...c.cmd.matchAll(MOTIF)].map((m) => m[1])))];
    if (!noms.length) {
      el.valeurs.hidden = true;
      el.valeurs.innerHTML = "";
      return;
    }
    el.valeurs.hidden = false;
    el.valeurs.innerHTML = `<p class="titre-valeurs">Valeurs à remplacer dans les commandes</p>
      <div class="champs-valeurs">${noms.map((nom) => `<label>
        <span>${echapper(libellesEquipements[nom] || nom)}</span>
        <input type="text" data-valeur-equipement="${echapper(nom)}" value="${echapper(etat.valeurs[nom] || "")}" placeholder="&lt;${echapper(nom)}&gt;" spellcheck="false" autocomplete="off">
      </label>`).join("")}</div>`;
  }

  async function copier(texte) {
    try {
      await navigator.clipboard.writeText(texte);
    } catch (e) {
      const zone = document.createElement("textarea");
      zone.value = texte;
      document.body.appendChild(zone);
      zone.select();
      document.execCommand("copy");
      zone.remove();
    }
  }

  // Les onglets : celui-ci montre son panneau et cache les autres.
  document.querySelectorAll('.onglets [role="tab"]').forEach((b) => {
    b.addEventListener("click", () => {
      const actif = b === onglet;
      onglet.setAttribute("aria-selected", actif);
      vue.hidden = !actif;
      if (actif) {
        document.querySelectorAll('.onglets [role="tab"]').forEach((autre) => {
          if (autre !== onglet) {
            autre.setAttribute("aria-selected", "false");
            document.getElementById(autre.getAttribute("aria-controls")).hidden = true;
          }
        });
        afficher();
      }
      // Sur un écran étroit, la barre d'onglets défile : garder l'onglet cliqué visible.
      b.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  });

  el.choix.innerHTML = Object.entries(equipements).map(([id, eq]) => `<option value="${id}">${echapper(eq.nom)}</option>`).join("");
  el.choix.value = etat.id;
  el.choix.addEventListener("change", () => {
    etat.id = el.choix.value;
    ecrire("webdebug-equipement", etat.id);
    afficher();
  });
  el.recherche.addEventListener("input", afficher);

  vue.addEventListener("input", (ev) => {
    const nom = ev.target.dataset.valeurEquipement;
    if (!nom) return;
    etat.valeurs[nom] = ev.target.value.trim();
    ecrire("webdebug-equipement-valeurs", etat.valeurs);
    // On ne redessine que les commandes, pour garder le focus dans le champ.
    vue.querySelectorAll("code[data-equipement-cmd]").forEach((code) => {
      code.innerHTML = remplirHtml(affichees[Number(code.dataset.equipementCmd)].cmd);
    });
  });

  vue.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-equipement-copier]");
    if (!b) return;
    copier(remplir(affichees[Number(b.dataset.equipementCopier)].cmd)).then(() => {
      b.textContent = "Copié ✓";
      setTimeout(() => { b.textContent = "Copier"; }, 1500);
    });
  });

  afficher();
})();
