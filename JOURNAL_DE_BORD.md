# JOURNAL_DE_BORD — Lecteur EPUB

## 2026-01-31 — Audit initial
- Entrée : `index.html` → `js/core/app.js`.
- Init : UI → thème → settings → DB → stats → events → load bibliothèque → SW.
- Dossiers JS : `core/` (app, db, state, thèmes, stats), `events/` (bus + handlers), `library/` (bibliothèque + favoris), `reader/` (modes paged/scroll), `ui/` (desktop/mobile + managers), `utils/` (logger, search, sorter, virtualizer), `workers/` (parsing epub).
- Prochaine étape : fixer/valider les interactions iOS (tap/overlay) + tests PWA.

## 2026-01-31 — Fix UX "Tap centre" + durcissement iOS
- Décision produit : **Option 1** → *tap centre* = fermer overlays/panneaux s'ils sont ouverts, sinon toggle UI.
- Implémentation :
  - `js/events/gesture-handler.js` : le simple tap dans la zone centrale émet `ui:center-tap`.
  - `js/ui/ui-manager.js` : `handleCenterTap()` ferme `closeAllDropdowns()` + `closeTOC()` + `closeModal()` si quelque chose est ouvert, sinon `toggleInterface()`.
- iOS/Safari : overlays fermés aussi sur `pointerdown`/`touchstart` (en plus de `click`) dans `js/events/event-manager.js`.
