/**
 * Encode arbitrary UTF-8 string to base64 (MV3-compatible, no Blob).
 * @param {string} text
 * @returns {string}
 */
export function toBase64Utf8(text) {
  return btoa(unescape(encodeURIComponent(String(text ?? ''))));
}


