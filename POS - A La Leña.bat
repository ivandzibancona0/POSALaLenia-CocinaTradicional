@echo off
chcp 65001 >nul
setlocal EnableExtensions

title POS - A La Lena
color 0E

:: Cambiar al directorio donde se encuentra este script
cd /d "%~dp0"

set "SILENT=0"
if /i "%~1"=="--silent" set "SILENT=1"

:: Leer PORT y DB_PORT desde .env (con valores por defecto)
set "PORT=3000"
set "DB_PORT=3306"
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="PORT" set "PORT=%%B"
        if /i "%%A"=="DB_PORT" set "DB_PORT=%%B"
    )
)
set "PORT=%PORT: =%"
set "DB_PORT=%DB_PORT: =%"

if "%SILENT%"=="0" (
    echo ========================================================
    echo   INICIANDO SISTEMA POS - A LA LENA
    echo ========================================================
    echo.
)

:: 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    call :SHOW_ERROR "Node.js no esta instalado o no se encuentra en el PATH. Descargalo desde https://nodejs.org/"
    exit /b 1
)

:: 2. Si el servidor POS ya esta corriendo en el puerto, abrir directamente la app en Edge
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 (
    if "%SILENT%"=="0" echo [+] El servidor POS ya esta en ejecucion en el puerto %PORT%. Abriendo aplicacion...
    call :OPEN_APP
    exit /b 0
)

:: 3. Verificar servicio oficial de MySQL (ignorar si ya esta encendido; iniciar si esta detenido)
if "%SILENT%"=="0" echo [+] Verificando servicio MySQL...
powershell -NoProfile -Command "$svc = Get-Service -Name 'MySQL*' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($svc -and $svc.Status -eq 'Running') { exit 0 }; try { $c = New-Object System.Net.Sockets.TcpClient; $ar = $c.BeginConnect('127.0.0.1', %DB_PORT%, $null, $null); if ($ar.AsyncWaitHandle.WaitOne(1000, $false) -and $c.Connected) { $c.Close(); exit 0 }; $c.Close() } catch {}; if ($svc) { exit 2 } else { exit 3 }" >nul 2>nul
set "MYSQL_STATE=%errorlevel%"

if "%MYSQL_STATE%"=="0" (
    if "%SILENT%"=="0" echo [+] MySQL ya esta encendido. Continuando...
) else if "%MYSQL_STATE%"=="2" (
    if "%SILENT%"=="0" echo [+] MySQL esta detenido. Solicitando permisos para iniciar el servicio oficial...
    powershell -NoProfile -Command "$svc = Get-Service -Name 'MySQL*' -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $svc) { exit 1 }; try { Start-Process -FilePath 'net.exe' -ArgumentList 'start', $svc.Name -Verb RunAs -WindowStyle Hidden -PassThru -Wait | Out-Null } catch { exit 2 }; for ($i=0; $i -lt 30; $i++) { $svc.Refresh(); if ($svc.Status -eq 'Running') { exit 0 }; Start-Sleep -Milliseconds 500 }; exit 1" >nul 2>nul
    if errorlevel 1 (
        call :SHOW_ERROR "No se pudo iniciar el servicio de MySQL. Verifica los permisos de Administrador o inicia el servicio manualmente."
        exit /b 1
    )
    if "%SILENT%"=="0" echo [+] Servicio MySQL iniciado correctamente.
) else (
    if "%SILENT%"=="0" echo [!] No se detecto un servicio MySQL activo en el puerto %DB_PORT%. Intentando iniciar el servidor...
)

:: 4. Iniciar servidor Node.js segun modo (silencioso en segundo plano o visible en consola)
if not exist "data" mkdir "data"

if "%SILENT%"=="1" (
    powershell -NoProfile -Command "Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory '%CD%' -WindowStyle Hidden -RedirectStandardOutput '%CD%\data\server.log' -RedirectStandardError '%CD%\data\server-error.log'" >nul 2>nul

    powershell -NoProfile -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/api/health' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1" >nul 2>nul
    if errorlevel 1 (
        call :SHOW_ERROR "El servidor POS tardo demasiado en iniciar o encontro un error. Revisa el archivo data\server-error.log."
        exit /b 1
    )

    call :OPEN_APP
    exit /b 0
)

:: Modo visible (doble clic directo en el .bat)
echo [+] Iniciando servidor Express en http://localhost:%PORT%...
echo [+] La aplicacion se abrira automaticamente en Microsoft Edge (Modo Aplicacion)...
echo.
echo Presiona Ctrl+C para detener el servidor.
echo ========================================================
echo.

:: Esperar en segundo plano a que /api/health responda y abrir Edge en modo aplicacion
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/api/health' -TimeoutSec 1; if ($r.StatusCode -eq 200) { break } } catch {}; Start-Sleep -Milliseconds 500 }; $url = 'http://localhost:%PORT%'; $p1 = Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Microsoft\Edge\Application\msedge.exe'; $p2 = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Microsoft\Edge\Application\msedge.exe'; $edge = @($p1, $p2) | Where-Object { Test-Path $_ } | Select-Object -First 1; if (-not $edge) { $cmd = Get-Command msedge.exe -ErrorAction SilentlyContinue; if ($cmd) { $edge = $cmd.Source } }; if ($edge) { Start-Process -FilePath $edge -ArgumentList ('--app=' + $url), '--start-maximized' } else { Start-Process $url }"

node server.js
pause
exit /b 0

:OPEN_APP
set "APP_URL=http://localhost:%PORT%"
set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE (
    for /f "delims=" %%E in ('where msedge.exe 2^>nul') do if not defined EDGE_EXE set "EDGE_EXE=%%E"
)
if defined EDGE_EXE (
    start "" "%EDGE_EXE%" --app=%APP_URL% --start-maximized
) else (
    start "" "%APP_URL%"
)
exit /b 0

:SHOW_ERROR
if "%SILENT%"=="1" (
    powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('%~1', 'POS - A La Lena', 'OK', 'Error') | Out-Null" >nul 2>nul
) else (
    echo [ERROR] %~1
    echo.
    pause
)
exit /b 0
