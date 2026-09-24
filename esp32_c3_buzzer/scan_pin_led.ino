// ==========================================================
// PROGRAM SCANNER PIN LED ESP32-C3 SUPER MINI
// ==========================================================
// Program ini akan menyalakan semua pin GPIO satu per satu (GPIO 0 sampai 10)
// untuk menemukan PIN LAMPU yang sebenarnya pada board Anda.

int pins[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
int numPins = sizeof(pins) / sizeof(pins[0]);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==============================================");
  Serial.println("  ESP32-C3 LED PIN SCANNER (MENCARI PIN LAMPU)");
  Serial.println("==============================================");

  // Set semua pin sebagai OUTPUT
  for (int i = 0; i < numPins; i++) {
    pinMode(pins[i], OUTPUT);
    digitalWrite(pins[i], HIGH); // default
  }
}

void loop() {
  for (int i = 0; i < numPins; i++) {
    int p = pins[i];
    Serial.print(">> Menguji GPIO ");
    Serial.print(p);
    Serial.println(" (Menyalakan LOW & HIGH)...");

    // Tes LOW (Active-LOW)
    digitalWrite(p, LOW);
    delay(600);

    // Tes HIGH (Active-HIGH)
    digitalWrite(p, HIGH);
    delay(600);
  }

  Serial.println("--- Selesai 1 Putaran Scan, Mengulang kembali... ---");
  delay(1000);
}
