# 🌿 Pollen, Weather, Air Quality, and Sensor Dashboard (Google Sheets + Apps Script)

Turn a plain Google Sheet into a lightweight environmental dashboard for Central Ohio.

This Apps Script bundle pulls:
* **Current air quality** (Google Air Quality API) for **Columbus, OH**
* **Daily pollen forecast** (Google Pollen API) for **Columbus, OH**
* **Next day weather forecast** (Open Meteo) for **Powell, OH** and computes a **pollen risk level**
* **SPS30 sensor rollups** by day (max per metric) to keep raw logs lean and your insights clean

Everything lands in Google Sheets, with a single **tblToday** tab acting like your “today” dashboard.

---

## ✨ What you get

### ✅ Automated data ingestion into Sheets
* Air quality AQI and category plus pollutant concentrations saved to **tblAirQualityAPI**
* Pollen forecast broken down by type and selected plants saved to **tblPollenAPI**
* Tomorrow’s forecast plus computed pollen risk saved to **tblMeteoAPI**
* SPS30 raw readings summarized by day into **tblSPS30Sum**, then raw rows removed

### ✅ A simple dashboard row set
**tblToday** is updated with friendly summaries you can reference in charts, conditional formatting, or a front page.

---

## 🧱 Sheet layout (tabs and expected structure)

Create these tabs in your Google Sheet (names must match exactly unless you change constants):

### `tblToday` (dashboard)
Used as a compact “headline” table.

* Row 2: Pollen rating summary (written by `getPollenForecast`)
* Row 3: Weather based pollen level summary (written by `getPowellWeatherForecast`)
* Row 4: Air quality category summary (written by `getGoogleAirQuality`)

Each summary row is written in columns A to C as:
* **A:** Date (DD/MM/YYYY)
* **B:** Metric label
* **C:** Metric value

### `tblAirQualityAPI` (detailed)
Appends one row per run:
1. Date (DD/MM/YYYY)
2. AQI
3. AQI Category
4. PM2.5
5. PM10
6. O3
7. NO2
8. SO2
9. CO (ppm, converted from µg/m³ using an approximation)

### `tblMeteoAPI` (detailed)
Appends one row per run:
1. Date (DD/MM/YYYY)
2. Temp max (F)
3. Temp min (F)
4. Precipitation sum (Open Meteo default units)
5. Wind speed max (mph)
6. Pollen level (Low, Moderate, High, Very High)
7. Explanation string

### `tblPollenAPI` (detailed)
Appends one row per day returned:
* Date (DD/MM/YYYY)
* Index values for pollen types (sorted by code)
* Index values for selected plants (ALDER, ASH, BIRCH, COTTONWOOD, ELM, GRAMINALES, JUNIPER, MAPLE, OAK, PINE, RAGWEED)
* A final “Pollen Rating” formula column

Tip: add a header row once you see what columns your API returns, then keep the script consistent with that ordering.

### `tblSPS30reads` (raw sensor feed)
Must contain a column named **Timestamp** plus any SPS30 metric columns you log.

### `tblSPS30Sum` (daily rollups)
The script will add a header automatically if the sheet is empty, then append:
* Date (YYYY-MM-DD)
* Daily max per metric (rounded to 2 decimals when numeric)

---

## 🔐 API keys and secrets (recommended setup)

For production, store keys in **Apps Script Properties** instead of hardcoding.

### Add Script Properties
In Apps Script:
1. Project Settings
2. Script Properties
3. Add:

* `GOOGLE_AIR_QUALITY_API_KEY`
* `GOOGLE_POLLEN_API_KEY`

Then load them like this:

```js
const AIR_KEY = PropertiesService.getScriptProperties().getProperty("GOOGLE_AIR_QUALITY_API_KEY");
const POLLEN_KEY = PropertiesService.getScriptProperties().getProperty("GOOGLE_POLLEN_API_KEY");
