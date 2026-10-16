# Fiche réseau : IP, VLAN, routage, NAT, VPN

## Adressage IP

Pour trouver le réseau et le broadcast d'une IP, écris toujours les blocs en entier avant de répondre : l'erreur la plus fréquente est de se tromper de bloc.

1. Masque /n : il reste 32 − n bits à 0. Taille du bloc = 2^(32 − n).
2. Écris les blocs : 0, puis + taille, + taille, etc.
3. Place l'IP dans son bloc.
4. Réseau = première adresse du bloc, broadcast = dernière, machines utilisables = taille − 2.

| Masque | Taille du bloc | Machines utilisables | Blocs (dernier octet) |
| --- | --- | --- | --- |
| /24 | 256 | 254 | 0-255 |
| /25 | 128 | 126 | 0-127, 128-255 |
| /26 | 64 | 62 | 0-63, 64-127, 128-191, 192-255 |
| /27 | 32 | 30 | 0-31, 32-63, 64-95, 96-127… |
| /28 | 16 | 14 | 0-15, 16-31, 32-47… |
| /29 | 8 | 6 | 0-7, 8-15, 16-23… |
| /30 | 4 | 2 | 0-3, 4-7, 8-11… |

Exemple : 192.168.50.70/27. Taille 32, blocs 0-31 / 32-63 / **64-95**. Réseau .64, broadcast .95, machines utilisables .65 à .94.

Pièges : ne pas lire « 192.168.30.x » comme un /24 par réflexe (avec un /25, la coupure est entre .127 et .128) ; une IP « proche » n'est pas forcément dans le même réseau. Plages privées : 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (non routées sur Internet).

**Masques inférieurs à /24** : même méthode, mais sur l'octet « coupé » (le 3ᵉ pour /17 à /23, le 2ᵉ pour /9 à /15).

1. Décomposer le masque : /20 = 8 + 8 + 4. L'octet coupé est celui du dernier nombre (ici le 3ᵉ, avec 4 bits à 1).
2. Valeur de cet octet : 11110000 = 240. Taille du bloc = 256 − 240 = 16. Masque complet : 255.255.240.0.
3. Écrire les blocs sur cet octet : 0-15, 16-31, 32-47, 48-63, 64-79… et y placer l'IP.
4. Réseau = début du bloc, puis 0 dans les octets suivants. Broadcast = fin du bloc, puis 255 dans les octets suivants.

Exemple : 10.20.70.5/20. Le 3ᵉ octet vaut 70, il est dans le bloc 64-79. Réseau **10.20.64.0**, broadcast **10.20.79.255**, machines utilisables 10.20.64.1 à 10.20.79.254 (2¹² − 2 = 4094).

| Masque | Décomposition | Octet coupé | Valeur | Taille du bloc |
| --- | --- | --- | --- | --- |
| /20 | 8+8+4 | 3ᵉ | 240 | 16 |
| /21 | 8+8+5 | 3ᵉ | 248 | 8 |
| /22 | 8+8+6 | 3ᵉ | 252 | 4 |
| /23 | 8+8+7 | 3ᵉ | 254 | 2 |

## ARP et passerelle

Un hôte demande toujours la MAC de son prochain saut : la cible si elle est dans son réseau, sinon sa passerelle. Jamais la MAC d'une machine hors de son réseau.

1. Calculer le début et la fin de son propre bloc (voir Adressage IP).
2. IP de destination dans le bloc : ARP pour la cible.
3. IP de destination hors du bloc : ARP pour la passerelle.
4. IP de destination = broadcast du bloc : pas d'ARP, trame en broadcast (FF:FF:FF:FF:FF:FF).

L'ARP est un broadcast : il ne traverse ni un routeur ni la séparation entre deux VLAN. La réponse (ARP reply) est directe. L'association IP → MAC est mémorisée temporairement (`arp -a` sous Windows), ce qui explique qu'un premier ping soit parfois plus lent ou perdu.

| Ce qui voyage de bout en bout | Ce qui change à chaque saut |
| --- | --- |
| IP source, IP destination | MAC source, MAC destination |

Exemple : un PC en 192.168.30.10/25 (passerelle .1) joint 192.168.30.130. Son bloc est .0 à .127, donc .130 est hors du bloc : ARP pour .1, MAC destination = celle du Forti, IP destination = .130 (inchangée).

## Switch, VLAN et trunk

Un switch ne transporte que des trames : il ne fait passer d'un VLAN à l'autre que par un routeur (ici le Forti).

