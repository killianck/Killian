# Facturation & TVA

Logiciel de suivi des factures et de calcul de TVA pour une petite entreprise française.

> ⚠️ **Outil de suivi uniquement.** Les montants de TVA affichés sont des estimations
> destinées au pilotage de l'entreprise. Ce logiciel ne remplace pas un expert-comptable
> et ne produit pas de déclaration fiscale officielle.

---

## Ce que fait l'application aujourd'hui

- **Tableau de bord** : TVA collectée / déductible / nette du mois et de l'année,
  nombre de factures, totaux HT/TTC, graphique mensuel, prochaines échéances.
- **Factures** : liste complète avec recherche, filtres (mois, année, achat/vente,
  type, catégorie, taux de TVA) et tri (date, montant). Fiche détaillée par facture.
- **Import + analyse automatique** : dépôt d'**un ou plusieurs** PDF (glisser-déposer
  ou sélection). Le logiciel lit le texte de chaque PDF et repère montants (HT/TVA/TTC),
  taux, dates de facture et d'échéance, numéro, SIRET, TVA intracom, fournisseur. Le
  PDF original est conservé. Bouton **« Ré-analyser »** pour relancer l'analyse.
  *(Fonctionne sur les PDF « texte » ; un PDF scanné/image demande une saisie manuelle.)*
- **Saisie manuelle / modification / suppression** : créer une facture sans PDF,
  corriger toutes les valeurs (bouton « Modifier »), supprimer (le PDF part en
  corbeille). Chaque changement est journalisé. Validation manuelle d'une facture.
- **TVA d'achat non récupérable** : case à décocher sur une facture d'achat pour
  l'exclure du calcul de la TVA déductible.
- **Détection de doublons** : alerte si deux factures ont le même numéro + tiers.
- **Sauvegarde** : automatique une fois par jour + bouton manuel dans Paramètres
  (base + PDF copiés dans `data/sauvegardes/`, 30 dernières conservées).
- **Contrôles automatiques** : vérification que HT + TVA = TTC, cohérence des lignes
  de TVA, détection des taux non standard. Chaque facture a un niveau de cohérence
  (cohérent / à vérifier / incorrect).
- **Échéances** : vue triée par date d'échéance, avec filtres (mois en cours, mois
  suivant, période personnalisée, année). Information seule — aucun suivi de paiement.
- **TVA** : vue mensuelle (tableau + liste des factures) et vue annuelle (12 mois + total).
- **Rapports** : export Excel (.xlsx) des factures, synthèse pluriannuelle.
- **Paramètres** : taux de TVA gérés, catégories, moteur d'analyse.

## Stack technique (choisie pour la simplicité et l'évolutivité)

| Besoin | Choix | Pourquoi |
| --- | --- | --- |
| Application web (interface + serveur) | **Next.js** (React, TypeScript) | Un seul langage, un seul outil pour tout. Très documenté. |
| Base de données | **SQLite** via **Prisma** | Vraie base de données dans un simple fichier. Passage à PostgreSQL trivial plus tard (SaaS). |
| Style | **Tailwind CSS** | Interface moderne sans usine à gaz. |
| Graphiques | **Recharts** | Simple, adapté à React. |
| Export Excel | **ExcelJS** | Standard, sans dépendance lourde. |
| Tests | **Vitest** | Rapide, syntaxe simple. |

## Prérequis

- [Node.js](https://nodejs.org/) version 20 ou plus (installé : v24).

## Installation

```bash
npm install
cp .env.example .env      # sous Windows PowerShell : copy .env.example .env
npm run setup             # crée la base de données dans data/
npm run db:seed           # ajoute des factures fictives pour tester
```

## Lancer l'application

```bash
npm run dev
```

Puis ouvrir **http://localhost:3000**. Compte de démonstration (après `db:seed`) :
**admin / motdepasse**. Au tout premier lancement d'une base vide, l'application
propose de créer le premier compte.

## Où sont mes données ?

Tout ce qui vous appartient est dans le dossier **`data/`** (à la racine du projet) :
la base de données, les PDF des factures, les sauvegardes. Ce dossier est **séparé
du code** : mettre à jour le logiciel n'y touche jamais. Voir
[`ARCHITECTURE.md`](ARCHITECTURE.md) pour les détails.

Sauvegarde manuelle :

```bash
npm run backup
```

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run dev` | Lance l'application en mode développement (navigateur) |
| `npm run app:dev` | Lance l'application dans une fenêtre (Electron) |
| `npm run app:dist` | Génère l'installeur Windows → `dist-app/…Setup….exe` |
| `npm test` | Lance les tests |
| `npm run backup` | Sauvegarde la base + les PDF dans `data/sauvegardes/` |
| `npm run db:studio` | Ouvre une interface pour voir/éditer la base |
| `npm run db:seed` | Recharge les données fictives |
| `npm run db:migrate` | Crée une migration après un changement de `schema.prisma` |
| `npm run db:deploy` | Applique les migrations existantes (nouvelle version) |

## Organisation du code

```
prisma/
  schema.prisma        Structure de la base de données
  seed.ts              Données fictives
src/
  app/                 Les pages (une par dossier) + routes API
  components/          Éléments d'interface réutilisables
  lib/
    domain/enums.ts    Types, statuts, catégories (extensibles)
    format.ts          Dates JJ/MM/AAAA et montants « 1 250,00 € »
    tva/
      rules.ts         ⚠️ RÈGLES FISCALES FRANÇAISES — zone isolée
      coherence.ts     Contrôles mathématiques des montants
      aggregate.ts     Totaux mensuels et annuels
    paths.ts           Emplacement des données (séparées du code)
    parsing/           Analyse des PDF : lecture du texte + heuristiques
                       (extract.ts). Extensible vers un service OCR/IA.
    export/            Export Excel (d'autres formats possibles à côté)
```

**Les règles fiscales sont regroupées dans `src/lib/tva/rules.ts`** : taux de TVA,
sens collecté/déductible, calcul de la TVA nette. C'est le seul endroit à modifier
si la réglementation change.

## Sécurité

- Aucune clé secrète dans le code : tout passe par le fichier `.env` (non versionné).
- Le dossier `data/` (PDF de factures + base de données) n'est jamais versionné.
- L'architecture prévoit l'ajout ultérieur de : authentification, comptes
  utilisateurs, permissions, chiffrement, sauvegardes, journalisation complète.

## Prochaines étapes possibles

- ✅ Navigation entre les mois sur le tableau de bord
- ✅ Modification manuelle des factures + journal des modifications
- ✅ Validation manuelle d'une facture
- ✅ Analyse automatique des PDF « texte » (montants, dates, numéro, SIRET…)
- ✅ Import de plusieurs PDF à la fois
- ✅ Saisie manuelle + suppression + détection de doublon
- ✅ TVA d'achat non récupérable
- ✅ Sauvegarde automatique quotidienne + bouton manuel
- ✅ Fiches Tiers réutilisables (fournisseurs / clients)
- ✅ Application Windows double-cliquable (`npm run app:dist`, voir `ARCHITECTURE.md`)
- ✅ Comptes utilisateurs, rôles, permissions
- ✅ Chiffrement des données au repos (application installée)
- OCR pour les PDF scannés (images) — service externe à brancher dans `src/lib/parsing/`
- Mises à jour automatiques de l'application (electron-updater)
- Exports comptables (FEC…)
