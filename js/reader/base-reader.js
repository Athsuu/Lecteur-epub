/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READER/BASE-READER.JS
 * Classe de base abstraite pour les modes de lecture.
 * Contient les fonctionnalités communes entre ScrollReader et PagedReader.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config, StorageKeys } from '../core/config.js';
import { StateManager } from '../core/state.js';
import { ThemeManager } from '../core/themes.js';
import { UIManager } from '../ui/ui-manager.js';
import Logger from '../utils/logger.js';

const logger = new Logger('BaseReader');

/**
 * BaseReader - Classe abstraite pour les modes de lecture
 */
export class BaseReader {
    constructor() {
        if (this.constructor === BaseReader) {
            throw new Error('BaseReader est une classe abstraite');
        }
        
        this.name = 'BaseReader';
        this.book = null;
        this.rendition = null;
        this.flow = 'scrolled'; // Doit être surchargé
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALISATION & DESTRUCTION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Initialise le lecteur avec un livre
     * @param {ePub.Book} book - Instance du livre epub.js
     * @param {string|null} startCFI - Position de départ
     */
    async init(book, startCFI = null) {
        this.book = book;
        
        const viewer = UIManager.get('viewer');
        if (viewer) viewer.innerHTML = '';
        
        // Créer le rendu - surchargé dans les sous-classes
        this.rendition = this._createRendition();
        
        // Appliquer le thème
        this.applyTheme();
        
        // Initialisation spécifique au mode
        this._setupModeSpecific();
        
        // Afficher à la position
        const toc = this.book.navigation?.toc || [];
        const firstChapter = this._findFirstChapter(toc);
        const startLocation = startCFI || firstChapter || undefined;
        
        await this.rendition.display(startLocation);
        
        // Écouter les changements de position
        this.rendition.on('relocated', (location) => {
            this._onRelocated(location);
        });
        
        logger.info(`${this.name} initialized`);
    }

    /**
     * Détruit le lecteur et nettoie les ressources
     */
    async destroy() {
        if (this.rendition) {
            // epub.js's destroy() handles DOM removal and internal listeners.
            this.rendition.destroy();
            this.rendition = null;
        }

        // Clear the viewer container manually as a safeguard against zombie elements.
        const viewer = UIManager.get('viewer');
        if (viewer) {
            viewer.innerHTML = '';
        }

        this.book = null;
        logger.info(`${this.name} destroyed`);
    }

    /**
     * Vérifie si le lecteur est actif
     * @returns {boolean}
     */
    isActive() {
        return this.rendition !== null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MÉTHODES ABSTRAITES (à implémenter)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Crée le rendu epub.js avec les options appropriées
     * @abstract
     * @returns {ePub.Rendition}
     */
    _createRendition() {
        throw new Error('_createRendition doit être implémenté');
    }

    /**
     * Configuration spécifique au mode
     * @abstract
     */
    _setupModeSpecific() {
        // À surcharger
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GÉNÉRATION DES STYLES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Génère les styles CSS pour le contenu du livre
     * @returns {Object} Objet de styles pour epub.js
     */
    generateReadingStyles() {
        const colors = ThemeManager.getReadingColors();
        const fontSize = StateManager.get('fontSize');
        const isMobile = UIManager.isMobile();
        
        // Padding adaptatif selon le mode et l'appareil
        const bodyPadding = this._getBodyPadding(isMobile);
        
        // Taille de police adaptative
        const baseFontSize = isMobile ? fontSize - 10 : fontSize + 40;
        
        return {
            'body': {
                'font-family': 'Georgia, "Times New Roman", serif !important',
                'line-height': '1.8 !important',
                'font-size': `${baseFontSize}% !important`,
                'padding': bodyPadding,
                'text-align': 'left !important',
                'color': colors.text,
                'background': colors.bg,
                'margin': '0 !important',
                'overflow-x': 'hidden !important'
            },
            'p, li, td': {
                'font-family': 'Georgia, "Times New Roman", serif !important',
                'line-height': '1.6 !important',
                'margin-bottom': '1.2em !important',
                'text-align': 'justify !important',
                'text-indent': '0 !important',
                'hyphens': 'auto !important'
            },
            'h1, h2, h3, h4, h5, h6': {
                'font-family': 'Georgia, "Times New Roman", serif !important',
                'line-height': '1.3 !important',
                'font-size': `${fontSize + 80}% !important`,
                'margin-top': '1.5em !important',
                'margin-bottom': '0 !important',
                'padding-bottom': '1.5em !important',
                'text-align': 'center !important',
                'color': `${colors.heading} !important`,
                'text-decoration': 'none !important',
                'background': 'transparent !important',
                'width': '100% !important',
                'display': 'block !important'
            },
            'h1 *, h2 *, h3 *, h4 *, h5 *, h6 *': {
                'font-size': 'inherit !important',
                'color': 'inherit !important',
                'white-space': 'inherit !important',
                'line-height': 'inherit !important',
                'text-align': 'inherit !important',
                'text-decoration': 'none !important',
                'background': 'transparent !important'
            },
            'a': {
                'color': `${colors.link} !important`,
                'text-decoration': 'none !important'
            },
            'img': {
                'max-width': '100% !important',
                'max-height': this._getImageMaxHeight(),
                'width': 'auto !important',
                'height': 'auto !important',
                'object-fit': 'contain !important',
                'display': 'block !important',
                'margin': '1em auto !important'
            },
            // Styles pour les boutons de navigation de chapitre
            '.chapter-navigation': {
                'display': 'flex !important',
                'justify-content': 'center !important',
                'gap': '16px !important',
                'margin': '60px 0 0 0 !important',
                'padding': '60px 0 !important',
                'border-top': `1px solid ${colors.border} !important`
            },
            '.chapter-nav-btn': {
                'padding': '14px 28px !important',
                'border': 'none !important',
                'border-radius': '14px !important',
                'background': `${colors.btnBg} !important`,
                'color': `${colors.text} !important`,
                'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important',
                'font-weight': '600 !important',
                'font-size': '0.95rem !important',
                'cursor': 'pointer !important',
                'text-decoration': 'none !important',
                'display': 'inline-flex !important',
                'align-items': 'center !important',
                'gap': '10px !important',
                'transition': 'all 0.2s ease !important',
                'box-shadow': `0 2px 8px rgba(0,0,0,${colors.shadow}) !important`
            },
            '.chapter-nav-btn:hover': {
                'background': `${colors.btnHover} !important`,
                'transform': 'translateY(-2px) !important',
                'box-shadow': `0 4px 12px rgba(0,0,0,${colors.shadowHover}) !important`
            }
        };
    }

    /**
     * Retourne le padding du body selon le mode
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
     * Retourne la hauteur max des images selon le mode
     * @returns {string}
     */
    _getImageMaxHeight() {
        return 'none !important';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // THÈME ET STYLES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Applique le thème de lecture actuel
     */
    applyTheme() {
        if (!this.rendition) return;
        
        this.rendition.themes.register('reading-theme', this.generateReadingStyles());
        this.rendition.themes.select('reading-theme');
    }

    /**
     * Modifie la taille de police
     * @param {number} delta - Changement de taille
     */
    changeFontSize(delta) {
        const current = StateManager.get('fontSize');
        const newSize = current + delta;
        
        if (newSize >= Config.FONT.MIN && newSize <= Config.FONT.MAX) {
            StateManager.persist(StorageKeys.FONT_SIZE, 'fontSize', newSize);
            this.applyTheme();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Navigue vers un chapitre spécifique
     * @param {string} href - Lien du chapitre
     */
    goToChapter(href) {
        if (!this.rendition || !href) return;
        
        // Trouver l'index du chapitre
        const chapters = StateManager.get('chapters');
        const newIndex = chapters.findIndex(ch => ch.href === href);
        
        if (newIndex !== -1) {
            StateManager.set('currentChapterIndex', newIndex);
        }
        
        this.rendition.display(href).then(() => {
            this.applyTheme();
            this._scrollToTop();
        }).catch(err => logger.error('goToChapter error', err));
        
        UIManager.closeTOC();
        UIManager.closeAllDropdowns();
    }

    /**
     * Va au chapitre précédent
     */
    prevChapter() {
        const chapters = StateManager.get('chapters');
        const index = StateManager.get('currentChapterIndex');
        
        if (index <= 0 || !this.rendition || chapters.length === 0) {
            return;
        }
        
        const newIndex = index - 1;
        const href = chapters[newIndex]?.href;
        
        if (href) {
            StateManager.set('currentChapterIndex', newIndex);
            this.rendition.display(href).then(() => {
                this.applyTheme();
                this._scrollToTop();
            }).catch(err => logger.error('Display error', err));
        }
    }

    /**
     * Va au chapitre suivant
     */
    nextChapter() {
        const chapters = StateManager.get('chapters');
        const index = StateManager.get('currentChapterIndex');
        
        if (index >= chapters.length - 1 || !this.rendition || chapters.length === 0) {
            return;
        }
        
        const newIndex = index + 1;
        const href = chapters[newIndex]?.href;
        
        if (href) {
            StateManager.set('currentChapterIndex', newIndex);
            this.rendition.display(href).then(() => {
                this.applyTheme();
                this._scrollToTop();
            }).catch(err => logger.error('Display error', err));
        }
    }

    /**
     * Scroll vers le haut du viewer
     * @protected
     */
    _scrollToTop() {
        const viewer = UIManager.get('viewer');
        if (viewer) viewer.scrollTop = 0;
    }

    /**
     * Injecte des boutons Prev/Next en fin de chapitre (mobile + desktop)
     * @protected
     */
    _injectChapterNavigation() {
        const chapters = StateManager.get('chapters');
        const currentIndex = StateManager.get('currentChapterIndex');
        const isMobile = UIManager.isMobile();

        if (!this.rendition || chapters.length === 0) return;

        try {
            const iframe = document.querySelector('#viewer iframe');
            if (!iframe?.contentDocument) return;

            const doc = iframe.contentDocument;
            const body = doc.body;
            if (!body) return;

            doc.querySelector('.chapter-navigation')?.remove();

            if (!doc.getElementById('chapter-nav-style')) {
                const style = doc.createElement('style');
                style.id = 'chapter-nav-style';
                style.textContent = `
                    .chapter-navigation {
                        margin: 28px 0 10px 0;
                        padding: 18px 0 10px 0;
                        border-top: 1px solid rgba(0,0,0,0.1);
                        display: flex;
                        gap: 14px;
                        justify-content: space-between;
                    }
                    .chapter-nav-btn {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        padding: 14px 16px;
                        border-radius: 18px;
                        background: rgba(240, 240, 240, 0.9);
                        color: inherit;
                        font-size: 0.95rem;
                        font-weight: 600;
                        text-decoration: none;
                        border: 1px solid rgba(0,0,0,0.06);
                    }
                    .chapter-nav-btn:active {
                        transform: scale(0.98);
                    }
                `;
                doc.head.appendChild(style);
            }

            const nav = doc.createElement('div');
            nav.className = 'chapter-navigation';

            const hasPrev = currentIndex > 0;
            const hasNext = currentIndex < chapters.length - 1;

            if (hasPrev) {
                const btnPrev = doc.createElement('a');
                btnPrev.className = 'chapter-nav-btn';
                btnPrev.href = '#';
                btnPrev.innerHTML = '<span>←</span><span>Chapitre précédent</span>';
                btnPrev.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.prevChapter();
                });
                nav.appendChild(btnPrev);
            }

            if (hasNext) {
                const btnNext = doc.createElement('a');
                btnNext.className = 'chapter-nav-btn';
                btnNext.href = '#';
                btnNext.innerHTML = '<span>Chapitre suivant</span><span>→</span>';
                btnNext.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.nextChapter();
                });
                nav.appendChild(btnNext);
            }

            if (hasPrev || hasNext) {
                body.appendChild(nav);
            }
        } catch (e) {
            logger.debug('Chapter navigation injection failed', e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UTILITAIRES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Trouve le premier chapitre dans la TOC
     * @param {Array} items - Items de la TOC
     * @returns {string|null}
     */
    _findFirstChapter(items) {
        for (const item of items) {
            const label = item.label?.toLowerCase() || '';
            if (label.includes('chapter') || label.includes('chapitre')) {
                return item.href;
            }
            if (item.subitems) {
                const found = this._findFirstChapter(item.subitems);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Handler appelé lors du changement de position
     * @param {Object} location - Objet location d'epub.js
     * @protected
     */
    _onRelocated(location) {
        if (location?.start?.cfi) {
            this._saveProgress(location.start.cfi);
            this._updateProgressIndicator(location);
        }
    }

    /**
     * Sauvegarde la progression de lecture
     * @param {string} cfi - Position CFI
     * @protected
     */
    async _saveProgress(cfi) {
        // Import dynamique pour éviter la dépendance circulaire
        const { DatabaseManager } = await import('../core/database.js');
        const { EventBus, Events } = await import('../events/event-bus.js');
        
        const bookId = StateManager.get('currentBookId');
        if (!bookId || !cfi) return;
        
        try {
            const toc = this.book?.navigation?.toc || [];
            const currentHref = this.book?.spine?.get(cfi)?.href || '';
            
            let chapterName = null;
            
            const findChapter = (items) => {
                for (const item of items) {
                    const itemHref = item.href?.split('#')[0] || '';
                    const currentBase = currentHref.split('#')[0] || '';
                    
                    if (itemHref && currentBase && 
                        (itemHref.includes(currentBase) || currentBase.includes(itemHref))) {
                        chapterName = item.label;
                        return true;
                    }
                    if (item.subitems && findChapter(item.subitems)) return true;
                }
                return false;
            };
            
            findChapter(toc);
            StateManager.set('currentChapter', chapterName);
            
            if (chapterName) {
                const chapters = StateManager.get('chapters');
                const index = chapters.findIndex(ch => ch.label === chapterName);
                StateManager.set('currentChapterIndex', index);
            }
            
            await DatabaseManager.saveProgress(bookId, cfi, chapterName);

            // Émettre un événement de changement de chapitre pour les statistiques
            const chapterId = (this.book?.spine?.get(cfi)?.href || '').split('#')[0] || chapterName || cfi;
            EventBus.emit(Events.CHAPTER_CHANGED, {
                bookId,
                chapterId,
                chapterName
            });
        } catch (e) {
            logger.debug('Progress save failed', e);
        }
    }

    /**
     * Met à jour l'indicateur de progression
     * @param {Object} location
     * @protected
     */
    _updateProgressIndicator(location) {
        if (!location) return;
        const percent = Math.round((location.percentage || 0) * 100);
        StateManager.set('readerProgress', percent);
        const ui = (typeof UIManager.getUIInstance === 'function') ? UIManager.getUIInstance() : null;
        if (ui && typeof ui.updateProgress === 'function') {
            ui.updateProgress(percent);
        }
        if (ui && typeof ui.updateProgressText === 'function') {
            ui.updateProgressText(`${percent}%`);
        }
    }
}
