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
| Implantation | **Bureaux et atelier : 105 chemin de la Chênaie, 13080 Aix-en-Provence** (SIREN 480 377 308). « Menuiserie des Pennes » = nom de la société, pas le lieu. Pas de showroom ; clients reçus sur rendez-vous, ou déplacement sur place |
| SAV | Uniquement sur nos propres poses |
| Secteurs protégés | Oui, des chantiers réalisés en secteur protégé |
| Photos | En général 4 à 5 photos par chantier |
| Suivi client | Pas d'interlocuteur nommé publiquement, mais **une seule personne suit le dossier du devis jusqu'à la pose** |
| Délai de réponse | **24 à 48 h** |
| Visite technique | **Quasi systématique** : prise des cotes exactes et vérification des contraintes de pose |
| Création | **5 janvier 2005** |
| Volume | Environ **85 à 100 chantiers par an** (chiffre exact non disponible) |
| Équipe | Nombre de poseurs : **ne pas communiquer** |
| Plus grande menuiserie posée | **7,80 m × 2,55 m**, vitrage retardateur d'effraction **SP10** |
| Assureur décennal | **Generali** |
| Références clients citables | **Aucune** pour l'instant |
| Principaux fabricants | Novelis, Noralis, Laloi Menuiseries, Menuiseries Combes (bois), Futurol, Sothoferm (volets), Technicdoor, Porte Gervais, Tordjman Métal (portes blindées), La Toulousaine (portails) — liste non exhaustive ; statut de partenariat à préciser |
| Arguments du client | 20 ans d'expérience, connaissance fine des produits, adaptation au besoin ; petite structure = flexibilité et moins de paperasse ; produits premium ; suivi de chantier ; pose soignée : délais respectés, propreté absolue, finitions parfaites, y compris en **résidences ou locaux commerciaux en activité** |
| Avis Google | **4,2/5 sur 9 avis** (septembre 2026) |
| Labels / certifications | Aucun label. **Entreprise référencée auprès du patrimoine de la Ville d'Aix-en-Provence pour la menuiserie extérieure bois** : en rénovation, la mairie peut orienter vers l'entreprise. **Aucun justificatif à ce jour** : ne pas l'afficher tant que la formulation exacte n'est pas confirmée par écrit par l'Atelier du Patrimoine (04 42 91 99 40, atelier_patrimoine@mairie-aixenprovence.fr) |
| Photos transmises | 1 villa contemporaine (vue de nuit éclairée, intérieur avec angle vitré vue mer, vues de rue) |

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
│                                     architectes · syndics & agences · locaux commerciaux (ajout validé)
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
- **Une seule page Professionnels** au lancement, avec une section par profil. Ajout validé : section **locaux commerciaux** (commerces, bureaux, intervention en site occupé).
- **Réalisations à deux niveaux** : galerie filtrable pour tous les chantiers ; page individuelle seulement pour les projets qui ont une vraie histoire (secteur protégé, grandes dimensions, programme de logements, rénovation délicate…).
- **SAV** : section de « L'entreprise », présenté comme un engagement, pas comme un service de dépannage.

