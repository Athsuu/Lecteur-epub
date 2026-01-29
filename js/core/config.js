/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIG.JS
 * Configuration globale de l'application.
 * Centralise toutes les constantes et options paramétrables.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Configuration principale de l'application
 * Objet figé pour éviter les modifications accidentelles
 */
export const Config = Object.freeze({
    // ═══════════════════════════════════════════════════════════════════════
    // BASE DE DONNÉES
    // ═══════════════════════════════════════════════════════════════════════
    DB_NAME: 'EpubLibrary',
    DB_VERSION: 4, // V4: Ajout du store 'statistics' pour les statistiques de lecture
    STORE_NAME: 'books',
    STATS_STORE_NAME: 'statistics',
    
    // ═══════════════════════════════════════════════════════════════════════
    // THÈMES
    // ═══════════════════════════════════════════════════════════════════════
    THEMES: ['light', 'dark', 'sepia'],
    THEME_ICONS: { 
        light: '☀️', 
        dark: '🌙', 
        sepia: '📜' 
    },
    THEME_CLASSES: { 
        light: '', 
        dark: 'dark-theme', 
        sepia: 'sepia-theme' 
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // COULEURS DE LECTURE (pour l'iframe epub.js)
    // Chaque thème a sa palette propre pour le contenu du livre
    // ═══════════════════════════════════════════════════════════════════════
    READING_COLORS: {
        light: { 
            bg: '#ffffff', 
            text: '#1a1a2e', 
            heading: '#000000', 
            link: '#007AFF', 
            border: 'rgba(0, 0, 0, 0.1)', 
            btnBg: 'rgba(0, 0, 0, 0.06)', 
            btnHover: 'rgba(0, 0, 0, 0.1)', 
            shadow: '0.08', 
            shadowHover: '0.12' 
        },
        dark: { 
            bg: '#0d1117', 
            text: '#f0f6fc', 
            heading: '#ffffff', 
            link: '#58a6ff', 
            border: 'rgba(255, 255, 255, 0.1)', 
            btnBg: 'rgba(255, 255, 255, 0.1)', 
            btnHover: 'rgba(255, 255, 255, 0.18)', 
            shadow: '0.3', 
            shadowHover: '0.4' 
        },
        sepia: { 
            bg: '#f5f0e1', 
            text: '#5c4b37', 
            heading: '#3d2e1f', 
            link: '#b8860b', 
            border: 'rgba(92, 75, 55, 0.15)', 
            btnBg: 'rgba(92, 75, 55, 0.08)', 
            btnHover: 'rgba(92, 75, 55, 0.15)', 
            shadow: '0.1', 
            shadowHover: '0.18' 
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // OPTIONS DE POLICE
    // ═══════════════════════════════════════════════════════════════════════
    FONT: {
        MIN: 50,      // Taille minimum (%)
        MAX: 200,     // Taille maximum (%)
        DEFAULT: 100, // Taille par défaut (%)
        STEP: 10      // Incrément par clic
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // LECTEUR EPUB
    // Mode de rendu : 'scrolled' (défilement) ou 'paginated' (pagination)
    // ═══════════════════════════════════════════════════════════════════════
    READER_FLOW: 'scrolled',
    READER_FLOW_DEFAULT: 'scrolled',  // Mode par défaut
    
    // Zone de navigation en mode pagination (pourcentage des bords)
    PAGINATION_NAV_ZONE: 0.15,  // 15% des bords gauche/droite
    
    // Largeur minimale pour le mode double page (spread)
    SPREAD_MIN_WIDTH: 1200,
    
    // ═══════════════════════════════════════════════════════════════════════
    // INTERFACE
    // ═══════════════════════════════════════════════════════════════════════
    STATUS_DURATION: 2500,  // Durée d'affichage des messages (ms)
    ANIMATION_DURATION: 300 // Durée des animations (ms)
});

/**
 * Clés de stockage localStorage
 */
export const StorageKeys = Object.freeze({
    THEME: 'currentTheme',
    FONT_SIZE: 'fontSize',
    READER_FLOW: 'readerFlow',
    LEGACY_DARK_MODE: 'isDarkMode' // Pour la migration
});
