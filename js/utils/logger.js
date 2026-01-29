/**
 * Lightweight Logger
 * High-performance checks before formatting to avoid wasted CPU
 */
export class Logger {
    static CONFIG = {
        ENABLED: true,
        LEVEL: 'DEBUG' // DEBUG, INFO, WARN, ERROR
    };

    static LEVELS = {
        DEBUG: 10,
        INFO: 20,
        WARN: 30,
        ERROR: 40
    };

    constructor(moduleName = 'App') {
        this.module = moduleName;
    }

    static setConfig(cfg) {
        this.CONFIG = { ...this.CONFIG, ...cfg };
    }

    _shouldLog(level) {
        if (!Logger.CONFIG.ENABLED) return false;
        const current = Logger.LEVELS[Logger.CONFIG.LEVEL] || Logger.LEVELS.DEBUG;
        const wanted = Logger.LEVELS[level] || Logger.LEVELS.DEBUG;
        return wanted >= current;
    }

    _now() {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const ms = String(d.getMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss}.${ms}`;
    }

    debug(message, ...data) {
        if (!this._shouldLog('DEBUG')) return;
        const time = this._now();
        const fmt = `%c[${time}] [%c${this.module}%c] 🔧 ${message}`;
        const styleTime = 'color:#6c757d';
        const styleModule = 'color:#6c757d;font-weight:700';
        const styleReset = '';
        console.log(fmt, styleTime, styleModule, styleReset, ...data);
    }

    info(message, ...data) {
        if (!this._shouldLog('INFO')) return;
        const time = this._now();
        const fmt = `%c[${time}] [%c${this.module}%c] ℹ️ ${message}`;
        const styleTime = 'color:#17a2b8';
        const styleModule = 'color:#17a2b8;font-weight:700';
        const styleReset = '';
        console.info(fmt, styleTime, styleModule, styleReset, ...data);
    }

    warn(message, ...data) {
        if (!this._shouldLog('WARN')) return;
        const time = this._now();
        const fmt = `%c[${time}] [%c${this.module}%c] ⚠️ ${message}`;
        const styleTime = 'color:#d97706';
        const styleModule = 'color:#d97706;font-weight:700';
        const styleReset = '';
        console.warn(fmt, styleTime, styleModule, styleReset, ...data);
    }

    error(message, errorObject) {
        if (!this._shouldLog('ERROR')) return;
        const time = this._now();
        const fmt = `%c[${time}] [%c${this.module}%c] ❌ ${message}`;
        const styleTime = 'color:#dc2626';
        const styleModule = 'color:#dc2626;font-weight:700';
        const styleReset = '';
        if (errorObject !== undefined) {
            console.error(fmt, styleTime, styleModule, styleReset, errorObject);
        } else {
            console.error(fmt, styleTime, styleModule, styleReset);
        }
    }
}

export default Logger;
