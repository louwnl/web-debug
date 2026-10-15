#!/usr/bin/env node
// Vérifie que l'analyse des résultats collés reconnaît les sorties d'exemple
// de tools/exemples. Usage : node tools/tester-analyse.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const racine = path.join(__dirname, "..");
const contexte = {};
contexte.window = contexte;
vm.createContext(contexte);
vm.runInContext(fs.readFileSync(path.join(racine, "js/analyse.js"), "utf8"), contexte, { filename: "js/analyse.js" });
const { analyser } = contexte.WEBDEBUG;

// Pour chaque exemple : indices attendus et valeurs attendues.
const attendus = {
  "ipconfig-fr-apipa.txt": { indices: ["apipa"], valeurs: { "mon-ip": "169.254.23.117", interface: "Ethernet" } },
  "ipconfig-en-ok.txt": { indices: ["ip-ok", "lien-up"], valeurs: { "mon-ip": "192.168.1.42", passerelle: "192.168.1.1", interface: "Ethernet", "serveur-dns": "192.168.1.1" } },
  "ip-a-linux.txt": { indices: ["ip-ok", "lien-down"], valeurs: { "mon-ip": "10.0.2.15", passerelle: "10.0.2.2", interface: "enp3s0" } },
  "ifconfig-mac.txt": { indices: ["ip-ok", "lien-up"], valeurs: { "mon-ip": "192.168.0.23", interface: "en0" } },
  "ping-win-fr-echec.txt": { indices: ["ping-echec"], valeurs: { cible: "192.168.1.1" } },
  "ping-win-unreachable.txt": { indices: ["ping-echec"], absents: ["ping-ok"] },
  "ping-linux-ok.txt": { indices: ["ping-ok"], absents: ["dns-ok"], valeurs: { cible: "google.com" } },
  "ping-mac-pertes.txt": { indices: ["ping-pertes"] },
  "ping-mtu-win.txt": { indices: ["mtu-trop-grand"], absents: ["mtu-ok"] },
  "ping-mtu-linux-ok.txt": { indices: ["mtu-ok"] },
  "nslookup-ok.txt": { indices: ["dns-ok"] },
  "nslookup-nx.txt": { indices: ["dns-inconnu"], absents: ["dns-ok"] },
  "nslookup-timeout.txt": { indices: ["dns-delai"], absents: ["dns-ok"] },
  "dig-short.txt": { indices: ["dns-ok"] },
  "tnc-ok.txt": { indices: ["port-ouvert"], valeurs: { port: "443", cible: "intranet.exemple.fr" } },
  "tnc-ko.txt": { indices: ["port-delai"], valeurs: { port: "3389", cible: "srv-rds" } },
  "nc-refuse.txt": { indices: ["port-refuse"] },
  "curl-403.txt": { indices: ["http-refuse"] },
  "curl-cert.txt": { indices: ["certificat"] },
  "tracert-bloque.txt": { indices: ["trace-bloquee"], absents: ["trace-complete"] },
  "traceroute-ok.txt": { indices: ["trace-complete"] },
  "netsh-wlan.txt": { indices: ["wifi-faible"] },
  "ethtool.txt": { indices: ["lien-lent"] },
};

let echecs = 0;
const dossier = path.join(__dirname, "exemples");
const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith(".txt"));
for (const f of fichiers) {
  const att = attendus[f];
  if (!att) { console.error(`  ? ${f} : aucun résultat attendu déclaré`); echecs++; continue; }
  const r = analyser(fs.readFileSync(path.join(dossier, f), "utf8"));
  const indices = r.constats.map((c) => c.indice).filter(Boolean);
  const erreurs = [];
  for (const i of att.indices || []) if (!indices.includes(i)) erreurs.push(`indice « ${i} » manquant`);
  for (const i of att.absents || []) if (indices.includes(i)) erreurs.push(`indice « ${i} » inattendu`);
  for (const [k, v] of Object.entries(att.valeurs || {})) if (r.valeurs[k] !== v) erreurs.push(`valeur ${k} = ${JSON.stringify(r.valeurs[k])}, attendu ${JSON.stringify(v)}`);
  for (const i of indices) if (!(i in contexte.WEBDEBUG.indices)) erreurs.push(`indice « ${i} » non déclaré dans WEBDEBUG.indices`);
  if (erreurs.length) {
    echecs++;
    console.error(`  ✗ ${f} : ${erreurs.join(" ; ")}`);
    console.error(`      constats : ${r.constats.map((c) => `[${c.indice || "-"}] ${c.texte}`).join(" | ")}`);
    console.error(`      valeurs  : ${JSON.stringify(r.valeurs)}`);
  } else {
    console.log(`  ✓ ${f}`);
  }
}
for (const f of Object.keys(attendus)) if (!fichiers.includes(f)) { console.error(`  ? ${f} : fichier absent`); echecs++; }

if (echecs) { console.error(`${echecs} exemple(s) en échec.`); process.exit(1); }
console.log(`OK : ${fichiers.length} exemples analysés correctement.`);
