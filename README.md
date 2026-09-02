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
- **Import** : dépôt d'un PDF (glisser-déposer ou sélection). Le PDF original est
  conservé et consultable depuis la fiche. *(L'analyse automatique OCR/IA n'est pas
  encore branchée : les informations sont à saisir/vérifier à la main.)*
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
npm run db:migrate        # crée la base de données
npm run db:seed           # ajoute des factures fictives pour tester
```

## Lancer l'application

```bash
npm run dev
```

Puis ouvrir **http://localhost:3000**.

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run dev` | Lance l'application en mode développement |
| `npm run build` / `npm start` | Version optimisée |
| `npm test` | Lance les tests |
| `npm run db:studio` | Ouvre une interface pour voir/éditer la base |
| `npm run db:seed` | Recharge les données fictives |
| `npm run db:migrate` | Applique un changement de structure de la base |

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
    parsing/           Interface d'analyse des factures (OCR/IA plus tard)
    export/            Export Excel (d'autres formats possibles à côté)
```

**Les règles fiscales sont regroupées dans `src/lib/tva/rules.ts`** : taux de TVA,
sens collecté/déductible, calcul de la TVA nette. C'est le seul endroit à modifier
si la réglementation change.

## Sécurité

- Aucune clé secrète dans le code : tout passe par le fichier `.env` (non versionné).
- Les PDF de factures (`uploads/`) et la base de données ne sont pas versionnés.
- L'architecture prévoit l'ajout ultérieur de : authentification, comptes
  utilisateurs, permissions, chiffrement, sauvegardes, journalisation complète.

## Prochaines étapes possibles

1. Modification manuelle des factures depuis la fiche (+ journal des modifications).
2. Validation manuelle d'une facture (bouton « Valider »).
3. Branchement d'une vraie analyse automatique (OCR / IA) via `src/lib/parsing/`.
4. Saisie manuelle d'une facture sans PDF.
