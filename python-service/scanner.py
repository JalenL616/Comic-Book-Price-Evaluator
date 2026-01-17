import cv2
import numpy as np
from pyzbar.pyzbar import decode
from pyzbar.pyzbar import ZBarSymbol
from typing import Optional
from pathlib import Path

# Include main UPC types AND 5-digit extension (EAN5 only, not EAN2)
BARCODE_TYPES = [
    ZBarSymbol.UPCA, ZBarSymbol.UPCE, ZBarSymbol.EAN13,
    ZBarSymbol.EAN5
]

# Debug output directory
DEBUG_DIR = Path(__file__).parent / "debug"


def scan_barcode(original: np.ndarray, enhanced: np.ndarray) -> dict:
    """
    Scan for barcode and return dict with main UPC and extension.
    Returns: {'main': str|None, 'extension': str|None}
    """
    # Try original orientation first
    result = try_all_methods(original, enhanced, "0deg")
    if result['main']:
        return result

    # Try 90, 180, 270 degree rotations
    for angle in [90, 180, 270]:
        print(f"Trying {angle} degree rotation...")
        rotated_orig = rotate_image(original, angle)
        rotated_enhanced = rotate_image(enhanced, angle)
        result = try_all_methods(rotated_orig, rotated_enhanced, f"{angle}deg")
        if result['main']:
            return result

    print("All decode attempts failed")
    return {'main': None, 'extension': None}


def rotate_image(img: np.ndarray, angle: int) -> np.ndarray:
    """Rotate image by 90, 180, or 270 degrees."""
    if angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def try_all_methods(original: np.ndarray, enhanced: np.ndarray, prefix: str) -> dict:
    """Try all decoding methods on the given image orientation."""
    # Try original first (in case it's already good quality)
    print(f"Trying original image ({prefix})...")
    result = try_decode(original)
    if result['main']:
        print(f"Decoded from original ({prefix}): {result}")
        return result

    # Convert to grayscale if needed
    if len(original.shape) == 3:
        gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    else:
        gray = original

    # Try simple grayscale
    result = try_decode(gray)
    if result['main']:
        print(f"Decoded from grayscale ({prefix}): {result}")
        return result

    # Main approach: Upscale → Blur → Threshold
    print(f"Trying upscale → blur → threshold ({prefix})...")
    result = upscale_and_clean(gray, f"{prefix}_upscaled")
    if result['main']:
        return result

    # Try with enhanced (CLAHE) version
    print(f"Trying enhanced version ({prefix})...")
    result = upscale_and_clean(enhanced, f"{prefix}_enhanced")
    if result['main']:
        return result

    # Try deskewing the upscaled version
    print(f"Trying deskew ({prefix})...")
    result = deskew_and_decode(gray)
    if result['main']:
        return result

    return {'main': None, 'extension': None}


def upscale_and_clean(gray: np.ndarray, prefix: str) -> dict:
    """Upscale with cubic interpolation, blur, then threshold."""
    # Upscale 4x with cubic interpolation (smooths jagged edges)
    scale = 4
    upscaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(str(DEBUG_DIR / f"05_{prefix}_4x.png"), upscaled)

    # Light blur to smooth aliasing artifacts
    blurred = cv2.GaussianBlur(upscaled, (3, 3), 0)

    # Otsu's thresholding (auto-determines optimal threshold)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(str(DEBUG_DIR / f"06_{prefix}_otsu.png"), thresh)

    result = try_decode(thresh)
    if result['main']:
        print(f"Decoded from {prefix} otsu: {result}")
        return result

    # Try inverted
    result = try_decode(cv2.bitwise_not(thresh))
    if result['main']:
        print(f"Decoded from {prefix} otsu inverted: {result}")
        return result

    # Horizontal blur fallback (fixes deskew artifacts - smears horizontally)
    h_blur = cv2.blur(upscaled, (5, 1))
    _, thresh_h = cv2.threshold(h_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(str(DEBUG_DIR / f"07_{prefix}_hblur.png"), thresh_h)

    result = try_decode(thresh_h)
    if result['main']:
        print(f"Decoded from {prefix} horizontal blur: {result}")
        return result

    result = try_decode(cv2.bitwise_not(thresh_h))
    if result['main']:
        print(f"Decoded from {prefix} horizontal blur inverted: {result}")
        return result

    return {'main': None, 'extension': None}


def deskew_and_decode(gray: np.ndarray) -> dict:
    """Deskew using proper interpolation, then upscale and clean."""
    # Upscale first
    scale = 4
    upscaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Detect skew angle using Hough lines
    edges = cv2.Canny(upscaled, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=100)

    if lines is None:
        print("No lines detected for deskew")
        return {'main': None, 'extension': None}

    # Collect angles of near-vertical lines
    angles = []
    for line in lines:
        rho, theta = line[0]
        angle_deg = np.degrees(theta)
        if angle_deg < 30 or angle_deg > 150:
            if angle_deg < 30:
                angles.append(angle_deg)
            else:
                angles.append(angle_deg - 180)

    if not angles:
        print("No vertical lines detected")
        return {'main': None, 'extension': None}

    median_angle = np.median(angles)
    print(f"Detected skew angle: {median_angle:.2f} degrees")

    if abs(median_angle) < 0.5:
        print("Skew is minimal")
        return {'main': None, 'extension': None}

    # Rotate with INTER_CUBIC to prevent aliasing
    h, w = upscaled.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    deskewed = cv2.warpAffine(upscaled, rotation_matrix, (w, h),
                               flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_REPLICATE)

    # Blur and threshold the deskewed image
    blurred = cv2.GaussianBlur(deskewed, (3, 3), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(str(DEBUG_DIR / "08_deskewed_clean.png"), thresh)

    result = try_decode(thresh)
    if result['main']:
        print(f"Decoded from deskewed clean: {result}")
        return result

    result = try_decode(cv2.bitwise_not(thresh))
    if result['main']:
        print(f"Decoded from deskewed clean inverted: {result}")
        return result

    # Horizontal blur on deskewed
    h_blur = cv2.blur(deskewed, (5, 1))
    _, thresh_h = cv2.threshold(h_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(str(DEBUG_DIR / "09_deskewed_hblur.png"), thresh_h)

    result = try_decode(thresh_h)
    if result['main']:
        print(f"Decoded from deskewed horizontal blur: {result}")
        return result

    return {'main': None, 'extension': None}


def try_decode(image: np.ndarray) -> dict:
    """
    Attempt to decode barcode(s) from image.
    Returns dict with 'main' (UPC) and 'extension' (EAN2/EAN5).
    """
    barcodes = decode(image, symbols=BARCODE_TYPES)

    result = {'main': None, 'extension': None}

    for barcode in barcodes:
        barcode_type = barcode.type
        data = barcode.data.decode('utf-8')

        if barcode_type in ['UPCA', 'UPCE', 'EAN13']:
            result['main'] = data
        elif barcode_type == 'EAN5':
            result['extension'] = data

    return result
