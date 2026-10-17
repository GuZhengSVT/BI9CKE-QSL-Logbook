/* Geographic calculations in kilometres. No callsign/country location guesses. */
'use strict';
const QslGeo = (() => {
  const R = 6371.0088, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  function gridCenter(value) {
    const grid = String(value || '').trim().toUpperCase();
    if (!/^[A-R]{2}\d{2}(?:[A-X]{2}(?:\d{2})?)?$/.test(grid)) return null;
    let lon = (grid.charCodeAt(0) - 65) * 20 - 180 + Number(grid[2]) * 2;
    let lat = (grid.charCodeAt(1) - 65) * 10 - 90 + Number(grid[3]);
    let width = 2, height = 1;
    if (grid.length >= 6) {
      width /= 24; height /= 24;
      lon += (grid.charCodeAt(4) - 65) * width;
      lat += (grid.charCodeAt(5) - 65) * height;
    }
    if (grid.length === 8) {
      width /= 10; height /= 10;
      lon += Number(grid[6]) * width; lat += Number(grid[7]) * height;
    }
    return { lat: lat + height / 2, lon: lon + width / 2, source: 'grid' };
  }
  function coordinate(value, latitude) {
    if (value === '' || value == null) return null;
    const str = String(value).trim().toUpperCase();
    const match = str.match(/^([NSEW])\s*(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)$/);
    if (match && (Number(match[3]) >= 60 || !(latitude ? 'NS' : 'EW').includes(match[1]))) return null;
    const number = match ? (Number(match[2]) + Number(match[3]) / 60) * ('SW'.includes(match[1]) ? -1 : 1) : /^[-+]?\d+(?:\.\d+)?$/.test(str) ? Number(str) : NaN;
    return Number.isFinite(number) && Math.abs(number) <= (latitude ? 90 : 180) ? number : null;
  }
  function location(value = {}) {
    const lat = coordinate(value.lat ?? value.LAT, true), lon = coordinate(value.lon ?? value.LON, false);
    if (lat !== null && lon !== null) return { lat, lon, source: 'coordinates' };
    return gridCenter(value.grid || value.GRIDSQUARE);
  }
  function distance(a, b) {
    const p = rad(b.lat - a.lat), l = rad(b.lon - a.lon);
    const h = Math.sin(p / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(l / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  function bearing(a,b) {
    if (distance(a,b) < 0.001 || Math.abs(distance(a,b)-Math.PI*R)<0.001) return null;
    const p=rad(a.lat),q=rad(b.lat),delta=rad(b.lon-a.lon);
    return (deg(Math.atan2(Math.sin(delta)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(delta)))+360)%360;
  }
  function destination(center, km, bearing) {
    const a = km / R, p = rad(center.lat), l = rad(center.lon), b = rad(bearing);
    const lat = Math.asin(Math.sin(p) * Math.cos(a) + Math.cos(p) * Math.sin(a) * Math.cos(b));
    const lon = l + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(p), Math.cos(a) - Math.sin(p) * Math.sin(lat));
    return { lat: deg(lat), lon: ((deg(lon) + 540) % 360) - 180 };
  }
  // Azimuthal equidistant: radial map distance equals great-circle distance.
  function azimuthal(center, point, radius = 164) {
    const p0 = rad(center.lat), p = rad(point.lat), delta = rad(point.lon - center.lon);
    const c = Math.acos(Math.max(-1, Math.min(1, Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(delta))));
    if (c < 1e-10) return { x: 360, y: 180 };
    if (Math.PI - c < 1e-10) return { x: 360, y: 180 - radius };
    const k = c / Math.sin(c);
    return { x: 360 + radius / Math.PI * k * Math.cos(p) * Math.sin(delta), y: 180 - radius / Math.PI * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(delta)) };
  }
  function coverage(station, records) {
    const center = location(station);
    const contacts = records.map(record => ({ record, position: location(record) })).filter(item => item.position);
    if (!center) return { center: null, contacts, farthest: null };
    for (const contact of contacts) contact.km = distance(center, contact.position);
    const farthest = contacts.reduce((best, item) => !best || item.km > best.km ? item : best, null);
    return { center, contacts, farthest };
  }
  return { gridCenter, coordinate, location, distance, bearing, destination, azimuthal, coverage };
})();
globalThis.QslGeo = QslGeo;
