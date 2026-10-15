#!/usr/bin/env node
// Génère data/oui.js (fabricants des cartes réseau) depuis le registre OUI de l'IEEE,
// tel que publié par le paquet npm « oui-data » (fichier index.json).
// Usage : node tools/generer-oui.js chemin/vers/index.json
//
// Format produit, compact pour rester léger : une liste de fabricants et une chaîne
// « OUI(6 hexa)index(base 36) » séparés par des virgules.

const fs = require("fs");
const path = require("path");

const source = process.argv[2];
if (!source) {
  console.error("Usage : node tools/generer-oui.js chemin/vers/index.json");
  process.exit(1);
}
const registre = JSON.parse(fs.readFileSync(source, "utf8"));

const fabricants = [];
const indexDe = new Map();
const entrees = [];
for (const [oui, texte] of Object.entries(registre).sort()) {
  const lignes = texte.split("\n").map((l) => l.trim()).filter(Boolean);
  const pays = lignes.length > 1 ? lignes[lignes.length - 1] : "";
  const nom = `${lignes[0]}${pays && pays.length <= 30 ? ` (${pays})` : ""}`;
  if (!indexDe.has(nom)) { indexDe.set(nom, fabricants.length); fabricants.push(nom); }
  entrees.push(oui.toUpperCase() + indexDe.get(nom).toString(36));
}

const sortie = `// Généré par tools/generer-oui.js depuis le registre OUI de l'IEEE (paquet npm oui-data).
// ${entrees.length} préfixes, ${fabricants.length} fabricants. Ne pas modifier à la main.
window.WEBDEBUG = window.WEBDEBUG || {};
WEBDEBUG.oui = {
  fabricants: ${JSON.stringify(fabricants)},
  prefixes: "${entrees.join(",")}",
};
`;
const cible = path.join(__dirname, "..", "data", "oui.js");
fs.writeFileSync(cible, sortie);
console.log(`${cible} : ${entrees.length} préfixes, ${fabricants.length} fabricants, ${(sortie.length / 1024).toFixed(0)} Ko`);
