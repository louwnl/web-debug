#!/usr/bin/env node
// Teste la lecture et l'écriture des exports de commandes personnelles (js/perso.js).
// Usage : node tools/tester-perso.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const contexte = {};
contexte.window = contexte;
vm.createContext(contexte);
vm.runInContext("window.WEBDEBUG = { commandes: {}, categories: {} };", contexte);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/perso.js"), "utf8"), contexte, { filename: "js/perso.js" });
const { perso } = contexte.WEBDEBUG;

let ok = 0;
function test(nom, f) {
  f();
  ok++;
  console.log(`  ✓ ${nom}`);
}

test("une commande complète est gardée telle quelle", () => {
  const c = perso.nettoyer({ titre: " Vider ARP ", lecture: "Rien à lire.", os: {
    windows: { cmd: "arp -d *", note: "En administrateur" }, macos: { cmd: "sudo arp -a -d", note: "" }, linux: { cmd: "" } } });
  assert.strictEqual(c.titre, "Vider ARP");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.os)), {
    windows: { cmd: "arp -d *", note: "En administrateur" }, macos: { cmd: "sudo arp -a -d" }, linux: null });
  assert.strictEqual(c.categorie, "perso");
  assert.strictEqual(c.perso, true);
});

test("sans titre ou sans aucune commande : refusée", () => {
  assert.strictEqual(perso.nettoyer({ titre: "", os: { windows: { cmd: "x" } } }), null);
  assert.strictEqual(perso.nettoyer({ titre: "Vide", os: { windows: { cmd: "  " } } }), null);
  assert.strictEqual(perso.nettoyer("n'importe quoi"), null);
});

test("export puis import redonne les mêmes commandes", () => {
  const mes = { "perso-test": perso.nettoyer({ titre: "Test", lecture: "", os: { linux: { cmd: "ss -tlnp" } } }) };
  const json = JSON.parse(JSON.stringify(perso.exporter(mes)));
  assert.strictEqual(json.format, perso.FORMAT);
  const { commandes, ignorees } = perso.lireExport(json);
  assert.strictEqual(ignorees, 0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(commandes)), JSON.parse(JSON.stringify(mes)));
});

test("import : les entrées invalides ou aux id douteux sont ignorées", () => {
  const { commandes, ignorees } = perso.lireExport({ format: perso.FORMAT, commandes: {
    "perso-bon": { titre: "Bon", os: { windows: { cmd: "ipconfig" } } },
    "ping": { titre: "Écrase une commande du catalogue", os: { windows: { cmd: "x" } } },
    "perso-vide": { titre: "Vide", os: {} } } });
  assert.deepStrictEqual(Object.keys(commandes), ["perso-bon"]);
  assert.strictEqual(ignorees, 2);
});

test("import : un autre fichier JSON est refusé avec un message clair", () => {
  assert.throws(() => perso.lireExport({ etapes: [] }), /pas un export/);
  assert.throws(() => perso.lireExport(null), /pas un export/);
});

test("identifiants : lisibles, sans accents, sans doublon", () => {
  assert.strictEqual(perso.nouvelId("Vérifier l'accès SMB", {}), "perso-verifier-l-acces-smb");
  assert.strictEqual(perso.nouvelId("Test", { "perso-test": {}, "perso-test-2": {} }), "perso-test-3");
  assert.strictEqual(perso.nouvelId("!!!", {}), "perso-commande");
});

console.log(`OK : ${ok} tests.`);
