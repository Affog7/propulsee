# CLAUDE.md

Propulsee est un « Application Copilot » : une extension Chrome (panneau latéral ouvert sur une offre d'emploi) qui suit le flux **Préparer → Vérifier → Postuler**.

**Principe directeur : simplicité et vitesse maximales, le moins de clics possible.** Chaque fonctionnalité doit retirer des clics à l'utilisateur, pas en ajouter. En cas de doute, choisir la solution la plus simple.

## Architecture

Monorepo TypeScript, workspaces npm :

| Workspace         | Rôle                                             | Stack                    |
| ----------------- | ------------------------------------------------ | ------------------------ |
| `apps/extension`  | Extension Chrome MV3, UI dans le panneau latéral | Vite 6, React 19         |
| `apps/api`        | API HTTP                                         | Node 20, Fastify 5, `pg` |
| `packages/shared` | Types et constantes communs                      | TypeScript seul          |

- **`@propulsee/shared`** n'a pas d'étape de build : son `exports` pointe sur `src/index.ts`. Vite (extension), tsx (API en dev), Vitest et tsup (build de l'API, qui l'embarque via `noExternal`) consomment directement les sources. Tout type ou constante utilisé par l'extension **et** l'API va ici (ex. `HealthResponse`, `APPLICATION_STEPS`).
- **Extension** : `vite.config.ts` construit deux entrées, `sidepanel.html` (React) et `src/background.ts` (service worker). Le `manifest.json` est généré par `manifest.ts` pour que `host_permissions` corresponde à `VITE_API_URL`, ce qui dispense l'API de CORS. L'URL de l'API est disponible dans le code via la constante `__API_URL__`. En dev, `vite build --watch` réécrit `dist/`, chargé « non empaqueté » dans Chrome (pas de serveur de dev).
- **API** : `buildServer({ db })` dans `src/server.ts` construit l'app Fastify sans démarrer le serveur. Les dépendances (base, etc.) sont injectées pour être remplacées par des faux dans les tests (`app.inject`). `src/index.ts` est le seul point d'entrée qui lit la config et écoute un port.
- **Config** : un seul `.env` à la racine (voir `.env.example`), lu par docker compose, l'API (`process.loadEnvFile`, sans écraser les variables déjà définies) et Vite (`envDir`). Chaque variable a une valeur par défaut adaptée au dev local.
- **Docker** : `docker-compose.yml` lance `db` (Postgres 16, volume `pgdata`, exposé sur le port **5433** de l'hôte pour éviter un Postgres local sur 5432) et `api` (image multi-stage `apps/api/Dockerfile`, contexte = racine). En dev courant : `npm run db:up` puis `npm run dev`.

## Commandes

```bash
npm run dev         # API (tsx watch) + extension (vite build --watch)
npm run build       # tsc --noEmit + build de chaque workspace
npm run lint        # eslint . && prettier --check .
npm run typecheck   # tsc --noEmit dans chaque workspace
npm test            # vitest run (projets : packages/*, apps/*)
npx vitest run apps/api/src/server.test.ts   # un seul fichier
```

Avant de considérer une tâche terminée : `npm run lint && npm run typecheck && npm test`.

## Conventions

- **Langue** : identifiants et noms de fichiers en anglais ; textes d'interface, commentaires, docs et messages de test en français.
- **TypeScript strict** (`tsconfig.base.json`), avec `noUncheckedIndexedAccess` et `verbatimModuleSyntax`. Importer les types avec `import type`. Pas de `any`.
- **ESM partout** (`"type": "module"`). Résolution `Bundler` : imports relatifs sans extension.
- **Fichiers** en kebab-case (`job-offer.ts`), sauf les composants React en PascalCase (`App.tsx`). Exports nommés uniquement (hors fichiers de config).
- **Tests** : Vitest, à côté du code (`*.test.ts`). Tester l'API via `buildServer` + `app.inject`, jamais en ouvrant un port.
- **Formatage** : Prettier (guillemets simples, 100 colonnes), fins de ligne LF (`.gitattributes`). Ne pas formater à la main.
- **Dépendances** : outillage commun (TypeScript, ESLint, Prettier, Vitest) à la racine, dépendances propres à une app dans son workspace (`npm i <pkg> -w @propulsee/api`). Référencer un workspace avec la version `"*"`.
- **Commits** : Conventional Commits en français (`feat: …`, `fix: …`, `chore: …`).
- **Node 20** : outillage choisi pour rester compatible Node 20.18+ (Vite 6, ESLint 9, Vitest 4). Vérifier `engines` avant de monter une dépendance de version majeure.

## Workflow Git (obligatoire)

- Chaque feature part de `main` à jour : `git checkout main && git pull`, puis `git checkout -b feat/<nom-court>`.
- Commits au format Conventional Commits (voir ci-dessus).
- Avant de terminer : `npm run lint && npm run typecheck && npm test` doivent passer.
- Puis `git push -u origin feat/<nom-court>` et `gh pr create --base main --fill` (titre clair, description Avant/Après).
- Ne jamais pousser directement sur `main`.
- Raccourci : `/feature <description>` (`.claude/commands/feature.md`) enchaîne tout ce workflow.
