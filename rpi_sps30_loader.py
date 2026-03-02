"""
SPS30 → Google Sheets Logger

Reads particulate measurements from an SPS30 sensor over I2C and appends a single
timestamped row into a Google Sheet (worksheet: tblSPS30reads).

What it writes (in order):
- Timestamp (ISO 8601, seconds resolution)
- Mass concentrations: pm1p0, pm2p5, pm4p0, pm10p0
- Number concentrations: nc0p5, nc1p0, nc2p5, nc4p0, nc10p0
- typical particle size: typical

Notes:
- This script appends one row per execution.
- In production, consider running this on a schedule (cron/systemd) and adding
  retry logic around I2C reads and network calls.
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
from time import sleep
from datetime import datetime

from sps30 import SPS30


# =============================================================================
# Google Sheets setup
# =============================================================================

# OAuth scopes required to read/write Google Sheets via a service account
SHEETS_SCOPE = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]

# Service account JSON file downloaded from Google Cloud
CREDENTIALS_FILE = "credentials.json"

# Spreadsheet ID extracted from the Google Sheets URL
SPREADSHEET_ID = "15oiS0yNvA0eYxT0k7tcxXNtDK_DriqR5yzsTbkvitQQ"

# Target worksheet/tab name inside the spreadsheet
WORKSHEET_NAME = "tblSPS30reads"


def get_worksheet():
    """
    Authenticate using a service account and return a gspread Worksheet object.
    """
    creds = ServiceAccountCredentials.from_json_keyfile_name(
        CREDENTIALS_FILE,
        SHEETS_SCOPE
    )
    client = gspread.authorize(creds)
    return client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME)


# =============================================================================
# SPS30 sensor read
# =============================================================================

def read_sps30_once(sps: SPS30, poll_interval_s: float = 0.5):
    """
    Wait until the SPS30 indicates data is ready, then read measured values once.

    Returns:
        dict: sps.dict_values containing measurement fields.
    """
    # Wait until data is ready to read
    while not sps.read_data_ready_flag():
        print("Waiting for SPS30 data...")
        sleep(poll_interval_s)

    # Populate sps.dict_values with the latest measurements
    sps.read_measured_values()

    # Print values nicely
    print("\n--- SPS30 Measurements ---")
    for key, value in sps.dict_values.items():
        # Some fields might not be numeric; protect formatting just in case
        try:
            print(f"{key}: {float(value):.2f}")
        except (TypeError, ValueError):
            print(f"{key}: {value}")

    return sps.dict_values


def build_row(vals: dict):
    """
    Convert SPS30 values dict into a Google Sheets row aligned with expected columns.
    """
    return [
        datetime.now().isoformat(timespec="seconds"),
        vals["pm1p0"],
        vals["pm2p5"],
        vals["pm4p0"],
        vals["pm10p0"],
        vals["nc0p5"],
        vals["nc1p0"],
        vals["nc2p5"],
        vals["nc4p0"],
        vals["nc10p0"],
        vals["typical"],
    ]


# =============================================================================
# Main
# =============================================================================

def main():
    """
    Main entry: connect to Google Sheets, read SPS30 once, append row, cleanup.
    """
    # Open worksheet first so we fail fast if credentials or Sheet access is wrong
    sheet = get_worksheet()

    # Initialize SPS30 on I2C bus 1 (common on Raspberry Pi)
    sps = SPS30(1)

    try:
        # Many setups prefer starting clean
        sps.stop_measurement()
        print("Measurement stopped. Sleeping 3 seconds...")

        # If you want continuous measurement, uncomment:
        # sps.start_measurement()

        print("Measurement started (if enabled).")
        sleep(3)

        # Read once
        vals = read_sps30_once(sps)

        # Build the row and append to Google Sheets
        row = build_row(vals)
        sheet.append_row(row)

        print("\nSent to Google Sheets:")
        print(row)

    except OSError as e:
        # Typically I2C communication errors
        print("I2C error while communicating with SPS30:", e)
        try:
            sps.stop_measurement()
        except OSError:
            pass
        raise

    finally:
        # Always attempt to stop measurement to leave sensor in a known state
        try:
            sps.stop_measurement()
            print("Measurement stopped.")
        except OSError as e:
            print("I2C error during stop_measurement():", e)


if __name__ == "__main__":
    main()
