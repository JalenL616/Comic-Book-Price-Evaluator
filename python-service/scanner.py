import cv2
import numpy as np
from pyzbar.pyzbar import decode, ZBarSymbol
from pathlib import Path

# SET TO FALSE FOR PRODUCTION TO REMOVE STALLS
ENABLE_DEBUG = False
DEBUG_DIR = Path(__file__).parent / "debug"

BARCODE_TYPES = [
    ZBarSymbol.UPCA, ZBarSymbol.UPCE, ZBarSymbol.EAN13, ZBarSymbol.EAN5
]

def check_image_quality(gray: np.ndarray) -> dict:
    """Quick quality check to detect clearly unreadable images."""
    # 1. Blur detection using Laplacian variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

    # 2. Contrast check (standard deviation of pixel values)
    contrast = gray.std()

    # 3. Edge density - barcodes have strong vertical edges
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.count_nonzero(edges) / edges.size

    is_scannable = (
        laplacian_var > 50 and      # Not too blurry
        contrast > 20 and            # Has some contrast
        edge_density > 0.01          # Has some edges
    )

    return {
        'scannable': is_scannable,
        'blur_score': laplacian_var,
        'contrast': contrast,
        'edge_density': edge_density
    }

def debug_save(name: str, img: np.ndarray):
    if ENABLE_DEBUG:
        DEBUG_DIR.mkdir(exist_ok=True)
        cv2.imwrite(str(DEBUG_DIR / name), img)

def scan_barcode(original: np.ndarray, enhanced: np.ndarray) -> dict:
    # 1. Prepare Grayscale versions once to save CPU
    gray_orig = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY) if len(original.shape) == 3 else original
    gray_enh = enhanced # Already gray from preprocessing

    # 2. Quick quality check - skip expensive operations if clearly unreadable
    quality = check_image_quality(gray_orig)
    if ENABLE_DEBUG:
        print(f"Quality: blur={quality['blur_score']:.1f}, contrast={quality['contrast']:.1f}, edges={quality['edge_density']:.4f}, scannable={quality['scannable']}")

    # 3. TIER 1: THE FAST PASS (High probability, low CPU)
    # Try all 4 rotations on raw grayscale first
    for angle in [0, 90, 180, 270]:
        img = rotate_image(gray_orig, angle)
        result = try_decode(img)
        if result['main']:
            debug_save(f"success_tier1_rot{angle}.png", img)
            return result

    # 4. TIER 2: THE ENHANCED PASS (Medium probability, medium CPU)
    # Try the CLAHE enhanced version at all rotations
    for angle in [0, 90, 180, 270]:
        img = rotate_image(gray_enh, angle)
        result = try_decode(img)
        if result['main']:
            debug_save(f"success_tier2_rot{angle}.png", img)
            return result

    # 4b. TIER 2.5: FIXED THRESHOLDING (catches barcodes Otsu misses)
    for thresh_val in [140, 160]:
        _, thresh = cv2.threshold(gray_orig, thresh_val, 255, cv2.THRESH_BINARY)
        result = try_decode(thresh)
        if result['main']:
            debug_save(f"success_tier2b_thresh{thresh_val}.png", thresh)
            return result

    # === EARLY EXIT: Skip expensive tiers if image is clearly unreadable ===
    if not quality['scannable']:
        if ENABLE_DEBUG:
            print("Skipping expensive tiers - image quality too low")
        return {'main': None, 'extension': None}

    # 5. TIER 3: SLIGHT ANGLE CORRECTIONS (Common for phone photos)
    # Try small angle adjustments (-5, -3, 3, 5 degrees)
    for small_angle in [-5, -3, 3, 5]:
        corrected = rotate_by_angle(gray_orig, small_angle)
        result = try_decode(corrected)
        if result['main']:
            debug_save(f"success_tier3_angle{small_angle}.png", corrected)
            return result

    # 6. TIER 4: THE DEEP PASS (Low probability, high CPU)
    # Upscale/threshold/deskew if basic methods failed
    for angle in [0, 90]:  # Only 0 and 90 to save time
        img = rotate_image(gray_orig, angle)

        # Upscale and Threshold
        result = upscale_and_clean(img, f"deep_{angle}")
        if result['main']: return result

        # Deskew (The most expensive operation)
        result = deskew_and_decode(img)
        if result['main']: return result

    return {'main': None, 'extension': None}

def rotate_by_angle(img: np.ndarray, angle: float) -> np.ndarray:
    """Rotate image by arbitrary angle (for small corrections)"""
    h, w = img.shape[:2]
    matrix = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
    return cv2.warpAffine(img, matrix, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)

def rotate_image(img: np.ndarray, angle: int) -> np.ndarray:
    if angle == 90: return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if angle == 180: return cv2.rotate(img, cv2.ROTATE_180)
    if angle == 270: return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img

def upscale_and_clean(gray: np.ndarray, prefix: str) -> dict:
    # Only upscale if image is small; otherwise it's a waste of CPU
    h, w = gray.shape[:2]
    if w < 400:
        scale = 3
        img = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
    else:
        img = gray

    # Try fixed threshold values first (more reliable than Otsu for some barcodes)
    for thresh_val in [140, 160, 180, 120]:
        _, thresh = cv2.threshold(img, thresh_val, 255, cv2.THRESH_BINARY)
        result = try_decode(thresh)
        if result['main']:
            return result

    # Otsu Threshold fallback
    blurred = cv2.GaussianBlur(img, (3, 3), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    result = try_decode(thresh)
    if not result['main']:
        # Try Inverse
        result = try_decode(cv2.bitwise_not(thresh))

    if not result['main']:
        # Horizontal blur fallback (Good for motion blur)
        h_blur = cv2.blur(img, (5, 1))
        _, thresh_h = cv2.threshold(h_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        result = try_decode(thresh_h)

    return result

def deskew_and_decode(gray: np.ndarray) -> dict:
    # Use a low-res version to find the angle (much faster)
    small = cv2.resize(gray, (0,0), fx=0.5, fy=0.5)
    edges = cv2.Canny(small, 50, 150)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, 80)

    if lines is None: return {'main': None, 'extension': None}

    angles = []
    for line in lines:
        theta = line[0][1]
        deg = np.degrees(theta)
        if deg < 30: angles.append(deg)
        elif deg > 150: angles.append(deg - 180)

    if not angles: return {'main': None, 'extension': None}
    
    median_angle = np.median(angles)
    if abs(median_angle) < 0.5: return {'main': None, 'extension': None}

    # Rotate the original high-res image
    h, w = gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((w//2, h//2), median_angle, 1.0)
    deskewed = cv2.warpAffine(gray, matrix, (w, h), flags=cv2.INTER_LINEAR)
    
    return try_decode(deskewed)

def try_decode(image: np.ndarray) -> dict:
    barcodes = decode(image, symbols=BARCODE_TYPES)
    result = {'main': None, 'extension': None}
    for barcode in barcodes:
        data = barcode.data.decode('utf-8')
        if barcode.type in ['UPCA', 'UPCE', 'EAN13']:
            result['main'] = data
        elif barcode.type == 'EAN5':
            result['extension'] = data
    return result