/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STATISTICS-MANAGER.JS
 * Gestionnaire des statistiques de lecture.
 * Suit le temps de lecture, gère les sessions, et persiste les données.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DatabaseManager } from './database.js';
import { EventBus, Events } from '../events/event-bus.js';

/**
 * Configuration des constantes
 */
const IDLE_TIMEOUT = 60000; // 60 secondes sans activité = pause
const AUTOSAVE_INTERVAL = 30000; // Sauvegarde toutes les 30 secondes

/**
 * État du gestionnaire de statistiques
 * @private
 */
let currentBookId = null;
let sessionStartTime = null;
let lastActivityTime = null;
let currentSessionSeconds = 0;
let isPaused = false;
let idleTimer = null;
let saveTimer = null;
let chapterSet = new Set();

/**
 * StatisticsManager - Gestionnaire des statistiques de lecture
 * Singleton qui suit le temps de lecture et persiste les données
 */
export const StatisticsManager = {
    /**
     * Initialise le gestionnaire de statistiques
     * Configure les listeners d'événements
     */
    init() {
        console.log('📊 StatisticsManager initialized');
        
        // Écouter l'ouverture/fermeture de livres
        EventBus.on(Events.READER_OPENED, (data) => this.startSession(data?.bookId ?? data?.id));
        EventBus.on(Events.READER_CLOSED, () => this.endSession());

        // Écouter les changements de chapitre
        EventBus.on(Events.CHAPTER_CHANGED, (data) => this._onChapterChanged(data));
        
        // Écouter les événements de visibilité de la page
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseSession();
            } else {
                this.resumeSession();
            }
        });
        
        // Détecter l'activité utilisateur pour réinitialiser le timer d'inactivité
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(eventType => {
            document.addEventListener(eventType, () => this._onUserActivity(), { passive: true });
        });
    },
    
    /**
     * Démarre une session de lecture pour un livre
     * @param {number} bookId - ID du livre
     */
    async startSession(bookId) {
        try {
            // Terminer la session précédente si elle existe
            if (currentBookId) {
                await this.endSession();
            }
            
            currentBookId = bookId;
            sessionStartTime = Date.now();
            lastActivityTime = Date.now();
            currentSessionSeconds = 0;
            isPaused = false;
            // Précharger les chapitres déjà lus pour éviter le double comptage
            try {
                const existingStats = await DatabaseManager.getStatistics(bookId);
                chapterSet = new Set(existingStats?.chaptersRead || []);
            } catch (e) {
                chapterSet = new Set();
            }
            
            // Démarrer le timer d'inactivité
            this._startIdleTimer();
            
            // Démarrer l'auto-sauvegarde
            this._startAutosave();
            
            console.log(`📖 Reading session started for book ${bookId}`);
            EventBus.emit(Events.SESSION_RESUMED, { bookId });
            
        } catch (error) {
            console.error('Failed to start reading session:', error);
        }
    },
    
    /**
     * Termine la session de lecture en cours
     */
    async endSession() {
        if (!currentBookId) return;
        
        try {
            // Calculer le temps de la session
            if (!isPaused && sessionStartTime) {
                const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
                currentSessionSeconds += sessionDuration;
            }
            
            // Sauvegarder les statistiques finales
            await this._saveStatistics();
            
            // Nettoyer les timers
            this._stopIdleTimer();
            this._stopAutosave();
            
            console.log(`📕 Reading session ended for book ${currentBookId} (${currentSessionSeconds}s)`);
            
            // Réinitialiser l'état
            currentBookId = null;
            sessionStartTime = null;
            lastActivityTime = null;
            currentSessionSeconds = 0;
            isPaused = false;
            chapterSet = new Set();
            
        } catch (error) {
            console.error('Failed to end reading session:', error);
        }
    },
    
    /**
     * Met en pause la session de lecture
     */
    pauseSession() {
        if (!currentBookId || isPaused) return;
        
        // Calculer le temps écoulé avant la pause
        if (sessionStartTime) {
            const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
            currentSessionSeconds += elapsed;
        }
        
        isPaused = true;
        sessionStartTime = null;
        
        console.log(`⏸️ Reading session paused for book ${currentBookId}`);
        EventBus.emit(Events.SESSION_PAUSED, { bookId: currentBookId });
    },
    
    /**
     * Reprend la session de lecture
     */
    resumeSession() {
        if (!currentBookId || !isPaused) return;
        
        isPaused = false;
        sessionStartTime = Date.now();
        lastActivityTime = Date.now();
        
        console.log(`▶️ Reading session resumed for book ${currentBookId}`);
        EventBus.emit(Events.SESSION_RESUMED, { bookId: currentBookId });
    },
    
    /**
     * Récupère les statistiques d'un livre
     * @param {number} bookId - ID du livre
     * @returns {Promise<Object>} Statistiques du livre
     */
    async getBookStatistics(bookId) {
        try {
            const stats = await DatabaseManager.getStatistics(bookId);
            
            if (!stats) {
                // Retourner des statistiques vides par défaut
                return {
                    bookId,
                    totalSeconds: 0,
                    sessions: [],
                    dailyActivity: {},
                    firstRead: null,
                    lastRead: null,
                    chaptersRead: [],
                    chaptersReadCount: 0
                };
            }
            
            return stats;
        } catch (error) {
            console.error(`Failed to get statistics for book ${bookId}:`, error);
            return null;
        }
    },
    
    /**
     * Récupère les statistiques globales de tous les livres
     * @returns {Promise<Object>} Statistiques globales
     */
    async getGlobalStatistics() {
        try {
            const allStats = await DatabaseManager.getAllStatistics();
            
            // Calculer les totaux
            let totalSeconds = 0;
            let totalBooks = allStats.length;
            let totalSessions = 0;
            let totalChapters = 0;
            const dailyActivity = {};
            
            allStats.forEach(stat => {
                totalSeconds += stat.totalSeconds || 0;
                totalSessions += (stat.sessions || []).length;
                totalChapters += stat.chaptersReadCount || 0;
                
                // Agréger l'activité quotidienne
                if (stat.dailyActivity) {
                    Object.entries(stat.dailyActivity).forEach(([date, seconds]) => {
                        dailyActivity[date] = (dailyActivity[date] || 0) + seconds;
                    });
                }
            });
            
            return {
                totalSeconds,
                totalBooks,
                totalSessions,
                totalChapters,
                dailyActivity,
                books: allStats
            };
            
        } catch (error) {
            console.error('Failed to get global statistics:', error);
            return null;
        }
    },
    
    /**
     * Formate une durée en secondes en format lisible
     * @param {number} seconds - Durée en secondes
     * @returns {string} Format "Xh Ymin"
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return '0min';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
        }
        
        return `${minutes}min`;
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTHODES PRIVÉES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Gère le changement de chapitre (incrémente uniquement si nouveau)
     * @param {{bookId:number, chapterId:string, chapterName:string|null}} data
     * @private
     */
    async _onChapterChanged(data) {
        try {
            const { bookId, chapterId } = data || {};
            if (!bookId || !chapterId) return;
            
            // Ignorer si ce n'est pas le livre courant
            if (currentBookId !== bookId) return;
            
            // Eviter le double comptage dans la même session
            if (chapterSet.has(chapterId)) return;
            chapterSet.add(chapterId);
            
            // Charger stats existantes
            const existingStats = await this.getBookStatistics(bookId) || {
                bookId,
                chaptersRead: [],
                chaptersReadCount: 0
            };
            
            const chaptersRead = new Set(existingStats.chaptersRead || []);
            if (chaptersRead.has(chapterId)) return; // Déjà compté précédemment
            chaptersRead.add(chapterId);
            
            const updatedStats = {
                ...existingStats,
                bookId,
                chaptersRead: Array.from(chaptersRead),
                chaptersReadCount: chaptersRead.size,
                lastRead: Date.now(),
                firstRead: existingStats.firstRead || Date.now()
            };
            
            await DatabaseManager.saveStatistics(bookId, updatedStats);
            EventBus.emit(Events.STATISTICS_UPDATED, { bookId });
        } catch (error) {
            console.error('Failed to update chapter statistics:', error);
        }
    },
    
    /**
     * Gère l'activité utilisateur
     * @private
     */
    _onUserActivity() {
        if (!currentBookId) return;
        
        lastActivityTime = Date.now();
        
        // Reprendre la session si elle était en pause
        if (isPaused) {
            this.resumeSession();
        }
        
        // Réinitialiser le timer d'inactivité
        this._startIdleTimer();
    },
    
    /**
     * Démarre le timer d'inactivité
     * @private
     */
    _startIdleTimer() {
        this._stopIdleTimer();
        
        idleTimer = setTimeout(() => {
            if (currentBookId && !isPaused) {
                console.log('⏱️ Idle timeout - pausing session');
                this.pauseSession();
            }
        }, IDLE_TIMEOUT);
    },
    
    /**
     * Arrête le timer d'inactivité
     * @private
     */
    _stopIdleTimer() {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
    },
    
    /**
     * Démarre l'auto-sauvegarde périodique
     * @private
     */
    _startAutosave() {
        this._stopAutosave();
        
        saveTimer = setInterval(() => {
            if (currentBookId && !isPaused) {
                this._saveStatistics().catch(err => {
                    console.error('Autosave failed:', err);
                });
            }
        }, AUTOSAVE_INTERVAL);
    },
    
    /**
     * Arrête l'auto-sauvegarde
     * @private
     */
    _stopAutosave() {
        if (saveTimer) {
            clearInterval(saveTimer);
            saveTimer = null;
        }
    },
    
    /**
     * Sauvegarde les statistiques actuelles
     * @private
     */
    async _saveStatistics() {
        if (!currentBookId) return;
        
        try {
            // Calculer le temps total de la session en cours
            let totalSessionTime = currentSessionSeconds;
            if (!isPaused && sessionStartTime) {
                totalSessionTime += Math.floor((Date.now() - sessionStartTime) / 1000);
            }
            
            if (totalSessionTime === 0) return; // Rien à sauvegarder
            
            // Récupérer les statistiques existantes
            const existingStats = await this.getBookStatistics(currentBookId);
            
            // Date du jour (YYYY-MM-DD)
            const today = new Date().toISOString().split('T')[0];
            
            // Créer une nouvelle session
            const newSession = {
                date: Date.now(),
                duration: totalSessionTime,
                dayString: today
            };
            
            // Mettre à jour les statistiques
            const updatedStats = {
                bookId: currentBookId,
                totalSeconds: (existingStats.totalSeconds || 0) + totalSessionTime,
                sessions: [...(existingStats.sessions || []), newSession],
                dailyActivity: {
                    ...existingStats.dailyActivity,
                    [today]: (existingStats.dailyActivity?.[today] || 0) + totalSessionTime
                },
                firstRead: existingStats.firstRead || Date.now(),
                lastRead: Date.now(),
                chaptersRead: existingStats.chaptersRead || [],
                chaptersReadCount: existingStats.chaptersReadCount || 0
            };
            
            // Sauvegarder dans la base
            await DatabaseManager.saveStatistics(currentBookId, updatedStats);
            
            // Réinitialiser le compteur de session
            currentSessionSeconds = 0;
            sessionStartTime = Date.now();
            
            // Émettre un événement de mise à jour
            EventBus.emit(Events.STATISTICS_UPDATED, { bookId: currentBookId });
            
        } catch (error) {
            console.error('Failed to save statistics:', error);
            throw error;
        }
    }
};
