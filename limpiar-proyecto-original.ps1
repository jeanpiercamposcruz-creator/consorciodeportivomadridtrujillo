
# limpiar-proyecto.ps1
# Limpieza conservadora del proyecto ERP.
# No elimina scripts/, qa/, README.md ni archivos de la aplicación.

param([switch]$Simular)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json") -or -not (Test-Path ".\app")) {
    Write-Host "Ejecuta este script desde la raiz de erp-next." -ForegroundColor Red
    exit 1
}

$carpetaProyecto = (Get-Location).Path
$elementos = @(
    "test-results",
    "playwright-report",
    "tsconfig.tsbuildinfo",
    ".next"
)

Write-Host "Proyecto: $carpetaProyecto" -ForegroundColor Cyan

foreach ($elemento in $elementos) {
    $ruta = Join-Path $carpetaProyecto $elemento

    if (Test-Path -LiteralPath $ruta) {
        if ($Simular) {
            Write-Host "[SIMULACION] Se eliminaria: $elemento" -ForegroundColor Yellow
        }
        else {
            Remove-Item -LiteralPath $ruta -Recurse -Force
            Write-Host "Eliminado: $elemento" -ForegroundColor Green
        }
    }
    else {
        Write-Host "No existe (omitido): $elemento" -ForegroundColor DarkGray
    }
}

if ($Simular) {
    Write-Host "`nSimulacion terminada. No se elimino ningun archivo." -ForegroundColor Cyan
}
else {
    Write-Host "`nLimpieza terminada." -ForegroundColor Green
}
