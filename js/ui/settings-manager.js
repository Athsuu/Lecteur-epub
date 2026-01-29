/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SETTINGS-MANAGER.JS
 * Gestionnaire des paramètres de l'application.
 * Architecture modulable et extensible pour ajouter facilement de nouvelles options.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { StateManager } from '../core/state.js';
import { StorageKeys } from '../core/config.js';
import { ThemeManager } from '../core/themes.js';
import Logger from '../utils/logger.js';

const logger = new Logger('SettingsManager');

/**
 * Registre des sections de paramètres
 * Chaque section contient un titre et une liste de paramètres
 * @private
 */
const settingsSections = [];

/**
 * Types de contrôles disponibles pour les paramètres
 */
export const SettingType = {
    TOGGLE: 'toggle',      // On/Off switch
    SELECT: 'select',      // Liste déroulante
    SLIDER: 'slider',      // Curseur avec valeur
    BUTTON: 'button',      // Bouton d'action
    COLOR: 'color',        // Sélecteur de couleur
    TEXT: 'text'           // Champ texte
};

/**
 * SettingsManager - Gestionnaire des paramètres
 * Permet d'enregistrer des sections et paramètres de manière modulaire
 */
export const SettingsManager = {
    /**
     * Élément modal des paramètres
     * @private
     */
    modal: null,

    /**
     * Initialise le gestionnaire de paramètres
     */
    init() {
        this.createModal();
        this.registerDefaultSettings();
        this.bindEvents();
        logger.info('SettingsManager initialized');
    },

    /**
     * Enregistre une nouvelle section de paramètres
     * @param {Object} section - Configuration de la section
     * @param {string} section.id - Identifiant unique de la section
     * @param {string} section.title - Titre affiché de la section
     * @param {string} section.icon - Icône de la section (emoji ou URL)
     * @param {number} [section.order=100] - Ordre d'affichage (plus petit = premier)
     * @param {Array} section.settings - Liste des paramètres de la section
     */
    registerSection(section) {
        const existingIndex = settingsSections.findIndex(s => s.id === section.id);
        if (existingIndex >= 0) {
            // Mettre à jour la section existante
            settingsSections[existingIndex] = { ...settingsSections[existingIndex], ...section };
        } else {
            // Ajouter la nouvelle section
            settingsSections.push({
                order: 100,
                ...section
            });
        }
        // Trier par ordre
        settingsSections.sort((a, b) => a.order - b.order);
    },

    /**
     * Enregistre un nouveau paramètre dans une section existante
     * @param {string} sectionId - ID de la section
     * @param {Object} setting - Configuration du paramètre
     */
    registerSetting(sectionId, setting) {
        const section = settingsSections.find(s => s.id === sectionId);
        if (section) {
            section.settings = section.settings || [];
            section.settings.push(setting);
        } else {
            logger.warn(`Section "${sectionId}" not found. Create it first with registerSection()`);
        }
    },

    /**
     * Enregistre les paramètres par défaut de l'application
     * @private
     */
    registerDefaultSettings() {
        // Section Apparence
        this.registerSection({
            id: 'appearance',
            title: 'Apparence',
            icon: '🎨',
            order: 1,
            settings: [
                {
                    id: 'theme',
                    label: 'Thème',
                    type: SettingType.SELECT,
                    options: [
                        { value: 'auto', label: 'Auto (🌙/☀️ Système)' },
                        { value: 'light', label: 'Clair ☀️' },
                        { value: 'dark', label: 'Sombre 🌙' },
                        { value: 'sepia', label: 'Sépia 📜' }
                    ],
                    getValue: () => {
                        // Retourner la préférence stockée (peut être 'auto')
                        return ThemeManager.getPreference ? ThemeManager.getPreference() : StateManager.get('theme');
                    },
                    setValue: (value) => ThemeManager.setTheme(value),
                    // Afficher le thème effectif si mode Auto
                    getDescription: () => {
                        if (ThemeManager.isAutoMode && ThemeManager.isAutoMode()) {
                            const current = ThemeManager.getCurrent();
                            const icons = { light: '☀️', dark: '🌙', sepia: '📜' };
                            return `Actif: ${icons[current] || ''} ${current}`;
                        }
                        return '';
                    }
                },
                {
                    id: 'fontSize',
                    label: 'Taille du texte',
                    type: SettingType.SLIDER,
                    min: 80,
                    max: 150,
                    step: 10,
                    unit: '%',
                    getValue: () => StateManager.get('fontSize'),
                    setValue: (value) => {
                        StateManager.set('fontSize', parseInt(value));
                        localStorage.setItem(StorageKeys.FONT_SIZE, value);
                    }
                }
            ]
        });

        // Section Lecture
        this.registerSection({
            id: 'reading',
            title: 'Lecture',
            icon: '📖',
            order: 2,
            settings: [
                {
                    id: 'readerFlow',
                    label: 'Mode de lecture',
                    type: SettingType.SELECT,
                    options: [
                        { value: 'scrolled', label: 'Défilement 📜' },
                        { value: 'paginated', label: 'Pages 📄' }
                    ],
                    getValue: () => StateManager.get('readerFlow'),
                    setValue: (value) => {
                        StateManager.set('readerFlow', value);
                        localStorage.setItem(StorageKeys.READER_FLOW, value);
                    }
                }
            ]
        });

        // Section À propos
        this.registerSection({
            id: 'about',
            title: 'À propos',
            icon: 'ℹ️',
            order: 99,
            settings: [
                {
                    id: 'version',
                    label: 'Version',
                    type: SettingType.TEXT,
                    value: '1.0.0',
                    readonly: true
                },
                {
                    id: 'clearData',
                    label: 'Effacer les données',
                    type: SettingType.BUTTON,
                    buttonText: 'Réinitialiser',
                    buttonClass: 'btn-danger',
                    action: () => {
                        if (confirm('Voulez-vous vraiment supprimer toutes les données de l\'application ?')) {
                            localStorage.clear();
                            indexedDB.deleteDatabase('EpubLibrary');
                            location.reload();
                        }
                    }
                }
            ]
        });
    },

    /**
     * Crée le modal des paramètres
     * @private
     */
    createModal() {
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.id = 'settingsModal';
        modal.innerHTML = `
            <div class="settings-modal-content">
                <div class="settings-header">
                    <h2>Paramètres</h2>
                    <button class="settings-close" data-action="close-settings">✕</button>
                </div>
                <div class="settings-body" id="settingsBody">
                    <!-- Les sections seront injectées ici -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modal = modal;
    },

    /**
     * Génère le HTML d'une section de paramètres
     * @param {Object} section - Section à rendre
     * @returns {string} HTML de la section
     * @private
     */
    renderSection(section) {
        const settingsHtml = section.settings.map(setting => this.renderSetting(setting)).join('');
        return `
            <div class="settings-section" data-section="${section.id}">
                <h3 class="settings-section-title">
                    <span class="settings-section-icon">${section.icon}</span>
                    ${section.title}
                </h3>
                <div class="settings-section-content">
                    ${settingsHtml}
                </div>
            </div>
        `;
    },

    /**
     * Génère le HTML d'un paramètre selon son type
     * @param {Object} setting - Paramètre à rendre
     * @returns {string} HTML du paramètre
     * @private
     */
    renderSetting(setting) {
        const value = setting.getValue ? setting.getValue() : setting.value;
        const description = setting.getDescription ? setting.getDescription() : '';
        
        let controlHtml = '';
        
        switch (setting.type) {
            case SettingType.TOGGLE:
                controlHtml = `
                    <label class="setting-toggle">
                        <input type="checkbox" 
                               data-setting="${setting.id}" 
                               ${value ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                `;
                break;
                
            case SettingType.SELECT:
                const optionsHtml = setting.options.map(opt => 
                    `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                controlHtml = `
                    <select class="setting-select" data-setting="${setting.id}">
                        ${optionsHtml}
                    </select>
                `;
                break;
                
            case SettingType.SLIDER:
                controlHtml = `
                    <div class="setting-slider-container">
                        <input type="range" 
                               class="setting-slider" 
                               data-setting="${setting.id}"
                               min="${setting.min}" 
                               max="${setting.max}" 
                               step="${setting.step || 1}"
                               value="${value}">
                        <span class="setting-slider-value">${value}${setting.unit || ''}</span>
                    </div>
                `;
                break;
                
            case SettingType.BUTTON:
                controlHtml = `
                    <button class="btn ${setting.buttonClass || 'btn-secondary'}" 
                            data-setting="${setting.id}"
                            data-action="setting-button">
                        ${setting.buttonText}
                    </button>
                `;
                break;
                
            case SettingType.TEXT:
                if (setting.readonly) {
                    controlHtml = `<span class="setting-value">${value}</span>`;
                } else {
                    controlHtml = `
                        <input type="text" 
                               class="setting-input" 
                               data-setting="${setting.id}"
                               value="${value}">
                    `;
                }
                break;
                
            case SettingType.COLOR:
                controlHtml = `
                    <input type="color" 
                           class="setting-color" 
                           data-setting="${setting.id}"
                           value="${value}">
                `;
                break;
        }
        
        return `
            <div class="setting-item" data-setting-id="${setting.id}">
                <div class="setting-label">
                    ${setting.label}
                    ${description ? `<div class="setting-description">${description}</div>` : ''}
                </div>
                <div class="setting-control">
                    ${controlHtml}
                </div>
            </div>
        `;
    },

    /**
     * Met à jour le contenu du modal avec les sections enregistrées
     * @private
     */
    updateContent() {
        const body = document.getElementById('settingsBody');
        if (body) {
            body.innerHTML = settingsSections.map(section => this.renderSection(section)).join('');
        }
    },

    /**
     * Lie les événements du modal
     * @private
     */
    bindEvents() {
        // Fermer le modal
        document.addEventListener('click', (e) => {
            // Clic sur le bouton fermer
            if (e.target.closest('[data-action="close-settings"]')) {
                this.close();
            }
            
            // Clic sur le fond du modal
            if (e.target.classList.contains('settings-modal')) {
                this.close();
            }
            
            // Clic sur le bouton paramètres
            if (e.target.closest('[data-action="open-settings"]')) {
                this.open();
            }
        });

        // Changement de valeur des paramètres
        document.addEventListener('change', (e) => {
            const settingId = e.target.dataset.setting;
            if (!settingId) return;

            const setting = this.findSetting(settingId);
            if (setting && setting.setValue) {
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                setting.setValue(value);
            }
        });

        // Mise à jour en temps réel des sliders
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('setting-slider')) {
                const settingId = e.target.dataset.setting;
                const setting = this.findSetting(settingId);
                const valueSpan = e.target.parentElement.querySelector('.setting-slider-value');
                
                if (valueSpan && setting) {
                    valueSpan.textContent = `${e.target.value}${setting.unit || ''}`;
                }
                
                if (setting && setting.setValue) {
                    setting.setValue(e.target.value);
                }
            }
        });

        // Boutons d'action
        document.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'setting-button') {
                const settingId = e.target.dataset.setting;
                const setting = this.findSetting(settingId);
                if (setting && setting.action) {
                    setting.action();
                }
            }
        });
    },

    /**
     * Trouve un paramètre par son ID
     * @param {string} settingId - ID du paramètre
     * @returns {Object|null} Paramètre trouvé ou null
     * @private
     */
    findSetting(settingId) {
        for (const section of settingsSections) {
            const setting = section.settings.find(s => s.id === settingId);
            if (setting) return setting;
        }
        return null;
    },

    /**
     * Ouvre le modal des paramètres
     */
    open() {
        this.updateContent();
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Ferme le modal des paramètres
     */
    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    /**
     * Bascule l'état du modal
     */
    toggle() {
        if (this.modal.classList.contains('active')) {
            this.close();
        } else {
            this.open();
        }
    }
};
