# Guide d'Intégration - Menu Contextuel iOS

## 📦 Fichiers Fournis

1. **prompt_gemini_context_menu_ios.md** - Prompt détaillé pour Gemini Code Assist
2. **ios-context-menu.css** - Styles CSS complets du menu iOS
3. **ios-context-menu.js** - Logique JavaScript complète
4. **demo-ios-context-menu.html** - Page de démonstration fonctionnelle

## 🚀 Intégration dans Votre Projet

### Étape 1 : Remplacer les Styles CSS

Dans votre fichier `library.css`, vous avez deux options :

#### Option A : Remplacement Complet
Supprimez les sections suivantes de `library.css` :
- Tout le code sous `/* CONTEXT MENU */`
- Les classes `.lib-context-menu`, `.lib-context-item`, `.lib-context-separator`
- L'effet de blur `.lib-books.has-active-context`

Ensuite, ajoutez le contenu de `ios-context-menu.css` à la fin de votre `library.css`.

#### Option B : Fichier Séparé (Recommandé)
Gardez votre `library.css` intact et ajoutez simplement une nouvelle ligne dans votre HTML :
```html
<link rel="stylesheet" href="css/library.css">
<link rel="stylesheet" href="css/ios-context-menu.css"> <!-- Nouveau -->
```

Les nouveaux styles remplaceront automatiquement les anciens grâce à la cascade CSS.

### Étape 2 : Intégrer le JavaScript

#### Si vous utilisez des modules ES6 (votre cas)

Dans votre `library-manager.js`, ajoutez l'import en haut du fichier :
```javascript
import { IOSContextMenu } from './ios-context-menu.js';
```

Puis, dans la section d'initialisation de votre LibraryManager, ajoutez :
```javascript
// Initialiser le menu contextuel iOS
this.contextMenu = new IOSContextMenu();
```

#### Si vous n'utilisez pas de modules

Incluez simplement le script dans votre HTML :
```html
<script src="js/ios-context-menu.js"></script>
```

### Étape 3 : Adapter les Actions

Dans `ios-context-menu.js`, la méthode `executeAction()` fait référence à `window.LibraryManager`. 

**Vous devez modifier cette section pour qu'elle corresponde à votre architecture :**

```javascript
async executeAction(action, bookId) {
  switch (action) {
    case 'open':
      // VOTRE CODE : Ouvrir le livre
      await LibraryManager.openReader(parseInt(bookId));
      break;
      
    case 'details':
      // VOTRE CODE : Afficher les détails
      await LibraryManager.showDetail(parseInt(bookId));
      break;
      
    case 'favorite':
      // VOTRE CODE : Toggle favori
      await LibraryManager.toggleFavorite(parseInt(bookId));
      break;
      
    case 'delete':
      // VOTRE CODE : Supprimer avec confirmation
      const confirmed = confirm('Êtes-vous sûr de vouloir supprimer ce livre ?');
      if (confirmed) {
        await LibraryManager.delete(parseInt(bookId));
      }
      break;
  }
}
```

### Étape 4 : Ajouter l'Attribut data-book-id

Assurez-vous que chaque carte de livre a bien l'attribut `data-book-id` :

```html
<div class="book-card" data-book-id="123">
  <!-- contenu de la carte -->
</div>
```

Dans votre fonction de rendu des livres, vérifiez que vous ajoutez cet attribut :
```javascript
const bookCard = document.createElement('div');
bookCard.className = 'book-card';
bookCard.dataset.bookId = book.id; // ← Important !
```

## 🎨 Personnalisation

### Couleurs et Thème

Les variables CSS en haut de `ios-context-menu.css` vous permettent de personnaliser facilement :

```css
:root {
  --ios-menu-bg-light: rgba(255, 255, 255, 0.75);
  --ios-menu-bg-dark: rgba(45, 45, 45, 0.85);
  --ios-danger-color: #FF3B30;
  /* ... etc */
}
```

### Ajouter/Retirer des Items du Menu

Dans `ios-context-menu.js`, modifiez la méthode `createMenu()` :

