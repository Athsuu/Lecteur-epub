/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EPUB-PARSER.WORKER.JS
 * Web Worker dédié au parsing des fichiers EPUB.
 * Déporte le traitement lourd (unzip + parsing XML) hors du Main Thread.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Import de JSZip depuis CDN (jsDelivr - version stable 3.10.1)
// Utilisation d'un CDN pour éviter de gérer des fichiers locaux
// Minimal Logger shim for worker context (no module imports)
const LoggerShim = (moduleName = 'Worker') => {
    const now = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
    };
    return {
        info: (msg, ...d) => console.info(`[%c${now()}%c] [%c${moduleName}%c] ℹ️ ${msg}`, 'color:#17a2b8', '', 'color:#17a2b8;font-weight:700', '', ...d),
        warn: (msg, ...d) => console.warn(`[%c${now()}%c] [%c${moduleName}%c] ⚠️ ${msg}`, 'color:#d97706', '', 'color:#d97706;font-weight:700', '', ...d),
        error: (msg, err) => console.error(`[%c${now()}%c] [%c${moduleName}%c] ❌ ${msg}`, 'color:#dc2626', '', 'color:#dc2626;font-weight:700', '', err),
        debug: (msg, ...d) => console.log(`[%c${now()}%c] [%c${moduleName}%c] 🔧 ${msg}`, 'color:#6c757d', '', 'color:#6c757d;font-weight:700', '', ...d)
    };
};

const logger = LoggerShim('EpubWorker');

try {
    importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
} catch (error) {
    // Fallback en cas d'échec de chargement depuis le CDN
    logger.error('Failed to load JSZip from CDN:', error);
    self.postMessage({
        type: 'error',
        error: 'Failed to load JSZip library. Check internet connection.'
    });
}

/**
 * Extrait les métadonnées d'un contenu XML OPF sans DOMParser (workers)
 * Utilise des regex robustes pour parser le XML manuellement
 * @param {string} xmlContent - Contenu brut du fichier .opf
 * @returns {Object} Métadonnées extraites { title, author, publisher, language, synopsis }
 * @private
 */
function extractMetadata(xmlContent) {
    const metadata = {
        title: null,
        author: null,
        publisher: null,
        language: 'fr',
        synopsis: null
    };
    
    try {
        // Nettoyer le XML (supprimer commentaires, CDATA)
        let cleanXml = xmlContent
            .replace(/<!--[\s\S]*?-->/g, '') // Commentaires
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'); // CDATA
        
        // Extraire le titre <dc:title> ou <title>
        // Supporte les namespaces optionnels et attributs
        const titleMatch = cleanXml.match(/<(?:dc:)?title[^>]*>([\s\S]*?)<\/(?:dc:)?title>/i);
        if (titleMatch) {
            metadata.title = decodeXmlEntities(titleMatch[1].trim());
        }
        
        // Extraire l'auteur <dc:creator> ou <creator>
        // Peut avoir des attributs role="aut" ou opf:role="aut"
        const authorMatch = cleanXml.match(/<(?:dc:)?creator[^>]*>([\s\S]*?)<\/(?:dc:)?creator>/i);
        if (authorMatch) {
            metadata.author = decodeXmlEntities(authorMatch[1].trim());
        }
        
        // Extraire l'éditeur <dc:publisher> ou <publisher>
        const publisherMatch = cleanXml.match(/<(?:dc:)?publisher[^>]*>([\s\S]*?)<\/(?:dc:)?publisher>/i);
        if (publisherMatch) {
            metadata.publisher = decodeXmlEntities(publisherMatch[1].trim());
        }
        
        // Extraire la langue <dc:language> ou <language>
        const languageMatch = cleanXml.match(/<(?:dc:)?language[^>]*>([\s\S]*?)<\/(?:dc:)?language>/i);
        if (languageMatch) {
            metadata.language = decodeXmlEntities(languageMatch[1].trim());
        }
        
        // Extraire le synopsis/description <dc:description> ou <description>
        const synopsisMatch = cleanXml.match(/<(?:dc:)?description[^>]*>([\s\S]*?)<\/(?:dc:)?description>/i);
        if (synopsisMatch) {
            let synopsis = synopsisMatch[1].trim();
            
            // Nettoyer le HTML à l'intérieur (balises <p>, <br>, etc.)
            synopsis = synopsis
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            
            metadata.synopsis = decodeXmlEntities(synopsis);
        }
        
    } catch (error) {
        logger.error('Metadata extraction failed:', error);
    }
    
    return metadata;
}

