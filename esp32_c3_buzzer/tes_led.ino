// ==========================================
// PROGRAM DIAGNOSTIK & TES HARDWARE ESP32-C3
// ==========================================
// Program ini akan mengetes Pin 8 (LED Onboard) 
// dan mencetak status ke Serial Monitor.

#define TEST_PIN 8

void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(TEST_PIN, OUTPUT);
  Serial.println("\n=================================");
  Serial.println("  TES HARDWARE LED PIN 8 DIMULAI ");
  Serial.println("=================================");
}

void loop() {
  Serial.println(">> Mengirim sinyal HIGH ke Pin 8...");
  digitalWrite(TEST_PIN, HIGH);
  delay(1000);

  Serial.println(">> Mengirim sinyal LOW ke Pin 8...");
  digitalWrite(TEST_PIN, LOW);
  delay(1000);
}
