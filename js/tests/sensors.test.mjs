import test from "node:test";
import assert from "node:assert/strict";

await import("../sensors.js");
const Sensors = globalThis.SensorTelemetry;

function weatherModelsPayload(overrides = {}) {
  return Object.assign({
    schema: "sucha.weather-model-dashboard.v1",
    generated_at: "2026-08-31T16:36:30+07:00",
    status: "READY_FORECAST_ONLY",
    forecast_only: true,
    station_truth_available: false,
    output_control_allowed: false,
    safety: { mode: "DATA_ONLY", control_contract: "SAFE_OFF" },
    freshness: {
      latest_issued_at: "2026-08-31T14:13:52+07:00",
      first_valid_at: "2026-08-31T17:00:00+07:00",
      last_valid_at: "2026-09-01T16:00:00+07:00",
      models: 10
    },
    consensus: {
      rain_24h_mm: { median: "1.2", min: "0", max: "6.5", models: 10 },
      wet_model_count: 9,
      rain_model_count: 10,
      next_hour_temperature_c: { median: "28.9", min: "26.1", max: "31.8", models: 10 },
      next_hour_wind_kmh: { median: "13.8", min: "10.9", max: "33.5", models: 10 }
    },
    models: Array.from({ length: 10 }, (_, index) => ({
      id: "model_" + index,
      name: index === 0 ? "ECMWF IFS" : "MODEL " + index,
      region: "ทดสอบ",
      issued_at: "2026-08-31T14:13:52+07:00",
      hours: 24,
      rain_24h_mm: index === 1 ? null : index / 2,
      rain_probability_max_percent: index === 1 ? null : index * 10,
      temperature_mean_c: 27 + index / 10,
      next_hour: {
        valid_at: "2026-08-31T17:00:00+07:00",
        temperature_c: 28 + index / 10,
        humidity_percent: 70,
        rain_mm: 0,
        wind_kmh: 10
      }
    })),
    rain_windows: [{
      start_at: "2026-08-31T17:00:00+07:00",
      end_at_exclusive: "2026-08-31T20:00:00+07:00",
      hours: 3,
      trigger: "AT_LEAST_2_MODELS_WITH_0P2_MM_PER_HOUR",
      agreement: { wet_models: 4, rain_models: 10, peak_wet_models: 4 },
      rain_total_mm: {
        all_models: { median: 0.3, min: 0, max: 6.7, models: 10 },
        wet_models_only: { median: 1.5, min: 0.4, max: 6.7, models: 4 }
      }
    }],
    caveats: ["เป็นค่าพยากรณ์ ไม่ใช่ค่าตรวจวัดจากสถานีจริง"]
  }, overrides);
}

test("frontend rejects responses that are not explicitly read-only", () => {
  assert.throws(
    () => Sensors.normalizeCurrentResponse({ output_control_allowed: true }),
    /อ่านอย่างเดียว/
  );
});

test("frontend normalizes numeric telemetry", () => {
  const out = Sensors.normalizeCurrentResponse({
    output_control_allowed: false,
    status: "GOOD",
    age_s: 12.5,
    current: { observed_ts: 1000, depth_m: "0.577", volume_m3: "104.9", capacity_percent: "13.1" }
  });
  assert.equal(out.status, "GOOD");
  assert.equal(out.current.depth_m, 0.577);
  assert.equal(out.current.volume_m3, 104.9);
});

test("water balance requires the complete DATA_ONLY SAFE_OFF contract", () => {
  assert.throws(
    () => Sensors.normalizeWaterBalanceResponse({ output_control_allowed: false, safety: { mode: "DATA_ONLY" } }),
    /DATA ONLY \/ SAFE_OFF/
  );
  assert.throws(
    () => Sensors.normalizeWaterBalanceResponse({
      output_control_allowed: true,
      safety: { output_control_allowed: true, mode: "DATA_ONLY", control_contract: "SAFE_OFF" }
    }),
    /DATA ONLY \/ SAFE_OFF/
  );
});

