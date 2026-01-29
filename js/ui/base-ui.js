/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UI/BASE-UI.JS
 * Classe de base abstraite pour l'UI
 * Contient les méthodes communes Desktop et Mobile
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { StateManager } from '../core/state.js';

/**
 * BaseUI - Classe abstraite de base pour l'interface utilisateur
 * Contient les méthodes partagées entre Mobile et Desktop
 */
export class BaseUI {
    constructor(elements) {
        this.elements = elements;
        this.name = 'BaseUI';
    }

    /**
     * Initialisation spécifique à la plateforme (à surcharger)
     */
    init() {
        console.log(`🖥️ ${this.name} initialized`);
    }

    /**
     * Nettoyage lors du changement de mode (à surcharger)
     */
    destroy() {
        console.log(`🖥️ ${this.name} destroyed`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION ENTRE VUES (COMMUN)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Affiche la vue bibliothèque et masque le lecteur
     */
    showLibrary() {
        this.elements.libraryView?.classList.remove('hidden');
        this.elements.readerView?.classList.remove('active');
    }

    /**
     * Affiche le lecteur et masque la bibliothèque
     */
    showReader() {
        this.elements.libraryView?.classList.add('hidden');
        this.elements.readerView?.classList.add('active');
    }

    /**
     * Met à jour la classe du lecteur en fonction du mode (scroll/pagination)
     * @param {string} flow - 'scrolled' ou 'paginated'
     */
    updateReaderMode(flow) {
        if (this.elements.readerView) {
            this.elements.readerView.classList.toggle('pagination-mode', flow === 'paginated');
        }
    }

    /**
     * Définit le titre affiché dans le lecteur
     * @param {string} title - Titre du livre
     */
    setReaderTitle(title) {
        const displayTitle = title || 'Chargement...';
        if (this.elements.readerTitle) {
            this.elements.readerTitle.textContent = displayTitle;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GESTION DU SOMMAIRE (TOC) - COMMUN
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Bascule l'affichage du sommaire (à surcharger pour mobile)
     */
    toggleTOC() {
        const isOpen = !StateManager.get('tocOpen');
        StateManager.set('tocOpen', isOpen);

        this.elements.tocSidebar?.classList.toggle('open', isOpen);
        this.elements.tocOverlay?.classList.toggle('active', isOpen);
        this.elements.readerView?.classList.toggle('toc-active', isOpen);
    }

    /**
     * Ferme le sommaire
     */
    closeTOC() {
        StateManager.set('tocOpen', false);

        this.elements.tocSidebar?.classList.remove('open');
        this.elements.tocOverlay?.classList.remove('active');
        this.elements.readerView?.classList.remove('toc-active');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GESTION DES MODALES (COMMUN)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Affiche la modale de détails du livre
     */
    showModal() {
        this.elements.bookModal?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Ferme la modale
     */
    closeModal() {
        this.elements.bookModal?.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Affiche un message de statut temporaire
     * @param {string} message - Texte à afficher
     * @param {number} duration - Durée d'affichage en ms
     */
    showStatus(message, duration = 2000) {
        const statusEl = this.elements.statusMessage;
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.classList.add('visible');

        clearTimeout(statusEl._hideTimeout);
        statusEl._hideTimeout = setTimeout(() => {
            statusEl.classList.remove('visible');
        }, duration);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BARRE DE PROGRESSION (COMMUN)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Met à jour la barre de progression
     * @param {number} percent - Pourcentage (0-100)
     */
    updateProgress(percent) {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    /**
     * Met à jour l'indicateur de progression textuel
     * @param {string} text - Texte à afficher
     */
    updateProgressText(text) {
        let indicator = document.getElementById('progressIndicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'progressIndicator';
            indicator.className = 'progress-indicator';

            const viewer = this.elements.viewer;
            if (viewer && viewer.parentElement) {
                viewer.parentElement.appendChild(indicator);
            }
        }

        if (indicator) {
            indicator.textContent = text;
            indicator.style.opacity = '1';

            clearTimeout(indicator._hideTimeout);
            indicator._hideTimeout = setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MÉTHODES SPÉCIFIQUES MOBILE (stubs - à surcharger)
    // ═══════════════════════════════════════════════════════════════════════

    toggleMobileSettings() {
        // Stub - implémenté dans MobileUI
    }

    toggleMobileToc() {
        // Stub - implémenté dans MobileUI
    }

    closeAllDropdowns() {
        // Stub - implémenté dans MobileUI
    }

    updateDropdownFontSize() {
        // Stub - implémenté dans MobileUI
    }

    updateDropdownFlow() {
        // Stub - implémenté dans MobileUI
    }

    updateDropdownTheme() {
        // Stub - implémenté dans MobileUI
    }

    initDropdownState() {
        // Stub - implémenté dans MobileUI
    }

    updateMobileToc(chapters) {
        // Stub - implémenté dans MobileUI
    }

    /**
     * Met à jour les boutons de mode de lecture
     * @param {string} flow - 'scrolled' ou 'paginated'
     */
    updateFlowButton(flow) {
        // Boutons desktop et mobile
        const btnDesktop = document.getElementById('flowToggleBtn');
        const btnMobile = document.getElementById('flowToggleBtnMobile');
        
        const updateBtn = (btn) => {
            if (!btn) return;
            const span = btn.querySelector('span') || btn;
            if (flow === 'scrolled') {
                span.textContent = '📄';
                btn.title = 'Mode pagination';
            } else {
                span.textContent = '📖';
                btn.title = 'Mode défilement';
            }
        };
        
        updateBtn(btnDesktop);
        updateBtn(btnMobile);
    }
}
