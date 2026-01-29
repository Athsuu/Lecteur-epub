/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THEMES.JS
 * Gestionnaire des thèmes visuels (light, dark, sepia, auto).
 * Gère l'application des thèmes au DOM, le mode Auto (système) et la persistance.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Config, StorageKeys } from './config.js';
import { StateManager } from './state.js';
import Logger from '../utils/logger.js';

const logger = new Logger('ThemeManager');

/**
 * Migre l'ancien système de thème (isDarkMode boolean)
 * vers le nouveau système (currentTheme string)
 * @private
 */
function migrateOldTheme() {
    const oldTheme = localStorage.getItem(StorageKeys.LEGACY_DARK_MODE);
    if (oldTheme !== null) {
        const newTheme = oldTheme === 'true' ? 'dark' : 'light';
        localStorage.setItem(StorageKeys.THEME, newTheme);
        localStorage.removeItem(StorageKeys.LEGACY_DARK_MODE);
        StateManager.set('theme', newTheme);
        logger.info(`Migrated theme from isDarkMode to: ${newTheme}`);
    }
}

/**
 * Détermine le thème système via matchMedia
 * @returns {string} 'dark' ou 'light'
 * @private
 */
function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Applique la classe CSS du thème au body et à html
 * @param {string} theme - Nom du thème ('light', 'dark', 'sepia')
 * @private
 */
function applyThemeClass(theme) {
    // Appliquer sur <html> ET <body> pour compatibilité
    const targets = [document.documentElement, document.body];
    
    targets.forEach(target => {
        if (!target) return;
        
        // Retirer toutes les classes de thème
        target.classList.remove('dark-theme', 'sepia-theme');
        
        // Appliquer la nouvelle classe si nécessaire
        const themeClass = Config.THEME_CLASSES[theme];
        if (themeClass) {
            target.classList.add(themeClass);
        }
    });
    
    // Mettre à jour la variable CSS --reading-bg
    updateReadingBackground(theme);
}

/**
 * Met à jour la variable CSS --reading-bg avec la couleur de fond de lecture
 * Cette couleur est utilisée pour le fond du viewer (pour éviter les marges visibles)
 * @param {string} theme - Nom du thème
 * @private
 */
function updateReadingBackground(theme) {
    const colors = Config.READING_COLORS[theme];
    if (colors) {
        document.documentElement.style.setProperty('--reading-bg', colors.bg);
    }
}

/**
 * Met à jour les icônes des boutons de thème
 * @param {string} theme - Thème actuel
 * @private
 */
function updateThemeIcons(theme) {
    const icon = Config.THEME_ICONS[theme];
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
        btn.textContent = icon;
        btn.setAttribute('title', `Thème: ${theme}`);
    });
}

/**
 * Updates sidebar icons when theme changes.
 * NOTE: This function is now a no-op since icons are rendered via CSS variables
 * (--icon-library, --icon-favorites, --icon-stats, --icon-settings) which automatically
 * respond to theme changes without requiring manual DOM manipulation.
 * @param {string} theme - Current theme
 * @private
 */
function updateSidebarIcons(theme) {
    // CSS variables handle icon updates automatically - no DOM manipulation needed
}

/**
 * ThemeManager - Gestionnaire des thèmes visuels
 */
