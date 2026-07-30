import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import base64
import re
import datetime
from PIL import Image, ImageEnhance, ImageOps
import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import os
import json

app = Flask(__name__)

# --- KONFIGURASI CORS & PAYLOAD ---
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 

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

# ================= LOGIN =================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    sheet = spreadsheet.worksheet("OFFICER")
    records = sheet.get_all_records()
    for row in records:
        if (str(row['NAMA LENGKAP']) == data['username'] and str(row['PASSWORD']) == data['password']):
            return jsonify({"status": "success", "user": row})
    return jsonify({"status": "failed"}), 401

# ================= GET DASHBOARD DATA =================
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
    
@app.route('/api/cctv-data', methods=['GET'])
def get_cctv_data():
    sheet = spreadsheet.worksheet("DATA")
    records = sheet.get_all_records()
    return jsonify(records)

# ================= ENDPOINT LAMA (TETAP DIPERTAHANKAN) =================
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
                if any(x in line for x in ["NON", "MOTOR", "NM", "STAFF"]):
                    continue
                keywords = ["VEHIC", "OUT", "IN", "OAT", "OT", "V:", "V-", "V ", "Q "]
                if any(k in line for k in keywords):
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        val_str = "".join(numbers)
                        val = int(val_str)
                        if 3 <= len(str(val)) <= 6:
                            return val
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

@app.route('/api/submit-ocr', methods=['POST'])
def submit_ocr():
    try:
        data = request.json
        gate = data.get('gate')
        value = data.get('value')
        if not gate or value is None:
            return jsonify({"status": "error", "message": "Data tidak lengkap"}), 400
        
        sheet = spreadsheet.worksheet("DATA") 
        now = datetime.datetime.now()
        sheet.append_row([
            str(now),
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            gate,
            value
        ])
        return jsonify({"status": "success", "message": "Data tersimpan"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ================= ENDPOINT BARU HCP MULTIPLEXING =================

HCP_GRID_CONFIG = {
    "Marina IN": (0.0, 0.0, 0.50, 0.33),         # Kolom 1 Baris 1
    "Marina OUT": (0.50, 0.0, 1.00, 0.33),       # Kolom 2 Baris 1
    "Toll Kataraja IN": (0.0, 0.33, 0.50, 0.66), # Kolom 1 Baris 2
    "Toll Kataraja OUT": (0.50, 0.33, 1.00, 0.66) # Kolom 2 Baris 2
}

def extract_vehicle_data(text):
    mobil = 0
    motor = 0
    lines = text.upper().split("\n")
    
    for line in lines:
        # Cek Non-Motor terlebih dahulu
        if "NON-MOTOR" in line or "NON MOTOR" in line or "NONMOTOR" in line:
            # Mengambil semua grup angka di baris tersebut
            nums = re.findall(r'\d+', line)
            if nums:
                # Menggunakan indeks [-1] untuk mengambil angka yang paling ujung kanan.
                # Ini mencegah regex menangkap angka '2' dari kata 'PIK2' sebagai nilai counting.
                motor = int(nums[-1])
                
        # Cek Vehicle (Pastikan baris ini tidak mengandung kata NON)
        elif "VEHICLE" in line or "VEHIC" in line:
            if "NON" not in line:
                nums = re.findall(r'\d+', line)
                if nums:
                    mobil = int(nums[-1])
                    
    return mobil, motor

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

        # Pastikan nama worksheet di Google Sheet Anda persis "DATA"
        sheet = spreadsheet.worksheet("DATA")
        now = datetime.datetime.now()
        
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        
        results = []

        for gate_name, crop_setting in HCP_GRID_CONFIG.items():
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

            # Tambahkan spasi pada whitelist agar OCR lebih mudah memisahkan teks
            config = r'--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:- '
            text = pytesseract.image_to_string(img_final, config=config)
            
            mobil, motor = extract_vehicle_data(text)
            total = mobil + motor # Penjumlahan total
            
            print(f"DEBUG HCP {gate_name}: Mobil={mobil}, Motor={motor}, Total={total}")
            
            # Jika ada pergerakan, simpan.
            if total > 0:
                # URUTAN ARRAY DI BAWAH INI SANGAT KRUSIAL. 
                # Pastikan susunan kolom Google Sheet Anda dari kiri (A) ke kanan (F) adalah:
                # Kolom A = DATE, Kolom B = TIME, Kolom C = GATE, Kolom D = MOBIL, Kolom E = MOTOR, Kolom F = TOTAL
                sheet.append_row([
                    date_str,   # Masuk ke Kolom 1 (A)
                    time_str,   # Masuk ke Kolom 2 (B)
                    gate_name,  # Masuk ke Kolom 3 (C)
                    mobil,      # Masuk ke Kolom 4 (D)
                    motor,      # Masuk ke Kolom 5 (E)
                    total       # Masuk ke Kolom 6 (F)
                ])
                results.append({"gate": gate_name, "mobil": mobil, "motor": motor, "total": total})

        return jsonify({"status": "success", "results": results})

    except Exception as e:
        print("ERROR BACKEND HCP GRID:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
    
    
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)