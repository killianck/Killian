# Audit SEO et structure — Menuiserie des Pennes (05/10/2026)

> Site audité : l'aperçu du nouveau thème (WordPress 7.1.2, AIOSEO 5.0.2, LiteSpeed). 25 adresses analysées une par une (titres, descriptions, Hn, images, liens, données structurées), robots.txt et plan du site, ancien site www.menuiseriedespennes.fr, et 2 audits Google Lighthouse (accueil et réalisations, mobile).
> Le site n'est **pas encore en ligne** : l'indexation est volontairement bloquée. Plusieurs points ci-dessous se règlent donc au lancement.

## 1. Synthèse

| Domaine | Note | En bref |
|---|---|---|
| Contenu et balises (titres, descriptions, H1) | 🟢 Bon | 1 H1 par page, titres et descriptions rédigés à la main, uniques |
| Données structurées | 🟢 Très bon | Entreprise locale complète (adresse, horaires, zone, fiche Google), Service par produit, CreativeWork par réalisation, fil d'Ariane |
| Structure et maillage | 🟢 Bon | 1 page par famille, 10 réalisations reliées aux produits, filtres |
| Performance (Lighthouse mobile) | 🟡 88-89/100 | LCP 3,0-3,3 s ; **images PNG très lourdes** |
| Accessibilité | 🟡 90-91/100 | contraste, ordre des titres, éléments masqués focusables |
| Bonnes pratiques | 🟢 100/100 | — |
| SEO Lighthouse | 🔴 69/100 | **uniquement** parce que l'indexation est bloquée (voulu avant lancement) |
| Préparation du lancement | 🟠 À faire | canonicals, plan du site, robots.txt, redirections, domaine www |

## 2. Corrigé pendant l'audit

- **Titres Google perdus** sur Baies vitrées et Volets (ils affichaient « Privé : … ») : rétablis.
- **Description Google** de la Villa des galandages (affichait un texte technique) : réécrite.
- **Appartement Joliette** sans page SEO (pas de titre, de description, ni de balise noindex) : page créée (ID 212) et renseignée.
- **4 images sans texte alternatif** sur la page Professionnels : corrigé.
- Villa dans la roche reclassée en **neuf** (filtre Réalisations).

## 3. Bloquant au lancement (à faire le jour J, dans cet ordre)

1. **Sauvegarde complète** du site, puis publication du thème (accord écrit du client).
2. **Publier les 23 pages privées** (IDs 177 à 198 et 212). Tant qu'elles sont privées :
   - les **balises canoniques** pointent vers `?page_id=…` au lieu des vraies adresses ;
   - le **fil d'Ariane** et certains titres contiennent « Privé : » ;
   - le **plan du site** ne contient aucune page.
   → Après publication, revérifier les 3 points sur 3 pages.
3. **Réactiver l'indexation** (Réglages › Lecture). Vérifier ensuite **robots.txt** : il contient aujourd'hui `User-agent: Googlebot / Disallow: /`, qui bloque Google même si le reste est autorisé.
4. **Domaine** : l'ancien site répond sur **www.menuiseriedespennes.fr** ; `https://menuiseriedespennes.fr` (sans www) ne répond pas. Choisir une seule version, rediriger l'autre en 301, et aligner l'adresse WordPress.
5. **Redirections 301** de l'ancien site (13 pages, plan dans PLAN-SEO.md §3) et **410** pour les **14 produits de démonstration** encore déclarés dans le plan du site actuel (casquette, sérum, chaise, guide post-partum…).
6. Mettre « Accueil (nouveau site) » en page d'accueil, **purger le cache LiteSpeed**, supprimer la demande de test (ID 200).
7. **Search Console** : déclarer le domaine, envoyer `sitemap.xml`, demander l'indexation des pages clés.

## 4. Priorité haute (avant ou juste après le lancement)

