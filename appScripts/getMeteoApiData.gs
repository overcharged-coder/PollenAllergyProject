/**
 * Fetch next-day weather forecast for Powell, OH using Open-Meteo API
 * and compute a pollen risk score based on weather conditions.
 *
 * Sheets used:
 *  - tblMeteoAPI : daily weather + pollen risk details
 *  - tblToday   : summarized pollen risk for today dashboard
 */

/* =========================================================
 * Main Function
 * ========================================================= */
function getPowellWeatherForecast() {

  /* ==============================
   * Configuration
   * ============================== */

  const SPREADSHEET_ID = "15oiS0yNvA0eYxT0k7tcxXNtDK_DriqR5yzsTbkvitQQ";
  const DETAIL_SHEET_NAME = "tblMeteoAPI";
  const SUMMARY_SHEET_NAME = "tblToday";

  const LATITUDE = 40.1578;   // Powell, OH
  const LONGITUDE = -83.0752;
  const TIMEZONE = "America/New_York";

  /* ==============================
   * Open Spreadsheet & Sheets
   * ============================== */

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const detailSheet = ss.getSheetByName(DETAIL_SHEET_NAME);
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

  if (!detailSheet || !summarySheet) {
    Logger.log("Required sheet not found.");
    return;
  }

  /* ==============================
   * Compute Tomorrow's Date (YYYY-MM-DD)
   * ============================== */

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const dd = String(tomorrow.getDate()).padStart(2, "0");
  const apiDate = `${yyyy}-${mm}-${dd}`;

  /* ==============================
   * Build Open-Meteo API URL
   * ============================== */

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LATITUDE}` +
    `&longitude=${LONGITUDE}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max` +
    `&start_date=${apiDate}` +
    `&end_date=${apiDate}` +
    `&timezone=${TIMEZONE}` +
    `&temperature_unit=fahrenheit` +
    `&windspeed_unit=mph`;

  /* ==============================
   * Fetch API Response
   * ============================== */

  let data;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    data = JSON.parse(response.getContentText());
  } catch (err) {
    Logger.log("Weather API fetch failed: " + err);
    return;
  }

  if (!data || !data.daily) {
    Logger.log("No daily weather data returned.");
    return;
  }

  const daily = data.daily;

  /* ==============================
   * Format Display Date (DD/MM/YYYY)
   * ============================== */

  const displayDate = Utilities.formatDate(
    new Date(daily.time[0]),
    Session.getScriptTimeZone(),
    "dd/MM/yyyy"
  );

  /* ==============================
   * Calculate Pollen Risk
   * ============================== */

  const risk = calculatePollenRisk(
    daily.temperature_2m_max[0],
    daily.temperature_2m_min[0],
    daily.precipitation_sum[0],
    daily.windspeed_10m_max[0]
  );

  /* ==============================
   * Write Detail Row
   * ============================== */

  const detailRow = [
    displayDate,
    daily.temperature_2m_max[0],
    daily.temperature_2m_min[0],
    daily.precipitation_sum[0],
    daily.windspeed_10m_max[0],
    risk.level,
    risk.explanation
  ];

  detailSheet.appendRow(detailRow);

  /* ==============================
   * Write Summary Row (Dashboard)
   * ============================== */

  const cleanLevel = risk.level.replace(/^Pollen Level\s*:\s*/, "");

  const summaryRow = [
    displayDate,
    "Weather Pollen Level",
    cleanLevel
  ];

  summarySheet
    .getRange(3, 1, 1, summaryRow.length)
    .setValues([summaryRow]);
}

/* =========================================================
 * Helper: Calculate Pollen Risk from Weather Inputs
 * ========================================================= */
function calculatePollenRisk(tempMax, tempMin, precipitation, windSpeed) {

  let score = 0;
  const reasons = [];

  /* ---- Temperature (Max) ---- */
  if (tempMax >= 60 && tempMax <= 85) {
    score += 2;
    reasons.push("Ideal temperature for pollen activity");
  } else if (tempMax < 50 || tempMax > 90) {
    reasons.push("Temperature less favorable for pollen release");
  }

  /* ---- Temperature (Min) ---- */
  if (tempMin > 50) {
    score += 1;
    reasons.push("Warm nights support pollen release");
  }

  /* ---- Precipitation ---- */
  if (precipitation < 1) {
    score += 3;
    reasons.push("Very low rain — pollen not being washed out");
  } else if (precipitation <= 3) {
    score += 1;
    reasons.push("Light rain — limited impact on pollen");
  } else {
    reasons.push("Heavy rain suppresses pollen");
  }

  /* ---- Wind Speed ---- */
  if (windSpeed >= 5 && windSpeed <= 15) {
    score += 2;
    reasons.push("Moderate wind spreads pollen");
  } else if (windSpeed > 15) {
    score += 3;
    reasons.push("Strong wind causes high pollen dispersion");
  } else {
    reasons.push("Calm wind — low pollen spread");
  }

  /* ---- Determine Risk Level ---- */
  let level;
  if (score >= 9) level = "Pollen Level : Very High";
  else if (score >= 6) level = "Pollen Level : High";
  else if (score >= 3) level = "Pollen Level : Moderate";
  else level = "Pollen Level : Low";

  return {
    score,
    level,
    explanation: reasons.join("; ")
  };
}
