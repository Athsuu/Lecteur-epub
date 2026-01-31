/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SORTER.JS
 * Logique de tri des livres avec critères multiples.
 * Optimisé pour performances (O(n log n) avec Array.prototype.sort).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Critères de tri disponibles
 * @enum {string}
 */
export const SortCriteria = {
    ADDED_DESC: 'added_desc',      // Plus récents d'abord (par défaut)
    ADDED_ASC: 'added_asc',         // Plus anciens d'abord
    TITLE_ASC: 'title_asc',         // A→Z
    TITLE_DESC: 'title_desc',       // Z→A
    AUTHOR_ASC: 'author_asc',       // A→Z
    AUTHOR_DESC: 'author_desc',     // Z→A
    PROGRESS_DESC: 'progress_desc', // Actuellement en cours
};

/**
 * Normalise une chaîne pour la comparaison (accents, casse)
 * @param {string} str - Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 * @private
 */
function normalize(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Classe Sorter - Gère le tri des livres
 */
export class Sorter {
    /**
     * Constructeur
     * @param {string} defaultCriteria - Critère par défaut
     */
    constructor(defaultCriteria = SortCriteria.ADDED_DESC) {
        this.defaultCriteria = defaultCriteria;
        this.currentCriteria = defaultCriteria;
    }
    
    /**
     * Trie une liste de livres selon le critère
     * @param {Array<Object>} books - Liste des livres
     * @param {string} criteria - Critère de tri
     * @returns {Array<Object>} Nouvelle liste triée (sans muter l'original)
     */
    sort(books, criteria = this.currentCriteria) {
        if (!books || books.length === 0) return books;
        
        // Conserver l'original
        const sorted = [...books];
        this.currentCriteria = criteria;
        
        // Appliquer le tri selon le critère
        switch (criteria) {
            case SortCriteria.TITLE_ASC:
                sorted.sort((a, b) => 
                    normalize(a.title).localeCompare(normalize(b.title), 'fr')
                );
                break;
                
            case SortCriteria.TITLE_DESC:
                sorted.sort((a, b) => 
                    normalize(b.title).localeCompare(normalize(a.title), 'fr')
                );
                break;
                
            case SortCriteria.AUTHOR_ASC:
                sorted.sort((a, b) => 
                    normalize(a.author).localeCompare(normalize(b.author), 'fr')
                );
                break;
                
            case SortCriteria.AUTHOR_DESC:
                sorted.sort((a, b) => 
                    normalize(b.author).localeCompare(normalize(a.author), 'fr')
                );
                break;
                
            case SortCriteria.ADDED_ASC:
                sorted.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                break;
                
            case SortCriteria.PROGRESS_DESC:
                // Livres en cours (avec progression) d'abord, puis par date
                sorted.sort((a, b) => {
                    const aProgress = a.progress || 0;
                    const bProgress = b.progress || 0;
                    
                    // Livres en cours en premier (progress > 0)
                    if ((aProgress > 0) !== (bProgress > 0)) {
                        return (bProgress > 0) - (aProgress > 0);
                    }
                    
                    // Parmi les livres en cours, par progression décroissante
                    if (aProgress > 0 && bProgress > 0) {
                        return bProgress - aProgress;
                    }
                    
                    // Les autres par date d'ajout
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                break;
                
            case SortCriteria.ADDED_DESC:
            default:
                sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                break;
        }
        
        return sorted;
    }
}
