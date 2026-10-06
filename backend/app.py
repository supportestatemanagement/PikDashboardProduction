import os
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import base64
import re
import datetime
import threading
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import json
from collections import defaultdict
from dashboard_auth import register_dashboard_auth
from firebase_admin_service import create_dashboard_token
from disaster_maritime import register_maritime_routes
from disaster_enso import register_enso_routes
from water_distribution import build_water_locations
from pump_sea_level import apply_sea_levels
from customer_service import register_customer_service_routes
from crisis_room import register_crisis_room

# Menggunakan RapidOCR (Ringan, Cepat, dan Akurat untuk Angka CCTV)
from rapidocr_onnxruntime import RapidOCR

app = Flask(__name__)
register_crisis_room(app)
register_maritime_routes(app)
register_enso_routes(app)

# --- KONFIGURASI CORS & PAYLOAD ---
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 

# ================= INISIALISASI RAPIDOCR =================
print("Memuat Model RapidOCR...")
engine = RapidOCR()
print("RapidOCR Siap!")

# ================= GOOGLE SHEETS SETUP =================
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]

creds_json = os.environ.get('GOOGLE_CREDENTIALS')
if creds_json:
    creds_dict = json.loads(creds_json)
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
else:
    # Fallback lokal
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)

client = gspread.authorize(creds)
spreadsheet = client.open("PIK Dashboard")

cc_spreadsheet = client.open("Master Data Dashboard")
register_customer_service_routes(app, lambda: cc_spreadsheet.worksheet("CustomerRelation").get_all_records(numericise_ignore=['all']))
cc_sheet = cc_spreadsheet.worksheet("CallCenter")
cctv2026_sheet = cc_spreadsheet.worksheet("CCTV")
perparkiran_sheet = cc_spreadsheet.worksheet("Perparkiran")
pump_station_sheet = cc_spreadsheet.worksheet("PumpStation")


@app.get('/api/lot-parking-data')
def get_lot_parking_data():
    try:
        records = spreadsheet.worksheet("SPI_Parking").get_all_records(numericise_ignore=['all'])
        columns = ('received_at_wib', 'sitename', 'car_capacity', 'bike_capacity', 'car_qty', 'bike_qty')
        rows = [{column: row.get(column, '') for column in columns} for row in records]
        response = jsonify({"status": "success", "data": rows})
        response.headers['Cache-Control'] = 'no-store'
        return response
    except Exception:
        app.logger.exception('Unable to load SPI_Parking')
        return jsonify({"status": "error", "message": "Tidak dapat memuat SPI_Parking."}), 500

TRAFFIC_SHEETS = {
    "summary": spreadsheet.worksheet("AllCheckpoint"),
    "hourly": spreadsheet.worksheet("CheckpointHour"),
}

TRAFFIC_SUMMARY_COLUMNS = [
    "CP-BGM", "VehicleIN-BGM", "CP-Linggi", "VehicleIN-GI",
    "CP-Tataban", "VehicleIN-RWI", "CP-Baruyungan",
    "CP-TollKataraja", "VehicleIN-PIK2", "TotalPengunjung",
]
TRAFFIC_HOURLY_COLUMNS = [
    "CP-BGM", "CP-Linggi", "CP-Tataban", "CP-Baruyungan",
    "CP-TollKataraja",
]


def parse_sheet_date(value):
    """Parse the date formats currently used by the traffic worksheets."""
    text = str(value or "").strip()
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    return None


def integer_value(value):
    if isinstance(value, (int, float)):
        return int(round(value))
    cleaned = re.sub(r"[^0-9-]", "", str(value or ""))
    try:
        return int(cleaned) if cleaned not in ("", "-") else 0
    except ValueError:
        return 0


def normalized_column_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def record_value(record, column):
    """Read a sheet column without depending on spaces or dash formatting."""
    wanted = normalized_column_key(column)
    for key, value in record.items():
        if normalized_column_key(key) == wanted:
            return value
    return None


