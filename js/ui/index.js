/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UI/INDEX.JS
 * Point d'entrée pour les modules UI
 * ═══════════════════════════════════════════════════════════════════════════
 */

export { BaseUI } from './base-ui.js';
export { MobileUI } from './mobile-ui.js';
export { DesktopUI } from './desktop-ui.js';
export { default as UIFactory, isMobile, isDesktop, getMode, createUI, getUI, refreshUI, destroy } from './ui-factory.js';
