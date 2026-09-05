/* FARMULTIMATE Phase 1 — sensor telemetry UI (read-only, no actuator actions). */
(function (root) {
  "use strict";

  const SOURCE_ID = "MAIN_WATER_LEVEL_PI_ZERO_01";
  const AUTO_REFRESH_MS = 60 * 1000;
  const WEATHER_REFRESH_MS = 30 * 60 * 1000;
  const WEATHER_MODELS_REFRESH_MS = 5 * 60 * 1000;
  const RESERVOIR_VISUAL_LEVELS = Object.freeze([0, 10, 25, 50, 75, 100, 120]);
  let autoRefreshTimer = null;
  let localPreviewLoading = false;
  let localPreviewLoadedAt = 0;
  const state = {
    sourceId: SOURCE_ID,
    loading: false,
    error: "",
    current: null,
    status: "NO_DATA",
    ageS: null,
    history: [],
    hours: 24,
    loadedAt: 0,
    backendStatus: "IDLE",
    backendCheckedAt: 0,
    piHealth: {
      loading: false,
      error: "",
      loadedAt: 0,
      sources: {},
      history: {}
    },
    waterBalance: {
      loading: false,
      error: "",
      loadedAt: 0,
      data: null
    },
    weather: {
      loading: false,
      error: "",
      loadedAt: 0,
      locationKey: "",
      locationName: "",
      data: null
    },
    weatherModels: {
      loading: false,
      error: "",
      loadedAt: 0,
      data: null
    }
  };

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeCurrentResponse(data) {
    const d = data && typeof data === "object" ? data : {};
    if (d.output_control_allowed !== false) throw new Error("เซิร์ฟเวอร์ไม่ได้ยืนยันโหมดอ่านอย่างเดียว");
    const current = d.current && typeof d.current === "object" ? Object.assign({}, d.current) : null;
    if (current) {
      current.depth_m = finiteOrNull(current.depth_m);
      current.volume_m3 = finiteOrNull(current.volume_m3);
      current.capacity_percent = finiteOrNull(current.capacity_percent);
      current.current_ma = finiteOrNull(current.current_ma);
      current.observed_ts = finiteOrNull(current.observed_ts);
    }
    return {
      status: String(d.status || "NO_DATA").toUpperCase(),
      ageS: finiteOrNull(d.age_s),
      current
    };
  }

  function normalizeWaterBalanceResponse(data) {
    const d = data && typeof data === "object" ? data : {};
    const safety = d.safety && typeof d.safety === "object" ? d.safety : {};
    const safe = d.output_control_allowed === false &&
      safety.output_control_allowed === false &&
      safety.mode === "DATA_ONLY" && safety.control_contract === "SAFE_OFF";
    if (!safe) throw new Error("สมดุลน้ำไม่ได้ยืนยัน DATA ONLY / SAFE_OFF");
    const reference = d.reference && typeof d.reference === "object" ? d.reference : {};
    const main = d.main_60m && typeof d.main_60m === "object" ? d.main_60m : {};
    const refill = d.active_refill && typeof d.active_refill === "object" ? d.active_refill : null;
    const quality = d.quality && typeof d.quality === "object" ? d.quality : {};
    const current = d.current && typeof d.current === "object" ? d.current : null;
    return {
      schema: String(d.schema || ""),
      status: String(d.status || "UNAVAILABLE").toUpperCase(),
      statusLabel: String(d.status_label || "ไม่พร้อมคำนวณ"),
      current: current ? {
        observed_at: String(current.observed_at || ""),
        quality: String(current.quality || ""),
        depth_m: finiteOrNull(current.depth_m),
        volume_m3: finiteOrNull(current.volume_m3)
      } : null,
      reference: {
        pump_rate_m3_h: finiteOrNull(reference.pump_rate_m3_h),
        pump_rate_l_min: finiteOrNull(reference.pump_rate_l_min)
      },
      main60m: {
        net_rate_m3_h: finiteOrNull(main.net_rate_m3_h),
        regression_rate_m3_h: finiteOrNull(main.regression_rate_m3_h),
        net_loss_m3_h: finiteOrNull(main.net_loss_m3_h),
        net_loss_l_min: finiteOrNull(main.net_loss_l_min),
        calculation_mode: String(main.calculation_mode || "N/A")
      },
      activeRefill: refill ? {
        inferred_total_loss_m3: finiteOrNull(refill.inferred_total_loss_m3),
        loss_share_percent: finiteOrNull(refill.loss_share_percent),
        start: String(refill.start || "")
      } : null,
      trend: (Array.isArray(d.trend_30m_every_15m) ? d.trend_30m_every_15m : []).map(row => ({
        time: String(row && row.time || ""),
        quality: String(row && row.quality || ""),
        mean_depth_m: finiteOrNull(row && row.mean_depth_m),
        end_volume_m3: finiteOrNull(row && row.end_volume_m3),
        inferred_loss_l_h: finiteOrNull(row && row.inferred_loss_l_h)
      })),
      quality: {
        status: String(quality.status || "UNAVAILABLE").toUpperCase(),
        coverage: finiteOrNull(quality.coverage),
        max_gap_s: finiteOrNull(quality.max_gap_s)
      },
      caveats: Array.isArray(d.caveats) ? d.caveats.map(String) : []
    };
  }

  function statusMeta(status, currentMa) {
    const normalizedStatus = String(status || "").toUpperCase();
    const signal = finiteOrNull(currentMa);
    if (normalizedStatus === "OUT_OF_RANGE") {
      if (signal !== null && signal < 4) {
        return { label: "ระดับน้ำต่ำกว่าจุดต่ำสุดที่ใช้งานได้", cls: "fault" };
      }
      if (signal !== null && signal > 20) {
        return { label: "สัญญาณสูงกว่าช่วงวัด", cls: "fault" };
      }
    }
    const map = {
      GOOD: { label: "ข้อมูลปกติ", cls: "good" },
      STALE: { label: "ข้อมูลเก่า", cls: "stale" },
      DISCONNECTED: { label: "เซนเซอร์หลุด", cls: "fault" },
      OUT_OF_RANGE: { label: "ค่านอกช่วงตรวจวัด", cls: "fault" },
      SENSOR_FAULT: { label: "เซนเซอร์ผิดปกติ", cls: "fault" },
      NO_DATA: { label: "ยังไม่มีข้อมูล", cls: "muted" }
    };
    return map[normalizedStatus] || { label: String(status || "ไม่ทราบสถานะ"), cls: "muted" };
  }

  function safeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  const WEATHER_CODES = Object.freeze({
    0: ["ท้องฟ้าแจ่มใส", "☀️"], 1: ["ฟ้าใสบางส่วน", "🌤️"], 2: ["มีเมฆบางส่วน", "⛅"], 3: ["มีเมฆมาก", "☁️"],
    45: ["มีหมอก", "🌫️"], 48: ["หมอก/น้ำค้างแข็ง", "🌫️"],
    51: ["ฝนปรอยเล็กน้อย", "🌦️"], 53: ["ฝนปรอยปานกลาง", "🌦️"], 55: ["ฝนปรอยหนาแน่น", "🌧️"],
    56: ["ฝนเยือกแข็งปรอย", "🌧️"], 57: ["ฝนเยือกแข็งปรอยหนา", "🌧️"],
    61: ["ฝนเล็กน้อย", "🌧️"], 63: ["ฝนปานกลาง", "🌧️"], 65: ["ฝนหนัก", "🌧️"],
    66: ["ฝนเยือกแข็ง", "🌧️"], 67: ["ฝนเยือกแข็งหนัก", "🌧️"],
    71: ["หิมะเล็กน้อย", "❄️"], 73: ["หิมะปานกลาง", "❄️"], 75: ["หิมะหนัก", "❄️"], 77: ["เกล็ดหิมะ", "🌨️"],
    80: ["ฝนโปรยเล็กน้อย", "🌦️"], 81: ["ฝนโปรยปานกลาง", "🌧️"], 82: ["ฝนโปรยหนัก", "⛈️"],
    85: ["หิมะโปรยเล็กน้อย", "🌨️"], 86: ["หิมะโปรยหนัก", "❄️"],
    95: ["พายุฟ้าคะนอง", "⛈️"], 96: ["พายุฟ้าคะนองและลูกเห็บ", "⛈️"], 99: ["พายุรุนแรงและลูกเห็บ", "⛈️"]
  });
  const WEATHER_DAY_NAMES = Object.freeze(["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]);

  function weatherCodeInfo(code) {
    return WEATHER_CODES[Number(code)] || ["อากาศแปรปรวน", "🌡️"];
  }

  function weatherLocationCandidate(candidate, fallbackName) {
    const lat = finiteOrNull(candidate && (candidate.lat ?? candidate.latitude));
    const lng = finiteOrNull(candidate && (candidate.lng ?? candidate.lon ?? candidate.longitude));
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null;
    return {
      lat,
      lng,
      name: String(candidate && (candidate.name || candidate.plot_name || candidate.plotName) || fallbackName || "พื้นที่ฟาร์ม")
    };
  }

  function resolveWeatherLocation() {
    const configured = weatherLocationCandidate(root.FarmUltimateWeatherLocation, "แหล่งน้ำหลัก");
    if (configured) return configured;
    const appState = typeof S !== "undefined" && S && typeof S === "object" ? S : null;
    const waterSystems = appState && appState.water && Array.isArray(appState.water.systems) ? appState.water.systems : [];
    const plots = appState && Array.isArray(appState.plots) ? appState.plots : [];
    for (const candidate of waterSystems) {
      const location = weatherLocationCandidate(candidate, "ระบบน้ำของฟาร์ม");
      if (location) return location;
    }
    for (const candidate of plots) {
      const location = weatherLocationCandidate(candidate, "แปลงเกษตร");
      if (location) return location;
    }
    return null;
  }

  function normalizeWeatherForecast(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const current = p.current && typeof p.current === "object" ? p.current : null;
    const daily = p.daily && typeof p.daily === "object" ? p.daily : null;
    if (!current || !daily || !Array.isArray(daily.time) || !daily.time.length) {
      throw new Error("ข้อมูลพยากรณ์อากาศไม่ครบ");
    }
    const arrays = {
      code: Array.isArray(daily.weather_code) ? daily.weather_code : [],
      max: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [],
      min: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [],
      rain: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [],
      probability: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max : []
    };
    const days = daily.time.slice(0, 7).map((date, index) => ({
      date: String(date || ""),
      weatherCode: finiteOrNull(arrays.code[index]),
      temperatureMaxC: finiteOrNull(arrays.max[index]),
      temperatureMinC: finiteOrNull(arrays.min[index]),
      precipitationMm: finiteOrNull(arrays.rain[index]),
      precipitationProbability: finiteOrNull(arrays.probability[index])
    }));
    if (!days[0].date) throw new Error("ข้อมูลพยากรณ์อากาศไม่ครบ");
    return {
      timezone: String(p.timezone || "Asia/Bangkok"),
      current: {
        observedAt: String(current.time || ""),
        temperatureC: finiteOrNull(current.temperature_2m),
        humidityPercent: finiteOrNull(current.relative_humidity_2m),
        precipitationMm: finiteOrNull(current.precipitation),
        weatherCode: finiteOrNull(current.weather_code),
        windKmh: finiteOrNull(current.wind_speed_10m)
      },
      days
    };
  }

  function weatherForecastUrl(location) {
    const query = new URLSearchParams({
      latitude: String(location.lat),
      longitude: String(location.lng),
      current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
      wind_speed_unit: "kmh",
      forecast_days: "7",
      timezone: "Asia/Bangkok"
    });
    return "https://api.open-meteo.com/v1/forecast?" + query.toString();
  }

  async function refreshWeather(force, fetchImpl) {
    const weather = state.weather;
    const location = resolveWeatherLocation();
    if (!location) {
      weather.loading = false;
      weather.error = "ยังไม่มีพิกัด GPS ของฟาร์ม";
      weather.locationKey = "";
      weather.locationName = "";
      weather.data = null;
      return null;
    }
    const locationKey = location.lat.toFixed(5) + "," + location.lng.toFixed(5);
    if (weather.locationKey && weather.locationKey !== locationKey) {
      weather.data = null;
      weather.loadedAt = 0;
    }
    weather.locationKey = locationKey;
    weather.locationName = location.name;
    if (weather.loading) return weather.data;
    if (!force && weather.data && weather.loadedAt && Date.now() - weather.loadedAt < WEATHER_REFRESH_MS) return weather.data;
    const request = fetchImpl || root.fetch;
    if (typeof request !== "function") {
      weather.error = "อุปกรณ์นี้ไม่รองรับการดึงพยากรณ์อากาศ";
      return weather.data;
    }
    weather.loading = true;
    weather.error = "";
    try {
      const response = await request(weatherForecastUrl(location), { method: "GET", cache: "no-store" });
      if (!response || !response.ok) throw new Error("Open-Meteo ตอบกลับไม่สำเร็จ");
      weather.data = normalizeWeatherForecast(await response.json());
      weather.loadedAt = Date.now();
      return weather.data;
    } catch (error) {
      weather.error = String(error && error.message || error || "โหลดพยากรณ์อากาศไม่สำเร็จ");
      return weather.data;
    } finally {
      weather.loading = false;
    }
  }

  function normalizeForecastStats(value) {
    const item = value && typeof value === "object" ? value : {};
    return {
      median: finiteOrNull(item.median),
      min: finiteOrNull(item.min),
      max: finiteOrNull(item.max),
      models: finiteOrNull(item.models)
    };
  }

  function normalizeWeatherModelsSnapshot(payload) {
    const p = payload && typeof payload === "object" ? payload : {};
    const safety = p.safety && typeof p.safety === "object" ? p.safety : {};
    if (p.output_control_allowed !== false || safety.mode !== "DATA_ONLY" || safety.control_contract !== "SAFE_OFF") {
      throw new Error("ข้อมูลหลายโมเดลไม่ได้ยืนยัน DATA ONLY / SAFE_OFF");
    }
    if (p.forecast_only !== true || p.station_truth_available !== false || !Array.isArray(p.models) || !p.models.length) {
      throw new Error("ข้อมูลพยากรณ์หลายโมเดลไม่ครบ");
    }
    const freshness = p.freshness && typeof p.freshness === "object" ? p.freshness : {};
    const consensus = p.consensus && typeof p.consensus === "object" ? p.consensus : {};
    return {
      schema: String(p.schema || ""),
      status: String(p.status || "FORECAST_ONLY"),
      generatedAt: String(p.generated_at || ""),
      forecastOnly: true,
      stationTruthAvailable: p.station_truth_available === true,
      freshness: {
        latestIssuedAt: String(freshness.latest_issued_at || ""),
        firstValidAt: String(freshness.first_valid_at || ""),
        lastValidAt: String(freshness.last_valid_at || ""),
        models: finiteOrNull(freshness.models)
      },
      consensus: {
        rain24hMm: normalizeForecastStats(consensus.rain_24h_mm),
        wetModelCount: finiteOrNull(consensus.wet_model_count),
        rainModelCount: finiteOrNull(consensus.rain_model_count),
        nextHourTemperatureC: normalizeForecastStats(consensus.next_hour_temperature_c),
        nextHourWindKmh: normalizeForecastStats(consensus.next_hour_wind_kmh)
      },
      models: p.models.map(item => {
        const model = item && typeof item === "object" ? item : {};
        const nextHour = model.next_hour && typeof model.next_hour === "object" ? model.next_hour : {};
        return {
          id: String(model.id || ""),
          name: String(model.name || model.id || "ไม่ทราบโมเดล"),
          region: String(model.region || ""),
          issuedAt: String(model.issued_at || ""),
          hours: finiteOrNull(model.hours),
          rain24hMm: finiteOrNull(model.rain_24h_mm),
          rainProbabilityMaxPercent: finiteOrNull(model.rain_probability_max_percent),
          temperatureMeanC: finiteOrNull(model.temperature_mean_c),
          nextHour: {
            validAt: String(nextHour.valid_at || ""),
            temperatureC: finiteOrNull(nextHour.temperature_c),
            humidityPercent: finiteOrNull(nextHour.humidity_percent),
            rainMm: finiteOrNull(nextHour.rain_mm),
            windKmh: finiteOrNull(nextHour.wind_kmh)
          }
        };
      }),
      rainWindows: Array.isArray(p.rain_windows) ? p.rain_windows.map(item => {
        const window = item && typeof item === "object" ? item : {};
        const agreement = window.agreement && typeof window.agreement === "object" ? window.agreement : {};
        const rainTotal = window.rain_total_mm && typeof window.rain_total_mm === "object" ? window.rain_total_mm : {};
        return {
          startAt: String(window.start_at || ""),
          endAtExclusive: String(window.end_at_exclusive || ""),
          hours: finiteOrNull(window.hours),
          trigger: String(window.trigger || ""),
          agreement: {
            wetModels: finiteOrNull(agreement.wet_models),
            rainModels: finiteOrNull(agreement.rain_models),
            peakWetModels: finiteOrNull(agreement.peak_wet_models)
          },
          rainTotalMm: {
            allModels: normalizeForecastStats(rainTotal.all_models),
            wetModelsOnly: normalizeForecastStats(rainTotal.wet_models_only)
          }
        };
      }).filter(item => item.startAt && item.endAtExclusive) : [],
      caveats: Array.isArray(p.caveats) ? p.caveats.map(String) : []
    };
  }

  async function refreshWeatherModels(force, fetchImpl) {
    const weatherModels = state.weatherModels;
    if (weatherModels.loading) return weatherModels.data;
    if (!force && weatherModels.data && weatherModels.loadedAt && Date.now() - weatherModels.loadedAt < WEATHER_MODELS_REFRESH_MS) {
      return weatherModels.data;
    }
    const request = fetchImpl || root.fetch;
    if (typeof request !== "function") {
      weatherModels.error = "อุปกรณ์นี้ไม่รองรับการดึงข้อมูลหลายโมเดล";
      return weatherModels.data;
    }
    weatherModels.loading = true;
    weatherModels.error = "";
    try {
      const version = Math.floor(Date.now() / WEATHER_MODELS_REFRESH_MS);
      const response = await request("data/weather-models.json?v=" + version, { method: "GET", cache: "no-store" });
      if (!response || !response.ok) throw new Error("ยังไม่มี snapshot พยากรณ์หลายโมเดล");
      weatherModels.data = normalizeWeatherModelsSnapshot(await response.json());
      weatherModels.loadedAt = Date.now();
      return weatherModels.data;
    } catch (error) {
      weatherModels.error = String(error && error.message || error || "โหลดพยากรณ์หลายโมเดลไม่สำเร็จ");
      return weatherModels.data;
    } finally {
      weatherModels.loading = false;
    }
  }

  function numberLabel(value, digits) {
    const n = finiteOrNull(value);
    return n === null ? "—" : n.toLocaleString("th-TH", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function reservoirVisualState(current, status) {
    const normalizedStatus = String(status || "NO_DATA").toUpperCase();
    const capacity = finiteOrNull(current && current.capacity_percent);
    const trusted = capacity !== null && (normalizedStatus === "GOOD" || normalizedStatus === "STALE");
    if (!trusted) {
      return {
        known: false,
        capacity: null,
        band: null,
        pinTop: 47,
        image: "images/digital-twin/main-reservoir-isometric-v1.png",
        className: "is-unknown",
        label: "ยังไม่พร้อม"
      };
    }

    const clamped = Math.max(0, Math.min(120, capacity));
    let band = RESERVOIR_VISUAL_LEVELS[0];
    RESERVOIR_VISUAL_LEVELS.forEach(level => {
      if (Math.abs(level - clamped) < Math.abs(band - clamped)) band = level;
    });
    const padded = String(band).padStart(3, "0");
    return {
      known: true,
      capacity: clamped,
      band,
      pinTop: 62 - band * .28,
      image: "images/digital-twin/reservoir-level-" + padded + "-v1.png",
      className: (normalizedStatus === "STALE" ? "is-stale" : "is-live") + (band === 120 ? " is-high-water" : ""),
      label: numberLabel(clamped, 1) + "% ตามเซนเซอร์"
    };
  }

  function observedLabel(value) {
    const d = new Date(String(value || ""));
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function forecastWindowLabel(startAt, endAtExclusive) {
    const start = new Date(String(startAt || ""));
    const end = new Date(String(endAtExclusive || ""));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "ไม่ทราบช่วงเวลา";
    const dateOptions = { day: "numeric", month: "short" };
    const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
    const startDate = start.toLocaleDateString("th-TH", dateOptions);
    const endDate = end.toLocaleDateString("th-TH", dateOptions);
    const startTime = start.toLocaleTimeString("th-TH", timeOptions);
    const endTime = end.toLocaleTimeString("th-TH", timeOptions);
    return startDate === endDate
      ? startDate + " · " + startTime + "–" + endTime + " น."
      : startDate + " " + startTime + " – " + endDate + " " + endTime + " น.";
  }

  function ageLabel(ageS) {
    const n = finiteOrNull(ageS);
    if (n === null) return "ไม่ทราบอายุข้อมูล";
    if (n < 60) return "เมื่อ " + Math.round(n) + " วินาทีที่แล้ว";
    if (n < 3600) return "เมื่อ " + Math.round(n / 60) + " นาทีที่แล้ว";
    return "เมื่อ " + (n / 3600).toFixed(1) + " ชั่วโมงที่แล้ว";
  }

  function ageShortLabel(ageS) {
    return ageLabel(ageS).replace(/^เมื่อ\s+/, "");
  }

  function isLocalPreview() {
    if (typeof location === "undefined") return false;
    const host = String(location.hostname || "").toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") return false;
    try { return new URL(location.href).searchParams.get("sensorPreview") === "1"; }
    catch (error) { return false; }
  }

  function applyLocalPreview() {
    if (!isLocalPreview() || state.current) return;
    const base = Date.parse("2026-08-26T11:59:42+07:00");
    let previewPercent = 13.1;
    try {
      const requested = finiteOrNull(new URL(location.href).searchParams.get("waterLevel"));
      if (requested !== null) previewPercent = Math.max(0, Math.min(120, requested));
    } catch (error) {}
    const volumes = [103.2, 103.8, 103.5, 102.7, 102.4, 102.9, 102.5, 102.8, 102.3, 102.6, 103.4, 103.8, 103.5, 103.1, 102.8, 103.0, 103.7, 104.0, 103.4, 103.1, 102.9];
    state.current = {
      observed_at: new Date(base).toISOString(), observed_ts: Math.floor(base / 1000),
      depth_m: Number((previewPercent * 0.577 / 13.1).toFixed(3)),
      volume_m3: Number((previewPercent * 8).toFixed(1)),
      capacity_percent: previewPercent,
      current_ma: Number((4 + previewPercent * 0.16).toFixed(2)),
      volume_model_id: "legacy-calibration-v1"
    };
    state.status = "GOOD";
    state.ageS = 18;
    state.loadedAt = Date.now();
    state.history = volumes.map((volume, index) => ({
      observed_at: new Date(base - (volumes.length - 1 - index) * 60 * 60 * 1000).toISOString(),
      observed_ts: Math.floor((base - (volumes.length - 1 - index) * 60 * 60 * 1000) / 1000),
      quality: "GOOD", volume_m3: volume, depth_m: null, capacity_percent: null
    }));
  }

  function historyRows(raw) {
    return (Array.isArray(raw) ? raw : []).map(row => ({
      observed_at: String(row.observed_at || ""),
      observed_ts: finiteOrNull(row.observed_ts),
      quality: String(row.quality || ""),
      volume_m3: finiteOrNull(row.volume_m3),
      depth_m: finiteOrNull(row.depth_m),
      capacity_percent: finiteOrNull(row.capacity_percent)
    }));
  }

  function normalizePiHealthResponse(data) {
    const d = data && typeof data === "object" ? data : {};
    if (d.output_control_allowed !== false) {
      throw new Error("Pi Health ไม่ได้ยืนยันโหมดอ่านอย่างเดียว");
    }
    const sources = d.sources && typeof d.sources === "object" ? d.sources : {};
    const normalized = {};
    ["PI5_CONTROLLER_01", "PI_ZERO_GATEWAY_01"].forEach(sourceId => {
      const source = sources[sourceId] && typeof sources[sourceId] === "object" ? sources[sourceId] : {};
      const current = source.current && typeof source.current === "object" ? source.current : null;
      normalized[sourceId] = {
        status: String(source.status || "NO_DATA").toUpperCase(),
        samples24h: finiteOrNull(source.samples_24h),
        current: current ? {
          observed_at: String(current.observed_at || ""),
          age_s: finiteOrNull(current.age_s),
          temp_c: finiteOrNull(current.temp_c),
          load1: finiteOrNull(current.load1),
          load5: finiteOrNull(current.load5),
          load15: finiteOrNull(current.load15),
          uptime_s: finiteOrNull(current.uptime_s),
          cpu_count: finiteOrNull(current.cpu_count)
        } : null
      };
    });
    return normalized;
  }

  function normalizePiHealthHistory(data) {
    const d = data && typeof data === "object" ? data : {};
    if (d.output_control_allowed !== false) {
      throw new Error("ประวัติ Pi Health ไม่ได้ยืนยันโหมดอ่านอย่างเดียว");
    }
    const sources = d.sources && typeof d.sources === "object" ? d.sources : {};
    const normalized = {};
    ["PI5_CONTROLLER_01", "PI_ZERO_GATEWAY_01"].forEach(sourceId => {
      normalized[sourceId] = (Array.isArray(sources[sourceId]) ? sources[sourceId] : []).map(row => ({
        observed_at: String(row.observed_at || ""),
        observed_epoch: finiteOrNull(row.observed_epoch),
        quality: String(row.quality || ""),
        temp_c: finiteOrNull(row.temp_c),
        load1: finiteOrNull(row.load1)
      }));
    });
    return normalized;
  }

  async function refreshLocalPiHealth(force) {
    const runtime = root.FarmUltimateRuntime;
    if (!runtime || !runtime.hasLocalPiHealth || !runtime.piHealthApiUrl || typeof fetch !== "function") return;
    const health = state.piHealth;
    if (health.loading) return;
    if (!force && health.loadedAt && Date.now() - health.loadedAt < 30000) return;
    health.loading = true;
    health.error = "";
    const base = String(runtime.piHealthApiUrl).replace(/\/$/, "");
    try {
      const responses = await Promise.all([
        fetch(base + "/api/pi-health", { cache: "no-store" }),
        fetch(base + "/api/pi-health/history?hours=" + state.hours, { cache: "no-store" })
      ]);
      if (!responses.every(response => response.ok)) throw new Error("Pi Health API ตอบกลับไม่สำเร็จ");
      const payloads = await Promise.all(responses.map(response => response.json()));
      health.sources = normalizePiHealthResponse(payloads[0]);
      health.history = normalizePiHealthHistory(payloads[1]);
    } catch (error) {
      health.error = String(error && error.message || error || "โหลด Pi Health ไม่สำเร็จ");
    } finally {
      health.loadedAt = Date.now();
      health.loading = false;
    }
  }

  async function refreshLocalWaterBalance(force) {
    const runtime = root.FarmUltimateRuntime;
    if (!runtime || !runtime.hasLocalWaterBalance || !runtime.waterBalanceApiUrl || typeof fetch !== "function") return;
    const balance = state.waterBalance;
    if (balance.loading) return;
    if (!force && balance.loadedAt && Date.now() - balance.loadedAt < 30000) return;
    balance.loading = true;
    balance.error = "";
    const base = String(runtime.waterBalanceApiUrl).replace(/\/$/, "");
    try {
      const response = await fetch(base + "/api/water-balance", { cache: "no-store" });
      if (!response.ok) throw new Error("Water Balance API ตอบกลับไม่สำเร็จ");
      balance.data = normalizeWaterBalanceResponse(await response.json());
    } catch (error) {
      balance.error = String(error && error.message || error || "โหลดสมดุลน้ำไม่สำเร็จ");
    } finally {
      balance.loadedAt = Date.now();
      balance.loading = false;
      if (typeof route !== "undefined" && route.view === "iot" && typeof render === "function") render();
    }
  }

  async function probeSafeBackend(force) {
    const runtime = root.FarmUltimateRuntime;
    if (!runtime || !runtime.isOwnerCanary) return true;
    if (typeof authCall !== "function") {
      state.backendStatus = "ERROR";
      state.backendCheckedAt = Date.now();
      return false;
    }
    const fresh = !force && state.backendCheckedAt && Date.now() - state.backendCheckedAt <= 30000;
    if (fresh) return state.backendStatus === "ONLINE_SAFE_OFF";
    state.backendStatus = "CHECKING";
    try {
      const health = await authCall("health");
      const safe = health && health.ok && health.data &&
        health.data.mode === "SENSOR_PHASE1_READ_ONLY" &&
        health.data.output_control_allowed === false;
      if (!safe) throw new Error("Canary ไม่ยืนยัน SAFE_OFF");
      state.backendStatus = "ONLINE_SAFE_OFF";
      return true;
    } catch (error) {
      state.backendStatus = "ERROR";
      return false;
    } finally {
      state.backendCheckedAt = Date.now();
    }
  }

  async function refresh(force) {
    if (isLocalPreview()) {
      if (localPreviewLoading) return;
      if (!force && localPreviewLoadedAt && Date.now() - localPreviewLoadedAt < 30000) return;
      localPreviewLoading = true;
      applyLocalPreview();
      try {
        await Promise.all([probeSafeBackend(force), refreshLocalPiHealth(force), refreshLocalWaterBalance(force), refreshWeather(force), refreshWeatherModels(force)]);
      } finally {
        localPreviewLoadedAt = Date.now();
        localPreviewLoading = false;
      }
      if (typeof route !== "undefined" && route.view === "iot" && typeof render === "function") render();
      return;
    }
    if (typeof Auth === "undefined" || !Auth.session || typeof authCall !== "function") return;
    if (state.loading) return;
    if (!force && state.loadedAt && Date.now() - state.loadedAt < 30000) return;
    state.loading = true;
    state.error = "";
    try {
      await Promise.all([refreshLocalPiHealth(force), refreshLocalWaterBalance(force), refreshWeather(force), refreshWeatherModels(force)]);
      const safeBackend = await probeSafeBackend(force);
      if (root.FarmUltimateRuntime && root.FarmUltimateRuntime.isOwnerCanary && !safeBackend) {
        throw new Error("Canary ไม่ยืนยัน DATA ONLY / SAFE_OFF");
      }
      const results = await Promise.all([
        authCall("sensor_current", { token: Auth.session.token, source_id: state.sourceId }),
        authCall("sensor_history", { token: Auth.session.token, source_id: state.sourceId, hours: state.hours, limit: 400 })
      ]);
      if (!results[0].ok) throw new Error(results[0].error || "โหลดค่าล่าสุดไม่สำเร็จ");
      const normalized = normalizeCurrentResponse(results[0].data);
      state.current = normalized.current;
      state.status = normalized.status;
      state.ageS = normalized.ageS;
      if (results[1].ok && results[1].data && results[1].data.output_control_allowed === false) {
        state.history = historyRows(results[1].data.rows);
      } else {
        state.history = [];
      }
      state.loadedAt = Date.now();
    } catch (error) {
      state.error = String(error && error.message || error || "โหลดข้อมูลไม่สำเร็จ");
      state.loadedAt = Date.now();
    } finally {
      state.loading = false;
    }
    if (typeof route !== "undefined" && route.view === "iot" && typeof render === "function") render();
  }

  function shouldAutoRefresh(activeView, pageHidden) {
    return activeView === "iot" && !pageHidden;
  }

  function startAutoRefresh() {
    if (autoRefreshTimer || typeof document === "undefined" || typeof root.setInterval !== "function") {
      return autoRefreshTimer;
    }
    autoRefreshTimer = root.setInterval(() => {
      const activeView = typeof route !== "undefined" && route ? route.view : "";
      if (!shouldAutoRefresh(activeView, document.hidden)) return;
      refresh(false);
    }, AUTO_REFRESH_MS);
    return autoRefreshTimer;
  }

  function uptimeShort(value) {
    const seconds = finiteOrNull(value);
    if (seconds === null) return "—";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days ? days + " วัน " + hours + " ชม." : hours + " ชม.";
  }

  function piHealthStatusMeta(status) {
    const value = String(status || "NO_DATA").toUpperCase();
    if (value === "GOOD") return { label: "ปกติ", cls: "good" };
    if (value === "STALE" || value === "DEGRADED" || value === "NO_DATA") {
      return { label: value === "STALE" ? "ข้อมูลเก่า" : value === "DEGRADED" ? "ข้อมูลไม่ครบ" : "รอข้อมูล", cls: "warn" };
    }
    return { label: "อ่านค่าไม่ได้", cls: "fault" };
  }

  function piHealthSourceHtml(sourceId, name, role) {
    const source = state.piHealth.sources[sourceId] || { status: "NO_DATA", current: null };
    const meta = piHealthStatusMeta(source.status);
    const current = source.current;
    return `<article class="digital-health-node">
      <div class="digital-health-node-head"><div><strong>${safeText(name)}</strong><span>${safeText(role)}</span></div><b class="${meta.cls}">${meta.label}</b></div>
      <div class="digital-health-metrics">
        <div><span>อุณหภูมิ</span><strong>${numberLabel(current && current.temp_c, 1)}<b>°C</b></strong></div>
        <div><span>โหลด 1 นาที</span><strong>${numberLabel(current && current.load1, 2)}</strong></div>
        <div><span>โหลด 5 นาที</span><strong>${numberLabel(current && current.load5, 2)}</strong></div>
        <div><span>โหลด 15 นาที</span><strong>${numberLabel(current && current.load15, 2)}</strong></div>
      </div>
      <div class="digital-health-node-foot"><span>ทำงาน ${uptimeShort(current && current.uptime_s)}</span><span>${current ? ageShortLabel(current.age_s) : "—"}</span></div>
    </article>`;
  }

  function piHealthHtml() {
    const runtime = root.FarmUltimateRuntime;
    if (!runtime || !runtime.hasLocalPiHealth) return "";
    const health = state.piHealth;
    const stateLabel = health.loading && !Object.keys(health.sources).length
      ? "กำลังโหลด" : health.error ? "เชื่อมต่อ Pi 5 ไม่สำเร็จ" : "LIVE · DATA ONLY";
    const stateClass = health.error ? "fault" : "good";
    return `<section class="digital-health-panel" aria-label="สุขภาพ Raspberry Pi">
      <header class="digital-health-title"><div><span>ระบบประมวลผล</span><h2>Pi Health</h2></div><b class="${stateClass}">${safeText(stateLabel)}</b></header>
      ${health.error ? `<div class="digital-health-error">${safeText(health.error)}</div>` : ""}
      <div class="digital-health-nodes">
        ${piHealthSourceHtml("PI5_CONTROLLER_01", "Raspberry Pi 5", "Controller")}
        ${piHealthSourceHtml("PI_ZERO_GATEWAY_01", "Raspberry Pi Zero", "Sensor Gateway")}
      </div>
      <div class="digital-health-chart-grid">
        <section><h3>อุณหภูมิ ${state.hours === 168 ? "7 วัน" : "24 ชั่วโมง"}</h3><canvas id="piHealthTempChart" aria-label="กราฟอุณหภูมิ Pi 5 และ Pi Zero"></canvas></section>
        <section><h3>โหลด 1 นาที</h3><canvas id="piHealthLoadChart" aria-label="กราฟโหลด Pi 5 และ Pi Zero"></canvas></section>
      </div>
      <footer><span><i class="pi5"></i>Pi 5</span><span><i class="pizero"></i>Pi Zero</span><b>รีเฟรชทุก 1 นาที · อ่านอย่างเดียว</b></footer>
    </section>`;
  }

  function waterBalanceHtml() {
    const runtime = root.FarmUltimateRuntime;
    if (!runtime || !runtime.hasLocalWaterBalance) return "";
    const balance = state.waterBalance;
    const d = balance.data;
    const main = d && d.main60m || {};
    const reference = d && d.reference || {};
    const refill = d && d.activeRefill;
    const quality = d && d.quality || {};
    const hasMain = d && main.net_rate_m3_h !== null && main.net_loss_m3_h !== null;
    const stateLabel = balance.loading && !d ? "กำลังคำนวณ" : balance.error ? "N/A" : d ? d.statusLabel : "รอข้อมูล";
    const stateClass = balance.error || !d || quality.status !== "GOOD" ? "warn" : "good";
    const observed = d && d.current ? observedLabel(d.current.observed_at) : "—";
    const sourceLabel = runtime.waterBalanceSource === "PI5_LIVE_GET_ONLY"
      ? "PI 5 LIVE · DATA ONLY" : "DATA ONLY";
    const method = main.calculation_mode === "CONSTANT_PUMP_MINUS_NET_GAIN"
      ? "ปั๊มคงที่ − น้ำเพิ่มสุทธิ" : main.calculation_mode === "DIRECT_VOLUME_DECLINE"
        ? "วัดจากปริมาตรที่ลดลงโดยตรง" : "ไม่ได้อยู่ในช่วงเติมน้ำ";
    return `<section class="digital-water-balance" aria-label="สมดุลน้ำในสระ">
      <header class="digital-water-balance-title">
        <div><span>ค่าที่อนุมานจากสมดุลน้ำ</span><h2>สมดุลน้ำในสระ</h2></div>
        <b class="${stateClass}">${safeText(stateLabel)}</b>
      </header>
      ${balance.error ? `<div class="digital-water-balance-error">${safeText(balance.error)} · แสดง N/A แทนข้อมูลที่ไม่พร้อม</div>` : ""}
      <div class="digital-water-balance-kpis">
        <article><span>ปั๊มเติมน้ำ</span><strong>${numberLabel(reference.pump_rate_m3_h, 1)}<b> m³/ชม.</b></strong><small>${numberLabel(reference.pump_rate_l_min, 1)} ลิตร/นาที · ค่าอ้างอิงคงที่</small></article>
        <article><span>น้ำเพิ่มสุทธิ 60 นาที</span><strong>${hasMain ? numberLabel(main.net_rate_m3_h, 3) : "N/A"}<b> m³/ชม.</b></strong><small>endpoint · slope ตรวจทาน ${main.regression_rate_m3_h === null || main.regression_rate_m3_h === undefined ? "N/A" : numberLabel(main.regression_rate_m3_h, 3)}</small></article>
        <article><span>ซึม/สูญเสียเฉลี่ย</span><strong>${hasMain ? numberLabel(main.net_loss_m3_h, 3) : "N/A"}<b> m³/ชม.</b></strong><small>${hasMain ? numberLabel(main.net_loss_l_min, 1) : "N/A"} ลิตร/นาที · ${safeText(method)}</small></article>
        <article><span>สูญเสียสะสมรอบนี้</span><strong>${refill && refill.inferred_total_loss_m3 !== null ? numberLabel(refill.inferred_total_loss_m3, 3) : "N/A"}<b> m³</b></strong><small>${refill && refill.loss_share_percent !== null ? numberLabel(refill.loss_share_percent, 1) + "% ของน้ำที่ปั๊มส่ง" : "ไม่พบรอบเติมน้ำต่อเนื่อง"}</small></article>
      </div>
      <section class="digital-water-balance-chart">
        <div><h3>แนวโน้มการซึม/สูญเสีย</h3><span>ลิตร/ชั่วโมง · 30 นาที ทุก 15 นาที</span></div>
        <canvas id="waterBalanceMiniChart" aria-label="กราฟอัตราการซึมและสูญเสียที่อนุมานจากสมดุลน้ำ"></canvas>
      </section>
      <footer><span>อัปเดต ${safeText(observed)}</span><span>คุณภาพ ${safeText(quality.status || "N/A")}</span><b>${safeText(sourceLabel)}</b></footer>
      <p>อัตราปั๊มเป็นค่าที่เจ้าของยืนยัน ไม่ใช่ flowmeter · ค่าการสูญเสียอาจรวมการระเหยหรือการสูญเสียที่ไม่ได้บันทึก</p>
    </section>`;
  }

  function weatherHtml() {
    const weather = state.weather;
    const data = weather.data;
    const current = data && data.current;
    const hasData = !!current;
    const currentInfo = weatherCodeInfo(current && current.weatherCode);
    const statusLabel = weather.loading && !hasData
      ? "กำลังโหลด" : weather.error && hasData ? "ข้อมูลล่าสุดที่มี" : hasData ? "พยากรณ์ล่าสุด" : "ยังไม่พร้อม";
    const statusClass = weather.error ? "warn" : hasData ? "good" : "muted";
    const loadedAt = weather.loadedAt
      ? new Date(weather.loadedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
      : "—";
    const today = data && data.days && data.days[0] || null;
    const days = data && data.days ? data.days.slice(0, 5).map((day, index) => {
      const info = weatherCodeInfo(day.weatherCode);
      const date = new Date(day.date + "T12:00:00");
      const dayName = index === 0 ? "วันนี้" : WEATHER_DAY_NAMES[date.getDay()] || "—";
      return `<article class="digital-weather-day">
        <span>${safeText(dayName)}</span><b aria-label="${safeText(info[0])}">${info[1]}</b>
        <strong>${numberLabel(day.temperatureMaxC, 0)}°/${numberLabel(day.temperatureMinC, 0)}°</strong>
        <small>ฝน ${numberLabel(day.precipitationProbability, 0)}% · ${numberLabel(day.precipitationMm, 1)} มม.</small>
      </article>`;
    }).join("") : "";
    const errorMessage = weather.error
      ? `<div class="digital-weather-message ${hasData ? "cached" : "fault"}">${safeText(weather.error)}${hasData ? " · กำลังแสดงข้อมูลล่าสุดที่เก็บไว้" : " · กรุณาตั้งพิกัดในข้อมูลแปลงแล้วลองใหม่"}</div>`
      : "";

    return `<section class="digital-weather-panel" aria-label="พยากรณ์อากาศของฟาร์ม" aria-busy="${weather.loading ? "true" : "false"}">
      <header class="digital-weather-title">
        <div><span>ประกอบการวางแผนใช้น้ำ</span><h2>พยากรณ์อากาศ</h2><small>${safeText(weather.locationName || "พิกัดฟาร์ม")}</small></div>
        <b class="${statusClass}">${safeText(statusLabel)}</b>
      </header>
      ${errorMessage}
      ${hasData ? `<div class="digital-weather-current">
        <div class="digital-weather-condition"><b aria-hidden="true">${currentInfo[1]}</b><div><strong>${numberLabel(current.temperatureC, 1)}°C</strong><span>${safeText(currentInfo[0])}</span></div></div>
        <div class="digital-weather-metrics">
          <div><span>ความชื้น</span><strong>${numberLabel(current.humidityPercent, 0)}%</strong></div>
          <div><span>ลม</span><strong>${numberLabel(current.windKmh, 1)} <b>กม./ชม.</b></strong></div>
          <div><span>ฝนตอนนี้</span><strong>${numberLabel(current.precipitationMm, 1)} <b>มม.</b></strong></div>
          <div><span>โอกาสฝนวันนี้</span><strong>${numberLabel(today && today.precipitationProbability, 0)}%</strong></div>
        </div>
      </div>
      <div class="digital-weather-days">${days}</div>` : weather.loading ? `<div class="digital-weather-loading">กำลังดึงพยากรณ์จาก Open‑Meteo…</div>` : ""}
      <footer><span>ดึงล่าสุด ${safeText(loadedAt)}</span><span>รีเฟรชพยากรณ์ทุก 30 นาที</span><b>Open‑Meteo · GET ONLY</b></footer>
      <p>ข้อมูลพยากรณ์เพื่อประกอบการตัดสินใจเท่านั้น · ไม่เชื่อมคำสั่งปั๊ม วาล์ว หรือรีเลย์</p>
    </section>`;
  }

  function weatherModelsHtml() {
    const weatherModels = state.weatherModels;
    const data = weatherModels.data;
    const hasData = !!(data && data.models && data.models.length);
    const modelCount = hasData ? data.models.length : 0;
    const consensus = hasData ? data.consensus : {};
    const rain = consensus.rain24hMm || {};
    const temperature = consensus.nextHourTemperatureC || {};
    const wetCount = finiteOrNull(consensus.wetModelCount);
    const rainCount = finiteOrNull(consensus.rainModelCount);
    const statusLabel = weatherModels.loading && !hasData
      ? "กำลังโหลด" : weatherModels.error && hasData ? "ข้อมูลล่าสุดที่มี" : hasData ? modelCount + " โมเดล · FORECAST ONLY" : "ยังไม่พร้อม";
    const statusClass = weatherModels.error ? "warn" : hasData ? "good" : "muted";
    const models = hasData ? data.models.slice().sort((a, b) => {
      const rainA = a.rain24hMm === null ? -1 : a.rain24hMm;
      const rainB = b.rain24hMm === null ? -1 : b.rain24hMm;
      return rainB - rainA;
    }) : [];
    const maxRain = Math.max(0.1, ...models.map(model => model.rain24hMm === null ? 0 : model.rain24hMm));
    const rows = models.map(model => {
      const width = model.rain24hMm === null ? 0 : Math.max(0, Math.min(100, model.rain24hMm / maxRain * 100));
      const probability = model.rainProbabilityMaxPercent === null ? "ไม่มีค่าโอกาสฝน" : "โอกาสสูงสุด " + numberLabel(model.rainProbabilityMaxPercent, 0) + "%";
      return `<article class="digital-weather-model-row">
        <div class="digital-weather-model-name"><strong>${safeText(model.name)}</strong><span>${safeText(model.region)}</span></div>
        <div class="digital-weather-model-bar"><i style="width:${width.toFixed(1)}%"></i></div>
        <div class="digital-weather-model-value"><strong>${model.rain24hMm === null ? "N/A" : numberLabel(model.rain24hMm, 1)} <b>มม.</b></strong><span>${safeText(probability)} · เฉลี่ย ${numberLabel(model.temperatureMeanC, 1)}°C</span></div>
      </article>`;
    }).join("");
    const rainWindows = hasData && Array.isArray(data.rainWindows) ? data.rainWindows : [];
    const rainWindowsHtml = rainWindows.length ? rainWindows.map((window, index) => {
      const agreement = window.agreement || {};
      const wetRain = window.rainTotalMm && window.rainTotalMm.wetModelsOnly || {};
      const allRain = window.rainTotalMm && window.rainTotalMm.allModels || {};
      return `<article class="digital-rain-window">
        <div class="digital-rain-window-index" aria-hidden="true">${index + 1}</div>
        <div class="digital-rain-window-main">
          <strong>${safeText(forecastWindowLabel(window.startAt, window.endAtExclusive))}</strong>
          <span>${numberLabel(agreement.wetModels, 0)}/${numberLabel(agreement.rainModels, 0)} โมเดลคาดว่ามีฝน · ต่อเนื่อง ${numberLabel(window.hours, 0)} ชม.</span>
        </div>
        <div class="digital-rain-window-amount">
          <span>ถ้าฝนเกิด</span><strong>${numberLabel(wetRain.median, 1)} <b>มม.</b></strong>
          <small>ช่วง ${numberLabel(wetRain.min, 1)}–${numberLabel(wetRain.max, 1)} มม. · ทุกโมเดลค่ากลาง ${numberLabel(allRain.median, 1)} มม.</small>
        </div>
      </article>`;
    }).join("") : `<div class="digital-rain-window-empty">24 ชั่วโมงนี้ยังไม่มีอย่างน้อย 2 โมเดลเห็นตรงกันว่าฝนจะถึง 0.2 มม./ชั่วโมง</div>`;
    const errorMessage = weatherModels.error
      ? `<div class="digital-weather-message ${hasData ? "cached" : "fault"}">${safeText(weatherModels.error)}${hasData ? " · กำลังแสดง snapshot ล่าสุด" : ""}</div>`
      : "";
    const issuedAt = hasData ? observedLabel(data.freshness.latestIssuedAt) : "—";
    return `<section class="digital-weather-models" aria-label="เปรียบเทียบพยากรณ์หลายโมเดล" aria-busy="${weatherModels.loading ? "true" : "false"}">
      <header class="digital-weather-title">
        <div><span>เปรียบเทียบก่อนใช้สถานีจริงตัดสินความแม่น</span><h2>พยากรณ์หลายโมเดล</h2><small>ค่าพยากรณ์ 24 ชั่วโมงข้างหน้า</small></div>
        <b class="${statusClass}">${safeText(statusLabel)}</b>
      </header>
      ${errorMessage}
      ${hasData ? `<div class="digital-weather-model-kpis">
        <article><span>ฝน 24 ชม. · ค่ากลาง</span><strong>${numberLabel(rain.median, 1)} <b>มม.</b></strong><small>ช่วง ${numberLabel(rain.min, 1)}–${numberLabel(rain.max, 1)} มม.</small></article>
        <article><span>อุณหภูมิชั่วโมงถัดไป</span><strong>${numberLabel(temperature.median, 1)}<b>°C</b></strong><small>ช่วง ${numberLabel(temperature.min, 1)}–${numberLabel(temperature.max, 1)}°C</small></article>
        <article><span>โมเดลที่คาดว่ามีฝน</span><strong>${numberLabel(wetCount, 0)}<b> / ${numberLabel(rainCount, 0)}</b></strong><small>เกณฑ์ฝนรวมตั้งแต่ 0.2 มม.</small></article>
      </div>
      <section class="digital-rain-windows" aria-label="ช่วงเวลาที่ฝนอาจเกิด">
        <div class="digital-rain-windows-title"><div><span>ช่วงเวลาที่ฝนอาจเกิด</span><small>อย่างน้อย 2 โมเดลคาดฝน ≥ 0.2 มม./ชั่วโมง</small></div><b>24 ชม.</b></div>
        ${rainWindowsHtml}
      </section>
      <div class="digital-weather-model-list">${rows}</div>` : weatherModels.loading ? `<div class="digital-weather-loading">กำลังโหลด snapshot 10 โมเดล…</div>` : ""}
      <footer><span>ชุดพยากรณ์ ${safeText(issuedAt)}</span><span>หน้าเว็บตรวจทุก 5 นาที</span><b>OPEN‑METEO · GET ONLY</b></footer>
      <p><strong>ยังไม่จัดอันดับความแม่น:</strong> เป็นค่าพยากรณ์ ไม่ใช่ค่าตรวจวัดจากสถานีจริง · กราฟเรียงตามปริมาณฝนที่คาด ไม่ใช่ความแม่น · FarmConnect พักไว้ก่อน</p>
    </section>`;
  }

  function cardHtml(options) {
    const viewOptions = options && typeof options === "object" ? options : {};
    const backAction = viewOptions.backAction === "App.farmMapBack()"
      ? "App.farmMapBack()"
      : "App.nav('home')";
    const backLabel = viewOptions.backLabel === "← แผนที่ฟาร์ม"
      ? "← แผนที่ฟาร์ม"
      : "← กลับหน้าหลัก";
    const c = state.current;
    const meta = statusMeta(state.status, c && c.current_ma);
    const hasData = !!c;
    const statusClass = state.error ? "fault" : meta.cls;
    const statusLabel = state.loading && !c ? "กำลังรับข้อมูล" : state.error ? "เชื่อมต่อไม่ได้" : meta.label;
    const observed = hasData ? observedLabel(c.observed_at) : "—";
    const level = hasData ? numberLabel(c.depth_m, 3) : "—";
    const volume = hasData ? numberLabel(c.volume_m3, 1) : "—";
    const capacity = hasData ? numberLabel(c.capacity_percent, 1) : "—";
    const signal = hasData ? numberLabel(c.current_ma, 2) : "—";
    const age = hasData ? ageShortLabel(state.ageS) : "รอข้อมูลล่าสุด";
    const reservoirVisual = reservoirVisualState(c, state.status);
    const date = hasData && c.observed_at ? new Date(c.observed_at).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric"
    }) : "—";
    const errorNote = state.error ? `<div class="digital-alert" role="alert">${safeText(state.error)} <button onclick="App.refreshMainWaterSensor()">ลองใหม่</button></div>` : "";
    const runtime = root.FarmUltimateRuntime;
    const canaryNote = runtime && runtime.isOwnerCanary
      ? `<div class="digital-canary ${state.backendStatus === "ONLINE_SAFE_OFF" ? "online" : state.backendStatus === "ERROR" ? "fault" : "checking"}"><b>OWNER CANARY</b><span>${state.backendStatus === "ONLINE_SAFE_OFF" ? "Cloudflare เชื่อมต่อแล้ว · SAFE_OFF" : state.backendStatus === "ERROR" ? "เชื่อมต่อ Canary ไม่สำเร็จ" : "กำลังตรวจ Cloudflare Canary"}</span></div>`
      : "";

    return `<section class="sensor-digital-twin" aria-live="polite" aria-busy="${state.loading ? "true" : "false"}">
      <header class="digital-header">
        <button class="digital-back-button" onclick="${backAction}" aria-label="${backLabel.replace("← ", "")}">${backLabel}</button>
        <button class="digital-brand" onclick="App.nav('more')" aria-label="กลับไปเมนูเพิ่มเติม">
          <img src="images/digital-twin/fus-logo-white-v1.png" alt="FARMULTIMATE SOLUTIONS">
        </button>
        <div class="digital-title">
          <h1>แหล่งน้ำหลัก</h1>
          <div class="digital-live ${statusClass}"><span aria-hidden="true"></span> LIVE · ${safeText(statusLabel)}</div>
        </div>
      </header>

      ${canaryNote}

      <div class="digital-hero ${reservoirVisual.known ? "has-water-level" : "is-unknown"}" style="--water-pin-top:${reservoirVisual.pinTop}%" data-water-band="${reservoirVisual.band === null ? "unknown" : reservoirVisual.band}">
        <img class="reservoir-level-image ${reservoirVisual.className}" src="${reservoirVisual.image}" alt="${reservoirVisual.known ? "ภาพกราฟิกสามมิติของแหล่งเก็บน้ำที่แสดงความจุ " + numberLabel(reservoirVisual.capacity, 1) + " เปอร์เซ็นต์" : "ภาพกราฟิกแหล่งเก็บน้ำ ขณะนี้ยังไม่มีค่าระดับที่เชื่อถือได้"}">
        <div class="hero-water-state ${reservoirVisual.className}" aria-label="${safeText(reservoirVisual.label)}"><span>ระดับในภาพ</span><strong>${safeText(reservoirVisual.label)}</strong></div>
        <div class="hero-level-pin" aria-label="ระดับน้ำ ${level} เมตร"><span></span><b>${level} m</b></div>
        <div class="hero-reading">
          <span>ระดับน้ำ</span>
          <strong>${level}</strong><b>เมตร</b>
        </div>
      </div>

      <div class="digital-panel">
        ${errorNote}
        <div class="digital-primary-grid">
          <div class="digital-volume">
            <span>ปริมาตรโดยประมาณ</span>
            <div><strong>${volume}</strong><b>ลบ.ม.</b></div>
          </div>
          <div class="digital-capacity">
            <div><span>ความจุ</span><strong>${capacity}<b>%</b></strong></div>
            <canvas id="sensorCapacityGauge" data-value="${hasData ? Math.max(0, Math.min(100, Number(c.capacity_percent) || 0)) : 0}" aria-label="ความจุ ${capacity} เปอร์เซ็นต์"></canvas>
          </div>
        </div>

        <div class="digital-secondary-grid">
          <div class="digital-secondary-item"><span>สัญญาณ</span><strong>${signal} <b>mA</b></strong></div>
          <div class="digital-secondary-item"><span>อัปเดต</span><strong>${safeText(age)}</strong><small>${safeText(observed)}</small></div>
        </div>

        ${weatherHtml()}

        ${weatherModelsHtml()}

        ${waterBalanceHtml()}

        <div class="digital-chart-grid">
          <section class="digital-chart-card">
            <h2>โปรไฟล์ความลึก</h2>
            <div class="chart-caption">ความลึก (เมตร)</div>
            <canvas id="sensorDepthProfileChart" data-level="${hasData ? Number(c.depth_m) || 0 : 0}" aria-label="กราฟโปรไฟล์ความลึก"></canvas>
          </section>
          <section class="digital-chart-card">
            <h2>แนวโน้ม ${state.hours === 168 ? "7 วัน" : "24 ชั่วโมง"}</h2>
            <div class="chart-caption">ปริมาตร (ลบ.ม.)</div>
            <canvas id="sensorHistoryChart" aria-label="กราฟแนวโน้มปริมาตร"></canvas>
          </section>
        </div>

        <footer class="digital-footer">
          <span>${safeText(date)}</span>
          <b>DATA ONLY · SAFE_OFF</b>
        </footer>
      </div>
      ${piHealthHtml()}
    </section>`;
  }

  function downsample(rows, maxPoints) {
    if (rows.length <= maxPoints) return rows;
    const out = [];
    for (let i = 0; i < maxPoints; i++) {
      const index = Math.round(i * (rows.length - 1) / (maxPoints - 1));
      out.push(rows[index]);
    }
    return out;
  }

  function canvasContext(canvas, cssHeight, minWidth) {
    if (!canvas || typeof window === "undefined") return null;
    const width = Math.max(minWidth || 220, Math.round(canvas.getBoundingClientRect().width || 320));
    const height = cssHeight;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function drawGauge() {
    const canvas = typeof document !== "undefined" ? document.getElementById("sensorCapacityGauge") : null;
    const setup = canvasContext(canvas, 62, 48);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pct = Math.max(0, Math.min(100, Number(canvas.dataset.value) || 0));
    const radius = Math.min(width, height) * 0.35;
    const cx = width / 2, cy = height / 2;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(124, 167, 169, .27)";
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#45e2ed";
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct / 100); ctx.stroke();
  }

  function drawEmptyChart(canvas, message) {
    const setup = canvasContext(canvas, 90);
    if (!setup) return;
    const { ctx, width, height } = setup;
    ctx.fillStyle = "rgba(210, 235, 232, .7)";
    ctx.font = "500 12px Sarabun, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
  }

  function drawDepthProfile() {
    const canvas = typeof document !== "undefined" ? document.getElementById("sensorDepthProfileChart") : null;
    const setup = canvasContext(canvas, 90);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = { l: 28, r: 8, t: 10, b: 22 };
    const values = [0, .08, .22, .35, .43, .57, .66, .76, .92, 1.08, 1.28, 2.5];
    const x = i => pad.l + i / (values.length - 1) * (width - pad.l - pad.r);
    const y = v => pad.t + v / 2.5 * (height - pad.t - pad.b);
    ctx.strokeStyle = "rgba(98, 151, 155, .24)";
    ctx.lineWidth = 1;
    [0, .5, 1, 1.5, 2, 2.5].forEach(v => {
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(width - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = "#b8cfcd"; ctx.font = "10px Sarabun, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(v.toFixed(1), pad.l - 5, y(v) + 3);
    });
    ctx.beginPath(); ctx.moveTo(x(0), y(values[0]));
    values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(values.length - 1), height - pad.b); ctx.lineTo(x(0), height - pad.b); ctx.closePath();
    ctx.fillStyle = "rgba(22, 187, 207, .24)"; ctx.fill();
    ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = "#45e2ed"; ctx.lineWidth = 2; ctx.stroke();
    const level = Math.max(0, Math.min(2.5, Number(canvas.dataset.level) || 0));
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#45e2ed"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y(level)); ctx.lineTo(width - pad.r, y(level)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#45e2ed"; ctx.font = "700 11px Sarabun, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(numberLabel(level, 3) + " m", width - pad.r, Math.max(12, y(level) - 5));
  }

  function drawHistoryChart() {
    const canvas = typeof document !== "undefined" ? document.getElementById("sensorHistoryChart") : null;
    const good = state.history.filter(row => row.quality === "GOOD" && row.volume_m3 !== null);
    if (!canvas) return;
    if (good.length < 2) { drawEmptyChart(canvas, "ยังมีข้อมูลไม่พอสำหรับวาดกราฟ"); return; }
    const setup = canvasContext(canvas, 90);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const rows = downsample(good, 28);
    const values = rows.map(row => Number(row.volume_m3));
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const margin = Math.max(.8, (rawMax - rawMin) * .35);
    const min = rawMin - margin, max = rawMax + margin;
    const pad = { l: 30, r: 8, t: 10, b: 22 };
    const x = i => pad.l + i / (values.length - 1) * (width - pad.l - pad.r);
    const y = v => pad.t + (max - v) / (max - min) * (height - pad.t - pad.b);
    ctx.strokeStyle = "rgba(98, 151, 155, .24)"; ctx.lineWidth = 1;
    [0, .5, 1].forEach(step => {
      const v = min + (max - min) * step;
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(width - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = "#b8cfcd"; ctx.font = "10px Sarabun, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(v.toFixed(0), pad.l - 5, y(v) + 3);
    });
    ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = "#45e2ed"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    const last = values.length - 1;
    ctx.fillStyle = "#45e2ed"; ctx.beginPath(); ctx.arc(x(last), y(values[last]), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = "10px Sarabun, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#b8cfcd";
    [0, Math.floor(last / 2), last].forEach(i => {
      const d = new Date(rows[i].observed_at);
      const label = state.hours === 168
        ? d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })
        : d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      ctx.fillText(label, x(i), height - 6);
    });
    ctx.fillStyle = "#45e2ed"; ctx.font = "700 11px Sarabun, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(numberLabel(values[last], 1), width - pad.r, Math.max(12, y(values[last]) - 7));
  }

  function drawWaterBalanceChart() {
    const canvas = typeof document !== "undefined" ? document.getElementById("waterBalanceMiniChart") : null;
    if (!canvas) return;
    const d = state.waterBalance.data;
    const rows = d ? d.trend.filter(row => row.quality === "GOOD" && row.inferred_loss_l_h !== null && row.time) : [];
    if (rows.length < 2) { drawEmptyChart(canvas, "N/A · ข้อมูลไม่ผ่านเกณฑ์"); return; }
    const setup = canvasContext(canvas, 126);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const values = rows.map(row => Number(row.inferred_loss_l_h));
    const max = Math.max(1000, Math.ceil(Math.max(...values) / 1000) * 1000);
    const pad = { l: 42, r: 12, t: 12, b: 24 };
    const x = i => pad.l + i / Math.max(1, values.length - 1) * (width - pad.l - pad.r);
    const y = value => height - pad.b - value / max * (height - pad.t - pad.b);
    ctx.strokeStyle = "rgba(173, 222, 219, .18)"; ctx.lineWidth = 1;
    [0, .5, 1].forEach(step => {
      const value = max * step;
      ctx.beginPath(); ctx.moveTo(pad.l, y(value)); ctx.lineTo(width - pad.r, y(value)); ctx.stroke();
      ctx.fillStyle = "#9abbb8"; ctx.font = "9px Sarabun, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(Math.round(value).toLocaleString("th-TH"), pad.l - 5, y(value) + 3);
    });
    const gradient = ctx.createLinearGradient(0, pad.t, 0, height - pad.b);
    gradient.addColorStop(0, "rgba(255, 191, 105, .26)");
    gradient.addColorStop(1, "rgba(255, 191, 105, 0)");
    ctx.beginPath(); values.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)));
    ctx.lineTo(x(values.length - 1), height - pad.b); ctx.lineTo(x(0), height - pad.b); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath(); values.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)));
    ctx.strokeStyle = "#ffbf69"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    const last = values.length - 1;
    ctx.fillStyle = "#ffbf69"; ctx.beginPath(); ctx.arc(x(last), y(values[last]), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d7e7e4"; ctx.font = "9px Sarabun, sans-serif"; ctx.textAlign = "center";
    [0, Math.floor(last / 2), last].forEach(index => {
      const date = new Date(rows[index].time);
      ctx.fillText(date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }), x(index), height - 7);
    });
    ctx.fillStyle = "#ffcf8b"; ctx.font = "700 10px Sarabun, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(Math.round(values[last]).toLocaleString("th-TH") + " L/ชม.", width - pad.r, Math.max(12, y(values[last]) - 7));
  }

  function drawPiHealthChart(canvasId, field, kind) {
    const canvas = typeof document !== "undefined" ? document.getElementById(canvasId) : null;
    if (!canvas) return;
    const configs = [
      ["PI5_CONTROLLER_01", "#45e2ed"],
      ["PI_ZERO_GATEWAY_01", "#67f2b1"]
    ];
    const history = state.piHealth.history || {};
    const allRows = configs.flatMap(([sourceId]) => history[sourceId] || []);
    const valid = allRows.filter(row => row.observed_epoch !== null && row[field] !== null);
    if (!valid.length) { drawEmptyChart(canvas, "กำลังสะสมข้อมูล"); return; }
    const setup = canvasContext(canvas, 118);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = { l: 34, r: 8, t: 10, b: 20 };
    const epochs = valid.map(row => Number(row.observed_epoch));
    const values = valid.map(row => Number(row[field]));
    const minT = Math.min(...epochs), maxT = Math.max(...epochs);
    let minY = kind === "temp" ? Math.floor((Math.min(...values) - 3) / 5) * 5 : 0;
    let maxY = kind === "temp" ? Math.ceil((Math.max(...values) + 3) / 5) * 5 : Math.max(1, Math.ceil(Math.max(...values) * 12) / 10);
    if (maxY <= minY) maxY = minY + 5;
    const x = epoch => pad.l + (epoch - minT) / Math.max(1, maxT - minT) * (width - pad.l - pad.r);
    const y = value => height - pad.b - (value - minY) / (maxY - minY) * (height - pad.t - pad.b);
    ctx.strokeStyle = "rgba(173, 222, 219, .18)";
    ctx.lineWidth = 1;
    [0, .5, 1].forEach(step => {
      const value = minY + (maxY - minY) * step;
      ctx.beginPath(); ctx.moveTo(pad.l, y(value)); ctx.lineTo(width - pad.r, y(value)); ctx.stroke();
      ctx.fillStyle = "#a9c4c1"; ctx.font = "9px Sarabun, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(kind === "temp" ? value.toFixed(0) + "°" : value.toFixed(2), pad.l - 4, y(value) + 3);
    });
    configs.forEach(([sourceId, color]) => {
      const rows = downsample((history[sourceId] || []).filter(row => row.observed_epoch !== null && row[field] !== null), 120);
      ctx.beginPath();
      rows.forEach((row, index) => index
        ? ctx.lineTo(x(Number(row.observed_epoch)), y(Number(row[field])))
        : ctx.moveTo(x(Number(row.observed_epoch)), y(Number(row[field]))));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    });
  }

  function mountChart() {
    drawGauge();
    drawDepthProfile();
    drawHistoryChart();
    drawWaterBalanceChart();
    drawPiHealthChart("piHealthTempChart", "temp_c", "temp");
    drawPiHealthChart("piHealthLoadChart", "load1", "load");
  }

  function setHours(hours) {
    state.hours = Number(hours) === 168 ? 168 : 24;
    state.loadedAt = 0;
    refresh(true);
  }

  root.SensorTelemetry = {
    SOURCE_ID,
    AUTO_REFRESH_MS,
    WEATHER_REFRESH_MS,
    WEATHER_MODELS_REFRESH_MS,
    state,
    finiteOrNull,
    normalizeCurrentResponse,
    normalizeWaterBalanceResponse,
    normalizeWeatherForecast,
    normalizeWeatherModelsSnapshot,
    forecastWindowLabel,
    weatherCodeInfo,
    weatherLocationCandidate,
    resolveWeatherLocation,
    weatherForecastUrl,
    refreshWeather,
    refreshWeatherModels,
    reservoirVisualState,
    statusMeta,
    historyRows,
    normalizePiHealthResponse,
    normalizePiHealthHistory,
    downsample,
    probeSafeBackend,
    refresh,
    shouldAutoRefresh,
    startAutoRefresh,
    refreshLocalPiHealth,
    refreshLocalWaterBalance,
    cardHtml,
    weatherHtml,
    weatherModelsHtml,
    piHealthHtml,
    waterBalanceHtml,
    mountChart,
    setHours
  };

  applyLocalPreview();
  if (root.FarmUltimateRuntime && root.FarmUltimateRuntime.hasLocalWaterBalance) {
    refreshLocalWaterBalance(true);
  }
  startAutoRefresh();
})(typeof window !== "undefined" ? window : globalThis);
