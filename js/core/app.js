/**
 * ═══════════════════════════════════════════════════════════════════════════
 * APP.JS
 * Point d'entrée principal de l'application.
 * Orchestre l'initialisation de tous les modules.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DatabaseManager } from './database.js';
import { StatisticsManager } from './statistics-manager.js';
import { ThemeManager } from './themes.js';
import { UIManager } from '../ui/ui-manager.js';
import { LibraryManager } from '../library/library-manager.js';
import { EventManager } from '../events/event-manager.js';
import { SettingsManager } from '../ui/settings-manager.js';
import { StatsUI } from '../ui/stats-ui.js';
import Logger from '../utils/logger.js';

// Instance du composant de statistiques (singleton côté UI)
const statsUI = new StatsUI({});

const logger = new Logger('App');

/**
 * Application principale
 * Gère le cycle de vie de l'application
 */
const App = {
    /**
     * Initialise l'application
     * Charge tous les modules dans l'ordre approprié
     */
    async init() {
        try {
            logger.info('Starting EPUB Reader...');
            
            // 1. Initialiser l'interface utilisateur (cache DOM)
            UIManager.init();
            
            // 2. Initialiser le gestionnaire de thèmes
            ThemeManager.init();
            
            // 3. Initialiser le gestionnaire de paramètres
            SettingsManager.init();
            
            // 4. Initialiser la base de données
            await DatabaseManager.init();

            // 5. Initialiser le gestionnaire de statistiques
            await StatisticsManager.init();
            
            // 6. Initialiser le gestionnaire d'événements
            EventManager.init();

            // 7. Initialiser l'UI des statistiques (modal)
            statsUI.init();
            
            // 8. Charger la bibliothèque
            await LibraryManager.load();
            
            // 9. Enregistrer le Service Worker (PWA)
            await this.registerServiceWorker();
            
            // 10. Afficher le message de bienvenue
            UIManager.showStatus('📚 Bibliothèque prête');
            logger.info('EPUB Reader initialized successfully');
            
        } catch (error) {
            logger.error('Application initialization failed', error);
            UIManager.showStatus('Erreur d\'initialisation');
        }
    },
    
    /**
     * Enregistre le Service Worker pour le fonctionnement PWA
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js', {
                    scope: './'
                });
                
                logger.info('Service Worker registered:', registration.scope);
                
                // Écouter les mises à jour
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nouvelle version disponible
                            UIManager.showStatus('🔄 Mise à jour disponible - Rechargez la page');
                        }
                    });
                    });
                
            } catch (error) {
                logger.warn('Service Worker registration failed', error);
            }
        }
    }
};

/**
 * Démarrage de l'application
 * Attend que le DOM soit prêt
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Exporter pour accès global si nécessaire
export { App };
