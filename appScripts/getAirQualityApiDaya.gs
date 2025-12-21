/**
 * Google Air Quality API → Google Sheets
 *
 * Fetches current air quality conditions for Columbus, OH
 * and writes:
 *  - Detailed pollutant data to tblAirQualityAPI
 *  - Summary AQI category to tblToday
 */

/* =========================================================
 * Main Entry
 * ========================================================= */
function getGoogleAirQuality() {

  /* ==============================
   * Configuration
   * ============================== */

  const API_KEY = "YOUR_API_KEY_HERE"; // 🔐 Store in PropertiesService in production
  const LATITUDE = 39.9612;
  const LONGITUDE = -82.9988;

  const SPREADSHEET_ID = "15oiS0yNvA0eYxT0k7tcxXNtDK_DriqR5yzsTbkvitQQ";
  const DETAIL_SHEET_NAME = "tblAirQualityAPI";
  const SUMMARY_SHEET_NAME = "tblToday";

  /* ==============================
   * Build API Request
   * ============================== */

  const url =
    `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`;

  const payload = {
    location: {
      latitude: LATITUDE,
      longitude: LONGITUDE
    },
    extraComputations: ["POLLUTANT_CONCENTRATION"],
    languageCode: "en"
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  /* ==============================
   * Fetch & Parse Response
   * ============================== */

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (!data || !Array.isArray(data.indexes) || data.indexes.length === 0) {
      Logger.log("No AQI data returned from Google Air Quality API.");
      return;
    }

    /* ==============================
     * Extract AQI + Pollutants
     * ============================== */

    const index = data.indexes[0];

    const pollutantMap = {};
    if (Array.isArray(data.pollutants)) {
      data.pollutants.forEach(p => {
        pollutantMap[p.code] = p.concentration?.value ?? "N/A";
      });
    }

    const formattedDate = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "dd/MM/yyyy"
    );

    /* ==============================
     * Build Detail Row
     * ============================== */

    const detailRow = [
      formattedDate,
      index.aqi || "N/A",
      index.category ? index.category.trim() : "N/A",
      pollutantMap["pm25"] || "N/A",
      pollutantMap["pm10"] || "N/A",
      pollutantMap["o3"] || "N/A",
      pollutantMap["no2"] || "N/A",
      pollutantMap["so2"] || "N/A",
      convertCOtoPPM(pollutantMap["co"])
    ];

    /* ==============================
     * Write to Sheets
     * ============================== */

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const detailSheet = ss.getSheetByName(DETAIL_SHEET_NAME);
    const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

    if (!detailSheet || !summarySheet) {
      Logger.log("One or more required sheets not found.");
      return;
    }

    detailSheet.appendRow(detailRow);

    const summaryRow = [
      formattedDate,
      "Air Quality Rating",
      index.category ? index.category.trim() : "N/A"
    ];

    summarySheet
      .getRange(4, 1, 1, summaryRow.length)
      .setValues([summaryRow]);

  } catch (err) {
    Logger.log("❌ Google Air Quality error: " + err.message);
  }
}

/* =========================================================
 * Helper: Convert CO µg/m³ → ppm (approx)
 * ========================================================= */
function convertCOtoPPM(value) {
  if (value === undefined || value === null || value === "N/A") return "N/A";
  return roundTo(Number(value) / 1145, 2);
}

/* =========================================================
 * Helper: Round to N decimals
 * ========================================================= */
function roundTo(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
