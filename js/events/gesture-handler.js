/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS/GESTURE-HANDLER.JS
 * Gestionnaire des gestes tactiles (swipe, tap, etc.).
 * Optimisé pour la navigation mobile.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { EventBus } from './event-bus.js';

export const GestureHandler = {
    lastTapTime: 0,
    tapTimer: null,
    DOUBLE_TAP_DELAY: 300, // ms

    init() {
        EventBus.on('reader:tap', (data) => this.handleTap(data));
        console.log('GestureHandler: Listening to reader events');
    },

    handleTap(data) {
        const now = Date.now();
        const timeSinceLast = now - this.lastTapTime;

        if (timeSinceLast < this.DOUBLE_TAP_DELAY) {
            // --- DOUBLE TAP ---
            console.log('👆👆 Double Tap detected!');
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
            console.log('👈 Tap Zone: Left (Prev)');
            EventBus.emit('reader:prev');
        } else if (x > rightZone) {
            // Zone Droite
            console.log('👉 Tap Zone: Right (Next)');
            EventBus.emit('reader:next');
        } else {
            // Zone Centre - Ne rien faire (seul le double-tap toggle l'UI)
            console.log('⏺️ Tap Zone: Center (Simple tap, no action)');
        }
    }
};
