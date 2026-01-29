/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READER/PAGED-READER.JS
 * Mode de lecture paginé (livre traditionnel).
 * Optimisé pour desktop avec navigation par zones cliquables.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BaseReader } from './base-reader.js';
import { Config } from '../core/config.js';
import { StateManager } from '../core/state.js';
import { UIManager } from '../ui/ui-manager.js';
import { EventBus } from '../events/event-bus.js';

/**
 * PagedReader - Mode de lecture paginé
 */
export class PagedReader extends BaseReader {
    constructor() {
        super();
        this.name = 'PagedReader';
        this.flow = 'paginated';
        this._paginationClickHandler = null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CRÉATION DU RENDU
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Crée le rendu epub.js en mode paginé
     * @returns {ePub.Rendition}
     */
    _createRendition() {
        const isMobile = UIManager.isMobile();
        
        // Sur mobile: toujours spread: 'none' (single page)
        // Sur desktop grand écran: spread auto pour affichage double page
        const spread = (!isMobile && window.innerWidth >= Config.SPREAD_MIN_WIDTH) 
            ? 'auto' 
            : 'none';
        
        return this.book.renderTo('viewer', {
            flow: 'paginated',
            width: '100%',
            height: '100%',
            spread: spread
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION SPÉCIFIQUE PAGINATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Configuration spécifique au mode pagination
     */
    _setupModeSpecific() {
        // Écouter les événements de navigation du gesture-handler
        this._setupNavigationListeners();
        
        // Mettre à jour la classe CSS du lecteur
        UIManager.updateReaderMode('paginated');
        
        // Injecter la navigation de chapitres (desktop + mobile)
        this.rendition.on('rendered', () => {
            this._injectChapterNavigation();
        });

        // Générer les locations pour le pourcentage de progression
        this.book.locations.generate(1600).then(() => {
            console.log('📍 Locations générées pour le suivi de progression');
        });
    }

    /**
     * Détruit le lecteur et nettoie les ressources
     */
    destroy() {
        // Retirer les listeners d'événements
        if (this._prevHandler) {
            EventBus.off('reader:prev', this._prevHandler);
            this._prevHandler = null;
        }
        if (this._nextHandler) {
            EventBus.off('reader:next', this._nextHandler);
            this._nextHandler = null;
        }
        
        super.destroy();
    }

    /**
     * Retourne le padding du body pour le mode paginé
     * @param {boolean} isMobile
     * @returns {string}
     */
    _getBodyPadding(isMobile) {
        if (isMobile) {
            return '70px 5vw 0 5vw !important';
        }
        return '60px 10% 60px 10% !important';
    }

    /**
     * Retourne la hauteur max des images en mode paginé
     * @returns {string}
     */
    _getImageMaxHeight() {
        return '80vh !important';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION PAR ZONES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Configure les listeners pour la navigation
     * Écoute les événements reader:prev et reader:next émis par le gesture-handler
     */
    _setupNavigationListeners() {
        // Stocker les handlers pour pouvoir les retirer plus tard
        this._prevHandler = () => this.prevPage();
        this._nextHandler = () => this.nextPage();
        
        EventBus.on('reader:prev', this._prevHandler);
        EventBus.on('reader:next', this._nextHandler);
        
        // Indiquer visuellement les zones cliquables
        const viewer = UIManager.get('viewer');
        if (viewer) {
            viewer.style.cursor = 'pointer';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION PAR PAGES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Va à la page précédente
     */
    prevPage() {
        if (!this.rendition) return;
        this.rendition.prev();
    }

    /**
     * Va à la page suivante
     */
    nextPage() {
        if (!this.rendition) return;
        this.rendition.next();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INDICATEUR DE PROGRESSION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Met à jour l'indicateur de progression
     * @param {Object} location - Objet location d'epub.js
     */
    _updateProgressIndicator(location) {
        if (!location) return;
        
        // En mode pagination, afficher le pourcentage
        const percentage = this.book.locations ? 
            Math.round(location.start.percentage * 100) : 0;
        
        UIManager.updateProgressText(`${percentage}%`);
    }

    /**
     * Injection de navigation après relocation pour paginé
     */
    _onRelocated(location) {
        super._onRelocated(location);
        this._injectChapterNavigation();
    }
}