export const ThemeManager = {
    /**
     * Préférence stockée de l'utilisateur ('light', 'dark', 'sepia', 'auto')
     * @private
     */
    _storedPreference: null,
    
    /**
     * Thème effectivement appliqué ('light', 'dark', 'sepia')
     * @private
     */
    _appliedTheme: null,
    
    /**
     * Listener pour les changements de thème système
     * @private
     */
    _systemThemeListener: null,
    
    /**
     * MediaQueryList pour detecter le thème système
     * @private
     */
    _darkModeQuery: null,
    
    /**
     * Initialise le gestionnaire de thèmes
     * Applique le thème sauvegardé et configure les observateurs
     */
    init() {
        // Migration depuis l'ancien système
        migrateOldTheme();
        
        // Récupérer la préférence stockée (défaut: 'auto')
        this._storedPreference = localStorage.getItem(StorageKeys.THEME) || 'auto';
        
        // Résoudre et appliquer le thème
        this._appliedTheme = this._resolveTheme(this._storedPreference);
        applyThemeClass(this._appliedTheme);
        updateThemeIcons(this._appliedTheme);
        updateSidebarIcons(this._appliedTheme);
        
        // Synchroniser le StateManager avec le thème appliqué (pour compatibilité)
        StateManager.set('theme', this._appliedTheme);
        
        // Configurer le listener pour le thème système
        this._setupSystemThemeListener();
        
        // Observer les changements de thème (pour updates UI externes)
        StateManager.subscribe('theme', (newTheme) => {
            if (newTheme !== this._appliedTheme) {
                this._appliedTheme = newTheme;
                applyThemeClass(newTheme);
                updateThemeIcons(newTheme);
                updateSidebarIcons(newTheme);
            }
        });
        
        logger.info(`Theme initialized: ${this._storedPreference} (applied: ${this._appliedTheme})`);
    },
    
    /**
     * Résout le thème à appliquer en fonction de la préférence
     * @param {string} preference - Préférence utilisateur ('auto', 'light', 'dark', 'sepia')
     * @returns {string} Thème à appliquer ('light', 'dark', 'sepia')
     * @private
     */
    _resolveTheme(preference) {
        if (preference === 'auto') {
            return getSystemTheme();
        }
        return preference;
    },
    
    /**
     * Configure le listener pour détecter les changements de thème système
     * @private
     */
    _setupSystemThemeListener() {
        if (!window.matchMedia) return;
        
        // Créer la query
        this._darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Définir le listener
        this._systemThemeListener = (event) => {
            // Ne réagir QUE si le mode Auto est actif
            if (this._storedPreference !== 'auto') {
                return;
            }
            
            const newSystemTheme = event.matches ? 'dark' : 'light';
            logger.info(`System theme changed to: ${newSystemTheme}`);
            
            // Appliquer le nouveau thème
            this._appliedTheme = newSystemTheme;
            applyThemeClass(this._appliedTheme);
            updateThemeIcons(this._appliedTheme);
            updateSidebarIcons(this._appliedTheme);
            StateManager.set('theme', this._appliedTheme);
        };
        
        // Attacher le listener (méthode moderne + fallback)
        if (this._darkModeQuery.addEventListener) {
            this._darkModeQuery.addEventListener('change', this._systemThemeListener);
        } else {
            // Fallback pour anciens navigateurs
            this._darkModeQuery.addListener(this._systemThemeListener);
        }
    },
    
    /**
     * Bascule vers le thème suivant dans le cycle
     * light → dark → sepia → auto → light
     */
    toggle() {
        const cycle = ['light', 'dark', 'sepia', 'auto'];
        const currentIndex = cycle.indexOf(this._storedPreference);
        const nextIndex = (currentIndex + 1) % cycle.length;
        const newPreference = cycle[nextIndex];
        
        this.set(newPreference);
        logger.info(`Theme toggled to: ${newPreference}`);
        return newPreference;
    },
    
    /**
     * Définit un thème spécifique ou active le mode Auto
     * @param {string} preference - Préférence à appliquer ('light', 'dark', 'sepia', 'auto')
     */
    set(preference) {
        const validPreferences = ['light', 'dark', 'sepia', 'auto'];
        if (!validPreferences.includes(preference)) {
            logger.warn(`Unknown theme preference: ${preference}`);
            return;
        }
        
        // Sauvegarder la préférence
        this._storedPreference = preference;
        localStorage.setItem(StorageKeys.THEME, preference);
        
        // Résoudre et appliquer le thème
        this._appliedTheme = this._resolveTheme(preference);
        applyThemeClass(this._appliedTheme);
        updateThemeIcons(this._appliedTheme);
        updateSidebarIcons(this._appliedTheme);
        StateManager.set('theme', this._appliedTheme);
    },
    
    /**
     * Alias pour set() - compatibilité
     * @param {string} theme - Nom du thème à appliquer
     */
    setTheme(theme) {
        this.set(theme);
    },
    
    /**
     * Récupère le thème actuellement appliqué (résolu)
     * @returns {string} Nom du thème actuel ('light', 'dark', 'sepia')
     */
    getCurrent() {
        return this._appliedTheme || StateManager.get('theme');
    },
    
    /**
     * Récupère la préférence stockée (peut être 'auto')
     * @returns {string} Préférence utilisateur ('light', 'dark', 'sepia', 'auto')
     */
    getPreference() {
        return this._storedPreference;
    },
    
    /**
     * Vérifie si le mode Auto est actif
     * @returns {boolean} true si mode Auto, false sinon
     */
    isAutoMode() {
        return this._storedPreference === 'auto';
    },
    
    /**
     * Récupère les couleurs de lecture pour le thème actuel
     * Ces couleurs sont utilisées pour styliser le contenu de l'iframe epub.js
     * @returns {Object} Palette de couleurs
     */
    getReadingColors() {
        return Config.READING_COLORS[this.getCurrent()];
    },
    
    /**
     * Récupère la liste des thèmes disponibles (incluant 'auto')
     * @returns {Array<string>} Liste des noms de thèmes
     */
    getAvailableThemes() {
        return ['light', 'dark', 'sepia', 'auto'];
    }
};
