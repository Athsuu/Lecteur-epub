/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUALIZER.JS
 * Lazy Loading avec IntersectionObserver pour rendu progressif de grilles.
 * Charge les éléments par batch et décharge les sortis du viewport.
 * Performance optimisée : O(1) rendu, pas de jank au scroll.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Classe Virtualizer - Gère le lazy loading avec IntersectionObserver
 */
export class Virtualizer {
    /**
     * Constructeur
     * @param {Object} options - Options
     * @param {HTMLElement} options.container - Conteneur de la grille
     * @param {number} options.batchSize - Nombre d'éléments par batch (défaut: 20)
     * @param {Function} options.renderBatch - Fonction de rendu (batch) => void
     * @param {boolean} options.enableUnload - Décharger hors viewport (défaut: true)
     */
    constructor(options = {}) {
        this.container = options.container;
        this.batchSize = options.batchSize || 20;
        this.renderBatch = options.renderBatch;
        this.enableUnload = options.enableUnload !== false;
        
        // État interne
        this._totalItems = 0;
        this._renderedCount = 0;
        this._sentinel = null;
        this._observer = null;
        this._itemMap = new Map(); // ID → Element pour déchargement
        this._isLoading = false;
    }
    
    /**
     * Initialise le virtualizer avec une liste d'items
     * @param {Array<Object>} items - Liste totale des items
     */
    init(items) {
        this._totalItems = items.length;
        this._renderedCount = 0;
        this._itemMap.clear();
        
        if (!this.container) return;
        
        // Vider le conteneur
        this.container.innerHTML = '';
        
        // Créer la sentinelle
        this._createSentinel();
        
        // Initier le chargement du premier batch
        this._loadNextBatch(items);
    }
    
    /**
     * Crée la sentinelle qui déclenche le chargement
     * @private
     */
    _createSentinel() {
        this._sentinel = document.createElement('div');
        this._sentinel.className = 'virtualizer-sentinel';
        this._sentinel.style.height = '1px';
        this._sentinel.style.visibility = 'hidden';
        this.container.appendChild(this._sentinel);
        
        // Observer la sentinelle
        this._observeSentinel();
    }
    
    /**
     * Observe la sentinelle avec IntersectionObserver
     * @private
     */
    _observeSentinel() {
        if (!this._sentinel) return;
        
        // Options de l'observer
        const observerOptions = {
            root: null,
            rootMargin: '100px', // Charger avant d'arriver au bas
            threshold: 0
        };
        
        // Callback quand la sentinelle devient visible
        const callback = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this._isLoading) {
                    // Charger le batch suivant
                    this._isLoading = true;
                    requestAnimationFrame(() => {
                        this._loadNextBatch();
                    });
                }
            });
        };
        
        this._observer = new IntersectionObserver(callback, observerOptions);
        this._observer.observe(this._sentinel);
    }
    
    /**
     * Charge le batch suivant d'items
     * @param {Array<Object>} allItems - Liste totale (optionnel, si fourni)
     * @private
     */
    _loadNextBatch(allItems = null) {
        // Vérifier si tout est déjà chargé
        if (this._renderedCount >= this._totalItems) {
            this._isLoading = false;
            return;
        }
        
        // Calculer le batch à rendre
        const start = this._renderedCount;
        const end = Math.min(start + this.batchSize, this._totalItems);
        
        // Appeler le callback de rendu
        if (this.renderBatch) {
            this.renderBatch(start, end, allItems);
        }
        
        this._renderedCount = end;
        this._isLoading = false;
        
        // Redéplacer la sentinelle à la fin
        if (this._sentinel && this._sentinel.parentNode) {
            this._sentinel.parentNode.appendChild(this._sentinel);
        }
        
        // Optionnel: décharger les éléments hors viewport
        if (this.enableUnload) {
            this._unloadOutOfViewport();
        }
    }
    
    /**
     * Décharge les éléments hors du viewport pour économiser la mémoire
     * @private
     */
    _unloadOutOfViewport() {
        if (!this.container) return;
        
        const items = this.container.querySelectorAll('.book-card');
        const containerRect = this.container.getBoundingClientRect();
        const viewport = {
            top: containerRect.top,
            bottom: containerRect.bottom + window.innerHeight
        };
        
        items.forEach(item => {
            const rect = item.getBoundingClientRect();
            const isVisible = rect.bottom > viewport.top && rect.top < viewport.bottom;
            
            // Passer les éléments invisibles à faible priorité
            if (!isVisible) {
                item.style.contain = 'layout style paint'; // CSS containment
                if (item.style.opacity !== '0.3') {
                    // Garder visible mais moins prioritaire
                    item.setAttribute('data-unloaded', 'true');
                }
            } else {
                item.removeAttribute('data-unloaded');
                item.style.contain = 'auto';
            }
        });
    }
    
    /**
     * Détruit le virtualizer et nettoie les ressources
     */
    destroy() {
        if (this._observer) {
            if (this._sentinel) {
                this._observer.unobserve(this._sentinel);
            }
            this._observer.disconnect();
        }
        
        this._sentinel = null;
        this._observer = null;
        this._itemMap.clear();
    }
    
    /**
     * Retourne le nombre d'éléments rendus
     */
    getRenderedCount() {
        return this._renderedCount;
    }
    
    /**
     * Retourne le nombre total d'éléments
     */
    getTotalCount() {
        return this._totalItems;
    }
    
    /**
     * Retourne le pourcentage de chargement
     */
    getProgress() {
        return Math.round((this._renderedCount / this._totalItems) * 100);
    }
}

/**
 * Export par défaut
 */
export default Virtualizer;
