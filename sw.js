/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICE WORKER - Lecteur EPUB PWA
 * Gère le cache et le fonctionnement hors-ligne
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ⚠ IMPORTANT : incrémenter ce nom dès qu'on modifie des fichiers JS/CSS
// pour éviter que Safari/iOS serve des fichiers en cache "mélangés" (ancien + nouveau).
const CACHE_NAME = 'epub-reader-v3';
const CACHE_VERSION = 3;

/**
 * Ressources critiques à mettre en cache immédiatement
 */
const CRITICAL_ASSETS = [
    './',
    './index.html',
    './css/themes.css',
    './css/base.css',
    './css/mobile.css',
    './css/desktop.css',
    './js/core/app.js',
    './js/core/config.js',
    './js/core/state.js',
    './js/core/database.js',
    './js/core/themes.js',
    './js/ui/ui-manager.js',
    './js/library/library-manager.js',
    './js/library/favorites-manager.js',
    './js/reader/reader-engine.js',
    './js/events/event-manager.js',
    './js/ui/base-ui.js',
    './js/ui/mobile-ui.js',
    './js/ui/desktop-ui.js',
    './js/ui/ui-factory.js',
    './js/ui/settings-manager.js',
    './js/reader/base-reader.js',
    './js/reader/scroll-reader.js',
    './js/reader/paged-reader.js',
    './js/reader/reader-factory.js',
    './js/events/event-bus.js',
    './js/events/action-handler.js',
    './js/events/gesture-handler.js',
    './js/events/keyboard-handler.js',
    './manifest.json'
];

/**
 * Ressources externes à mettre en cache
 */
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

/**
 * Installation du Service Worker
 * Met en cache toutes les ressources critiques
 */
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('📦 Caching critical assets...');
                
                // Cache les ressources locales
                await cache.addAll(CRITICAL_ASSETS);
                
                // Cache les ressources externes (avec gestion d'erreur)
                for (const url of EXTERNAL_ASSETS) {
                    try {
                        const response = await fetch(url, { mode: 'cors' });
                        if (response.ok) {
                            await cache.put(url, response);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not cache: ${url}`);
                    }
                }
                
                console.log('✅ All assets cached');
            })
            .then(() => self.skipWaiting())
    );
});

/**
 * Activation du Service Worker
 * Nettoie les anciens caches
 */
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log(`🗑️ Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activated');
                return self.clients.claim();
            })
    );
});

/**
 * Stratégie de cache: Network First avec fallback Cache
 * Essaie le réseau en premier, puis le cache si hors-ligne
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-GET
    if (request.method !== 'GET') return;
    
    // Ignorer les requêtes vers d'autres origines (sauf CDN autorisés)
    const allowedOrigins = [
        self.location.origin,
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
    ];
    
    if (!allowedOrigins.some(origin => request.url.startsWith(origin))) {
        return;
    }
    
    event.respondWith(
        // Stratégie: Cache First pour les assets statiques
        caches.match(request)
            .then((cachedResponse) => {
                // Si en cache et ressource statique, retourner le cache
                if (cachedResponse && isStaticAsset(request.url)) {
                    // Mettre à jour le cache en arrière-plan
                    fetchAndCache(request);
                    return cachedResponse;
                }
                
                // Sinon, essayer le réseau
                return fetch(request)
                    .then((networkResponse) => {
                        // Mettre en cache la nouvelle réponse
                        if (networkResponse.ok && isStaticAsset(request.url)) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Hors-ligne: retourner le cache si disponible
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        
                        // Page hors-ligne par défaut
                        if (request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

/**
 * Vérifie si l'URL correspond à un asset statique
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.svg', '.woff2'];
    return staticExtensions.some(ext => url.includes(ext)) || 
           url.includes('fonts.googleapis.com') ||
           url.includes('fonts.gstatic.com');
}

/**
 * Récupère et met en cache une ressource en arrière-plan
 * @param {Request} request - Requête à effectuer
 */
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response);
        }
    } catch (error) {
        // Silencieux - mise à jour en arrière-plan
    }
}

/**
 * Gestion des messages depuis l'application
 */
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'clearCache') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('🗑️ Cache cleared');
        });
    }
});
