import time
import av
import streamlit as st
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode, RTCConfiguration
from src.camera_stream import SmartZoomEngine

# Konfigurasi Halaman Streamlit
st.set_page_config(
    page_title="Smart Auto-Zoom Camera",
    page_icon="📷",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (Dark & Modern UI)
st.markdown("""
<style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        color: #9aa0a6;
        font-size: 1rem;
        margin-bottom: 1.5rem;
    }
    .stat-box {
        background-color: #1e222d;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #00f2fe;
    }
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title">📷 Smart Auto-Zoom & Auto-Centering Camera</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Pelacakan Wajah Real-Time AI, Digital Cropping Cerdas & Smooth LERP Interpolation</div>', unsafe_allow_html=True)

# ----------------- SIDEBAR CONTROLS -----------------
with st.sidebar:
    st.header("⚙️ Kontrol & Pengaturan")
    
    enable_autozoom = st.toggle("🔍 Aktifkan Auto-Zoom", value=True, help="Otomatis zoom & centering saat wajah terdeteksi.")
    
    st.subheader("🎚️ Parameter Zoom & Transisi")
    max_zoom = st.slider(
        "Maksimum Zoom (x)",
        min_value=1.0,
        max_value=4.0,
        value=2.2,
        step=0.1,
        help="Batas pembesaran digital maksimal kamera."
    )
    
    smoothing = st.slider(
        "Kecepatan Transisi (LERP Factor)",
        min_value=0.02,
        max_value=0.25,
        value=0.08,
        step=0.01,
        help="Nilai kecil = transisi sangat mulus/sinematik; Nilai besar = respon cepat."
    )

    padding = st.slider(
        "Head Margin / Padding",
        min_value=1.2,
        max_value=3.0,
        value=1.8,
        step=0.1,
        help="Ruang di sekitar kepala agar pembingkaian tampak natural."
    )

    grace_sec = st.slider(
        "Grace Period (Detik)",
        min_value=0.5,
        max_value=5.0,
        value=2.0,
        step=0.5,
        help="Waktu jeda sebelum kamera otomatis zoom out penuh jika wajah keluar frame."
    )

    st.subheader("🛠️ Debugging & Visual")
    debug_mode = st.toggle("🟩 Tampilkan Bounding Box & Crop Grid", value=False, help="Menampilkan kotak hijau wajah dan area crop saat ini.")


# ----------------- WEBRTC VIDEO PROCESSOR -----------------
class VideoTransformer(VideoProcessorBase):
    def __init__(self):
        self.engine = SmartZoomEngine(
            max_zoom=max_zoom,
            lerp_factor=smoothing,
            head_padding=padding,
            grace_period_sec=grace_sec,
            enable_autozoom=enable_autozoom,
            debug_mode=debug_mode
        )
        self.last_time = time.time()
        self.fps = 0.0

    def update_params(self, max_zoom, smoothing, padding, grace_sec, enable_autozoom, debug_mode):
        self.engine.max_zoom = max_zoom
        self.engine.lerp_factor = smoothing
        self.engine.head_padding = padding
        self.engine.grace_period_sec = grace_sec
        self.engine.enable_autozoom = enable_autozoom
        self.engine.debug_mode = debug_mode

    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        
        # Update parameter runtime dari UI Streamlit
        self.update_params(max_zoom, smoothing, padding, grace_sec, enable_autozoom, debug_mode)
        
        # Hitung FPS
        now = time.time()
        dt = now - self.last_time
        self.last_time = now
        if dt > 0:
            current_fps = 1.0 / dt
            self.fps = self.fps * 0.9 + current_fps * 0.1 # Smoothed FPS

        # Jalankan Smart Zoom Engine
        processed_img = self.engine.process_frame(img)

        # Tempelkan FPS Counter di pojok kiri atas
        import cv2
        cv2.putText(
            processed_img,
            f"FPS: {self.fps:.1f}",
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 128),
            2
        )

        return av.VideoFrame.from_ndarray(processed_img, format="bgr24")


# ----------------- MAIN DISPLAY -----------------
col1, col2 = st.columns([3, 1])

with col1:
    st.markdown("### 🔴 Live Stream")
    webrtc_ctx = webrtc_streamer(
        key="smart-autozoom",
        mode=WebRtcMode.SENDRECV,
        rtc_configuration=RTCConfiguration(
            {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
        ),
        video_processor_factory=VideoTransformer,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )

with col2:
    st.markdown("### 📊 Status & Info")
    st.markdown(f"""
    <div class="stat-box">
        <b>Status Auto-Zoom:</b> {'<span style="color:#00f2fe;">AKTIF</span>' if enable_autozoom else '<span style="color:#ff6b6b;">NONAKTIF</span>'}<br>
        <b>Maksimum Zoom:</b> {max_zoom}x<br>
        <b>LERP Smoothing:</b> {smoothing}<br>
        <b>Padding Area:</b> {padding}x<br>
        <b>Debug Grid:</b> {'Aktif' if debug_mode else 'Mati'}
    </div>
    """, unsafe_allow_html=True)
    
    st.info("""
    💡 **Tips Penggunaan:**
    - Pastikan pencahayaan ruangan cukup agar deteksi wajah bekerja maksimal.
    - Gerakkan tubuh/kepala Anda perlahan untuk melihat transisi kamera cerdas yang halus (LERP).
    - Menjauhlah dari kamera untuk melihat fitur Zoom-In otomatis bekerja.
    """)
