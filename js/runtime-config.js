/* FARMULTIMATE runtime endpoints.
   Shared code contains no private host, LAN address, credential, or farm location.
   A machine-local integration may provide globalThis.FarmUltimateLocalConfig
   before this file loads. Missing values fail closed. */
(function (root) {
  "use strict";

  const localConfig = root.FarmUltimateLocalConfig && typeof root.FarmUltimateLocalConfig === "object"
    ? root.FarmUltimateLocalConfig
    : {};

  function endpoint(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const parsed = new URL(text);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href.replace(/\/$/, "") : "";
    } catch (error) {
      return "";
    }
  }

  const LEGACY_API = endpoint(root.FARMULTIMATE_PUBLIC_API_URL);
  const OWNER_CANARY_API = endpoint(localConfig.ownerCanaryApiUrl);
  const LOCAL_PI_HEALTH_API = endpoint(localConfig.localPiHealthApiUrl);
  const LOCAL_WATER_BALANCE_PI5_API = endpoint(localConfig.localWaterBalanceApiUrl);
  const OWNER_STAGING_HOSTS = new Set(
    (Array.isArray(localConfig.ownerStagingHosts) ? localConfig.ownerStagingHosts : [])
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );

  function sameOriginApi(url) {
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}/api`;
  }

  function resolveRuntime(href) {
    let url;
    try { url = new URL(String(href || "")); }
    catch (error) { url = new URL("http://localhost/"); }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const deployed = !local && (url.protocol === "https:" || url.protocol === "http:");
    const cloudStaging = Boolean(
      deployed &&
      url.protocol === "https:" &&
      OWNER_STAGING_HOSTS.has(url.hostname.toLowerCase())
    );
    const localOwnerCanary = Boolean(
      OWNER_CANARY_API &&
      local &&
      url.searchParams.get("api") === "owner-canary"
    );
    const ownerCanary = localOwnerCanary || cloudStaging;
    const realSensorStaging = Boolean(
      ownerCanary &&
      (cloudStaging || (local && url.searchParams.get("sensorData") === "real"))
    );
    const apiUrl = localOwnerCanary
      ? OWNER_CANARY_API
      : deployed
        ? sameOriginApi(url)
        : LEGACY_API;
    return Object.freeze({
      apiUrl,
      apiMode: localOwnerCanary ? "owner-canary" : deployed ? "same-origin" : "local-public",
      isSameOriginApi: Boolean(deployed && apiUrl),
      isOwnerCanary: ownerCanary,
      isRealSensorStaging: realSensorStaging,
      isCloudStaging: cloudStaging,
      storageNamespace: ownerCanary ? "owner-canary" : "",
      isLocalHost: local,
      hasLocalPiHealth: Boolean(local && LOCAL_PI_HEALTH_API),
      piHealthApiUrl: local ? LOCAL_PI_HEALTH_API : "",
      hasLocalWaterBalance: Boolean(local && LOCAL_WATER_BALANCE_PI5_API),
      waterBalanceApiUrl: local ? LOCAL_WATER_BALANCE_PI5_API : "",
      waterBalanceSource: local && LOCAL_WATER_BALANCE_PI5_API ? "PI5_LIVE_GET_ONLY" : ""
    });
  }

  const href = root.location && root.location.href ? root.location.href : "";
  const runtime = resolveRuntime(href);
  root.FarmUltimateRuntime = runtime;
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.apiMode = runtime.apiMode;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
