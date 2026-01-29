/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UI/DESKTOP-UI.JS
 * Classe UI spécifique pour l'interface desktop
 * Gère les barres flottantes, TOC sidebar et interactions souris
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BaseUI } from './base-ui.js';
import { StateManager } from '../core/state.js';

/**
 * DesktopUI - Interface utilisateur desktop
 * Hérite de BaseUI et ajoute les fonctionnalités desktop
 */
export class DesktopUI extends BaseUI {
    constructor(elements) {
        super(elements);
        this.name = 'DesktopUI';
        this._keyboardHandler = null;
    }

    /**
     * Initialisation de l'interface desktop
     */
    init() {
        super.init();
        this._initKeyboardShortcuts();
        this._initFloatingBars();
        this._updateDesktopVars();
        console.log('🖥️ Desktop UI initialized');
    }

    /**
     * Nettoyage de l'interface desktop
     */
    destroy() {
        // Retirer les listeners clavier
        if (this._keyboardHandler) {
            document.removeEventListener('keydown', this._keyboardHandler);
        }
        
        // Fermer le TOC
        this.closeTOC();
        
        super.destroy();
        console.log('🖥️ Desktop UI destroyed');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VARIABLES CSS DESKTOP
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Met à jour les variables CSS pour desktop
     * @private
     */
    _updateDesktopVars() {
        const root = document.documentElement;
        const vw = window.innerWidth;

        // Padding adaptatif selon la largeur
        if (vw >= 1400) {
            root.style.setProperty('--content-padding-x', '15vw');
        } else if (vw >= 1024) {
            root.style.setProperty('--content-padding-x', '12vw');
        } else {
            root.style.setProperty('--content-padding-x', '10vw');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BARRES FLOTTANTES DESKTOP
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Initialise les barres flottantes desktop
     * @private
     */
    _initFloatingBars() {
        // Les barres flottantes sont affichées via CSS media query
        // Ici on peut ajouter des comportements supplémentaires
        
        // Auto-hide des barres au scroll (optionnel)
        // this._initAutoHideOnScroll();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RACCOURCIS CLAVIER DESKTOP
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Initialise les raccourcis clavier desktop
     * @private
     */
    _initKeyboardShortcuts() {
        this._keyboardHandler = (e) => {
            // Ne pas interférer avec les inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    this._handleEscapeKey();
                    break;
                case 't':
                case 'T':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.toggleTOC();
                    }
                    break;
                case '+':
                case '=':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        document.dispatchEvent(new CustomEvent('action', {
                            detail: { action: 'font-increase' }
                        }));
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        document.dispatchEvent(new CustomEvent('action', {
                            detail: { action: 'font-decrease' }
                        }));
                    }
                    break;
            }
        };

        document.addEventListener('keydown', this._keyboardHandler);
    }

    /**
     * Gère la touche Escape
     * @private
     */
    _handleEscapeKey() {
        // Fermer le TOC si ouvert
        if (StateManager.get('tocOpen')) {
            this.closeTOC();
            return;
        }
        
        // Fermer la modale si ouverte
        if (this.elements.bookModal?.classList.contains('active')) {
            this.closeModal();
            return;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GESTION DU TOC DESKTOP (SIDEBAR)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Bascule l'affichage du sommaire (version desktop - sidebar)
     */
    toggleTOC() {
        const isOpen = !StateManager.get('tocOpen');
        StateManager.set('tocOpen', isOpen);

        this.elements.tocSidebar?.classList.toggle('open', isOpen);
        this.elements.tocOverlay?.classList.toggle('active', isOpen);
        this.elements.readerView?.classList.toggle('toc-active', isOpen);

        // Animation de la barre flottante gauche
        if (this.elements.floatingBarLeft) {
            if (isOpen) {
                this.elements.floatingBarLeft.style.opacity = '0';
                this.elements.floatingBarLeft.style.pointerEvents = 'none';
                this.elements.floatingBarLeft.style.transform = 'translateX(-20px)';
            } else {
                this.elements.floatingBarLeft.style.opacity = '';
                this.elements.floatingBarLeft.style.pointerEvents = '';
                this.elements.floatingBarLeft.style.transform = '';
            }
        }
    }

    /**
     * Ferme le sommaire (version desktop)
     */
    closeTOC() {
        StateManager.set('tocOpen', false);

        this.elements.tocSidebar?.classList.remove('open');
        this.elements.tocOverlay?.classList.remove('active');
        this.elements.readerView?.classList.remove('toc-active');

        // Restaurer la barre flottante gauche
        if (this.elements.floatingBarLeft) {
            this.elements.floatingBarLeft.style.opacity = '';
            this.elements.floatingBarLeft.style.pointerEvents = '';
            this.elements.floatingBarLeft.style.transform = '';
        }
    }

    /**
     * Met à jour le TOC desktop
     * @param {Array} chapters - Liste des chapitres
     */
    updateToc(chapters) {
        const tocList = this.elements.tocList;
        if (!tocList) return;

        tocList.innerHTML = '';
        chapters.forEach(chapter => {
            const li = document.createElement('li');
            li.className = 'toc-item';
            li.textContent = chapter.label;
            li.dataset.href = chapter.href;
            li.dataset.action = 'goto-chapter';
            
            // Niveau de hiérarchie
            if (chapter.level) {
                li.dataset.level = chapter.level;
            }
            
            tocList.appendChild(li);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HOVER PREVIEW (fonctionnalité desktop uniquement)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Affiche un preview au survol d'un chapitre
     * @param {string} href - URL du chapitre
     */
    showChapterPreview(href) {
        // Fonctionnalité optionnelle pour plus tard
    }

    /**
     * Cache le preview
     */
    hideChapterPreview() {
        // Fonctionnalité optionnelle pour plus tard
    }
}
