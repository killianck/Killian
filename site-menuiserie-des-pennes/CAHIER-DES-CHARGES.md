# Cahier des charges — Refonte du site Menuiserie des Pennes

> Document de référence du projet. Il regroupe le cadre de travail et **toutes les décisions validées** par le client.
> Une décision inscrite ici ne se modifie pas sans le signaler et obtenir une nouvelle validation.
>
> - Site actuel : https://www.menuiseriedespennes.fr/
> - Étude de référence : [`BENCHMARK-COMPLET.md`](./BENCHMARK-COMPLET.md) (benchmark concurrentiel, SEO, SEO local, UX, conversion — septembre 2026). Distinguer ses constats **[FAIT]** de ses recommandations **[RECO]**.
>
> Dernière mise à jour : 24/09/2026

---

## 1. Cadre de travail

- **Méthode** : une problématique → une décision → une validation → étape suivante. Jamais tout le site d'un coup.
- **Ordre des phases** : stratégie → architecture → UX → direction artistique → contenu → SEO → développement.
- **Pas de code, de maquette ni de texte définitif** sans demande explicite.
- **Avant chaque page** : demander au client ce qu'il souhaite y voir, puis proposer la structure.
- **Nouvelle page** : jamais ajoutée d'office. Justifier : objectif, intention de recherche, intérêt SEO, intérêt commercial, place dans l'architecture, risque de cannibalisation, priorité.
- **Rôle** : conseiller critique (SEO, SEO local, UX/UI, CRO, copywriting, DA). Contredire si un choix dégrade SEO, UX, conversion ou crédibilité. Décision finale au client.
- **Réponses** : structurées, concises, orientées décision ; questions groupées et limitées à celles qui changent le résultat.

### Direction artistique (principes du cadre)
- Référence visuelle : le site actuel. ADN à conserver : premium, sobre, moderne, élégant, architectural, professionnel.
- Priorité aux **vraies photos de chantier** ; pas de banque d'images.
- À éviter : couleurs criardes, accumulation de blocs, badges, « DEVIS GRATUIT » partout, esthétique catalogue ou low-cost, surcharge.

### SEO (principes du cadre)
- SEO dès la conception, sans keyword stuffing, textes gonflés ni pages quasi identiques.
- **Pas de création massive de pages villes** : une page locale n'existe que si elle a une vraie intention, une vraie valeur et un contenu spécifique.
- Conversion élégante et rassurante, sans technique agressive.

---

## 2. Données entreprise (fournies par le client)

| Sujet | Donnée |
|---|---|
| Activité | Fourniture et pose de menuiseries extérieures, neuf et rénovation |
| Produits principaux | Fenêtres, portes-fenêtres, baies vitrées, portes d'entrée, volets roulants et bois, portes de garage |
| Produits complémentaires | Pergolas, stores, portails |
| Matériaux | PVC, bois, aluminium |
| Clientèle | **80 % professionnels** (constructeurs, promoteurs, maçons, chefs de chantier, architectes, syndics, agences immobilières, sociétés de construction) · 20 % particuliers |
| Type de chantier | **70 % neuf** · 30 % rénovation |
| Zone | PACA, **80 % dans les Bouches-du-Rhône** |
| Implantation | Les Pennes-Mirabeau. Pas de showroom ; clients reçus sur rendez-vous, ou déplacement sur place |
| SAV | Uniquement sur nos propres poses |
| Secteurs protégés | Oui, des chantiers réalisés en secteur protégé |
| Photos | En général 4 à 5 photos par chantier |

---

## 3. Décisions validées

### 3.1 Pages obligatoires (validé)
Accueil · Nos réalisations · Demande de devis · Contact.

### 3.2 Arborescence de lancement (validé le 24/09/2026)

