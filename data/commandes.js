// Catalogue des commandes de diagnostic.
//
// Chaque commande a un identifiant (la clé), un titre, une catégorie, une
// variante par système d'exploitation (windows, macos, linux) et une aide à la
// lecture du résultat. Les valeurs à remplacer sont notées entre chevrons :
// <cible>, <passerelle>, <interface>, <port>, <serveur-dns>.
//
// Une variante vaut null quand la commande n'a pas d'équivalent sur cet OS.
// Le fichier est un simple script (pas de module) pour que l'app marche aussi
// en ouvrant index.html directement depuis le disque.

window.WEBDEBUG = window.WEBDEBUG || {};

WEBDEBUG.categories = {
  interface: "Carte réseau et lien",
  ip: "Adressage IP et DHCP",
  routage: "Passerelle et routage",
  connectivite: "Connectivité",
  dns: "DNS",
  service: "Ports et services",
  wifi: "Wi-Fi",
  performance: "Performances et MTU",
};

WEBDEBUG.commandes = {
  // --- Carte réseau et lien -------------------------------------------------
  "etat-interfaces": {
    titre: "Voir l'état des cartes réseau",
    categorie: "interface",
    os: {
      windows: { cmd: "Get-NetAdapter | Format-Table Name, Status, LinkSpeed, MacAddress", note: "PowerShell. En cmd : netsh interface show interface" },
      macos: { cmd: "networksetup -listallhardwareports && ifconfig | grep -E '^[a-z]|status'", note: "« status: active » = câble branché ou Wi-Fi associé" },
      linux: { cmd: "ip -br link", note: "UP / DOWN, et LOWER_UP = lien physique présent" },
    },
    lecture: "Cherche la carte utilisée (Ethernet ou Wi-Fi). Si elle est « Disconnected », « inactive » ou sans LOWER_UP, il n'y a pas de lien physique : câble, port du switch, Wi-Fi non associé ou carte désactivée.",
  },
  "vitesse-lien": {
    titre: "Voir la vitesse et le duplex du lien Ethernet",
    categorie: "interface",
    os: {
      windows: { cmd: "Get-NetAdapter | Format-Table Name, LinkSpeed, FullDuplex", note: "PowerShell" },
      macos: { cmd: "ifconfig <interface> | grep media", note: "Ex. interface : en0" },
      linux: { cmd: "ethtool <interface> | grep -E 'Speed|Duplex|Link detected'", note: "Peut demander sudo. Ex. interface : eth0, enp3s0" },
    },
    lecture: "Un lien à 10 ou 100 Mb/s au lieu de 1 Gb/s, ou en half-duplex, indique souvent un câble abîmé, un mauvais brassage ou un problème de négociation avec le switch.",
  },

  // --- Adressage IP et DHCP -------------------------------------------------
  "config-ip": {
    titre: "Afficher la configuration IP complète",
    categorie: "ip",
    os: {
      windows: { cmd: "ipconfig /all" },
      macos: { cmd: "ifconfig <interface> && ipconfig getpacket <interface>", note: "getpacket montre le bail DHCP (serveur, passerelle, DNS). Ex. interface : en0" },
      linux: { cmd: "ip -br addr && ip route && resolvectl status", note: "Sans systemd-resolved : cat /etc/resolv.conf" },
    },
    lecture: "Vérifie l'adresse IPv4, le masque, la passerelle par défaut et les serveurs DNS. Une adresse en 169.254.x.x signifie que le DHCP n'a pas répondu (adresse automatique APIPA). Aucune passerelle = pas de sortie possible hors du réseau local.",
  },
  "renouveler-dhcp": {
    titre: "Renouveler le bail DHCP",
    categorie: "ip",
    os: {
      windows: { cmd: "ipconfig /release && ipconfig /renew", note: "Coupe la connexion quelques secondes" },
      macos: { cmd: "sudo ipconfig set <interface> DHCP", note: "Ex. interface : en0" },
      linux: { cmd: "sudo nmcli connection down <connexion> && sudo nmcli connection up <connexion>", note: "Sans NetworkManager : sudo dhclient -r <interface> && sudo dhclient <interface>" },
    },
    lecture: "Après renouvellement, relance l'affichage de la configuration IP. Si l'adresse reste en 169.254.x.x, aucun serveur DHCP ne répond sur ce réseau (box, serveur ou relais DHCP en panne, mauvais VLAN, port isolé).",
  },
  "table-arp": {
    titre: "Voir la table ARP (voisins sur le réseau local)",
    categorie: "ip",
    os: {
      windows: { cmd: "arp -a" },
      macos: { cmd: "arp -a" },
      linux: { cmd: "ip neigh" },
    },
    lecture: "La passerelle doit apparaître avec une adresse MAC. Une entrée « incomplete » ou FAILED pour la passerelle signifie qu'elle ne répond pas au niveau 2 (câblage, VLAN, équipement éteint). Deux IP avec la même MAC inattendue peuvent signaler un conflit ou une usurpation ARP.",
  },
  "conflit-ip": {
    titre: "Détecter un conflit d'adresse IP",
    categorie: "ip",
    os: {
      windows: { cmd: "Get-WinEvent -FilterHashtable @{LogName='System'; Id=4199} -MaxEvents 5", note: "PowerShell. L'événement 4199 signale un conflit d'adresse" },
      macos: { cmd: "log show --last 1h --predicate 'eventMessage CONTAINS \"conflict\"' | tail", note: "macOS affiche aussi une alerte « adresse IP utilisée par un autre appareil »" },
      linux: { cmd: "sudo arping -D -I <interface> -c 3 <mon-ip>", note: "Code retour 1 et une réponse reçue = l'adresse est déjà prise" },
    },
    lecture: "Un conflit provoque des coupures aléatoires. Corrige en changeant l'IP fixe en cause ou en l'excluant de la plage DHCP.",
  },

  // --- Passerelle et routage ------------------------------------------------
  "voir-routes": {
    titre: "Afficher la table de routage",
    categorie: "routage",
    os: {
      windows: { cmd: "route print -4" },
      macos: { cmd: "netstat -rn -f inet", note: "Pour la route par défaut seule : route -n get default" },
      linux: { cmd: "ip route" },
    },
    lecture: "Il faut une route par défaut (0.0.0.0 ou « default ») vers la passerelle. Plusieurs routes par défaut (VPN, deux cartes actives) peuvent envoyer le trafic au mauvais endroit : la métrique la plus basse gagne.",
  },
  "ping-passerelle": {
    titre: "Pinger la passerelle",
    categorie: "routage",
    os: {
      windows: { cmd: "ping -n 4 <passerelle>" },
      macos: { cmd: "ping -c 4 <passerelle>" },
      linux: { cmd: "ping -c 4 <passerelle>" },
    },
    lecture: "Des réponses avec 0 % de perte et quelques ms = le réseau local fonctionne. « Délai d'attente dépassé » ou « Destination host unreachable » = problème entre la machine et la box ou le routeur. Attention, certains équipements ignorent le ping : vérifie alors la table ARP.",
  },

  // --- Connectivité ---------------------------------------------------------
  "ping-ip-publique": {
    titre: "Pinger une IP publique (sans DNS)",
    categorie: "connectivite",
    os: {
      windows: { cmd: "ping -n 4 1.1.1.1" },
      macos: { cmd: "ping -c 4 1.1.1.1" },
      linux: { cmd: "ping -c 4 1.1.1.1" },
    },
    lecture: "Si 1.1.1.1 répond (ou 8.8.8.8), l'accès Internet fonctionne au niveau IP : le problème est plus haut (DNS, proxy, pare-feu applicatif). S'il ne répond pas alors que la passerelle répond, le blocage est sur la box, le routeur ou chez le fournisseur.",
  },
  "ping-cible": {
    titre: "Pinger une machine précise",
    categorie: "connectivite",
    os: {
      windows: { cmd: "ping -n 4 <cible>" },
      macos: { cmd: "ping -c 4 <cible>" },
      linux: { cmd: "ping -c 4 <cible>" },
    },
    lecture: "Note l'adresse IP résolue affichée sur la première ligne : elle confirme ce que le DNS renvoie. Une absence de réponse ne prouve pas que la cible est éteinte, beaucoup de serveurs et pare-feu bloquent le ping : teste alors le port du service.",
  },
  "traceroute": {
    titre: "Suivre le chemin jusqu'à une destination",
    categorie: "connectivite",
    os: {
      windows: { cmd: "tracert -d <cible>", note: "-d évite la résolution DNS de chaque saut (plus rapide)" },
      macos: { cmd: "traceroute -n <cible>" },
      linux: { cmd: "tracepath -n <cible>", note: "Ou traceroute -n <cible> s'il est installé" },
    },
    lecture: "Chaque ligne est un routeur traversé. Repère le dernier saut qui répond : le problème se situe juste après. Des étoiles isolées au milieu sont normales (routeurs qui ne répondent pas), seules les étoiles jusqu'à la fin comptent. Le 1er saut doit être ta passerelle.",
  },
  "pathping": {
    titre: "Mesurer la perte saut par saut",
    categorie: "connectivite",
    os: {
      windows: { cmd: "pathping -n <cible>", note: "Dure plusieurs minutes" },
      macos: { cmd: "mtr -rwn -c 100 <cible>", note: "mtr s'installe avec Homebrew : brew install mtr" },
      linux: { cmd: "mtr -rwn -c 100 <cible>", note: "Paquet mtr ou mtr-tiny" },
    },
    lecture: "Regarde la colonne de perte. Une perte qui apparaît à un saut et se poursuit jusqu'à la destination désigne le segment fautif. Une perte sur un seul saut intermédiaire, mais pas après, est en général sans importance (le routeur limite ses réponses).",
  },

  // --- DNS ------------------------------------------------------------------
  "resolution-dns": {
    titre: "Résoudre un nom avec le DNS configuré",
    categorie: "dns",
    os: {
      windows: { cmd: "Resolve-DnsName <cible>", note: "PowerShell. En cmd : nslookup <cible>" },
      macos: { cmd: "dscacheutil -q host -a name <cible>", note: "Passe par le résolveur du système, comme les applications" },
      linux: { cmd: "resolvectl query <cible>", note: "Sans systemd-resolved : getent hosts <cible>" },
    },
    lecture: "Une adresse IP en retour = la résolution fonctionne. « Non-existent domain » / NXDOMAIN = le nom n'existe pas (faute de frappe, domaine interne inconnu de ce DNS). Un délai dépassé = le serveur DNS ne répond pas.",
  },
  "resolution-dns-externe": {
    titre: "Résoudre un nom avec un DNS public",
    categorie: "dns",
    os: {
      windows: { cmd: "nslookup <cible> 1.1.1.1" },
      macos: { cmd: "dig @1.1.1.1 <cible> +short" },
      linux: { cmd: "dig @1.1.1.1 <cible> +short", note: "Si dig manque : nslookup <cible> 1.1.1.1" },
    },
    lecture: "Si le DNS public répond mais pas celui configuré, le problème vient du serveur DNS de la machine (box, serveur interne, DNS du VPN). Si aucun ne répond, le port 53 est probablement bloqué par un pare-feu.",
  },
  "voir-dns": {
    titre: "Voir les serveurs DNS utilisés",
    categorie: "dns",
    os: {
      windows: { cmd: "Get-DnsClientServerAddress -AddressFamily IPv4", note: "PowerShell" },
      macos: { cmd: "scutil --dns | grep nameserver | sort -u" },
      linux: { cmd: "resolvectl dns", note: "Sinon : cat /etc/resolv.conf" },
    },
    lecture: "Vérifie que les serveurs listés sont joignables et attendus. Un DNS d'un ancien VPN ou une adresse saisie à la main est une cause fréquente de pannes « Internet marche mais pas les noms ».",
  },
  "vider-cache-dns": {
    titre: "Vider le cache DNS",
    categorie: "dns",
    os: {
      windows: { cmd: "ipconfig /flushdns" },
      macos: { cmd: "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder" },
      linux: { cmd: "sudo resolvectl flush-caches", note: "Uniquement avec systemd-resolved" },
    },
    lecture: "Utile après un changement d'enregistrement DNS ou quand une ancienne IP reste en mémoire. Pense aussi au cache du navigateur et au fichier hosts.",
  },
  "fichier-hosts": {
    titre: "Vérifier le fichier hosts",
    categorie: "dns",
    os: {
      windows: { cmd: "Get-Content C:\\Windows\\System32\\drivers\\etc\\hosts | Select-String -NotMatch '^#'", note: "PowerShell" },
      macos: { cmd: "grep -v '^#' /etc/hosts" },
      linux: { cmd: "grep -v '^#' /etc/hosts" },
    },
    lecture: "Une ligne qui associe le nom recherché à une IP prend le pas sur le DNS. Elle peut être un reste de test ou l'œuvre d'un logiciel malveillant.",
  },

  // --- Ports et services ----------------------------------------------------
  "test-port": {
    titre: "Tester l'ouverture d'un port TCP",
    categorie: "service",
    os: {
      windows: { cmd: "Test-NetConnection <cible> -Port <port>", note: "PowerShell. TcpTestSucceeded : True = port joignable" },
      macos: { cmd: "nc -vz -G 5 <cible> <port>" },
      linux: { cmd: "nc -vz -w 5 <cible> <port>", note: "Sans nc : timeout 5 bash -c '</dev/tcp/<cible>/<port>' && echo ouvert" },
    },
    lecture: "« succeeded » / True = le service écoute et rien ne bloque. « Connection refused » = la machine répond mais aucun service n'écoute sur ce port. Délai dépassé = un pare-feu filtre ou la machine est injoignable.",
  },
  "requete-http": {
    titre: "Tester une URL (HTTP/HTTPS)",
    categorie: "service",
    os: {
      windows: { cmd: "curl.exe -sSI https://<cible>", note: "Mettre curl.exe et pas curl, qui est un alias PowerShell" },
      macos: { cmd: "curl -sSI https://<cible>" },
      linux: { cmd: "curl -sSI https://<cible>" },
    },
    lecture: "Le code de la première ligne indique la réponse : 200 OK, 301/302 redirection, 401/403 accès refusé, 404 introuvable, 5xx erreur du serveur. Une erreur de certificat ou « Could not resolve host » oriente vers TLS ou DNS.",
  },
  "verifier-certificat": {
    titre: "Vérifier le certificat TLS d'un site",
    categorie: "service",
    os: {
      windows: { cmd: "curl.exe -vI https://<cible> 2>&1 | Select-String -Pattern 'expire|subject|issuer|SSL'", note: "PowerShell" },
      macos: { cmd: "echo | openssl s_client -connect <cible>:443 -servername <cible> 2>/dev/null | openssl x509 -noout -subject -issuer -dates" },
      linux: { cmd: "echo | openssl s_client -connect <cible>:443 -servername <cible> 2>/dev/null | openssl x509 -noout -subject -issuer -dates" },
    },
    lecture: "Vérifie que le nom correspond, que la date de fin (notAfter) n'est pas dépassée et que l'émetteur est attendu. Un émetteur inconnu sur un réseau d'entreprise vient souvent d'un proxy qui inspecte le HTTPS. Vérifie aussi l'heure de la machine : une horloge fausse invalide tous les certificats.",
  },
  "ports-ecoute": {
    titre: "Lister les ports en écoute sur la machine",
    categorie: "service",
    os: {
      windows: { cmd: "Get-NetTCPConnection -State Listen | Sort-Object LocalPort | Format-Table LocalAddress, LocalPort, OwningProcess", note: "PowerShell. En cmd : netstat -ano | findstr LISTENING" },
      macos: { cmd: "sudo lsof -nP -iTCP -sTCP:LISTEN" },
      linux: { cmd: "sudo ss -tulpn" },
    },
    lecture: "Sur le serveur : le service doit écouter sur le bon port. S'il écoute sur 127.0.0.1 seulement, il n'est joignable que depuis la machine elle-même, il faut 0.0.0.0 ou l'IP de la carte.",
  },
  "pare-feu": {
    titre: "Voir l'état du pare-feu local",
    categorie: "service",
    os: {
      windows: { cmd: "Get-NetFirewallProfile | Format-Table Name, Enabled, DefaultInboundAction", note: "PowerShell. Règles : Get-NetFirewallRule -Enabled True -Direction Inbound" },
      macos: { cmd: "/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate && sudo pfctl -s rules" },
      linux: { cmd: "sudo nft list ruleset", note: "Selon la distribution : sudo ufw status verbose, sudo firewall-cmd --list-all ou sudo iptables -L -n -v" },
    },
    lecture: "Cherche une règle qui bloque le port ou l'application concernés. Pour confirmer, désactiver le pare-feu quelques instants est un test rapide, à condition de le réactiver aussitôt.",
  },
  "proxy": {
    titre: "Voir la configuration proxy",
    categorie: "service",
    os: {
      windows: { cmd: "netsh winhttp show proxy; Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable, ProxyServer, AutoConfigURL", note: "PowerShell" },
      macos: { cmd: "scutil --proxy" },
      linux: { cmd: "env | grep -i _proxy", note: "GNOME : gsettings get org.gnome.system.proxy mode" },
    },
    lecture: "Un proxy configuré mais injoignable bloque la navigation alors que le ping fonctionne. Un fichier PAC (AutoConfigURL) peut aussi envoyer certains sites vers un proxy.",
  },

  // --- Wi-Fi ----------------------------------------------------------------
  "etat-wifi": {
    titre: "Voir la connexion Wi-Fi (signal, canal, débit)",
    categorie: "wifi",
    os: {
      windows: { cmd: "netsh wlan show interfaces" },
      macos: { cmd: "sudo wdutil info", note: "Section WIFI : RSSI, Noise, Channel, Tx Rate" },
      linux: { cmd: "nmcli -f IN-USE,SSID,CHAN,RATE,SIGNAL,SECURITY dev wifi", note: "Détail : iw dev <interface> link" },
    },
    lecture: "Signal : au-dessus de 70 % ou de -65 dBm c'est bon, en dessous de 40 % ou -75 dBm c'est faible et provoque lenteurs et coupures. Un débit (Tx Rate) bas confirme un mauvais lien radio. Vérifie aussi qu'on est sur le bon SSID et la bonne bande (2,4 ou 5 GHz).",
  },
  "reseaux-wifi": {
    titre: "Lister les réseaux Wi-Fi visibles",
    categorie: "wifi",
    os: {
      windows: { cmd: "netsh wlan show networks mode=bssid" },
      macos: { cmd: "system_profiler SPAirPortDataType", note: "Section « Other Local Wi-Fi Networks »" },
      linux: { cmd: "nmcli dev wifi list" },
    },
    lecture: "Repère les réseaux voisins sur le même canal : beaucoup de réseaux forts sur le même canal = interférences. Sur 2,4 GHz, seuls les canaux 1, 6 et 11 ne se chevauchent pas.",
  },
  "rapport-wifi": {
    titre: "Générer un rapport Wi-Fi détaillé",
    categorie: "wifi",
    os: {
      windows: { cmd: "netsh wlan show wlanreport", note: "Ouvre ensuite le fichier HTML indiqué. Demande un terminal administrateur" },
      macos: { cmd: "sudo wdutil diagnose", note: "Crée une archive de diagnostic dans /var/tmp" },
      linux: { cmd: "journalctl -u NetworkManager --since '1 hour ago' | grep -iE 'wifi|wlan|deauth|disconnect'" },
    },
    lecture: "Cherche les déconnexions et leur motif (déauthentification, échec d'authentification, perte de signal) et leur fréquence.",
  },

  // --- Performances et MTU --------------------------------------------------
  "ping-long": {
    titre: "Ping continu pour mesurer pertes et gigue",
    categorie: "performance",
    os: {
      windows: { cmd: "ping -n 100 <cible>" },
      macos: { cmd: "ping -c 100 <cible>" },
      linux: { cmd: "ping -c 100 -i 0.2 <cible>" },
    },
    lecture: "Regarde le résumé : plus de 1 % de perte est anormal sur un réseau filaire. Un écart important entre le temps minimum et maximum (gigue) gêne la voix et la vidéo. Compare passerelle et Internet pour savoir si le problème est local ou externe.",
  },
  "test-mtu": {
    titre: "Tester la taille maximale des paquets (MTU)",
    categorie: "performance",
    os: {
      windows: { cmd: "ping -n 2 -f -l 1472 <cible>", note: "-f interdit la fragmentation. Baisse -l jusqu'à ce que ça passe" },
      macos: { cmd: "ping -c 2 -D -s 1472 <cible>" },
      linux: { cmd: "ping -c 2 -M do -s 1472 <cible>" },
    },
    lecture: "1472 octets + 28 d'en-têtes = 1500, la MTU standard. Si ça échoue (« Packet needs to be fragmented », « Message too long »), baisse la taille jusqu'à ce que ça passe et ajoute 28 : c'est la MTU réelle du chemin. Une MTU réduite (PPPoE, VPN, tunnel) explique des sites qui chargent à moitié ou des connexions qui se figent.",
  },
  "debit": {
    titre: "Mesurer le débit",
    categorie: "performance",
    os: {
      windows: { cmd: "iperf3 -c <serveur-iperf>", note: "iperf3 à installer, et un serveur (iperf3 -s) de l'autre côté. Sinon, un test en ligne type speedtest" },
      macos: { cmd: "networkQuality -v", note: "Outil intégré à macOS 12 et plus" },
      linux: { cmd: "iperf3 -c <serveur-iperf>", note: "Un serveur iperf3 -s est nécessaire de l'autre côté" },
    },
    lecture: "Compare au débit attendu (offre Internet, vitesse du lien). Teste en filaire puis en Wi-Fi pour isoler la partie radio. Une latence qui explose pendant le test (« responsiveness » bas sous macOS) indique un engorgement (bufferbloat).",
  },
  "connexions-actives": {
    titre: "Voir les connexions réseau actives",
    categorie: "performance",
    os: {
      windows: { cmd: "Get-NetTCPConnection -State Established | Group-Object OwningProcess | Sort-Object Count -Descending | Select-Object -First 10", note: "PowerShell. Nom du processus : Get-Process -Id <pid>" },
      macos: { cmd: "nettop -P -L 1" },
      linux: { cmd: "ss -tnp state established", note: "Débit par processus : sudo nethogs" },
    },
    lecture: "Un processus avec beaucoup de connexions ou un gros volume (sauvegarde, mise à jour, synchronisation cloud) peut saturer la ligne.",
  },
};
