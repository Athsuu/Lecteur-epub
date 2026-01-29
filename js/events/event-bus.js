/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS/EVENT-BUS.JS
 * Bus d'événements centralisé (pattern Pub/Sub).
 * Permet la communication découplée entre les modules.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Map des listeners par type d'événement
 * @private
 */
const listeners = new Map();

/**
 * Compteur pour les IDs de listener
 * @private
 */
let listenerId = 0;

/**
 * EventBus - Bus d'événements centralisé
 */
export const EventBus = {
    /**
     * S'abonne à un événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction à appeler
     * @param {Object} options - Options (once: boolean)
     * @returns {number} ID du listener pour désabonnement
     */
    on(event, callback, options = {}) {
        if (!listeners.has(event)) {
            listeners.set(event, new Map());
        }
        
        const id = ++listenerId;
        listeners.get(event).set(id, {
            callback,
            once: options.once || false
        });
        
        return id;
    },
    
    /**
     * S'abonne à un événement pour une seule exécution
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction à appeler
     * @returns {number} ID du listener
     */
    once(event, callback) {
        return this.on(event, callback, { once: true });
    },
    
    /**
     * Se désabonne d'un événement
     * @param {string} event - Nom de l'événement
     * @param {number} id - ID du listener
     */
    off(event, id) {
        if (listeners.has(event)) {
            listeners.get(event).delete(id);
            
            // Nettoyer si plus de listeners
            if (listeners.get(event).size === 0) {
                listeners.delete(event);
            }
        }
    },
    
    /**
     * Émet un événement
     * @param {string} event - Nom de l'événement
     * @param {*} data - Données à transmettre
     */
    emit(event, data = null) {
        if (!listeners.has(event)) return;
        
        const eventListeners = listeners.get(event);
        const toRemove = [];
        
        eventListeners.forEach((listener, id) => {
            try {
                listener.callback(data);
                
                if (listener.once) {
                    toRemove.push(id);
                }
            } catch (error) {
                console.error(`EventBus error in "${event}":`, error);
            }
        });
        
        // Supprimer les listeners "once"
        toRemove.forEach(id => eventListeners.delete(id));
    },
    
    /**
     * Supprime tous les listeners d'un événement
     * @param {string} event - Nom de l'événement
     */
    clear(event) {
        if (event) {
            listeners.delete(event);
        } else {
            listeners.clear();
        }
    },
    
    /**
     * Retourne le nombre de listeners pour un événement
     * @param {string} event - Nom de l'événement
     * @returns {number}
     */
    listenerCount(event) {
        return listeners.has(event) ? listeners.get(event).size : 0;
    },
    
    /**
     * Debug: liste tous les événements avec leurs listeners
     * @returns {Object}
     */
    debug() {
        const result = {};
        listeners.forEach((eventListeners, event) => {
            result[event] = eventListeners.size;
        });
        return result;
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS PRÉDÉFINIS (constantes)
// ═══════════════════════════════════════════════════════════════════════════

export const Events = {
    // Thème
    THEME_CHANGED: 'theme:changed',
    
    // UI
    UI_MODE_CHANGED: 'ui:mode-changed',
    UI_MODAL_OPENED: 'ui:modal-opened',
    UI_MODAL_CLOSED: 'ui:modal-closed',
    UI_TOC_TOGGLED: 'ui:toc-toggled',
    
    // Lecteur
    READER_OPENED: 'reader:opened',
    READER_CLOSED: 'reader:closed',
    READER_FLOW_CHANGED: 'reader:flow-changed',
    READER_RELOCATED: 'reader:relocated',
    READER_FONT_CHANGED: 'reader:font-changed',
    
    // Livre
    BOOK_LOADED: 'book:loaded',
    BOOK_DELETED: 'book:deleted',
    BOOK_IMPORTED: 'book:imported',
    BOOK_FAVORITE_TOGGLED: 'book:favorite_toggled',
    
    // Bibliothèque
    LIBRARY_LOADED: 'library:loaded',
    LIBRARY_FILTERED: 'library:filtered',
    LIBRARY_VIEW_CHANGED: 'library:view_changed',
    
    // Progression
    PROGRESS_SAVED: 'progress:saved',
    CHAPTER_CHANGED: 'chapter:changed',
    
    // Statistiques
    STATS_OPEN_REQUEST: 'stats:open-request',
    STATISTICS_UPDATED: 'stats:updated',
    SESSION_PAUSED: 'session:paused',
    SESSION_RESUMED: 'session:resumed'
};

export default EventBus;