- **Table MAC** : le switch apprend la MAC **source** de chaque trame (MAC → port). Si la MAC destination est inconnue, il diffuse sur tous les autres ports du même VLAN. Les entrées expirent après 300 s sans trafic.
- **VLAN** : un groupe de ports qui s'entendent entre eux et sont isolés des autres. Les broadcasts (donc l'ARP) restent dans le VLAN.
- **Port access** : appartient à un seul VLAN, pour une machine normale.
- **Trunk 802.1Q** : un seul câble entre deux switchs qui transporte plusieurs VLAN, chaque trame portant une étiquette (tag). Sans trunk, il faudrait un câble par VLAN.
- **Routage entre VLAN** : un routeur a un pied dans chaque VLAN (ici dmz en VLAN 10, wan2 en VLAN 20). Le paquet entre par une interface et ressort par l'autre.
- **SVI** : une interface IP virtuelle sur un VLAN, qui donne une adresse au switch lui-même.

Deux PC dans deux VLAN différents ne se joignent pas, même avec des IP du même réseau et sur le même switch.

<!-- schema: montage -->

Le PC et le port dmz du Forti sont dans le VLAN 10 sur deux switchs reliés par le trunk. Le port wan2 est dans le VLAN 20, comme la SVI de SW-A : le paquet doit donc passer par le Forti.

Si un VLAN ne passe pas sur un trunk alors que les autres passent : vérifier qu'il existe sur les deux switchs (`show vlan brief`) et qu'il est autorisé sur le trunk (`show interfaces trunk`).

## Routage

Pour chaque paquet, le routeur garde la route la plus précise parmi celles qui contiennent l'IP de destination. L'ordre des lignes ne compte pas (contrairement aux policies du firewall).

1. Lister les lignes dont le bloc **contient** l'IP (calculer début et fin de chaque bloc).
2. Garder celle au **masque le plus long** (le bloc le plus petit).
3. En cas d'égalité de masque : **distance administrative** (AD) la plus faible.
4. En cas d'égalité d'AD : **métrique** la plus faible.

La route par défaut 0.0.0.0/0 contient toutes les adresses : elle n'est utilisée que si aucune autre ligne ne correspond.

| Source de la route | AD (Cisco) | Remarque |
| --- | --- | --- |
| Connectée | 0 | créée dès qu'une interface a une IP |
| Statique | 1 | **10 par défaut sur un FortiGate** |
| EIGRP | 90 |  |
| OSPF | 110 |  |
| RIP | 120 |  |

Piège : une AD faible ne passe jamais avant un masque plus long. Exemple : avec 10.0.0.0/8 (AD 1) et 10.1.0.0/16 (AD 110), un paquet pour 10.1.2.3 suit le /16.

Sur le Forti : `get router info routing-table all` (ou `connected` pour les réseaux directs).

## NAT et firewall

Le NAT sert à cacher des adresses privées à un réseau qui ne les connaît pas, et seulement dans ce cas. Test à faire à chaque fois : le destinataire sait-il renvoyer sa réponse vers l'IP source d'origine ?

| Trajet | NAT | Pourquoi |
| --- | --- | --- |
| LAN → Internet | activé | les IP privées ne sont pas routées sur Internet |
| LAN → tunnel VPN | désactivé | l'autre site joint les IP privées via le tunnel, et la règle du tunnel attend les IP d'origine |
| VLAN 10 → VLAN 20 | désactivé | réseaux internes qui se connaissent |

- **PAT** (NAT surchargé) : le Forti remplace l'IP source **et** le port source, et note la correspondance dans sa table de translation. C'est ce qui permet à plusieurs PC de partager une seule IP publique.
- **VIP / DNAT** : publie un serveur interne vers l'extérieur (IP publique:port → IP privée:port). Il faut en plus une policy qui l'autorise.
- **Le NAT n'est pas un firewall** : il bloque les connexions entrantes par effet de bord. La vraie protection, ce sont les policies.

**Firewall stateful** : le Forti mémorise chaque session dans sa table de sessions. La réponse à une connexion autorisée à l'aller revient sans policy dans l'autre sens. Une nouvelle connexion venant d'Internet est bloquée par la règle implicite de refus. Les policies sont lues dans l'ordre : la première qui correspond s'applique.

## VPN IPsec

Un VPN relie deux réseaux privés à travers Internet avec deux mécanismes distincts, qu'il ne faut pas confondre.

|  | Encapsulation | Chiffrement |
| --- | --- | --- |
| Problème résolu | les IP privées ne sont pas routées sur Internet | n'importe qui pourrait lire le contenu en route |
| Ce qui est fait | le paquet d'origine devient le contenu d'un nouveau paquet (IP publique source → IP publique destination) | le contenu, y compris l'ancien en-tête, est brouillé avec une clé |
| Sans lui | le paquet est jeté par Internet | le paquet arrive mais est lisible |

Encapsuler = pour arriver. Chiffrer = pour ne pas être lu. Un paquet chiffré mais non encapsulé garde ses IP privées et n'arrive pas.

