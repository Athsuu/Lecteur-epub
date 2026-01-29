/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FAVORITES-MANAGER.JS
 * Gestionnaire des livres favoris.
 * 
 * Design optimisé :
 * - Opérations DB uniquement (pas de manipulation DOM)
 * - Toggle instantané avec retour du nouveau statut
 * - Utilise favoritedAt (timestamp) pour performance IndexedDB
 * - API simple et future-proof
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DatabaseManager } from '../core/database.js';

/**
 * FavoritesManager - Gestionnaire des favoris (couche données)
 */
export const FavoritesManager = {
    
    /**
     * Bascule le statut favori d'un livre
     * Optimisé : une seule lecture + écriture DB
     * 
     * @param {number} id - ID du livre
     * @returns {Promise<{success: boolean, isFavorite: boolean}>} Résultat
     */
    async toggle(id) {
        try {
            const book = await DatabaseManager.get(id);
            if (!book) {
                console.warn(`[Favorites] Book ${id} not found`);
                return { success: false, isFavorite: false };
            }
            
            // Toggle : si favoritedAt existe (non null), retirer, sinon ajouter
            const isFavorite = book.favoritedAt !== null && book.favoritedAt !== undefined;
            
            if (isFavorite) {
                // Retirer des favoris
                book.favoritedAt = null;
            } else {
                // Ajouter aux favoris avec timestamp actuel
                book.favoritedAt = Date.now();
            }
            
            await DatabaseManager.update(id, book);
            
            const newStatus = !isFavorite;
            console.log(`${newStatus ? '⭐' : '☆'} ${book.title}`);
            
            return { success: true, isFavorite: newStatus };
            
        } catch (error) {
            console.error('[Favorites] Toggle failed:', error);
            return { success: false, isFavorite: false };
        }
    },
    
    /**
     * Récupère tous les livres favoris
     * Utilise l'index favoritedAt pour performance O(log n)
     * 
     * @returns {Promise<Array>} Liste des favoris
     */
    async getAll() {
        try {
            return await DatabaseManager.getFavorites();
        } catch (error) {
            console.error('[Favorites] GetAll failed:', error);
            return [];
        }
    },
    
    /**
     * Compte le nombre de favoris sans charger les données
     * Performance : O(1) avec index count
     * 
     * @returns {Promise<number>} Nombre de favoris
     */
    async count() {
        try {
            return await DatabaseManager.countFavorites();
        } catch (error) {
            console.error('[Favorites] Count failed:', error);
            return 0;
        }
    },
    
    /**
     * Vérifie si un livre est favori
     * 
     * @param {number} id - ID du livre
     * @returns {Promise<boolean>} True si favori
     */
    async isFavorite(id) {
        try {
            const book = await DatabaseManager.get(id);
            return book?.favoritedAt !== null && book?.favoritedAt !== undefined;
        } catch (error) {
            return false;
        }
    }
};