test("water balance preserves verified values and GOOD-only chart fields", () => {
  const out = Sensors.normalizeWaterBalanceResponse({
    schema: "sucha.water-balance.v1",
    output_control_allowed: false,
    safety: { output_control_allowed: false, mode: "DATA_ONLY", control_contract: "SAFE_OFF" },
    status: "REFILLING",
    status_label: "ตรวจพบช่วงเติมน้ำต่อเนื่อง",
    current: { observed_at: "2026-08-30T12:19:59+07:00", quality: "GOOD", depth_m: "0.945", volume_m3: "171.8" },
    reference: { pump_rate_m3_h: "30.737", pump_rate_l_min: "512.3" },
    main_60m: {
      net_rate_m3_h: "22.474", regression_rate_m3_h: "22.403",
      net_loss_m3_h: "8.263", net_loss_l_min: "137.7",
      calculation_mode: "CONSTANT_PUMP_MINUS_NET_GAIN"
    },
    active_refill: { inferred_total_loss_m3: "17.376", loss_share_percent: "15", start: "2026-08-30T08:33:59+07:00" },
    trend_30m_every_15m: [
      { time: "2026-08-30T12:02:59+07:00", quality: "GOOD", mean_depth_m: "0.8819", end_volume_m3: "165.5", inferred_loss_l_h: "8806" }
    ],
    quality: { status: "GOOD", coverage: "0.984", max_gap_s: "60" }
  });
  assert.equal(out.reference.pump_rate_m3_h, 30.737);
  assert.equal(out.main60m.net_rate_m3_h, 22.474);
  assert.equal(out.main60m.net_loss_m3_h, 8.263);
  assert.equal(out.activeRefill.inferred_total_loss_m3, 17.376);
  assert.equal(out.trend[0].inferred_loss_l_h, 8806);
  assert.equal(out.quality.status, "GOOD");
});

test("history parsing preserves faults and converts finite values", () => {
  const rows = Sensors.historyRows([
    { observed_at: "2026-08-26T00:00:00Z", quality: "GOOD", volume_m3: "100.5" },
    { observed_at: "2026-08-26T00:05:00Z", quality: "SENSOR_FAULT", volume_m3: null }
  ]);
  assert.equal(rows[0].volume_m3, 100.5);
  assert.equal(rows[1].volume_m3, null);
});

test("Pi Health responses must remain explicitly read-only", () => {
  assert.throws(
    () => Sensors.normalizePiHealthResponse({ output_control_allowed: true }),
    /อ่านอย่างเดียว/
  );
  const sources = Sensors.normalizePiHealthResponse({
    output_control_allowed: false,
    sources: {
      PI5_CONTROLLER_01: {
        status: "GOOD",
        samples_24h: 20,
        current: { temp_c: "57.5", load1: "0.12", age_s: 8, uptime_s: 1000 }
      }
    }
  });
  assert.equal(sources.PI5_CONTROLLER_01.current.temp_c, 57.5);
  assert.equal(sources.PI5_CONTROLLER_01.current.load1, 0.12);
  assert.equal(sources.PI_ZERO_GATEWAY_01.status, "NO_DATA");
});

test("Pi Health history keeps source identity and finite chart values", () => {
  const history = Sensors.normalizePiHealthHistory({
    output_control_allowed: false,
    sources: {
      PI_ZERO_GATEWAY_01: [
        { observed_at: "2026-08-27T00:00:00Z", observed_epoch: "1000", quality: "GOOD", temp_c: "44.5", load1: "0.05" }
      ]
    }
  });
  assert.equal(history.PI_ZERO_GATEWAY_01[0].temp_c, 44.5);
  assert.equal(history.PI_ZERO_GATEWAY_01[0].load1, 0.05);
  assert.deepEqual(history.PI5_CONTROLLER_01, []);
});

test("downsample keeps endpoints and target size", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ i }));
  const sampled = Sensors.downsample(rows, 10);
  assert.equal(sampled.length, 10);
  assert.equal(sampled[0].i, 0);
  assert.equal(sampled.at(-1).i, 99);
});

test("status labels distinguish stale and sensor faults", () => {
  assert.equal(Sensors.statusMeta("STALE").cls, "stale");
  assert.equal(Sensors.statusMeta("SENSOR_FAULT").cls, "fault");
});

test("dashboard refreshes once a minute only while its visible sensor view is open", () => {
  assert.equal(Sensors.AUTO_REFRESH_MS, 60_000);
  assert.equal(Sensors.WEATHER_REFRESH_MS, 30 * 60_000);
  assert.equal(Sensors.shouldAutoRefresh("iot", false), true);
  assert.equal(Sensors.shouldAutoRefresh("iot", true), false);
  assert.equal(Sensors.shouldAutoRefresh("home", false), false);
});

