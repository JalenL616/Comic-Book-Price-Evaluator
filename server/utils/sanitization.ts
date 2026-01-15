export function sanitizeUPC(upc: string) {
    if (!upc) return '';
    return upc.replaceAll(' ', '');
}