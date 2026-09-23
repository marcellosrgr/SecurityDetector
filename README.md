# Smart Auto-Zoom & Auto-Centering Camera 📷

Aplikasi kamera pintar berbasis Python yang secara otomatis memperbesar (*digital zoom-in*), memusatkan (*re-centering*), dan melacak wajah pengguna secara *real-time* dengan transisi sinematik yang mulus (*LERP interpolation*).

---

## 🚀 Fitur Utama

1. **AI Face Detection & Tracking**:
   - Didukung oleh Google **MediaPipe Face Detection** untuk pelacakan berlatensi sangat rendah & ringan.
   - Dilengkapi filter **Moving Average** untuk mencegah getaran (*jittering*) pada kotak deteksi.
   - Mendukung prioritas wajah terbesar atau penggabungan titik tengah (*center of mass*).

2. **Smart Auto-Zoom Engine**:
   - **Dynamic Digital Cropping**: Membingkai subjek secara proporsional dengan *head padding* natural (1.5x - 2.5x ukuran kepala).
   - **Cinematic Smooth Transition (LERP)**: Gerakan kamera halus tanpa patah-patah layaknya kamera hardware PTZ.
   - **Smart Grace Period**: Kamera kembali *zoom out* penuh (1.0x) secara bertahap saat wajah keluar dari frame.

3. **Dual Interface**:
   - **Web UI (Streamlit + WebRTC)**: Antarmuka peramban modern dengan kontrol slider interaktif.
   - **Desktop UI (OpenCV Standalone)**: Versi desktop langsung dengan keyboard shortcuts & performa maksimal.

---

## 📁 Struktur Direktori

```text
smart_autozoom_camera/
├── src/
│   ├── __init__.py
│   ├── face_tracker.py    # Deteksi MediaPipe & Moving Average smoothing
│   └── camera_stream.py   # Logika digital crop, batas aspek rasio, & LERP
├── app.py                 # Web Application (Streamlit + WebRTC)
├── desktop_app.py         # Desktop Standalone Application (OpenCV Window)
├── requirements.txt       # Dependensi library Python
└── README.md              # Dokumentasi & panduan
```

---

## 🛠️ Instalasi & Setup

### 1. Prasyarat
Pastikan Python 3.8+ sudah terinstal di komputer Anda.

### 2. Buat Virtual Environment (Opsional tapi disarankan)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / MacOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalasi Dependensi
```bash
pip install -r requirements.txt
```

---

## 💻 Cara Menjalankan (Paling Mudah)

### ⚡ Cara 1-Klik (Langsung Buka & Pakai):
Cukup **klik dua kali (double click)** file [`run.bat`](file:///c:/Users/Regina%20Siregar/Desktop/autozoom/run.bat) di dalam folder proyek ini. 
File ini akan otomatis menginstal paket yang diperlukan dan langsung menampilkan jendela kamera dengan fitur auto-zoom aktif!

---

### Cara Manual lewat Terminal:

#### Opsi 1: Menjalankan Langsung (Desktop App)
```bash
python desktop_app.py
```

**Kontrol Pintasan Keyboard (Desktop Mode):**
- `[SPACE]` : Mengaktifkan / Menutup fitur Auto-Zoom
- `[D]` : Toggle Mode Debug (Visualisasi Face Bounding Box & Crop Grid)
- `[+]` / `[-]` : Menambah / Mengurangi batas Maksimum Zoom
- `[Q]` / `[ESC]` : Keluar dari aplikasi
