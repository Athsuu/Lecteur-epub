/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LIBRARY.JS
 * Gestionnaire de la bibliothèque de livres.
 * Gère l'import, l'affichage, la suppression et la recherche des livres.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DatabaseManager } from '../core/database.js';
import { UIManager } from '../ui/ui-manager.js';
import { FavoritesManager } from './favorites-manager.js';
import { SearchEngine, debounce } from '../utils/search-engine.js';
import { Sorter, SortCriteria } from '../utils/sorter.js';
import { Virtualizer } from '../utils/virtualizer.js';
import Logger from '../utils/logger.js';

const logger = new Logger('Library');

/**
 * Convertit un Blob en chaîne Base64
 * @param {Blob} blob - Blob à convertir
 * @returns {Promise<string|null>} Chaîne Base64 ou null
 * @private
 */
async function blobToBase64(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
    });
}

/**
 * Extrait la couverture d'un fichier EPUB
 * @param {Blob} epubBlob - Fichier EPUB en Blob
 * @returns {Promise<string|null>} URL Base64 de la couverture ou null
 * @private
 */
async function extractCover(epubBlob) {
    if (!window.ePub) {
        logger.warn('ePub library not loaded');
        return null;
    }
    
    let tempBook = null;
    try {
        // Vérifier que ePub est une fonction valide
        if (typeof window.ePub !== 'function') {
            logger.error('ePub is not a function', typeof window.ePub);
            return null;
        }
        
        // Créer une nouvelle instance SANS options (qui causent l'erreur replaceCss)
        tempBook = window.ePub();
        if (!tempBook) {
            logger.error('Failed to create ePub instance');
            return null;
        }
        
        // Ouvrir le EPUB
        await tempBook.open(epubBlob);
        
        // Attendre que le EPUB soit prêt
        if (tempBook.ready) {
            await tempBook.ready;
        }
        
        // Méthode 1: API standard epub.js - coverUrl()
        try {
            if (typeof tempBook.coverUrl === 'function') {
                const coverUrl = await tempBook.coverUrl();
                if (coverUrl) {
                    const response = await fetch(coverUrl);
                    if (response.ok) {
                        const coverBlob = await response.blob();
                        const base64 = await blobToBase64(coverBlob);
                        return base64;
                    }
                }
            }
        } catch (e) {
            logger.debug('coverUrl() failed', e.message);
        }
        
        // Méthode 2: Accéder aux ressources via le manifest
        try {
            const book = tempBook;
            
            // Chercher la couverture dans le manifeste
            if (book.packaging && book.packaging.manifest) {
                const manifest = book.packaging.manifest;
                
                for (const [id, item] of Object.entries(manifest)) {
                    // Identifier les images de couverture
                    const isCoverItem = id.toLowerCase().includes('cover') || 
                                       (item.properties && item.properties.includes('cover-image'));
                    const isImage = item['media-type'] && item['media-type'].includes('image');
                    
                    if (isCoverItem && isImage && item.href) {
                        try {
                            // Récupérer le blob de la ressource
                            if (book.archive && typeof book.archive.getBlob === 'function') {
                                const resource = await book.archive.getBlob(item.href);
                                if (resource) {
                                    const base64 = await blobToBase64(resource);
                                    return base64;
                                }
                            }
                        } catch (resourceError) {
                            logger.debug('Failed to extract cover from manifest', resourceError.message);
                        }
                    }
                }
            }
        } catch (e) {
            logger.debug('Manifest parsing failed', e.message);
        }
        
        // Pas de couverture trouvée
        return null;
        
    } catch (error) {
        logger.error('Cover extraction error', error.message);
        return null;
    } finally {
        // Nettoyer la ressource
        if (tempBook && typeof tempBook.destroy === 'function') {
            try {
                tempBook.destroy();
            } catch (e) {
                logger.debug('Error destroying tempBook', e.message);
            }
        }
    }
}

/**
 * Nettoie le HTML d'un synopsis pour obtenir du texte brut lisible
 * @param {string} html - HTML brut du synopsis
 * @returns {string} Texte nettoyé
 * @private
 */
