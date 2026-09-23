import cv2
import time
from src.camera_stream import SmartZoomEngine


def main():
    # Inisialisasi Smart Zoom Engine
    engine = SmartZoomEngine(
        max_zoom=2.5,
        lerp_factor=0.08,
        head_padding=1.8,
        grace_period_sec=2.0,
        enable_autozoom=True,
        debug_mode=False
    )

    # Inisialisasi Kamera dengan fallback backend DirectShow untuk Windows agar cepat terbuka
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("[ERROR] Kamera tidak ditemukan! Pastikan webcam terhubung dan tidak sedang dipakai aplikasi lain (seperti Zoom/Meet).")
        input("Tekan Enter untuk keluar...")
        return

    # Set resolusi kamera (misal 1280x720)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print("==================================================")
    print("  Smart Auto-Zoom Camera (Desktop Standalone)")
    print("==================================================")
    print("Tombol Pintasan:")
    print("  [SPACE]  : Toggle Auto-Zoom (Aktif / Nonaktif)")
    print("  [D]      : Toggle Debug Mode (Bounding Box & Grid)")
    print("  [+] / [-]: Naikkan / Turunkan Max Zoom")
    print("  [Q] / ESC: Keluar Aplikasi")
    print("==================================================")

    last_time = time.time()
    fps = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARN] Gagal membaca frame dari webcam.")
            break

        # Hitung FPS
        now = time.time()
        dt = now - last_time
        last_time = now
        if dt > 0:
            fps = fps * 0.9 + (1.0 / dt) * 0.1

        # Proses frame dengan engine
        processed = engine.process_frame(frame)

        # Tambahkan HUD / Overlay Info
        status_text = f"AutoZoom: {'ON' if engine.enable_autozoom else 'OFF'} | MaxZoom: {engine.max_zoom:.1f}x | FPS: {fps:.1f}"
        cv2.putText(processed, status_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 128), 2)
        cv2.putText(processed, "[SPACE]: Toggle AutoZoom  [D]: Debug  [Q]: Quit", (20, processed.shape[0] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        cv2.imshow("Smart Auto-Zoom & Auto-Centering Camera", processed)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:  # ESC
            break
        elif key == ord(' '):
            engine.enable_autozoom = not engine.enable_autozoom
            print(f"[STATUS] Auto-Zoom: {'AKTIF' if engine.enable_autozoom else 'NONAKTIF'}")
        elif key == ord('d') or key == ord('D'):
            engine.debug_mode = not engine.debug_mode
            print(f"[STATUS] Debug Mode: {'AKTIF' if engine.debug_mode else 'NONAKTIF'}")
        elif key in [ord('+'), ord('=')]:
            engine.max_zoom = min(4.0, engine.max_zoom + 0.2)
            print(f"[STATUS] Max Zoom: {engine.max_zoom:.1f}x")
        elif key in [ord('-'), ord('_')]:
            engine.max_zoom = max(1.0, engine.max_zoom - 0.2)
            print(f"[STATUS] Max Zoom: {engine.max_zoom:.1f}x")

    cap.release()
    cv2.destroyAllWindows()
    engine.face_tracker.close()


if __name__ == "__main__":
    main()
