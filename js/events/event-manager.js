/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS.JS
 * Gestionnaire centralisé des événements.
 * Orchestre les différents handlers (actions, clavier, gestes).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { UIManager } from '../ui/ui-manager.js';
import { LibraryManager } from '../library/library-manager.js';
import { EventBus, Events } from './event-bus.js';
import { ActionHandler } from './action-handler.js';
import { GestureHandler } from './gesture-handler.js';
import { KeyboardHandler } from './keyboard-handler.js';
import { ReaderEngine } from '../reader/reader-engine.js';

/**
 * Gère les clics délégués via data-action
 * @param {Event} e - Événement click
 * @private
 */
function handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const action = target.dataset.action;
    ActionHandler.execute(action, e, target);
}

/**
 * Gère les clics sur les items du sommaire
 * @param {Event} e - Événement click
 * @private
 */
function handleTocClick(e) {
    if (e.target.classList.contains('toc-item')) {
        ActionHandler.execute('goto-chapter', e, e.target);
    }
}

/**
 * Gère l'import de fichiers
 * @param {Event} e - Événement change
 * @private
 */
async function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) {
        await LibraryManager.import(file);
        EventBus.emit(Events.BOOK_IMPORTED, { filename: file.name });
    }
    // Reset pour permettre de réimporter le même fichier
    e.target.value = '';
}

/**
 * Gère la recherche de livres
 * @param {Event} e - Événement input
 * @private
 */
function handleSearch(e) {
    LibraryManager.filter(e.target.value);
    EventBus.emit(Events.LIBRARY_FILTERED, { query: e.target.value });
}

/**
 * EventManager - Gestionnaire d'événements centralisé
 */
export const EventManager = {
    /**
     * Initialise tous les écouteurs d'événements
     */
    init() {
        // Initialiser les handlers
        ActionHandler.init();
        KeyboardHandler.init();
        
        // Délégation globale des clics
        document.addEventListener('click', handleClick);
        
        // Clics sur la table des matières desktop
        const tocList = UIManager.get('tocList');
        if (tocList) {
            tocList.addEventListener('click', handleTocClick);
        }
        
        // Overlay pour fermer la TOC desktop
        const tocOverlay = UIManager.get('tocOverlay');
        if (tocOverlay) {
            tocOverlay.addEventListener('click', (e) => ActionHandler.execute('toggle-toc', e));
        }
        
        // Overlay pour fermer les dropdowns mobile
        const dropdownOverlay = UIManager.get('mobileDropdownOverlay');
        if (dropdownOverlay) {
            dropdownOverlay.addEventListener('click', (e) => ActionHandler.execute('close-toc', e));
            // Fermer le menu si on essaie de scroller (swipe sur l'overlay)
            dropdownOverlay.addEventListener('touchmove', (e) => ActionHandler.execute('close-toc', e), { passive: true });
        }
        
        // Action pour fermer le sommaire mobile (bottom sheet) via la croix ou l'overlay
        this.addAction('close-toc', () => {
            UIManager.closeAllDropdowns();
        });
        
        // Import de fichiers
        const fileInput = UIManager.get('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileInput);
        }
        
        // Recherche
        const searchInput = UIManager.get('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
        }
        
        // Gestes tactiles (sur le lecteur)
        GestureHandler.init();
        
        // Fermer la modal en cliquant en dehors
        const bookModal = UIManager.get('bookModal');
        if (bookModal) {
            bookModal.addEventListener('click', (e) => {
                if (e.target === bookModal) {
                    ActionHandler.execute('close-modal', e);
                }
            });
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // ÉVÉNEMENTS DU READER (Architecture découplée)
        // ═══════════════════════════════════════════════════════════════════════
        
        // Ouverture du lecteur
        EventBus.on('reader:opening', (data) => {
            UIManager.setReaderTitle(data.title);
            UIManager.initDropdownState();
            UIManager.showReader();
        });
        
        // Fermeture du lecteur
        EventBus.on(Events.READER_CLOSED, () => {
            UIManager.showLibrary();
            LibraryManager.load();
        });
        
        // Mise à jour du sommaire
        EventBus.on('reader:toc-ready', (chapters) => {
            UIManager.updateToc(chapters);       // Desktop
            UIManager.updateMobileToc(chapters); // Mobile
        });
        
        // Changement de mode de lecture
        EventBus.on('reader:flow-changed', (data) => {
            UIManager.updateFlowButton(data.flow);
        });
        
        // Messages de statut
        EventBus.on('status-message', (msg) => UIManager.showStatus(msg));
        
        // Navigation via gestes (Zones Tap)
        EventBus.on('reader:prev', () => {
            if (ReaderEngine.getFlow() === 'paginated') ReaderEngine.prevPage();
            else ReaderEngine.prevChapter();
        });
        
        EventBus.on('reader:next', () => {
            if (ReaderEngine.getFlow() === 'paginated') ReaderEngine.nextPage();
            else ReaderEngine.nextChapter();
        });
        
        console.log('🎯 EventManager initialized');
    },
    
    /**
     * Accès à l'EventBus pour les abonnements
     */
    bus: EventBus,
    
    /**
     * Constantes d'événements
     */
    events: Events,
    
    /**
     * Ajoute une action personnalisée
     * @param {string} name - Nom de l'action
     * @param {Function} handler - Handler de l'action
     */
    addAction(name, handler) {
        ActionHandler.register(name, handler);
    },
    
    /**
     * Supprime une action
     * @param {string} name - Nom de l'action à supprimer
     */
    removeAction(name) {
        ActionHandler.unregister(name);
    },
    
    /**
     * Ajoute un raccourci clavier
     * @param {string} key - Touche
     * @param {Object} config - Configuration
     */
    addShortcut(key, config) {
        KeyboardHandler.register(key, config);
    },
    
    /**
     * S'abonne à un événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Callback
     * @returns {number} ID du listener
     */
    on(event, callback) {
        return EventBus.on(event, callback);
    },
    
    /**
     * Se désabonne d'un événement
     * @param {string} event - Nom de l'événement
     * @param {number} id - ID du listener
     */
    off(event, id) {
        EventBus.off(event, id);
    },
    
    /**
     * Émet un événement
     * @param {string} event - Nom de l'événement
     * @param {*} data - Données
     */
    emit(event, data) {
        EventBus.emit(event, data);
    }
};

// Export aussi les modules individuels pour usage direct
export { EventBus, Events } from './event-bus.js';
export { ActionHandler } from './action-handler.js';
export { GestureHandler } from './gesture-handler.js';
export { KeyboardHandler } from './keyboard-handler.js';