def numeric_level(value):
    text = str(value or "").strip().replace(" ", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def normalize_pump_status(value):
    text = str(value or "").strip()
    if not text:
        return None
    normalized = text.lower().replace("stand by", "standby").replace("stby", "standby")
    if normalized == "standby":
        return "Standby"
    match = re.fullmatch(r"(?:run\s*)?(\d+)", normalized)
    return f"Run {match.group(1)}" if match else text.title()


def parse_pump_record(row):
    date_value = record_value(row, "TANGGAL")
    date_parsed = parse_sheet_date(date_value)
    if not date_parsed:
        return None
    time_value = str(record_value(row, "JAM") or "").strip()
    time_match = re.search(r"(\d{1,2}):(\d{2})", time_value)
    if not time_match:
        return None
    time_key = f"{int(time_match.group(1)):02d}:{time_match.group(2)}"
    result = {
        "date": date_parsed.isoformat(), "time": time_key,
        "weather": record_value(row, "CUACA") or None,
        "tds": numeric_level(record_value(row, "TDS")),
        "twa": numeric_level(record_value(row, "LEVEL TWA")),
        "sea": numeric_level(record_value(row, "LAUT")),
        "stations": {},
    }
    for station in ("PS1", "PS2", "PS3", "PS4"):
        result["stations"][station] = {
            "level": numeric_level(record_value(row, f"LEVEL {station}")),
            "status": normalize_pump_status(record_value(row, f"STATUS {station}")),
        }
    return result


def load_pump_records(sea_values=None):
    records = []
    # Read formatted cell text so decimal commas (for example -1,97) are not
    # numericised by gspread into -197 before numeric_level parses them.
    values = pump_station_sheet.get_all_values()
    headers = values[0] if values else []
    for cells in values[1:]:
        row = dict(zip(headers, cells + [""] * max(0, len(headers) - len(cells))))
        parsed = parse_pump_record(row)
        if not parsed:
            continue
        # Keep same-hour updates: changes in pump counts represent starts/stops.
        records.append(parsed)
    # Merge hourly AirLaut observations, preserving same-hour pump updates.
    if sea_values is None:
        sea_values = cc_spreadsheet.worksheet("AirLaut").get_all_values()
    return apply_sea_levels(records, sea_values)


@app.route('/api/pump-peak-events', methods=['GET'])
def get_pump_peak_events():
    try:
        today = datetime.date.today()
        start_date = datetime.datetime.strptime(request.args.get("startDate", today.isoformat()), "%Y-%m-%d").date()
        end_date = datetime.datetime.strptime(request.args.get("endDate", today.isoformat()), "%Y-%m-%d").date()
        station_filter = request.args.get("station", "ALL").strip().upper().replace("SEA LEVEL", "SEA")
        limit = min(max(int(request.args.get("limit", 5)), 1), 50)
        if start_date > end_date:
            return jsonify({"status": "error", "message": "startDate must be before endDate"}), 400

        sea_values = cc_spreadsheet.worksheet("AirLaut").get_all_values()
        sea_records = [row for row in apply_sea_levels([], sea_values) if start_date <= datetime.date.fromisoformat(row["date"]) <= end_date]
        sea_readings = [row["sea"] for row in sea_records if row["sea"] is not None]
        records = [row for row in load_pump_records(sea_values) if start_date <= datetime.date.fromisoformat(row["date"]) <= end_date]
        events = []
        for row in records:
            context = {key: row[key] for key in ("weather", "sea", "twa", "tds") if row.get(key) is not None}
            for station, values in row["stations"].items():
                if values["level"] is not None:
                    events.append({"station": station, "level": values["level"], "status": values["status"], "date": row["date"], "time": row["time"], **context})
            if row["sea"] is not None:
                events.append({"station": "SEA", "level": row["sea"], "date": row["date"], "time": row["time"], **context})
            if row["twa"] is not None:
                events.append({"station": "TWA", "level": row["twa"], "date": row["date"], "time": row["time"], **context})

        unique_events = {}
        for event in events:
            unique_events[(event["station"], event["date"], event["time"])] = event
        events = list(unique_events.values())
        filtered_events = events if station_filter == "ALL" else [event for event in events if event["station"] == station_filter]
        pump_sea = sorted((event for event in filtered_events if event["station"] != "TWA"), key=lambda event: event["level"], reverse=True)[:limit]
        twa_events = sorted((event for event in filtered_events if event["station"] == "TWA"), key=lambda event: event["level"], reverse=True)[:limit]

        station_peaks = []
        for station in ("PS1", "PS2", "PS3", "PS4", "TWA", "SEA"):
            station_events = [event for event in events if event["station"] == station]
            if station_events:
                station_peaks.append(max(station_events, key=lambda event: event["level"]))

        status_summary = defaultdict(int)
        pump_status_events = []
        for row in records:
            for pump_name, values in row["stations"].items():
                if values.get("status"):
                    status_summary[values["status"]] += 1
                    pump_status_events.append({
                        "station": pump_name,
                        "status": values["status"],
                        "date": row["date"],
                        "time": row["time"],
                    })

        range_days = (end_date - start_date).days + 1
        chart_mode = "monthly" if range_days >= 62 else "observations"
        chart_map = {}
        pump_records = [row for row in records if not row.get("seaOnly")]
        if station_filter == "ALL":
            chart_stations = ("PS1", "PS2", "PS3", "PS4", "TWA", "SEA")
        elif station_filter == "TWA":
            chart_stations = ("TWA",)
        else:
            chart_stations = (station_filter,)
        for event in events:
            if event["station"] not in chart_stations:
                continue
            bucket = event["date"][:7] if chart_mode == "monthly" else f'{event["date"]} {event["time"]}'
            chart_map.setdefault(bucket, {})
            current = chart_map[bucket].get(event["station"])
            chart_map[bucket][event["station"]] = event["level"] if current is None else max(current, event["level"])

        latest = pump_records[-1] if pump_records else (records[-1] if records else None)
        if chart_mode == "observations" and "SEA" in chart_stations:
            for row in records:
                chart_map.setdefault(f'{row["date"]} {row["time"]}', {}).setdefault("SEA", row["sea"])
        level_range = {}
        for station in ("PS1", "PS2", "PS3", "PS4", "SEA", "TWA"):
            values = [event["level"] for event in events if event["station"] == station]
            if values:
                level_range[station] = {"highest": max(values), "lowest": min(values)}
        run_occurrences = defaultdict(int)
        for row in records:
            for values in row["stations"].values():
                if (values.get("status") or "").startswith("Run"):
                    run_occurrences[values["status"]] += 1
        expected_values = len(pump_records) * 5 + len(records)
        actual_values = sum(1 for row in records for value in [row["twa"], row["sea"], *[item["level"] for item in row["stations"].values()]] if value is not None)
        latest_payload = None
        if latest:
            latest_payload = {
                "date": latest["date"], "time": latest["time"], "weather": latest["weather"],
                "tds": latest["tds"], "twa": latest["twa"], "sea": latest["sea"],
                "stations": latest["stations"],
            }

        return jsonify({
            "status": "success", "range": {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
            "station": station_filter, "pumpSeaEvents": pump_sea, "twaEvents": twa_events,
            "stationPeaks": station_peaks,
            "statusSummary": dict(status_summary), "pumpStatusEvents": pump_status_events,
            "chartMode": chart_mode,
            "chart": [{"period": key, **values} for key, values in sorted(chart_map.items())],
            "analytics": {
                "seaLevelSheet": {
                    "latest": {"date": sea_records[-1]["date"], "time": sea_records[-1]["time"], "sea": sea_records[-1]["sea"]} if sea_records else None,
                    "highest": max(sea_readings) if sea_readings else None,
                    "lowest": min(sea_readings) if sea_readings else None,
                    "hours": [{"period": f'{row["date"]} {row["time"]}', "SEA": row["sea"]} for row in sea_records],
                },
                "latest": latest_payload, "levelRange": level_range,
                "latestSea": {"date": records[-1]["date"], "time": records[-1]["time"], "sea": records[-1]["sea"]} if records else None,
                "runOccurrences": dict(run_occurrences),
                "statusTimeline": pump_records[-24:],
                "weatherTimeline": [{"date": row["date"], "time": row["time"], "weather": row["weather"]} for row in pump_records],
                "tdsTrend": [{"date": row["date"], "time": row["time"], "value": row["tds"]} for row in records if row["tds"] is not None],
                "completeness": round((actual_values / expected_values * 100), 1) if expected_values else 0,
            },
            "meta": {"recordCount": len(records), "twaSeparated": True, "sources": ["PumpStation", "AirLaut"]},
        })
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date or limit parameter"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def filter_records_by_date(records, start_date, end_date):
    return [
        row for row in records
        if (row_date := parse_sheet_date(row.get("Date")))
        and start_date <= row_date <= end_date
    ]


def parse_water_coordinates(value):
    text = str(value or "").strip().strip("()[]")
    parts = re.split(r"\s*[,;]\s*|\s+", text)
    if len(parts) != 2:
        return None
    try:
        latitude, longitude = map(float, parts)
    except ValueError:
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return [latitude, longitude]


@app.route('/api/berbagi-air', methods=['GET'])
def get_water_locations():
    try:
        try:
            sheet = cc_spreadsheet.worksheet("DistribusiAirBersih")
        except gspread.WorksheetNotFound:
            sheet = spreadsheet.worksheet("DistribusiAirBersih")
        locations, skipped = build_water_locations(sheet.get_all_records())
        return jsonify({"status": "success", "locations": locations, "meta": {"skippedRows": skipped}})
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.route('/api/traffic-monthly', methods=['GET'])
def get_traffic_monthly():
    try:
        current_month = datetime.date.today().strftime("%Y-%m")
        start = datetime.datetime.strptime(request.args.get("startMonth", current_month), "%Y-%m").date()
        end = datetime.datetime.strptime(request.args.get("endMonth", current_month), "%Y-%m").date()
        if start > end:
            return jsonify({"status": "error", "message": "Bulan awal harus sebelum bulan akhir"}), 400
        daily = start == end
        buckets = {}
        cursor = start
        while cursor <= end or (daily and cursor.month == start.month and cursor.year == start.year):
            key = cursor.isoformat() if daily else cursor.strftime("%Y-%m")
            buckets[key] = {column: 0 for column in TRAFFIC_SUMMARY_COLUMNS}
            buckets[key]["recordCount"] = 0
            cursor = cursor + datetime.timedelta(days=1) if daily else (cursor.replace(day=28) + datetime.timedelta(days=4)).replace(day=1)
        for row in TRAFFIC_SHEETS["summary"].get_all_records():
            date = parse_sheet_date(record_value(row, "Date"))
            if not date:
                continue
            key = date.isoformat() if daily else date.strftime("%Y-%m")
            if key in buckets:
                buckets[key]["recordCount"] += 1
                for column in TRAFFIC_SUMMARY_COLUMNS:
                    buckets[key][column] += integer_value(record_value(row, column))
        return jsonify({"status": "success", "granularity": "daily" if daily else "monthly",
                        "rows": [{"period": key, **values} for key, values in buckets.items()]})
    except ValueError:
        return jsonify({"status": "error", "message": "Bulan harus menggunakan YYYY-MM"}), 400
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.route('/api/traffic-dashboard', methods=['GET'])
def get_traffic_dashboard():
    """Return final worksheet values, filtered at the data source boundary."""
    try:
        today = datetime.date.today()
        start_date = datetime.datetime.strptime(
            request.args.get("startDate", today.isoformat()), "%Y-%m-%d"
        ).date()
        end_date = datetime.datetime.strptime(
            request.args.get("endDate", start_date.isoformat()), "%Y-%m-%d"
        ).date()
        if start_date > end_date:
            return jsonify({"status": "error", "message": "startDate must be before endDate"}), 400

        summary_sheet = TRAFFIC_SHEETS["summary"]
        hourly_sheet = TRAFFIC_SHEETS["hourly"]
        summary_rows = filter_records_by_date(summary_sheet.get_all_records(), start_date, end_date)
        hourly_rows = filter_records_by_date(hourly_sheet.get_all_records(), start_date, end_date)

        summary = {
            column: sum(integer_value(record_value(row, column)) for row in summary_rows)
            for column in TRAFFIC_SUMMARY_COLUMNS
        }
        hourly_by_time = defaultdict(lambda: {column: 0 for column in TRAFFIC_HOURLY_COLUMNS})
        for row in hourly_rows:
            time_value = str(row.get("TIME", "")).strip()
            hour_match = re.search(r"(?:^|\s)(\d{1,2})(?::\d{2})?", time_value)
            if not hour_match:
                continue
            hour = int(hour_match.group(1)) % 24
            time_key = f"{hour:02d}:00"
            for column in TRAFFIC_HOURLY_COLUMNS:
                # CheckpointHour already contains final hourly calculations.
                hourly_by_time[time_key][column] += integer_value(record_value(row, column))

        # Operational sheet order: 01:00 through 23:00, with midnight/24:00 last.
        hour_order = list(range(1, 24)) + [0]
        hourly = [
            {"time": f"{hour:02d}:00", **hourly_by_time[f"{hour:02d}:00"]}
            for hour in hour_order
        ]
        return jsonify({
            "status": "success",
            "range": {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
            "summary": summary,
            "hourly": hourly,
            "meta": {
                "summarySource": "AllCheckpoint",
                "hourlySource": "CheckpointHour",
                "summaryColumns": summary_sheet.row_values(1),
                "hourlyColumns": hourly_sheet.row_values(1),
                "summaryRowCount": len(summary_rows),
                "hourlyRowCount": len(hourly_rows),
            },
        })
    except ValueError:
        return jsonify({"status": "error", "message": "Dates must use YYYY-MM-DD"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ================= 1. SEMUA ENDPOINT LAMA (TIDAK ADA YANG DIHAPUS) =================

register_dashboard_auth(
    app,
    lambda: spreadsheet.worksheet("OFFICER").get_all_records(),
    create_dashboard_token,
)

@app.route('/api/perparkiran-data', methods=['GET'])
def get_perparkiran_data():
    try:
        records = perparkiran_sheet.get_all_records()
        return jsonify({"status": "success", "data": records})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/water-quality-data', methods=['GET'])
def get_water_quality_data():
    try:
        sheet = cc_spreadsheet.worksheet("KualitasAir")
        records = sheet.get_all_records(numericise_ignore=['all'])
        records = [row for row in records if any(
            str(row.get(column, '')).strip()
            for column in ('TANGGAL', 'LOKASI SAMPLING', 'TDS', 'AREA')
        )]
        return jsonify({"status": "success", "data": records})
    except Exception:
        app.logger.exception("Unable to load KualitasAir")
        return jsonify({"status": "error", "message": "Unable to load water quality records."}), 500


@app.route('/api/call-center-data', methods=['GET'])
def get_call_center_data():
    try:
        records = cc_sheet.get_all_records()
        return jsonify({"status": "success", "data": records})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
        
@app.route('/api/cctv-growth-data', methods=['GET'])
def get_cctv_growth_data():
    try:
        records = cctv2026_sheet.get_all_records()
        return jsonify({"status": "success", "data": records})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/save-data', methods=['POST'])
def save_data():
    data = request.json
    sheet = spreadsheet.worksheet("DATA")
    now = datetime.datetime.now()
    new_row = [
        str(now),
        now.strftime("%Y-%m-%d"),
        now.strftime("%H:%M:%S"),
        data['gate'],
        data['in'],
        data['out']
    ]
    sheet.append_row(new_row)
    return jsonify({"status": "success"})

@app.route('/api/cctv-data', methods=['GET'])
def get_cctv_data():
    sheet = spreadsheet.worksheet("DATA")
    records = sheet.get_all_records()
    return jsonify(records)


sheet_write_lock = threading.Lock()

# --- KONFIGURASI CROP LAMA PER GATE ---
UNIVERSAL_CROP = (0, 0, 0.45, 0.30) 
GATE_CONFIG = {
    "Marina In": UNIVERSAL_CROP,
    "Marina Out": UNIVERSAL_CROP,
    "Linggi In 1": UNIVERSAL_CROP,
    "Linggi In 2": UNIVERSAL_CROP,
    "Linggi Out": UNIVERSAL_CROP,
    "Tataban In": UNIVERSAL_CROP,
    "Tataban Out": UNIVERSAL_CROP,
    "Baruyungan In": UNIVERSAL_CROP,
    "Baruyungan Out": UNIVERSAL_CROP,
    "Toll Kataraja In": UNIVERSAL_CROP,
    "Toll Kataraja Out": UNIVERSAL_CROP,
    "Default": (0, 0, 0.50, 0.30) 
}

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:
        data = request.json
        gate = data['gate'] 
        image_data = data['image']
        header, encoded = image_data.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(encoded)))
        width, height = img.size

        crop_setting = GATE_CONFIG.get(gate, GATE_CONFIG["Default"])
        left = int(width * crop_setting[0])
        top = int(height * crop_setting[1])
        right = int(width * crop_setting[2])
        bottom = int(height * crop_setting[3])
        
        img_cropped = img.crop((left, top, right, bottom))
        
        # Proses OCR menggunakan RapidOS
        img_np = np.array(img_cropped)
        result, _ = engine(img_np)
        
        value = 0
        if result:
            all_text_combined = ""
            for line in result:
                text = line[1]
                confidence = float(line[2])
                if confidence > 0.4:
                    all_text_combined += text + " "
            
            nums = re.findall(r'\d+', all_text_combined)
            if nums:
                best_num = max(nums, key=len)
                value = int(best_num)
        
        sheet = spreadsheet.worksheet("DATA") 
        now = datetime.datetime.now()
        sheet.append_row([
            str(now),
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            gate,
            value
        ])
        return jsonify({"status": "success", "value": value})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ================= 2. ENDPOINT BARU (HCP MULTIPLEXING & LOKAL AGENT) =================

@app.route('/api/submit-ocr', methods=['POST'])
def submit_ocr():
    try:
        data = request.json
        gate = data.get('gate')
        value = data.get('value')
        if not gate or value is None: return jsonify({"status": "error", "message": "Data tidak lengkap"}), 400
        
        sheet = spreadsheet.worksheet("DATA") 
        now = datetime.datetime.now()
        sheet.append_row([
            str(now), now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"), gate, value
        ])
        return jsonify({"status": "success", "message": "Data tersimpan"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


HCP_GRID_CONFIG = {
    "Marina IN": {
        "mobil_box": (0.22, 0.040, 0.30, 0.06),
        "motor_box": (0.26, 0.025, 0.30, 0.05)
    },
    "Marina OUT": {
        "mobil_box": (0.55, 0.048, 0.585, 0.08),
        "motor_box": (0.585, 0.035, 0.63, 0.07)
    },
    "Toll Kataraja IN": {
        "mobil_box": (0.10, 0.43, 0.20, 0.48)
    },
    "Toll Kataraja OUT": {
        "mobil_box": (0.60, 0.43, 0.70, 0.48)
    }
}

def process_single_crop(img_cropped, box_name=""):
    """Membaca angka menggunakan RapidOCR secara stabil dan konsisten"""
    try:
        img_np = np.array(img_cropped)
        result, _ = engine(img_np)
        
        if result:
            all_text_combined = ""
            for line in result:
                text = line[1]
                confidence = float(line[2])
                if confidence > 0.4:
                    all_text_combined += text + " "
            
            nums = re.findall(r'\d+', all_text_combined)
            if nums:
                best_num = max(nums, key=len)
                return int(best_num)
            
    except Exception as e:
        print(f"Error processing {box_name} with RapidOCR: {e}")
    return 0


@app.route('/api/upload-hcp-grid', methods=['POST', 'OPTIONS'])
@cross_origin()
def upload_hcp_grid():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    try:
        data = request.json
        image_data = data['image']

        header, encoded = image_data.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(encoded)))
        width, height = img.size

        now = datetime.datetime.now()
        timestamp_str = str(now)
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        
        rows_to_insert = []
        results_log = []

        for gate_name, config_gate in HCP_GRID_CONFIG.items():
            mobil = 0
            motor = 0
            
            try:
                # POTONG & BACA MOBIL
                if "mobil_box" in config_gate:
                    box = config_gate["mobil_box"]
                    crop_mobil = img.crop((int(width * box[0]), int(height * box[1]), int(width * box[2]), int(height * box[3])))
                    mobil = process_single_crop(crop_mobil, f"MOBIL_{gate_name}")

                # POTONG & BACA MOTOR
                if "motor_box" in config_gate:
                    box = config_gate["motor_box"]
                    crop_motor = img.crop((int(width * box[0]), int(height * box[1]), int(width * box[2]), int(height * box[3])))
                    motor = process_single_crop(crop_motor, f"MOTOR_{gate_name}")

                total = mobil + motor
                print(f"[RAPIDOCR HASIL] {gate_name}: Mobil={mobil}, Motor={motor}, Total={total}")
                
                if total > 0:
                    row = [timestamp_str, date_str, time_str, gate_name, mobil, motor, total]
                    rows_to_insert.append(row)
                    results_log.append({"gate": gate_name, "mobil": mobil, "motor": motor, "total": total})

            except Exception as inner_e:
                print(f"[OCR ERROR] Gagal memproses {gate_name}: {inner_e}")
                continue 

        # Menggunakan Threading Lock untuk antrean pengiriman ke Spreadsheet
        if rows_to_insert:
            with sheet_write_lock:
                sheet = spreadsheet.worksheet("DATA")
                sheet.append_rows(rows_to_insert)

        # Hapus gambar dari RAM
        img.close()

        return jsonify({"status": "success", "results": results_log})

    except Exception as e:
        print("ERROR BACKEND HCP GRID:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
