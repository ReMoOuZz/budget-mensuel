# Front-end API configuration

- `js/config.js` expose deux URLs : `dev` (http://localhost:4000) et `prod` (https://budgify-2026.herokuapp.com).
- Le front choisit automatiquement l'environnement :
  - `localhost` → `dev`
  - `github.io` ou tout autre domaine → `prod`
- Pour forcer manuellement un environnement, enregistrez `localStorage.setItem("budgify:apiEnv", "dev|prod")`.
- Le script définit `window.BUDGIFY_API_BASE` que `js/api.js` utilise pour toutes les requêtes.

Ainsi la version GitHub Pages pointe vers Heroku tandis que le développement local continue d'utiliser l'API démarrée en local.
