/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READER.JS
 * Moteur de lecture EPUB avec architecture modulaire.
 * Utilise le pattern Factory pour instancier ScrollReader ou PagedReader.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config, StorageKeys } from '../core/config.js';
import { StateManager } from '../core/state.js';
import { DatabaseManager } from '../core/database.js';
import { EventBus, Events } from '../events/event-bus.js';
import ReaderFactory, { 
    createReader, 
    getReader, 
    setBook, 
    getBook,
    switchFlow,
    toggleFlow as factoryToggleFlow,
    getFlow,
    destroy as destroyFactory
} from './reader-factory.js';
import Logger from '../utils/logger.js';

const logger = new Logger('ReaderEngine');

/**
 * Instance du livre epub.js
 * @private
 */
let book = null;

/**
 * Trouve le premier chapitre dans la table des matières
 * @param {Array} items - Items de la TOC
 * @returns {string|null} Href du premier chapitre
 * @private
 */
function findFirstChapter(items) {
    for (const item of items) {
        const label = item.label?.toLowerCase() || '';
        if (label.includes('chapter') || label.includes('chapitre')) {
            return item.href;
        }
        if (item.subitems) {
            const found = findFirstChapter(item.subitems);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Rend la table des matières dans la sidebar
 * @param {Array} toc - Table des matières
 * @private
 */
function renderTOC(toc) {
    const chapters = [];
    
    const addItems = (items, level = 1) => {
        items?.forEach(item => {
            if (item.href) {
                chapters.push({ label: item.label, href: item.href, level: level });
            }
            
            addItems(item.subitems, level + 1);
        });
    };
    
    addItems(toc);
    StateManager.set('chapters', chapters);
    
    if (chapters.length > 0) {
        StateManager.set('currentChapterIndex', 0);
    }
    
    // Notifier que le sommaire est prêt
    EventBus.emit('reader:toc-ready', chapters);
}

/**
 * Met à jour l'icône du bouton de mode de lecture
 * Délègue à UIManager pour éviter la duplication
 * @private
 */
function updateFlowButton() {
    const flow = StateManager.get('readerFlow');
    EventBus.emit('reader:flow-changed', { flow });
}

/**
 * ReaderEngine - Moteur de lecture EPUB
 * Délègue les opérations au Reader approprié via le Factory
 */
export const ReaderEngine = {
    /**
     * Flag de navigation en cours pour éviter les doubles appels (iOS Ghost Click)
     */
    isNavigating: false,

    /**
     * Wrapper de navigation sécurisée
     * @param {Function} action - Action asynchrone à exécuter
     */
    async safeNavigation(action) {
        if (this.isNavigating) return;
        this.isNavigating = true;
        try {
            await action();
        } finally {
            this.isNavigating = false;
        }
    },

    /**
     * Vérifie si le lecteur est actif
     * @returns {boolean}
     */
    isActive() {
        const reader = getReader();
        return reader?.isActive() || false;
    },
    
    /**
     * Ouvre un livre pour lecture
     * @param {number} id - ID du livre dans la base de données
     */
    async open(id) {
        try {
            const bookData = await DatabaseManager.get(id);
            if (!bookData?.epubData) {
                EventBus.emit('status-message', 'Livre non trouvé');
                return;
            }
            
            StateManager.set('currentBookId', id);
            EventBus.emit('reader:opening', { title: bookData.title });
            
            await this.initialize(bookData.epubData, bookData.lastCFI);
            
        } catch (error) {
            EventBus.emit('status-message', 'Erreur lors de l\'ouverture');
            logger.error('Book open failed', error);
        }
    },
    
    /**
     * Initialise le moteur de lecture avec un fichier EPUB
     * @param {Blob} epubData - Données du fichier EPUB
     * @param {string|null} savedCFI - Position de lecture sauvegardée
     */
    async initialize(epubData, savedCFI = null) {
        if (!window.ePub) {
            EventBus.emit('status-message', 'ePub.js non chargé');
            return;
        }
        
        try {
            // Nettoyer l'ancien reader
            await destroyFactory();
            if (book) {
                book.destroy();
                book = null;
            }
            
            const viewer = document.getElementById('viewer');
            if (viewer) viewer.innerHTML = '';
            
            // Charger le nouveau livre
            book = window.ePub({ replacements: 'blobUrl' });
            // Lancer l'ouverture du livre. Ne pas await ici, car nous voulons utiliser
            // les promesses `opened` et `ready` pour un contrôle plus fin.
            book.open(epubData);

            // `book.opened` se résout lorsque les métadonnées (packaging) sont prêtes.
            // C'est l'attente la plus importante pour corriger l'erreur `(reading 'packaging')`.
            await book.opened;

            // `book.ready` se résout lorsque tout le livre est prêt (TOC, etc.).
            await book.ready;
            
            // Partager le livre avec le factory
            setBook(book);
            
            // Créer le reader approprié selon le mode
            const reader = createReader();
            
            // Rendre la table des matières
            const toc = book.navigation?.toc || [];
            renderTOC(toc);
            
            // Initialiser le reader avec la position sauvegardée
            const firstChapter = findFirstChapter(toc);
            const startLocation = savedCFI || firstChapter || undefined;
            
            await reader.init(book, startLocation);
            
            // Initialiser les interactions (L'Espion)
            if (reader.rendition) {
                this.setupInteraction(reader.rendition);
            }
            
            // Mettre à jour le bouton de mode
            updateFlowButton();
            
            EventBus.emit('status-message', savedCFI ? '📖 Reprise de la lecture' : '📖 Livre chargé');
            EventBus.emit(Events.READER_OPENED, { bookId: StateManager.get('currentBookId') });
            
        } catch (error) {
            EventBus.emit('status-message', 'Erreur lors du chargement');
            logger.error('Book initialization failed', error);
            destroyFactory();
        }
    },

    /**
     * Initialise les événements via les HOOKS (Plus fiable sur mobile réel)
     */
    setupInteraction(rendition) {
        if (!rendition) return;

        // Fonction pour attacher les listeners à un contenu (document/window)
        const attachListeners = (contents) => {
            // Éviter les doublons (Code mort / Conflits)
            if (contents._interactionSetup) return;
            contents._interactionSetup = true;

            const doc = contents.document;
            const win = contents.window;
            
            // 1. INJECTION CSS CRITIQUE (iOS Fix)
            // Application sur HTML et BODY pour forcer le comportement
            const style = doc.createElement('style');
            style.innerHTML = `
                html, body {
                    cursor: pointer;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                    -webkit-touch-callout: none; /* iOS: Pas de loupe/menu contextuel */
                    -webkit-user-select: none;   /* iOS: Pas de sélection texte auto */
                    user-select: none;
                    -webkit-user-select: none;
                }
            `;
            doc.head.appendChild(style);

            // 2. LE LEURRE (Dummy Listener) pour réveiller Safari iOS
            doc.addEventListener('touchstart', () => {}, { passive: false });

            // 3. Variables pour la détection
            let startX = 0;
            let startY = 0;
            let startTime = 0;
            let _lastTapTs = null;

            // 4. TOUCHSTART (Sur window + Capture)
            win.addEventListener('touchstart', (e) => {
                const touch = e.changedTouches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                startTime = Date.now();
            }, { capture: true, passive: false });

            // 5. TOUCHEND (Sur window + Capture + Tolérance Retina)
            win.addEventListener('touchend', (e) => {
                // CONFLICT FIX: Ignorer les taps sur les éléments interactifs
                // Empêche le ReaderEngine de voler le clic aux boutons de navigation
                if (e.target.closest('a, button, input, select, textarea, .chapter-nav-btn')) {
                    return;
                }

                const touch = e.changedTouches[0];
                const diffX = Math.abs(touch.clientX - startX);
                const diffY = Math.abs(touch.clientY - startY);
                const duration = Date.now() - startTime;

                // Tolérance Retina (30px) et durée courte (< 300ms)
                if (diffX < 30 && diffY < 30 && duration < 300) {
                    // C'est un TAP valide
                    // IMPORTANT : preventDefault() empêche Safari de lancer le click fantôme ou le zoom
                    if (e.cancelable) e.preventDefault();

                    _lastTapTs = Date.now();

                    EventBus.emit('reader:tap', {
                        x: touch.clientX,
                        y: touch.clientY,
                        width: win.innerWidth,
                        target: e.target,
                    });
                }
            }, { capture: true, passive: false });
            
            // ===== iOS fallback : click =====
            doc.addEventListener(
              'click',
              (e) => {
                if (e.defaultPrevented) return;
                if (e.target.closest('a, button, input, select, textarea, label, [role="button"], [contenteditable], .chapter-nav-btn')) {
                    return;
                }
                // Empêche double déclenchement si touch a déjà marché
                if (_lastTapTs && Date.now() - _lastTapTs < 400) return;

                const rect = rendition.iframe.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const width = rect.width;

                _lastTapTs = Date.now();

                EventBus.emit('reader:tap', {
                  x,
                  y,
                  width,
                  target: e.target,
                  source: 'click'
                });
              },
              true // CAPTURE → CRUCIAL sur iOS
            );
        };

        // A. Enregistrer pour les futurs chapitres
        rendition.hooks.content.register(attachListeners);

        // B. Appliquer IMMÉDIATEMENT au chapitre actuel (si déjà chargé)
        const currentContents = rendition.getContents();
        if (currentContents && currentContents.length > 0) {
            currentContents.forEach(content => attachListeners(content));
        }
    },
    
    /**
     * Applique le thème de lecture actuel
     */
    applyTheme() {
        const reader = getReader();
        reader?.applyTheme();
    },
    
    /**
     * Modifie la taille de police
     * @param {number} delta - Changement de taille
     */
    changeFontSize(delta) {
        const reader = getReader();
        reader?.changeFontSize(delta);
    },
    
    /**
     * Navigue vers un chapitre spécifique
     * @param {string} href - Lien du chapitre
     */
    async goToChapter(href) {
        const reader = getReader();
        if (reader) {
            await this.safeNavigation(() => reader.goToChapter(href));
        }
    },
    
    /**
     * Va au chapitre précédent
     */
    async prevChapter() {
        const reader = getReader();
        if (reader) {
            await this.safeNavigation(() => reader.prevChapter());
        }
    },
    
    /**
     * Va au chapitre suivant
     */
    async nextChapter() {
        const reader = getReader();
        if (reader) {
            await this.safeNavigation(() => reader.nextChapter());
        }
    },
    
    /**
     * Va à la page précédente (mode pagination)
     */
    prevPage() {
        const reader = getReader();
        if (reader?.prevPage) {
            reader.prevPage();
        }
    },
    
    /**
     * Va à la page suivante (mode pagination)
     */
    nextPage() {
        const reader = getReader();
        if (reader?.nextPage) {
            reader.nextPage();
        }
    },
    
    /**
     * Change le mode de lecture (scrolled/paginated)
     * @param {string} flow - 'scrolled' ou 'paginated'
     */
    async setFlow(flow) {
        if (!['scrolled', 'paginated'].includes(flow)) return;
        
        await switchFlow(flow);
        updateFlowButton();
    },
    
    /**
     * Bascule entre les modes scroll et pagination
     */
    async toggleFlow() {
        await factoryToggleFlow();
        updateFlowButton();
        
        const flow = getFlow();
        const modeName = flow === 'scrolled' ? 'défilement' : 'pagination';
        EventBus.emit('status-message', `📖 Mode ${modeName} activé`);
    },
    
    /**
     * Ferme le lecteur et retourne à la bibliothèque
     */
    async close() {
        await destroyFactory();
        if (book) {
            book.destroy();
            book = null;
        }
        
        StateManager.resetReaderState();
        EventBus.emit(Events.READER_CLOSED);
    },
    
    /**
     * Récupère le mode de lecture actuel
     * @returns {string} 'scrolled' ou 'paginated'
     */
    getFlow() {
        return getFlow();
    }
};

// Exposer ReaderEngine sur window pour l'accès depuis les iframes epub.js
window.ReaderEngine = ReaderEngine;
