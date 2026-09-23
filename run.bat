@echo off
title Smart Auto-Zoom Camera Launcher
echo ====================================================
echo       SMART AUTO-ZOOM CAMERA LAUNCHER
echo ====================================================
echo Memeriksa dan menginstal dependensi (jika belum)...
python -m pip install -r requirements.txt --quiet

echo.
echo Menjalankan Smart Auto-Zoom Camera...
python desktop_app.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Terjadi kendala saat menjalankan kamera langsung.
    echo Mencoba membuka versi Web Streamlit...
    python -m streamlit run app.py
)
pause
