// Parcours de diagnostic guidé.
//
// Le parcours est un arbre de décision. On part de l'étape « depart », et
// chaque étape propose des réponses qui mènent soit à une autre étape, soit à
// une conclusion. Les commandes sont référencées par leur identifiant dans
// data/commandes.js, et l'app n'affiche que la variante de l'OS choisi.
//
// Étape :      { couche, titre, question, aide?, commandes?, reponses: [{ texte, suite, indices? }] }
//   indices : constats de js/analyse.js qui font suggérer cette réponse quand un
//   résultat de commande est collé (liste dans WEBDEBUG.indices).
// Conclusion : { titre, diagnostic, actions: [texte, ...] }
//
// Les couches suivent le modèle classique du bas vers le haut, pour toujours
// éliminer les causes simples avant les compliquées.

window.WEBDEBUG = window.WEBDEBUG || {};

WEBDEBUG.couches = {
  symptome: "Symptôme",
  physique: "Lien physique",
  ip: "Adressage IP",
  local: "Réseau local",
  internet: "Accès Internet",
  dns: "DNS",
  service: "Service et application",
  wifi: "Wi-Fi",
  performance: "Performances",
};

WEBDEBUG.parcours = {
  depart: "symptome",

  etapes: {
    // --- Point de départ ----------------------------------------------------
    symptome: {
      couche: "symptome",
      titre: "Quel est le problème ?",
      question: "Qu'est-ce que l'utilisateur constate ?",
      aide: "Fais-toi décrire le symptôme précisément. Demande aussi depuis quand, et si d'autres machines du même réseau ont le même problème : si toutes sont touchées, le problème est sur le réseau, pas sur la machine.",
      reponses: [
        { texte: "Plus rien ne marche, pas d'Internet du tout", suite: "lien" },
        { texte: "Internet marche, mais un site, un serveur ou une application précise ne répond pas", suite: "service-dns" },
        { texte: "Ça marche, mais c'est lent ou ça coupe", suite: "perf-type" },
        { texte: "Problème de Wi-Fi (pas de connexion, signal faible)", suite: "wifi-associe" },
      ],
    },

    // --- Pas d'Internet : on remonte les couches ----------------------------
    lien: {
      couche: "physique",
      titre: "La carte réseau est-elle connectée ?",
      question: "La carte utilisée (Ethernet ou Wi-Fi) est-elle active, avec un lien ?",
      aide: "Regarde aussi les voyants du port réseau et l'icône réseau de la barre des tâches. En Wi-Fi, vérifie que la machine est bien associée à un réseau.",
      commandes: ["etat-interfaces"],
      reponses: [
        { texte: "Oui, la carte est connectée (Up, Connected, active)", suite: "adresse-ip", indices: ["lien-up"] },
        { texte: "Non, câble débranché ou carte déconnectée (Ethernet)", suite: "fin-lien-ethernet", indices: ["lien-down"] },
        { texte: "Non, pas associé au Wi-Fi", suite: "wifi-associe" },
        { texte: "La carte n'apparaît pas du tout", suite: "fin-carte-absente" },
      ],
    },
    "adresse-ip": {
      couche: "ip",
      titre: "La machine a-t-elle une adresse IP valide ?",
      question: "Que donne la configuration IP de la carte connectée ?",
      aide: "Relève l'adresse IPv4, le masque, la passerelle et les DNS : tu en auras besoin dans les étapes suivantes.",
      commandes: ["config-ip"],
      reponses: [
        { texte: "Une IP cohérente avec le réseau, et une passerelle", suite: "passerelle", indices: ["ip-ok"] },
        { texte: "Une IP en 169.254.x.x, ou pas d'IP du tout", suite: "dhcp", indices: ["apipa", "sans-ip"] },
        { texte: "Une IP, mais pas de passerelle par défaut", suite: "fin-pas-de-passerelle", indices: ["sans-passerelle"] },
        { texte: "Une IP fixe qui ne correspond pas au réseau", suite: "fin-ip-fixe" },
      ],
    },
    dhcp: {
      couche: "ip",
      titre: "Le DHCP répond-il ?",
      question: "Après un renouvellement du bail, la machine obtient-elle une adresse correcte ?",
      commandes: ["renouveler-dhcp", "config-ip"],
      reponses: [
        { texte: "Oui, une adresse correcte est obtenue", suite: "fin-dhcp-ok", indices: ["ip-ok"] },
        { texte: "Non, toujours en 169.254.x.x ou sans IP", suite: "dhcp-autres", indices: ["apipa", "sans-ip"] },
      ],
    },
    "dhcp-autres": {
      couche: "ip",
      titre: "Les autres machines obtiennent-elles une adresse ?",
      question: "Une autre machine branchée au même endroit (même prise, même Wi-Fi) obtient-elle une IP ?",
      aide: "Si tu n'as pas d'autre machine, essaie un téléphone sur le même Wi-Fi, ou une autre prise réseau.",
      reponses: [
        { texte: "Oui, les autres ont une IP", suite: "fin-dhcp-machine" },
        { texte: "Non, personne n'obtient d'IP", suite: "fin-dhcp-serveur" },
      ],
    },
    passerelle: {
      couche: "local",
      titre: "La passerelle répond-elle ?",
      question: "Le ping vers la passerelle (relevée à l'étape précédente) répond-il ?",
      commandes: ["ping-passerelle", "table-arp"],
      reponses: [
        { texte: "Oui, réponses sans perte", suite: "internet-ip", indices: ["ping-ok"] },
        { texte: "Non, mais la passerelle apparaît dans la table ARP avec une MAC", suite: "internet-ip" },
        { texte: "Non, et pas d'entrée ARP valide pour la passerelle", suite: "fin-passerelle-injoignable", indices: ["ping-echec"] },
      ],
    },
    "internet-ip": {
      couche: "internet",
      titre: "Internet est-il joignable sans passer par le DNS ?",
      question: "Le ping vers une IP publique (1.1.1.1) répond-il ?",
      aide: "Sur certains réseaux d'entreprise le ping vers l'extérieur est bloqué : dans ce cas, passe directement au test DNS puis au test HTTP.",
      commandes: ["ping-ip-publique"],
      reponses: [
        { texte: "Oui", suite: "dns", indices: ["ping-ok"] },
        { texte: "Non", suite: "traceroute", indices: ["ping-echec"] },
        { texte: "Le ping est bloqué sur ce réseau, je ne peux pas savoir", suite: "dns" },
      ],
    },
    traceroute: {
      couche: "internet",
      titre: "Où le trafic s'arrête-t-il ?",
      question: "Dans le traceroute vers 1.1.1.1, quel est le dernier saut qui répond ?",
      commandes: ["traceroute", "voir-routes"],
      reponses: [
        { texte: "Rien ne répond, même pas le premier saut", suite: "fin-routage-local" },
        { texte: "Seulement le premier saut (la box ou le routeur)", suite: "fin-acces-internet" },
        { texte: "Ça va plus loin, puis ça s'arrête chez le fournisseur", suite: "fin-fournisseur" },
        { texte: "Le premier saut n'est pas la passerelle attendue (VPN, autre carte)", suite: "fin-mauvaise-route" },
      ],
    },
    dns: {
      couche: "dns",
      titre: "Le DNS fonctionne-t-il ?",
      question: "La résolution d'un nom connu (par exemple www.google.com) renvoie-t-elle une adresse IP ?",
      commandes: ["resolution-dns", "voir-dns"],
      reponses: [
        { texte: "Oui, une IP est renvoyée", suite: "http", indices: ["dns-ok"] },
        { texte: "Non, délai dépassé ou erreur", suite: "dns-externe", indices: ["dns-delai", "dns-inconnu"] },
      ],
    },
    "dns-externe": {
      couche: "dns",
      titre: "Un DNS public répond-il ?",
      question: "La résolution du même nom en interrogeant directement 1.1.1.1 fonctionne-t-elle ?",
      commandes: ["resolution-dns-externe"],
      reponses: [
        { texte: "Oui, le DNS public répond", suite: "fin-dns-serveur", indices: ["dns-ok"] },
        { texte: "Non, aucun DNS ne répond", suite: "fin-dns-bloque", indices: ["dns-delai"] },
      ],
    },
    http: {
      couche: "service",
      titre: "Le web répond-il en ligne de commande ?",
      question: "Une requête HTTPS vers un site connu (www.google.com) renvoie-t-elle un code de réponse ?",
      commandes: ["requete-http"],
      reponses: [
        { texte: "Oui, code 200 ou 301/302", suite: "fin-navigateur", indices: ["http-ok"] },
        { texte: "Erreur de certificat", suite: "certificat", indices: ["certificat"] },
        { texte: "Délai dépassé ou connexion refusée", suite: "proxy", indices: ["port-delai", "port-refuse"] },
      ],
    },
    proxy: {
      couche: "service",
      titre: "Un proxy est-il configuré ?",
      question: "La machine utilise-t-elle un proxy ?",
      commandes: ["proxy", "pare-feu"],
      reponses: [
        { texte: "Oui, un proxy ou un fichier PAC est configuré", suite: "fin-proxy" },
        { texte: "Non, pas de proxy", suite: "fin-filtrage" },
      ],
    },
    certificat: {
      couche: "service",
      titre: "Que dit le certificat ?",
      question: "Qu'est-ce qui ne va pas dans le certificat présenté ?",
      aide: "Commence par vérifier la date et l'heure de la machine : c'est la cause la plus fréquente.",
      commandes: ["verifier-certificat"],
      reponses: [
        { texte: "La date ou l'heure de la machine est fausse", suite: "fin-horloge" },
        { texte: "Le certificat est expiré ou ne correspond pas au nom", suite: "fin-certificat-serveur" },
        { texte: "L'émetteur est inconnu (proxy d'entreprise, antivirus)", suite: "fin-inspection-tls" },
      ],
    },

    // --- Un service précis ne répond pas ------------------------------------
    "service-dns": {
      couche: "dns",
      titre: "Le nom du service se résout-il ?",
      question: "La résolution du nom du serveur ou du site renvoie-t-elle la bonne adresse IP ?",
      aide: "Si l'utilisateur se connecte par adresse IP directement, réponds « Oui ».",
      commandes: ["resolution-dns", "fichier-hosts"],
      reponses: [
        { texte: "Oui, la bonne IP", suite: "service-port", indices: ["dns-ok"] },
        { texte: "Non, nom introuvable (NXDOMAIN)", suite: "fin-nom-introuvable", indices: ["dns-inconnu"] },
        { texte: "Une IP, mais pas la bonne (ancienne adresse)", suite: "fin-dns-obsolete" },
        { texte: "Délai dépassé", suite: "dns-externe", indices: ["dns-delai"] },
      ],
    },
    "service-port": {
      couche: "service",
      titre: "Le port du service est-il joignable ?",
      question: "Le test de connexion TCP sur le port du service (443 pour HTTPS, 3389 pour RDP, 445 pour un partage…) réussit-il ?",
      commandes: ["test-port", "ping-cible"],
      reponses: [
        { texte: "Oui, le port est ouvert", suite: "service-application", indices: ["port-ouvert"] },
        { texte: "Connexion refusée", suite: "fin-service-arrete", indices: ["port-refuse"] },
        { texte: "Délai dépassé", suite: "service-chemin", indices: ["port-delai"] },
      ],
    },
    "service-chemin": {
      couche: "internet",
      titre: "Le serveur est-il joignable du tout ?",
      question: "Le traceroute vers le serveur arrive-t-il jusqu'au bout ?",
      commandes: ["traceroute"],
      reponses: [
        { texte: "Oui, le serveur est atteint", suite: "fin-port-filtre", indices: ["trace-complete"] },
        { texte: "Non, ça s'arrête avant", suite: "fin-serveur-injoignable", indices: ["trace-bloquee"] },
      ],
    },
    "service-application": {
      couche: "service",
      titre: "L'application répond-elle correctement ?",
      question: "Pour un site web, quel code renvoie la requête HTTP ? Pour une autre application, qu'indique son message d'erreur ?",
      commandes: ["requete-http", "verifier-certificat"],
      reponses: [
        { texte: "Erreur de certificat", suite: "certificat", indices: ["certificat"] },
        { texte: "401 ou 403 (accès refusé)", suite: "fin-droits", indices: ["http-refuse"] },
        { texte: "Erreur 5xx", suite: "fin-erreur-serveur", indices: ["http-erreur"] },
        { texte: "Tout répond bien en ligne de commande", suite: "fin-navigateur", indices: ["http-ok"] },
      ],
    },

    // --- Lent ou coupures ---------------------------------------------------
    "perf-type": {
      couche: "performance",
      titre: "Quel type de lenteur ?",
      question: "Comment se manifeste le problème ?",
      reponses: [
        { texte: "Tout est lent, en permanence", suite: "perf-local" },
        { texte: "Ça coupe ou ça décroche par moments", suite: "perf-local" },
        { texte: "Certains sites chargent à moitié ou se figent, d'autres marchent", suite: "perf-mtu" },
        { texte: "Le premier chargement est long, ensuite ça va", suite: "perf-dns" },
      ],
    },
    "perf-local": {
      couche: "performance",
      titre: "Le réseau local est-il stable ?",
      question: "Un ping long vers la passerelle montre-t-il des pertes ou une latence variable ?",
      aide: "Laisse tourner le ping pendant que le problème se produit.",
      commandes: ["ping-long", "connexions-actives"],
      reponses: [
        { texte: "Pertes ou latence élevée dès la passerelle", suite: "perf-support", indices: ["ping-pertes", "ping-echec"] },
        { texte: "Passerelle stable", suite: "perf-internet", indices: ["ping-ok"] },
      ],
    },
    "perf-support": {
      couche: "physique",
      titre: "La machine est-elle en Wi-Fi ou en filaire ?",
      question: "Par quel moyen la machine est-elle connectée ?",
      reponses: [
        { texte: "Wi-Fi", suite: "wifi-signal" },
        { texte: "Câble Ethernet", suite: "perf-ethernet" },
      ],
    },
    "perf-ethernet": {
      couche: "physique",
      titre: "Le lien Ethernet est-il négocié correctement ?",
      question: "Quelle vitesse et quel duplex affiche la carte ?",
      commandes: ["vitesse-lien", "conflit-ip"],
      reponses: [
        { texte: "10 ou 100 Mb/s, ou half-duplex", suite: "fin-cable", indices: ["lien-lent"] },
        { texte: "1 Gb/s ou plus, full-duplex", suite: "fin-reseau-sature", indices: ["lien-rapide"] },
        { texte: "Un conflit d'adresse IP est signalé", suite: "fin-conflit-ip" },
      ],
    },
    "perf-internet": {
      couche: "performance",
      titre: "Où apparaissent les pertes ?",
      question: "Une mesure de perte saut par saut vers un site lent montre-t-elle un segment fautif ?",
      commandes: ["pathping", "debit"],
      reponses: [
        { texte: "Pertes à partir de la box ou du premier saut du fournisseur", suite: "fin-fournisseur" },
        { texte: "Pertes seulement vers une destination précise", suite: "fin-destination-lente" },
        { texte: "Pas de perte, mais le débit est très inférieur à l'abonnement", suite: "fin-reseau-sature" },
      ],
    },
    "perf-mtu": {
      couche: "performance",
      titre: "La taille des paquets pose-t-elle problème ?",
      question: "Le ping de 1472 octets sans fragmentation vers un site concerné passe-t-il ?",
      commandes: ["test-mtu"],
      reponses: [
        { texte: "Non, il faut descendre la taille pour que ça passe", suite: "fin-mtu", indices: ["mtu-trop-grand"] },
        { texte: "Oui, 1472 passe", suite: "proxy", indices: ["mtu-ok"] },
      ],
    },
    "perf-dns": {
      couche: "dns",
      titre: "La résolution DNS est-elle lente ?",
      question: "La résolution d'un nom prend-elle plus d'une seconde, ou le premier serveur DNS listé ne répond-il pas ?",
      commandes: ["voir-dns", "resolution-dns", "resolution-dns-externe"],
      reponses: [
        { texte: "Oui, le DNS configuré est lent ou un serveur ne répond pas", suite: "fin-dns-serveur" },
        { texte: "Non, la résolution est rapide", suite: "fin-destination-lente" },
      ],
    },

    // --- Wi-Fi --------------------------------------------------------------
    "wifi-associe": {
      couche: "wifi",
      titre: "La machine voit-elle le réseau Wi-Fi ?",
      question: "Le réseau attendu apparaît-il dans la liste des réseaux visibles ?",
      commandes: ["reseaux-wifi", "etat-wifi"],
      reponses: [
        { texte: "Oui, et la machine y est connectée", suite: "wifi-signal" },
        { texte: "Oui, mais la connexion échoue", suite: "wifi-echec" },
        { texte: "Non, le réseau n'apparaît pas", suite: "fin-wifi-invisible" },
      ],
    },
    "wifi-echec": {
      couche: "wifi",
      titre: "Pourquoi la connexion échoue-t-elle ?",
      question: "Que montrent le message d'erreur et le journal Wi-Fi ?",
      commandes: ["rapport-wifi"],
      reponses: [
        { texte: "Mot de passe ou authentification refusée", suite: "fin-wifi-auth" },
        { texte: "Connecté au Wi-Fi mais « pas d'Internet »", suite: "adresse-ip" },
        { texte: "Connexion puis déconnexion en boucle", suite: "wifi-signal" },
      ],
    },
    "wifi-signal": {
      couche: "wifi",
      titre: "Le signal Wi-Fi est-il bon ?",
      question: "Quel niveau de signal et quel débit indique la connexion Wi-Fi ?",
      commandes: ["etat-wifi", "reseaux-wifi"],
      reponses: [
        { texte: "Signal faible (moins de 40 % ou sous -75 dBm)", suite: "fin-wifi-signal", indices: ["wifi-faible"] },
        { texte: "Bon signal, mais beaucoup de réseaux sur le même canal", suite: "fin-wifi-interferences" },
        { texte: "Bon signal, canal dégagé", suite: "adresse-ip", indices: ["wifi-bon"] },
      ],
    },
  },

  conclusions: {
    // Lien physique
    "fin-lien-ethernet": {
      titre: "Pas de lien Ethernet",
      diagnostic: "La carte ne détecte aucun lien : le problème est physique, entre la carte et le switch ou la box.",
      actions: [
        "Rebrancher le câble des deux côtés, vérifier les voyants du port.",
        "Essayer un autre câble, puis une autre prise ou un autre port du switch.",
        "Vérifier que la prise murale est bien brassée et que le port du switch est actif.",
        "Vérifier que la carte n'est pas désactivée dans le système.",
      ],
    },
    "fin-carte-absente": {
      titre: "Carte réseau absente",
      diagnostic: "Le système ne voit pas la carte réseau : pilote manquant, carte désactivée dans le BIOS ou matériel défaillant.",
      actions: [
        "Windows : vérifier le Gestionnaire de périphériques (devmgmt.msc) pour une carte en erreur ou désactivée.",
        "Linux : lspci -k ou lsusb pour voir la carte et le pilote chargé, dmesg | grep -i eth pour les erreurs.",
        "Réinstaller ou mettre à jour le pilote, vérifier l'option dans le BIOS/UEFI.",
        "Tester avec un adaptateur USB-Ethernet pour confirmer une panne matérielle.",
      ],
    },

    // IP et DHCP
    "fin-dhcp-ok": {
      titre: "Bail DHCP renouvelé",
      diagnostic: "Le renouvellement a suffi : la machine avait un bail expiré ou bloqué.",
      actions: [
        "Relancer le diagnostic depuis le début pour vérifier que tout fonctionne.",
        "Si le problème revient, regarder si la plage DHCP est pleine (trop d'appareils pour le nombre d'adresses).",
      ],
    },
    "fin-dhcp-machine": {
      titre: "La machine n'obtient pas de bail",
      diagnostic: "Les autres machines obtiennent une adresse, le serveur DHCP fonctionne : le problème vient de cette machine ou de son accès.",
      actions: [
        "Vérifier que la carte est réglée en « Obtenir une adresse automatiquement ».",
        "Désactiver puis réactiver la carte, ou réinitialiser la pile réseau (Windows : netsh int ip reset et netsh winsock reset, puis redémarrer).",
        "Vérifier un éventuel filtrage MAC, une réservation ou un contrôle d'accès 802.1X sur le réseau.",
        "Vérifier que le pare-feu local ou un logiciel de sécurité ne bloque pas le DHCP.",
      ],
    },
    "fin-dhcp-serveur": {
      titre: "Le serveur DHCP ne répond pas",
      diagnostic: "Aucune machine n'obtient d'adresse : le serveur DHCP (souvent la box ou le routeur) est en panne, saturé ou injoignable.",
      actions: [
        "Redémarrer la box ou le routeur.",
        "Vérifier que le service DHCP est activé et que la plage d'adresses n'est pas pleine.",
        "En entreprise : vérifier le serveur DHCP, le relais DHCP (ip helper) et le VLAN du port.",
        "En dépannage, configurer une IP fixe dans la bonne plage pour continuer les tests.",
      ],
    },
    "fin-pas-de-passerelle": {
      titre: "Pas de passerelle par défaut",
      diagnostic: "La machine a une adresse mais ne sait pas où envoyer le trafic hors du réseau local.",
      actions: [
        "En IP fixe : ajouter la passerelle (adresse de la box ou du routeur).",
        "En DHCP : l'option « routeur » (option 3) manque dans la configuration du serveur DHCP.",
        "Vérifier qu'un VPN ou un logiciel n'a pas supprimé la route par défaut.",
      ],
    },
    "fin-ip-fixe": {
      titre: "Adresse IP fixe incorrecte",
      diagnostic: "La machine a une IP configurée à la main qui ne correspond pas au réseau où elle est branchée.",
      actions: [
        "Repasser la carte en DHCP (obtenir une adresse automatiquement).",
        "Ou corriger IP, masque, passerelle et DNS pour correspondre au réseau actuel.",
        "Cas typique : un portable configuré en IP fixe pour un autre site.",
      ],
    },
    "fin-conflit-ip": {
      titre: "Conflit d'adresse IP",
      diagnostic: "Deux appareils utilisent la même adresse IP, ce qui provoque des coupures aléatoires.",
      actions: [
        "Identifier l'autre appareil grâce à la table ARP (adresse MAC) ou à l'interface de la box.",
        "Changer l'IP fixe en cause, ou l'exclure de la plage DHCP.",
      ],
    },

    // Réseau local et Internet
    "fin-passerelle-injoignable": {
      titre: "Passerelle injoignable",
      diagnostic: "La machine a une configuration correcte mais ne parvient pas à joindre la passerelle : problème sur le réseau local.",
      actions: [
        "Vérifier que la box ou le routeur est allumé et fonctionne (voyants, accès à son interface depuis une autre machine).",
        "Vérifier que d'autres machines joignent la passerelle : si non, redémarrer la box ou le switch.",
        "En entreprise : vérifier le VLAN du port et l'état du switch.",
        "Vérifier que le pare-feu local ne bloque pas tout le trafic sortant.",
      ],
    },
    "fin-routage-local": {
      titre: "Le trafic ne sort pas de la machine",
      diagnostic: "Même le premier saut ne répond pas : la route par défaut ou le pare-feu local bloque le trafic.",
      actions: [
        "Comparer la table de routage avec la passerelle attendue.",
        "Désactiver temporairement un VPN ou un logiciel de sécurité pour tester.",
        "Vérifier l'état du pare-feu local.",
      ],
    },
    "fin-acces-internet": {
      titre: "La box ou le routeur ne sort pas sur Internet",
      diagnostic: "Le réseau local fonctionne mais la box ou le routeur ne transmet pas vers Internet.",
      actions: [
        "Vérifier l'état de la connexion Internet dans l'interface de la box (synchronisation, IP WAN).",
        "Redémarrer la box ou le modem.",
        "Vérifier sur le site du fournisseur s'il y a une panne en cours.",
        "En entreprise : vérifier le pare-feu de sortie et la liaison WAN.",
      ],
    },
    "fin-fournisseur": {
      titre: "Problème chez le fournisseur d'accès",
      diagnostic: "Le trafic sort du réseau local mais se perd ou se dégrade sur le réseau du fournisseur.",
      actions: [
        "Vérifier les pannes signalées par le fournisseur.",
        "Garder la sortie du traceroute ou du mtr comme preuve pour ouvrir un ticket.",
        "Tester à différents moments pour voir si c'est lié à la charge (heures de pointe).",
      ],
    },
    "fin-mauvaise-route": {
      titre: "Le trafic part par la mauvaise route",
      diagnostic: "Le premier saut n'est pas la passerelle attendue : un VPN, une deuxième carte ou une route statique détourne le trafic.",
      actions: [
        "Examiner la table de routage : chercher plusieurs routes par défaut et leurs métriques.",
        "Déconnecter le VPN ou désactiver la carte en trop pour tester.",
        "Corriger la métrique ou supprimer la route statique en cause.",
      ],
    },

    // DNS
    "fin-dns-serveur": {
      titre: "Le serveur DNS configuré est en cause",
      diagnostic: "Internet est joignable et un DNS public répond, mais le DNS configuré sur la machine est lent ou ne répond pas.",
      actions: [
        "Vérifier les serveurs DNS listés : enlever ceux qui ne répondent plus (ancien VPN, ancien serveur).",
        "Redémarrer la box si c'est elle qui fait office de DNS.",
        "En entreprise : vérifier le serveur DNS interne et ses redirecteurs.",
        "En contournement, configurer temporairement un DNS public (1.1.1.1, 9.9.9.9), en sachant que les noms internes ne seront plus résolus.",
      ],
    },
    "fin-dns-bloque": {
      titre: "Le DNS est bloqué",
      diagnostic: "Aucun serveur DNS ne répond alors qu'Internet est joignable par IP : le port 53 est probablement filtré.",
      actions: [
        "Vérifier le pare-feu local, celui de la box ou de l'entreprise.",
        "Vérifier si un logiciel (contrôle parental, sécurité) intercepte le DNS.",
        "Sur un réseau invité ou un portail captif, ouvrir un navigateur pour valider la page d'accueil.",
      ],
    },
    "fin-nom-introuvable": {
      titre: "Le nom n'existe pas pour ce DNS",
      diagnostic: "Le serveur DNS répond que le nom n'existe pas.",
      actions: [
        "Vérifier l'orthographe du nom.",
        "Pour un nom interne : vérifier que la machine utilise bien le DNS de l'entreprise (VPN connecté, bon réseau).",
        "Essayer le nom complet (FQDN), par exemple serveur.domaine.local au lieu de serveur.",
        "Vérifier l'enregistrement dans la zone DNS.",
      ],
    },
    "fin-dns-obsolete": {
      titre: "Le DNS renvoie une ancienne adresse",
      diagnostic: "La résolution renvoie une adresse IP qui n'est plus la bonne.",
      actions: [
        "Vérifier le fichier hosts : une ligne y force peut-être l'ancienne adresse.",
        "Vider le cache DNS de la machine (et redémarrer le navigateur).",
        "Si le changement DNS est récent, attendre l'expiration du TTL ou vider le cache du serveur DNS.",
      ],
    },

    // Services et applications
    "fin-navigateur": {
      titre: "Le réseau fonctionne, le problème est dans l'application",
      diagnostic: "Toutes les couches réseau répondent en ligne de commande : le problème vient du navigateur ou de l'application.",
      actions: [
        "Essayer un autre navigateur ou une fenêtre de navigation privée.",
        "Vider le cache et les cookies, désactiver les extensions.",
        "Vérifier les réglages proxy et DNS propres à l'application (DNS sécurisé du navigateur, proxy de l'application).",
        "Vérifier qu'un antivirus ou un filtrage web ne bloque pas l'application.",
      ],
    },
    "fin-proxy": {
      titre: "Le proxy bloque ou ne répond pas",
      diagnostic: "Un proxy est configuré et la connexion échoue : le proxy est injoignable, demande une authentification ou refuse la destination.",
      actions: [
        "Tester l'accès en désactivant le proxy, si la politique le permet.",
        "Vérifier que le proxy est joignable (test du port du proxy).",
        "Vérifier l'URL du fichier PAC et son contenu.",
        "Supprimer une configuration proxy restée d'un autre réseau.",
      ],
    },
    "fin-filtrage": {
      titre: "Le trafic web est filtré",
      diagnostic: "L'IP et le DNS fonctionnent mais les connexions web n'aboutissent pas, sans proxy : un pare-feu filtre les ports 80 et 443.",
      actions: [
        "Vérifier le pare-feu local et les logiciels de sécurité.",
        "Vérifier le pare-feu de la box ou de l'entreprise.",
        "Sur un Wi-Fi public, chercher un portail captif à valider.",
      ],
    },
    "fin-horloge": {
      titre: "L'horloge de la machine est fausse",
      diagnostic: "Une date ou une heure incorrecte fait rejeter les certificats valides.",
      actions: [
        "Corriger la date, l'heure et le fuseau horaire.",
        "Activer la synchronisation automatique (Windows : w32tm /resync, Linux : timedatectl set-ntp true).",
        "Si l'heure dérive à chaque démarrage, remplacer la pile de la carte mère.",
      ],
    },
    "fin-certificat-serveur": {
      titre: "Certificat du serveur invalide",
      diagnostic: "Le certificat présenté par le serveur est expiré ou ne correspond pas au nom demandé : le problème est côté serveur.",
      actions: [
        "Prévenir l'administrateur du site ou du serveur.",
        "Vérifier qu'on utilise bien le nom prévu par le certificat (pas l'IP ou un alias).",
      ],
    },
    "fin-inspection-tls": {
      titre: "Le HTTPS est intercepté",
      diagnostic: "Un proxy d'entreprise ou un antivirus inspecte le HTTPS avec son propre certificat, que l'application ne reconnaît pas.",
      actions: [
        "Installer le certificat racine de l'entreprise ou de l'antivirus dans le magasin de certificats de la machine.",
        "Certaines applications ont leur propre magasin (Firefox, Java, Python, Git) : y ajouter le certificat aussi.",
        "Ou demander une exception d'inspection pour le site concerné.",
      ],
    },
    "fin-service-arrete": {
      titre: "Le service n'écoute pas",
      diagnostic: "Le serveur répond mais refuse la connexion sur ce port : le service est arrêté ou écoute sur un autre port ou une autre adresse.",
      actions: [
        "Sur le serveur, vérifier que le service est démarré.",
        "Lister les ports en écoute pour confirmer le port et l'adresse (0.0.0.0 et pas seulement 127.0.0.1).",
        "Vérifier le numéro de port utilisé côté client.",
      ],
    },
    "fin-port-filtre": {
      titre: "Le port est filtré",
      diagnostic: "Le serveur est joignable mais le port ne répond pas : un pare-feu bloque silencieusement la connexion.",
      actions: [
        "Vérifier le pare-feu du serveur (règle entrante pour ce port).",
        "Vérifier les pare-feux intermédiaires (entreprise, hébergeur, groupe de sécurité cloud).",
        "Tester depuis une autre machine ou un autre réseau pour localiser le filtrage.",
      ],
    },
    "fin-serveur-injoignable": {
      titre: "Le serveur est injoignable",
      diagnostic: "Le chemin vers le serveur s'arrête avant de l'atteindre.",
      actions: [
        "Noter le dernier saut qui répond : le problème est juste après.",
        "Vérifier que le serveur est allumé et connecté.",
        "Pour une ressource interne : vérifier que le VPN est connecté et que la route vers ce réseau existe.",
      ],
    },
    "fin-droits": {
      titre: "Accès refusé par l'application",
      diagnostic: "La connexion réseau fonctionne : le serveur refuse l'accès (authentification ou droits).",
      actions: [
        "Vérifier l'identifiant, le mot de passe et que le compte n'est pas verrouillé.",
        "Vérifier les droits du compte sur la ressource.",
        "Un filtrage par adresse IP source côté serveur peut aussi produire un 403.",
      ],
    },
    "fin-erreur-serveur": {
      titre: "Erreur côté serveur",
      diagnostic: "Le serveur répond mais renvoie une erreur 5xx : le problème est dans l'application ou ses dépendances, pas dans le réseau.",
      actions: [
        "Consulter les journaux de l'application sur le serveur.",
        "502 ou 504 : le reverse proxy n'arrive pas à joindre l'application derrière lui.",
        "503 : service surchargé ou en maintenance.",
      ],
    },

    // Performances
    "fin-cable": {
      titre: "Lien Ethernet dégradé",
      diagnostic: "Le lien est négocié à une vitesse basse ou en half-duplex : câble, prise ou port défaillant.",
      actions: [
        "Remplacer le câble par un câble catégorie 5e ou mieux.",
        "Essayer une autre prise ou un autre port du switch.",
        "Vérifier que la carte et le switch sont tous deux en négociation automatique.",
      ],
    },
    "fin-reseau-sature": {
      titre: "Réseau ou connexion saturés",
      diagnostic: "Le lien est correct mais la bande passante est consommée ou insuffisante.",
      actions: [
        "Chercher les processus ou appareils qui consomment (sauvegardes, mises à jour, streaming).",
        "Comparer le débit mesuré à l'offre souscrite, en filaire, sans autre utilisateur.",
        "Si la latence explose pendant les transferts, activer la gestion de file d'attente (SQM, QoS) sur la box ou le routeur.",
      ],
    },
    "fin-destination-lente": {
      titre: "Lenteur propre à une destination",
      diagnostic: "Le réseau local et l'accès Internet sont sains : la lenteur vient du serveur distant ou du chemin vers lui.",
      actions: [
        "Comparer avec d'autres sites ou un autre réseau (partage de connexion du téléphone).",
        "Vérifier si le service signale des incidents.",
        "Si c'est un serveur interne, vérifier sa charge.",
      ],
    },
    "fin-mtu": {
      titre: "Problème de MTU",
      diagnostic: "Les gros paquets ne passent pas : la MTU du chemin est inférieure à 1500 et la découverte automatique ne fonctionne pas (ICMP bloqué).",
      actions: [
        "Calculer la MTU réelle : plus grande taille qui passe + 28.",
        "Régler la MTU de la carte, du VPN ou de la box à cette valeur (souvent 1492 en PPPoE, moins en VPN).",
        "Windows : netsh interface ipv4 set subinterface \"<interface>\" mtu=<valeur> store=persistent",
        "Linux : sudo ip link set dev <interface> mtu <valeur>, macOS : sudo ifconfig <interface> mtu <valeur>",
        "Sur un routeur, activer le « MSS clamping ».",
      ],
    },

    // Wi-Fi
    "fin-wifi-invisible": {
      titre: "Le réseau Wi-Fi n'est pas visible",
      diagnostic: "La machine ne voit pas le réseau attendu.",
      actions: [
        "Vérifier que le Wi-Fi de la machine est activé (touche, mode avion).",
        "Vérifier que la borne émet (d'autres appareils le voient-ils ?).",
        "Le réseau est peut-être en 5 GHz seulement et la carte ne gère que le 2,4 GHz, ou sur un canal non autorisé dans le pays configuré.",
        "Un SSID masqué doit être ajouté à la main.",
      ],
    },
    "fin-wifi-auth": {
      titre: "Échec d'authentification Wi-Fi",
      diagnostic: "Le réseau refuse la connexion : mot de passe, sécurité ou compte.",
      actions: [
        "Oublier le réseau puis s'y reconnecter avec le bon mot de passe.",
        "Vérifier la compatibilité du mode de sécurité (WPA3 seul refusé par les vieilles cartes).",
        "En entreprise (802.1X) : vérifier le compte, le certificat et l'heure de la machine.",
      ],
    },
    "fin-wifi-signal": {
      titre: "Signal Wi-Fi trop faible",
      diagnostic: "La machine est trop loin de la borne ou le signal est atténué (murs, sols).",
      actions: [
        "Se rapprocher de la borne pour confirmer.",
        "Préférer le 5 GHz à courte distance, le 2,4 GHz porte plus loin mais est plus encombré.",
        "Ajouter un point d'accès, un répéteur ou un système mesh, ou passer en filaire.",
        "Mettre à jour le pilote de la carte Wi-Fi.",
      ],
    },
    "fin-wifi-interferences": {
      titre: "Interférences Wi-Fi",
      diagnostic: "Le signal est bon mais le canal est encombré par d'autres réseaux.",
      actions: [
        "Changer de canal sur la borne (1, 6 ou 11 en 2,4 GHz) en choisissant le moins occupé.",
        "Passer en 5 GHz si possible.",
        "Éloigner la borne des sources de perturbation (micro-ondes, téléphones DECT, enceintes Bluetooth).",
      ],
    },
  },
};
