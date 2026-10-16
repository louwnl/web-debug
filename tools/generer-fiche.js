#!/usr/bin/env node
// Génère data/fiche.js (onglet Fiche) à partir de fiche/fiche-reseau.md.
// Markdown simple : titres # et ##, paragraphes, listes - et 1., tableaux,
// **gras** et `code`. La ligne <!-- schema: nom --> insère fiche/nom.svg.
// Usage : node tools/generer-fiche.js  (après chaque modification de la fiche)

const fs = require("fs");
const path = require("path");

const racine = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(racine, "fiche/fiche-reseau.md"), "utf8");

const echapper = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Texte d'une ligne : le code est laissé tel quel, le reste reçoit le gras.
function enLigne(texte) {
  return texte
    .split(/(`[^`]*`)/)
    .map((bout) =>
      bout.startsWith("`") && bout.endsWith("`") && bout.length > 1
        ? `<code>${echapper(bout.slice(1, -1))}</code>`
        : echapper(bout).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    )
    .join("");
}

const identifiant = (t) =>
  "fiche-" + t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const cellules = (ligne) => ligne.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const lignes = source.split("\n");
const sections = [];
let html = "";
let titre = "";
let sectionOuverte = false;

for (let i = 0; i < lignes.length; ) {
  const ligne = lignes[i];
  if (!ligne.trim()) { i++; continue; }

  let m;
  if ((m = ligne.match(/^# (.+)/))) {
    titre = m[1].trim();
    i++;
  } else if ((m = ligne.match(/^## (.+)/))) {
    if (sectionOuverte) html += "</section>\n";
    const id = identifiant(m[1]);
    sections.push({ id, titre: m[1].trim() });
    html += `<section id="${id}" class="carte section-fiche">\n<h2>${enLigne(m[1].trim())}</h2>\n`;
    sectionOuverte = true;
    i++;
  } else if ((m = ligne.match(/^<!-- schema: ([a-z0-9-]+) -->$/))) {
    const svg = fs.readFileSync(path.join(racine, `fiche/${m[1]}.svg`), "utf8").trim();
    html += `<figure class="schema-fiche">${svg}</figure>\n`;
    i++;
  } else if (ligne.startsWith("|")) {
    const bloc = [];
    while (i < lignes.length && lignes[i].startsWith("|")) bloc.push(lignes[i++]);
    const [entete, , ...corps] = bloc;
    html += `<div class="defile"><table class="tableau-fiche">\n<thead><tr>${cellules(entete).map((c) => `<th>${enLigne(c)}</th>`).join("")}</tr></thead>\n<tbody>\n`;
    html += corps.map((l) => `<tr>${cellules(l).map((c) => `<td>${enLigne(c)}</td>`).join("")}</tr>`).join("\n");
    html += "\n</tbody></table></div>\n";
  } else if (/^(\d+\.|-) /.test(ligne)) {
    const ordonnee = /^\d+\./.test(ligne);
    const motif = ordonnee ? /^\d+\. / : /^- /;
    const elements = [];
    while (i < lignes.length && motif.test(lignes[i])) elements.push(lignes[i++].replace(motif, ""));
    const balise = ordonnee ? "ol" : "ul";
    html += `<${balise}>\n${elements.map((e) => `<li>${enLigne(e)}</li>`).join("\n")}\n</${balise}>\n`;
  } else {
    const paragraphe = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#|\||<!--|\d+\. |- )/.test(lignes[i])) paragraphe.push(lignes[i++]);
    html += `<p>${enLigne(paragraphe.join(" "))}</p>\n`;
  }
}
if (sectionOuverte) html += "</section>\n";

const sortie = `// Généré par tools/generer-fiche.js depuis fiche/fiche-reseau.md : ne pas modifier à la main.
window.WEBDEBUG = window.WEBDEBUG || {};
WEBDEBUG.fiche = ${JSON.stringify({ titre, sections, html }, null, 1)};
`;
fs.writeFileSync(path.join(racine, "data/fiche.js"), sortie);
console.log(`data/fiche.js : ${sections.length} sections, ${Math.round(html.length / 1024)} Ko de HTML.`);
