// Analyse d'un résultat de commande collé par l'utilisateur.
//
// WEBDEBUG.analyser(texte) reconnaît les sorties courantes (ipconfig, ip, ifconfig,
// ping, nslookup, Resolve-DnsName, dig, Test-NetConnection, nc, curl, traceroute,
// netsh wlan, nmcli, ethtool…) en français et en anglais, et renvoie :
//   - valeurs : valeurs à reporter dans les commandes ({ passerelle, "mon-ip", interface… })
//   - infos   : ce qui a été relevé, pour affichage ({ libelle, valeur })
//   - constats: [{ niveau: "ok" | "alerte" | "info", texte, indice? }]
// Les indices (« apipa », « ping-ok »…) servent à suggérer une réponse : une réponse
// du parcours qui déclare cet indice est mise en avant. La liste complète est dans
// WEBDEBUG.indices, vérifiée par tools/verifier-donnees.js.

window.WEBDEBUG = window.WEBDEBUG || {};

WEBDEBUG.indices = {
  "lien-up": "Carte connectée",
  "lien-down": "Carte déconnectée",
  "ip-ok": "Adresse IP valide",
  apipa: "Adresse 169.254 (DHCP sans réponse)",
  "sans-ip": "Aucune adresse IPv4",
  "sans-passerelle": "Pas de passerelle",
  "ping-ok": "Ping sans perte",
  "ping-pertes": "Ping avec pertes partielles",
  "ping-echec": "Ping sans réponse",
  "dns-ok": "Nom résolu",
  "dns-inconnu": "Nom inexistant",
  "dns-delai": "DNS sans réponse",
  "port-ouvert": "Port ouvert",
  "port-refuse": "Connexion refusée",
  "port-delai": "Port sans réponse",
  "http-ok": "Réponse HTTP 2xx ou 3xx",
  "http-refuse": "HTTP 401 ou 403",
  "http-erreur": "HTTP 5xx",
  "certificat": "Erreur de certificat",
  "mtu-trop-grand": "Paquet trop grand",
  "mtu-ok": "Paquet de 1472 octets passé",
  "lien-lent": "Lien Ethernet lent ou half-duplex",
  "lien-rapide": "Lien Ethernet rapide",
  "wifi-faible": "Signal Wi-Fi faible",
  "wifi-bon": "Signal Wi-Fi correct",
  "trace-bloquee": "Traceroute bloqué",
  "trace-complete": "Traceroute arrivé au bout",
};

