@echo off
title AutoZoom Local Server
echo ====================================================
echo   Menjalankan AutoZoom AI Hub di Localhost...
echo ====================================================
start "" http://localhost:8000
python -m http.server 8000

