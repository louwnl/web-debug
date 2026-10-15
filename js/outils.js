// Onglet « Outils » : calculateur de sous-réseau, fabricant d'une adresse MAC,
// aide-mémoire des ports. Tout fonctionne hors ligne.
// WEBDEBUG.sousReseau() et WEBDEBUG.infosMac() sont aussi utilisés par les tests
// (tools/tester-outils.js).

window.WEBDEBUG = window.WEBDEBUG || {};

(function () {
  // --- Calcul de sous-réseau --------------------------------------------------
  function ipVersEntier(ip) {
    const o = ip.trim().split(".");
    if (o.length !== 4 || o.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
    return o.reduce((n, x) => n * 256 + Number(x), 0);
  }
  function entierVersIp(n) {
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }
  function masqueVersPrefixe(masque) {
    const n = ipVersEntier(masque);
    if (n === null) return null;
    const bits = n.toString(2).padStart(32, "0");
    if (!/^1*0*$/.test(bits)) return null;
    const i = bits.indexOf("0");
    return i === -1 ? 32 : i;
  }

  // Accepte « 192.168.1.10/24 », « 192.168.1.10 255.255.255.0 » ou « 192.168.1.10 /24 ».
  WEBDEBUG.sousReseau = function sousReseau(saisie) {
    const m = String(saisie).trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*(?:\/\s*(\d{1,2})|\s+(\d{1,3}(?:\.\d{1,3}){3}))?$/);
    if (!m) return { erreur: "Format attendu : 192.168.1.10/24 ou 192.168.1.10 255.255.255.0" };
    const ip = ipVersEntier(m[1]);
    if (ip === null) return { erreur: "Adresse IP invalide." };
    let prefixe = m[2] !== undefined ? Number(m[2]) : m[3] ? masqueVersPrefixe(m[3]) : null;
    if (prefixe === null) {
      if (m[3]) return { erreur: "Masque invalide : il doit être une suite de 1 puis de 0 (ex. 255.255.255.0)." };
      prefixe = 24;
    }
    if (prefixe > 32) return { erreur: "Le préfixe doit être compris entre 0 et 32." };
    const masque = prefixe === 0 ? 0 : (0xffffffff << (32 - prefixe)) >>> 0;
    const reseau = (ip & masque) >>> 0;
    const diffusion = (reseau | (~masque >>> 0)) >>> 0;
    const total = 2 ** (32 - prefixe);
    const hotes = prefixe >= 31 ? total : total - 2;
    const premier = prefixe >= 31 ? reseau : reseau + 1;
    const dernier = prefixe >= 31 ? diffusion : diffusion - 1;

    const o1 = ip >>> 24, o2 = (ip >>> 16) & 255;
    let type = "Adresse publique";
    if (o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168)) type = "Adresse privée (RFC 1918)";
    else if (o1 === 127) type = "Boucle locale (la machine elle-même)";
    else if (o1 === 169 && o2 === 254) type = "Adresse automatique APIPA : le DHCP n'a pas répondu";
    else if (o1 === 100 && o2 >= 64 && o2 <= 127) type = "Plage partagée des opérateurs (CGNAT)";
    else if (o1 >= 224 && o1 <= 239) type = "Multicast";
    else if (o1 >= 240) type = "Réservée";

    const remarques = [];
    if (prefixe < 31 && ip === reseau) remarques.push("Cette adresse est l'adresse du réseau : elle ne peut pas être attribuée à une machine.");
    if (prefixe < 31 && ip === diffusion) remarques.push("Cette adresse est l'adresse de diffusion : elle ne peut pas être attribuée à une machine.");
    if (!m[2] && !m[3]) remarques.push("Aucun masque indiqué : /24 (255.255.255.0) utilisé par défaut.");

    return {
      ip: entierVersIp(ip),
      prefixe,
      masque: entierVersIp(masque),
      joker: entierVersIp(~masque >>> 0),
      reseau: entierVersIp(reseau),
      diffusion: entierVersIp(diffusion),
      premier: entierVersIp(premier),
      dernier: entierVersIp(dernier),
      hotes,
      type,
      remarques,
      contient: (autre) => {
        const n = ipVersEntier(autre);
        return n === null ? null : ((n & masque) >>> 0) === reseau;
      },
    };
  };

  // --- Adresses MAC -------------------------------------------------------------
  let tableOui = null;
  function chargerOui() {
    if (tableOui) return tableOui;
    if (!WEBDEBUG.oui) return null;
    tableOui = new Map();
    const { fabricants, prefixes } = WEBDEBUG.oui;
    for (const e of prefixes.split(",")) tableOui.set(e.slice(0, 6), fabricants[parseInt(e.slice(6), 36)]);
    return tableOui;
  }

  const MOTIF_MAC = /\b([0-9a-f]{2})[:-]([0-9a-f]{2})[:-]([0-9a-f]{2})[:-]([0-9a-f]{2})[:-]([0-9a-f]{2})[:-]([0-9a-f]{2})\b|\b([0-9a-f]{4})\.([0-9a-f]{4})\.([0-9a-f]{4})\b/gi;

  WEBDEBUG.infosMac = function infosMac(mac) {
    const hexa = mac.replace(/[^0-9a-f]/gi, "").toUpperCase();
    if (hexa.length !== 12) return null;
    const premierOctet = parseInt(hexa.slice(0, 2), 16);
    const r = { mac: hexa.match(/../g).join(":"), fabricant: null, remarques: [] };
    if (hexa === "FFFFFFFFFFFF") { r.remarques.push("Adresse de diffusion (broadcast)."); return r; }
    if (premierOctet & 1) r.remarques.push("Adresse multicast : elle ne désigne pas une carte précise.");
    if (premierOctet & 2) {
      r.remarques.push("Adresse « administrée localement » : souvent une adresse aléatoire (confidentialité Wi-Fi des téléphones et PC récents), une machine virtuelle ou un conteneur. Aucun fabricant à trouver.");
      return r;
    }
    const table = chargerOui();
    if (table) r.fabricant = table.get(hexa.slice(0, 6)) || null;
    return r;
  };

  // Trouve toutes les adresses MAC d'un texte (une adresse seule, ou une table ARP collée).
  WEBDEBUG.trouverMacs = function trouverMacs(texte) {
    const resultats = [];
    for (const ligne of String(texte).split(/\r?\n/)) {
      for (const m of ligne.matchAll(MOTIF_MAC)) {
        const ip = ligne.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
        resultats.push({ ...WEBDEBUG.infosMac(m[0]), ip: ip ? ip[0] : null });
      }
    }
    return resultats;
  };

  // --- Interface ------------------------------------------------------------------
  if (typeof document === "undefined") return;

  const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const vue = document.getElementById("vue-outils");
  const onglet = document.getElementById("onglet-outils");
  if (!vue || !onglet) return;

  // Les onglets : chacun montre le panneau désigné par son aria-controls.
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
        chargerFichierOui();
      }
    });
  });

  // Sous-réseau
  const champReseau = document.getElementById("outil-reseau");
  const champComparer = document.getElementById("outil-comparer");
  const sortieReseau = document.getElementById("resultat-reseau");
  function afficherReseau() {
    const saisie = champReseau.value.trim();
    if (!saisie) { sortieReseau.innerHTML = ""; return; }
    const r = WEBDEBUG.sousReseau(saisie);
    if (r.erreur) { sortieReseau.innerHTML = `<p class="note">${echapper(r.erreur)}</p>`; return; }
    const lignes = [
      ["Réseau", `${r.reseau}/${r.prefixe}`],
      ["Masque", `${r.masque} (/${r.prefixe})`],
      ["Masque inversé (joker)", r.joker],
      ["Première adresse utilisable", r.premier],
      ["Dernière adresse utilisable", r.dernier],
      ["Diffusion (broadcast)", r.diffusion],
      ["Nombre d'adresses utilisables", r.hotes.toLocaleString("fr-FR")],
      ["Type", r.type],
    ];
    let comparaison = "";
    const autre = champComparer.value.trim();
    if (autre) {
      const dedans = r.contient(autre);
      comparaison = dedans === null
        ? '<p class="note">Adresse à comparer invalide.</p>'
        : `<p class="${dedans ? "verdict-ok" : "verdict-alerte"}">${echapper(autre)} ${dedans ? "est dans le même réseau : joignable directement, sans passer par un routeur." : "n'est pas dans ce réseau : le trafic passe par la passerelle. Si c'est censé être la passerelle, le masque ou l'adresse est faux."}</p>`;
    }
    sortieReseau.innerHTML = `<dl class="infos">${lignes.map(([a, b]) => `<dt>${echapper(a)}</dt><dd>${echapper(b)}</dd>`).join("")}</dl>
      ${r.remarques.map((x) => `<p class="note">${echapper(x)}</p>`).join("")}${comparaison}`;
  }
  champReseau.addEventListener("input", afficherReseau);
  champComparer.addEventListener("input", afficherReseau);

  // Fabricant MAC : la base (1,7 Mo) n'est chargée qu'à l'ouverture de l'onglet.
  const champMac = document.getElementById("outil-mac");
  const sortieMac = document.getElementById("resultat-mac");
  let chargement = null;
  function chargerFichierOui() {
    if (WEBDEBUG.oui || chargement) return chargement;
    chargement = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "data/oui.js";
      s.onload = () => { resolve(); afficherMac(); };
      s.onerror = () => { resolve(); sortieMac.innerHTML = '<p class="note">Impossible de charger la base des fabricants.</p>'; };
      document.head.appendChild(s);
    });
    return chargement;
  }
  function afficherMac() {
    const macs = WEBDEBUG.trouverMacs(champMac.value);
    if (!champMac.value.trim()) { sortieMac.innerHTML = ""; return; }
    if (!macs.length) { sortieMac.innerHTML = '<p class="note">Aucune adresse MAC reconnue (formats acceptés : AA:BB:CC:DD:EE:FF, AA-BB-…, aabb.ccdd.eeff).</p>'; return; }
    const attente = !WEBDEBUG.oui ? '<p class="note">Chargement de la base des fabricants…</p>' : "";
    const avecIp = macs.some((m) => m.ip);
    sortieMac.innerHTML = `${attente}<table class="tableau">
      <thead><tr>${avecIp ? "<th>IP</th>" : ""}<th>Adresse MAC</th><th>Fabricant</th></tr></thead>
      <tbody>${macs.map((m) => `<tr>${avecIp ? `<td>${echapper(m.ip || "")}</td>` : ""}<td><code>${echapper(m.mac)}</code></td>
        <td>${m.fabricant ? echapper(m.fabricant) : m.remarques.length ? `<span class="note">${echapper(m.remarques.join(" "))}</span>` : WEBDEBUG.oui ? '<span class="note">Fabricant inconnu</span>' : ""}</td></tr>`).join("")}</tbody>
    </table>`;
  }
  champMac.addEventListener("input", afficherMac);

  // Ports
  const champPort = document.getElementById("outil-port");
  const sortiePorts = document.getElementById("resultat-ports");
  function afficherPorts() {
    const q = champPort.value.trim().toLowerCase();
    const liste = WEBDEBUG.ports.filter((p) => !q || `${p.port} ${p.proto} ${p.service} ${p.note}`.toLowerCase().includes(q));
    sortiePorts.innerHTML = liste.length
      ? `<table class="tableau tableau-ports"><thead><tr><th>Port</th><th>Protocole</th><th>Service</th><th>Remarque</th></tr></thead>
        <tbody>${liste.map((p) => `<tr><td><code>${echapper(p.port)}</code></td><td>${echapper(p.proto)}</td><td>${echapper(p.service)}</td><td>${echapper(p.note)}</td></tr>`).join("")}</tbody></table>`
      : '<p class="note">Aucun port ne correspond.</p>';
  }
  champPort.addEventListener("input", afficherPorts);
  afficherPorts();
})();
