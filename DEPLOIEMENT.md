# Publier des mises à jour de l'application

L'application installée vérifie au démarrage s'il existe une version plus récente,
la télécharge, et propose « Redémarrer maintenant ». Les données de l'utilisateur
ne sont jamais touchées.

Pour que ça marche, les nouvelles versions doivent être **publiées quelque part**.
On utilise **GitHub Releases** (gratuit).

---

## 1. Préparation (une seule fois)

1. Créez un compte sur **https://github.com** (gratuit).
2. Créez un dépôt (bouton **New repository**) nommé `facturation-tva`
   (case **Private** cochée si vous voulez le garder privé).
3. Dans `package.json`, remplacez l'adresse du dépôt par la vôtre :

   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/VOTRE-COMPTE/facturation-tva.git"
   }
   ```

4. Envoyez le code sur GitHub (depuis le dossier du projet) :

   ```bash
   git remote add origin https://github.com/VOTRE-COMPTE/facturation-tva.git
   git push -u origin main
   ```

5. Créez un **jeton d'accès** : GitHub → Settings → Developer settings →
   **Personal access tokens** → *Tokens (classic)* → **Generate new token**.
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
