# 1. Gunakan versi Python 3.11 yang stabil
FROM python:3.11-slim

# 2. Atur folder kerja di dalam server
WORKDIR /app

# 3. Instal Tesseract OCR, OpenCV, dan dependensi sistem penunjang PyTorch/EasyOCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 4. Salin file requirements.txt dan instal library Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Salin seluruh sisa kode backend Anda
COPY . .

# 6. Jalankan Gunicorn menggunakan port dari Render (default 5000)
ENV PORT=5000
CMD gunicorn --workers 1 --threads 100 --timeout 120 -b 0.0.0.0:$PORT app:app
