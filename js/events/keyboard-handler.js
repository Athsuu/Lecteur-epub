/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS/KEYBOARD-HANDLER.JS
 * Gestionnaire des raccourcis clavier.
 * Centralise tous les raccourcis de l'application.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config } from '../core/config.js';
import { ThemeManager } from '../core/themes.js';
import { UIManager } from '../ui/ui-manager.js';
import { ReaderEngine } from '../reader/reader-engine.js';
import { EventBus } from './event-bus.js';
import Logger from '../utils/logger.js';

const logger = new Logger('KeyboardHandler');

/**
 * Map des raccourcis clavier
 * @private
 */
const shortcuts = new Map();

/**
 * Enregistre les raccourcis par défaut
 * @private
 */
function registerDefaultShortcuts() {
    // ═══════════════════════════════════════════════════════════════════════
    // RACCOURCIS GLOBAUX
    // ═══════════════════════════════════════════════════════════════════════
    
    // Échap - Fermer modales/TOC/Lecteur
    shortcuts.set('Escape', {
        global: true,
        handler: () => {
            // Priorité 1: Fermer la modale si ouverte
            if (UIManager.get('bookModal')?.classList.contains('active')) {
                UIManager.closeModal();
                return true;
            }
            // Priorité 2: Fermer le sommaire si ouvert
            if (UIManager.get('tocSidebar')?.classList.contains('open')) {
                UIManager.closeTOC();
                return true;
            }
            // Priorité 3: Fermer les dropdowns mobiles si ouverts
            if (UIManager.isMobile()) {
                const settingsDropdown = UIManager.get('settingsDropdown');
                const tocDropdown = UIManager.get('tocDropdown');
                
                if (settingsDropdown?.classList.contains('open') || 
                    tocDropdown?.classList.contains('open')) {
                    UIManager.closeAllDropdowns();
                    return true;
                }
            }
            // Priorité 4: Fermer le lecteur si actif
            if (ReaderEngine.isActive()) {
                ReaderEngine.close();
                return true;
            }
            return false;
        }
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // RACCOURCIS LECTEUR
    // ═══════════════════════════════════════════════════════════════════════
    
    // Flèche gauche - Page/Chapitre précédent
    shortcuts.set('ArrowLeft', {
        readerOnly: true,
        handler: () => {
            if (ReaderEngine.getFlow() === 'paginated') {
                ReaderEngine.prevPage();
            } else {
                ReaderEngine.prevChapter();
            }
            return true;
        }
    });
    
    // Flèche droite - Page/Chapitre suivant
    shortcuts.set('ArrowRight', {
        readerOnly: true,
        handler: () => {
            if (ReaderEngine.getFlow() === 'paginated') {
                ReaderEngine.nextPage();
            } else {
                ReaderEngine.nextChapter();
            }
            return true;
        }
    });
    
    // + ou = - Augmenter police
    shortcuts.set('+', {
        readerOnly: true,
        handler: () => {
            ReaderEngine.changeFontSize(Config.FONT.STEP);
            UIManager.updateDropdownFontSize();
            return true;
        }
    });
    
    shortcuts.set('=', {
        readerOnly: true,
        handler: () => {
            ReaderEngine.changeFontSize(Config.FONT.STEP);
            UIManager.updateDropdownFontSize();
            return true;
        }
    });
    
    // - Diminuer police
    shortcuts.set('-', {
        readerOnly: true,
        handler: () => {
            ReaderEngine.changeFontSize(-Config.FONT.STEP);
            UIManager.updateDropdownFontSize();
            return true;
        }
    });
    
    // T - Basculer thème
    shortcuts.set('t', {
        readerOnly: true,
        handler: () => {
            ThemeManager.toggle();
            ReaderEngine.applyTheme();
            UIManager.updateDropdownTheme();
            return true;
        }
    });
    
    shortcuts.set('T', {
        readerOnly: true,
        handler: () => {
            ThemeManager.toggle();
            ReaderEngine.applyTheme();
            UIManager.updateDropdownTheme();
            return true;
        }
    });
    
    // Espace - Page suivante (mode pagination)
    shortcuts.set(' ', {
        readerOnly: true,
        handler: () => {
            if (ReaderEngine.getFlow() === 'paginated') {
                ReaderEngine.nextPage();
                return true;
            }
            return false;
        }
    });
    
    // S - Basculer sommaire
    shortcuts.set('s', {
        readerOnly: true,
        handler: () => {
            UIManager.toggleTOC();
            return true;
        }
    });
    
    shortcuts.set('S', {
        readerOnly: true,
        handler: () => {
            UIManager.toggleTOC();
            return true;
        }
    });
}

/**
 * KeyboardHandler - Gestionnaire de raccourcis clavier
 */
export const KeyboardHandler = {
    /**
     * Initialise le gestionnaire
     */
    init() {
        registerDefaultShortcuts();
        document.addEventListener('keydown', this._handleKeydown.bind(this));
        logger.info(`KeyboardHandler initialized with ${shortcuts.size} shortcuts`);
    },
    
    /**
     * Gère les événements keydown
     * @param {KeyboardEvent} e
     * @private
     */
    _handleKeydown(e) {
        // Ignorer si on est dans un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Support clavier pour les cartes de livre
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('book-card')) {
            e.preventDefault();
            const id = parseInt(e.target.dataset.id);
            if (!isNaN(id)) {
                ReaderEngine.open(id);
            }
            return;
        }
        
        // Chercher un raccourci correspondant
        const shortcut = shortcuts.get(e.key);
        if (!shortcut) return;
        
        // Vérifier les conditions
        if (shortcut.readerOnly && !ReaderEngine.isActive()) {
            return;
        }
        
        // Exécuter le handler
        const handled = shortcut.handler(e);
        
        if (handled) {
            e.preventDefault();
            EventBus.emit('keyboard:shortcut', { key: e.key });
        }
    },
    
    /**
     * Enregistre un nouveau raccourci
     * @param {string} key - Touche
     * @param {Object} config - Configuration { handler, readerOnly, global }
     */
    register(key, config) {
        shortcuts.set(key, config);
    },
    
    /**
     * Supprime un raccourci
     * @param {string} key - Touche
     */
    unregister(key) {
        shortcuts.delete(key);
    },
    
    /**
     * Liste tous les raccourcis
     * @returns {string[]}
     */
    list() {
        return Array.from(shortcuts.keys());
    }
};

export default KeyboardHandler;
