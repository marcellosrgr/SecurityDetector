import cv2
import mediapipe as mp
import numpy as np
from collections import deque
from typing import Optional, Tuple, List


class FaceTracker:
    """
    Modul deteksi wajah menggunakan MediaPipe Face Detection
    dengan stabilisasi Moving Average untuk mencegah jittering.
    """
    def __init__(
        self,
        min_detection_confidence: float = 0.5,
        model_selection: int = 0,
        history_len: int = 5
    ):
        """
        Args:
            min_detection_confidence: Ambang batas keyakinan deteksi wajah (0.0 - 1.0).
            model_selection: 0 untuk kamera dekat (< 2m), 1 untuk jarak jauh (< 5m).
            history_len: Panjang antrean moving average untuk stabilisasi bounding box.
        """
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detector = self.mp_face_detection.FaceDetection(
            min_detection_confidence=min_detection_confidence,
            model_selection=model_selection
        )
        self.history_len = history_len
        # Deque menyimpan koordinat normalisasi [xmin, ymin, width, height]
        self.bbox_history: deque = deque(maxlen=history_len)

    def detect_primary_face(
        self,
        frame_rgb: np.ndarray,
        multi_face_mode: str = "largest"
    ) -> Optional[Tuple[float, float, float, float]]:
        """
        Mendeteksi wajah utama dalam frame RGB.

        Args:
            frame_rgb: Citra frame dalam format RGB.
            multi_face_mode: 'largest' (prioritas area terbesar) atau 'combined' (pusat gabungan).

        Returns:
            Tuple (xmin, ymin, width, height) yang dinormalisasi (0.0 - 1.0) dan telah distabilkan,
            atau None jika tidak ada wajah terdeteksi.
        """
        results = self.face_detector.process(frame_rgb)

        if not results.detections:
            return None

        detections = results.detections

        if multi_face_mode == "largest" or len(detections) == 1:
            # Cari wajah dengan bounding box area terbesar
            best_det = max(
                detections,
                key=lambda d: d.location_data.relative_bounding_box.width * d.location_data.relative_bounding_box.height
            )
            r_box = best_det.location_data.relative_bounding_box
            raw_box = (r_box.xmin, r_box.ymin, r_box.width, r_box.height)
        else:
            # Mode 'combined': hitung bounding box gabungan yang mencakup semua wajah
            min_x = min(d.location_data.relative_bounding_box.xmin for d in detections)
            min_y = min(d.location_data.relative_bounding_box.ymin for d in detections)
            max_x = max(d.location_data.relative_bounding_box.xmin + d.location_data.relative_bounding_box.width for d in detections)
            max_y = max(d.location_data.relative_bounding_box.ymin + d.location_data.relative_bounding_box.height for d in detections)
            
            # Clip batas normalisasi
            min_x = max(0.0, min_x)
            min_y = max(0.0, min_y)
            width = min(1.0 - min_x, max_x - min_x)
            height = min(1.0 - min_y, max_y - min_y)
            raw_box = (min_x, min_y, width, height)

        # Terapkan Moving Average Smoothing untuk meredam jitter
        self.bbox_history.append(raw_box)
        avg_box = np.mean(self.bbox_history, axis=0)
        
        return (float(avg_box[0]), float(avg_box[1]), float(avg_box[2]), float(avg_box[3]))

    def reset_history(self):
        """Mereset history moving average (misal saat wajah hilang)."""
        self.bbox_history.clear()

    def close(self):
        """Membersihkan resource MediaPipe."""
        if hasattr(self, 'face_detector') and self.face_detector is not None:
            self.face_detector.close()