function cleanSynopsisHtml(html) {
    if (!html) return '';
    
    try {
        // Méthode 1: Parser HTML et extraire le texte
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remplacer les <br> et <p> par des retours à la ligne
        tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        tempDiv.querySelectorAll('p').forEach(p => p.innerHTML += '\n\n');
        
        // Extraire le texte pur
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        // Nettoyage final
        text = text
            .replace(/\s+/g, ' ')           // Espaces multiples → 1 espace
            .replace(/\n{3,}/g, '\n\n')     // Max 2 retours ligne
            .trim();
        
        return text;
    } catch (e) {
        // Fallback: Regex simple
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')        // Retirer toutes les balises
            .replace(/&nbsp;/g, ' ')
            .replace(/&[a-z]+;/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

/**
 * Parse les métadonnées d'un fichier EPUB via JSZip
 * @param {JSZip} zip - Archive ZIP du fichier EPUB
 * @returns {Promise<Object>} Métadonnées extraites
 * @private
 */
async function parseMetadata(zip) {
    const metadata = {
        title: '',
        author: 'Auteur inconnu',
        description: '',
        language: '',
        publisher: ''
    };
    
    try {
        // Trouver le fichier container.xml
        const container = zip.file('META-INF/container.xml') || zip.file('container.xml');
        if (!container) return metadata;
        
        const xml = await container.async('string');
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        
        // Trouver le chemin du fichier OPF
        const opfPath = doc.querySelector('rootfile')?.getAttribute('full-path') || 'content.opf';
        const opf = zip.file(opfPath);
        
        if (!opf) return metadata;
        
        const opfXml = await opf.async('string');
        const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');
        
        // Fonction helper pour trouver un élément par nom local
        const getElement = (name) => {
            return opfDoc.querySelector(name) || 
                   [...opfDoc.querySelectorAll('*')].find(el => el.localName === name);
        };
        
        // Extraire les métadonnées
        const titleElem = getElement('title');
        const authorElem = getElement('creator');
        const descElem = getElement('description');
        const langElem = getElement('language');
        const pubElem = getElement('publisher');
        
        if (titleElem?.textContent) metadata.title = titleElem.textContent.trim();
        if (authorElem?.textContent) metadata.author = authorElem.textContent.trim();
        
        // Nettoyage spécial pour la description (peut contenir du HTML)
        if (descElem?.textContent) {
            const rawDescription = descElem.textContent.trim();
            metadata.description = cleanSynopsisHtml(rawDescription);
        }
        
        if (langElem?.textContent) metadata.language = langElem.textContent.trim();
        if (pubElem?.textContent) metadata.publisher = pubElem.textContent.trim();
        
    } catch (e) {
        logger.debug('Metadata extraction failed', e);
    }
    
    return metadata;
}

/**
 * LibraryManager - Gestionnaire de la bibliothèque
 */
export const LibraryManager = {
    /**
     * Vue actuelle de la bibliothèque
     * @private
     */
    currentView: 'all',
    
    /**
     * Cache de tous les livres de la vue actuelle
     * @private
     */
    _cachedBooks: [],
    
    /**
     * Moteur de recherche
     * @private
     */
    _searchEngine: null,
    
    /**
     * Fonction de recherche debouncée
     * @private
     */
    _debouncedSearch: null,
    
    /**
     * Instance du sorter
     * @private
     */
    _sorter: null,
    
    /**
     * Critère de tri actuel
     * @private
     */
    _currentSort: null,
    
    /**
     * Instance du virtualizer pour lazy loading
     * @private
     */
    _virtualizer: null,
    
    /**
     * Liste complète des livres à rendre (non filtrée par recherche)
     * @private
     */
    _allBooksToRender: [],
    
    /**
     * Instance du Web Worker pour le parsing EPUB
     * @private
     */
    _epubWorker: null,
    
    /**
     * Compteur pour générer des IDs uniques de tâches worker
     * @private
     */
    _workerTaskId: 0,
    
    /**
     * Map des Promises en attente de réponse du worker
     * @private
     */
    _workerPendingTasks: new Map(),
    
    /**
     * Menu contextuel (élément DOM)
     * @private
     */
    _contextMenu: null,

    /**
     * Handler pour fermer le menu contextuel
     * @private
     */
    _closeMenuHandler: null,

    /**
     * Initialise le Web Worker pour le parsing EPUB (Singleton)
     * @private
     */
    _initWorker() {
        if (this._epubWorker) return; // Déjà initialisé
        
        try {
            // Créer le worker
            this._epubWorker = new Worker('js/workers/epub-parser.worker.js');
            
            // Handler des messages du worker
            this._epubWorker.addEventListener('message', (event) => {
                const { status, fileId, metadata, coverArrayBuffer, coverMimeType, error } = event.data;
                
                // Récupérer la Promise en attente
                const task = this._workerPendingTasks.get(fileId);
                if (!task) {
                    logger.warn('No pending task for fileId:', fileId);
                    return;
                }
                
                // Retirer la tâche de la map
                this._workerPendingTasks.delete(fileId);
                
                if (status === 'SUCCESS') {
                    // Reconstruire le Blob de la couverture si présent
                    let coverBlob = null;
                    if (coverArrayBuffer && coverMimeType) {
                        coverBlob = new Blob([coverArrayBuffer], { type: coverMimeType });
                    }
                    
                    // Résoudre la Promise
                    task.resolve({ metadata, coverBlob });
                } else {
                    // Rejeter la Promise
                    task.reject(new Error(error || 'Worker parsing failed'));
                }
            });
            
            // Handler des erreurs du worker
            this._epubWorker.addEventListener('error', (event) => {
                logger.error('Worker error', event.message);
                
                // Rejeter toutes les tâches en attente
                for (const [fileId, task] of this._workerPendingTasks.entries()) {
                    task.reject(new Error('Worker crashed'));
                    this._workerPendingTasks.delete(fileId);
                }
            });
            
            logger.info('EPUB Parser Worker initialized');
        } catch (error) {
            logger.error('Failed to initialize worker', error);
            this._epubWorker = null;
        }
    },
    
    /**
     * Parse un fichier EPUB via le Web Worker
     * @param {File} file - Fichier EPUB à parser
     * @returns {Promise<Object>} { metadata, coverBlob }
     * @private
     */
    _parseEpubInWorker(file) {
        return new Promise((resolve, reject) => {
            // Initialiser le worker si nécessaire
            this._initWorker();
            
            if (!this._epubWorker) {
                reject(new Error('Worker not available'));
                return;
            }
            
            // Générer un ID unique pour cette tâche
            const fileId = `task-${++this._workerTaskId}-${Date.now()}`;
            
            // Stocker la Promise
            this._workerPendingTasks.set(fileId, { resolve, reject });
            
            // Envoyer le fichier au worker
            this._epubWorker.postMessage(
                {
                    command: 'PARSE',
                    file: file,
                    fileId: fileId
                },
                // Note: Le File est déjà un Transferable, mais on ne peut pas le transférer
                // car on pourrait en avoir besoin après. On laisse le navigateur gérer.
            );
        });
    },
    
    /**
     * Initialise le moteur de recherche et les event listeners
     * @private
     */
    _initSearch() {
        // Créer le moteur de recherche (threshold: 0.3 = 30% de similarité minimum)
        this._searchEngine = new SearchEngine({
            threshold: 0.3,
            keys: ['title', 'author']
        });
        
        // Initialiser le sorter avec la préférence sauvegardée
        const savedSort = localStorage.getItem('library_sort_pref') || SortCriteria.ADDED_DESC;
        this._sorter = new Sorter(savedSort);
        this._currentSort = savedSort;
        
        // Fonction de recherche debouncée (300ms)
        this._debouncedSearch = debounce((query) => {
            this._performSearch(query);
        }, 300);
        
        // Connecter l'input de recherche
        const searchInput = UIManager.get('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._debouncedSearch(e.target.value);
            });
        }
        
        // Connecter le dropdown de tri
        this._initSortMenu();
    },
    
    /**
     * Effectue la recherche et met à jour l'affichage
     * @param {string} query - Terme de recherche
     * @private
     */
    _performSearch(query) {
        const trimmedQuery = query?.trim();
        
        // Si la requête est vide, afficher tous les livres
        if (!trimmedQuery) {
            this._renderBooks(this._cachedBooks);
            return;
        }
        
        // Rechercher dans le cache
        const results = this._searchEngine.search(trimmedQuery, this._cachedBooks);
        this._renderBooks(results);
        
        // Message si aucun résultat
        if (results.length === 0) {
            const booksList = UIManager.get('booksList');
            if (booksList) {
                booksList.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
                        <div style="font-size:4rem;margin-bottom:20px">🔍</div>
                        <p style="font-size:1.1rem;margin-bottom:8px">Aucun résultat</p>
                        <p style="font-size:0.9rem">Essayez avec un autre terme de recherche</p>
                    </div>
                `;
            }
        }
    },
    
    /**
     * Initialise le menu de tri
     * @private
     */
    _initSortMenu() {
        const sortBtn = UIManager.get('sortBtn');
        const sortMenu = UIManager.get('sortMenu');
        
        if (!sortBtn || !sortMenu) return;
        
        // Bouton pour ouvrir/fermer le menu
        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle('open');
        });
        
        // Options de tri
        const sortOptions = sortMenu.querySelectorAll('.sort-option');
        sortOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const sortCriteria = option.dataset.sort;
                this.sortBooks(sortCriteria);
                sortMenu.classList.remove('open');
            });
        });
        
        // Fermer le menu en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.lib-sort-dropdown')) {
                sortMenu.classList.remove('open');
            }
        });
        
        // Marquer l'option active au démarrage
        this._updateSortMenuUI();
    },
    
    /**
     * Met à jour l'UI du menu de tri (marque l'option active)
     * @private
     */
    _updateSortMenuUI() {
        const sortMenu = UIManager.get('sortMenu');
        if (!sortMenu) return;
        
        const sortOptions = sortMenu.querySelectorAll('.sort-option');
        sortOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.sort === this._currentSort);
        });
    },
    
    /**
     * Trie les livres selon le critère et re-affiche
     * @param {string} criteria - Critère de tri (ex: 'title_asc')
     */
    sortBooks(criteria) {
        if (!this._sorter) return;
        
        // Sauvegarder la préférence
        localStorage.setItem('library_sort_pref', criteria);
        this._currentSort = criteria;
        
        // Trier le cache
        this._cachedBooks = this._sorter.sort(this._cachedBooks, criteria);
        
        // Re-afficher
        this._renderBooks(this._cachedBooks);
        this._updateSortMenuUI();
    },
    
    /**
     * Charge et affiche les livres selon la vue active
     * @param {string} view - Vue à afficher ('all' ou 'favorites')
     */
    async load(view = null) {
        try {
            // Utiliser la vue passée en paramètre ou la vue actuelle
            if (view) {
                this.currentView = view;
            }
            
            // Réinitialiser le champ de recherche
            const searchInput = UIManager.get('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }
            
            // Détruire le virtualizer précédent s'il existe
            if (this._virtualizer) {
                this._virtualizer.destroy();
                this._virtualizer = null;
            }
            
            // Récupérer les livres selon la vue et les mettre en cache
            this._cachedBooks = this.currentView === 'favorites' 
                ? await DatabaseManager.getFavoritesMetadata()
                : await DatabaseManager.getAllMetadata();
            
            // Initialiser la recherche si pas déjà fait
            if (!this._searchEngine) {
                this._initSearch();
            }
            
            // Appliquer le tri actuel au cache
            if (this._sorter && this._currentSort) {
                this._cachedBooks = this._sorter.sort(this._cachedBooks, this._currentSort);
            }
            
            // Afficher les livres
            this._renderBooks(this._cachedBooks);
            
            logger.info(`Loaded ${this._cachedBooks.length} books (view: ${this.currentView})`, { view: this.currentView, count: this._cachedBooks.length });
        } catch (error) {
            UIManager.showStatus('Erreur lors du chargement');
            logger.error('Library load failed', error);
        }
    },
    
    /**
     * Rend la grille de livres avec lazy loading
     * @param {Array<Object>} books - Liste des livres à afficher
     * @private
     */
    _renderBooks(books) {
        const booksList = UIManager.get('booksList');
        
        if (!booksList) {
            logger.error('Books list element not found');
            return;
        }
        
        // Message personnalisé si aucun livre
        if (books.length === 0) {
            booksList.innerHTML = '';
            const emptyMessage = this.currentView === 'favorites'
                ? `
                    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
                        <div style="font-size:4rem;margin-bottom:20px">⭐</div>
                        <p style="font-size:1.1rem;margin-bottom:8px">Aucun favori pour le moment</p>
                        <p style="font-size:0.9rem">Cliquez sur l'étoile ⭐ d'un livre pour l'ajouter à vos favoris</p>
                    </div>
                `
                : `
                    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
                        <div style="font-size:4rem;margin-bottom:20px">📚</div>
                        <p style="font-size:1.1rem;margin-bottom:8px">Votre bibliothèque est vide</p>
                        <p style="font-size:0.9rem">Importez votre premier livre EPUB pour commencer</p>
                    </div>
                `;
            booksList.innerHTML = emptyMessage;
            this.updateTitle(0);
            return;
        }
        
        // Détruire le virtualizer précédent s'il existe
        if (this._virtualizer) {
            this._virtualizer.destroy();
        }
        
        // Stocker la liste complète
        this._allBooksToRender = books;
        
        // Vider le conteneur
        booksList.innerHTML = '';
        
        // Utiliser le lazy loading si plus de 20 livres
        if (books.length > 20) {
            this._initVirtualizer(books);
        } else {
            // Petit nombre de livres: rendre tout directement
            this._renderBatch(0, books.length, books);
        }
        
        // Mettre à jour le titre avec compteur
        this.updateTitle(books.length);
    },
    
    /**
     * Initialise le virtualizer pour le lazy loading
     * @param {Array<Object>} books - Liste complète des livres
     * @private
     */
    _initVirtualizer(books) {
        const booksList = UIManager.get('booksList');
        if (!booksList) return;
        
        // Créer le virtualizer
        this._virtualizer = new Virtualizer({
            container: booksList,
            batchSize: 20,
            renderBatch: (start, end) => this._renderBatch(start, end, books),
            enableUnload: true
        });
        
        // Initialiser avec les livres
        this._virtualizer.init(books);
    },
    
    /**
     * Rend un batch de cartes de livres
     * @param {number} start - Index de début
     * @param {number} end - Index de fin (exclusif)
     * @param {Array<Object>} books - Liste complète des livres
     * @private
     */
    _renderBatch(start, end, books) {
        const booksList = UIManager.get('booksList');
        if (!booksList) return;
        
        // Rendre les cartes du batch
        for (let i = start; i < end; i++) {
            const book = books[i];
            if (!book) continue;
            
            const card = document.createElement('div');
            card.className = 'book-card';
            card.dataset.id = book.id;
            card.dataset.action = 'open-book';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Ouvrir ${book.title}`);
            card.innerHTML = this._generateBookCardHTML(book);
            
            // Attacher les événements (Menu contextuel + Long press)
            this._attachCardEvents(card, book);
            
            // Attacher le listener favori directement sur le bouton
            const favoriteBtn = card.querySelector('.book-favorite-btn');
            if (favoriteBtn) {
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this._handleFavoriteClick(book.id, favoriteBtn);
                }, { capture: true });
            }
            
            // Insérer avant la sentinelle si elle existe
            if (this._virtualizer?._sentinel) {
                booksList.insertBefore(card, this._virtualizer._sentinel);
            } else {
                booksList.appendChild(card);
            }
            
            // Charger la couverture de manière asynchrone
            this._loadCover(book.id);
        }
    },
    
    /**
     * Attache les événements (Context Menu + Long Press) à une carte
     * @param {HTMLElement} card - Élément DOM de la carte
     * @param {Object} book - Données du livre
     * @private
     */
    _attachCardEvents(card, book) {
        // Desktop: Clic droit
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._showContextMenu(e.clientX, e.clientY, book.id);
        });

        // Mobile: Long Press (600ms)
        let timer = null;
        const LONG_PRESS_DELAY = 600;

        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        card.addEventListener('touchstart', (e) => {
            // Annuler si plusieurs doigts
            if (e.touches.length !== 1) return;
            
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            
            clearTimer();
            timer = setTimeout(() => {
                // Feedback haptique (10ms comme demandé)
                if (navigator.vibrate) navigator.vibrate(10);
                
                this._showContextMenu(startX, startY, book.id);
            }, LONG_PRESS_DELAY);
        }, { passive: true });

        // Annuler si mouvement ou fin de touch
        card.addEventListener('touchmove', clearTimer, { passive: true });
        card.addEventListener('touchend', clearTimer, { passive: true });
        card.addEventListener('touchcancel', clearTimer, { passive: true });
    },

    /**
     * Initialise et affiche le menu contextuel
     * @private
     */
    _showContextMenu(x, y, bookId) {
        // 1. Nettoyer l'ancien menu
        this._hideContextMenu();
        
        // 2. Récupérer les données
        const book = this._cachedBooks.find(b => b.id === bookId);
        if (!book) return;
        
        // 3. Créer le DOM du menu
        const menu = document.createElement('div');
        menu.className = 'lib-context-menu';
        
        const isFavorite = book.favoritedAt !== null && book.favoritedAt !== undefined;
        
        menu.innerHTML = `
            <button class="lib-context-item" data-action="open">
                <span>📖</span> Lire
            </button>
            <button class="lib-context-item" data-action="details">
                <span>ℹ️</span> Détails
            </button>
            <button class="lib-context-item" data-action="favorite">
                <span>${isFavorite ? '★' : '☆'}</span> ${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
            <div class="lib-context-separator"></div>
            <button class="lib-context-item danger" data-action="delete">
                <span>🗑️</span> Supprimer
            </button>
        `;
        
        document.body.appendChild(menu);
        this._contextMenu = menu;

        // 4. Positionnement Intelligent
        this._positionMenu(menu, x, y);

        // 5. Animation d'entrée
        // Force reflow
        void menu.offsetWidth;
        menu.classList.add('active');

        // 6. Gestion des événements de fermeture
        this._closeMenuHandler = (e) => {
            if (!menu.contains(e.target)) {
                this._hideContextMenu();
            }
        };
        
        // Délai pour éviter la fermeture immédiate
        setTimeout(() => {
            document.addEventListener('click', this._closeMenuHandler);
            document.addEventListener('contextmenu', this._closeMenuHandler);
            document.addEventListener('scroll', this._closeMenuHandler, { capture: true, passive: true });
        }, 50);

        // Actions
        menu.addEventListener('click', async (e) => {
            const btn = e.target.closest('.lib-context-item');
            if (!btn) return;
            
            const action = btn.dataset.action;
            this._hideContextMenu();

            switch (action) {
                case 'open':
                    const card = document.querySelector(`.book-card[data-id="${bookId}"]`);
                    if (card) card.click(); // Délègue au handler global
                    break;
                case 'details':
                    this.showDetail(bookId);
                    break;
                case 'favorite':
                    this.toggleFavorite(bookId);
                    break;
                case 'delete':
                    if (confirm('Voulez-vous vraiment supprimer ce livre ?')) {
                        await this.delete(bookId);
                    }
                    break;
            }
        });
    },

    /**
     * Positionne le menu intelligemment pour éviter les débordements
     * @private
     */
    _positionMenu(menu, x, y) {
        const rect = menu.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        
        let posX = x;
        let posY = y;
        let originX = 'left';
        let originY = 'top';
        
        // Flip Horizontal si débordement à droite
        if (posX + rect.width > winW) {
            posX -= rect.width;
            originX = 'right';
        }
        
        // Flip Vertical si débordement en bas
        if (posY + rect.height > winH) {
            posY -= rect.height;
            originY = 'bottom';
        }
        
        menu.style.left = `${posX}px`;
        menu.style.top = `${posY}px`;
        menu.style.transformOrigin = `${originY} ${originX}`;
    },

    /**
     * Ferme le menu contextuel
     * @private
     */
    _hideContextMenu() {
        if (this._contextMenu) {
            const menu = this._contextMenu;
            this._contextMenu = null;
            menu.classList.remove('active');
            setTimeout(() => menu.remove(), 200);
        }
        
        if (this._closeMenuHandler) {
            document.removeEventListener('click', this._closeMenuHandler);
            document.removeEventListener('contextmenu', this._closeMenuHandler);
            document.removeEventListener('scroll', this._closeMenuHandler, { capture: true });
            this._closeMenuHandler = null;
        }
    },

    /**
     * Génère le HTML d'une carte de livre pour la grille
     * @param {Object} book - Données du livre
     * @returns {string} HTML de la carte
     * @private
     */
    _generateBookCardHTML(book) {
        const coverHTML = book.coverUrl 
            ? `<img src="${book.coverUrl}" alt="${this._escapeHtml(book.title)}" loading="lazy">`
            : '<span class="book-cover-placeholder">📖</span>';
        
        const isFavorite = book.favoritedAt !== null && book.favoritedAt !== undefined;
        const favoriteClass = isFavorite ? 'active' : '';
        
        // Gestion de la progression
        const hasStarted = !!book.lastCFI;
        const progressText = book.lastChapter || (hasStarted ? 'En cours' : 'Non commencé');
        // Si pas de pourcentage précis en DB, on met 0% ou une valeur visuelle si commencé
        const progressPercent = hasStarted ? (book.progress || 15) : 0; 
        
        return `
            <div class="book-cover ${!book.coverUrl ? 'loading' : ''}">
                <button class="book-favorite-btn ${favoriteClass}" data-book-id="${book.id}" aria-label="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                </button>
                ${coverHTML}
            </div>
            <div class="book-info">
                <div class="book-title" title="${this._escapeHtml(book.title)}">${this._escapeHtml(book.title)}</div>
                <div class="book-author">${this._escapeHtml(book.author || 'Auteur inconnu')}</div>
                
                <div class="book-progress-container">
                    <div class="book-progress-text">${this._escapeHtml(progressText)}</div>
                    <div class="book-progress-bar">
                        <div class="book-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            </div>
        `;
    },

    _escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },

    /**
     * Charge la couverture d'un livre et met à jour le DOM
     * @param {number} id - ID du livre
     * @private
     */
    async _loadCover(id) {
        // Vérifier si la carte est toujours dans le DOM (virtualisation)
        const card = document.querySelector(`.book-card[data-id="${id}"]`);
        if (!card) return;

        // Vérifier si l'image est déjà chargée
        const coverContainer = card.querySelector('.book-cover');
        if (!coverContainer || coverContainer.querySelector('img')) return;

        try {
            const coverUrl = await DatabaseManager.getCover(id);
            
            // Si une couverture existe et que la carte est toujours connectée
            if (coverUrl && card.isConnected) {
                const placeholder = coverContainer.querySelector('.book-cover-placeholder');
                
                if (placeholder) {
                    const img = document.createElement('img');
                    img.src = coverUrl;
                    img.alt = card.querySelector('.book-title')?.textContent || 'Couverture';
                    img.loading = "lazy";
                    
                    // Petite animation d'apparition
                    img.style.opacity = '0';
                    img.style.transition = 'opacity 0.3s ease';
                    img.onload = () => img.style.opacity = '1';
                    
                    // Retirer la classe loading du conteneur
                    coverContainer.classList.remove('loading');
                    
                    placeholder.replaceWith(img);
                }
            }
        } catch (e) {
            // Échec silencieux, on garde le placeholder
        }
    },
    
    /**
     * Met à jour le titre de la page avec le compteur
     * @param {number} count - Nombre de livres affichés
     * @private
     */
    updateTitle(count) {
        const titleElement = document.querySelector('.lib-header h1');
        if (!titleElement) return;
        
        const titles = {
            'all': `Bibliothèque${count > 0 ? ` (${count})` : ''}`,
            'favorites': `Favoris${count > 0 ? ` (${count})` : ''}`,
            'stats': 'Statistiques'
        };
        
        titleElement.textContent = titles[this.currentView] || 'Bibliothèque';
    },
    
    /**
     * Importe un fichier EPUB dans la bibliothèque
     * @param {File} file - Fichier EPUB à importer
     */
    async import(file) {
        if (!file?.name.toLowerCase().endsWith('.epub')) {
            UIManager.showStatus('Format non valide. Seuls les fichiers .epub sont acceptés.');
            return;
        }
        
        try {
            // Étape 1: Lecture du fichier
            UIManager.showLoader('Chargement du fichier');
            
            // Lire le fichier en ArrayBuffer pour créer le Blob
            const buffer = await file.arrayBuffer();
            const epubBlob = new Blob([buffer], { type: 'application/epub+zip' });
            
            // Étape 2: Parsing dans le Web Worker (métadonnées + couverture)
            UIManager.showLoader('Analyse du fichier EPUB');
            
            let metadata = null;
            let coverBlob = null;
            let coverUrl = null;
            
            try {
                // Tenter de parser avec le worker
                const result = await this._parseEpubInWorker(file);
                metadata = result.metadata;
                coverBlob = result.coverBlob;
            } catch (workerError) {
                logger.warn('Worker parsing failed, falling back to main thread', workerError);
                
                // Fallback: parser dans le main thread si le worker échoue
                UIManager.showLoader('Extraction des métadonnées (fallback)');
                const zip = new JSZip();
                await zip.loadAsync(buffer);
                metadata = await parseMetadata(zip);
                
                // Essayer d'extraire la couverture
                UIManager.showLoader('Extraction de la couverture (fallback)');
                try {
                    coverUrl = await extractCover(epubBlob);
                    // extractCover retourne une URL base64, on la garde telle quelle
                    // (coverBlob reste null, on utilisera coverUrl)
                } catch (coverError) {
                    logger.debug('Cover extraction failed', coverError);
                }
            }
            
            // Fallback si pas de titre
            if (!metadata || !metadata.title) {
                if (!metadata) metadata = {};
                metadata.title = file.name.replace('.epub', '');
            }
            
            // Convertir le coverBlob en base64 pour stockage
            if (!coverBlob && !coverUrl) {
                UIManager.showLoader('Extraction de la couverture');
                try {
                    coverUrl = await extractCover(epubBlob);
                } catch (coverError) {
                    logger.debug('Cover extraction failed', coverError);
                }
            }

            if (coverBlob) {
                UIManager.showLoader('Conversion de la couverture');
                coverUrl = await blobToBase64(coverBlob);
            }
            
            // Étape 3: Sauvegarde en base de données
            UIManager.showLoader('Sauvegarde en base');
            await DatabaseManager.add({
                title: metadata.title || 'Sans titre',
                author: metadata.author || 'Auteur inconnu',
                description: metadata.synopsis || metadata.description || '',
                language: metadata.language || 'fr',
                publisher: metadata.publisher || '',
                fileName: file.name,
                epubData: epubBlob,
                timestamp: Date.now(),
                coverUrl,
                progress: 0,
                lastCFI: null,
                lastChapter: null,
                favoritedAt: null
            });
            
            // Masquer le loader avec un léger délai pour le feedback
            UIManager.hideLoader(200);
            
            // Message de succès
            setTimeout(() => {
                UIManager.showStatus('📖 Livre importé avec succès !');
            }, 400);
            
            await this.load();
            
        } catch (error) {
            UIManager.hideLoader();
            UIManager.showStatus('Erreur lors de l\'import');
            logger.error('Import failed', error);
        }
    },
    
    /**
     * Supprime un livre de la bibliothèque
     * @param {number} id - ID du livre à supprimer
     */
    async delete(id) {
        try {
            await DatabaseManager.delete(id);
            await DatabaseManager.deleteStatistics(id);
            UIManager.showStatus('🗑️ Livre supprimé');
            await this.load();
        } catch (error) {
            UIManager.showStatus('Erreur lors de la suppression');
            logger.error('Delete failed', error);
        }
    },
    
    /**
     * Affiche les détails d'un livre dans une modale
     * @param {number} id - ID du livre
     */
    async showDetail(id) {
        try {
            const book = await DatabaseManager.get(id);
            if (!book) {
                UIManager.showStatus('Livre non trouvé');
                return;
            }
            
            // Compter les chapitres
            let chapterCount = 0;
            try {
                const tempBook = window.ePub({ replacements: 'blobUrl' });
                await tempBook.open(book.epubData);
                await tempBook.ready;
                const toc = tempBook.navigation?.toc || [];
                
                const countChapters = (items) => {
                    items.forEach(item => {
                        chapterCount++;
                        if (item.subitems) countChapters(item.subitems);
                    });
                };
                countChapters(toc);
                tempBook.destroy?.();
            } catch (e) {
                // Ignorer les erreurs de comptage
            }
            
            const modalContent = UIManager.get('bookModalContent');
            if (modalContent) {
                modalContent.innerHTML = UIManager.renderBookModal(book, chapterCount);
            }
            UIManager.showModal();
            
        } catch (error) {
            UIManager.showStatus('Erreur lors de l\'affichage');
            logger.error('Show detail failed', error);
        }
    },
    
    /**
     * Gère le clic sur un bouton favori
     * @param {number} bookId - ID du livre
     * @param {HTMLElement} btn - Le bouton cliqué
     * @private
     */
    async _handleFavoriteClick(bookId, btn) {
        // 1. Debounce / Anti-spam
        if (btn.dataset.processing) return;
        btn.dataset.processing = 'true';

        // 2. Immediate Visual Feedback (Optimistic UI)
        const wasActive = btn.classList.contains('active');
        const newState = !wasActive;
        
        // Toggle class immediately
        btn.classList.toggle('active', newState);
        btn.setAttribute('aria-label', newState ? 'Retirer des favoris' : 'Ajouter aux favoris');
        
        // Animation feedback
        btn.classList.add('animating');
        setTimeout(() => btn.classList.remove('animating'), 300);
        
        // Remove sticky focus (fixes UI glitch on mouse click)
        btn.blur();
        
        try {
            // 3. Database Operation
            const result = await FavoritesManager.toggle(bookId);
            
            if (result.success) {
                UIManager.showStatus(newState ? '⭐ Ajouté aux favoris' : 'Retiré des favoris');
                
                // Reconciliation (if DB state differs from optimistic state - rare)
                if (result.isFavorite !== newState) {
                    btn.classList.toggle('active', result.isFavorite);
                    btn.setAttribute('aria-label', result.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris');
                }
                
                // Handle removal from favorites view
                if (this.currentView === 'favorites' && !result.isFavorite) {
                    const card = btn.closest('.book-card');
                    if (card) {
                        card.style.transition = 'opacity 0.3s, transform 0.3s';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        
                        setTimeout(() => {
                            card.remove();
                            const booksList = UIManager.get('booksList');
                            if (booksList) {
                                const remaining = booksList.querySelectorAll('.book-card').length;
                                this.updateTitle(remaining);
                                if (remaining === 0) this._renderBooks([]);
                            }
                        }, 300);
                    }
                }
            }
        } catch (error) {
            // Revert on error
            btn.classList.toggle('active', wasActive);
            UIManager.showStatus('Erreur de synchronisation');
            logger.error('Favorite toggle failed', error);
        } finally {
            delete btn.dataset.processing;
        }
    },
    
    /**
     * Bascule le statut favori d'un livre (API publique)
     * @param {number} id - ID du livre
     */
    async toggleFavorite(id) {
        // Trouver le bouton et déclencher le handler
        const btn = document.querySelector(`.book-favorite-btn[data-book-id="${id}"]`);
        if (btn) {
            await this._handleFavoriteClick(id, btn);
        }
    }
};
