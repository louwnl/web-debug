# web-debug

Aide au diagnostic réseau : une app web qui guide pas à pas le dépannage d'une machine Windows, macOS ou Linux, avec un catalogue de commandes. L'app ne touche jamais au système dépanné : elle te dit quoi taper, comment lire le résultat, et quelle est l'étape suivante.

## Contenu

- `data/commandes.js` : le catalogue de commandes. Chaque commande a une variante par OS (`windows`, `macos`, `linux`) et une aide à la lecture du résultat. Les valeurs à remplacer sont entre chevrons (`<cible>`, `<passerelle>`, `<interface>`…).
- `data/parcours.js` : l'arbre de diagnostic. On part de l'étape `depart` ; chaque étape pose une question, propose des commandes, et chaque réponse mène à une autre étape ou à une conclusion (identifiants en `fin-…`).

Le parcours remonte les couches du réseau, du plus simple au plus compliqué : symptôme, lien physique, adressage IP et DHCP, passerelle, accès Internet, DNS, puis services, certificats, proxy, performances, MTU et Wi-Fi.

Les fichiers de données sont de simples scripts (pas de JSON ni de modules) pour que l'app fonctionne aussi en ouvrant `index.html` directement depuis le disque, sans serveur.

## Ajouter du contenu

1. Ajouter une commande dans `data/commandes.js` avec ses trois variantes (mettre `null` si une commande n'existe pas sur un OS).
2. La référencer par son identifiant dans le champ `commandes` d'une étape de `data/parcours.js`.
3. Vérifier la cohérence :

```sh
node tools/verifier-donnees.js
```

Le script signale les références cassées, les variantes manquantes, les étapes inatteignables et les boucles. Il tourne aussi automatiquement sur chaque pull request.
