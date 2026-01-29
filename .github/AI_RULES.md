# ⚡ RÈGLES PROJET LECTEUR EPUB

## 1. Cartographie du Projet (Map)
Voici la structure de référence. Respecte scrupuleusement cette logique pour tout nouveau fichier.

```text
/lecteur-epub
├── index.html          # Point d'entrée unique
├── sw.js               # Service Worker (PWA)
├── css/
│   ├── base.css        # Reset & styles globaux
│   ├── library.css     # Librairy styles
│   ├── themes.css      # Variables CSS (Couleurs, Polices)
│   ├── desktop.css     # Layout spécifique Desktop
│   ├── mobile.css      # Layout spécifique Mobile
│   └── components/     # Styles isolés (loader, toast, modal...)
└── js/
    ├── core/           # LOGIQUE PURE (Singleton, State, Config)
    │   ├── state.js, config.js, database.js...
    ├── events/         # COMMUNICATION (EventBus, Handlers Input)
    │   ├── event-bus.js, gesture-handler.js...
    ├── ui/             # INTERFACE (DOM manipulation)
    │   ├── ui-factory.js   # Création dynamique des éléments
    │   ├── desktop-ui.js   # Implémentation Desktop
    │   ├── mobile-ui.js    # Implémentation Mobile
    └── reader/         # MOTEUR DE LECTURE (Wrapper Epub.js)
        ├── reader-factory.js
        ├── paged-reader.js
        └── scroll-reader.js

## 2. Architecture Core (Strict)
- **Communication** : Tout échange inter-module DOIT passer par `EventBus`. Interdiction d'appeler directement des méthodes UI depuis le Reader.
- **État** : `StateManager` est la SEULE source de vérité. Ne pas stocker d'état dans le DOM.
- **Patterns** : Utiliser `Factory` pour l'instanciation (UI/Reader) et `Singleton` pour les Managers.

## 3. Règles de Développement (Nouveaux Fichiers)
- **Extension** : Tu es explicitement AUTORISÉE à créer de nouveaux fichiers `.js` ou `.css` si la logique le demande (ex: nouveau composant complexe).
- **Placement** :
  - Un nouveau composant visuel ? -> `css/components/` + `js/ui/`
  - Une nouvelle logique métier ? -> `js/core/`
  - Une nouvelle interaction utilisateur ? -> `js/events/`
- **Déclaration** : Si tu crées un nouveau fichier JS, ajoute-le immédiatement dans `index.html`.

## 4. UI & Styling
- **CSS** : Ne jamais utiliser de `<style>` inline.
- **Thèmes** : Utiliser EXCLUSIVEMENT les variables de `themes.css`.
- **Responsive** : Ne pas mélanger les logiques. Le code Mobile reste dans `mobile-ui.js` et `mobile.css`.

## 5. Performance & Maintenance
- **Rendu** : Utiliser `requestAnimationFrame` pour les animations. Ne jamais manipuler `top/left` (utiliser `transform`).
- **Listes** : Utiliser la virtualisation (`Virtualizer`) pour les longues listes (bibliothèque).
- **Nettoyage** : Implémenter une méthode `destroy()` pour nettoyer les EventListeners et éviter les fuites de mémoire.
- **Code Mort** : Supprimer le code inutile, ne pas le commenter.