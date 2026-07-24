import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import base64
import re
import datetime
from PIL import Image, ImageEnhance, ImageOps
import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

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

# ================= LOGIN =================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json

    sheet = spreadsheet.worksheet("OFFICER")
    records = sheet.get_all_records()

    for row in records:
        if (
            str(row['NAMA LENGKAP']) == data['username']
            and str(row['PASSWORD']) == data['password']
        ):
            return jsonify({
                "status": "success",
                "user": row
            })

    return jsonify({"status": "failed"}), 401

# Tambahkan di bagian setup Google Sheets
cc_spreadsheet = client.open("Master Data Dashboard")
cc_sheet = cc_spreadsheet.worksheet("CallCenter")
cctv2026_sheet = cc_spreadsheet.worksheet("CCTV")

# ================= GET CALL CENTER DATA =================
@app.route('/api/call-center-data', methods=['GET'])
def get_call_center_data():
    try:
        # Mengambil semua record dari sheet CC2026
        records = cc_sheet.get_all_records()
        
        # Anda bisa melakukan pemrosesan data di sini jika diperlukan 
        # (misal: mengambil baris terbaru saja atau melakukan agregasi)
        
        return jsonify({
            "status": "success",
            "data": records
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
        
        
# ================= GET DATA CCTV 2026 =================
@app.route('/api/cctv-growth-data', methods=['GET'])
def get_cctv_growth_data():
    try:
        # Mengambil semua record dari sheet CCTV2026
        records = cctv2026_sheet.get_all_records()
        
        return jsonify({
            "status": "success",
            "data": records
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    

# ================= SIMPAN DATA CCTV =================
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


# ================= GET DATA =================
@app.route('/api/cctv-data', methods=['GET'])
def get_cctv_data():
    sheet = spreadsheet.worksheet("DATA")
    records = sheet.get_all_records()

    return jsonify(records)


# --- KONFIGURASI CROP PER GATE ---
# Format: (left, top, right, bottom) dalam persentase (0.0 - 1.0)
# Marina 2 dibuat lebih lebar (0.65) agar angka 5 digit tidak terpotong
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
        gate = data['gate'] # Nama gate sekarang (misal: "Marina In")
        image_data = data['image']

        header, encoded = image_data.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(encoded)))
        width, height = img.size

        # --- STEP 1: CROP DINAMIS BERDASARKAN GATE ---
        # Kode ini sekarang akan mengenali nama gate dari frontend dengan tepat
        crop_setting = GATE_CONFIG.get(gate, GATE_CONFIG["Default"])
        left = int(width * crop_setting[0])
        top = int(height * crop_setting[1])
        right = int(width * crop_setting[2])
        bottom = int(height * crop_setting[3])
        
        img_cropped = img.crop((left, top, right, bottom))
        
        # --- STEP 2: PRE-PROCESSING (Kembali ke versi asli Anda yang berhasil di Marina Out) ---
        img_gray = img_cropped.convert('L')
        
        img_resized = img_gray.resize((img_gray.width * 3, img_gray.height * 3), Image.Resampling.LANCZOS)
        
        sharpen = ImageEnhance.Sharpness(img_resized)
        img_sharp = sharpen.enhance(2.0)
        
        img_binary = img_sharp.point(lambda p: 255 if p > 180 else 0)
        
        img_final = ImageOps.invert(img_binary)

        # --- STEP 3: OCR DENGAN WHITELIST ---
        config = r'--psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ: '
        text = pytesseract.image_to_string(img_final, config=config)
        
        print(f"====== HASIL OCR [{gate}] ======\n", text) 

        def extract_vehicle_value(text):
            lines = text.upper().split("\n")
            for line in lines:
                # 1. Abaikan baris Non-Motor/Petugas
                if any(x in line for x in ["NON", "MOTOR", "NM", "STAFF"]):
                    continue
                
                # 2. Keyword Fleksibel (Menangkap V:, Q, atau OUT, IN)
                # Saya menambahkan "IN" di sini agar Marina In juga terbaca jika 
                # menggunakan struktur teks yang sama.
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

        # --- STEP 4: LOG & SIMPAN ---
        print(f"DEBUG: {gate} -> Terdeteksi: {value}")
        
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
        print(f"ERROR BACKEND [{gate}]:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

# Hapus baris app.run(port=5000, debug=True) yang ganda
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)