import cv2
import numpy as np
from pyzbar.pyzbar import decode
from pyzbar.pyzbar import ZBarSymbol
from typing import Optional

def scan_barcode(image: np.ndarray) -> Optional[str]:
    barcodes = decode(
        image,
        symbols=[ZBarSymbol.UPCA, ZBarSymbol.UPCE, ZBarSymbol.EAN13]
    )
    
    if not barcodes:
        inverted = cv2.bitwise_not(image)
        barcodes = decode(inverted, symbols=[ZBarSymbol.UPCA, ZBarSymbol.UPCE, ZBarSymbol.EAN13])
    
    if barcodes:
        return barcodes[0].data.decode('utf-8')
    
    return None