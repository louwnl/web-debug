// Onglet Fiche : l'aide-mémoire réseau (data/fiche.js, généré depuis fiche/fiche-reseau.md),
// avec un sommaire pour aller directement à une partie.

(function () {
  const fiche = window.WEBDEBUG.fiche;
  const vue = document.getElementById("vue-fiche");
  const onglet = document.getElementById("onglet-fiche");
  if (!vue || !onglet || !fiche) return;

  const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let affichee = false;

  function afficher() {
    if (affichee) return;
    affichee = true;
    vue.innerHTML = `<p class="titre-fiche">${echapper(fiche.titre)}</p>
      <nav class="sommaire-fiche" aria-label="Sommaire de la fiche">
        ${fiche.sections.map((s) => `<button type="button" class="secondaire" data-fiche-section="${s.id}">${echapper(s.titre)}</button>`).join("")}
      </nav>
      ${fiche.html}`;
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

  vue.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-fiche-section]");
    if (!b) return;
    document.getElementById(b.dataset.ficheSection).scrollIntoView({ block: "start", behavior: "smooth" });
  });
})();