test("weather forecast normalization keeps finite current and daily values", () => {
  const out = Sensors.normalizeWeatherForecast({
    timezone: "Asia/Bangkok",
    current: {
      time: "2026-08-30T15:00",
      temperature_2m: "31.4",
      relative_humidity_2m: "72",
      precipitation: "0.2",
      weather_code: 61,
      wind_speed_10m: "8.5"
    },
    daily: {
      time: ["2026-08-30", "2026-08-31"],
      weather_code: [61, 3],
      temperature_2m_max: [33.2, 32.4],
      temperature_2m_min: [24.1, 24.5],
      precipitation_sum: [8.4, 1.2],
      precipitation_probability_max: [80, 35]
    }
  });
  assert.equal(out.current.temperatureC, 31.4);
  assert.equal(out.current.windKmh, 8.5);
  assert.equal(out.days[0].precipitationProbability, 80);
  assert.equal(out.days[1].temperatureMaxC, 32.4);
  assert.deepEqual(Sensors.weatherCodeInfo(61), ["ฝนเล็กน้อย", "🌧️"]);
});

test("weather forecast rejects incomplete provider payloads", () => {
  assert.throws(() => Sensors.normalizeWeatherForecast({ current: {}, daily: {} }), /ข้อมูลพยากรณ์อากาศไม่ครบ/);
});

test("weather uses configured farm GPS and calls Open-Meteo with GET only", async () => {
  globalThis.FarmUltimateWeatherLocation = { lat: 13.75, lng: 100.5, name: "ฟาร์มทดสอบ" };
  Sensors.state.weather.loadedAt = 0;
  Sensors.state.weather.locationKey = "";
  Sensors.state.weather.data = null;
  let requestedUrl = "";
  let requestedOptions = null;
  const fetchMock = async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return {
      ok: true,
      json: async () => ({
        timezone: "Asia/Bangkok",
        current: {
          time: "2026-08-30T15:00", temperature_2m: 31.4, relative_humidity_2m: 72,
          precipitation: 0.2, weather_code: 61, wind_speed_10m: 8.5
        },
        daily: {
          time: ["2026-08-30"], weather_code: [61], temperature_2m_max: [33.2],
          temperature_2m_min: [24.1], precipitation_sum: [8.4], precipitation_probability_max: [80]
        }
      })
    };
  };
  await Sensors.refreshWeather(true, fetchMock);
  const url = new URL(requestedUrl);
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.pathname, "/v1/forecast");
  assert.equal(url.searchParams.get("timezone"), "Asia/Bangkok");
  assert.equal(url.searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(requestedOptions.method, "GET");
  assert.equal(Sensors.state.weather.locationName, "ฟาร์มทดสอบ");
  const html = Sensors.weatherHtml();
  assert.match(html, /พยากรณ์อากาศ/);
  assert.match(html, /Open‑Meteo · GET ONLY/);
  assert.match(html, /31\.4°C/);
  assert.match(html, /ฝน 80/);
  assert.doesNotMatch(html, /เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/);
  delete globalThis.FarmUltimateWeatherLocation;
  Sensors.state.weather.loadedAt = 0;
  Sensors.state.weather.locationKey = "";
  Sensors.state.weather.locationName = "";
  Sensors.state.weather.data = null;
  Sensors.state.weather.error = "";
});

test("weather shows an explicit setup state instead of guessing a location", async () => {
  delete globalThis.FarmUltimateWeatherLocation;
  Sensors.state.weather.loadedAt = 0;
  Sensors.state.weather.locationKey = "";
  Sensors.state.weather.data = null;
  await Sensors.refreshWeather(true, async () => { throw new Error("must not fetch"); });
  assert.match(Sensors.state.weather.error, /ยังไม่มีพิกัด GPS/);
  const html = Sensors.weatherHtml();
  assert.match(html, /กรุณาตั้งพิกัดในข้อมูลแปลง/);
  assert.match(html, /ยังไม่พร้อม/);
  Sensors.state.weather.error = "";
});

test("multi-model forecast requires forecast-only DATA_ONLY SAFE_OFF data", () => {
  assert.throws(
    () => Sensors.normalizeWeatherModelsSnapshot(weatherModelsPayload({ output_control_allowed: true })),
    /DATA ONLY \/ SAFE_OFF/
  );
  assert.throws(
    () => Sensors.normalizeWeatherModelsSnapshot(weatherModelsPayload({ station_truth_available: true })),
    /ข้อมูลพยากรณ์หลายโมเดลไม่ครบ/
  );
});

