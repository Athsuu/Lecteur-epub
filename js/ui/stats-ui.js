/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STATS-UI.JS
 * Composant d'interface pour l'affichage des statistiques de lecture.
 * Utilise Chart.js pour la visualisation (chargement lazy).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BaseUI } from './base-ui.js';
import { StatisticsManager } from '../core/statistics-manager.js';
import { DatabaseManager } from '../core/database.js';
import { EventBus, Events } from '../events/event-bus.js';
import Logger from '../utils/logger.js';

const logger = new Logger('StatsUI');

/**
 * URL du CDN Chart.js
 */
const CHARTJS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

/**
 * Flag pour savoir si Chart.js est chargé
 * @private
 */
let isChartJsLoaded = false;
let chartJsLoadPromise = null;

/**
 * Instance du graphique actuel
 * @private
 */
let currentChart = null;

/**
 * StatsUI - Composant d'affichage des statistiques
 * Étend BaseUI pour bénéficier des méthodes communes
 */
export class StatsUI extends BaseUI {
    constructor(elements) {
        super(elements);
        this.name = 'StatsUI';
        this.modalElement = null;
    }

    /**
     * Initialise le composant
     */
    init() {
        logger.info('StatsUI initialized');
        
        // Écouter l'événement d'ouverture des stats
        EventBus.on(Events.STATS_OPEN_REQUEST, () => this.open());
    }

    /**
     * Ouvre le modal des statistiques
     */
    async open() {
        try {
            // Créer le modal
            this._createModal();
            
            // Charger et afficher les statistiques
            await this._loadAndDisplay();
            
            EventBus.emit(Events.UI_MODAL_OPENED, { type: 'statistics' });
            
        } catch (error) {
            logger.error('Failed to open statistics', error);
            this._showError('Erreur lors du chargement des statistiques.');
        }
    }

