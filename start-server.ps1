# ════════════════════════════════════════════════════════════════════════════
# Serveur HTTP Simple pour Lecteur EPUB
# Démarre un serveur accessible depuis le réseau local
# ════════════════════════════════════════════════════════════════════════════

$port = 8000
$path = $PSScriptRoot

# Récupérer l'IP locale
$localIP = (Get-NetIPAddress | Where-Object {
    $_.AddressFamily -eq "IPv4" -and 
    $_.IPAddress -like "192.168.*" -and 
    $_.PrefixOrigin -eq "Dhcp"
}).IPAddress | Select-Object -First 1

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📚 LECTEUR EPUB - Serveur Démarré" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🖥️  Local:    http://localhost:$port" -ForegroundColor White
Write-Host "  📱 Mobile:   http://${localIP}:$port" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Ouvrez l'URL Mobile sur votre téléphone" -ForegroundColor Gray
Write-Host "  Appuyez sur Ctrl+C pour arrêter le serveur" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Créer le listener HTTP
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://*:$port/")
$listener.Start()

Write-Host "✅ Serveur actif - En attente de connexions..." -ForegroundColor Green
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Construire le chemin du fichier
        $filePath = Join-Path $path $request.Url.LocalPath.TrimStart('/')
        
        # Si c'est un dossier, chercher index.html
        if (Test-Path $filePath -PathType Container) {
            $filePath = Join-Path $filePath "index.html"
        }
        
        # Log de la requête
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($request.HttpMethod) " -NoNewline -ForegroundColor Cyan
        Write-Host "$($request.Url.LocalPath)" -ForegroundColor White
        
        if (Test-Path $filePath -PathType Leaf) {
            # Déterminer le Content-Type
            $contentType = switch -Regex ($filePath) {
                '\.html?$' { 'text/html; charset=utf-8' }
                '\.css$'   { 'text/css; charset=utf-8' }
                '\.js$'    { 'application/javascript; charset=utf-8' }
                '\.json$'  { 'application/json; charset=utf-8' }
                '\.png$'   { 'image/png' }
                '\.jpg$'   { 'image/jpeg' }
                '\.svg$'   { 'image/svg+xml' }
                '\.woff2?$'{ 'font/woff2' }
                default    { 'application/octet-stream' }
            }
            
            # Lire et envoyer le fichier
            $buffer = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            # Fichier non trouvé
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 - Fichier non trouvé: $($request.Url.LocalPath)")
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            Write-Host "  ⚠️  404 - Fichier non trouvé" -ForegroundColor Red
        }
        
        $response.Close()
    }
} finally {
    $listener.Stop()
    Write-Host ""
    Write-Host "🛑 Serveur arrêté" -ForegroundColor Yellow
}