```javascript
createMenu(bookId, bookData) {
  const menu = document.createElement('div');
  menu.className = 'ios-context-menu';
  
  menu.innerHTML = `
    <!-- Vos items personnalisés ici -->
    <button class="ios-context-item" data-action="export">
      <svg class="item-icon">...</svg>
      <span class="item-label">Exporter</span>
    </button>
  `;
  
  // ...
}
```

N'oubliez pas d'ajouter le cas correspondant dans `executeAction()`.

### Modifier les Animations

Ajustez les valeurs dans les transitions CSS :

```css
.ios-context-menu {
  /* Plus rapide */
  transition: opacity 0.15s, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  /* Plus lent */
  transition: opacity 0.3s, transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

## 🧪 Tester

1. Ouvrez `demo-ios-context-menu.html` dans votre navigateur
2. Faites un clic droit sur n'importe quelle carte de livre
3. Le menu devrait apparaître avec l'animation élastique
4. Testez les différentes actions

## 🐛 Débogage

### Le menu n'apparaît pas
- Vérifiez que `data-book-id` est présent sur vos cartes
- Ouvrez la console et cherchez les erreurs JavaScript
- Vérifiez que `.lib-books` existe dans votre DOM

### Les animations sont saccadées
- Activez l'accélération matérielle : `transform: translateZ(0)`
- Vérifiez que `will-change` est bien défini dans le CSS

### Le blur ne fonctionne pas
- `backdrop-filter` nécessite HTTPS en production
- Certains navigateurs anciens ne le supportent pas
- Vérifiez les préfixes `-webkit-backdrop-filter`

### Le menu se ferme immédiatement
- Le délai de 100ms dans `attachCloseListeners()` est crucial
- Vérifiez qu'il n'y a pas de conflits avec d'autres event listeners

## 📱 Support Mobile

Le menu est entièrement compatible mobile avec :
- Touch events pour l'effet tactile
- Adaptation automatique de la taille
- Gestion du long-press (appui long)

Pour ajouter le support du long-press, ajoutez dans `init()` :

```javascript
let pressTimer;

booksContainer.addEventListener('touchstart', (e) => {
  const bookCard = e.target.closest('.book-card');
  if (bookCard) {
    pressTimer = setTimeout(() => {
      const touch = e.touches[0];
      const bookId = bookCard.dataset.bookId;
      this.show({ 
        clientX: touch.clientX, 
        clientY: touch.clientY,
        preventDefault: () => {}
      }, bookId, bookCard);
    }, 500); // 500ms pour déclencher le menu
  }
});

booksContainer.addEventListener('touchend', () => {
  clearTimeout(pressTimer);
});
```

## ✅ Checklist de Validation

- [ ] Le menu apparaît au clic droit sur une carte
- [ ] L'animation d'entrée est fluide et élastique
- [ ] Les autres cartes sont floutées quand le menu est ouvert
- [ ] Le menu se positionne correctement près des bords
- [ ] Le menu se ferme au clic extérieur
- [ ] Le menu se ferme avec la touche Escape
- [ ] Les items ont l'effet tactile au clic
- [ ] Les actions (ouvrir, détails, favoris, supprimer) fonctionnent
- [ ] Le mode sombre s'active automatiquement
- [ ] Le menu est responsive sur mobile

## 🎯 Résultat Final

Votre menu contextuel devrait maintenant ressembler exactement à celui d'iOS/iPadOS avec :
- ✨ Glassmorphism et effet de blur
- 🎨 Animations élastiques fluides
- 📱 Support mobile complet
- 🌙 Mode sombre automatique
- ⚡ Performance optimale

## 📞 Support

Si vous rencontrez des problèmes d'intégration, vérifiez :
1. La console JavaScript pour les erreurs
2. Que tous les sélecteurs CSS correspondent à votre HTML
3. Que les noms de méthodes correspondent à votre LibraryManager
4. La compatibilité du navigateur (backdrop-filter nécessite un navigateur récent)

---

**Bon développement ! 🚀**