test("multi-model forecast preserves null provider fields instead of inventing zero", () => {
  const out = Sensors.normalizeWeatherModelsSnapshot(weatherModelsPayload());
  assert.equal(out.models.length, 10);
  assert.equal(out.models[1].rain24hMm, null);
  assert.equal(out.models[1].rainProbabilityMaxPercent, null);
  assert.equal(out.consensus.rain24hMm.median, 1.2);
  assert.equal(out.stationTruthAvailable, false);
  assert.equal(out.rainWindows[0].agreement.wetModels, 4);
  assert.equal(out.rainWindows[0].rainTotalMm.wetModelsOnly.median, 1.5);
  assert.equal(out.rainWindows[0].rainTotalMm.allModels.max, 6.7);
});

test("forecast rain window label renders the local date and exclusive end time", () => {
  const label = Sensors.forecastWindowLabel("2026-08-31T17:00:00+07:00", "2026-08-31T20:00:00+07:00");
  assert.match(label, /31 ส\.ค\./);
  assert.match(label, /17:00–20:00/);
});

test("dashboard loads and renders 10-model snapshot with GET only and no accuracy claim", async () => {
  Sensors.state.weatherModels.loadedAt = 0;
  Sensors.state.weatherModels.data = null;
  Sensors.state.weatherModels.error = "";
  let requestedUrl = "";
  let requestedOptions = null;
  await Sensors.refreshWeatherModels(true, async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return { ok: true, json: async () => weatherModelsPayload() };
  });
  assert.match(requestedUrl, /^data\/weather-models\.json\?v=/);
  assert.equal(requestedOptions.method, "GET");
  assert.equal(requestedOptions.cache, "no-store");
  const html = Sensors.weatherModelsHtml();
  assert.match(html, /พยากรณ์หลายโมเดล/);
  assert.match(html, /10 โมเดล · FORECAST ONLY/);
  assert.match(html, /ยังไม่จัดอันดับความแม่น/);
  assert.match(html, /ช่วงเวลาที่ฝนอาจเกิด/);
  assert.match(html, /4\/10 โมเดลคาดว่ามีฝน/);
  assert.match(html, /ถ้าฝนเกิด/);
  assert.match(html, /1\.5/);
  assert.match(html, /0\.4–6\.7 มม\./);
  assert.match(html, /OPEN‑METEO · GET ONLY/);
  assert.match(html, /FarmConnect พักไว้ก่อน/);
  assert.doesNotMatch(html, /แม่นที่สุด|เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/);
  Sensors.state.weatherModels.loadedAt = 0;
  Sensors.state.weatherModels.data = null;
  Sensors.state.weatherModels.error = "";
});

test("forecast rain window shows an explicit no-consensus state", () => {
  Sensors.state.weatherModels.data = Sensors.normalizeWeatherModelsSnapshot(weatherModelsPayload({ rain_windows: [] }));
  const html = Sensors.weatherModelsHtml();
  assert.match(html, /ยังไม่มีอย่างน้อย 2 โมเดลเห็นตรงกัน/);
  Sensors.state.weatherModels.data = null;
});

test("out-of-range status explains low and high sensor signals", () => {
  assert.equal(
    Sensors.statusMeta("OUT_OF_RANGE", 3.97).label,
    "ระดับน้ำต่ำกว่าจุดต่ำสุดที่ใช้งานได้"
  );
  assert.equal(Sensors.statusMeta("OUT_OF_RANGE", 20.01).label, "สัญญาณสูงกว่าช่วงวัด");
  assert.equal(Sensors.statusMeta("OUT_OF_RANGE", null).label, "ค่านอกช่วงตรวจวัด");
});

test("reservoir artwork follows trusted capacity in seven calibrated visual levels", () => {
  const levels = [
    Sensors.reservoirVisualState({ capacity_percent: 1 }, "GOOD"),
    Sensors.reservoirVisualState({ capacity_percent: 13.1 }, "GOOD"),
    Sensors.reservoirVisualState({ capacity_percent: 24 }, "GOOD"),
    Sensors.reservoirVisualState({ capacity_percent: 51 }, "GOOD"),
    Sensors.reservoirVisualState({ capacity_percent: 74 }, "GOOD"),
    Sensors.reservoirVisualState({ capacity_percent: 91 }, "STALE"),
    Sensors.reservoirVisualState({ capacity_percent: 118 }, "GOOD")
  ];
  assert.deepEqual(levels.map(item => item.band), [0, 10, 25, 50, 75, 100, 120]);
  assert.match(levels[1].image, /reservoir-level-010-v1\.png$/);
  const medium = levels[3];
  const high = levels[5];
  const overfull = levels[6];
  assert.match(medium.image, /reservoir-level-050-v1\.png$/);
  assert.equal(high.className, "is-stale");
  assert.match(overfull.image, /reservoir-level-120-v1\.png$/);
  assert.match(overfull.className, /is-high-water/);
});

