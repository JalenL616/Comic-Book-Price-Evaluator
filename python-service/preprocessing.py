import cv2
import numpy as np
from typing import Optional
from pathlib import Path

# SET TO FALSE FOR PRODUCTION
ENABLE_DEBUG = False
DEBUG_DIR = Path(__file__).parent / "debug"

def preprocess_image(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: raise ValueError("Could not decode image")

    if ENABLE_DEBUG:
        DEBUG_DIR.mkdir(exist_ok=True)
        cv2.imwrite(str(DEBUG_DIR / "01_original.png"), img)

    h, w = img.shape[:2]

    # 1. Attempt focused detection
    cropped = detect_barcode_region(img)
    used_fallback = False

    # 2. If detection failed or area is too large, use full image
    if cropped is None or (cropped.shape[0] * cropped.shape[1]) > (h * w * 0.6):
        cropped = img
        used_fallback = True

    if ENABLE_DEBUG:
        cv2.imwrite(str(DEBUG_DIR / f"02_cropped_{'fallback' if used_fallback else 'detected'}.png"), cropped)

    # 3. Grayscale and Enhancement
    gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)

    # CLAHE enhancement helps with glares
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    if ENABLE_DEBUG:
        cv2.imwrite(str(DEBUG_DIR / "03_enhanced.png"), enhanced)

    return cropped, enhanced

def detect_barcode_region(img: np.ndarray) -> Optional[np.ndarray]:
    try:
        # The OpenCV BarcodeDetector is very fast compared to ZBar
        detector = cv2.barcode.BarcodeDetector()
        retval, points = detector.detect(img)

        if retval and points is not None:
            pts = points[0].astype(int)
            x, y, w, h = cv2.boundingRect(pts)
            
            # Add 15% padding
            pad_w = int(w * 0.15)
            pad_h = int(h * 0.15)
            
            x = max(0, x - pad_w)
            y = max(0, y - pad_h)
            w = min(img.shape[1] - x, w + (pad_w * 2))
            h = min(img.shape[0] - y, h + (pad_h * 2))

            return img[y:y+h, x:x+w]
    except:
        pass
    return None