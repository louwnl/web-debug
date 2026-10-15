#!/usr/bin/env node
// Teste le calculateur de sous-réseau et l'identification des adresses MAC.
// Usage : node tools/tester-outils.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const racine = path.join(__dirname, "..");
const contexte = {};
contexte.window = contexte;
vm.createContext(contexte);
for (const f of ["data/oui.js", "js/outils.js"]) vm.runInContext(fs.readFileSync(path.join(racine, f), "utf8"), contexte, { filename: f });
const { sousReseau, infosMac, trouverMacs } = contexte.WEBDEBUG;

const cas = [];
const test = (nom, f) => cas.push([nom, f]);

test("/24 classique", () => {
  const r = sousReseau("192.168.1.42/24");
  assert.strictEqual(r.reseau, "192.168.1.0");
  assert.strictEqual(r.diffusion, "192.168.1.255");
  assert.strictEqual(r.premier, "192.168.1.1");
  assert.strictEqual(r.dernier, "192.168.1.254");
  assert.strictEqual(r.hotes, 254);
  assert.match(r.type, /privée/);
  assert.strictEqual(r.contient("192.168.1.1"), true);
  assert.strictEqual(r.contient("192.168.2.1"), false);
});
test("masque en notation pointée", () => {
  const r = sousReseau("10.20.30.40 255.255.240.0");
  assert.strictEqual(r.prefixe, 20);
  assert.strictEqual(r.reseau, "10.20.16.0");
  assert.strictEqual(r.diffusion, "10.20.31.255");
  assert.strictEqual(r.hotes, 4094);
});
test("/31 et /32", () => {
  assert.strictEqual(sousReseau("10.0.0.0/31").hotes, 2);
  assert.strictEqual(sousReseau("10.0.0.5/32").premier, "10.0.0.5");
});
test("/0", () => assert.strictEqual(sousReseau("8.8.8.8/0").masque, "0.0.0.0"));
test("APIPA et adresse de réseau", () => {
  assert.match(sousReseau("169.254.3.4/16").type, /APIPA/);
  assert.ok(sousReseau("192.168.1.0/24").remarques.some((x) => /adresse du réseau/.test(x)));
});
test("erreurs", () => {
  assert.ok(sousReseau("300.1.1.1/24").erreur);
  assert.ok(sousReseau("10.0.0.1 255.0.255.0").erreur);
  assert.ok(sousReseau("bonjour").erreur);
});
test("fabricant connu", () => {
  const r = infosMac("00-00-0C-12-34-56");
  assert.match(r.fabricant, /Cisco/i);
});
test("adresse aléatoire", () => {
  const r = infosMac("DA:A1:19:00:00:01");
  assert.strictEqual(r.fabricant, null);
  assert.ok(r.remarques.some((x) => /administrée localement/.test(x)));
});
test("format Cisco et broadcast", () => {
  assert.strictEqual(infosMac("0000.0c12.3456").mac, "00:00:0C:12:34:56");
  assert.ok(infosMac("ff:ff:ff:ff:ff:ff").remarques[0].includes("diffusion"));
});
test("table ARP Windows collée", () => {
  const macs = trouverMacs(`Interface : 192.168.1.42 --- 0x5
  Adresse Internet      Adresse physique      Type
  192.168.1.1           00-00-0c-aa-bb-cc     dynamique
  192.168.1.255         ff-ff-ff-ff-ff-ff     statique`);
  assert.strictEqual(macs.length, 2);
  assert.strictEqual(macs[0].ip, "192.168.1.1");
  assert.match(macs[0].fabricant, /Cisco/i);
});

let echecs = 0;
for (const [nom, f] of cas) {
  try { f(); console.log(`  ✓ ${nom}`); } catch (e) { echecs++; console.error(`  ✗ ${nom} : ${e.message}`); }
}
if (echecs) { console.error(`${echecs} test(s) en échec.`); process.exit(1); }
console.log(`OK : ${cas.length} tests.`);
