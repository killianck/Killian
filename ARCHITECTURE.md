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
3. npm run build   (l'application se compile)
4. commit + tag de version (ex. v0.2.0)
5. Génération de l'installeur Windows      ← étape à mettre en place (voir §6)
6. L'utilisateur installe la nouvelle version ; ses données sont conservées
```

**Règle :** une IA ne modifie jamais directement l'application installée ni les
données de production. Toute évolution passe par le code source → tests → nouvelle
version.

---

## 6. Cible : application Windows double-cliquable (à faire)

Aujourd'hui, l'application se lance avec `npm run dev`. L'objectif final est une
**icône sur le bureau** → double-clic → l'application s'ouvre, sans terminal.

Plan prévu (tâche à part entière, à faire quand les fonctionnalités seront stables) :

1. **Empaqueter** l'application Next.js dans une application de bureau
   (piste recommandée : **Tauri** — léger — ou **Electron** — plus simple à mettre
   en place). Le programme embarque Node et sert l'app en local.
2. **Au démarrage**, l'app :
   - définit `APP_DATA_DIR` vers `%APPDATA%\FacturationTVA`,
   - crée le dossier si absent, applique les migrations (`db:deploy`),
   - fait une sauvegarde,
   - ouvre la fenêtre.
3. **Installeur** (`.msi` / `.exe`) généré automatiquement à partir du code, avec
   création du raccourci bureau.
4. **Mises à jour** (plus tard) : vérification d'une nouvelle version au démarrage,
   téléchargement, installation au prochain lancement — jamais en silence, toujours
   avec l'accord de l'utilisateur.

Rien dans le code actuel n'empêche cette évolution : c'est pour cela que les données
sont déjà séparées et que les chemins sont centralisés.

---

## 7. Sécurité (rappel)

- Aucune clé secrète dans le code : variables d'environnement (`.env`, non versionné).
- Le dossier `data/` (base + PDF) n'est jamais envoyé sur Git.
- Prévu plus tard : authentification, comptes, permissions, chiffrement du dossier
  de données, journalisation complète des modifications.
