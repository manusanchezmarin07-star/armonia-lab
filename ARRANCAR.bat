@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Armonía Lab
if not exist ".venv\Scripts\python.exe" (
  echo Primero ejecuta INSTALAR.bat
  pause
  exit /b 1
)
rem Se abre el navegador cuando el servidor ya responde; Edge y Chrome soportan MIDI.
start "" /b powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest http://127.0.0.1:8765/api/health -UseBasicParsing|Out-Null;Start-Process http://127.0.0.1:8765;break}catch{Start-Sleep -Milliseconds 500}}"
cd backend
"..\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8765
pause
