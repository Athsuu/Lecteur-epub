/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS/ACTION-HANDLER.JS
 * Gestionnaire des actions déclenchées par data-action.
 * Centralise toutes les actions utilisateur.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config } from '../core/config.js';
import { StateManager } from '../core/state.js';
import { ThemeManager } from '../core/themes.js';
import { UIManager } from '../ui/ui-manager.js';
import { LibraryManager } from '../library/library-manager.js';
import { ReaderEngine } from '../reader/reader-engine.js';
import { EventBus, Events } from './event-bus.js';

/**
 * Map des actions disponibles
 * @private
 */
const actions = new Map();

/**
 * Enregistre les actions par défaut
 * @private
 */
function registerDefaultActions() {
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS THÈME
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('toggle-theme', () => {
        ThemeManager.toggle();
        if (ReaderEngine.isActive()) {
            ReaderEngine.applyTheme();
        }
        UIManager.updateDropdownTheme();
        EventBus.emit(Events.THEME_CHANGED, ThemeManager.current());
    });
    
    actions.set('set-theme-light', () => {
        ThemeManager.setTheme('light');
        if (ReaderEngine.isActive()) ReaderEngine.applyTheme();
        UIManager.updateDropdownTheme();
        EventBus.emit(Events.THEME_CHANGED, 'light');
    });
    
    actions.set('set-theme-dark', () => {
        ThemeManager.setTheme('dark');
        if (ReaderEngine.isActive()) ReaderEngine.applyTheme();
        UIManager.updateDropdownTheme();
        EventBus.emit(Events.THEME_CHANGED, 'dark');
    });
    
    actions.set('set-theme-sepia', () => {
        ThemeManager.setTheme('sepia');
        if (ReaderEngine.isActive()) ReaderEngine.applyTheme();
        UIManager.updateDropdownTheme();
        EventBus.emit(Events.THEME_CHANGED, 'sepia');
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS SOMMAIRE (TOC)
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('toggle-toc', () => {
        if (UIManager.isMobile()) {
            UIManager.toggleMobileToc();
        } else {
            UIManager.toggleTOC();
        }
        EventBus.emit(Events.UI_TOC_TOGGLED);
    });
    
    actions.set('goto-chapter', (e, target) => {
        const href = target.dataset.href;
        if (href) {
            ReaderEngine.goToChapter(href);
        }
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS POLICE
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('font-decrease', () => {
        ReaderEngine.changeFontSize(-Config.FONT.STEP);
        UIManager.updateDropdownFontSize();
        EventBus.emit(Events.READER_FONT_CHANGED);
    });
    
    actions.set('font-increase', () => {
        ReaderEngine.changeFontSize(Config.FONT.STEP);
        UIManager.updateDropdownFontSize();
        EventBus.emit(Events.READER_FONT_CHANGED);
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS MODE DE LECTURE
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('toggle-flow', async () => {
        await ReaderEngine.toggleFlow();
        UIManager.updateDropdownFlow();
        EventBus.emit(Events.READER_FLOW_CHANGED, ReaderEngine.getFlow());
    });
    
    actions.set('set-flow-scroll', async () => {
        await ReaderEngine.setFlow('scrolled');
        UIManager.updateDropdownFlow();
        EventBus.emit(Events.READER_FLOW_CHANGED, 'scrolled');
    });
    
    actions.set('set-flow-paginated', async () => {
        await ReaderEngine.setFlow('paginated');
        UIManager.updateDropdownFlow();
        EventBus.emit(Events.READER_FLOW_CHANGED, 'paginated');
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS DROPDOWNS MOBILE
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('toggle-mobile-settings', () => {
        UIManager.toggleMobileSettings();
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS LECTEUR
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('close-reader', () => {
        UIManager.closeAllDropdowns();
        ReaderEngine.close();
        EventBus.emit(Events.READER_CLOSED);
    });
    
    actions.set('prev-page', () => {
        ReaderEngine.prevPage();
    });
    
    actions.set('next-page', () => {
        ReaderEngine.nextPage();
    });
    
    actions.set('prev-chapter', () => {
        ReaderEngine.prevChapter();
    });
    
    actions.set('next-chapter', () => {
        ReaderEngine.nextChapter();
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS MODAL
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('close-modal', () => {
        UIManager.closeModal();
        EventBus.emit(Events.UI_MODAL_CLOSED);
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS IMPORT
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('import', () => {
        const fileInput = UIManager.get('fileInput');
        if (fileInput) {
            fileInput.click();
        }
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS LIVRE
    // ═══════════════════════════════════════════════════════════════════════
    
    actions.set('open-book', (e, target) => {
        const id = parseInt(target.dataset.id);
        if (!isNaN(id)) {
            UIManager.closeModal();
            ReaderEngine.open(id);
            EventBus.emit(Events.READER_OPENED, { bookId: id });
        }
    });
    
    actions.set('delete-book', (e, target) => {
        e.stopPropagation();
        const id = parseInt(target.dataset.id);
        if (!isNaN(id)) {
            LibraryManager.delete(id);
            EventBus.emit(Events.BOOK_DELETED, { id });
        }
    });
    
    actions.set('book-detail', (e, target) => {
        e.stopPropagation();
        const id = parseInt(target.dataset.id);
        if (!isNaN(id)) {
            LibraryManager.showDetail(id);
            EventBus.emit(Events.UI_MODAL_OPENED, { type: 'book-detail', id });
        }
    });
    
    // Note: toggle-favorite est géré directement par LibraryManager._attachFavoriteListener()
    // pour une meilleure performance (pas de reload, mise à jour DOM ciblée)
    
    actions.set('show-library-view', (e, target) => {
        // Chercher data-view sur l'élément lui-même ou son parent
        const viewElement = target.dataset.view ? target : target.closest('[data-view]');
        const view = viewElement?.dataset.view;
        if (!view) return;
        
        // Mettre à jour l'état
        StateManager.set('libraryView', view);
        
        // Mettre à jour la classe active
        document.querySelectorAll('.sidebar-icon[data-view]').forEach(icon => {
            icon.classList.remove('active');
        });
        const iconElement = target.classList.contains('sidebar-icon') ? target : target.closest('.sidebar-icon');
        iconElement?.classList.add('active');
        
        // Charger la vue correspondante
        if (view === 'all' || view === 'favorites') {
            LibraryManager.load(view);
        } else if (view === 'stats') {
            EventBus.emit(Events.STATS_OPEN_REQUEST);
        }
        
        EventBus.emit(Events.LIBRARY_VIEW_CHANGED, { view });
    });

    // Ouvrir directement le module de statistiques
    actions.set('show-stats', () => {
        EventBus.emit(Events.STATS_OPEN_REQUEST);
    });
}

/**
 * ActionHandler - Gestionnaire d'actions
 */
export const ActionHandler = {
    /**
     * Initialise le gestionnaire avec les actions par défaut
     */
    init() {
        registerDefaultActions();
        console.log(`🎯 ActionHandler initialized with ${actions.size} actions`);
    },
    
    /**
     * Exécute une action
     * @param {string} actionName - Nom de l'action
     * @param {Event} event - Événement DOM
     * @param {HTMLElement} target - Élément cible
     * @returns {boolean} True si l'action a été exécutée
     */
    execute(actionName, event = null, target = null) {
        const action = actions.get(actionName);
        
        if (action) {
            try {
                action(event, target);
                return true;
            } catch (error) {
                console.error(`Action "${actionName}" failed:`, error);
                return false;
            }
        }
        
        console.warn(`Unknown action: ${actionName}`);
        return false;
    },
    
    /**
     * Enregistre une nouvelle action
     * @param {string} name - Nom de l'action
     * @param {Function} handler - Fonction handler
     */
    register(name, handler) {
        if (typeof handler === 'function') {
            actions.set(name, handler);
        }
    },
    
    /**
     * Supprime une action
     * @param {string} name - Nom de l'action
     */
    unregister(name) {
        actions.delete(name);
    },
    
    /**
     * Vérifie si une action existe
     * @param {string} name - Nom de l'action
     * @returns {boolean}
     */
    has(name) {
        return actions.has(name);
    },
    
    /**
     * Liste toutes les actions disponibles
     * @returns {string[]}
     */
    list() {
        return Array.from(actions.keys());
    }
};

export default ActionHandler;
