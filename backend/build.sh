#!/usr/bin/env bash
# Update dan install tesseract-ocr
apt-get update && apt-get install -y tesseract-ocr
# Install library python
pip install -r requirements.txt