**Montage du tunnel (IPsec)** :

1. Phase 1 : les deux Forti s'authentifient (mot de passe partagé, la pre-shared key) et fabriquent une clé secrète sans l'envoyer en clair (Diffie-Hellman).
2. Phase 2 : dans ce canal sécurisé, ils s'accordent sur le chiffrement des données et les réseaux concernés.

**Identique des deux côtés** : la clé partagée, les algorithmes de chiffrement et d'authentification, le groupe Diffie-Hellman. Les réseaux sont à **croiser** : le réseau local de Paris est le réseau distant de Lyon, et inversement.

**Pour que le tunnel serve** : une route vers le réseau distant par l'interface du tunnel, une policy dans chaque sens (LAN → tunnel et tunnel → LAN) avec NAT désactivé.

**Chemin d'un paquet** : à l'envoi, route → policy → chiffrement → enveloppe → Internet. À la réception, on retire l'enveloppe → déchiffrement → policy → route → livraison.

**VPN télétravailleur** : un PC avec FortiClient monte le tunnel ; l'authentification est un identifiant et un mot de passe (souvent avec un code à usage unique), et le Forti attribue au PC une IP interne pour la durée de la connexion. Le serveur doit avoir le Forti pour passerelle (ou une route vers cette plage) pour que la réponse revienne.

**Tunnel monté mais serveur injoignable** : policy tunnel → LAN manquante, passerelle du serveur incorrecte, NAT activé par erreur, ou route absente côté client.

## Commandes utiles

| Sur | Commande | Ce qu'elle montre |
| --- | --- | --- |
| Switch Cisco | `show vlan brief` | les VLAN et leurs ports |
| Switch Cisco | `show mac address-table` | la table MAC (MAC, VLAN, port) |
| Switch Cisco | `show interfaces trunk` | les ports trunk et les VLAN autorisés |
| Switch Cisco | `show ip interface brief` | l'état et l'IP de chaque interface |
| Switch Cisco | `delete flash:vlan.dat` puis `reload` | efface les VLAN (qui survivent sans `write memory`) avant de rendre le switch |
| FortiGate | `get router info routing-table all` | la table de routage |
| FortiGate | `get router info routing-table connected` | les réseaux directement connectés |
| FortiGate | `get system interface physical` | les interfaces physiques et leur état |
| FortiGate | `diagnose sniffer packet any 'host 192.168.30.10' 4` | les paquets qui passent (vérifier l'entrée et la sortie) |
| FortiGate | `diagnose debug flow` | pourquoi un paquet est accepté ou refusé (policy, route) |
| Windows | `arp -a` | la table ARP (IP → MAC) |
| Windows | `route add 192.168.30.128 mask 255.255.255.128 192.168.30.1` | ajoute une route (non persistante) |
| Windows | `tracert -d 8.8.8.8` | le chemin saut par saut, sans résolution de noms |
| Windows | `ipconfig /all` | IP, masque, passerelle et DNS de chaque carte |

Avec `diagnose debug flow`, penser à désactiver le debug après usage : `diagnose debug disable` puis `diagnose debug reset`.

## Méthode de diagnostic

Suivre le paquet saut par saut jusqu'à l'endroit où il s'arrête : cet endroit désigne la cause. Un seul changement à la fois, une vérification après chaque changement.

| Symptôme | Cause probable | Vérification |
| --- | --- | --- |
| Ping vers la passerelle impossible | mauvaise IP ou masque, mauvais VLAN, câble ou port | `ipconfig /all`, `show vlan brief`, `show mac address-table` |
| Ping vers la passerelle OK, vers un autre réseau KO | route manquante, policy manquante, mauvaise passerelle sur la cible | `get router info routing-table all`, `diagnose sniffer packet` |
| Le paquet entre sur le Forti mais ne ressort pas | policy absente ou refus implicite | `diagnose debug flow` |
| Le paquet arrive sur la cible mais la réponse ne revient pas | la cible n'a pas le Forti pour passerelle, ou NAT activé par erreur | sniffer côté cible et côté Forti |
| Un VLAN passe mal entre deux switchs | VLAN absent d'un switch ou non autorisé sur le trunk | `show vlan brief`, `show interfaces trunk` |
| Internet OK par IP mais pas par nom | DNS manquant ou injoignable | `nslookup`, `ipconfig /all` |
| Tunnel VPN qui ne monte pas | clé, algorithmes ou réseaux différents des deux côtés | comparer les deux configurations ligne à ligne |
| Premier ping perdu, les suivants passent | résolution ARP | `arp -a` après le premier ping |

Avant de conclure, toujours se demander : la destination est-elle dans mon bloc ? Si oui, ARP pour elle. Sinon, ARP pour la passerelle.
