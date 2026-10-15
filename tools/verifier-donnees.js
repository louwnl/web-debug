#!/usr/bin/env node
// Vérifie la cohérence des données : références entre étapes, conclusions et
// commandes, variantes par OS, étapes inatteignables et boucles.
// Usage : node tools/verifier-donnees.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const racine = path.join(__dirname, "..");
const contexte = {};
contexte.window = contexte; // comme dans un navigateur, window est l'objet global
vm.createContext(contexte);
for (const fichier of ["data/commandes.js", "data/parcours.js", "js/analyse.js"]) {
  vm.runInContext(fs.readFileSync(path.join(racine, fichier), "utf8"), contexte, { filename: fichier });
}
const { commandes, categories, parcours, couches, indices } = contexte.window.WEBDEBUG;
const { etapes, conclusions, depart } = parcours;

const erreurs = [];
const OS = ["windows", "macos", "linux"];

for (const [id, c] of Object.entries(commandes)) {
  if (!c.titre) erreurs.push(`commande ${id} : titre manquant`);
  if (!categories[c.categorie]) erreurs.push(`commande ${id} : catégorie inconnue « ${c.categorie} »`);
  if (!c.lecture) erreurs.push(`commande ${id} : aide à la lecture manquante`);
  for (const os of OS) {
    if (!(os in (c.os || {}))) erreurs.push(`commande ${id} : variante ${os} manquante (mettre null si elle n'existe pas)`);
    else if (c.os[os] !== null && !c.os[os].cmd) erreurs.push(`commande ${id} : variante ${os} sans cmd`);
  }
}

for (const id of Object.keys(etapes)) {
  if (id in conclusions) erreurs.push(`« ${id} » est à la fois une étape et une conclusion`);
}
if (!etapes[depart]) erreurs.push(`étape de départ « ${depart} » introuvable`);

for (const [id, e] of Object.entries(etapes)) {
  if (!couches[e.couche]) erreurs.push(`étape ${id} : couche inconnue « ${e.couche} »`);
  if (!e.titre || !e.question) erreurs.push(`étape ${id} : titre ou question manquant`);
  for (const cmd of e.commandes || []) {
    if (!commandes[cmd]) erreurs.push(`étape ${id} : commande inconnue « ${cmd} »`);
  }
  if (!e.reponses || e.reponses.length < 2) erreurs.push(`étape ${id} : il faut au moins deux réponses`);
  for (const r of e.reponses || []) {
    if (!etapes[r.suite] && !conclusions[r.suite]) erreurs.push(`étape ${id} : suite inconnue « ${r.suite} »`);
    for (const i of r.indices || []) {
      if (!(i in indices)) erreurs.push(`étape ${id} : indice inconnu « ${i} » (voir WEBDEBUG.indices dans js/analyse.js)`);
    }
  }
}

for (const [id, c] of Object.entries(conclusions)) {
  if (!c.titre || !c.diagnostic || !c.actions?.length) erreurs.push(`conclusion ${id} : titre, diagnostic ou actions manquants`);
}

// Atteignabilité et détection de boucles (parcours en profondeur).
const atteints = new Set();
const enCours = new Set();
function visiter(id, chemin) {
  if (enCours.has(id)) {
    erreurs.push(`boucle : ${[...chemin, id].join(" → ")}`);
    return;
  }
  if (atteints.has(id)) return;
  atteints.add(id);
  const e = etapes[id];
  if (!e) return;
  enCours.add(id);
  for (const r of e.reponses || []) visiter(r.suite, [...chemin, id]);
  enCours.delete(id);
}
visiter(depart, []);
for (const id of [...Object.keys(etapes), ...Object.keys(conclusions)]) {
  if (!atteints.has(id)) erreurs.push(`« ${id} » n'est atteignable depuis aucun chemin`);
}

const utilisees = new Set(Object.values(etapes).flatMap((e) => e.commandes || []));
const horsParcours = Object.keys(commandes).filter((id) => !utilisees.has(id));

if (erreurs.length) {
  console.error(`${erreurs.length} erreur(s) :`);
  for (const e of erreurs) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `OK : ${Object.keys(etapes).length} étapes, ${Object.keys(conclusions).length} conclusions, ` +
    `${Object.keys(commandes).length} commandes (${horsParcours.length} seulement dans le catalogue` +
    `${horsParcours.length ? " : " + horsParcours.join(", ") : ""}).`
);