test("fault telemetry never presents an invented zero-water image", () => {
  const visual = Sensors.reservoirVisualState({ capacity_percent: null }, "OUT_OF_RANGE");
  assert.equal(visual.known, false);
  assert.equal(visual.band, null);
  assert.match(visual.image, /main-reservoir-isometric-v1\.png$/);
  assert.equal(visual.label, "ยังไม่พร้อม");
});

test("digital twin surface remains telemetry-only", () => {
  const html = Sensors.cardHtml();
  assert.match(html, /sensor-digital-twin/);
  assert.match(html, /กลับหน้าหลัก/);
  assert.match(html, /App\.nav\('home'\)/);
  assert.match(html, /DATA ONLY · SAFE_OFF/);
  assert.match(html, /data-water-band=/);
  assert.match(html, /ระดับในภาพ/);
  assert.doesNotMatch(html, /เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/);
});

test("local Pi Health panel has telemetry and no actuator actions", () => {
  globalThis.FarmUltimateRuntime = { hasLocalPiHealth: true };
  const html = Sensors.piHealthHtml();
  assert.match(html, /Pi Health/);
  assert.match(html, /Raspberry Pi 5/);
  assert.match(html, /Raspberry Pi Zero/);
  assert.match(html, /อ่านอย่างเดียว/);
  assert.doesNotMatch(html, /เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/);
  delete globalThis.FarmUltimateRuntime;
});

test("graphical reservoir renders live Pi 5 water balance without actuator actions", () => {
  globalThis.FarmUltimateRuntime = {
    hasLocalWaterBalance: true,
    waterBalanceSource: "PI5_LIVE_GET_ONLY"
  };
  Sensors.state.waterBalance.data = Sensors.normalizeWaterBalanceResponse({
    schema: "sucha.water-balance.v1",
    output_control_allowed: false,
    safety: { output_control_allowed: false, mode: "DATA_ONLY", control_contract: "SAFE_OFF" },
    status: "REFILLING",
    status_label: "ตรวจพบช่วงเติมน้ำต่อเนื่อง",
    current: { observed_at: "2026-08-30T12:19:59+07:00", quality: "GOOD" },
    reference: { pump_rate_m3_h: 30.737, pump_rate_l_min: 512.3 },
    main_60m: {
      net_rate_m3_h: 22.474, regression_rate_m3_h: 22.403,
      net_loss_m3_h: 8.263, net_loss_l_min: 137.7,
      calculation_mode: "CONSTANT_PUMP_MINUS_NET_GAIN"
    },
    active_refill: { inferred_total_loss_m3: 17.376, loss_share_percent: 15 },
    trend_30m_every_15m: [],
    quality: { status: "GOOD", coverage: 0.984, max_gap_s: 60 }
  });
  const html = Sensors.waterBalanceHtml();
  assert.match(html, /สมดุลน้ำในสระ/);
  assert.match(html, /30\.7/);
  assert.match(html, /22\.474/);
  assert.match(html, /8\.263/);
  assert.match(html, /17\.376/);
  assert.match(html, /PI 5 LIVE · DATA ONLY/);
  assert.doesNotMatch(html, /เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/);
  Sensors.state.waterBalance.data = null;
  delete globalThis.FarmUltimateRuntime;
});

test("owner canary health must explicitly confirm read-only mode", async () => {
  globalThis.FarmUltimateRuntime = { isOwnerCanary: true };
  globalThis.authCall = async () => ({
    ok: true,
    data: { mode: "SENSOR_PHASE1_READ_ONLY", output_control_allowed: false }
  });
  Sensors.state.backendCheckedAt = 0;
  assert.equal(await Sensors.probeSafeBackend(true), true);
  assert.equal(Sensors.state.backendStatus, "ONLINE_SAFE_OFF");

  globalThis.authCall = async () => ({
    ok: true,
    data: { mode: "SENSOR_PHASE1_READ_ONLY", output_control_allowed: true }
  });
  Sensors.state.backendCheckedAt = 0;
  assert.equal(await Sensors.probeSafeBackend(true), false);
  assert.equal(Sensors.state.backendStatus, "ERROR");
  delete globalThis.authCall;
  delete globalThis.FarmUltimateRuntime;
});
