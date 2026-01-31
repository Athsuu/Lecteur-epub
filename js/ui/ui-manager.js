/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UI.JS
 * Gestionnaire de l'interface utilisateur avec architecture adaptative.
 * Utilise le pattern Factory pour instancier MobileUI ou DesktopUI.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config } from '../core/config.js';
import { EventBus } from '../events/event-bus.js';
import UIFactory, { isMobile, isDesktop, getMode, createUI, getUI } from './ui-factory.js';
import Logger from '../utils/logger.js';

const logger = new Logger('UIManager');

const isIOSDevice = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const scrollLockState = {
    active: false,
    scrollY: 0
};

function lockBodyScroll() {
    if (scrollLockState.active) return;
    scrollLockState.scrollY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollLockState.scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    scrollLockState.active = true;
}

function unlockBodyScroll() {
    if (!scrollLockState.active) return;
    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo(0, scrollLockState.scrollY);
    scrollLockState.active = false;
}

function syncIOSScrollLock() {
    if (!isIOSDevice()) return;
    if (UIManager.hasOpenOverlays()) {
        lockBodyScroll();
    } else {
        unlockBodyScroll();
    }
}

/**
 * Cache des éléments DOM fréquemment utilisés
 * @private
 */
const elements = {};

/**
 * Instance UI courante (MobileUI ou DesktopUI)
 * @private
 */
let currentUIInstance = null;

/**
 * Cache des données du sommaire pour le filtrage (View State)
 * @private
 */
let mobileTocData = [];

/**
 * Liste des IDs d'éléments à mettre en cache
 * @private
 */
const elementIds = [
    'libraryView', 'readerView', 'booksList', 'fileInput',
    'bookModal', 'bookModalContent', 'readerTitle', 'viewer',
    'tocSidebar', 'tocOverlay', 'tocList', 'progressBar',
    'statusMessage', 'searchInput', 'readerContent',
    // Mobile elements
    'settingsDropdown', 'tocBottomSheet', 'bottomSheetOverlay', 'mobileDropdownOverlay',
    'dropdownFontSize', 'dropdownFlowScroll', 'dropdownFlowPaginated',
    'tocListMobile', 'btnSettingsToggle', 'btnTocToggle', 'tocSearchInput', 'tocSearchClear',
    'mobileFloatLeft', 'mobileFloatRight',
    // Desktop elements
    'floatingBarLeft', 'floatingBarRight', 'flowToggleBtn'
];

/**
 * Initialise le cache des éléments DOM
 * @private
 */
function cacheElements() {
    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
        if (!elements[id]) {
            logger.warn(`Element not found: #${id}`);
        }
    });
}

/**
 * Formate le code de langue en nom lisible
 * @param {string} lang - Code de langue (en, fr, es, etc.)
 * @returns {string} Nom de la langue
 * @private
 */
function formatLanguage(lang) {
    if (!lang) return '';
    const map = {
        en: 'English',
        fr: 'Français',
        es: 'Español',
        de: 'Deutsch',
        it: 'Italiano',
        pt: 'Português',
        nl: 'Nederlands',
        ru: 'Русский',
        ja: '日本語',
        zh: '中文'
    };
    const code = lang.toLowerCase().substring(0, 2);
    return map[code] || lang.toUpperCase();
}

/**
 * UIManager - Gestionnaire de l'interface utilisateur
 * Délègue les opérations à l'instance UI appropriée (Mobile ou Desktop)
 */
