@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem YouTube cambia a menudo y deja de funcionar la descarga hasta que yt-dlp se actualiza.
echo Actualizando yt-dlp (el componente que importa de YouTube)...
uv pip install --python ".venv\Scripts\python.exe" -U "yt-dlp[default]"
echo.
echo Listo. Cierra Armonia Lab si estaba abierta y vuelve a arrancarla.
pause