/**
 * Décode les entités XML/HTML courantes
 * @param {string} text - Texte avec entités
 * @returns {string} Texte décodé
 * @private
 */
function decodeXmlEntities(text) {
    if (!text) return '';
    
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Trouve le chemin du fichier .opf dans le container.xml
 * @param {JSZip} zip - Archive ZIP décompressée
 * @returns {Promise<string|null>} Chemin du fichier .opf ou null
 * @private
 */
async function findOpfPath(zip) {
    try {
        // Lire le container.xml (standard EPUB)
        const containerFile = zip.file('META-INF/container.xml');
        if (!containerFile) {
            logger.warn('META-INF/container.xml not found');
            return null;
        }
        
        const containerXml = await containerFile.async('text');
        
        // Extraire le chemin du rootfile avec regex
        const rootfileMatch = containerXml.match(/<rootfile[^>]+full-path=["']([^"']+)["']/i);
        if (rootfileMatch) {
            return rootfileMatch[1];
        }
        
        return null;
    } catch (error) {
        logger.error('Error finding OPF path:', error);
        return null;
    }
}

/**
 * Trouve l'ID de la couverture dans le fichier OPF
 * @param {string} opfContent - Contenu XML du fichier .opf
 * @returns {string|null} ID de la couverture ou null
 * @private
 */
function findCoverId(opfContent) {
    try {
        // Méthode 1: Balise <meta name="cover" content="cover-id">
        const metaCoverMatch = opfContent.match(/<meta\s+name=["']cover["']\s+content=["']([^"']+)["']/i);
        if (metaCoverMatch) {
            return metaCoverMatch[1];
        }
        
        // Méthode 2: Chercher dans le manifest un item avec properties="cover-image"
        const coverItemMatch = opfContent.match(/<item[^>]+properties=["'][^"']*cover-image[^"']*["'][^>]+id=["']([^"']+)["']/i);
        if (coverItemMatch) {
            return coverItemMatch[1];
        }
        
        // Méthode 3: Item avec id contenant "cover"
        const idCoverMatch = opfContent.match(/<item[^>]+id=["']([^"']*cover[^"']*)["'][^>]+href=/i);
        if (idCoverMatch) {
            return idCoverMatch[1];
        }
        
        return null;
    } catch (error) {
        logger.error('Error finding cover ID:', error);
        return null;
    }
}

/**
 * Trouve le chemin (href) d'un item dans le manifest par son ID
 * @param {string} opfContent - Contenu XML du fichier .opf
 * @param {string} itemId - ID de l'item recherché
 * @returns {string|null} Chemin du fichier ou null
 * @private
 */
function findItemHref(opfContent, itemId) {
    try {
        // Échapper les caractères spéciaux dans l'ID pour regex
        const escapedId = itemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Chercher l'item avec cet ID et extraire le href
        const itemRegex = new RegExp(`<item[^>]+id=["']${escapedId}["'][^>]+href=["']([^"']+)["']`, 'i');
        const match = opfContent.match(itemRegex);
        
        if (match) {
            return match[1];
        }
        
        // Inversion: href peut être avant id
        const itemRegex2 = new RegExp(`<item[^>]+href=["']([^"']+)["'][^>]+id=["']${escapedId}["']`, 'i');
        const match2 = opfContent.match(itemRegex2);
        
        if (match2) {
            return match2[1];
        }
        
        return null;
    } catch (error) {
        logger.error('Error finding item href:', error);
        return null;
    }
}

/**
 * Extrait le blob de la couverture depuis le ZIP
 * @param {JSZip} zip - Archive ZIP décompressée
 * @param {string} opfPath - Chemin du fichier .opf
 * @param {string} opfContent - Contenu du fichier .opf
 * @returns {Promise<Blob|null>} Blob de l'image de couverture ou null
 * @private
 */
async function extractCoverBlob(zip, opfPath, opfContent) {
    try {
        // Trouver l'ID de la couverture
        const coverId = findCoverId(opfContent);
        if (!coverId) {
            logger.warn('Cover ID not found in OPF');
            return null;
        }
        
        // Trouver le href de cet item
        const coverHref = findItemHref(opfContent, coverId);
        if (!coverHref) {
            logger.warn('Cover href not found for ID:', coverId);
            return null;
        }
        
        // Résoudre le chemin relatif par rapport au .opf
        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
        const coverPath = opfDir + coverHref;
        
        // Récupérer le fichier dans le ZIP
        const coverFile = zip.file(coverPath);
        if (!coverFile) {
            logger.warn('Cover file not found at path:', coverPath);
            return null;
        }
        
        // Extraire en tant que Blob
        const coverBlob = await coverFile.async('blob');
        return coverBlob;
        
    } catch (error) {
        logger.error('Error extracting cover blob:', error);
        return null;
    }
}

/**
 * Parse un fichier EPUB complet
 * @param {Blob} epubBlob - Fichier EPUB en Blob
 * @param {string} fileId - Identifiant unique du fichier
 * @returns {Promise<Object>} { metadata, coverBlob }
 * @private
 */
async function parseEpub(epubBlob, fileId) {
    try {
        // Étape 1: Décompresser le ZIP
        const zip = new JSZip();
        await zip.loadAsync(epubBlob);
        
        // Étape 2: Trouver le fichier .opf (metadata principal)
        const opfPath = await findOpfPath(zip);
        if (!opfPath) {
            throw new Error('OPF file not found in EPUB');
        }
        
        const opfFile = zip.file(opfPath);
        if (!opfFile) {
            throw new Error(`OPF file not accessible: ${opfPath}`);
        }
        
        const opfContent = await opfFile.async('text');
        
        // Étape 3: Extraire les métadonnées du XML
        const metadata = extractMetadata(opfContent);
        
        // Étape 4: Extraire la couverture (optionnel)
        const coverBlob = await extractCoverBlob(zip, opfPath, opfContent);
        
        return {
            metadata,
            coverBlob
        };
        
    } catch (error) {
        logger.error('EPUB parsing error:', error);
        throw error;
    }
}

/**
 * Convertit un Blob en ArrayBuffer pour Transferable Objects
 * @param {Blob} blob - Blob à convertir
 * @returns {Promise<ArrayBuffer>} ArrayBuffer du blob
 * @private
 */
async function blobToArrayBuffer(blob) {
    if (!blob) return null;
    return await blob.arrayBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER - Point d'entrée du Worker
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('message', async (event) => {
    const { command, file, fileId } = event.data;
    
    if (command !== 'PARSE') {
        postMessage({
            status: 'ERROR',
            fileId,
            error: `Unknown command: ${command}`
        });
        return;
    }
    
    if (!file || !(file instanceof Blob)) {
        postMessage({
            status: 'ERROR',
            fileId,
            error: 'Invalid file: must be a Blob'
        });
        return;
    }
    
    try {
        // Parser le fichier EPUB
        const { metadata, coverBlob } = await parseEpub(file, fileId);
        
        // Préparer le transfert optimisé avec Transferable Objects
        const transferList = [];
        let coverArrayBuffer = null;
        let coverMimeType = null;
        
        if (coverBlob) {
            coverArrayBuffer = await blobToArrayBuffer(coverBlob);
            coverMimeType = coverBlob.type;
            
            // Ajouter à la liste de transfert pour éviter la copie mémoire
            if (coverArrayBuffer) {
                transferList.push(coverArrayBuffer);
            }
        }
        
        // Envoyer le résultat avec Transferable Objects
        postMessage(
            {
                status: 'SUCCESS',
                fileId,
                metadata,
                coverArrayBuffer,
                coverMimeType
            },
            transferList // Transfert de propriété (zero-copy)
        );
        
    } catch (error) {
        postMessage({
            status: 'ERROR',
            fileId,
            error: error.message || 'Unknown error during parsing'
        });
    }
});
