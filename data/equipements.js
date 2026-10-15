// Commandes de base par équipement réseau (routeurs, commutateurs, pare-feu).
// Chaque équipement : nom, intro (accès, pagination), groupes de commandes.
// Commande : { titre, cmd, note? }. Valeurs à remplacer entre chevrons, comme
// dans le catalogue : <ip>, <interface>, <ip-src>, <port>, <mac>, <zone-src>…
// Une commande sur plusieurs lignes se tape ligne par ligne.

window.WEBDEBUG = window.WEBDEBUG || {};

WEBDEBUG.libellesEquipements = {
  ip: "IP cible",
  "ip-src": "IP source",
  interface: "Interface",
  port: "Port de destination",
  mac: "Adresse MAC",
  vlan: "VLAN",
  "zone-src": "Zone source",
  "zone-dst": "Zone destination",
  vrf: "VRF / routeur virtuel",
};

WEBDEBUG.equipements = {
  cisco: {
    nom: "Cisco IOS / IOS-XE",
    intro: "Routeurs et commutateurs Catalyst. Les commandes show se tapent en mode privilégié (enable). Les abréviations marchent : sh ip int br.",
    groupes: [
      {
        titre: "Session",
        commandes: [
          { titre: "Désactiver la pagination (--More--)", cmd: "terminal length 0" },
          { titre: "Version, uptime et modèle", cmd: "show version" },
          { titre: "Matériel et numéros de série", cmd: "show inventory" },
          { titre: "Heure de l'équipement (utile pour lire les logs)", cmd: "show clock" },
        ],
      },
      {
        titre: "Interfaces",
        commandes: [
          { titre: "Résumé des interfaces : IP et état", cmd: "show ip interface brief", note: "Status = lien, Protocol = protocole. administratively down = shutdown dans la config." },
          { titre: "État des ports d'un commutateur (VLAN, vitesse, duplex)", cmd: "show interfaces status", note: "err-disabled : port coupé par une protection (port-security, BPDU guard…)." },
          { titre: "Détail d'une interface (erreurs, débit)", cmd: "show interfaces <interface>", note: "Regarder input errors, CRC, collisions et le taux de charge. Ex. d'interface : Gi1/0/1." },
          { titre: "Compteurs d'erreurs de tous les ports", cmd: "show interfaces counters errors" },
          { titre: "Raison d'un port err-disabled", cmd: "show interfaces status err-disabled" },
          { titre: "Alimentation PoE des ports", cmd: "show power inline" },
          { titre: "Niveau optique des SFP", cmd: "show interfaces transceiver" },
        ],
      },
      {
        titre: "Commutation et VLAN",
        commandes: [
          { titre: "Liste des VLAN et leurs ports", cmd: "show vlan brief" },
          { titre: "Liens trunk et VLAN autorisés", cmd: "show interfaces trunk" },
          { titre: "Table MAC complète", cmd: "show mac address-table" },
          { titre: "Sur quel port est une adresse MAC", cmd: "show mac address-table address <mac>", note: "Format Cisco : aaaa.bbbb.cccc." },
          { titre: "Spanning tree : résumé et racine", cmd: "show spanning-tree summary" },
          { titre: "Voisins Cisco (CDP)", cmd: "show cdp neighbors detail" },
          { titre: "Voisins LLDP (autres marques)", cmd: "show lldp neighbors detail" },
          { titre: "Agrégats de liens (EtherChannel)", cmd: "show etherchannel summary" },
        ],
      },
      {
        titre: "IP et routage",
        commandes: [
          { titre: "Table de routage", cmd: "show ip route" },
          { titre: "Route utilisée pour une destination", cmd: "show ip route <ip>" },
          { titre: "Table ARP", cmd: "show ip arp" },
          { titre: "Voisins OSPF", cmd: "show ip ospf neighbor" },
          { titre: "Sessions BGP", cmd: "show ip bgp summary" },
          { titre: "Baux DHCP distribués par l'équipement", cmd: "show ip dhcp binding" },
          { titre: "Traductions NAT en cours", cmd: "show ip nat translations" },
        ],
      },
      {
        titre: "Tests",
        commandes: [
          { titre: "Ping depuis une interface précise", cmd: "ping <ip> source <interface>" },
          { titre: "Traceroute", cmd: "traceroute <ip>" },
        ],
      },
      {
        titre: "Logs, sécurité et charge",
        commandes: [
          { titre: "Journal de l'équipement", cmd: "show logging" },
          { titre: "Listes d'accès et compteurs de correspondances", cmd: "show access-lists" },
          { titre: "Port-security : ports et violations", cmd: "show port-security" },
          { titre: "Charge processeur", cmd: "show processes cpu sorted" },
          { titre: "Température, ventilateurs, alimentations", cmd: "show environment all", note: "Sur certains modèles : show env all." },
        ],
      },
      {
        titre: "Configuration",
        commandes: [
          { titre: "Configuration en cours", cmd: "show running-config" },
          { titre: "Configuration d'une seule interface", cmd: "show running-config interface <interface>" },
          { titre: "Enregistrer la configuration", cmd: "copy running-config startup-config", note: "Équivalent court : write memory. Sans ça, les changements sont perdus au redémarrage." },
          { titre: "Réactiver un port err-disabled", cmd: "configure terminal\ninterface <interface>\nshutdown\nno shutdown\nend", note: "Corriger la cause avant, sinon le port retombe." },
        ],
      },
    ],
  },

  paloalto: {
    nom: "Palo Alto (PAN-OS)",
    intro: "Pare-feu Palo Alto, CLI en SSH. Mode opérationnel par défaut (>), configure pour le mode configuration (#).",
    groupes: [
      {
        titre: "Session",
        commandes: [
          { titre: "Désactiver la pagination", cmd: "set cli pager off" },
          { titre: "Afficher la config en commandes set", cmd: "set cli config-output-format set" },
          { titre: "Version, modèle, uptime", cmd: "show system info" },
          { titre: "Charge CPU et mémoire", cmd: "show system resources" },
          { titre: "Espace disque", cmd: "show system disk-space" },
          { titre: "État de la haute disponibilité", cmd: "show high-availability state" },
        ],
      },
      {
        titre: "Interfaces et routage",
        commandes: [
          { titre: "Toutes les interfaces (zone, IP, état)", cmd: "show interface all" },
          { titre: "Détail et compteurs d'une interface", cmd: "show interface <interface>", note: "Ex. : ethernet1/1." },
          { titre: "Table de routage", cmd: "show routing route" },
          { titre: "Route choisie pour une destination", cmd: "test routing fib-lookup virtual-router <vrf> ip <ip>", note: "Le routeur virtuel s'appelle souvent default. Avec le moteur de routage avancé (PAN-OS 10.2+), la syntaxe diffère." },
          { titre: "Table ARP", cmd: "show arp all" },
        ],
      },
      {
        titre: "Politiques et NAT",
        commandes: [
          { titre: "Quelle règle de sécurité s'applique à un flux", cmd: "test security-policy-match from <zone-src> to <zone-dst> source <ip-src> destination <ip> protocol 6 destination-port <port>", note: "protocol 6 = TCP, 17 = UDP. Donne la règle qui autorise ou bloque." },
          { titre: "Quelle règle NAT s'applique à un flux", cmd: "test nat-policy-match from <zone-src> to <zone-dst> source <ip-src> destination <ip> protocol 6 destination-port <port>" },
        ],
      },
      {
        titre: "Sessions et logs",
        commandes: [
          { titre: "Sessions vers une destination", cmd: "show session all filter destination <ip>", note: "Puis show session id <numéro> pour le détail (règle, NAT, état)." },
          { titre: "Statistiques des sessions", cmd: "show session info" },
          { titre: "Logs de trafic vers une destination", cmd: "show log traffic direction equal backward dst in <ip>" },
          { titre: "Compteurs de paquets rejetés", cmd: "show counter global filter packet-filter yes delta yes", note: "Lancer deux fois : la deuxième montre ce qui a bougé entre-temps." },
        ],
      },
      {
        titre: "VPN",
        commandes: [
          { titre: "Phase 1 IPsec (IKE)", cmd: "show vpn ike-sa" },
          { titre: "Phase 2 IPsec", cmd: "show vpn ipsec-sa" },
          { titre: "Utilisateurs GlobalProtect connectés", cmd: "show global-protect-gateway current-user" },
        ],
      },
      {
        titre: "Tests",
        commandes: [
          { titre: "Ping depuis une IP du pare-feu", cmd: "ping source <ip-src> host <ip>" },
          { titre: "Traceroute depuis une IP du pare-feu", cmd: "traceroute source <ip-src> host <ip>" },
        ],
      },
      {
        titre: "Configuration",
        commandes: [
          { titre: "Configuration en cours", cmd: "show config running" },
          { titre: "Tâches en cours (commits, mises à jour)", cmd: "show jobs all" },
        ],
      },
    ],
  },

  fortigate: {
    nom: "Fortinet FortiGate (FortiOS)",
    intro: "CLI par SSH ou par la console du GUI. get = lecture, diagnose = dépannage, execute = action. Avec VDOM, entrer d'abord dans le bon : config vdom puis edit <nom>.",
    groupes: [
      {
        titre: "Session",
        commandes: [
          { titre: "Désactiver la pagination", cmd: "config system console\nset output standard\nend" },
          { titre: "Version, modèle, numéro de série", cmd: "get system status" },
          { titre: "Charge CPU, mémoire, sessions", cmd: "get system performance status" },
          { titre: "Processus les plus gourmands", cmd: "diagnose sys top", note: "q pour quitter." },
          { titre: "État du cluster HA", cmd: "get system ha status" },
        ],
      },
      {
        titre: "Interfaces et routage",
        commandes: [
          { titre: "Interfaces physiques et leur état", cmd: "get system interface physical" },
          { titre: "Détail d'une carte (vitesse, erreurs)", cmd: "diagnose hardware deviceinfo nic <interface>", note: "Ex. : port1, wan1." },
          { titre: "Table de routage", cmd: "get router info routing-table all" },
          { titre: "Route choisie pour une destination", cmd: "get router info routing-table details <ip>" },
          { titre: "Table ARP", cmd: "get system arp" },
          { titre: "Voisins OSPF", cmd: "get router info ospf neighbor" },
          { titre: "Sessions BGP", cmd: "get router info bgp summary" },
        ],
      },
      {
        titre: "Sessions et flux",
        commandes: [
          { titre: "Sessions vers une destination", cmd: "diagnose sys session filter clear\ndiagnose sys session filter dst <ip>\ndiagnose sys session list" },
          { titre: "Capture de paquets", cmd: "diagnose sniffer packet any 'host <ip>' 4 0 l", note: "Niveau 4 = avec le nom d'interface. Ctrl+C pour arrêter." },
          { titre: "Suivre le traitement d'un flux (debug flow)", cmd: "diagnose debug reset\ndiagnose debug flow filter addr <ip>\ndiagnose debug flow show function-name enable\ndiagnose debug flow trace start 20\ndiagnose debug enable", note: "Montre la route, la règle (policy id) et le NAT, ou la raison du rejet. Arrêter ensuite avec diagnose debug disable." },
          { titre: "Arrêter tous les debugs", cmd: "diagnose debug disable\ndiagnose debug reset" },
        ],
      },
      {
        titre: "VPN",
        commandes: [
          { titre: "Résumé des tunnels IPsec", cmd: "get vpn ipsec tunnel summary" },
          { titre: "Détail des tunnels (compteurs, phase 2)", cmd: "diagnose vpn tunnel list" },
          { titre: "Phase 1 (IKE)", cmd: "diagnose vpn ike gateway list" },
          { titre: "Utilisateurs VPN SSL connectés", cmd: "get vpn ssl monitor" },
        ],
      },
      {
        titre: "Tests",
        commandes: [
          { titre: "Ping depuis une IP du FortiGate", cmd: "execute ping-options source <ip-src>\nexecute ping <ip>" },
          { titre: "Traceroute", cmd: "execute traceroute <ip>" },
        ],
      },
      {
        titre: "Logs et configuration",
        commandes: [
          { titre: "Logs de trafic vers une destination", cmd: "execute log filter category 0\nexecute log filter field dstip <ip>\nexecute log display", note: "Catégorie 0 = trafic." },
          { titre: "Configuration complète", cmd: "show full-configuration" },
          { titre: "Configuration des règles de pare-feu", cmd: "show firewall policy" },
        ],
      },
    ],
  },

  juniper: {
    nom: "Juniper (Junos)",
    intro: "Routeurs, commutateurs EX et pare-feu SRX. Commandes en mode opérationnel (>). Ajouter | no-more pour éviter la pagination.",
    groupes: [
      {
        titre: "Système",
        commandes: [
          { titre: "Version et modèle", cmd: "show version" },
          { titre: "Alarmes en cours", cmd: "show system alarms\nshow chassis alarms" },
          { titre: "Uptime", cmd: "show system uptime" },
          { titre: "Charge du moteur de routage", cmd: "show chassis routing-engine" },
          { titre: "Dernières lignes du journal", cmd: "show log messages | last 50" },
        ],
      },
      {
        titre: "Interfaces et commutation",
        commandes: [
          { titre: "Résumé des interfaces", cmd: "show interfaces terse" },
          { titre: "Détail et erreurs d'une interface", cmd: "show interfaces <interface> extensive", note: "Ex. : ge-0/0/1." },
          { titre: "Trafic en direct sur les interfaces", cmd: "monitor interface traffic" },
          { titre: "VLAN", cmd: "show vlans" },
          { titre: "Table MAC (EX)", cmd: "show ethernet-switching table" },
          { titre: "Voisins LLDP", cmd: "show lldp neighbors" },
        ],
      },
      {
        titre: "IP et routage",
        commandes: [
          { titre: "Route vers une destination", cmd: "show route <ip>" },
          { titre: "Table ARP", cmd: "show arp no-resolve" },
          { titre: "Voisins OSPF", cmd: "show ospf neighbor" },
          { titre: "Sessions BGP", cmd: "show bgp summary" },
          { titre: "Ping depuis une IP source", cmd: "ping <ip> source <ip-src> count 5" },
          { titre: "Traceroute", cmd: "traceroute <ip>" },
        ],
      },
      {
        titre: "Pare-feu SRX",
        commandes: [
          { titre: "Sessions vers une destination", cmd: "show security flow session destination-prefix <ip>" },
          { titre: "Règles et compteurs d'utilisation", cmd: "show security policies hit-count" },
          { titre: "VPN IPsec : phase 1 et phase 2", cmd: "show security ike security-associations\nshow security ipsec security-associations" },
        ],
      },
      {
        titre: "Configuration",
        commandes: [
          { titre: "Configuration en commandes set", cmd: "show configuration | display set" },
          { titre: "Historique des commits", cmd: "show system commit" },
          { titre: "Valider avec retour arrière automatique", cmd: "commit confirmed 5", note: "En mode configuration. Sans nouveau commit dans les 5 minutes, Junos revient à la config précédente : utile à distance." },
        ],
      },
    ],
  },

  mikrotik: {
    nom: "MikroTik (RouterOS)",
    intro: "Terminal par SSH, Winbox ou WebFig. Syntaxe RouterOS v7 (la plupart marche aussi en v6). Tab complète les commandes.",
    groupes: [
      {
        titre: "Système",
        commandes: [
          { titre: "CPU, mémoire, uptime, version", cmd: "/system resource print" },
          { titre: "Modèle et firmware", cmd: "/system routerboard print" },
          { titre: "Journal", cmd: "/log print" },
        ],
      },
      {
        titre: "Interfaces et commutation",
        commandes: [
          { titre: "Interfaces et leur état", cmd: "/interface print", note: "R = running, X = désactivée." },
          { titre: "Débit en direct d'une interface", cmd: "/interface monitor-traffic <interface>" },
          { titre: "Qui consomme le débit sur une interface", cmd: "/tool torch interface=<interface>" },
          { titre: "Table MAC du bridge", cmd: "/interface bridge host print" },
          { titre: "Voisins découverts (MNDP, CDP, LLDP)", cmd: "/ip neighbor print" },
        ],
      },
      {
        titre: "IP et routage",
        commandes: [
          { titre: "Adresses IP", cmd: "/ip address print" },
          { titre: "Table de routage", cmd: "/ip route print" },
          { titre: "Table ARP", cmd: "/ip arp print" },
          { titre: "Baux DHCP", cmd: "/ip dhcp-server lease print" },
          { titre: "Serveurs DNS utilisés", cmd: "/ip dns print" },
          { titre: "Ping", cmd: "/ping <ip> count=5" },
          { titre: "Traceroute", cmd: "/tool traceroute <ip>" },
        ],
      },
      {
        titre: "Pare-feu",
        commandes: [
          { titre: "Règles de filtrage avec compteurs", cmd: "/ip firewall filter print stats" },
          { titre: "Règles NAT", cmd: "/ip firewall nat print" },
          { titre: "Connexions vers une destination", cmd: "/ip firewall connection print where dst-address~\"<ip>\"" },
          { titre: "Capture rapide de paquets", cmd: "/tool sniffer quick ip-address=<ip>" },
        ],
      },
      {
        titre: "Configuration",
        commandes: [
          { titre: "Exporter la configuration", cmd: "/export", note: "En v7 les mots de passe sont masqués par défaut ; en v6, ajouter hide-sensitive pour les masquer." },
          { titre: "Sauvegarde complète", cmd: "/system backup save name=sauvegarde" },
        ],
      },
    ],
  },

  aruba: {
    nom: "HPE Aruba (AOS-CX)",
    intro: "Commutateurs Aruba CX (6000, 6100, 6300…). Les anciens ProCurve / ArubaOS-Switch ont une syntaxe proche avec quelques différences, indiquées en remarque.",
    groupes: [
      {
        titre: "Système",
        commandes: [
          { titre: "Version", cmd: "show version" },
          { titre: "Modèle, uptime, numéro de série", cmd: "show system" },
          { titre: "Journal des événements (récents d'abord)", cmd: "show events -r", note: "ProCurve : show logging -r." },
          { titre: "Alimentation PoE", cmd: "show power-over-ethernet brief" },
        ],
      },
      {
        titre: "Interfaces et commutation",
        commandes: [
          { titre: "Résumé des interfaces", cmd: "show interface brief", note: "ProCurve : show interfaces brief." },
          { titre: "Détail et erreurs d'une interface", cmd: "show interface <interface>", note: "Ex. : 1/1/1." },
          { titre: "VLAN", cmd: "show vlan" },
          { titre: "Table MAC", cmd: "show mac-address-table", note: "ProCurve : show mac-address." },
          { titre: "Voisins LLDP", cmd: "show lldp neighbor-info", note: "ProCurve : show lldp info remote-device." },
          { titre: "Spanning tree", cmd: "show spanning-tree" },
          { titre: "Agrégats de liens (LACP)", cmd: "show lacp aggregates" },
          { titre: "Modules SFP", cmd: "show interface transceiver" },
        ],
      },
      {
        titre: "IP et tests",
        commandes: [
          { titre: "Table de routage", cmd: "show ip route" },
          { titre: "Table ARP", cmd: "show arp" },
          { titre: "Ping", cmd: "ping <ip>", note: "Ajouter vrf mgmt pour passer par le port de management." },
          { titre: "Traceroute", cmd: "traceroute <ip>" },
        ],
      },
      {
        titre: "Configuration",
        commandes: [
          { titre: "Configuration en cours", cmd: "show running-config" },
          { titre: "Enregistrer la configuration", cmd: "write memory" },
        ],
      },
    ],
  },

  pfsense: {
    nom: "pfSense / OPNsense",
    intro: "Shell FreeBSD : option 8 (Shell) dans le menu console ou en SSH. Les noms d'interface sont ceux du système (em0, igb1, vtnet0…).",
    groupes: [
      {
        titre: "Interfaces et routage",
        commandes: [
          { titre: "Interfaces et adresses", cmd: "ifconfig" },
          { titre: "Table de routage", cmd: "netstat -rn" },
          { titre: "Table ARP", cmd: "arp -an" },
          { titre: "Ping", cmd: "ping -c 5 <ip>" },
          { titre: "Traceroute", cmd: "traceroute -n <ip>" },
        ],
      },
      {
        titre: "Pare-feu (pf)",
        commandes: [
          { titre: "Règles chargées", cmd: "pfctl -sr" },
          { titre: "Règles NAT", cmd: "pfctl -sn" },
          { titre: "États (connexions) vers une destination", cmd: "pfctl -ss | grep <ip>" },
          { titre: "Statistiques générales", cmd: "pfctl -si" },
          { titre: "Paquets bloqués en direct", cmd: "tail -f /var/log/filter.log", note: "Format brut. Le GUI (Status > System Logs > Firewall) est plus lisible." },
          { titre: "Capture de paquets", cmd: "tcpdump -ni <interface> host <ip>" },
        ],
      },
      {
        titre: "Système",
        commandes: [
          { titre: "Charge et processus", cmd: "top -aSH" },
          { titre: "Services en écoute", cmd: "sockstat -4l" },
          { titre: "Journal système", cmd: "tail -n 50 /var/log/system.log" },
        ],
      },
    ],
  },
};
