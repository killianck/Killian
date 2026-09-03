# Architecture & évolution du projet

Ce document explique comment le projet est organisé pour rester **maintenable dans
la durée** et pouvoir devenir une **application Windows installable**, tout en
restant modifiable par Claude Code.

---

## 1. Deux choses bien séparées

| | Où | Contient | Versionné dans Git ? |
| --- | --- | --- | --- |
| **Le code source** | ce dépôt (`src/`, `prisma/`, …) | le programme, modifiable par Claude Code | ✅ oui |
| **Les données utilisateur** | dossier `data/` (voir §2) | base de données, PDF des factures, sauvegardes | ❌ non |

**Conséquence importante :** installer une nouvelle version du logiciel remplace le
programme mais **ne touche jamais au dossier `data/`**. Les factures et la base sont
donc conservées d'une version à l'autre.

---

## 2. Emplacement des données (`src/lib/paths.ts`)

Un seul fichier décide où sont les données :

- **En développement** : `<projet>/data/`
  - `data/facturation.db` — base SQLite
  - `data/factures-pdf/` — PDF originaux des factures
  - `data/sauvegardes/` — sauvegardes automatiques
- **Application installée** : la variable d'environnement `APP_DATA_DIR` pointe vers
  le dossier de données Windows de l'utilisateur, p. ex.
  `C:\Users\<nom>\AppData\Roaming\FacturationTVA\`.

Rien d'autre dans le code ne connaît ces chemins : tout passe par `paths.ts`.

---

## 3. Sauvegardes

```bash
npm run backup
```

Copie la base + les PDF dans `data/sauvegardes/sauvegarde-AAAA-MM-JJ_HHhMM/`.
Les 30 sauvegardes les plus récentes sont conservées.

**À prévoir plus tard :** lancer `npm run backup` automatiquement (au démarrage de
l'app, et/ou une fois par jour), et proposer un bouton « Sauvegarder maintenant »
dans les Paramètres.

---

## 4. Changements de structure de la base

La structure est décrite dans `prisma/schema.prisma`. Chaque modification crée une
**migration** (un fichier dans `prisma/migrations/`), qui est versionnée dans Git.

- En développement : `npm run db:migrate`
- Sur l'application installée : `npm run db:deploy` (applique les migrations
  existantes sans rien demander) — à exécuter automatiquement au premier démarrage
  d'une nouvelle version.

Les migrations **n'effacent pas les données** : elles font évoluer les tables.

---

## 5. Passer d'une modification de code à une nouvelle version

Processus cible :

```
1. Claude Code modifie le code source (nouvelle branche Git)
2. npm test        (les tests passent)
3. npm run app:dist   (compile + génère l'installeur Windows)
4. commit + tag de version (ex. v0.2.0)
5. L'utilisateur lance l'installeur ; ses données (%APPDATA%) sont conservées
```

---

## 6. Application Windows double-cliquable ✅

L'application est empaquetée avec **Electron** + **electron-builder**.

- `electron/main.js` : processus principal. En production il
  1. définit `APP_DATA_DIR` = `%APPDATA%\facturation-tva` et `DATABASE_URL`,
  2. applique les migrations en attente (`src/lib/migrate.ts`, via `node:sqlite`,
     sans le CLI Prisma),
  3. démarre le serveur Next embarqué (`.next/standalone`),
  4. ouvre la fenêtre sur ce serveur local.
- La sauvegarde automatique quotidienne se déclenche comme d'habitude.
- `npm run app:build` : `next build` (mode `standalone`) + `scripts/prepare-standalone.mjs`.
- `npm run app:dist` : produit `dist-app/Facturation & TVA Setup <version>.exe`
  (installeur NSIS, raccourci bureau + menu Démarrer).
- `npm run app:dev` : lance `next dev` + une fenêtre Electron dessus.

**Génération d'une nouvelle version :** `npm test` → `npm run app:dist` → distribuer
le `.exe`. L'utilisateur l'installe ; le dossier `%APPDATA%\facturation-tva`
(base + PDF + sauvegardes) n'est jamais touché, et les migrations éventuelles
s'appliquent au premier lancement de la nouvelle version.

**Mises à jour automatiques (electron-updater) :** au démarrage, l'app vérifie
les *GitHub Releases* du dépôt (`repository` dans `package.json`), télécharge la
nouvelle version et propose « Redémarrer maintenant » (jamais en silence). Le
re-chiffrement des données a lieu avant l'installation. Publication :
`npm run app:release` (voir `DEPLOIEMENT.md`). Tant que le dépôt n'est pas
configuré, la vérification est simplement ignorée.

**À compléter plus tard :** une icône personnalisée (`build/icon.ico`, 256×256 min).

**Règle :** une IA ne modifie jamais directement l'application installée ni les
données de production. Toute évolution passe par le code source → tests → nouvelle
version.

---

## 7. Lecture automatique des PDF (`src/lib/parsing/`)

Deux sources de texte, essayées dans cet ordre :

1. **Texte intégré au PDF** (`pdfText.ts`, via `unpdf`) — rapide, fiable. Suffit
   pour les factures générées par un logiciel.
2. **OCR** (`ocr.ts`) si le PDF est un **scan** (image sans texte) ou si l'analyse
   du texte est trop incomplète : `mupdf` transforme chaque page en image (il gère
   la compression JBIG2 des scanners), puis `tesseract.js` reconnaît le texte en
   français. Plus lent (~3 s/page), résultat à vérifier.

`extract.ts` applique ensuite des règles (montants HT/TVA/TTC, dates, numéro,
SIRET…) sur ce texte. Il sait notamment :
- écarter les mentions légales de bas de page (`loi n°…`, pénalités, tribunal…) ;
- reconstituer un triplet (HT, TVA, TTC) cohérent quand les totaux sont dans un
  tableau (libellés et valeurs sur des lignes séparées) ;
- lire un numéro de facture placé sur la ligne suivant « Facture N° ».

Données de langue OCR : `src/lib/parsing/tessdata/fra.traineddata.gz` (embarqué,
fonctionne hors ligne). Copié dans `standalone/tessdata` par
`prepare-standalone.mjs`. `mupdf` / `tesseract.js` sont déclarés
`serverExternalPackages` dans `next.config.ts` (fichiers WASM + worker).

Le résultat de l'analyse **n'est jamais validé automatiquement** : la facture
arrive au statut « à vérifier » et l'utilisateur confirme.

---

## 8. Sécurité

- Aucune clé secrète dans le code : variables d'environnement (`.env`, non versionné).
- Le dossier `data/` (base + PDF) n'est jamais envoyé sur Git.
- **Connexion par compte** (`src/lib/auth`, `src/proxy.ts`) : mots de passe hachés
  (scrypt), session par cookie signé, rôles administrateur / utilisateur.
- **Permissions** : la suppression de factures et de tiers est réservée aux
  administrateurs (garde côté serveur).
- **Journal des modifications** : chaque changement enregistre le nom de l'utilisateur.
- **Chiffrement au repos** (application installée) : la base, les PDF et les
  sauvegardes sont chiffrés (AES-256-GCM) quand l'application est fermée. La clé
  est protégée par le compte Windows (`safeStorage` / DPAPI). Activable dans
  Paramètres. Recommandation complémentaire : BitLocker.
- **À ajouter plus tard** : verrouillage automatique après inactivité, base
  chiffrée en continu (SQLCipher via un *driver adapter* Prisma).