(function () {
  const IPV4 = String.raw`(?:\d{1,3}\.){3}\d{1,3}`;
  const reIp = new RegExp(`^${IPV4}$`);

  function ipValide(ip) {
    return reIp.test(ip) && ip.split(".").every((n) => Number(n) <= 255);
  }

  // Les lignes d'ipconfig ressemblent à « Adresse IPv4. . . . : 192.168.1.10(préféré) ».
  function champsIpconfig(texte) {
    const champs = [];
    let dernier = null;
    for (const ligne of texte.split(/\r?\n/)) {
      const m = ligne.match(/^\s{2,}([^:]+?)[\s.]*:\s*(.*)$/);
      if (m && /\.\s?\./.test(ligne)) {
        dernier = { cle: m[1].trim().toLowerCase(), valeurs: m[2].trim() ? [m[2].trim()] : [] };
        champs.push(dernier);
      } else if (dernier && /^\s{20,}\S/.test(ligne)) {
        // Ligne de continuation (deuxième serveur DNS, deuxième passerelle…)
        dernier.valeurs.push(ligne.trim());
      } else {
        dernier = null;
      }
    }
    return champs;
  }

  function premiereIp(valeurs) {
    for (const v of valeurs) {
      const m = v.match(new RegExp(IPV4));
      if (m && ipValide(m[0])) return m[0];
    }
    return null;
  }

  function masqueVersPrefixe(masque) {
    if (/^0x[0-9a-f]{8}$/i.test(masque)) {
      return parseInt(masque, 16).toString(2).replace(/0/g, "").length;
    }
    return masque.split(".").reduce((n, o) => n + (Number(o) >>> 0).toString(2).replace(/0/g, "").length, 0);
  }

  WEBDEBUG.analyser = function analyser(texte) {
    const r = { valeurs: {}, infos: [], constats: [] };
    const info = (libelle, valeur) => r.infos.push({ libelle, valeur });
    const constat = (niveau, txt, indice) => r.constats.push(indice ? { niveau, texte: txt, indice } : { niveau, texte: txt });
    const t = texte || "";
    if (!t.trim()) return r;

    const ips = [];
    const passerelles = [];
    const dns = [];
    let interfaceActive = null;

    // --- ipconfig /all (Windows) ---------------------------------------------
    if (/ipconfig|Windows IP|Configuration IP de Windows|IPv4/i.test(t) && /\.\s\.\s/.test(t)) {
      let carte = null;
      let carteDeconnectee = false;
      const blocs = t.split(/\r?\n(?=\S)/);
      for (const bloc of blocs) {
        // « Ethernet adapter Ethernet: » ou « Carte réseau sans fil Wi-Fi : » : on garde le nom de la carte.
        const entete = bloc.match(/^.*?adapter\s+(.+?)\s*:\s*$/im)
          || bloc.match(/^Carte\s+(?:Ethernet|réseau sans fil|Tunnel|PPP|inconnue)\s+(.+?)\s*:\s*$/im);
        const champs = champsIpconfig(bloc);
        const champ = (re) => champs.find((c) => re.test(c.cle));
        const ip = champ(/ipv4|^ip address|^adresse ip(?!v6)/);
        const media = champ(/media state|statut du m[ée]dia/);
        if (media && /disconnect|d[ée]connect/i.test(media.valeurs.join(" "))) {
          if (entete && !/loopback|bluetooth/i.test(entete[1])) carteDeconnectee = true;
          continue;
        }
        if (!ip) continue;
        const adresse = premiereIp(ip.valeurs);
        if (!adresse) continue;
        if (!carte && entete) carte = entete[1];
        ips.push(adresse);
        const masque = champ(/subnet mask|masque/);
        if (masque && premiereIp(masque.valeurs)) info("Masque", premiereIp(masque.valeurs));
        const gw = champ(/default gateway|passerelle/);
        if (gw) {
          const p = premiereIp(gw.valeurs);
          if (p) passerelles.push(p);
          else passerelles.push(null);
        }
        const d = champ(/dns servers|serveurs dns/);
        if (d) d.valeurs.forEach((v) => { const x = premiereIp([v]); if (x) dns.push(x); });
        const dhcp = champ(/dhcp enabled|dhcp activ/);
        if (dhcp) info("DHCP", /yes|oui/i.test(dhcp.valeurs[0]) ? "activé" : "désactivé (IP fixe)");
        const serveurDhcp = champ(/dhcp server|serveur dhcp/);
        if (serveurDhcp && premiereIp(serveurDhcp.valeurs)) info("Serveur DHCP", premiereIp(serveurDhcp.valeurs));
      }
      if (carte) interfaceActive = carte;
      if (carteDeconnectee && !ips.length) constat("alerte", "La carte réseau est déconnectée (média déconnecté).", "lien-down");
    }

    // --- ip addr / ip -br addr / ip link (Linux) ------------------------------
    for (const m of t.matchAll(/^\d+:\s+([\w.@-]+?)(?:@\S+)?:\s+<([^>]*)>/gm)) {
      if (m[1] === "lo") continue;
      const drapeaux = m[2].split(",");
      if (drapeaux.includes("LOWER_UP")) { interfaceActive = interfaceActive || m[1]; }
      else if (drapeaux.includes("NO-CARRIER") || !drapeaux.includes("UP")) {
        constat("alerte", `L'interface ${m[1]} n'a pas de lien (${drapeaux.includes("NO-CARRIER") ? "NO-CARRIER" : "DOWN"}).`, "lien-down");
      }
    }
    for (const m of t.matchAll(new RegExp(`^\\s*inet (${IPV4})/(\\d+).*?(?:scope global|scope link)?.*?(\\S+)?$`, "gm"))) {
      if (m[1].startsWith("127.")) continue;
      ips.push(m[1]);
      info("Préfixe", `/${m[2]}`);
    }
    for (const m of t.matchAll(new RegExp(`^([\\w.@-]+)\\s+(UP|DOWN|UNKNOWN)\\s+(${IPV4})/(\\d+)`, "gm"))) {
      if (m[1] === "lo") continue;
      ips.push(m[3]);
      if (m[2] === "UP") interfaceActive = interfaceActive || m[1];
    }
    for (const m of t.matchAll(new RegExp(`^default via (${IPV4})(?: dev (\\S+))?`, "gm"))) {
      passerelles.push(m[1]);
      if (m[2]) interfaceActive = interfaceActive || m[2];
    }

    // --- ifconfig / route get default (macOS) --------------------------------
    for (const m of t.matchAll(new RegExp(`^\\s*inet (${IPV4}) netmask (0x[0-9a-f]{8}|${IPV4})`, "gim"))) {
      if (m[1].startsWith("127.")) continue;
      ips.push(m[1]);
      info("Préfixe", `/${masqueVersPrefixe(m[2])}`);
    }
    for (const m of t.matchAll(/^(en\d+|eth\d+|wlan\d+):\s+flags=/gm)) {
      const bloc = t.slice(m.index).split(/\n(?=\S)/)[0];
      const statut = bloc.match(/status:\s*(\w+)/);
      if (statut && statut[1] === "active") interfaceActive = interfaceActive || m[1];
      else if (statut && statut[1] === "inactive") constat("alerte", `L'interface ${m[1]} est inactive (pas de lien).`, "lien-down");
    }
    for (const m of t.matchAll(new RegExp(`^\\s*gateway:\\s*(${IPV4})`, "gm"))) passerelles.push(m[1]);
    for (const m of t.matchAll(new RegExp(`^\\s*router \\(ip_mult\\): \\{(${IPV4})`, "gm"))) passerelles.push(m[1]);

    // --- Serveurs DNS (resolv.conf, resolvectl, scutil, Get-DnsClientServerAddress) ---
    for (const m of t.matchAll(new RegExp(`(?:^|\\s)nameserver(?:\\[\\d+\\])?\\s*:?\\s*(${IPV4})`, "gm"))) dns.push(m[1]);
    for (const m of t.matchAll(new RegExp(`(?:Current DNS Server|DNS Servers?):\\s*(${IPV4})`, "g"))) dns.push(m[1]);

    // --- Synthèse de l'adressage ----------------------------------------------
    const ipsUniques = [...new Set(ips)].filter(ipValide);
    const ipPrincipale = ipsUniques.find((ip) => !ip.startsWith("169.254.")) || ipsUniques[0];
    if (ipPrincipale) {
      info("Adresse IP", ipPrincipale);
      r.valeurs["mon-ip"] = ipPrincipale;
      if (ipPrincipale.startsWith("169.254.")) {
        constat("alerte", `Adresse ${ipPrincipale} : adresse automatique (APIPA), le DHCP n'a pas répondu.`, "apipa");
      } else {
        constat("ok", `Adresse IP ${ipPrincipale}.`, "ip-ok");
      }
    }
    const passerelle = passerelles.find(Boolean);
    if (passerelle) {
      info("Passerelle", passerelle);
      r.valeurs.passerelle = passerelle;
      constat("ok", `Passerelle par défaut ${passerelle}.`);
    } else if (ipPrincipale && !ipPrincipale.startsWith("169.254.") && passerelles.length) {
      constat("alerte", "Aucune passerelle par défaut : la machine ne peut pas sortir du réseau local.", "sans-passerelle");
    }
    const dnsUniques = [...new Set(dns)];
    if (dnsUniques.length) {
      info("Serveurs DNS", dnsUniques.join(", "));
      r.valeurs["serveur-dns"] = dnsUniques[0];
    }
    if (interfaceActive) {
      info("Interface", interfaceActive);
      r.valeurs.interface = interfaceActive;
      if (!r.constats.some((c) => c.indice === "lien-down")) constat("ok", `Interface ${interfaceActive} connectée.`, "lien-up");
    }
    if (/ipconfig|Windows IP|Configuration IP de Windows/i.test(t) && !ipsUniques.length && !r.constats.some((c) => c.indice === "lien-down")) {
      constat("alerte", "Aucune adresse IPv4 trouvée.", "sans-ip");
    }

    // --- Ping et test de MTU --------------------------------------------------
    if (/Packet needs to be fragmented|doit être fragmenté|Message too long|frag needed|fragmentation needed/i.test(t)) {
      constat("alerte", "Le paquet est trop grand pour le chemin : la MTU est inférieure à celle testée.", "mtu-trop-grand");
    }
    const pingCible = t.match(new RegExp(`(?:Pinging|Envoi d'une requête 'ping' sur|Envoi d'une requête 'Ping'|PING)\\s+(\\S+?)(?:\\s+\\[(${IPV4})\\]|\\s+\\((${IPV4})\\))?[\\s:]`, "i"));
    let perte = null;
    let m = t.match(/\((\d+)\s*%\s*(?:loss|perte)\)/i) || t.match(/(\d+(?:\.\d+)?)%\s*packet loss/i);
    if (m) perte = Number(m[1]);
    else if ((m = t.match(/(?:Sent|Envoyés)\s*=\s*(\d+),\s*(?:Received|Reçus)\s*=\s*(\d+)/i))) perte = 100 * (1 - Number(m[2]) / Number(m[1]));
    if (perte !== null) {
      const cible = pingCible ? (pingCible[1]) : "la cible";
      const injoignable = /Destination host unreachable|Impossible de joindre l'hôte|Host Unreachable/i.test(t);
      // Sous Windows, « Impossible de joindre l'hôte » compte comme une réponse reçue : 0 % de perte trompeur.
      if (injoignable) {
        constat("alerte", `${cible} injoignable (« hôte de destination inaccessible »).`, "ping-echec");
      } else if (perte >= 100) {
        constat("alerte", `Aucune réponse de ${cible} (100 % de perte).`, "ping-echec");
      } else if (perte > 0) {
        constat("alerte", `${Math.round(perte)} % de paquets perdus vers ${cible}.`, "ping-pertes");
      } else {
        const testMtu = /\b1472\b/.test(t);
        constat("ok", testMtu ? `Les paquets de 1472 octets passent vers ${cible} : MTU de 1500 OK.` : `${cible} répond sans perte.`, testMtu ? "mtu-ok" : "ping-ok");
      }
      const lat = t.match(/(?:Average|Moyenne)\s*=\s*(\d+)\s*ms/i) || t.match(/=\s*[\d.]+\/([\d.]+)\/[\d.]+/);
      const ext = t.match(/Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms/i) || t.match(/=\s*([\d.]+)\/[\d.]+\/([\d.]+)/);
      if (lat) {
        const moyenne = Number(lat[1]);
        info("Latence moyenne", `${moyenne} ms`);
        if (moyenne > 150) constat("alerte", `Latence moyenne élevée : ${moyenne} ms.`);
        if (ext && Number(ext[2]) - Number(ext[1]) > 100) constat("info", `Latence très variable (de ${ext[1]} à ${ext[2]} ms) : gigue importante.`);
      }
      if (pingCible && (pingCible[2] || pingCible[3])) info("IP de la cible", pingCible[2] || pingCible[3]);
    }

    // --- DNS -------------------------------------------------------------------
    if (/Non-existent domain|NXDOMAIN|can't find .*: Non-existent|n'existe pas|DNS name does not exist|DNS_ERROR_RCODE_NAME_ERROR|not found: 3/i.test(t)) {
      constat("alerte", "Le nom n'existe pas pour ce serveur DNS (NXDOMAIN).", "dns-inconnu");
    } else if (/(?:DNS request timed out|connection timed out; no servers could be reached|timed out|Délai d'attente|ERROR_TIMEOUT|communications error)/i.test(t) && /nslookup|Resolve-DnsName|dig|Server:|Serveur\s*:|DNS/i.test(t)) {
      constat("alerte", "Le serveur DNS ne répond pas (délai dépassé).", "dns-delai");
    } else {
      const reponsesDns = [];
      // nslookup : les adresses après la ligne « Name: »/« Nom : »
      const apresNom = t.split(/\n\s*(?:Name|Nom)\s*:/i)[1];
      if (apresNom) for (const x of apresNom.matchAll(new RegExp(IPV4, "g"))) reponsesDns.push(x[0]);
      // Resolve-DnsName : « nom  A  300  Answer  1.2.3.4 »
      for (const x of t.matchAll(new RegExp(`\\s(?:A|AAAA)\\s+\\d+\\s+Answer\\s+(${IPV4})`, "g"))) reponsesDns.push(x[1]);
      // dig +short (une IP par ligne), dscacheutil, getent hosts, resolvectl query
      for (const x of t.matchAll(new RegExp(`^(${IPV4})\\s*$`, "gm"))) reponsesDns.push(x[1]);
      for (const x of t.matchAll(new RegExp(`^ip_address:\\s*(${IPV4})`, "gm"))) reponsesDns.push(x[1]);
      for (const x of t.matchAll(new RegExp(`^(${IPV4})\\s+\\S+\\.\\S+`, "gm"))) reponsesDns.push(x[1]);
      for (const x of t.matchAll(new RegExp(`^\\S+:\\s+(${IPV4})\\s+--\\s+link`, "gm"))) reponsesDns.push(x[1]);
      if (/^;; ANSWER SECTION:/m.test(t)) for (const x of t.split(/;; ANSWER SECTION:/)[1].matchAll(new RegExp(`\\sIN\\s+A\\s+(${IPV4})`, "g"))) reponsesDns.push(x[1]);
      const uniques = [...new Set(reponsesDns)].filter(ipValide);
      if (uniques.length && !/ping|PING|Pinging/.test(t)) {
        info("Nom résolu en", uniques.join(", "));
        constat("ok", `Le nom est résolu (${uniques.join(", ")}).`, "dns-ok");
      }
    }

    // --- Test de port (Test-NetConnection, nc) ---------------------------------
    if ((m = t.match(/TcpTestSucceeded\s*:\s*(True|False)/i))) {
      const port = t.match(/RemotePort\s*:\s*(\d+)/i);
      if (port) r.valeurs.port = port[1];
      const adr = t.match(new RegExp(`RemoteAddress\\s*:\\s*(${IPV4})`, "i"));
      if (adr) info("IP de la cible", adr[1]);
      if (/true/i.test(m[1])) constat("ok", `Port ${port ? port[1] : ""} ouvert : le service répond.`.replace("  ", " "), "port-ouvert");
      else constat("alerte", `Port ${port ? port[1] + " " : ""}injoignable (filtré, ou service arrêté).`, "port-delai");
    } else if (/succeeded!|Connection to .* port \d+ .*succeeded|open$/im.test(t) && /\bnc\b|Connection to/i.test(t)) {
      constat("ok", "Port ouvert : le service répond.", "port-ouvert");
    } else if (/Connection refused|Connexion refusée/i.test(t)) {
      constat("alerte", "Connexion refusée : la machine répond mais aucun service n'écoute sur ce port.", "port-refuse");
    } else if (/Operation timed out|Connection timed out|timed out: Operation now in progress/i.test(t) && !/nslookup|DNS/i.test(t)) {
      constat("alerte", "Délai dépassé : un pare-feu filtre probablement ce port.", "port-delai");
    }

    // --- curl / HTTP ------------------------------------------------------------
    if ((m = t.match(/^HTTP\/[\d.]+\s+(\d{3})/m))) {
      const code = Number(m[1]);
      info("Code HTTP", String(code));
      if (code < 400) constat("ok", `Le serveur web répond (code ${code}).`, "http-ok");
      else if (code === 401 || code === 403) constat("alerte", `Accès refusé par le serveur (code ${code}).`, "http-refuse");
      else if (code >= 500) constat("alerte", `Erreur côté serveur (code ${code}).`, "http-erreur");
      else constat("alerte", `Réponse ${code} du serveur.`);
    }
    if (/SSL certificate problem|certificate (?:has )?expired|self[- ]signed certificate|unable to get local issuer|CERT_|SEC_E_|schannel/i.test(t)) {
      constat("alerte", "Erreur de certificat TLS.", "certificat");
    }
    if (/Could not resolve host/i.test(t)) constat("alerte", "curl n'a pas pu résoudre le nom (problème DNS).", "dns-delai");
    if ((m = t.match(/notAfter=(.+)/))) {
      const fin = new Date(m[1]);
      info("Certificat valable jusqu'au", isNaN(fin) ? m[1] : fin.toLocaleDateString("fr-FR"));
      if (!isNaN(fin) && fin < new Date()) constat("alerte", "Le certificat est expiré.", "certificat");
    }

    // --- Traceroute ---------------------------------------------------------------
    if (/(?:tracert|traceroute|tracepath|Détermination de l'itinéraire|Tracing route)/i.test(t)) {
      const sauts = t.split(/\r?\n/).filter((l) => /^\s*\d+[:?]?\s/.test(l));
      if (sauts.length) {
        const repondu = sauts.filter((l) => new RegExp(IPV4).test(l) && !/^\s*\d+[:?]?\s+(\*\s*|Délai d'attente de la demande dépassé\.?\s*|Request timed out\.?\s*|no reply\s*)+$/i.test(l));
        const dernier = repondu[repondu.length - 1];
        const derniereIp = dernier ? dernier.match(new RegExp(IPV4))[0] : null;
        const finEtoiles = sauts.slice(-3).every((l) => /\*\s*\*|timed out|dépassé|no reply/i.test(l));
        info("Sauts affichés", String(sauts.length));
        if (finEtoiles) {
          constat("alerte", derniereIp ? `Le trafic s'arrête après ${derniereIp} (saut ${sauts.indexOf(dernier) + 1}).` : "Aucun saut ne répond.", "trace-bloquee");
        } else {
          constat("ok", "Le traceroute atteint la destination.", "trace-complete");
        }
      }
    }

    // --- Wi-Fi ----------------------------------------------------------------------
    if ((m = t.match(/^\s*Signal\s*:\s*(\d+)\s*%/im)) || (m = t.match(/^\s*\*?\s+\S.*?\s(\d{1,3})\s+[▂▄▆█_ ]{4}/m))) {
      const s = Number(m[1]);
      info("Signal Wi-Fi", `${s} %`);
      if (s < 40) constat("alerte", `Signal Wi-Fi faible (${s} %).`, "wifi-faible");
      else constat(s < 70 ? "info" : "ok", `Signal Wi-Fi ${s < 70 ? "moyen" : "bon"} (${s} %).`, "wifi-bon");
    } else if ((m = t.match(/RSSI\s*:\s*(-\d+)\s*dBm/i)) || (m = t.match(/signal:\s*(-\d+)\s*dBm/i))) {
      const s = Number(m[1]);
      info("Signal Wi-Fi", `${s} dBm`);
      if (s < -75) constat("alerte", `Signal Wi-Fi faible (${s} dBm).`, "wifi-faible");
      else constat(s < -65 ? "info" : "ok", `Signal Wi-Fi ${s < -65 ? "moyen" : "bon"} (${s} dBm).`, "wifi-bon");
    }
    if ((m = t.match(/^\s*SSID\s*:\s*(.+)$/m))) info("SSID", m[1].trim());
    if ((m = t.match(/^\s*(?:Channel|Canal)\s*:\s*(\d+)/im))) info("Canal", m[1]);

    // --- Vitesse du lien Ethernet ----------------------------------------------------
    const vitesse = t.match(/Speed:\s*(\d+)\s*Mb\/s/i) || t.match(/\b(10|100)\s*Mbps\b/) || t.match(/media:.*?\b(10|100|1000)base/i);
    const half = /Duplex:\s*Half|half-duplex|FullDuplex\s*:?\s*False|\bFalse\s*$/im.test(t) && /duplex/i.test(t);
    if (vitesse) {
      const mbps = Number(vitesse[1]);
      info("Vitesse du lien", `${mbps} Mb/s`);
      if (mbps <= 100 || half) constat("alerte", `Lien négocié à ${mbps} Mb/s${half ? " en half-duplex" : ""} : câble ou port suspect.`, "lien-lent");
      else constat("ok", `Lien à ${mbps} Mb/s.`, "lien-rapide");
    } else if (/\b(\d+(?:\.\d+)?)\s*Gbps\b/.test(t)) {
      constat(half ? "alerte" : "ok", half ? "Lien en half-duplex : problème de négociation." : "Lien à 1 Gb/s ou plus.", half ? "lien-lent" : "lien-rapide");
    }

    // Une valeur « cible » n'est proposée que si elle est évidente (ping, Test-NetConnection).
    const cibleNom = (t.match(/ComputerName\s*:\s*(\S+)/i) || pingCible || [])[1];
    if (cibleNom && cibleNom !== r.valeurs.passerelle && !["1.1.1.1", "8.8.8.8"].includes(cibleNom)) r.valeurs.cible = cibleNom;

    // Dédoublonne les infos (même libellé : on garde la première).
    const vus = new Set();
    r.infos = r.infos.filter((i) => (vus.has(i.libelle) ? false : vus.add(i.libelle)));
    return r;
  };
})();
