# Cahier des charges — Refonte du site Menuiserie des Pennes

> Document de référence du projet. Il regroupe le cadre de travail et **toutes les décisions validées** par le client.
> Une décision inscrite ici ne se modifie pas sans le signaler et obtenir une nouvelle validation.
>
> - Site actuel : https://www.menuiseriedespennes.fr/
> - Étude de référence : [`BENCHMARK-COMPLET.md`](./BENCHMARK-COMPLET.md) (benchmark concurrentiel, SEO, SEO local, UX, conversion — septembre 2026). Distinguer ses constats **[FAIT]** de ses recommandations **[RECO]**.
>
> Dernière mise à jour : 24/09/2026

---

## 0. Où on en est (suivi d'avancement — mis à jour le 01/10/2026)

| Étape | État |
|---|---|
| Stratégie et architecture | ✅ Validées |
| Parcours de visite | ✅ Validés |
| Structure des pages | ✅ Validée |
| Direction artistique et prototype | ✅ Validés (réglages possibles à tout moment) |
| Contenu : textes définitifs | À faire |
| Formulaires (devis, contact) | **Terminés et testés** (01/10/2026 : test réel avec PDF + JPG reçu dans la boîte de réception Hotmail, confirmation client reçue ; branchés, thème `inc/forms.php`) : envoi à mdp13@hotmail.fr, fichiers **PDF / JPG uniquement** en pièces jointes (contrôle du contenu réel, 5 fichiers, 10 Mo chacun, 15 Mo au total), accusé de réception au client, copie de chaque demande dans l'admin (« Demandes reçues »), anti-spam invisible (champ piège, délai, limite par IP, Akismet). Expéditeur : contact@menuiseriedespennes.fr (boîte Hostinger, SPF / DKIM / DMARC en place). Transfert contact@ → mdp13@hotmail.fr en place. Au lancement : supprimer la demande de test (ID 200). |
| SEO (titres Google, adresses des pages, mots-clés, fiche Google) | **Préparation terminée** (01/10/2026). Restent liés aux textes : FAQ, guide secteur protégé, communes des 4 chantiers. Restent liés au lancement : redirections 301 / 410, indexation, Search Console. Fiche Google : plus tard. — plan dans [`PLAN-SEO.md`](./PLAN-SEO.md). Option B validée : 22 vraies pages WordPress **privées** (IDs 177 à 198) avec titre, description et mot-clé saisis dans All in One SEO, modifiables par le client. Réglages globaux AIOSEO faits (organisation, logo, téléphone, e-mail, date de création, séparateur « · », fil d'Ariane en français, image de partage par défaut, plan du site limité aux pages et sans les 14 anciennes pages Hostinger). Données structurées faites (thème, `inc/schema.php`) : entreprise du bâtiment locale avec adresse, zone desservie et lien vers la fiche Google (`kgmid=/g/1tjbbcnd`), « Service » sur les 7 pages produit, « Réalisation » avec photos et lieu sur les 8 chantiers, sans avis balisés. Horaires : lundi–vendredi 7 h 30 – 18 h (balisage + page Contact). Reste : coordonnées GPS, autres profils (réseaux), optimisation de la fiche Google, Search Console au lancement |
| Développement sur WordPress | **En cours** — thème sur mesure « Menuiserie des Pennes » installé en **brouillon** (non publié, visible uniquement via le lien d'aperçu), reprenant le prototype validé. Formulaires et SEO faits. Reste : textes définitifs, pages légales, redirections de l'ancien site |
| Mise en ligne | À faire (réactiver l'indexation, Search Console, fiche Google) |
| Incident aperçu (01/10/2026) | Le cache LiteSpeed servait d'anciennes versions au lien d'aperçu exact (mes vérifications ajoutaient un paramètre et contournaient le cache). Cache purgé ; les pages d'aperçu ne sont plus jamais mises en cache (`inc/router.php`). **Au lancement : purger le cache LiteSpeed après publication.** |
| Renouvellements à surveiller | Boîte **contact@menuiseriedespennes.fr** : offerte 1 an (créée en octobre 2026) → à renouveler avant **octobre 2027**, sinon les e-mails du site risquent de finir en indésirables. Noter la date exacte affichée dans hPanel → E-mails. |

**Côté client, en parallèle** : collecte d'avis Google · e-mail à l'Atelier du Patrimoine · photos (atelier, équipe, galandages terminés, pergola, avant/pendant/après) · liste des chantiers avec communes.

**Site de travail** : le thème est en brouillon WPVibe ; les visiteurs voient toujours l'ancien thème Hostinger, et l'indexation reste désactivée. **Ne pas publier le brouillon sans accord explicite et sauvegarde préalable.**

**Préférence de collaboration** : ne plus envoyer de PDF ni de ZIP sauf demande explicite.

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
| Chiffres 2025 (confirmés par le client, formulation modifiable) | 82 chantiers · 1 027 fenêtres posées · 28 rénovations |
| Contact | 06 20 71 13 36 · **mdp13@hotmail.fr** (adresse à afficher sur le site, choix du client du 01/10/2026) |
| Produits complémentaires (ajout) | **Garde-corps** (confirmé le 30/09/2026) — page « Portails, portillons et garde-corps » (option A validée) |
| Référence citable | **Mairie de Fos-sur-Mer** (12 logements) — citable selon le client, à confirmer par écrit si possible |
| Photos retouchées | Les fichiers « chatgpt-image » sont de **vraies photos de chantier retouchées** (ciel, lumière, nettoyage). Règle : retouche d'ambiance autorisée, **aucune modification des menuiseries ni du bâti**, originaux conservés |
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
│   ├── /portes-de-garage/
│   ├── /portails-portillons-et-garde-corps/
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

15 pages fixes + les projets détaillés. URLs indicatives, à confirmer à l'étape SEO.

### 3.3 Menu principal (validé)
Menuiseries · Réalisations · **Professionnels** · L'entreprise · Contact + bouton **« Demande de devis »**.

### 3.4 Règles d'architecture (validé)
- **Regroupements de produits** : « Portails, portillons et garde-corps » (métallerie extérieure alu) et « Pergolas et stores » (extérieur, protection solaire) ; « Portes de garage » a sa propre page. *Révisé le 30/09/2026 (option A validée) : remplace le regroupement « Portes de garage et portails » suite à l'ajout des garde-corps.* Séparation possible plus tard si le volume le justifie.
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
- **Téléphone** : CTA secondaire, visible en permanence dans l'en-tête ; sur mobile, barre fixe « Appeler » + « E-mail » + « Devis ».
- **Règle (client, 02/10/2026)** : partout où le téléphone est proposé, l'e-mail l'est aussi (en-tête, menu mobile, barre mobile, appels finaux, en-têtes Produits et Professionnels, page Devis, pied de page, Contact).
- **Pas de prise de rendez-vous en ligne** comme CTA principal.

**Trois engagements** placés au plus près des CTA (sous le formulaire, bas des pages Professionnels et produits, méthode dans L'entreprise) :
1. un seul interlocuteur du devis jusqu'à la pose (sans le nommer) ;
2. réponse sous 48 h (afficher uniquement un délai toujours tenu) ;
3. visite technique et prise de cotes sur place.

**Conséquences retenues pour les étapes suivantes** :
- Accueil = porte d'entrée des pros : preuves de capacité très tôt, aiguillage pro / particulier rapide, réalisations mêlant programmes et maisons.
- Réassurance pros : chiffres de capacité, références, délais, assureur décennal, zone, marques posées, suivi unique.
- Réassurance particuliers : avis Google (note + nombre + lien), photos réelles, garanties, visite technique, poseurs de l'entreprise, SAV.

### 3.8 Structure de la page d'accueil (validé le 30/09/2026)

Principe : porte d'entrée des professionnels (preuve de capacité très tôt), envie pour le particulier ; **7 sections**, épurées, 600 à 900 mots, un seul H1 (« menuiseries extérieures » + Aix-en-Provence).

| # | Section | Rôle | Visuel |
|---|---|---|---|
| — | En-tête | Logo, menu validé, **téléphone visible**, bouton « Demande de devis » ; mobile : barre fixe Appeler + Devis | — |
| 1 | Ouverture | H1 : menuiseries extérieures, fourniture et pose, Aix-en-Provence / Bouches-du-Rhône ; neuf et rénovation, particuliers et professionnels. CTA « Demande de devis » + lien « Voir nos réalisations » | Villa de nuit (escabeau à retirer) |
| 2 | Chiffres clés | Depuis 2005 · 82 chantiers en 2025 · 1 027 fenêtres posées · baies jusqu'à 7,80 m (SP10) · atelier à Aix — sobres, sans animation | — |
| 3 | Orientation | « Vous êtes un professionnel » (→ Professionnels, « Envoyer un projet à chiffrer ») / « Vous êtes un particulier » (→ Nos menuiseries) | Résidence Sindona / villa de Puyricard |
| 4 | Réalisations à la une | Villa vue mer (nuit) · villa dans la roche · Résidence Sindona · villa de Puyricard ; type, commune, un fait. CTA « Toutes nos réalisations » | Photos de chantier |
| 5 | Nos menuiseries | 7 familles, une photo réelle chacune, liens vers les pages produits | Photos de chantier |
| 6 | Atelier et savoir-faire | Fabrication sur mesure à l'atelier (portes, coffres), pose soignée (délais, propreté, finitions, site occupé), fabricants en texte ; patrimoine d'Aix une fois confirmé. CTA « Découvrir l'entreprise » | Photo d'atelier (à produire) ; à défaut porte biométrique ou photo de pose |
| 7 | Démarrer un projet | Étapes : demande → visite technique → devis sous 48 h → fabrication → pose → SAV ; un seul interlocuteur ; zone en une ligne. CTA « Demande de devis » + téléphone | Sobre |
| — | Pied de page | Adresse d'Aix, téléphone, e-mail, décennale Generali, liens, lien discret fiche Google, mentions | — |

**Exclus** : bloc d'avis (à activer au-delà d'environ 20 avis ≥ 4,5), mur de logos, carrousel, compteurs animés, « devis gratuit » répété, promotions, MaPrimeRénov', FAQ.

### 3.9 Direction artistique et prototype (validé le 30/09/2026, réglages à venir)

Le prototype complet (« menuiserie-des-pennes-prototype.html ») est validé comme base du site, avec des réglages à préciser.

- **Couleurs** : pierre claire #EDECE8 (fond), noir #0B0C0D, anthracite **RAL 7016** #383E42, accent unique sable #C9AE84.
- **Typographie** : serif fine (accroches, chiffres) · sans-serif moderne (titres, texte) · mono technique en capitales (menu, repères, boutons).
- **Ergonomie de référence** : usdc.com. **Motif signature** : colonne gauche fixe (grand numéro, barre de progression cliquable, photo) pendant que les éléments défilent à droite — utilisé pour les familles de produits, la méthode, les délais, les solutions produits.
- **Composants** : cartes 01-04 dépliables (réalisations à la une ; cartes fermées avec photo assombrie au lieu d'un fond noir, demande client du 01/10/2026), lignes dépliables (métiers), avant / après à glisser, filtres de réalisations, devis en 2 étapes avec aiguillage particulier / professionnel.
- **Photo d'ouverture** : villa de nuit (escabeau à retirer en retouche).
- **Phrase de la section chiffres (accueil)** : « Un atelier à Aix, une équipe spécialisée dans la pose, et une seule personne qui suit votre projet du devis à la pose. » (réglage client du 01/10/2026)
- **Pages du prototype** : Accueil · Menuiseries + 7 produits · Réalisations + pages projets · Professionnels · L'entreprise · Demande de devis · Contact.
- Structure d'accueil adaptée par rapport à 3.8 : ouverture · chiffres · orientation pro / particulier · réalisations à la une (cartes) · 7 familles (défilement) · atelier et savoir-faire · méthode en 6 étapes (défilement) · appel final.

### 3.10 Textes de la page d'accueil (validés le 01/10/2026, intégrés au site)

- **Ouverture** : « Fenêtres, baies vitrées, portes, volets : nous fournissons et posons vos menuiseries en aluminium, PVC et bois, en construction neuve comme en rénovation. Que vous soyez un particulier ou un professionnel du bâtiment, nous vous répondons sous 48 heures. »
- **Carte Particulier** : « Construction neuve ou rénovation de votre logement » (« logement » couvre les appartements).
- **Chiffres 2025 confirmés** : 82 chantiers, 1 027 fenêtres posées.
- **Poseurs salariés, aucune sous-traitance** (confirmé) → « Une pose soignée, sans sous-traitance » + étape Pose « par nos propres équipes, sans sous-traitance ».
- **Fabricants cités sur l'accueil** (accord) : Noralis, Novelis, Laloi, Menuiseries Combes, Porte Gervais, Futurol.
- **Villa contemporaine (photo de nuit) : Céreste (04)** — hors 13, illustre l'intervention en région PACA.
- Méthode : le délai de 48 h porte sur la **première réponse** (étape 1), le devis détaillé vient après la visite.
- Pergolas et stores : **photo d'illustration provisoire** (Unsplash, Cesar Cid, média ID 201), légendée « Photo d'illustration » — accord client du 01/10/2026 ; à remplacer par une pergola posée par l'entreprise dès réception.
- Reste en jaune : mention patrimoine d'Aix (après confirmation écrite ; e-mail à l'Atelier du Patrimoine rédigé, envoi par le client).

### 3.11 Textes de la page Professionnels (01/10/2026, intégrés au site)

- « Sans sous-traitance » dès l'ouverture, pastille à l'étape Pose, point « Nos propres poseurs ».
- Bandeau capacité : phrase validée « Assez structurés pour un programme de logements, assez souples pour une villa sur mesure. » · 82 chantiers en 2025 · 1 027 fenêtres · 22 logements (Marseille) · baie 7,80 m SP10.
- **Immeuble cours Lieutaud, Marseille** : **22 logements** (confirmé), levage à la mini-grue ; **pas de photo** → cité dans le texte uniquement (pas de page réalisation).
- Section « Avec qui nous travaillons » refaite en pleine largeur (retour client : trop vide / trop petite) : titre + phrase d'intro, 4 métiers en grandes lignes numérotées 01-04, grande photo à l'ouverture.
- Appels d'offres : « Nous répondons aussi à des appels d'offres, publics comme privés » (non systématique).
- Documents sur demande : fiches techniques, PV d'essais, attestation décennale.
- **Clients cités** (décision client du 01/10/2026, sans accord préalable ; retrait sur simple demande d'un client) : EPC Travaux, Villas Bois Provence, Altea, Mairie d’Aix-en-Provence. Ligne texte « Ils nous ont confié des chantiers », sans logo, sous les projets de la page Professionnels.

### 3.12 Page Fenêtres et portes-fenêtres (02/10/2026, intégrée au site)

- **Fabricants par matériau (confirmés)** : Aluminium = Laloi, Noralis, Novelis, **K-Line** · PVC = Noralis, Novelis · Bois = **Molenat**, Menuiseries Combes. Bandeau des fabricants du site mis à jour (ajout K-Line, Molenat).
- Les trois matériaux sont posés **chez les particuliers comme en collectif** ; le PVC est posé **en blanc**.
- Le tableau de performances vide est **remplacé par un comparatif PVC / Aluminium / Bois** (ton premium : « Trois matériaux, une même exigence de pose »), sans dévaloriser le PVC, sans promesse technique non validée. Ne **pas** écrire « seul matériau autorisé en secteur sauvegardé ».
- Mention : « Sur demande, nous vous fournissons la fiche technique du produit lors du devis » (pas d'envoi automatique).
- FAQ secteur sauvegardé : « Oui, régulièrement. Nous sommes habitués à travailler dans le centre historique d'Aix-en-Provence… » (sans préciser le matériau).
- Les autres pages produit gardent provisoirement l'ancien tableau, à traiter page par page.

### 3.13 Chiffres : une seule page par type d'information (02/10/2026)

- **Accueil uniquement** : chiffres d'activité (2005 · 82 chantiers en 2025 · 1 027 fenêtres en 2025 · baie 7,80 m SP10).
- **Professionnels** : engagements (48 h première réponse · 5 à 8 sem. de fabrication · 0 sous-traitance · 1 seul interlocuteur). Version « références de capacité » refusée par le client.
- **L'entreprise** : date de création 2005 · région d'intervention Provence-Alpes-Côte d'Azur · capital social 100 000 € (SAS) · atelier à Aix-en-Provence. « 28 rénovations en 2025 » retiré du site.

### 3.14 Page Baies vitrées et coulissants (02/10/2026, intégrée au site)

- Baies **en aluminium** (Laloi · Noralis · Novelis · K-Line) ; gamme bois possible **sur demande, rare**.
- **Pas de motorisation** des baies (ne pas la mentionner). **Seuil encastré** possible.
- Tableau de performances remplacé par « Les grandes ouvertures, notre spécialité » : 7,80 m (villa aux 31 menuiseries) · 6 m (Résidence Sindona) · sans poteau (villa contemporaine, Céreste) ; chaque colonne renvoie au chantier.
- FAQ ajoutée : levage des vitrages lourds (mini-grue, nos propres équipes).
- Pied de page : lien « Nos avis Google » branché sur la fiche (kgmid=/g/1tjbbcnd).

### 3.15 Page Portes d'entrée (02/10/2026, intégrée au site)

- Matériaux : aluminium, bois, acier. **Jamais de porte d'entrée en PVC** ; portes de service PVC possibles (FAQ uniquement).
- Fabricants : Porte Gervais · Portes-EO · Zilten · Tordjman Métal · Technicdoor (orthographes confirmées) + fabrication atelier.
- Délais : 5 à 12 semaines. **Aucune mention de certification** (A2P, etc.).
- Section « chiffres » refusée par le client (pas pertinente) → remplacée par **« La porte qui signe votre façade »** : 3 photos d'exemples (Aluminium et frêne · **Sur pivot** · Acier vitrée) + carte « Et bien d'autres modèles » qui précise qu'il s'agit d'exemples parmi un large catalogue → lien devis.
- **Haut de page (demande client)** : pas de bandeau photo (le bandeau deux photos a été jugé « très moche ») ; la galerie de portes est placée directement sous le titre, **porte acier vitrée en premier**. Section « Nos réalisations / Posées par nos équipes » **supprimée sur cette page** (doublon avec la galerie, qui renvoie déjà aux chantiers). Photo de la famille Portes (accueil / Menuiseries) : porte acier vitrée, cadrée sur la porte.
- Photos à améliorer quand possible : porte sur pivot finie (actuelle prise en chantier), gros plan porte frêne, portes Gervais de Fos.
- Lien d'aperçu renouvelé le 02/10/2026 (l'ancien a expiré).

### 3.16 Page Volets (02/10/2026, intégrée au site)

- **Pas de volets en PVC.** Roulants motorisés **ou solaires** ; battants et persiennes bois ou alu ; coffres sur mesure faits à l'atelier.
- **Ne pas écrire « coffres jusqu'à 6 m »**, seulement « coffres sur mesure » (05/10/2026, retiré partout : Volets, accueil, entreprise). Le 6 m reste uniquement dans la fiche du chantier Sindona (fait réel).
- Fabricants : volets roulants **Futurol · Sothoferm · David Fermeture** ; volets bois **France Volet** (ajoutés au bandeau du site).
- Délais 5 à 8 semaines (confirmé).
- Photo fournie par le client (persiennes bois, façade provençale, média ID 202, copie dans `photos/`) : grand visuel + 1er exemple.
- Tableau vide remplacé par la galerie « Des volets assortis à votre façade » (voir mise à jour du 05/10 ci-dessous).
- FAQ ajoutée : volets roulants solaires, volets assortis aux fenêtres.
- Photo persiennes **retouchée** (lumière, couleurs, netteté, rien d'ajouté ; média ID 204).
- 05/10/2026 : **galerie limitée à 2 catégories** : **Volet battant** (photo persiennes) et **Volet roulant** + carte « Et bien d'autres modèles » (3 colonnes). « Battants bois laqués » (Fos) retiré.
- Volet roulant : la photo envoyée (375 px, média ID 203) était trop floue → remplacée (voir ligne suivante).
- Réalisations de la page : « Maison provençale » retirée (aucun volet visible) et villa contemporaine de Céreste non plus (pas de volet visible) ni la villa dans la roche → **règle : sur la page Volets, n'afficher que des photos où un volet roulant ou battant est visible**. Réalisations limitées à 2 (Fos 12 logements, photo des battants verts ; Résidence Sindona), affichées sur 2 colonnes ; « volets » retiré des produits des trois maisons. Carte « Volet roulant » : Sindona jugée floue et mal cadrée → **photo d'illustration Unsplash** (Dominik Puskas, volet roulant anthracite, média ID 205, copie `photos/volet-roulant-illustration.jpg`), légendée « Photo d'illustration · D. Puskas / Unsplash ». À remplacer par une photo nette d'un chantier dès que le client en fournit une. Texte d'intro : « Deux grandes familles de volets. » Baies : la mention « volets roulants assortis » de Céreste est retirée.

### 3.17 Page Portes de garage (05/10/2026, intégrée au site)

- **Uniquement de l'aluminium** (pas d'acier). Enroulables (lames 77 mm), sectionnelles, battantes. Basculantes / latérales : ne pas les mentionner.
- Motorisation très fréquente, à la demande ; les sectionnelles peuvent rester manuelles.
- Fabricants : **France Volet · Futurol · Hörmann**, et d'autres selon le projet (Technicdoor / La Toulousaine retirés de cette page).
- Délais 5 à 8 semaines. Grandes largeurs, remplacement, portes de parking collectif.
- Tableau « Les données, pas des adjectifs » (client « pas fan ») remplacé par la galerie « Trois façons d'ouvrir votre garage » : Enroulable · Sectionnelle · Battante, visuels dessinés avec badge **« En chantier »** (« Nos chantiers sont en cours : les photos arrivent bientôt. ») + carte « Et bien d'autres modèles » (grandes largeurs, parking collectif, remplacement). À remplacer par les photos des chantiers en cours.
- FAQ : assortie aux fenêtres, motorisation, remplacement, parking collectif, délais.
- Grand visuel (en-tête) : porte de garage de la Maison provençale, conservé.
- **Section « Nos réalisations » retirée** de la page (05/10/2026) : aucune photo de réalisation hormis l'en-tête, à ajouter plus tard avec de plus belles photos.
- **Section « Les solutions possibles » retirée** aussi (05/10/2026) : la galerie « Trois façons d'ouvrir votre garage » présente déjà les types.

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

- [ ] **Plateforme** : nouveau site WordPress 7.1 sur Hostinger (https://menuiseriedespennes-fr-888371.hostingersite.com), quasi vide au 30/09/2026, thème « Hostinger AI theme ». Choix du thème / constructeur à trancher à l'étape développement. **Indexation du site de travail désactivée le 30/09/2026** (blog_public = 0, accord du client).
- [ ] **⚠ AU LANCEMENT : RÉACTIVER L'INDEXATION** (Réglages → Lecture, ou blog_public = 1) — demande explicite du client de ne pas l'oublier.

- [ ] Confirmation écrite du référencement patrimoine (Atelier du Patrimoine, Ville d'Aix).
- [ ] Harmoniser nom / adresse / téléphone / activité sur Google et les annuaires (PagesJaunes décrit du mobilier et de l'agencement intérieur).
- [ ] À rediscuter : l'extension « page locale Aix » (l'adresse étant à Aix, l'accueil et la fiche Google couvrent déjà Aix — risque de doublon).

- [ ] **Inventaire des chantiers** (version provisoire : [`INVENTAIRE-REALISATIONS.md`](./INVENTAIRE-REALISATIONS.md), 9 chantiers) des 2-3 dernières années (commune, produit, type de client) — à redemander au client ; conditionne pages locales et projets détaillés.
- [ ] Marques et gammes posées, statut de partenariat.
- [ ] Contenu du site actuel (non consultable depuis l'environnement de travail) — à fournir par copier-coller si besoin.

## 6. Prochaine étape proposée
Recueillir les réglages du client sur le prototype, puis textes définitifs page par page.
