/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READER/READER-FACTORY.JS
 * Factory pour créer l'instance Reader appropriée selon le mode de lecture.
 * Gère le switch entre ScrollReader et PagedReader.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ScrollReader } from './scroll-reader.js';
import { PagedReader } from './paged-reader.js';
import { StateManager } from '../core/state.js';
import { StorageKeys } from '../core/config.js';

/**
 * Instance Reader courante
 * @private
 */
let currentReader = null;

/**
 * Instance du livre epub.js (partagée entre les readers)
 * @private
 */
let sharedBook = null;

/**
 * Retourne le mode de lecture actuel
 * @returns {string} 'scrolled' ou 'paginated'
 */
export function getFlow() {
    return StateManager.get('readerFlow') || 'scrolled';
}

/**
 * Vérifie si le mode est scroll
 * @returns {boolean}
 */
export function isScrollMode() {
    return getFlow() === 'scrolled';
}

/**
 * Vérifie si le mode est paginé
 * @returns {boolean}
 */
export function isPagedMode() {
    return getFlow() === 'paginated';
}

/**
 * Crée et retourne l'instance Reader appropriée (sans l'initialiser)
 * @param {string} flow - 'scrolled' ou 'paginated'
 * @returns {ScrollReader|PagedReader}
 */
export function createReader(flow = null) {
    const mode = flow || getFlow();
    
    // Créer la nouvelle instance
    if (mode === 'paginated') {
        currentReader = new PagedReader();
    } else {
        currentReader = new ScrollReader();
    }
    
    return currentReader;
}

/**
 * Retourne l'instance Reader courante
 * @returns {ScrollReader|PagedReader|null}
 */
export function getReader() {
    return currentReader;
}

/**
 * Définit le livre partagé
 * @param {ePub.Book} book
 */
export function setBook(book) {
    sharedBook = book;
}

/**
 * Retourne le livre partagé
 * @returns {ePub.Book|null}
 */
export function getBook() {
    return sharedBook;
}

/**
 * Change le mode de lecture et recrée le reader
 * @param {string} newFlow - 'scrolled' ou 'paginated'
 * @returns {Promise<ScrollReader|PagedReader>}
 */
export async function switchFlow(newFlow) {
    if (!['scrolled', 'paginated'].includes(newFlow)) {
        throw new Error(`Flow invalide: ${newFlow}`);
    }
    
    // Sauvegarder la position actuelle
    let currentCFI = null;
    if (currentReader?.isActive()) {
        const location = currentReader.rendition?.currentLocation();
        currentCFI = location?.start?.cfi;
    }
    
    // Mettre à jour l'état
    StateManager.set('readerFlow', newFlow);
    localStorage.setItem(StorageKeys.READER_FLOW, newFlow);
    
    // Si pas de livre chargé, juste créer le reader
    if (!sharedBook) {
        return createReader(newFlow);
    }
    
    // Créer le nouveau reader
    const reader = createReader(newFlow);
    
    // Initialiser avec le livre et la position
    await reader.init(sharedBook, currentCFI);
    
    // Notifier du changement
    document.dispatchEvent(new CustomEvent('reader:flow-changed', {
        detail: { flow: newFlow, reader: currentReader }
    }));
    
    return reader;
}

/**
 * Bascule entre les modes scroll et pagination
 * @returns {Promise<ScrollReader|PagedReader>}
 */
export async function toggleFlow() {
    const currentFlow = getFlow();
    const newFlow = currentFlow === 'scrolled' ? 'paginated' : 'scrolled';
    return switchFlow(newFlow);
}

/**
 * Nettoyage complet du factory
 */
export async function destroy() {
    if (currentReader) {
        await currentReader.destroy();
        currentReader = null;
    }
    sharedBook = null;
}

/**
 * Export par défaut : objet avec toutes les méthodes
 */
export default {
    getFlow,
    isScrollMode,
    isPagedMode,
    createReader,
    getReader,
    setBook,
    getBook,
    switchFlow,
    toggleFlow,
    destroy
};
