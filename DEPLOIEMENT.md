# Publier des mises à jour de l'application

L'application installée vérifie au démarrage s'il existe une version plus récente,
la télécharge, et propose « Redémarrer maintenant ». Les données de l'utilisateur
ne sont jamais touchées.

Pour que ça marche, les nouvelles versions doivent être **publiées quelque part**.
On utilise **GitHub Releases** (gratuit).

---

## 1. Préparation (une seule fois)

Dépôt utilisé : **https://github.com/killianck/Killian** (déjà branché dans le
projet et dans `package.json`).

1. **Rendez le dépôt public.** Pour que la mise à jour automatique fonctionne
   simplement, les *Releases* doivent être accessibles sans jeton. Sur GitHub :
   dépôt → **Settings** → tout en bas, **Change repository visibility** →
   **Public**. (L'installeur ne contient aucune donnée — juste le programme.)
   *Si vous tenez à garder le code privé : dites-le moi, on publiera les versions
   ailleurs.*

2. Envoyez le code sur GitHub (depuis le dossier du projet) :

   ```bash
   git push -u origin main
   ```

   Une fenêtre GitHub s'ouvre → **Authorize**. C'est fait.

3. Créez un **jeton d'accès** (pour publier les versions) :
   GitHub → photo de profil → **Settings** → **Developer settings** →
   **Personal access tokens** → *Tokens (classic)* → **Generate new token (classic)**.
   Cochez la permission **`repo`**. Copiez le jeton (il ne s'affiche qu'une fois).

---

## 2. Publier une nouvelle version

À chaque fois que vous voulez diffuser une mise à jour :

```bash
npm test
npm version patch          # 0.2.0 -> 0.2.1 (crée aussi un commit + un tag)
git push --follow-tags

# Windows PowerShell :
$env:GH_TOKEN = "votre-jeton"
npm run app:release
```

Cela génère l'installeur et le publie automatiquement sur la page **Releases**
de votre dépôt GitHub.

> `npm version minor` pour 0.2.0 → 0.3.0, `npm version major` pour 1.0.0.

---

## 3. Ce que voient les utilisateurs

- Au lancement suivant, l'application détecte la nouvelle version, la télécharge
  en arrière-plan, puis affiche : **« La version X est prête. Redémarrer maintenant ? »**
- S'ils cliquent « Redémarrer », l'application se met à jour et rouvre.
- S'ils cliquent « Plus tard », la mise à jour s'installera au prochain
  redémarrage.

---

## 4. Mot de passe administrateur perdu

Sur la machine où vous avez le code :

```bash
npm run auth:reset -- <nom-utilisateur>
```

Cela affiche un nouveau mot de passe temporaire. À changer après connexion.

Pour l'application installée, la base est dans
`%APPDATA%\facturation-tva\facturation.db`. Si le chiffrement est activé, cette
base n'est lisible que par l'application : gardez impérativement le mot de passe
administrateur en lieu sûr, ou créez toujours **deux** comptes administrateur.
