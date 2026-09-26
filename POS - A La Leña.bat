@echo off
title POS - A La Leña
color 0E

:: Cambiar al directorio donde se encuentra este script
cd /d "%~dp0"

echo ========================================================
echo   🔥 INICIANDO SISTEMA POS - A LA LENA
echo ========================================================
echo.

:: Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Abrir el navegador automaticamente despues de 2 segundos en segundo plano
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

echo [+] Abriendo navegador en http://localhost:3000...
echo [+] Iniciando servidor Express...
echo.
echo Presiona Ctrl+C para detener el servidor.
echo ========================================================
echo.

:: Iniciar el servidor de Node.js
node server.js

pause
