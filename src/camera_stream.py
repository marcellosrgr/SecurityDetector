import cv2
import time
import numpy as np
from typing import Tuple, Optional
from .face_tracker import FaceTracker


def lerp(current: float, target: float, factor: float) -> float:
    """Linear Interpolation (LERP) helper."""
    return current + (target - current) * factor


class SmartZoomEngine:
    """
    Engine untuk Digital Cropping cerdas dan interpolasi LERP halus
    menyerupai kamera sinematik PTZ.
    """
    def __init__(
        self,
        max_zoom: float = 3.5,
        lerp_factor: float = 0.09,
        head_padding: float = 1.3,
        grace_period_sec: float = 2.0,
        enable_autozoom: bool = True,
        debug_mode: bool = False
    ):
        """
        Args:
            max_zoom: Batas maksimal perbesaran digital (1.0x - 4.0x).
            lerp_factor: Kecepatan transisi LERP (0.01 lambat/halus - 0.3 cepat).
            head_padding: Faktor margin/padding di sekitar kepala (1.5x - 2.5x).
            grace_period_sec: Waktu tunggu (detik) sebelum kamera kembali full-wide jika wajah hilang.
            enable_autozoom: Status aktif/nonaktif auto-zoom.
            debug_mode: Apakah overlay visual bounding box diaktifkan.
        """
        self.face_tracker = FaceTracker()
        self.max_zoom = max_zoom
        self.lerp_factor = lerp_factor
        self.head_padding = head_padding
        self.grace_period_sec = grace_period_sec
        self.enable_autozoom = enable_autozoom
        self.debug_mode = debug_mode

        # State bounding box crop saat ini (dinormalisasi 0.0 - 1.0): [x, y, w, h]
        # Inisialisasi awal pada full-frame (0, 0, 1, 1)
        self.current_crop = [0.0, 0.0, 1.0, 1.0]

        # Timestamp saat terakhir kali wajah terdeteksi
        self.last_face_seen_time = time.time()

    def process_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """
        Memproses 1 frame: mendeteksi wajah, menghitung target crop, 
        melakukan LERP transisi, memotong & meresize kembali ke resolusi asli.
        """
        h_orig, w_orig = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        
        # 1. Deteksi Wajah
        face_norm_box = self.face_tracker.detect_primary_face(frame_rgb)
        current_time = time.time()

        # 2. Tentukan Target Crop Box (x_target, y_target, w_target, h_target)
        if face_norm_box is not None and self.enable_autozoom:
            self.last_face_seen_time = current_time
            fx, fy, fw, fh = face_norm_box
            
            # Hitung titik tengah wajah
            face_center_x = fx + fw / 2.0
            face_center_y = fy + fh / 2.0

            # Ukuran crop yang diinginkan berdasarkan padding kepala
            # Aspek rasio harus cocok dengan rasio frame kamera asli
            aspect_ratio = w_orig / h_orig
            
            target_crop_h = max(fh * self.head_padding, 0.15)
            target_crop_w = target_crop_h * aspect_ratio

            # Jika target crop w masih lebih kecil dari bounding box wajah + padding w
            if target_crop_w < (fw * self.head_padding):
                target_crop_w = fw * self.head_padding
                target_crop_h = target_crop_w / aspect_ratio

            # Batasi berdasarkan max_zoom
            # Min crop size = 1.0 / max_zoom
            min_crop_w = 1.0 / max(1.0, self.max_zoom)
            min_crop_h = min_crop_w / aspect_ratio

            target_crop_w = max(target_crop_w, min_crop_w)
            target_crop_h = max(target_crop_h, min_crop_h)

            # Batasi agar tidak melebihi 1.0 (full frame)
            target_crop_w = min(1.0, target_crop_w)
            target_crop_h = min(1.0, target_crop_h)

            # Hitung koordinat top-left target crop dengan centering wajah
            target_x = face_center_x - target_crop_w / 2.0
            target_y = face_center_y - target_crop_h / 2.0

            # Batasi agar crop box selalu berada di dalam frame (0 <= x, y <= 1 - size)
            target_x = max(0.0, min(1.0 - target_crop_w, target_x))
            target_y = max(0.0, min(1.0 - target_crop_h, target_y))

            target_crop = [target_x, target_y, target_crop_w, target_crop_h]
        else:
            # Jika wajah tidak terdeteksi atau autozoom dimatikan
            if not self.enable_autozoom or (current_time - self.last_face_seen_time > self.grace_period_sec):
                # Reset perlahan ke full frame
                target_crop = [0.0, 0.0, 1.0, 1.0]
                if face_norm_box is None:
                    self.face_tracker.reset_history()
            else:
                # Masih dalam masa toleransi (grace period), pertahankan target crop terakhir
                target_crop = self.current_crop

        # 3. Smooth Interpolation (LERP) dari current_crop ke target_crop
        for i in range(4):
            self.current_crop[i] = lerp(self.current_crop[i], target_crop[i], self.lerp_factor)

        # 4. Gambar visual debugging (jika diaktifkan) sebelum frame di-crop
        debug_frame = frame_bgr.copy()
        if self.debug_mode:
            # Gambar bounding box wajah asli (Hijau)
            if face_norm_box is not None:
                fx, fy, fw, fh = face_norm_box
                x1, y1 = int(fx * w_orig), int(fy * h_orig)
                x2, y2 = int((fx + fw) * w_orig), int((fy + fh) * h_orig)
                cv2.rectangle(debug_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(debug_frame, "Face Tracked", (x1, max(20, y1 - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)

            # Gambar batas crop box saat ini (Kuning / Cyan)
            cx, cy, cw, ch = self.current_crop
            cx1, cy1 = int(cx * w_orig), int(cy * h_orig)
            cx2, cy2 = int((cx + cw) * w_orig), int((cy + ch) * h_orig)
            cv2.rectangle(debug_frame, (cx1, cy1), (cx2, cy2), (0, 220, 255), 2)
            cv2.putText(debug_frame, f"Crop Area ({1.0/cw:.1f}x Zoom)", (cx1 + 5, cy1 + 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 255), 2)
            
            frame_to_crop = debug_frame
        else:
            frame_to_crop = frame_bgr

        # 5. Lakukan Digital Crop & Rescale ke ukuran asli
        cx, cy, cw, ch = self.current_crop
        x1 = int(np.clip(cx * w_orig, 0, w_orig - 1))
        y1 = int(np.clip(cy * h_orig, 0, h_orig - 1))
        x2 = int(np.clip((cx + cw) * w_orig, x1 + 10, w_orig))
        y2 = int(np.clip((cy + ch) * h_orig, y1 + 10, h_orig))

        cropped = frame_to_crop[y1:y2, x1:x2]
        
        # Resize kembali ke ukuran frame awal (agar output tetap konsisten & tajam)
        output_frame = cv2.resize(cropped, (w_orig, h_orig), interpolation=cv2.INTER_LINEAR)
        return output_frame
