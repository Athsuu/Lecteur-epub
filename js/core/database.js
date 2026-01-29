/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE.JS
 * Gestion de la base de données IndexedDB.
 * Stocke les livres EPUB et leurs métadonnées (progression, CFI, etc.).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config } from './config.js';

/**
 * Instance de la base de données
 * @private
 */
let db = null;

/**
 * Récupère l'object store pour les transactions
 * @param {string} mode - Mode de transaction ('readonly' ou 'readwrite')
 * @returns {IDBObjectStore} L'object store
 * @private
 */
function getStore(mode) {
    if (!db) {
        throw new Error('Database not initialized. Call init() first.');
    }
    const transaction = db.transaction([Config.STORE_NAME], mode);
    return transaction.objectStore(Config.STORE_NAME);
}

/**
 * Transforme une requête IndexedDB en Promise
 * @param {IDBRequest} request - Requête IndexedDB
 * @returns {Promise} Promise résolvant avec le résultat
 * @private
 */
function promisify(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Nettoie un objet livre pour ne garder que les métadonnées légères
 * Retire les gros blobs (epubData) et les longues chaînes (coverUrl)
 * @param {Object} book - Objet livre complet
 * @returns {Object} Objet livre léger
 */
function stripHeavyData(book) {
    const { epubData, coverUrl, ...metadata } = book;
    return metadata;
}

/**
 * DatabaseManager - Interface de gestion IndexedDB
 * Fournit des méthodes async/await pour toutes les opérations CRUD
 */
export const DatabaseManager = {
    /**
     * Initialise la connexion à IndexedDB
     * Crée la base de données et les stores si nécessaire
     * @returns {Promise<IDBDatabase>} La base de données initialisée
     */
    async init() {
        if (db) return db; // Déjà initialisée
        
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(Config.DB_NAME, Config.DB_VERSION);
                
                request.onerror = () => {
                    const error = new Error('Failed to open IndexedDB database');
                    console.error(error);
                    reject(error);
                };
                
                request.onsuccess = () => {
                    db = request.result;
                    console.log('📚 Database initialized successfully (version ' + db.version + ')');
                    resolve(db);
                };
                
                request.onupgradeneeded = (event) => {
                    const database = event.target.result;
                    const oldVersion = event.oldVersion;
                    
                    // Migration V0 -> V1 : Création initiale du store
                    if (oldVersion < 1) {
                        if (!database.objectStoreNames.contains(Config.STORE_NAME)) {
                            const store = database.createObjectStore(Config.STORE_NAME, {
                                keyPath: 'id',
                                autoIncrement: true
                            });
                            
                            // Index pour recherche rapide
                            store.createIndex('title', 'title', { unique: false });
                            store.createIndex('author', 'author', { unique: false });
                            store.createIndex('timestamp', 'timestamp', { unique: false });
                            
                            console.log('📦 Object store created with indexes');
                        }
                    }
                    
                    // Migration V1 -> V2 : Ajout de l'index isFavorite
                    if (oldVersion < 2) {
                        const transaction = event.target.transaction;
                        const store = transaction.objectStore(Config.STORE_NAME);
                        
                        // Créer l'index s'il n'existe pas déjà
                        if (!store.indexNames.contains('isFavorite')) {
                            store.createIndex('isFavorite', 'isFavorite', { unique: false });
                            console.log('⭐ Index isFavorite created');
                        }
                        
                        // Initialiser isFavorite à false pour les livres existants
                        const getAllRequest = store.getAll();
                        getAllRequest.onsuccess = () => {
                            const books = getAllRequest.result;
                            books.forEach(book => {
                                if (book.isFavorite === undefined) {
                                    book.isFavorite = false;
                                    store.put(book);
                                }
                            });
                            console.log(`🔄 Migrated ${books.length} books to V2`);
                        };
                    }
                    
                    // Migration V2 -> V3 : Remplacement isFavorite par favoritedAt
                    if (oldVersion < 3) {
                        const transaction = event.target.transaction;
                        const store = transaction.objectStore(Config.STORE_NAME);
                        
                        // Créer l'index favoritedAt s'il n'existe pas
                        if (!store.indexNames.contains('favoritedAt')) {
                            store.createIndex('favoritedAt', 'favoritedAt', { unique: false });
                            console.log('⭐ Index favoritedAt created');
                        }
                        
                        // Migrer isFavorite (bool) vers favoritedAt (timestamp)
                        const getAllRequest = store.getAll();
                        getAllRequest.onsuccess = () => {
                            const books = getAllRequest.result;
                            books.forEach(book => {
                                if (book.isFavorite === true && !book.favoritedAt) {
                                    book.favoritedAt = Date.now();
                                    store.put(book);
                                } else if (!book.favoritedAt) {
                                    book.favoritedAt = null;
                                    store.put(book);
                                }
                            });
                            console.log(`🔄 Migrated ${books.length} books to V3 (favoritedAt)`);
                        };
                    }
                    
                    // Migration V3 -> V4 : Création du store 'statistics'
                    if (oldVersion < 4) {
                        if (!database.objectStoreNames.contains(Config.STATS_STORE_NAME)) {
                            const statsStore = database.createObjectStore(Config.STATS_STORE_NAME, {
                                keyPath: 'bookId'
                            });
                            
                            // Index pour requêtes optimisées
                            statsStore.createIndex('totalSeconds', 'totalSeconds', { unique: false });
                            statsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                            
                            console.log('📊 Statistics store created');
                        }
                    }
                };
            });
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    },
    
    /**
     * Ajoute un nouveau livre à la base
     * @param {Object} data - Données du livre
     * @returns {Promise<number>} ID du livre ajouté
     */
    async add(data) {
        try {
            const id = await promisify(getStore('readwrite').add(data));
            console.log(`📖 Book added with ID: ${id}`);
            return id;
        } catch (error) {
            console.error('Failed to add book:', error);
            throw error;
        }
    },
    
    /**
     * Récupère un livre par son ID
     * @param {number} id - ID du livre
     * @returns {Promise<Object|undefined>} Le livre ou undefined
     */
    async get(id) {
        try {
            return await promisify(getStore('readonly').get(id));
        } catch (error) {
            console.error(`Failed to get book ${id}:`, error);
            throw error;
        }
    },
    
    /**
     * Récupère uniquement la couverture d'un livre
     * @param {number} id - ID du livre
     * @returns {Promise<string|null>} URL de la couverture ou null
     */
    async getCover(id) {
        try {
            const book = await this.get(id);
            return book?.coverUrl || null;
        } catch (error) {
            console.error(`Failed to get cover for book ${id}:`, error);
            return null;
        }
    },

    /**
     * Récupère toutes les métadonnées (sans les fichiers lourds)
     * Optimisé pour l'affichage de la liste
     * @returns {Promise<Array>} Liste des métadonnées triées
     */
    async getAllMetadata() {
        try {
            const books = await this.getAll();
            return books.map(stripHeavyData);
        } catch (error) {
            console.error('Failed to get all metadata:', error);
            throw error;
        }
    },

    /**
     * Récupère tous les livres
     * @returns {Promise<Array>} Liste de tous les livres
     */
    async getAll() {
        try {
            const books = await promisify(getStore('readonly').getAll());
            // Trier par date d'ajout (plus récent en premier)
            return books.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch (error) {
            console.error('Failed to get all books:', error);
            throw error;
        }
    },

    /**
     * Récupère les métadonnées des favoris (sans fichiers lourds)
     * @returns {Promise<Array>} Liste des favoris légers
     */
    async getFavoritesMetadata() {
        const favorites = await this.getFavorites();
        return favorites.map(stripHeavyData);
    },

    /**
     * Récupère tous les livres favoris
     * Utilise l'index favoritedAt (timestamp) pour une requête optimisée
     * @returns {Promise<Array>} Liste des favoris triés par date (plus récent en premier)
     */
    async getFavorites() {
        try {
            const store = getStore();
            
            // Vérifier si l'index favoritedAt existe (V3)
            if (store.indexNames.contains('favoritedAt')) {
                // Utiliser un curseur pour récupérer tous les favoris (favoritedAt != null)
                const index = store.index('favoritedAt');
                const books = [];
                
                return new Promise((resolve, reject) => {
                    // Ouvrir un curseur sur tous les éléments de l'index
                    const request = index.openCursor();
                    
                    request.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            // Filtrer : favoritedAt doit être un nombre (pas null)
                            if (cursor.key !== null && typeof cursor.key === 'number') {
                                books.push(cursor.value);
                            }
                            cursor.continue();
                        } else {
                            // Fin du curseur : trier par date (plus récent en premier)
                            books.sort((a, b) => (b.favoritedAt || 0) - (a.favoritedAt || 0));
                            resolve(books);
                        }
                    };
                    
                    request.onerror = () => reject(request.error);
                });
            }
            
            // Fallback pour les anciennes versions (V2 avec isFavorite)
            console.warn('[DB] Using fallback for favorites (manual filter)');
            const allBooks = await this.getAll();
            return allBooks.filter(book => 
                book.favoritedAt !== null && book.favoritedAt !== undefined
            ).sort((a, b) => (b.favoritedAt || 0) - (a.favoritedAt || 0));
            
        } catch (error) {
            console.error('Failed to get favorites:', error);
            // Dernier fallback
            try {
                const allBooks = await this.getAll();
                return allBooks.filter(book => 
                    book.isFavorite === true || 
                    (book.favoritedAt !== null && book.favoritedAt !== undefined)
                );
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
                return [];
            }
        }
    },
    
    /**
     * Compte le nombre de livres favoris
     * @returns {Promise<number>} Nombre de favoris
     */
    async countFavorites() {
        try {
            // Utiliser getFavorites() et compter (simple et fiable)
            const favorites = await this.getFavorites();
            return favorites.length;
        } catch (error) {
            console.error('Failed to count favorites:', error);
            return 0;
        }
    },    
    /**
     * Supprime un livre par son ID
     * @param {number} id - ID du livre à supprimer
     * @returns {Promise<void>}
     */
    async delete(id) {
        try {
            await promisify(getStore('readwrite').delete(id));
            console.log(`🗑️ Book ${id} deleted`);
        } catch (error) {
            console.error(`Failed to delete book ${id}:`, error);
            throw error;
        }
    },
    
    /**
     * Met à jour un livre existant
     * @param {number} id - ID du livre
     * @param {Object} updates - Propriétés à mettre à jour
     * @returns {Promise<void>}
     */
    async update(id, updates) {
        try {
            const book = await this.get(id);
            if (!book) {
                throw new Error(`Book ${id} not found`);
            }
            
            // Fusionner les mises à jour
            const updatedBook = { ...book, ...updates };
            await promisify(getStore('readwrite').put(updatedBook));
            
            console.log(`📝 Book ${id} updated`);
        } catch (error) {
            console.error(`Failed to update book ${id}:`, error);
            throw error;
        }
    },
    
    /**
     * Sauvegarde la progression de lecture d'un livre
     * @param {number} id - ID du livre
     * @param {string} cfi - Position CFI epub.js
     * @param {string|null} chapterName - Nom du chapitre actuel
     * @returns {Promise<void>}
     */
    async saveProgress(id, cfi, chapterName = null) {
        try {
            await this.update(id, {
                lastCFI: cfi,
                lastChapter: chapterName,
                lastRead: Date.now()
            });
        } catch (error) {
            console.error(`Failed to save progress for book ${id}:`, error);
            // Ne pas propager l'erreur pour ne pas interrompre la lecture
        }
    },
    
    /**
     * Compte le nombre de livres dans la bibliothèque
     * @returns {Promise<number>} Nombre de livres
     */
    async count() {
        try {
            return await promisify(getStore('readonly').count());
        } catch (error) {
            console.error('Failed to count books:', error);
            return 0;
        }
    },
    
    /**
     * Vérifie si la base de données est initialisée
     * @returns {boolean}
     */
    isReady() {
        return db !== null;
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // GESTION DES STATISTIQUES
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * Récupère les statistiques d'un livre
     * @param {number} bookId - ID du livre
     * @returns {Promise<Object|null>} Statistiques ou null
     */
    async getStatistics(bookId) {
        try {
            if (!db) throw new Error('Database not initialized');
            
            const transaction = db.transaction([Config.STATS_STORE_NAME], 'readonly');
            const store = transaction.objectStore(Config.STATS_STORE_NAME);
            return await promisify(store.get(bookId));
        } catch (error) {
            console.error(`Failed to get statistics for book ${bookId}:`, error);
            return null;
        }
    },
    
    /**
     * Sauvegarde les statistiques d'un livre
     * @param {number} bookId - ID du livre
     * @param {Object} data - Données statistiques
     * @returns {Promise<void>}
     */
    async saveStatistics(bookId, data) {
        try {
            if (!db) throw new Error('Database not initialized');
            
            const statsData = {
                bookId,
                ...data,
                lastUpdated: Date.now()
            };
            
            const transaction = db.transaction([Config.STATS_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(Config.STATS_STORE_NAME);
            await promisify(store.put(statsData));
            
            console.log(`📊 Statistics saved for book ${bookId}`);
        } catch (error) {
            console.error(`Failed to save statistics for book ${bookId}:`, error);
            throw error;
        }
    },
    
    /**
     * Récupère toutes les statistiques
     * @returns {Promise<Array>} Liste de toutes les statistiques
     */
    async getAllStatistics() {
        try {
            if (!db) throw new Error('Database not initialized');
            
            const transaction = db.transaction([Config.STATS_STORE_NAME], 'readonly');
            const store = transaction.objectStore(Config.STATS_STORE_NAME);
            return await promisify(store.getAll());
        } catch (error) {
            console.error('Failed to get all statistics:', error);
            return [];
        }
    },
    
    /**
     * Supprime les statistiques d'un livre
     * @param {number} bookId - ID du livre
     * @returns {Promise<void>}
     */
    async deleteStatistics(bookId) {
        try {
            if (!db) throw new Error('Database not initialized');
            
            const transaction = db.transaction([Config.STATS_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(Config.STATS_STORE_NAME);
            await promisify(store.delete(bookId));
            
            console.log(`🗑️ Statistics deleted for book ${bookId}`);
        } catch (error) {
            console.error(`Failed to delete statistics for book ${bookId}:`, error);
            // Ne pas propager l'erreur
        }
    }
};
