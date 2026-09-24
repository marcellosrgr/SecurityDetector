#include <WiFi.h>
#include <PubSubClient.h>

// ==========================================
// 1. KONFIGURASI WIFI & MQTT BROKER
// ==========================================
const char* ssid        = "STUDIO";         // SSID WiFi Anda
const char* password    = "Bait695mash215"; // Password WiFi Anda
const char* mqtt_server = "35.172.255.228"; // IP Langsung EMQX Broker (Bypass DNS)
const int   mqtt_port   = 1883;             // Port MQTT (TCP)

const char* TOPIC_AUTOZOOM = "autozoom/buzzer";
const char* TOPIC_NOISE    = "noisedetector/buzzer";
const char* TOPIC_DROWSY   = "autozoom/drowsy";

// ==========================================
// 2. KONFIGURASI ON-BOARD LED PIN 8 ESP32-C3
// ==========================================
#define LED_PIN 8

// Logika Polaritas LED ESP32-C3 Super Mini (Active-LOW):
// LOW = LAMPU MENYALA, HIGH = LAMPU MATI
#define LED_ON  LOW
#define LED_OFF HIGH

WiFiClient espClient;
PubSubClient client(espClient);

// Status pemicu
bool alert_autozoom = false;
bool alert_noise = false;
bool alert_drowsy = false;

unsigned long lastMqttReconnectAttempt = 0;

void setLed(bool state) {
  if (state) {
    digitalWrite(LED_PIN, LED_ON);  // Lampu MENYALA
  } else {
    digitalWrite(LED_PIN, LED_OFF); // Lampu PADAM
  }
}

// Update status lampu berdasarkan trigger sistem
void updateLedState() {
  if (alert_drowsy) {
    // Strobo Darurat (Alarm Mengantuk!)
    for (int i = 0; i < 3; i++) {
      setLed(true);
      delay(70);
      setLed(false);
      delay(70);
    }
    Serial.println(">> [ALARM KANTUK] 🚨 LAMPU STROBO CEPAT (WAKE UP!)");
  } else if (alert_autozoom || alert_noise) {
    setLed(true);
    Serial.println(">> [TRIGGER AKTIF] 💡 LAMPU MENYALA");
  } else {
    setLed(false);
    Serial.println(">> [TRIGGER MATI]  🌑 LAMPU PADAM");
  }
}

// ==========================================
// 3. CALLBACK PENERIMA PESAN MQTT
// ==========================================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("[PESAN MASUK] [");
  Serial.print(topic);
  Serial.print("] -> ");
  Serial.println(message);

  // A. Pemicu dari AutoZoom Camera
  if (String(topic) == TOPIC_AUTOZOOM) {
    if (message == "BEEP_ON") {
      alert_autozoom = true;  // Trigger Nyala
    } else if (message == "BEEP_OFF") {
      alert_autozoom = false; // Trigger Mati
    }
  }

  // B. Pemicu dari NoiseDetector
  if (String(topic) == TOPIC_NOISE) {
    if (message == "BEEP_ON" || message == "NOISE_ALERT" || message == "ALARM_ON") {
      alert_noise = true;  // Trigger Nyala
    } else if (message == "BEEP_OFF" || message == "NOISE_CLEAR" || message == "ALARM_OFF") {
      alert_noise = false; // Trigger Mati
    }
  }

  // C. Pemicu Deteksi Kantuk (Drowsiness)
  if (String(topic) == TOPIC_DROWSY) {
    if (message == "DROWSY_ALERT") {
      alert_drowsy = true;
    } else if (message == "DROWSY_CLEAR") {
      alert_drowsy = false;
    }
  }

  // Eksekusi perubahan nyala/mati lampu seketika
  updateLedState();
}

// ==========================================
// 4. KONEKSI WIFI & MQTT
// ==========================================
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("[WiFi] Menghubungkan ke: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Mode siaga penuh tanpa sleep
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(300);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✅ TERHUBUNG!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  }
}

bool connectMQTT() {
  Serial.print("[MQTT] Menghubungkan ke Broker... ");
  String clientId = "ESP32C3_Hub_" + String(random(0xffff), HEX);

  if (client.connect(clientId.c_str())) {
    Serial.println("✅ TERHUBUNG!");
    
    // Subscribe ke ketiga topik: AutoZoom, Noise, dan Drowsy
    client.subscribe(TOPIC_AUTOZOOM);
    client.subscribe(TOPIC_NOISE);
    client.subscribe(TOPIC_DROWSY);

    Serial.println("[MQTT] Subscribe aktif pada topik:");
    Serial.print("  1. "); Serial.println(TOPIC_AUTOZOOM);
    Serial.print("  2. "); Serial.println(TOPIC_NOISE);
    Serial.print("  3. "); Serial.println(TOPIC_DROWSY);
    
    // Pastikan lampu tetap padam setelah connect
    updateLedState();
    return true;
  } else {
    Serial.print("❌ Gagal, rc=");
    Serial.println(client.state());
    return false;
  }
}

// ==========================================
// 5. SETUP & MAIN LOOP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==========================================");
  Serial.println("  ESP32-C3 Real-Time Trigger Controller");
  Serial.println("==========================================");

  // Inisialisasi LED Pin 8
  pinMode(LED_PIN, OUTPUT);
  setLed(false); // Pastikan LED mati di awal

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setKeepAlive(15);
}

void loop() {
  // Cek WiFi
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
    return;
  }

  // Cek MQTT
  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastMqttReconnectAttempt > 3000) {
      lastMqttReconnectAttempt = now;
      connectMQTT();
    }
  } else {
    // Jalankan listener event real-time
    client.loop();
  }
}