```
/                                     Accueil
├── /menuiseries/                     Nos menuiseries (hub)
│   ├── /fenetres/                    Fenêtres et portes-fenêtres
│   ├── /baies-vitrees/
│   ├── /portes-d-entree/
│   ├── /volets/                      Volets roulants et volets bois
│   ├── /portes-de-garage-et-portails/
│   └── /pergolas-et-stores/
├── /realisations/                    Nos réalisations (hub filtrable)
│   │                                 filtres : produit · matériau · neuf/rénovation ·
│   │                                 type de projet (maison, programme neuf, copropriété…)
│   └── /realisations/[projet]/       projets détaillés uniquement
├── /professionnels/                  sections : promoteurs & constructeurs · maçons & chefs de chantier ·
│                                     architectes · syndics & agences
├── /l-entreprise/                    histoire, équipe, méthode, garanties & SAV
├── /demande-de-devis/                aiguillage particulier / professionnel (+ page merci en noindex)
├── /contact/                         adresse, accueil sur rendez-vous, déplacement
└── Mentions légales · Confidentialité · Cookies
```

14 pages fixes + les projets détaillés. URLs indicatives, à confirmer à l'étape SEO.

### 3.3 Menu principal (validé)
Menuiseries · Réalisations · **Professionnels** · L'entreprise · Contact + bouton **« Demande de devis »**.

### 3.4 Règles d'architecture (validé)
- **Deux regroupements de produits** : « Portes de garage et portails » (fermetures d'accès à la propriété) et « Pergolas et stores » (extérieur, protection solaire). Séparation possible plus tard si le volume le justifie.
- **Porte-fenêtre** : section de la page Fenêtres, pas de page dédiée.
- **Neuf / rénovation et matériaux (PVC, bois, alu)** : traités en sections dans chaque page produit, jamais en pages séparées.
- **Une seule page Professionnels** au lancement, avec une section par profil.
- **Réalisations à deux niveaux** : galerie filtrable pour tous les chantiers ; page individuelle seulement pour les projets qui ont une vraie histoire (secteur protégé, grandes dimensions, programme de logements, rénovation délicate…).
- **SAV** : section de « L'entreprise », présenté comme un engagement, pas comme un service de dépannage.

### 3.5 Pages écartées (validé)
- Page Particuliers (le reste du site leur parle).
- FAQ générale (FAQ courtes intégrées aux pages produits et devis).
- Page « Avis clients » (avis affichés dans les pages, lien vers Google).
- Page « Zone d'intervention » listant des communes.
- Page Les Pennes-Mirabeau (couverte par l'accueil, le contact et la fiche Google).
- Pages par matériau, pages « Neuf » / « Rénovation ».
- **Guide « PVC, bois ou alu : que choisir ? »** — refusé par le client (inutile pour une clientèle à 80 % professionnelle).

### 3.6 Extensions possibles après lancement (sous condition)
| Extension | Condition |
|---|---|
| Guide « Menuiseries en secteur protégé (ABF) » — prioritaire | Chantiers réels en secteur protégé ; règles sourcées et datées |
| Page Architectes séparée | Si ce public prend du poids |
| Pages locales (Aix, Marseille…) | ≥ 2 chantiers documentés dans la zone (≥ 4 pour Aix) — après inventaire |
| Séparation des pages regroupées | Si le volume du produit le justifie |
| Guides budget, aides & TVA (page unique datée) | Données fiables ; MaPrimeRénov' : fenêtre seule à 0 € depuis le 01/09/2026 |

---

## 4. Points d'attention notés

- **Positionnement** : avec 80 % de pros et 70 % de neuf, le premium doit s'exprimer autant par la fiabilité, les délais et la capacité à tenir un chantier que par l'esthétique (à traiter à l'étape Accueil / DA).
- **Deux rôles du site** : les pros viennent surtout vérifier le sérieux (références, capacité) ; le trafic SEO viendra surtout des particuliers.
- **Photos** : prévoir désormais des photos « avant » et « pendant » sur chaque chantier (4-5 photos actuellement ; l'étude recommande 8-12 pour une page projet).
- **Secteur sauvegardé d'Aix** : le PVC y est proscrit (PSMV).

---

## 5. En attente

- [ ] **Inventaire des chantiers** des 2-3 dernières années (commune, produit, type de client) — à redemander au client ; conditionne pages locales et projets détaillés.
- [ ] Marques et gammes posées, statut de partenariat.
- [ ] Contenu du site actuel (non consultable depuis l'environnement de travail) — à fournir par copier-coller si besoin.

## 6. Prochaine étape proposée
Définir les **parcours utilisateurs** (professionnel / particulier → prise de contact), avant la conception des pages.
