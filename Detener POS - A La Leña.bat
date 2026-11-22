@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Detener POS - A La Lena
cd /d "%~dp0"

set "PORT=3000"
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="PORT" set "PORT=%%B"
    )
)
set "PORT=%PORT: =%"

echo ========================================================
echo   DETENIENDO SERVIDOR POS - A LA LENA (Puerto %PORT%)
echo ========================================================
echo.

powershell -NoProfile -Command "$pids = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if ($pids.Count -eq 0) { Write-Host '[i] El servidor POS no estaba en ejecucion en el puerto %PORT%.'; exit 0 }; $stopped = 0; foreach ($id in $pids) { $proc = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessName -eq 'node') { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host ('[+] Proceso Node.js (PID ' + $id + ') detenido correctamente.'); $stopped++ } else { Write-Host ('[!] El puerto %PORT% esta usado por otro proceso (PID ' + $id + '), no se detuvo por seguridad.') } }; if ($stopped -eq 0) { Write-Host '[i] No se encontraron procesos Node.js del POS para detener.' }"

echo.
timeout /t 3 >nul
exit /b 0
