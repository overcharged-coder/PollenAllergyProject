/**
 * Summarize SPS30 Sensor Data by Day
 *
 * Reads raw SPS30 sensor readings from tblSPS30reads,
 * aggregates them by day (MAX per metric),
 * writes daily summaries to tblSPS30Sum,
 * and deletes processed raw rows.
 *
 * This keeps raw table lean while preserving daily extremes.
 */

/* =========================================================
 * Main Entry
 * ========================================================= */
function summarizeSensorDataByDay() {

  /* ==============================
   * Configuration
   * ============================== */

  const SPREADSHEET_ID = "15oiS0yNvA0eYxT0k7tcxXNtDK_DriqR5yzsTbkvitQQ";
  const SOURCE_SHEET_NAME = "tblSPS30reads";
  const SUMMARY_SHEET_NAME = "tblSPS30Sum";
  const TIMESTAMP_COLUMN_NAME = "Timestamp";

  /* ==============================
   * Open Spreadsheet & Sheets
   * ============================== */

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

  if (!sourceSheet || !summarySheet) {
    Logger.log("❌ Required sheet not found.");
    return;
  }

  const data = sourceSheet.getDataRange().getValues();
  if (data.length <= 1) return; // No data rows

  const headers = data[0];
  const timestampIndex = headers.indexOf(TIMESTAMP_COLUMN_NAME);

  if (timestampIndex === -1) {
    Logger.log("❌ Timestamp column not found.");
    return;
  }

  /* ==============================
   * Aggregate Rows by Day
   * ============================== */

  const dayBuckets = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const timestamp = new Date(row[timestampIndex]);
    if (isNaN(timestamp)) continue;

    const dateKey = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!dayBuckets[dateKey]) {
      dayBuckets[dateKey] = {
        maxValues: [...row],
        rowIndices: []
      };
    }

    // Compute max per metric (skip timestamp column)
    for (let j = 0; j < row.length; j++) {
      if (j === timestampIndex) continue;

      const current = Number(row[j]);
      const existing = Number(dayBuckets[dateKey].maxValues[j]);

      if (!isNaN(current) && (isNaN(existing) || current > existing)) {
        dayBuckets[dateKey].maxValues[j] = current;
      }
    }

    // Store 1-based row index for deletion
    dayBuckets[dateKey].rowIndices.push(i + 1);
  }

  /* ==============================
   * Write Summary Header (Once)
   * ============================== */

  if (summarySheet.getLastRow() === 0) {
    const summaryHeader = ["Date", ...headers.filter(h => h !== TIMESTAMP_COLUMN_NAME)];
    summarySheet.appendRow(summaryHeader);
  }

  /* ==============================
   * Append Daily Summary Rows
   * ============================== */

  Object.keys(dayBuckets).sort().forEach(date => {
    const values = dayBuckets[date].maxValues;

    const summaryRow = [date];
    for (let j = 0; j < values.length; j++) {
      if (j === timestampIndex) continue;

      const v = values[j];
      summaryRow.push(
        typeof v === "number" ? Number(v.toFixed(2)) : v
      );
    }

    summarySheet.appendRow(summaryRow);
  });

  /* ==============================
   * Delete Processed Raw Rows
   * ============================== */

  const rowsToDelete = Object.values(dayBuckets)
    .flatMap(bucket => bucket.rowIndices)
    .sort((a, b) => b - a); // Descending order

  rowsToDelete.forEach(rowIndex => {
    sourceSheet.deleteRow(rowIndex);
  });
}
