# AGENTS.md — AutoZoom Project Guidelines & Architecture

Panduan ini ditujukan untuk agen AI dan developer yang mengelola, memodifikasi, dan memperluas repositori **AutoZoom**.

---

## 📌 Deskripsi Proyek
**AutoZoom** adalah sistem kamera cerdas (*Smart Auto-Zoom & Auto-Centering*) berbasis Computer Vision yang melacak wajah secara real-time, memusatkan subjek, dan menerapkan *digital zoom* dengan transisi interpolasi halus (LERP).

Aplikasi ini tersedia dalam dua mode implementasi:
1. **Web-Native (Zero-Dependency)**: `index.html` menggunakan CDN MediaPipe Face Detection langsung di browser.
2. **Python-Native**: `desktop_app.py` (OpenCV) dan `app.py` (Streamlit + WebRTC) dengan modul `src/`.

---

## 🏗️ Arsitektur & Struktur Proyek

```text
autozoom/
├── src/
│   ├── __init__.py          # Export FaceTracker & SmartZoomEngine
│   ├── face_tracker.py      # MediaPipe Face Detection & Moving Average Filter
│   └── camera_stream.py     # Crop calculation, LERP interpolation, PTZ logic
├── app.py                   # Streamlit WebRTC Web App
├── desktop_app.py           # Native OpenCV Desktop App
├── index.html               # Pure HTML/JS standalone app (MediaPipe browser-based)
├── buka_kamera.bat          # 1-Click launcher untuk browser (no-python)
├── run.bat                  # 1-Click launcher untuk Python OpenCV
├── requirements.txt         # Python dependencies
├── README.md                # User documentation
└── AGENTS.md                # Developer & AI Agent specification
```

---

## ⚙️ Core Logic & Algorithms

### 1. Face Detection & Anti-Jitter Filter (`src/face_tracker.py` & `index.html`)
- Menggunakan **MediaPipe Face Detection** (model `short` / latensi rendah).
- **Stabilisasi Bounding Box**: Menerapkan *Moving Average Filter* sepanjang $N$ frame terakhir untuk menghilangkan getaran (*jitter*) pada koordinat wajah.

### 2. Smart Framing & Multi-Face Behavior
- **1 Wajah (Single Subject)**:
  - Melakukan *Close-up Zoom* dengan mempertahankan *head padding* (0.8x - 2.5x).
  - Memusatkan koordinat wajah ($X_{center}, Y_{center}$) di tengah frame.
- **2 Wajah atau Lebih (Group Framing)**:
  - Otomatis menghitung *Bounding Box* terluar yang mencakup seluruh wajah.
  - Melakukan **Zoom Out** secara bertahap dan memposisikan titik tengah gabungan (*Group Center of Mass*) di tengah frame agar semua orang tetap terlihat proporsional.
- **Wajah Hilang (Grace Period)**:
  - Menunggu selama toleransi *grace period* (default 2.0 detik).
  - Jika tidak ada wajah kembali, kamera melakukan *zoom out* kembali ke $1.0\times$ (*full frame*).

### 3. Smooth Digital PTZ (LERP Interpolation) (`src/camera_stream.py`)
- Koordinat *crop* $[x, y, w, h]$ diperbarui setiap frame menggunakan rumus:
  $$\text{Current} = \text{Current} + (\text{Target} - \text{Current}) \times \text{lerp\_factor}$$
- Nilai `lerp_factor` default berkisar antara `0.05` hingga `0.15` untuk menghasilkan gerakan kamera sinematik tanpa patah-patah.

---

## 🛠️ Panduan Pengembangan (Development Guidelines)

1. **Konsistensi Dua Mode**:
   - Jika mengubah logika framing di Python (`src/camera_stream.py`), pastikan untuk memperbarui juga logika di `index.html` (JavaScript) agar kedua versi selalu sinkron.
2. **Aspek Rasio**:
   - Pastikan setiap kalkulasi *crop box* ($w_{crop}, h_{crop}$) selalu mengunci aspek rasio asli dari frame kamera ($W/H$).
3. **Boundary Clamping**:
   - Koordinat $x, y$ dari crop box wajib di-*clamp* di antara rentang $[0.0, 1.0 - \text{size}]$ agar tidak terjadi *out-of-bounds* atau distorsi pada citra.
4. **Git Workflow**:
   - Format pesan commit: `feat:`, `fix:`, `refactor:`, `docs:`, atau `chore:`.
