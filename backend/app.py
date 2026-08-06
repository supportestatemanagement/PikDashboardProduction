import os
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import base64
import re
import datetime
import threading # Tambahan untuk sistem antrean GSheets
import numpy as np # Tambahan untuk EasyOCR array
from PIL import Image, ImageEnhance, ImageOps, ImageFilter
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import json
import pytesseract 
import easyocr

app = Flask(__name__)

# --- KONFIGURASI CORS & PAYLOAD ---
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 

# --- INISIALISASI LOCK DAN AI EASYOCR ---
sheet_write_lock = threading.Lock()
print("Memuat Model AI EasyOCR...")
reader = easyocr.Reader(['en'], gpu=False) 
print("Model EasyOCR Siap!")

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
        img_gray = img_cropped.convert('L')
        img_resized = img_gray.resize((img_gray.width * 3, img_gray.height * 3), Image.Resampling.LANCZOS)
        sharpen = ImageEnhance.Sharpness(img_resized)
        img_sharp = sharpen.enhance(2.0)
        img_binary = img_sharp.point(lambda p: 255 if p > 180 else 0)
        img_final = ImageOps.invert(img_binary)

        config = r'--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ: '
        text = pytesseract.image_to_string(img_final, config=config)
        
        def extract_vehicle_value(text):
            lines = text.upper().split("\n")
            for line in lines:
                if any(x in line for x in ["NON", "MOTOR", "NM", "STAFF"]): continue
                keywords = ["VEHIC", "OUT", "IN", "OAT", "OT", "V:", "V-", "V ", "Q "]
                if any(k in line for k in keywords):
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        val_str = "".join(numbers)
                        val = int(val_str)
                        if 3 <= len(str(val)) <= 6: return val
            return 0
        
        value = extract_vehicle_value(text)
        
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
        "motor_box": (0.593, 0.038, 0.62, 0.06)
    },
    "Toll Kataraja IN": {
        "mobil_box": (0.10, 0.43, 0.20, 0.48)
    },
    "Toll Kataraja OUT": {
        "mobil_box": (0.60, 0.43, 0.70, 0.48)
    }
}

def process_single_crop(img_cropped, box_name=""):
    """Fungsi dari devapp.py untuk membaca angka dengan binarisasi ekstrem"""
    try:
        img_gray = img_cropped.convert('L')
        
        new_width = int(img_gray.width * 1)
        new_height = int(img_gray.height * 1)
        img_resized = img_gray.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        img_sharp = img_resized.filter(ImageFilter.SHARPEN)
        
        enhancer = ImageEnhance.Contrast(img_sharp)
        img_final = enhancer.enhance(2) 
        
        img_np = np.array(img_final)
        
        # Baca teks dengan batasan hanya angka
        results = reader.readtext(img_np, allowlist='0123456789')
        
        valid_numbers = []
        for (bbox, text, prob) in results:
            nums = re.findall(r'\d+', text)
            if nums:
                valid_numbers.append(int(max(nums, key=len)))
                
        if valid_numbers:
            return max(valid_numbers)
            
    except Exception as e:
        print(f"Error processing {box_name}: {e}")
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
                print(f"[OCR HASIL] {gate_name}: Mobil={mobil}, Motor={motor}, Total={total}")
                
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