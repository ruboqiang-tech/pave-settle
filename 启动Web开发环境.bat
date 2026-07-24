@echo off
setlocal

title Settlement Web Dev
color 0B

echo ==============================================
echo Starting Web dev server (Vite)
echo URL: http://127.0.0.1:5173/
echo ==============================================
echo.

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

if not exist "%APP_DIR%\package.json" (
  echo Project folder not found: %APP_DIR%
  pause
  exit /b 1
)

pushd "%APP_DIR%" >nul 2>nul
if errorlevel 1 (
  echo Failed to enter project folder: %APP_DIR%
  pause
  exit /b 1
)


set "PORT=5173"
set "URL=http://127.0.0.1:%PORT%/"
set "PORT_STATUS="

for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$port=%PORT%; $conns=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue; if (-not $conns) { 'FREE'; exit 0 }; try { $resp=Invoke-WebRequest -Uri ('http://127.0.0.1:' + $port + '/') -UseBasicParsing -TimeoutSec 3; if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { 'HEALTHY'; exit 0 } } catch {}; $pids=$conns | Select-Object -ExpandProperty OwningProcess -Unique; $canKill=$true; foreach ($pid in $pids) { $proc=Get-Process -Id $pid -ErrorAction SilentlyContinue; if (-not $proc -or $proc.ProcessName -ine 'node') { $canKill=$false } }; if (-not $canKill) { 'BLOCKED'; exit 0 }; foreach ($pid in $pids) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }; 'RECOVERED'"`) do set "PORT_STATUS=%%i"

if /i "%PORT_STATUS%"=="HEALTHY" (
  echo Port %PORT% already has a healthy dev server. Opening browser...
  start "" "%URL%"
  exit /b 0
)

if /i "%PORT_STATUS%"=="RECOVERED" (
  echo Detected stale Node process on port %PORT%, cleaned automatically.
)

if /i "%PORT_STATUS%"=="BLOCKED" (
  echo Port %PORT% is occupied by a non-Node process. Please free this port first.
  pause
  exit /b 1
)




echo Launching browser in 3 seconds...

powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:5173/'" >nul 2>nul

echo Running: npm.cmd --prefix "%APP_DIR%" run dev -- --host 0.0.0.0 --port %PORT% --strictPort
echo.
npm.cmd --prefix "%APP_DIR%" run dev -- --host 0.0.0.0 --port %PORT% --strictPort
