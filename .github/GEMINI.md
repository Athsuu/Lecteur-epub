# ⚡ RÈGLES PROJET LECTEUR EPUB (MASTER PROMPT)

## 1. Cartographie du Projet (Map)
Voici la structure de référence. Respecte scrupuleusement cette logique pour tout nouveau fichier.
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
        ├── scroll-reader.js
    ├── utils/          # UTILITAIRES
        ├── logger.js       # Système de log centralisé

## 2. Architecture Core (Strict)
- **Communication** : Tout échange inter-module DOIT passer par `EventBus`. Interdiction d'appeler directement des méthodes UI depuis le Reader.
- **État** : `StateManager` est la SEULE source de vérité. Ne pas stocker d'état dans le DOM.
- **Patterns** : Utiliser `Factory` pour l'instanciation (UI/Reader) et `Singleton` pour les Managers.

## 3. Règles de Développement (Nouveaux Fichiers)
- **Extension** : Tu es explicitement AUTORISÉE à créer de nouveaux fichiers `.js` ou `.css` si la logique le demande.
- **Placement** :
  - Un nouveau composant visuel ? -> `css/components/` + `js/ui/`
  - Une nouvelle logique métier ? -> `js/core/`
  - Une nouvelle interaction utilisateur ? -> `js/events/`
- **Déclaration** : Si tu crées un nouveau fichier JS, ajoute-le immédiatement dans `index.html`.

## 4. UI & Styling
- **CSS** : Ne jamais utiliser de `<style>` inline.
- **Thèmes** : Utiliser EXCLUSIVEMENT les variables de `themes.css` (ex: `var(--bg-color)`).
- **Responsive** : Ne pas mélanger les logiques. Le code Mobile reste dans `mobile-ui.js` et `mobile.css`.
- **Accessibilité** : Tout élément interactif doit avoir un `aria-label` et être navigable au clavier.

## 5. Performance & Maintenance
- **Rendu** : Utiliser `requestAnimationFrame` pour les animations. Ne jamais manipuler `top/left` (utiliser `transform`).
- **Listes** : Utiliser la virtualisation (`Virtualizer`) pour les longues listes (bibliothèque).
- **Nettoyage** : Implémenter une méthode `destroy()` pour nettoyer les EventListeners et éviter les fuites de mémoire.

## 6. Conventions de Nommage & Langue
- **CODE (JS/CSS)** : ANGLAIS OBLIGATOIRE (Variables, Fonctions, Classes).
  - *Bon:* `toggleMenu()`, `isBookOpen`
  - *Mauvais:* `ouvrirMenu()`, `estOuvert`
- **CONTENU (UI/Logs)** : FRANÇAIS OBLIGATOIRE (Textes affichés, Commentaires, Logs).

## 7. ANTI-HARD CODING (STRICT)
- **Règle d'Or** : Aucune "Magic Value" n'est tolérée dans le code.
- **Styles** : Toutes les couleurs, tailles, et espacements doivent provenir de variables CSS (`themes.css`) ou être définis dans `base.css`.
- **Config** : Les délais, URLs, Clés API ou seuils numériques doivent être centralisés dans `js/core/config.js` ou définis comme constantes en haut de fichier (`const ANIMATION_DURATION = 300;`).
- **Exception** : Le hard-coding n'est autorisé que s'il est techniquement IMPOSSIBLE de faire autrement (ex: contrainte spécifique d'une librairie tierce).

## 8. Robustesse & Logs
- **Erreurs** : Utiliser des blocs `try/catch` pour toutes les opérations asynchrones (File API, IndexedDB).
- **Logging** : Ne jamais utiliser `console.log`. Utiliser `this.logger.info()` ou `this.logger.error()` via la classe `Logger`.