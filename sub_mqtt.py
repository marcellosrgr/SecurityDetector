import sys
import time
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("[ERROR] Library 'paho-mqtt' belum terinstall.")
    print("Silakan install dengan perintah: pip install paho-mqtt")
    sys.exit(1)

BROKER = "broker.emqx.io"
PORT = 1883

# Daftar topik yang di-subscribe (AutoZoom + NoiseDetector + Drowsiness)
TOPICS = [
    ("autozoom/buzzer", 0),
    ("noisedetector/buzzer", 0),
    ("autozoom/drowsy", 0)
]

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [OK] BERHASIL TERHUBUNG ke Broker {BROKER}:{PORT}")
        print("=" * 65)
        print(" [INFO] Berhasil SUBSCRIBE ke topik:")
        print("   1. autozoom/buzzer       (Kamera AI / Wajah)")
        print("   2. noisedetector/buzzer  (Sensor Suara / Kebisingan)")
        print("   3. autozoom/drowsy       (Deteksi Kantuk / Drowsiness)")
        print("=" * 65)
        print(" Menunggu kiriman data dari Web / Python...")
        print(" (Tekan Ctrl+C untuk berhenti)")
        print("=" * 65)
        
        # Subscribe ke multiple topics sekaligus
        client.subscribe(TOPICS)
    else:
        print(f"[FAIL] Gagal terhubung ke broker, kode error (rc): {rc}")

def on_message(client, userdata, msg):
    timestamp = datetime.now().strftime("%H:%M:%S")
    payload = msg.payload.decode("utf-8", errors="ignore")
    topic = msg.topic
    
    # Label keterangan status
    if topic == "autozoom/drowsy":
        if payload == "DROWSY_ALERT":
            indicator = "🚨 [AWAS MENGANTUK!] Mata terpejam / kepala menunduk lama -> STROBO ALARM ON"
        else:
            indicator = "✅ [MELEK KEMBALI] Pengguna terjaga -> ALARM OFF"
    elif topic == "noisedetector/buzzer":
        if payload in ["BEEP_ON", "NOISE_ALERT", "ALARM_ON"]:
            indicator = "🚨 [SUARA BISING!] Kebisingan melebihi ambang batas -> TRIGGER ON"
        elif payload in ["BEEP_OFF", "ALARM_OFF"]:
            indicator = "✅ [SUARA NORMAL] Kebisingan aman -> TRIGGER OFF"
        else:
            indicator = f"📦 {payload}"
    elif topic == "autozoom/buzzer":
        if payload == "BEEP_ON":
            indicator = "👤 [WAJAH TERDETEKSI] Kamera mengunci subjek -> TRIGGER ON"
        elif payload == "BEEP_OFF":
            indicator = "🌑 [TIDAK ADA WAJAH] Area kosong -> TRIGGER OFF"
        else:
            indicator = f"📦 {payload}"
    else:
        indicator = f"📦 {payload}"

    print(f"[{timestamp}] [{topic}] -> {indicator}")

def main():
    print("=" * 65)
    print("   📡 Multi-System MQTT Subscriber (AutoZoom & NoiseDetector)")
    print("=" * 65)
    print(f"Target Broker : {BROKER}:{PORT}")
    print("Topik Aktif   : autozoom/buzzer & noisedetector/buzzer")
    print("-----------------------------------------------------------------")

    # Inisialisasi client kompatibel paho-mqtt v1 dan v2
    if hasattr(mqtt, 'CallbackAPIVersion'):
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    else:
        client = mqtt.Client()

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        print(f"Menghubungkan ke {BROKER}:{PORT}...")
        client.connect(BROKER, PORT, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Subscriber dihentikan.")
    except Exception as e:
        print(f"\n[ERROR] Terjadi kesalahan koneksi: {e}")

if __name__ == "__main__":
    main()
