# Prompt pour Gemini Code Assist - Menu Contextuel Style iOS

## Contexte du Projet
Je développe une application de bibliothèque de livres numériques (EPUB) avec une interface web. J'ai actuellement un menu contextuel basique qui s'affiche lors d'un clic droit sur les cartes de livres, mais je souhaite le transformer pour qu'il ressemble exactement au menu contextuel natif d'iOS/iPadOS.

## Fichiers Actuels
J'ai deux fichiers principaux :
1. **library.css** - Contient les styles CSS actuels du menu contextuel
2. **library-manager.js** - Contient la logique JavaScript pour gérer le menu

## Objectif
Transformer le menu contextuel actuel en un menu contextuel style iOS avec les caractéristiques suivantes :

### Caractéristiques Visuelles iOS à Implémenter

#### 1. Apparence Générale
- **Fond** : Effet de glassmorphism avec blur intense (backdrop-filter: blur(40px))
- **Couleur de fond** : rgba(255, 255, 255, 0.75) en mode clair, rgba(45, 45, 45, 0.85) en mode sombre
- **Bordures** : Border radius de 20px minimum
- **Ombre** : Shadow subtile mais présente : `0 10px 60px rgba(0, 0, 0, 0.25)`
- **Bordure** : Fine bordure semi-transparente : `1px solid rgba(255, 255, 255, 0.2)`

#### 2. Animation d'Entrée/Sortie
L'animation doit être élastique et fluide :
- **Début** : Scale(0.8) + translateY(-10px) + opacity(0)
- **Fin** : Scale(1) + translateY(0) + opacity(1)
- **Timing** : cubic-bezier(0.175, 0.885, 0.32, 1.275) - Effet "bounce" élastique iOS
- **Durée** : 350ms pour l'entrée, 200ms pour la sortie
- **Origin** : transform-origin doit être dynamique selon la position du menu

#### 3. Items du Menu
Chaque item doit avoir :
- **Padding** : 14px 18px
- **Border radius** : 12px
- **Fond au hover** : rgba(0, 0, 0, 0.06) en clair, rgba(255, 255, 255, 0.1) en sombre
- **Transition hover** : Transition douce de 150ms
- **Icônes** : Icônes à gauche, 20px × 20px, avec un gap de 14px
- **Typography** : 
  - Font-size: 15px
  - Font-weight: 500 (medium)
  - Letter-spacing: -0.2px
- **Effet tactile** : Scale(0.97) lors du mousedown pour simuler le feedback tactile iOS

#### 4. Séparateurs
- **Hauteur** : 0.5px (pas 1px)
- **Couleur** : rgba(0, 0, 0, 0.1) en clair, rgba(255, 255, 255, 0.1) en sombre
- **Margin** : 6px vertical

#### 5. Items Dangereux (Delete/Supprimer)
- **Couleur texte** : #FF3B30 (rouge iOS)
- **Background hover** : rgba(255, 59, 48, 0.08)
- **Icône** : Rouge également

#### 6. Effet de Flou du Background
Quand le menu est ouvert :
- L'élément cliqué doit avoir un **scale(1.05)** et rester net
- Les autres éléments doivent avoir un **blur(8px)** et **opacity(0.5)**
- Transition fluide de 400ms cubic-bezier(0.4, 0.0, 0.2, 1)

#### 7. Comportement du Menu
- **Position** : Doit se positionner intelligemment :
  - Si proche du bord droit → s'ouvre vers la gauche
  - Si proche du bord bas → s'ouvre vers le haut
  - Sinon → s'ouvre depuis le point de clic
- **Fermeture** :
  - Clic en dehors du menu
  - Touche Escape
  - Clic sur un item (après action)
  - Animation de sortie fluide

### Structure HTML Attendue
```html
<div class="ios-context-menu" data-book-id="...">
  <div class="ios-context-item" data-action="open">
    <svg class="item-icon">...</svg>
    <span class="item-label">Ouvrir le livre</span>
  </div>
  
  <div class="ios-context-separator"></div>
  
  <div class="ios-context-item" data-action="details">
    <svg class="item-icon">...</svg>
    <span class="item-label">Détails</span>
  </div>
  
  <div class="ios-context-item" data-action="favorite">
    <svg class="item-icon">...</svg>
    <span class="item-label">Ajouter aux favoris</span>
  </div>
  
  <div class="ios-context-separator"></div>
  
  <div class="ios-context-item danger" data-action="delete">
    <svg class="item-icon">...</svg>
    <span class="item-label">Supprimer</span>
  </div>
</div>
```

## Actions à Effectuer

### 1. Modifications CSS (library.css)
- **Remplacer** les classes `.lib-context-menu`, `.lib-context-item`, `.lib-context-separator`
- **Ajouter** les nouveaux styles iOS avec toutes les caractéristiques mentionnées
- **Créer** les animations @keyframes pour l'entrée/sortie
- **Ajouter** les états hover, active, focus avec les transitions appropriées
- **Implémenter** le système de blur pour le background
- **Ajouter** le support du mode sombre avec `@media (prefers-color-scheme: dark)`

