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

# --- PERBAIKAN: KONFIGURASI CORS & PAYLOAD ---
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # Izinkan payload layar penuh hingga 50 MB

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


# --- Konfigurasi Grid HCP (Area Crop Diperluas) ---
HCP_GRID_CONFIG = {
    # Format: (Kiri, Atas, Kanan, Bawah)
    # Area diperluas menjadi 40% lebar dan 30% tinggi dari masing-masing kotak
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
                
                # OPTIMASI RAM FATAL: Hapus Resize & Sharpen. 
                # Langsung ubah ke hitam putih pekat (Binary)
                img_gray = img_cropped.convert('L')
                img_binary = img_gray.point(lambda p: 255 if p > 160 else 0)
                img_final = ImageOps.invert(img_binary)

                config = r'--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:- '
                text = pytesseract.image_to_string(img_final, config=config)
                
                mobil, motor = extract_vehicle_data(text)
                total = mobil + motor
                
                # Menampilkan log mentah dari Tesseract untuk keperluan debugging
                print(f"\n[RAW TEXT {gate_name}]\n{text.strip()}")
                print(f"[OCR HASIL] {gate_name}: Mobil={mobil}, Motor={motor}, Total={total}")
                
                if total > 0:
                    row = [timestamp_str, date_str, time_str, gate_name, mobil, motor, total]
                    rows_to_insert.append(row)
                    results_log.append({"gate": gate_name, "mobil": mobil, "motor": motor, "total": total})

            except Exception as inner_e:
                print(f"[OCR ERROR] Gagal memproses {gate_name}: {inner_e}")
                continue 

        if rows_to_insert:
            sheet.append_rows(rows_to_insert)

        # Menutup file gambar agar memori RAM langsung dikosongkan (Mencegah RAM Leak)
        img.close()

        return jsonify({"status": "success", "results": results_log})

    except Exception as e:
        print("ERROR BACKEND HCP GRID:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)