### 3.5 Pages écartées (validé)
- Page Particuliers (le reste du site leur parle).
- FAQ générale (FAQ courtes intégrées aux pages produits et devis).
- Page « Avis clients » (avis affichés dans les pages, lien vers Google).
- Page « Zone d'intervention » listant des communes.
- Page Les Pennes-Mirabeau (sans objet : l'entreprise est à Aix-en-Provence).
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

### 3.7 Parcours de visite (validé)

**Profils** : professionnel (80 % — promoteurs/constructeurs/maçons, architectes, syndics/agences ; arrive surtout par recommandation ou par le nom, vient **vérifier**) · particulier (20 % — arrive surtout par Google sur une page produit, **compare**).

| # | Parcours |
|---|---|
| 1 | **Pro, principal** : Accueil → Réalisations → Professionnels → Devis avec plans (téléphone accessible à chaque étape) |
| 2 | **Pro, court** : Accueil → Professionnels → Devis, ou appel direct |
| 3 | **Particulier, principal** : Page produit (Google) → Réalisations → Devis |
| 4 | **Particulier, prudent** : Page produit → L'entreprise → Devis |

**Règle devis / contact** : Devis = projet identifié (plans pour les pros, besoin décrit pour les particuliers). Contact = tout le reste (question, rendez-vous, SAV, fournisseur, candidature).

**CTA** :
- CTA principal unique **« Demande de devis »**, libellé contextualisé : « Envoyer un projet à chiffrer » (Professionnels), « Demander un devis pour vos fenêtres » (produits), « Un projet similaire ? » (réalisations).
- Page devis : aiguillage **particulier / professionnel** dès le départ ; envoi de plans et fichiers lourds pour les pros.
- **Téléphone** : CTA secondaire, visible en permanence dans l'en-tête ; sur mobile, barre fixe « Appeler » + « Demande de devis ».
- **Pas de prise de rendez-vous en ligne** comme CTA principal.

**Trois engagements** placés au plus près des CTA (sous le formulaire, bas des pages Professionnels et produits, méthode dans L'entreprise) :
1. un seul interlocuteur du devis jusqu'à la pose (sans le nommer) ;
2. réponse sous 48 h (afficher uniquement un délai toujours tenu) ;
3. visite technique et prise de cotes sur place.

**Conséquences retenues pour les étapes suivantes** :
- Accueil = porte d'entrée des pros : preuves de capacité très tôt, aiguillage pro / particulier rapide, réalisations mêlant programmes et maisons.
- Réassurance pros : chiffres de capacité, références, délais, assureur décennal, zone, marques posées, suivi unique.
- Réassurance particuliers : avis Google (note + nombre + lien), photos réelles, garanties, visite technique, poseurs de l'entreprise, SAV.

---

## 4. Points d'attention notés

- **Préférence DA du client (à confirmer à l'étape DA)** : garder du site actuel le côté très épuré, simple, facile à comprendre ; couleurs sobres, **fond blanc**, formes esthétiques.
- **Avis** : 9 avis à 4,2 = sous la barre locale (> 21 avis à ≥ 4,8 selon l'étude). Lancer la collecte d'avis dès maintenant.

- **Positionnement** : avec 80 % de pros et 70 % de neuf, le premium doit s'exprimer autant par la fiabilité, les délais et la capacité à tenir un chantier que par l'esthétique (à traiter à l'étape Accueil / DA).
- **Deux rôles du site** : les pros viennent surtout vérifier le sérieux (références, capacité) ; le trafic SEO viendra surtout des particuliers.
- **Photos** : prévoir désormais des photos « avant » et « pendant » sur chaque chantier (4-5 photos actuellement ; l'étude recommande 8-12 pour une page projet).
- **Secteur sauvegardé d'Aix** : le PVC y est proscrit (PSMV).

---

## 5. En attente

- [ ] Confirmation écrite du référencement patrimoine (Atelier du Patrimoine, Ville d'Aix).
- [ ] Harmoniser nom / adresse / téléphone / activité sur Google et les annuaires (PagesJaunes décrit du mobilier et de l'agencement intérieur).
- [ ] À rediscuter : l'extension « page locale Aix » (l'adresse étant à Aix, l'accueil et la fiche Google couvrent déjà Aix — risque de doublon).

- [ ] **Inventaire des chantiers** des 2-3 dernières années (commune, produit, type de client) — à redemander au client ; conditionne pages locales et projets détaillés.
- [ ] Marques et gammes posées, statut de partenariat.
- [ ] Contenu du site actuel (non consultable depuis l'environnement de travail) — à fournir par copier-coller si besoin.

## 6. Prochaine étape proposée
Structure de la **page d'accueil** (en commençant par les questions au client sur ce qu'il souhaite y voir).
