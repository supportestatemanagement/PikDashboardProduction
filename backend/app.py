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

# Menggunakan RapidOCR (Ringan, Cepat, dan Akurat untuk Angka CCTV)
from rapidocr_onnxruntime import RapidOCR

app = Flask(__name__)

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
cc_sheet = cc_spreadsheet.worksheet("CallCenter")
cctv2026_sheet = cc_spreadsheet.worksheet("CCTV")
perparkiran_sheet = cc_spreadsheet.worksheet("Perparkiran")

TRAFFIC_SHEETS = {
    "summary": spreadsheet.worksheet("AllCheckpoint"),
    "hourly": spreadsheet.worksheet("CheckpointHour"),
}

TRAFFIC_SUMMARY_COLUMNS = [
    "CP - BGM", "Vehicle IN - BGM", "CP - Linggi", "Vehicle IN - GI",
    "CP - Tataban", "Vehicle IN- RWI", "CP - Baruyungan",
    "CP - Toll Kataraja", "Vehicle IN - PIK2", "Total Pengunjung",
]
TRAFFIC_HOURLY_COLUMNS = [
    "CP - BGM", "CP - Linggi", "CP - Tataban", "CP - Baruyungan",
    "CP - Toll Kataraja",
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


def filter_records_by_date(records, start_date, end_date):
    return [
        row for row in records
        if (row_date := parse_sheet_date(row.get("Date")))
        and start_date <= row_date <= end_date
    ]


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
            column: sum(integer_value(row.get(column)) for row in summary_rows)
            for column in TRAFFIC_SUMMARY_COLUMNS
        }
        hourly_by_time = defaultdict(lambda: {column: 0 for column in TRAFFIC_HOURLY_COLUMNS})
        for row in hourly_rows:
            time_value = str(row.get("TIME", "")).strip()
            hour_match = re.search(r"(?:^|\s)(\d{1,2})(?::\d{2})?", time_value)
            if not hour_match:
                continue
            hour = min(int(hour_match.group(1)), 23)
            time_key = f"{hour:02d}:00"
            for column in TRAFFIC_HOURLY_COLUMNS:
                # CheckpointHour already contains final hourly calculations.
                hourly_by_time[time_key][column] += integer_value(row.get(column))

        hourly = [
            {"time": f"{hour:02d}:00", **hourly_by_time[f"{hour:02d}:00"]}
            for hour in range(24)
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

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    sheet = spreadsheet.worksheet("OFFICER")
    records = sheet.get_all_records()
    for row in records:
        if (str(row['NAMA LENGKAP']) == data['username'] and str(row['PASSWORD']) == data['password']):
            return jsonify({"status": "success", "user": row})
    return jsonify({"status": "failed"}), 401

@app.route('/api/perparkiran-data', methods=['GET'])
def get_perparkiran_data():
    try:
        records = perparkiran_sheet.get_all_records()
        return jsonify({"status": "success", "data": records})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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
