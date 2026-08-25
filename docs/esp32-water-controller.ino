/* ============================================================
   FARMULTIMATE SOLUTIONS — ESP32 Water Valve Controller
   ============================================================
   หน้าที่: ดึงคำสั่งเปิด/ปิดวาล์วจากเซิร์ฟเวอร์ทุก ~10 วินาที
            แล้วสั่งรีเลย์ตาม (เซิร์ฟเวอร์เป็นคนตัดสินใจตามตาราง+ฝน)

   อุปกรณ์: ESP32 DevKit + Relay Module (1-4 ช่อง)
   ต่อวาล์วโซลินอยด์/ปั๊มผ่านรีเลย์: GPIO 26, 27, 32, 33

   วิธีใช้:
   1) แก้ WIFI_SSID / WIFI_PASS / DEVICE_KEY ด้านล่าง
      (Device Key ได้จากเว็บ: เพิ่มเติม > ระบบน้ำอัตโนมัติ > เพิ่มอุปกรณ์)
   2) แก้ SYSTEM_ID ให้ตรงกับระบบน้ำในเว็บ (ดูในคอนโซล Serial)
   3) Flash ลง ESP32 ด้วย Arduino IDE (บอร์ด ESP32 Dev Module)

   หมายเหตุ: วาล์วจะปิดเองเมื่อเซิร์ฟเวอร์สั่ง (หมดเวลา/ฝนตก/สั่งจากแอป)
   ============================================================ */

#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID  = "ชื่อไวไฟที่แปลง";
const char* WIFI_PASS  = "รหัสไวไฟ";
const char* API        = "https://farmbackup.carfork123.workers.dev";
const char* DEVICE_KEY = "วาง-Device-Key-ตรงนี้";

// system_id ในเว็บ → GPIO รีเลย์ (แก้ให้ตรงระบบของคุณ)
struct Valve { const char* systemId; int pin; };
Valve VALVES[] = {
  { "วาง-system-id-แปลง-A", 26 },
  { "วาง-system-id-แปลง-B", 27 },
};
const int VALVE_COUNT = sizeof(VALVES) / sizeof(VALVES[0]);
const bool RELAY_ACTIVE_LOW = true;  // รีเลย์ส่วนใหญ่ active-low

unsigned long lastPoll = 0;
const unsigned long POLL_MS = 10000;

void setValve(int pin, bool on) {
  if (RELAY_ACTIVE_LOW) digitalWrite(pin, on ? LOW : HIGH);
  else digitalWrite(pin, on ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < VALVE_COUNT; i++) {
    pinMode(VALVES[i].pin, OUTPUT);
    setValve(VALVES[i].pin, false);  // ปิดก่อนเสมอ (fail-safe)
  }
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println(" connected: " + WiFi.localIP().toString());
}

void loop() {
  if (millis() - lastPoll < POLL_MS) { delay(50); return; }
  lastPoll = millis();

  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); return; }

  HTTPClient http;
  http.begin(API);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);
  String body = String("{\"action\":\"water_poll\",\"device_key\":\"") + DEVICE_KEY + "\"}";
  int code = http.POST(body);
  if (code == 200) {
    String res = http.getString();
    Serial.println("poll: " + res);
    // แยกคำสั่งง่าย ๆ จาก JSON: {"ok":true,"data":{"cmds":[{"system_id":"..","on":true},..]}}
    for (int i = 0; i < VALVE_COUNT; i++) {
      String sid = String("\"system_id\":\"") + VALVES[i].systemId + "\"";
      int p = res.indexOf(sid);
      if (p < 0) { setValve(VALVES[i].pin, false); continue; }
      int onPos = res.indexOf("\"on\":true", p);
      int nextSys = res.indexOf("\"system_id\"", p + sid.length());
      bool on = (onPos > 0 && (nextSys < 0 || onPos < nextSys));
      setValve(VALVES[i].pin, on);
      Serial.printf("valve[%s] -> %s\n", VALVES[i].systemId, on ? "ON" : "OFF");
    }
  } else {
    Serial.printf("poll HTTP %d — ปิดวาล์วทั้งหมด (fail-safe)\n", code);
    for (int i = 0; i < VALVE_COUNT; i++) setValve(VALVES[i].pin, false);
  }
  http.end();
}