- **Poids des images** : les photos sont en PNG de 0,8 à 2 Mo (ex. villa de nuit 2 Mo, Sindona 1,1 Mo). L'accueil charge environ 15 Mo d'images. → Convertir en **WebP/JPEG** (optimisation d'images LiteSpeed ou Hostinger) : gain attendu 70 à 80 %, LCP sous 2,5 s.
- **Scripts inutiles chargés sur toutes les pages** :
  - Tailwind (CDN jsdelivr), ajouté par l'extension WPVibe, alors que le thème a sa propre feuille de style ;
  - Hostinger Reach (`embed.js`), outil d'e-mailing non utilisé ;
  - Google Fonts chargées depuis Google (question RGPD) → les héberger sur le site.
- **Extensions inutiles** à désactiver après lancement : WPForms Lite (les formulaires sont gérés par le thème), Hostinger Reach, Hostinger AI Assistant. Garder : AIOSEO, LiteSpeed, Akismet, Site Kit (pour Search Console / Analytics).
- **Mentions légales** : la page actuelle est celle de l'ancien site (titre « Legal », 2 H1, description de 459 caractères). → Page à créer (prévue).
- **Page 404** : texte en anglais (« We can't find that page »). → La traduire et l'habiller au style du site.
- **Descriptions Google à mettre à jour** avec les décisions récentes :
  - Portails : dit « aluminium ou verre » → **aluminium ou acier, garde-corps vitrés** ;
  - Portes d'entrée : dit « blindées, connectées » → à valider ;
  - Portes de garage : préciser **aluminium** ;
  - Maison provençale : mentionne des volets roulants Futurol, alors qu'aucun volet n'est visible.

## 5. Priorité moyenne (contenu)

- **Titres trop longs** (> 60 caractères, coupés par Google) : Villa contemporaine (72), Accueil (65), Villa dans la roche (64), Maison provençale (64).
- **Pages de réalisation courtes** (~200 mots) : ajouter 2 ou 3 phrases sur le déroulé du chantier et compléter commune et année quand c'est possible.
- **Contact et Devis** : très peu de texte (91 et 228 mots), aucun H2 → à traiter demain avec ces pages.
- **Encadrés « à fournir » encore visibles** :
  - accueil : « reconnaissance patrimoine d'Aix, après confirmation écrite » (en attente de la réponse de l'Atelier du Patrimoine) ;
  - contact : emplacement de la carte.
- **Accessibilité** :
  - contraste de certains petits textes gris ;
  - ordre des titres (un H3 sans H2 avant) ;
  - éléments masqués qui restent focusables au clavier.
- **E-mail affiché** : mdp13@hotmail.fr partout. Pour l'image de marque, envisager **contact@menuiseriedespennes.fr**, qui est déjà transféré vers Hotmail.

## 6. Ce qui est déjà solide

- Titres et descriptions **uniques et ciblés** par page (menuiserie extérieure + Aix-en-Provence), un seul H1 partout.
- **Données structurées** riches et sans erreur : HomeAndConstructionBusiness (adresse, horaires 7 h 30-18 h, zone Aix / Marseille / 13, fiche Google), Service sur les 7 familles, CreativeWork sur les réalisations, BreadcrumbList.
- **Toutes les images** ont un texte alternatif, un chargement différé et des tailles adaptées (srcset).
- **Structure claire** : Accueil › Menuiseries (7 familles) › Réalisations (10 chantiers, filtres type / neuf-rénovation / produit) › Professionnels › Entreprise › Contact / Devis.
- **Temps de réponse serveur** correct (0,5 à 1,5 s sans cache ; cache LiteSpeed actif en production).
- **Aucune erreur console**, Bonnes pratiques Lighthouse 100/100, aucun décalage de mise en page (CLS 0).

## 7. Après le lancement (SEO local)

- Fiche Google : catégorie, photos réelles, lien vers le site, **campagne d'avis** (objectif > 21 avis à ≥ 4,8 ; aujourd'hui 9 à 4,2).
- Mêmes nom, adresse et téléphone partout (PagesJaunes décrit encore du mobilier intérieur).
- Suivi mensuel dans Search Console : pages indexées, requêtes, erreurs.
