/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS/GESTURE-HANDLER.JS
 * Gestionnaire des gestes tactiles (swipe, tap, etc.).
 * Optimisé pour la navigation mobile.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { EventBus } from './event-bus.js';
import Logger from '../utils/logger.js';

const logger = new Logger('GestureHandler');

export const GestureHandler = {
    lastTapTime: 0,
    tapTimer: null,
    DOUBLE_TAP_DELAY: 300, // ms

    init() {
        EventBus.on('reader:tap', (data) => this.handleTap(data));
        logger.info('GestureHandler: Listening to reader events');
    },

    handleTap(data) {
        const now = Date.now();
        const timeSinceLast = now - this.lastTapTime;

        if (timeSinceLast < this.DOUBLE_TAP_DELAY) {
            // --- DOUBLE TAP ---
            logger.debug('Double Tap detected');
            if (this.tapTimer) clearTimeout(this.tapTimer);
            this.lastTapTime = 0; // Reset
            
            EventBus.emit('ui:toggle-interface');
        } else {
            // --- POTENTIEL SIMPLE TAP ---
            this.lastTapTime = now;
            
            // Attendre pour voir si un second tap arrive
            this.tapTimer = setTimeout(() => {
                this._processSimpleTap(data);
            }, this.DOUBLE_TAP_DELAY);
        }
    },

    _processSimpleTap(data) {
        const { x, width } = data;
        const leftZone = width * 0.2;
        const rightZone = width * 0.8;

        if (x < leftZone) {
            // Zone Gauche
            logger.debug('Tap Zone: Left (Prev)');
            EventBus.emit('reader:prev');
        } else if (x > rightZone) {
            // Zone Droite
            logger.debug('Tap Zone: Right (Next)');
            EventBus.emit('reader:next');
        } else {
            // Zone Centre - comportement "Option 1" :
            // 1) si un panneau/overlay est ouvert -> on ferme tout
            // 2) sinon -> on toggle l'interface (mode immersif)
            logger.debug('Tap Zone: Center (Simple tap)');
            EventBus.emit('ui:center-tap');
        }
    }
};
