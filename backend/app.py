import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import base64
import re
import datetime
# Tambahan ImageFilter untuk EasyOCR
from PIL import Image, ImageEnhance, ImageOps, ImageFilter
import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

# Tambahan Library untuk sistem Queue dan EasyOCR
import threading 
import numpy as np
import easyocr

app = Flask(__name__)

# --- KONFIGURASI CORS & PAYLOAD ---
# Gunakan konfigurasi standar ini. Flask-CORS akan otomatis menangani preflight (OPTIONS)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # Izinkan payload layar penuh hingga 50 MB

# --- INISIALISASI SISTEM ANTREAN & AI ---
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
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)

client = gspread.authorize(creds)
spreadsheet = client.open("PIK Dashboard")

cc_spreadsheet = client.open("Master Data Dashboard")
cc_sheet = cc_spreadsheet.worksheet("CallCenter")
cctv2026_sheet = cc_spreadsheet.worksheet("CCTV")
perparkiran_sheet = cc_spreadsheet.worksheet("Perparkiran")


# ================= 1. SEMUA ENDPOINT LAMA =================

# Hapus 'OPTIONS' dari methods, biarkan Flask-CORS yang mengurusnya
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


# ================= GANTIKAN HANYA BAGIAN INI DARI DEVELOPMENT =================

GATE_CONFIG = {
    "Marina Vehicle In": {
        "mobil_box": (0.22, 0.040, 0.30, 0.06)   
    },
    "Marina Non Vehicle In": {
        "motor_box": (0.26, 0.025, 0.30, 0.05) 
    },
    "Marina Out": {
        "motor_box": (0.593, 0.038, 0.62, 0.06),
        "mobil_box": (0.55, 0.048, 0.585, 0.08)
    },
    "Toll Kataraja In": {
        "mobil_box": (0.20, 0.025, 0.30, 0.10)  
    },
    "Toll Kataraja Out": {
        "mobil_box": (0.20, 0.025, 0.30, 0.10)
    },
    "BGM In": {
        "motor_box": (0.20, 0.025, 0.30, 0.06),
        "mobil_box": (0.20, 0.06, 0.30, 0.10)
    },
    "Default": {
        "motor_box": (0.20, 0.025, 0.30, 0.06),
        "mobil_box": (0.20, 0.06, 0.30, 0.10)
    }
}

def process_single_crop(img_cropped, box_name):
    """Membaca gambar dengan format Black on White (Angka Hitam, Background Putih) yang tajam"""
    try:
        safe_name = box_name.replace(" ", "_")
        
        # Konversi ke Grayscale
        img_gray = img_cropped.convert('L')
        
        # Balikkan warna (Invert) agar angka jadi hitam
        img_inverted = ImageOps.invert(img_gray)
        
        # Perbesar dan tajamkan
        new_width = int(img_inverted.width * 3)
        new_height = int(img_inverted.height * 3)
        img_resized = img_inverted.resize((new_width, new_height), Image.Resampling.LANCZOS)
        img_sharp = img_resized.filter(ImageFilter.SHARPEN)
        
        # Tambah kontras
        enhancer = ImageEnhance.Contrast(img_sharp)
        img_final = enhancer.enhance(1.8) 
        
        img_final.save(f"DEBUG_CROP_{safe_name}.jpg")
        img_np = np.array(img_final)
        
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


