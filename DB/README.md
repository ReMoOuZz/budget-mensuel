# Budgify API

Backend Express + Prisma destiné à remplacer le `localStorage` du front.

## Installation locale

```bash
cd DB
cp .env.example .env
# Renseigner DATABASE_URL vers votre Postgres local (ou `docker run ...`)
npm install
npx prisma migrate dev --name init
npm run dev
```

## Déploiement sur Heroku

1. Créez l'app : `heroku create budgify-api`.
2. Ajoutez Postgres : `heroku addons:create heroku-postgresql:hobby-dev`.
3. Poussez le code : `git subtree push --prefix DB heroku main` (ou repo séparé).
4. Exécutez les migrations : `heroku run npm run prisma:migrate`.
5. Définissez `JWT_SECRET`, `CLIENT_ORIGINS` (liste d'URL séparées par des virgules) via `heroku config:set`.
6. (Optionnel) Ajustez les cookies d'auth avec `AUTH_COOKIE_*` (`NAME`, `SAMESITE`, `SECURE`, `DOMAIN`, `MAX_AGE_MS`) selon vos besoins.

Exemple :

```bash
heroku config:set \
  JWT_SECRET="xxxx" \
  CLIENT_ORIGINS="https://remoouzz.github.io,https://remoouzz.github.io/budget-mensuel" \
  AUTH_COOKIE_SAMESITE="none" \
  AUTH_COOKIE_SECURE="true"
```

## Routes initiales

- `GET /health` : statut simple.
- `POST /auth/register` : inscription email/mot de passe (hash bcrypt).
- `POST /auth/login` : connexion, cookie HTTPOnly `token`.
- `POST /auth/logout` : supprime le cookie.
- `GET /auth/me` : profil courant (protégé par middleware `requireAuth`).

Les routes métiers (/months, /settings, etc.) seront ajoutées ensuite pour synchroniser les données budgétaires du front.

## Seed des données par défaut

Pour pré-remplir un compte avec les réglages et le mois de base :

```bash
cd DB
export SEED_EMAIL="toi@example.com"
export SEED_PASSWORD="tonMotDePasse"
npm run prisma:seed
```

- Si l'utilisateur n'existe pas, il est créé.
- Les charges fixes/abonnements/crédits par défaut sont insérés avec leurs IDs d'origine (fc_*, sub_*, etc.).
- Le mois `2026-01` est créé avec trois entrées de revenus à 0.

Ensuite, connectez-vous via `curl` ou le front et utilisez `/settings` et `/months` qui contiendront ces données.
