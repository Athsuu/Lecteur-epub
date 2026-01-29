/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READER/SCROLL-READER.JS
 * Mode de lecture en défilement continu (scroll).
 * Optimisé pour la lecture sur mobile avec navigation fluide.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BaseReader } from './base-reader.js';
import { StateManager } from '../core/state.js';
import { UIManager } from '../ui/ui-manager.js';

/**
 * ScrollReader - Mode de lecture en défilement
 */
export class ScrollReader extends BaseReader {
    constructor() {
        super();
        this.name = 'ScrollReader';
        this.flow = 'scrolled';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CRÉATION DU RENDU
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Crée le rendu epub.js en mode scroll
     * @returns {ePub.Rendition}
     */
    _createRendition() {
        return this.book.renderTo('viewer', {
            flow: 'scrolled',
            width: '100%',
            height: '100%',
            spread: 'none'
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION SPÉCIFIQUE SCROLL
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Configuration spécifique au mode scroll
     */
    _setupModeSpecific() {
        // En mode scroll, pas de navigation par clic
        const viewer = UIManager.get('viewer');
        if (viewer) {
            viewer.style.cursor = 'default';
        }
        
        // Mettre à jour la classe CSS du lecteur
        UIManager.updateReaderMode('scrolled');
        
        // Injecter la navigation de chapitres (mobile + desktop)
        this.rendition.on('rendered', () => {
            this._injectChapterNavigation();
        });
    }

    /**
     * Retourne le padding du body pour le mode scroll
     * @param {boolean} isMobile
     * @returns {string}
     */
    _getBodyPadding(isMobile) {
        if (isMobile) {
            return '70px 5vw 0 5vw !important';
        }
        return '60px 10% 200px 10% !important';
    }

    /**
     * Retourne la hauteur max des images en mode scroll
     * @returns {string}
     */
    _getImageMaxHeight() {
        return 'none !important';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION PAR CHAPITRES (MOBILE)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Injecte les boutons de navigation de chapitre dans le contenu
     * Mobile uniquement, visible en fin de chapitre
     */
    /**
     * Handler appelé lors du changement de position
     * @param {Object} location
     */
    _onRelocated(location) {
        super._onRelocated(location);
        // Réinjecter la navigation après chaque relocation
        this._injectChapterNavigation();
    }
}
