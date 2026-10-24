/** @param {number} lat @param {number} lon @param {number} zoom */
export function project(lat, lon, zoom) {
  const scale = 256 * 2 ** zoom;
  const sine = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}
/** @param {number} x @param {number} y @param {number} zoom */
export function unproject(x, y, zoom) {
  const scale = 256 * 2 ** zoom;
  return {
    lat: Math.max(
      -85,
      Math.min(
        85,
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI,
      ),
    ),
    lon: (((((x / scale) * 360) % 360) + 360) % 360) - 180,
  };
}
