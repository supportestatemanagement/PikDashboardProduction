import os
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import base64
import re
import datetime
import threading
from PIL import Image, ImageEnhance, ImageFilter
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

# Menggunakan EasyOCR sesuai dengan versi Development
import easyocr

app = Flask(__name__)

# --- KONFIGURASI PRODUCTION ---
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # Izinkan payload besar hingga 50 MB

# LOCK GLOBAL UNTUK MENCEGAH TABRAKAN DATA DI GOOGLE SHEETS
sheet_write_lock = threading.Lock()

# ================= INISIALISASI EASYOCR (AI) =================
print("Memuat Model AI EasyOCR...")
reader = easyocr.Reader(['en'], gpu=False) 
print("Model EasyOCR Siap!")

# ================= GOOGLE SHEETS SETUP =================
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]

# Mendukung Environment Variables untuk Production, Fallback ke credentials.json untuk Lokal
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

# ================= ENDPOINT DATA DASHBOARD =================

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
        return jsonify({"status": "success", "data": perparkiran_sheet.get_all_records()})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/call-center-data', methods=['GET'])
def get_call_center_data():
    try:
        return jsonify({"status": "success", "data": cc_sheet.get_all_records()})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
        
@app.route('/api/cctv-growth-data', methods=['GET'])
def get_cctv_growth_data():
    try:
        return jsonify({"status": "success", "data": cctv2026_sheet.get_all_records()})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/cctv-data', methods=['GET'])
def get_cctv_data():
    sheet = spreadsheet.worksheet("DATA")
    return jsonify(sheet.get_all_records())


# ================= ENDPOINT OCR (DARI DEVELOPMENT) =================

GATE_CONFIG = {
    "Marina In": {
        "motor_box": (0.26, 0.025, 0.30, 0.05), 
        "mobil_box": (0.22, 0.040, 0.30, 0.06)   
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
    """Membaca gambar menggunakan AI EasyOCR dengan Binarisasi Ekstrem"""
    try:
        img_gray = img_cropped.convert('L')
        
        new_width = int(img_gray.width * 1)
        new_height = int(img_gray.height * 1)
        img_resized = img_gray.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        img_sharp = img_resized.filter(ImageFilter.SHARPEN)
        
        enhancer = ImageEnhance.Contrast(img_sharp)
        img_final = enhancer.enhance(2) 
        
        # Simpan gambar akhir untuk kalibrasi visual (opsional di production)
        img_final.save(f"DEBUG_CROP_{box_name}.jpg")
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
        
        img.save(f"DEBUG_1_FULLSCREEN_{gate}.jpg")

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

        print(f"\n[EASYOCR RESULT - {gate}] -> Mobil: {mobil}, Motor: {motor}, Total: {total}")
        
        # GUNAKAN LOCK SEBELUM MENYIMPAN KE SPREADSHEET (Mencegah Race Condition)
        if total > 0:
            with sheet_write_lock: 
                sheet = spreadsheet.worksheet("DATA") 
                now = datetime.datetime.now()
                
                sheet.append_row([
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

if __name__ == '__main__':
    # Pastikan port dinamis berjalan dengan benar di lingkungan server
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)