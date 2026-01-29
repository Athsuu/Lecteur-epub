/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UI/UI-FACTORY.JS
 * Factory pour créer l'instance UI appropriée selon le contexte
 * Gère la détection mobile/desktop et le changement de mode
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { MobileUI } from './mobile-ui.js';
import { DesktopUI } from './desktop-ui.js';
import Logger from '../utils/logger.js';

const logger = new Logger('UIFactory');

/**
 * Breakpoint pour le switch mobile/desktop
 */
const MOBILE_BREAKPOINT = 768;

/**
 * Cache l'instance UI courante
 */
let currentUI = null;

/**
 * Cache des éléments DOM
 */
let cachedElements = null;

/**
 * MediaQueryList pour détecter les changements
 */
let mediaQuery = null;

/**
 * Détecte si on est en mode mobile
 * @returns {boolean}
 */
export function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
}

/**
 * Détecte si on est en mode desktop
 * @returns {boolean}
 */
export function isDesktop() {
    return window.innerWidth > MOBILE_BREAKPOINT;
}

/**
 * Retourne le nom du mode actuel
 * @returns {string} 'mobile' ou 'desktop'
 */
export function getMode() {
    return isMobile() ? 'mobile' : 'desktop';
}

/**
 * Crée et initialise l'instance UI appropriée
 * @param {Object} elements - Cache des éléments DOM
 * @returns {MobileUI|DesktopUI}
 */
export function createUI(elements) {
    cachedElements = elements;
    
    // Détruire l'instance précédente si elle existe
    if (currentUI) {
        currentUI.destroy();
    }
    
    // Créer la nouvelle instance selon le mode
    if (isMobile()) {
        currentUI = new MobileUI(elements);
    } else {
        currentUI = new DesktopUI(elements);
    }
    
    // Initialiser
    currentUI.init();
    
    // Configurer le listener pour les changements de mode
    if (!mediaQuery) {
        _setupMediaQueryListener();
    }
    
    return currentUI;
}

/**
 * Retourne l'instance UI courante
 * @returns {MobileUI|DesktopUI|null}
 */
export function getUI() {
    return currentUI;
}

/**
 * Recrée l'UI pour le mode courant (utile après resize)
 * @returns {MobileUI|DesktopUI}
 */
export function refreshUI() {
    if (!cachedElements) {
        logger.warn('UIFactory: No cached elements, cannot refresh');
        return null;
    }
    return createUI(cachedElements);
}

/**
 * Configure le listener pour les changements de mode
 * @private
 */
function _setupMediaQueryListener() {
    mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    
    const handleModeChange = (e) => {
        const newMode = e.matches ? 'mobile' : 'desktop';
        const currentMode = currentUI?.name === 'MobileUI' ? 'mobile' : 'desktop';
        
        if (newMode !== currentMode && cachedElements) {
            logger.info(`Mode change: ${currentMode} → ${newMode}`);
            
            // Notifier avant le changement
            document.dispatchEvent(new CustomEvent('ui:before-mode-change', {
                detail: { from: currentMode, to: newMode }
            }));
            
            // Recréer l'UI
            createUI(cachedElements);
            
            // Notifier après le changement
            document.dispatchEvent(new CustomEvent('ui:mode-changed', {
                detail: { mode: newMode, ui: currentUI }
            }));
        }
    };
    
    // Utiliser addEventListener moderne
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleModeChange);
    } else {
        // Fallback pour anciens navigateurs
        mediaQuery.addListener(handleModeChange);
    }
}

/**
 * Nettoyage complet du factory
 */
export function destroy() {
    if (currentUI) {
        currentUI.destroy();
        currentUI = null;
    }
    
    cachedElements = null;
    
    // Note: on ne peut pas facilement retirer le listener mediaQuery
    // mais ce n'est pas grave car le factory est généralement persistant
}

/**
 * Export par défaut : objet avec toutes les méthodes
 */
export default {
    isMobile,
    isDesktop,
    getMode,
    createUI,
    getUI,
    refreshUI,
    destroy
};
