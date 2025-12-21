/**
 * Fetch daily pollen forecast from Google Pollen API
 * and store detailed + summarized results in Google Sheets.
 *
 * Sheets used:
 *  - tblPollenAPI : detailed daily pollen breakdown
 *  - tblToday    : summarized pollen rating for today
 */
function getPollenForecast() {

  /* ==============================
   * Configuration
   * ============================== */

  const API_KEY = "YOUR_API_KEY_HERE"; // 🔒 Move to PropertiesService for production
  const LATITUDE = 39.9612;
  const LONGITUDE = -82.9988;
  const DAYS = 1;

  const SPREADSHEET_ID = "15oiS0yNvA0eYxT0k7tcxXNtDK_DriqR5yzsTbkvitQQ";
  const DETAIL_SHEET_NAME = "tblPollenAPI";
  const SUMMARY_SHEET_NAME = "tblToday";

  const TARGET_PLANT_CODES = new Set([
    "ALDER", "ASH", "BIRCH", "COTTONWOOD", "ELM",
    "GRAMINALES", "JUNIPER", "MAPLE", "OAK", "PINE", "RAGWEED"
  ]);

  /* ==============================
   * Build API URL
   * ============================== */

  const url =
    `https://pollen.googleapis.com/v1/forecast:lookup` +
    `?key=${API_KEY}` +
    `&location.latitude=${LATITUDE}` +
    `&location.longitude=${LONGITUDE}` +
    `&days=${DAYS}`;

  /* ==============================
   * Fetch API Response
   * ============================== */

  let json;
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    json = JSON.parse(response.getContentText());
  } catch (err) {
    Logger.log("API fetch failed: " + err);
    return;
  }

  if (!json || !json.dailyInfo) {
    Logger.log("No dailyInfo returned from API.");
    return;
  }

  /* ==============================
   * Open Spreadsheet & Sheets
   * ============================== */

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const detailSheet = ss.getSheetByName(DETAIL_SHEET_NAME);
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

  if (!detailSheet || !summarySheet) {
    Logger.log("One or more sheets not found.");
    return;
  }

  /* ==============================
   * Process Daily Forecast
   * ============================== */

  json.dailyInfo.forEach(day => {

    /* ---- Format Date (DD/MM/YYYY) ---- */
    const { year, month, day: dayNum } = day.date;
    const formattedDate =
      `${String(dayNum).padStart(2, "0")}/` +
      `${String(month).padStart(2, "0")}/` +
      `${year}`;

    const pollenTypes = (day.pollenTypeInfo || [])
      .slice()
      .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));

    const plantTypes = (day.plantInfo || [])
      .slice()
      .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));

    let totalPollenScore = 0;
    const row = [formattedDate];

    /* ---- Add Pollen Type Indices ---- */
    pollenTypes.forEach(type => {
      const value = Number(type.indexInfo?.value) || 0;
      row.push(value);
      totalPollenScore += value;
    });

    /* ---- Add Selected Plant Indices ---- */
    plantTypes.forEach(plant => {
      if (TARGET_PLANT_CODES.has(plant.code)) {
        const value = Number(plant.indexInfo?.value) || 0;
        row.push(value);
        totalPollenScore += value;
      }
    });

    /* ---- Add Formula-Based Rating ---- */
    const nextRow = detailSheet.getLastRow() + 1;
    const ratingFormula = `="Pollen Rating: " & SUM(B${nextRow}:O${nextRow})`;
    row.push(ratingFormula);

    /* ---- Write Detail Row ---- */
    detailSheet.appendRow(row);

    /* ==============================
     * Write Summary (Today)
     * ============================== */

    const summaryRow = [
      formattedDate,
      "Pollen Rating",
      totalPollenScore
    ];

    summarySheet.getRange(2, 1, 1, summaryRow.length)
      .setValues([summaryRow]);
  });
}