### 2. Modifications JavaScript (library-manager.js)
Je suppose que vous avez une fonction qui gère l'affichage du menu contextuel. Vous devez :

- **Créer** une fonction `showContextMenu(event, bookId, bookData)` qui :
  1. Empêche le menu contextuel par défaut : `event.preventDefault()`
  2. Crée le DOM du menu avec la structure HTML mentionnée
  3. Positionne intelligemment le menu selon la position du clic
  4. Ajoute la classe `has-active-context` au conteneur `.lib-books`
  5. Applique l'animation d'entrée
  6. Attache les event listeners pour les actions

- **Créer** une fonction `hideContextMenu()` qui :
  1. Applique l'animation de sortie
  2. Retire la classe `has-active-context`
  3. Supprime le menu du DOM après l'animation
  4. Nettoie les event listeners

- **Créer** une fonction `positionMenu(menu, clickX, clickY)` qui :
  1. Calcule la position optimale selon les bords de la fenêtre
  2. Ajuste le transform-origin en conséquence
  3. Applique les coordonnées

- **Event Listeners à ajouter** :
  - `contextmenu` sur chaque `.book-card`
  - `click` en dehors du menu (document)
  - `keydown` pour la touche Escape
  - `mousedown` sur les items pour l'effet tactile
  - `click` sur chaque item pour exécuter les actions

### 3. Icônes SVG
Utilisez des icônes simples et épurées style iOS. Voici quelques exemples :

**Ouvrir** :
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
</svg>
```

**Détails (Info)** :
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="16" x2="12" y2="12"/>
  <line x1="12" y1="8" x2="12.01" y2="8"/>
</svg>
```

**Favoris (Étoile)** :
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>
```

**Supprimer (Corbeille)** :
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
</svg>
```

## Détails d'Implémentation Importants

### Gestion du Positionnement
```javascript
function positionMenu(menu, clickX, clickY) {
  const menuRect = menu.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  let x = clickX;
  let y = clickY;
  let origin = 'top left';
  
  // Ajustement horizontal
  if (clickX + menuRect.width > windowWidth - 20) {
    x = clickX - menuRect.width;
    origin = 'top right';
  }
  
  // Ajustement vertical
  if (clickY + menuRect.height > windowHeight - 20) {
    y = clickY - menuRect.height;
    origin = origin.replace('top', 'bottom');
  }
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.transformOrigin = origin;
}
```

### Animation Tactile au Clic
```javascript
item.addEventListener('mousedown', (e) => {
  e.currentTarget.style.transform = 'scale(0.97)';
});

item.addEventListener('mouseup', (e) => {
  e.currentTarget.style.transform = 'scale(1)';
});
```

### Fermeture Intelligente
```javascript
// Fermer au clic extérieur (avec délai pour éviter la fermeture immédiate)
setTimeout(() => {
  document.addEventListener('click', closeHandler);
}, 100);

// Fermer à l'Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu();
});
```

## Résultat Attendu
Le menu contextuel final doit :
- ✅ Avoir l'apparence exacte d'un menu contextuel iOS (glassmorphism, blur, shadows)
- ✅ Apparaître avec une animation élastique fluide
- ✅ Flouter l'arrière-plan et mettre en avant l'élément cliqué
- ✅ Répondre de manière tactile aux interactions (scale au clic)
- ✅ Se positionner intelligemment selon les bords de l'écran
- ✅ Avoir des transitions douces sur tous les états
- ✅ Supporter le mode sombre automatiquement
- ✅ Être accessible (keyboard navigation, aria-labels)

## Points Critiques à Ne Pas Oublier
1. **backdrop-filter** nécessite le préfixe `-webkit-` pour Safari
2. Les animations doivent être **hardware-accelerated** (utiliser transform au lieu de left/top)
3. Le blur du background doit être appliqué via une classe sur le conteneur parent
4. Le menu doit être **appendChild** au body pour éviter les problèmes de z-index
5. Nettoyer les event listeners lors de la fermeture pour éviter les memory leaks
6. Tester sur mobile avec les touch events

## Questions à Considérer
- Souhaitez-vous un mode haptic feedback (vibration) sur mobile ?
- Le menu doit-il avoir des actions différentes selon le statut du livre (déjà favori, lecture en cours, etc.) ?
- Voulez-vous une confirmation modale pour l'action "Supprimer" ?

---

**Note** : Ce menu contextuel doit s'intégrer parfaitement avec votre code existant. Assurez-vous de conserver les fonctions `delete()`, `showDetail()`, `toggleFavorite()` qui sont déjà implémentées dans `library-manager.js` et de les appeler depuis les items du menu.