export const UIManager = {
    /**
     * Initialise l'UIManager et crée l'instance UI appropriée
     */
    init() {
        cacheElements();
        
        // Créer l'instance UI via le factory
        currentUIInstance = createUI(elements);
        
        // Initialiser les gestes tactiles pour le Bottom Sheet
        this.initBottomSheetGestures();
        
        // Initialiser la recherche dans le sommaire
        this.initTocSearch();
        
        // Écouter la demande de bascule d'interface (Double Tap)
        EventBus.on('ui:toggle-interface', () => this.toggleInterface());

        // Tap simple au centre (provenant du contenu EPUB) :
        // - si un panneau/overlay est ouvert -> on ferme tout
        // - sinon -> on toggle l'interface
        EventBus.on('ui:center-tap', () => this.handleCenterTap());
        
        // Écouter les changements de mode
        document.addEventListener('ui:mode-changed', (e) => {
            currentUIInstance = e.detail.ui;
            logger.info(`UI instance switched to: ${currentUIInstance.name}`);
        });
        
        logger.info(`UI Manager initialized (${getMode()} mode)`);
    },
    
    /**
     * Retourne l'instance UI courante
     * @returns {import('./ui/base-ui.js').BaseUI}
     */
    getUIInstance() {
        return currentUIInstance || getUI();
    },
    
    /**
     * Vérifie si on est en mode mobile
     * @returns {boolean} True si mobile
     */
    isMobile() {
        return isMobile();
    },
    
    /**
     * Vérifie si on est en mode desktop
     * @returns {boolean} True si desktop
     */
    isDesktop() {
        return isDesktop();
    },
    
    /**
     * Récupère un élément du cache
     * @param {string} id - ID de l'élément
     * @returns {HTMLElement|null} L'élément ou null
     */
    get(id) {
        return elements[id] || document.getElementById(id);
    },

    /**
     * Bascule l'affichage de l'interface utilisateur (Mode immersif)
     * Ajoute/retire une classe sur le body pour que le CSS gère les transitions
     */
    toggleInterface() {
        document.body.classList.toggle('ui-hidden');
        
        // Log pour débugger
        const isHidden = document.body.classList.contains('ui-hidden');
        logger.info(`Interface ${isHidden ? 'hidden' : 'visible'}`);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // DÉLÉGATION AUX MÉTHODES DE L'UI COURANTE
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * Affiche un message de statut temporaire
     */
    showStatus(message, duration = Config.STATUS_DURATION) {
        currentUIInstance?.showStatus(message, duration);
    },
    
    showLibrary() {
        currentUIInstance?.showLibrary();
    },
    
    showReader() {
        currentUIInstance?.showReader();
    },
    
    updateReaderMode(flow) {
        currentUIInstance?.updateReaderMode(flow);
    },
    
    setReaderTitle(title) {
        currentUIInstance?.setReaderTitle(title);
    },
    
    toggleTOC() {
        currentUIInstance?.toggleTOC();
        syncIOSScrollLock();
    },
    
    closeTOC() {
        currentUIInstance?.closeTOC();
        syncIOSScrollLock();
    },
    
    showModal() {
        currentUIInstance?.showModal();
        syncIOSScrollLock();
    },
    
    closeModal() {
        currentUIInstance?.closeModal();
        syncIOSScrollLock();
    },
    
    updateProgress(percent) {
        currentUIInstance?.updateProgress(percent);
    },
    
    updateProgressText(text) {
        currentUIInstance?.updateProgressText(text);
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTHODES MOBILE SPÉCIFIQUES (délégation conditionnelle)
    // ═══════════════════════════════════════════════════════════════════════
    
    toggleMobileSettings() {
        const settings = this.get('settingsDropdown');
        const overlay = this.get('mobileDropdownOverlay');
        const btn = this.get('btnSettingsToggle');
        if (!settings) return;
        const isOpen = settings.classList.contains('open');

        // Ferme tous les panneaux et réaffiche les boutons flottants
        this.closeAllDropdowns();

        if (!isOpen) {
            // Si le panneau était fermé, on le rouvre...
            settings.classList.add('open');
            if (btn) btn.classList.add('active');
            if (overlay) overlay.classList.add('active');
        }
        // Si le panneau était ouvert, closeAllDropdowns() a déjà tout géré.
        syncIOSScrollLock();
    },
    
    /**
     * Ouvre ou ferme le sommaire mobile (Bottom Sheet)
     * Surcharge la délégation pour utiliser la nouvelle UI
     */
    toggleMobileToc() {
        const sheet = this.get('tocBottomSheet');
        const overlay = this.get('bottomSheetOverlay');
        
        if (!sheet || !overlay) return;
        const isActive = sheet.classList.contains('active');
        
        // Ferme tous les panneaux et réaffiche les boutons flottants
        this.closeAllDropdowns();

        if (!isActive) {
            // Si le panneau était fermé, on le rouvre...
            sheet.classList.add('active');
            overlay.classList.add('active');
            sheet.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('scroll-lock');
            document.body.classList.add('scroll-lock');
            
            // ...et on masque à nouveau les boutons flottants.
            this.get('mobileFloatLeft')?.classList.add('hidden');
            this.get('mobileFloatRight')?.classList.add('hidden');

            // Focus sur la recherche et reset si nécessaire
            const input = this.get('tocSearchInput');
            const clearBtn = this.get('tocSearchClear');
            if (input) {
                input.value = '';
                this.filterMobileToc('');
                if (clearBtn) clearBtn.style.display = 'none';
            }
        }
        // Si le panneau était ouvert, closeAllDropdowns() a déjà tout géré.
        syncIOSScrollLock();
    },
    
    closeAllDropdowns() {
        // Gère la fermeture du dropdown des paramètres
        const settings = this.get('settingsDropdown');
        if (settings) settings.classList.remove('open');
        
        const btnSettings = this.get('btnSettingsToggle');
        if (btnSettings) btnSettings.classList.remove('active');
        
        const dropdownOverlay = this.get('mobileDropdownOverlay');
        if (dropdownOverlay) dropdownOverlay.classList.remove('active');

        // Gère la fermeture du dropdown des paramètres
        if (currentUIInstance?.closeAllDropdowns) {
            currentUIInstance.closeAllDropdowns();
        }
        
        // Gère la fermeture du Bottom Sheet (sommaire)
        const sheet = this.get('tocBottomSheet');
        const overlay = this.get('bottomSheetOverlay');
        if (sheet && sheet.classList.contains('active')) {
            sheet.classList.remove('active');
            overlay.classList.remove('active');
            sheet.setAttribute('aria-hidden', 'true');
            document.documentElement.classList.remove('scroll-lock');
            document.body.classList.remove('scroll-lock');
        }

        // Réaffiche les boutons flottants
        this.get('mobileFloatLeft')?.classList.remove('hidden');
        this.get('mobileFloatRight')?.classList.remove('hidden');

        syncIOSScrollLock();
    },
    
    updateDropdownFontSize() {
        if (currentUIInstance?.updateDropdownFontSize) {
            currentUIInstance.updateDropdownFontSize();
        }
    },
    
    updateDropdownFlow() {
        if (currentUIInstance?.updateDropdownFlow) {
            currentUIInstance.updateDropdownFlow();
        }
    },
    
    updateDropdownTheme() {
        if (currentUIInstance?.updateDropdownTheme) {
            currentUIInstance.updateDropdownTheme();
        }
    },
    
    initDropdownState() {
        if (currentUIInstance?.initDropdownState) {
            currentUIInstance.initDropdownState();
        }
    },
    
    /**
     * Initialise les gestes tactiles (Swipe Down) pour fermer le Bottom Sheet
     * Optimisé pour la fluidité (60fps) et la gestion des conflits de scroll
     */
    initBottomSheetGestures() {
        const sheet = this.get('tocBottomSheet');
        if (!sheet) return;

        let startY = 0;
        let isDragging = false;
        let startTime = 0;
        let rafId = null; // ID de l'animation pour pouvoir l'annuler

        // Fonction de nettoyage d'urgence
        const resetState = () => {
            isDragging = false;
            if (rafId) cancelAnimationFrame(rafId);
            sheet.style.transform = '';
            sheet.style.transition = '';
        };

        // 1. Touch Start : Capture uniquement sur le header/handle
        sheet.addEventListener('touchstart', (e) => {
            // Empêcher l'événement de remonter au Reader (évite de tourner la page)
            e.stopPropagation();
            
            if (!sheet.classList.contains('active')) return;

            // Vérifier si on touche la zone de contrôle (handle ou header)
            const target = e.target;
            const isControlZone = target.closest('.bottom-sheet-handle-area') || 
                                  target.closest('.bottom-sheet-header');

            if (isControlZone) {
                isDragging = true;
                const touch = e.touches[0];
                startY = touch.clientY;
                startTime = Date.now();
                
                // Arrêter toute animation en cours pour prendre le contrôle immédiat
                if (rafId) cancelAnimationFrame(rafId);
                sheet.style.transition = 'none'; // Désactiver transition pour suivi immédiat
            } else {
                isDragging = false;
            }
        }, { passive: true });

        // 2. Touch Move : Déplacement fluide
        sheet.addEventListener('touchmove', (e) => {
            e.stopPropagation(); // Bloquer la propagation
            if (!isDragging) return;

            // Fermer le clavier automatiquement si on commence à glisser le panneau
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                document.activeElement.blur();
            }

            const touch = e.touches[0];
            const deltaY = touch.clientY - startY;

            // On empêche le scroll natif de la page car on a capturé le geste
            if (e.cancelable) e.preventDefault();
            
            // On ne permet pas de monter le sheet plus haut que 0 (position ouverte)
            const translateY = Math.max(0, deltaY);
            
            // Annuler l'ancienne frame si elle n'est pas encore dessinée
            if (rafId) cancelAnimationFrame(rafId);
            
            rafId = requestAnimationFrame(() => {
                if (!isDragging) return; // Sécurité : si on a lâché entre temps
                sheet.style.transform = `translateY(${translateY}px)`;
            });
        }, { passive: false });

        // 3. Touch End : Décision (Fermer ou Rebondir)
        sheet.addEventListener('touchend', (e) => {
            e.stopPropagation(); // Bloquer la propagation
            if (!isDragging) return;
            
            // Arrêter immédiatement la boucle d'animation
            if (rafId) cancelAnimationFrame(rafId);
            isDragging = false;

            const touch = e.changedTouches[0];
            const deltaY = touch.clientY - startY;
            const time = Date.now() - startTime;
            const velocity = Math.abs(deltaY) / time;

            // Seuil : > 120px de distance OU swipe rapide (> 0.5px/ms)
            if (deltaY > 120 || (deltaY > 40 && velocity > 0.5)) {
                this.closeAllDropdowns(); // Ferme (retire la classe active)
                sheet.style.transform = ''; // Laisse le CSS faire la transition de sortie
                sheet.style.transition = '';
            } else {
                // Rebond vers la position ouverte (0px)
                sheet.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                sheet.style.transform = '';
            }
        });
        
        // 4. Touch Cancel : Sécurité (ex: appel entrant, bug navigateur)
        sheet.addEventListener('touchcancel', (e) => {
            e.stopPropagation();
            resetState();
        });
    },
    
    /**
     * Initialise la recherche dans le sommaire mobile
     */
    initTocSearch() {
        const inputSearch = this.get('tocSearchInput');
        const clearBtn = this.get('tocSearchClear');
        const sheet = this.get('tocBottomSheet');
        
        if (inputSearch) {
            inputSearch.addEventListener('input', (e) => {
                if (clearBtn) clearBtn.style.display = e.target.value ? 'flex' : 'none';
                this.filterMobileToc(e.target.value);
            });
            
            // Agrandir le panneau quand le clavier s'ouvre (focus)
            inputSearch.addEventListener('focus', () => {
                if (sheet) sheet.classList.add('keyboard-open');
            });
            
            // Rétablir la taille quand le clavier se ferme (blur)
            inputSearch.addEventListener('blur', () => {
                if (sheet) sheet.classList.remove('keyboard-open');
            });
            
            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault(); // Empêche le bouton de voler le focus
                    inputSearch.value = '';
                    clearBtn.style.display = 'none';
                    this.filterMobileToc('');
                    inputSearch.focus();
                });
            }
        }
    },

    /**
     * Filtre la liste des chapitres
     * @param {string} query 
     */
    filterMobileToc(query) {
        if (!mobileTocData) return;
        
        const normalizedQuery = query.toLowerCase().trim();
        const filtered = mobileTocData.filter(chapter => 
            chapter.label.toLowerCase().includes(normalizedQuery)
        );
        
        this._renderMobileTocList(filtered);
    },

    /**
     * Met à jour la liste des chapitres dans le Bottom Sheet
     * @param {Array} chapters - Liste des chapitres
     */
    updateMobileToc(chapters) {
        mobileTocData = chapters || [];
        this._renderMobileTocList(mobileTocData);
    },

    /**
     * Rendu interne de la liste (utilisé par update et filter)
     * @private
     */
    _renderMobileTocList(chapters) {
        const list = this.get('tocListMobile');
        if (!list) return;
        
        list.innerHTML = '';
        
        if (!chapters || chapters.length === 0) {
            list.innerHTML = `
                <li style="padding: 48px 24px; text-align: center; list-style: none;">
                    <div style="font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 8px;">Aucun résultat</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Aucun chapitre ne correspond à votre recherche</div>
                </li>
            `;
            return;
        }
        
        // Utiliser un DocumentFragment pour la performance (1 seul reflow)
        const fragment = document.createDocumentFragment();
        
        chapters.forEach(chapter => {
            const li = document.createElement('li');
            li.className = 'sheet-toc-item';
            
            const a = document.createElement('a');
            a.className = 'sheet-toc-link';
            a.textContent = chapter.label.trim();
            a.dataset.href = chapter.href;
            a.dataset.action = 'goto-chapter'; // Sera capturé par l'event handler global
            
            // Ajouter un effet visuel au clic
            a.addEventListener('click', (e) => {
                if (e.currentTarget && typeof e.currentTarget.blur === 'function') e.currentTarget.blur();
                // Fermer tous les menus déroulants (y compris celui-ci) après un court délai
                setTimeout(() => this.closeAllDropdowns(), 150);
            });
            
            li.appendChild(a);
            fragment.appendChild(li);
        });
        
        list.appendChild(fragment);
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTHODES DESKTOP SPÉCIFIQUES (délégation conditionnelle)
    // ═══════════════════════════════════════════════════════════════════════
    
    updateFlowButton(flow) {
        if (currentUIInstance?.updateFlowButton) {
            currentUIInstance.updateFlowButton(flow);
        }
    },
    
    updateToc(chapters) {
        if (currentUIInstance?.updateToc) {
            currentUIInstance.updateToc(chapters);
            return;
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // LOADER - Feedback visuel pour opérations longues
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * Affiche le loader avec un message d'étape
     * @param {string} step - Texte de l'étape (ex: "Analyse du fichier...")
     */
    showLoader(step = 'Chargement en cours...') {
        let overlay = document.getElementById('loaderOverlay');
        
        // Créer le loader s'il n'existe pas
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loaderOverlay';
            overlay.className = 'loader-overlay';
            overlay.innerHTML = `
                <div class="loader-container">
                    <div class="loader-spinner"></div>
                    <div class="loader-text loader-dots" id="loaderText">${this.escapeHtml(step)}</div>
                    <div class="loader-progress">
                        <div class="loader-progress-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        // Mettre à jour le texte
        const textEl = document.getElementById('loaderText');
        if (textEl) {
            textEl.classList.add('updating');
            setTimeout(() => {
                textEl.textContent = this.escapeHtml(step);
                textEl.classList.remove('updating');
            }, 100);
        }
        
        // Afficher le loader avec animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    },
    
    /**
     * Masque le loader
     * @param {number} delay - Délai avant masquage (ms)
     */
    hideLoader(delay = 0) {
        const overlay = document.getElementById('loaderOverlay');
        if (!overlay) return;
        
        setTimeout(() => {
            overlay.classList.remove('active');
            
            // Supprimer du DOM après l'animation
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }, delay);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // TEMPLATES DE RENDU (conservés ici car utilisés par LibraryManager)
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * Génère le HTML de la modale de détails
     * @param {Object} book - Données du livre
     * @param {number} chapterCount - Nombre de chapitres
     * @returns {string} HTML de la modale
     */
    renderBookModal(book, chapterCount = 0) {
        const coverHTML = book.coverUrl 
            ? `<img src="${book.coverUrl}" alt="${this.escapeHtml(book.title)}">`
            : '<span>📖</span>';
        
        const buttonText = book.lastChapter ? 'Continuer la lecture' : 'Commencer la lecture';
        
        return `
            <button class="book-modal-close" data-action="close-modal">×</button>
            <div class="book-modal-header">
                <div class="book-modal-cover">${coverHTML}</div>
                <div class="book-modal-info">
                    <h2>${this.escapeHtml(book.title)}</h2>
                    <div class="author">${this.escapeHtml(book.author || 'Auteur inconnu')}</div>
                    ${book.publisher ? `<div style="font-size:0.85rem;color:var(--text-muted)">Éditeur: ${this.escapeHtml(book.publisher)}</div>` : ''}
                    ${book.language ? `<div style="font-size:0.85rem;color:var(--text-muted);margin-top:5px">Langue: ${book.language.toUpperCase()}</div>` : ''}
                </div>
            </div>
            
            ${book.description ? `
                <div class="book-modal-section">
                    <h3>Synopsis</h3>
                    <p>${this.escapeHtml(book.description)}</p>
                </div>
            ` : ''}
            
            <div class="book-modal-section">
                <h3>Statistiques</h3>
                <div class="book-modal-stats">
                    <div class="book-stat">
                        <div class="book-stat-value">${chapterCount}</div>
                        <div class="book-stat-label">Chapitres</div>
                    </div>
                    <div class="book-stat">
                        <div class="book-stat-value">${book.lastChapter ? '📖' : '📕'}</div>
                        <div class="book-stat-label">${book.lastChapter ? 'En cours' : 'Non commencé'}</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top:30px;display:flex;gap:12px">
                <button class="btn btn-primary" style="flex:1" data-action="open-book" data-id="${book.id}">${buttonText}</button>
                <button class="btn btn-secondary" data-action="close-modal">Fermer</button>
            </div>
        `;
    },
    
    /**
     * Échappe les caractères HTML dangereux
     * @param {string} text - Texte à échapper
     * @returns {string} Texte échappé
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Détecte si une UI "transitoire" est ouverte (overlays, panneaux, modales).
     * Important : on s'appuie sur les classes CSS (source de vérité côté DOM).
     * @returns {boolean}
     */
    hasOpenOverlays() {
        // Modale détails livre
        if (this.get('bookModal')?.classList.contains('active')) return true;

        // Desktop TOC (sidebar + overlay)
        if (this.get('tocOverlay')?.classList.contains('active')) return true;
        if (this.get('tocSidebar')?.classList.contains('open')) return true;

        // Mobile : dropdown réglages
        if (this.get('settingsDropdown')?.classList.contains('open')) return true;
        if (this.get('mobileDropdownOverlay')?.classList.contains('active')) return true;

        // Mobile : bottom sheet TOC
        if (this.get('tocBottomSheet')?.classList.contains('active')) return true;
        if (this.get('bottomSheetOverlay')?.classList.contains('active')) return true;

        return false;
    },

    /**
     * Comportement "Option 1" :
     * - s'il y a un overlay/panneau ouvert => on ferme (et on ne toggle pas)
     * - sinon => on toggle l'interface (mode immersif)
     */
    handleCenterTap() {
        if (this.hasOpenOverlays()) {
            // Ferme tout ce qui peut se superposer
            this.closeAllDropdowns();
            this.closeTOC();
            this.closeModal();
            return;
        }

        this.toggleInterface();
    },
};
