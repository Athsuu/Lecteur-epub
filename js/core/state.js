/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STATE.JS
 * Gestionnaire d'état centralisé avec pattern Observer.
 * Permet de synchroniser l'état entre tous les modules de l'application.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config, StorageKeys } from './config.js';
import Logger from '../utils/logger.js';

const logger = new Logger('StateManager');

/**
 * État interne de l'application
 * @private
 */
const state = {
    // Thème actuel (light, dark, sepia)
    theme: localStorage.getItem(StorageKeys.THEME) || 'dark',
    
    // Taille de police en pourcentage
    fontSize: parseInt(localStorage.getItem(StorageKeys.FONT_SIZE)) || Config.FONT.DEFAULT,
    
    // ID du livre actuellement ouvert
    currentBookId: null,
    
    // Nom du chapitre actuel
    currentChapter: null,
    
    // Index du chapitre dans la liste
    currentChapterIndex: -1,
    
    // Liste des chapitres du livre
    chapters: [],
    
    // État d'ouverture du sommaire
    tocOpen: false,
    
    // Mode de lecture (scrolled ou paginated) - récupéré depuis localStorage
    readerFlow: localStorage.getItem(StorageKeys.READER_FLOW) || Config.READER_FLOW_DEFAULT,
    
    // Vue de bibliothèque active (all, favorites, stats)
    libraryView: 'all'
};

/**
 * Map des observateurs pour chaque propriété
 * @private
 */
const observers = new Map();

/**
 * StateManager - Gestionnaire d'état avec pattern Observer
 * Permet de souscrire aux changements de valeurs
 */
export const StateManager = {
    /**
     * Récupère une valeur de l'état
     * @param {string} key - Clé de la propriété
     * @returns {*} Valeur de la propriété
     */
    get(key) {
        return state[key];
    },
    
    /**
     * Définit une valeur dans l'état et notifie les observateurs
     * @param {string} key - Clé de la propriété
     * @param {*} value - Nouvelle valeur
     */
    set(key, value) {
        const oldValue = state[key];
        if (oldValue === value) return;
        
        state[key] = value;
        this.notify(key, value, oldValue);
    },
    
    /**
     * Souscrit aux changements d'une propriété
     * @param {string} key - Clé de la propriété à observer
     * @param {Function} callback - Fonction appelée lors des changements
     * @returns {Function} Fonction pour se désabonner
     */
    subscribe(key, callback) {
        if (!observers.has(key)) {
            observers.set(key, new Set());
        }
        observers.get(key).add(callback);
        
        // Retourne une fonction pour se désabonner
        return () => observers.get(key).delete(callback);
    },
    
    /**
     * Notifie tous les observateurs d'une propriété
     * @param {string} key - Clé de la propriété
     * @param {*} value - Nouvelle valeur
     * @param {*} oldValue - Ancienne valeur
     * @private
     */
    notify(key, value, oldValue) {
        if (observers.has(key)) {
            observers.get(key).forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    logger.error(`Observer error for "${key}"`, error);
                }
            });
        }
    },
    
    /**
     * Définit une valeur et la persiste dans localStorage
     * @param {string} storageKey - Clé localStorage
     * @param {string} stateKey - Clé de l'état
     * @param {*} value - Valeur à persister
     */
    persist(storageKey, stateKey, value) {
        localStorage.setItem(storageKey, value);
        this.set(stateKey, value);
    },
    
    /**
     * Réinitialise l'état du lecteur (lors de la fermeture d'un livre)
     */
    resetReaderState() {
        this.set('currentBookId', null);
        this.set('currentChapter', null);
        this.set('currentChapterIndex', -1);
        this.set('chapters', []);
        this.set('tocOpen', false);
    },
    
    /**
     * Récupère tout l'état (pour debug)
     * @returns {Object} Copie de l'état
     */
    getState() {
        return { ...state };
    }
};
