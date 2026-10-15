# web-debug

Aide au diagnostic réseau : une app web qui guide pas à pas le dépannage d'une machine Windows, macOS ou Linux, avec un catalogue de commandes. L'app ne touche jamais au système dépanné : elle te dit quoi taper, comment lire le résultat, et quelle est l'étape suivante.

## Utilisation

L'app est publiée sur https://louwnl.github.io/web-debug/ à chaque mise à jour de `main`. Après une première visite, elle marche hors ligne, et Edge ou Chrome proposent de l'installer comme une application (icône d'installation dans la barre d'adresse).

On peut aussi ouvrir `index.html` directement depuis le disque, sans serveur ni installation (le mode hors ligne n'est alors pas nécessaire). Choisis en haut le système de la machine que tu dépannes, puis :

- **Diagnostic guidé** : réponds aux questions, l'app affiche à chaque étape la commande à taper et comment lire le résultat, jusqu'à un diagnostic avec les actions à faire. Le fil en haut permet de revenir à une étape précédente.
- **Catalogue** : toutes les commandes, classées par catégorie, avec une recherche.

Pendant le dépannage :

- **Valeurs à remplacer** : saisis une fois la cible, la passerelle, l'interface ou le port, et toutes les commandes (guidé et catalogue) les utilisent, y compris quand tu cliques sur Copier.
- **Observations** : chaque étape a un champ pour noter ce que tu as vu (une IP, un message d'erreur).
- **Notes et compte rendu** : des notes libres, puis un compte rendu en texte (étapes, réponses, observations, diagnostic, actions, notes) à copier ou télécharger pour un ticket.
- **Dépannages précédents** : « Nouvelle session » range la session en cours dans l'historique (date, système, cible, diagnostic atteint, première ligne des notes) au lieu de l'effacer. Chaque dépannage peut être rouvert là où il s'était arrêté, ou son compte rendu copié ou téléchargé.

Le choix du système et la session en cours sont gardés dans le navigateur, même après un rechargement, jusqu'à « Nouvelle session ».

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

## Publication

Le workflow `.github/workflows/publier.yml` vérifie les données puis publie le site sur GitHub Pages à chaque push sur `main`. Il faut avoir réglé une fois *Settings → Pages → Source* sur **GitHub Actions**.

Le mode hors ligne est géré par `sw.js` : l'app s'ouvre depuis le cache et récupère la nouvelle version en arrière-plan, visible au chargement suivant. Si un fichier est ajouté à l'app, l'ajouter aussi à la liste `FICHIERS` de `sw.js`.