    /**
     * Ferme le modal des statistiques
     */
    close() {
        if (this.modalElement) {
            // Détruire le graphique
            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }
            
            this.modalElement.remove();
            this.modalElement = null;
            
            EventBus.emit(Events.UI_MODAL_CLOSED, { type: 'statistics' });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MÉTHODES PRIVÉES
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Crée le modal des statistiques
     * @private
     */
    _createModal() {
        // Supprimer le modal existant si présent
        if (this.modalElement) {
            this.close();
        }

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'stats-modal';
        this.modalElement.innerHTML = `
            <div class="stats-modal-overlay"></div>
            <div class="stats-modal-content">
                <header class="stats-modal-header">
                    <h2>📊 Statistiques de lecture</h2>
                    <button class="stats-modal-close" title="Fermer">✕</button>
                </header>
                <div class="stats-modal-body">
                    <div class="stats-loading">
                        <div class="loader"></div>
                        <p>Chargement des statistiques...</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);

        // Gérer la fermeture
        this.modalElement.querySelector('.stats-modal-close').addEventListener('click', () => this.close());
        this.modalElement.querySelector('.stats-modal-overlay').addEventListener('click', () => this.close());
    }

    /**
     * Charge et affiche les statistiques
     * @private
     */
    async _loadAndDisplay() {
        try {
            const bodyElement = this.modalElement.querySelector('.stats-modal-body');
            
            // Charger les statistiques globales
            const globalStats = await StatisticsManager.getGlobalStatistics();
            
            if (!globalStats || globalStats.totalSeconds === 0) {
                bodyElement.innerHTML = `
                    <div class="stats-empty">
                        <p>📚 Aucune statistique disponible pour le moment.</p>
                        <p>Commencez à lire pour voir vos statistiques !</p>
                    </div>
                `;
                return;
            }
            
            // Tenter de charger Chart.js
            const chartLoaded = await this._loadChartLib();
            
            // Construire le contenu
            let contentHTML = this._buildStatsHTML(globalStats);
            
            if (chartLoaded && Object.keys(globalStats.dailyActivity).length > 0) {
                contentHTML += `
                    <div class="stats-chart-container">
                        <h3>Activité quotidienne (derniers 30 jours)</h3>
                        <canvas id="stats-chart"></canvas>
                    </div>
                `;
            } else if (!chartLoaded) {
                contentHTML += `
                    <div class="stats-error">
                        ⚠️ Impossible de charger les graphiques (vérifiez votre connexion internet).
                    </div>
                `;
            }
            
            bodyElement.innerHTML = contentHTML;
            
            // Créer le graphique si Chart.js est chargé
            if (chartLoaded && Object.keys(globalStats.dailyActivity).length > 0) {
                await this._createChart(globalStats.dailyActivity);
            }
            
        } catch (error) {
            logger.error('Failed to load statistics', error);
            this._showError('Erreur lors du chargement des statistiques.');
        }
    }

    /**
     * Construit le HTML des statistiques
     * @param {Object} stats - Statistiques globales
     * @returns {string} HTML
     * @private
     */
    _buildStatsHTML(stats) {
        const totalTime = StatisticsManager.formatDuration(stats.totalSeconds);
        const avgPerBook = stats.totalBooks > 0 
            ? StatisticsManager.formatDuration(Math.floor(stats.totalSeconds / stats.totalBooks))
            : '0min';
        const totalChapters = stats.totalChapters || 0;
        
        return `
            <div class="stats-summary">
                <div class="stats-card">
                    <div class="stats-card-icon">📖</div>
                    <div class="stats-card-content">
                        <div class="stats-card-value">${stats.totalBooks}</div>
                        <div class="stats-card-label">Livre${stats.totalBooks > 1 ? 's' : ''} lu${stats.totalBooks > 1 ? 's' : ''}</div>
                    </div>
                </div>
                
                <div class="stats-card">
                    <div class="stats-card-icon">⏱️</div>
                    <div class="stats-card-content">
                        <div class="stats-card-value">${totalTime}</div>
                        <div class="stats-card-label">Temps total</div>
                    </div>
                </div>
                
                <div class="stats-card">
                    <div class="stats-card-icon">📚</div>
                    <div class="stats-card-content">
                        <div class="stats-card-value">${avgPerBook}</div>
                        <div class="stats-card-label">Moyenne par livre</div>
                    </div>
                </div>
                
                <div class="stats-card">
                    <div class="stats-card-icon">🔖</div>
                    <div class="stats-card-content">
                        <div class="stats-card-value">${stats.totalSessions}</div>
                        <div class="stats-card-label">Session${stats.totalSessions > 1 ? 's' : ''}</div>
                    </div>
                </div>

                <div class="stats-card">
                    <div class="stats-card-icon">📑</div>
                    <div class="stats-card-content">
                        <div class="stats-card-value">${totalChapters}</div>
                        <div class="stats-card-label">Chapitre${totalChapters > 1 ? 's' : ''} lus</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Charge la bibliothèque Chart.js depuis le CDN
     * @returns {Promise<boolean>} true si chargé avec succès
     * @private
     */
    async _loadChartLib() {
        // Déjà chargé
        if (isChartJsLoaded && window.Chart) {
            return true;
        }
        
        // Chargement en cours
        if (chartJsLoadPromise) {
            return chartJsLoadPromise;
        }
        
        chartJsLoadPromise = new Promise((resolve) => {
            try {
                const script = document.createElement('script');
                script.src = CHARTJS_CDN;
                script.async = true;
                
                script.onload = () => {
                    isChartJsLoaded = true;
                    logger.info('Chart.js loaded successfully');
                    resolve(true);
                };
                
                script.onerror = () => {
                    logger.error('Failed to load Chart.js from CDN');
                    resolve(false);
                };
                
                document.head.appendChild(script);
                
            } catch (error) {
                logger.error('Failed to load Chart.js', error);
                resolve(false);
            }
        });
        
        return chartJsLoadPromise;
    }

    /**
     * Crée le graphique d'activité quotidienne
     * @param {Object} dailyActivity - Données d'activité { 'YYYY-MM-DD': seconds }
     * @private
     */
    async _createChart(dailyActivity) {
        if (!window.Chart) {
            logger.warn('Chart.js not available');
            return;
        }
        
        try {
            const canvas = document.getElementById('stats-chart');
            if (!canvas) return;
            
            // Préparer les données des 30 derniers jours
            const days = [];
            const values = [];
            const today = new Date();
            
            for (let i = 29; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0];
                
                // Formatter la date pour l'affichage (JJ/MM)
                const displayDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                days.push(displayDate);
                values.push(Math.floor((dailyActivity[dateString] || 0) / 60)); // Convertir en minutes
            }
            
            // Obtenir les couleurs du thème CSS
            const styles = getComputedStyle(document.documentElement);
            const textColor = styles.getPropertyValue('--text').trim() || '#1a1a2e';
            const accentColor = styles.getPropertyValue('--accent-color').trim() || '#007AFF';
            
            // Détruire le graphique existant
            if (currentChart) {
                currentChart.destroy();
            }
            
            // Créer le graphique
            currentChart = new window.Chart(canvas, {
                type: 'bar',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Minutes de lecture',
                        data: values,
                        backgroundColor: accentColor + '80', // 50% transparence
                        borderColor: accentColor,
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const minutes = context.parsed.y;
                                    if (minutes < 60) {
                                        return `${minutes} min`;
                                    }
                                    const hours = Math.floor(minutes / 60);
                                    const mins = minutes % 60;
                                    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: textColor,
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: textColor + '20' // 12% transparence
                            },
                            ticks: {
                                color: textColor,
                                callback: (value) => `${value} min`
                            }
                        }
                    }
                }
            });
            
        } catch (error) {
            logger.error('Failed to create chart', error);
        }
    }

    /**
     * Affiche un message d'erreur
     * @param {string} message - Message d'erreur
     * @private
     */
    _showError(message) {
        if (!this.modalElement) return;
        
        const bodyElement = this.modalElement.querySelector('.stats-modal-body');
        bodyElement.innerHTML = `
            <div class="stats-error">
                <p>⚠️ ${message}</p>
            </div>
        `;
    }
}