# Hapus 'OPTIONS' dan blok if manual
@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:
        data = request.json
        gate = data['gate'] 
        image_data = data['image']

        header, encoded = image_data.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(encoded)))
        width, height = img.size

        config_gate = GATE_CONFIG.get(gate, GATE_CONFIG["Default"])
        
        safe_gate_name = gate.replace(" ", "_")
        img.save(f"DEBUG_1_FULLSCREEN_{safe_gate_name}.jpg")

        motor = 0
        mobil = 0

        # POTONG & BACA MOTOR
        if "motor_box" in config_gate:
            box = config_gate["motor_box"]
            crop_motor = img.crop((int(width * box[0]), int(height * box[1]), int(width * box[2]), int(height * box[3])))
            motor = process_single_crop(crop_motor, f"MOTOR_{gate}")

        # POTONG & BACA MOBIL
        if "mobil_box" in config_gate:
            box = config_gate["mobil_box"]
            crop_mobil = img.crop((int(width * box[0]), int(height * box[1]), int(width * box[2]), int(height * box[3])))
            mobil = process_single_crop(crop_mobil, f"MOBIL_{gate}")

        total = mobil + motor

        print(f"\n[EASYOCR B&W RESULT - {gate}] -> Mobil: {mobil}, Motor: {motor}, Total: {total}")
        
        # GUNAKAN LOCK SEBELUM MENYIMPAN KE SPREADSHEET
        if total > 0:
            with sheet_write_lock: 
                sheet = spreadsheet.worksheet("DATA") 
                now = datetime.datetime.now()
                
                sheet.append_row([
                    str(now),
                    now.strftime("%Y-%m-%d"),
                    now.strftime("%H:%M:%S"),
                    gate,
                    mobil,
                    motor,
                    total
                ])

        img.close()

        return jsonify({"status": "success", "mobil": mobil, "motor": motor, "total": total})

    except Exception as e:
        print(f"ERROR BACKEND [{data.get('gate', 'Unknown')}]:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ================= 2. ENDPOINT BARU (HCP MULTIPLEXING DLL) =================

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
    "Marina IN": (0.0, 0.0, 0.40, 0.30),         
    "Marina OUT": (0.50, 0.0, 0.90, 0.30),       
    "Toll Kataraja IN": (0.0, 0.33, 0.40, 0.63), 
    "Toll Kataraja OUT": (0.50, 0.33, 0.90, 0.63) 
}

def extract_vehicle_data(text):
    mobil = 0
    motor = 0
    lines = text.upper().split("\n")
    for line in lines:
        if "NON-MOTOR" in line or "NON MOTOR" in line or "NONMOTOR" in line:
            nums = re.findall(r'\d+', line)
            if nums:
                motor = int(nums[-1])
        elif "VEHICLE" in line or "VEHIC" in line:
            if "NON" not in line:
                nums = re.findall(r'\d+', line)
                if nums:
                    mobil = int(nums[-1])
    return mobil, motor

# Hapus 'OPTIONS' dan @cross_origin manual, biarkan Flask-CORS yang mengatur
@app.route('/api/upload-hcp-grid', methods=['POST'])
def upload_hcp_grid():
    try:
        data = request.json
        image_data = data['image']

        header, encoded = image_data.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(encoded)))
        width, height = img.size

        sheet = spreadsheet.worksheet("DATA")
        now = datetime.datetime.now()
        
        timestamp_str = str(now)
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        
        rows_to_insert = []
        results_log = []

        for gate_name, crop_setting in HCP_GRID_CONFIG.items():
            try:
                left = int(width * crop_setting[0])
                top = int(height * crop_setting[1])
                right = int(width * crop_setting[2])
                bottom = int(height * crop_setting[3])
                
                img_cropped = img.crop((left, top, right, bottom))
                
                img_gray = img_cropped.convert('L')
                img_binary = img_gray.point(lambda p: 255 if p > 160 else 0)
                img_final = ImageOps.invert(img_binary)

                config = r'--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:- '
                text = pytesseract.image_to_string(img_final, config=config)
                
                mobil, motor = extract_vehicle_data(text)
                total = mobil + motor
                
                if total > 0:
                    row = [timestamp_str, date_str, time_str, gate_name, mobil, motor, total]
                    rows_to_insert.append(row)
                    results_log.append({"gate": gate_name, "mobil": mobil, "motor": motor, "total": total})

            except Exception as inner_e:
                print(f"[OCR ERROR] Gagal memproses {gate_name}: {inner_e}")
                continue 

        if rows_to_insert:
            sheet.append_rows(rows_to_insert)

        img.close()

        return jsonify({"status": "success", "results": results_log})

    except Exception as e:
        print("ERROR BACKEND HCP GRID:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)