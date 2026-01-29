/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEARCH-ENGINE.JS
 * Moteur de recherche fuzzy natif optimisé pour performances mobiles.
 * Recherche sur title et author avec normalisation des accents.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Normalise une chaîne pour la recherche (lowercase + suppression accents)
 * @param {string} str - Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 * @private
 */
function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Supprime les diacritiques
}

/**
 * Calcule le score de similarité entre deux chaînes (algorithme Levenshtein simplifié)
 * @param {string} query - Terme de recherche
 * @param {string} target - Texte cible
 * @returns {number} Score de 0 (aucune correspondance) à 1 (correspondance parfaite)
 * @private
 */
function fuzzyScore(query, target) {
    if (!query || !target) return 0;
    if (target.includes(query)) return 1; // Correspondance exacte = score maximal
    
    const queryLen = query.length;
    const targetLen = target.length;
    
    // Si la requête est plus longue que la cible, pas de correspondance
    if (queryLen > targetLen) return 0;
    
    // Recherche de sous-séquence (les lettres peuvent être espacées)
    let queryIndex = 0;
    let matches = 0;
    
    for (let i = 0; i < targetLen && queryIndex < queryLen; i++) {
        if (target[i] === query[queryIndex]) {
            matches++;
            queryIndex++;
        }
    }
    
    // Score basé sur le pourcentage de lettres trouvées et leur proximité
    if (matches === 0) return 0;
    
    const completeness = matches / queryLen; // Pourcentage de lettres trouvées
    const density = matches / targetLen;      // Densité des correspondances
    
    return completeness * 0.7 + density * 0.3; // Pondération
}

/**
 * Classe SearchEngine - Moteur de recherche fuzzy pour livres
 */
export class SearchEngine {
    /**
     * Constructeur
     * @param {Object} options - Options de configuration
     * @param {number} options.threshold - Score minimum pour considérer un résultat (0-1)
     * @param {string[]} options.keys - Champs à indexer (ex: ['title', 'author'])
     */
    constructor(options = {}) {
        this.threshold = options.threshold || 0.3;
        this.keys = options.keys || ['title', 'author'];
    }
    
    /**
     * Recherche dans une liste de livres
     * @param {string} query - Terme de recherche
     * @param {Array<Object>} books - Liste des livres
     * @returns {Array<Object>} Livres filtrés et triés par pertinence
     */
    search(query, books) {
        // Requête vide = retourner tous les livres
        const trimmedQuery = query?.trim();
        if (!trimmedQuery) return books;
        
        const normalizedQuery = normalize(trimmedQuery);
        
        // Calculer le score pour chaque livre
        const results = books
            .map(book => {
                let maxScore = 0;
                
                // Calculer le score pour chaque champ indexé
                for (const key of this.keys) {
                    const value = book[key];
                    if (!value) continue;
                    
                    const normalizedValue = normalize(String(value));
                    const score = fuzzyScore(normalizedQuery, normalizedValue);
                    
                    // Garder le meilleur score
                    if (score > maxScore) {
                        maxScore = score;
                    }
                }
                
                return { book, score: maxScore };
            })
            .filter(result => result.score >= this.threshold) // Filtrer par seuil
            .sort((a, b) => b.score - a.score)                 // Trier par pertinence
            .map(result => result.book);                       // Extraire les livres
        
        return results;
    }
}

/**
 * Crée une fonction debounced
 * @param {Function} func - Fonction à debouncer
 * @param {number} delay - Délai en millisecondes
 * @returns {Function} Fonction debouncée
 */
export function debounce(func, delay) {
    let timeoutId;
    
    return function debounced(...args) {
        // Annuler le timeout précédent
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        // Créer un nouveau timeout
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Export par défaut
 */
export default {
    SearchEngine,
    debounce
};
