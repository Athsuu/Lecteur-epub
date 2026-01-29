/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READER/INDEX.JS
 * Point d'entrée pour les modules Reader
 * ═══════════════════════════════════════════════════════════════════════════
 */

export { BaseReader } from './base-reader.js';
export { ScrollReader } from './scroll-reader.js';
export { PagedReader } from './paged-reader.js';
export { 
    default as ReaderFactory,
    getFlow,
    isScrollMode,
    isPagedMode,
    createReader,
    getReader,
    setBook,
    getBook,
    switchFlow,
    toggleFlow,
    destroy
} from './reader-factory.js';
