/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UI/MOBILE-UI.JS
 * Classe UI spécifique pour l'interface mobile
 * Gère les boutons flottants, dropdowns et gestures tactiles
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BaseUI } from './base-ui.js';
import { StateManager } from '../core/state.js';
import Logger from '../utils/logger.js';

const logger = new Logger('MobileUI');

/**
 * MobileUI - Interface utilisateur mobile
 * Hérite de BaseUI et ajoute les fonctionnalités mobiles
 */
export class MobileUI extends BaseUI {
    constructor(elements) {
        super(elements);
        this.name = 'MobileUI';
        this._resizeHandler = null;
        this._orientationHandler = null;
        this._viewportResizeHandler = null;
    }

    /**
     * Initialisation de l'interface mobile
     */
    init() {
        super.init();
        this._initAdaptiveViewport();
        this._initMobileGestures();
        this.initDropdownState();
        logger.info('Mobile UI initialized');
    }

    /**
     * Nettoyage de l'interface mobile
     */
    destroy() {
        // Retirer les listeners
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }
        if (this._orientationHandler) {
            window.removeEventListener('orientationchange', this._orientationHandler);
        }
        if (window.visualViewport && this._viewportResizeHandler) {
            window.visualViewport.removeEventListener('resize', this._viewportResizeHandler);
            window.visualViewport.removeEventListener('scroll', this._viewportResizeHandler);
        }
        
        // Fermer tous les dropdowns
        this.closeAllDropdowns();
        
        super.destroy();
        logger.info('Mobile UI destroyed');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADAPTATION VIEWPORT MOBILE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Initialise l'adaptation automatique du viewport
     * @private
     */
    _initAdaptiveViewport() {
        this._updateAdaptiveVars();
        
        this._resizeHandler = () => this._updateAdaptiveVars();
        this._orientationHandler = () => this._updateAdaptiveVars();
        this._viewportResizeHandler = () => this._updateAdaptiveVars();

        window.addEventListener('resize', this._resizeHandler, { passive: true });
        window.addEventListener('orientationchange', this._orientationHandler, { passive: true });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._viewportResizeHandler, { passive: true });
            window.visualViewport.addEventListener('scroll', this._viewportResizeHandler, { passive: true });
        }
    }

    /**
     * Met à jour les variables CSS pour l'adaptation mobile
     * @private
     */
    _updateAdaptiveVars() {
        const vv = window.visualViewport;
        const vw = vv?.width || window.innerWidth || document.documentElement.clientWidth;
        const vh = vv?.height || window.innerHeight || document.documentElement.clientHeight;

        // Base iPhone 13 width ~390px
        const baseWidth = 390;
        const scale = Math.min(1.05, Math.max(0.9, vw / baseWidth));

        const root = document.documentElement;
        root.style.setProperty('--mobile-bar-height', `${Math.round(58 * scale)}px`);
        root.style.setProperty('--mobile-bar-radius', `${Math.round(20 * scale)}px`);
        root.style.setProperty('--mobile-bar-padding-x', `${Math.round(12 * scale)}px`);
        root.style.setProperty('--mobile-bar-padding-y', `${Math.round(6 * scale)}px`);
        root.style.setProperty('--mobile-bar-bottom-gap', `${Math.round(6 * scale)}px`);
        root.style.setProperty('--mobile-bar-side-gap', `${Math.round(10 * scale)}px`);
        root.style.setProperty('--mobile-icon-size', `${Math.round(42 * scale)}px`);
        root.style.setProperty('--mobile-icon-radius', `${Math.round(14 * scale)}px`);

        const contentPaddingX = Math.max(12, Math.min(24, Math.round(vw * 0.05)));
        root.style.setProperty('--content-padding-x', `${contentPaddingX}px`);

        root.style.setProperty('--mobile-vw', `${vw}px`);
        root.style.setProperty('--mobile-vh', `${vh}px`);
    }

    /**
     * Initialise les gestures mobiles
     * @private
     */
    _initMobileGestures() {
        // Les gestures de swipe sont gérées dans events.js
        // Ici on pourrait ajouter des gestures spécifiques
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GESTION DES DROPDOWNS MOBILE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Ferme tous les dropdowns mobiles
     */
    closeAllDropdowns() {
        // Nettoyage spécifique si nécessaire (actuellement géré par UIManager)
    }

    /**
     * Met à jour l'affichage de la taille de police dans le dropdown
     */
    updateDropdownFontSize() {
        const fontSize = StateManager.get('fontSize');
        if (this.elements.dropdownFontSize) {
            this.elements.dropdownFontSize.textContent = `${fontSize}%`;
        }
    }

    /**
     * Met à jour l'affichage du mode de lecture dans le dropdown
     */
    updateDropdownFlow() {
        const flow = StateManager.get('readerFlow');
        const scrollBtn = this.elements.dropdownFlowScroll;
        const paginatedBtn = this.elements.dropdownFlowPaginated;

        scrollBtn?.classList.toggle('is-selected', flow === 'scrolled');
        paginatedBtn?.classList.toggle('is-selected', flow === 'paginated');
    }

    /**
     * Met à jour l'affichage du thème actif dans les dropdowns
     */
    updateDropdownTheme() {
        const theme = StateManager.get('theme');
        const themeButtons = document.querySelectorAll('.dropdown-theme-btn');

        themeButtons.forEach(btn => {
            const isActive = (
                (btn.classList.contains('theme-light') && theme === 'light') ||
                (btn.classList.contains('theme-dark') && theme === 'dark') ||
                (btn.classList.contains('theme-sepia') && theme === 'sepia')
            );
            btn.classList.toggle('is-selected', isActive);
        });
    }

    /**
     * Initialise l'état des dropdowns avec les valeurs actuelles
     */
    initDropdownState() {
        this.updateDropdownFontSize();
        this.updateDropdownFlow();
        this.updateDropdownTheme();
    }

    /**
     * Met à jour le TOC mobile
     * @param {Array} chapters - Liste des chapitres
     */
    updateMobileToc(chapters) {
        // Géré par UIManager (Bottom Sheet)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OVERRIDE : TOC MOBILE (utilise dropdown au lieu de sidebar)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Bascule l'affichage du sommaire (version mobile via dropdown)
     */
    toggleTOC() {
        // Géré par UIManager
    }

    /**
     * Ferme le sommaire (version mobile)
     */
    closeTOC() {
        // Géré par UIManager
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OVERRIDE : Titre reader mobile
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Définit le titre affiché dans le lecteur (desktop + mobile)
     * @param {string} title - Titre du livre
     */
    setReaderTitle(title) {
        const displayTitle = title || 'Chargement...';
        // Desktop fallback
        if (this.elements.readerTitle) {
            this.elements.readerTitle.textContent = displayTitle;
        }
        // Mobile header (si présent)
        if (this.elements.readerTitleMobile) {
            this.elements.readerTitleMobile.textContent = displayTitle;
        }
    }
}
