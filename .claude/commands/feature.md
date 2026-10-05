---
description: Implémente une feature de bout en bout (branche, tests, PR)
argument-hint: <description de la feature>
---

Implémente la feature suivante : $ARGUMENTS

Suis le workflow Git de `CLAUDE.md` :

1. Pars de `main` à jour et crée une branche `feat/<nom-court>`.
2. Implémente en respectant l'architecture et les conventions, avec des tests.
3. Vérifie que `npm run lint && npm run typecheck && npm test` passent.
4. Commite (Conventional Commits en français), pousse la branche, puis ouvre la PR avec `gh pr create --base main` (description Avant/Après).
5. Donne-moi le lien de la PR.
