# Limpiador seguro del ERP
# Solo elimina archivos generados y temporales.

param([switch]$Simular)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json") -or
    -not (Test-Path ".\app")) {
    Write-Host "Ejecuta este script desde la raiz de erp-next." -ForegroundColor Red
    exit 1
}

$elementos = @(
    "test-results",
    "playwright-report",
    "tsconfig.tsbuildinfo",
    ".next"
)

foreach ($elemento in $elementos) {
    if (Test-Path -LiteralPath $elemento) {
        if ($Simular) {
            Write-Host "[SIMULACION] Se eliminaria: $elemento" -ForegroundColor Yellow
        }
        else {
            Remove-Item -LiteralPath $elemento -Recurse -Force
            Write-Host "Eliminado: $elemento" -ForegroundColor Green
        }
    }
    else {
        Write-Host "No existe (omitido): $elemento" -ForegroundColor DarkGray
    }
}

if ($Simular) {
    Write-Host "Simulacion terminada. No se elimino ningun archivo." -ForegroundColor Cyan
}
else {
    Write-Host "Limpieza terminada." -ForegroundColor Green
}
