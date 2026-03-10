/**
 * FarmSurvey – GPS boundary walk with live Leaflet map
 *
 * The loan officer walks the farm perimeter, tapping "Add Waypoint"
 * at each corner. The polygon is drawn live on the map and the area
 * is computed using the Shoelace formula on WGS84 coordinates
 * (Haversine-corrected for spherical earth).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Play, Square, Trash2, Save, Navigation, AlertTriangle } from 'lucide-react';
import { db } from '../../lib/offlineDb';

// Fix default Leaflet marker icons (broken in Vite builds)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Geo calculations ─────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number) { return (deg * Math.PI) / 180; }

/** Haversine distance between two GPS points (metres) */
function haversine(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sinHalf = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(sinHalf));
}

/** Shoelace area of a polygon on a sphere (square metres) */
function polygonAreaM2(points: [number, number][]): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = toRad(points[i][1]) * EARTH_RADIUS_M * Math.cos(toRad(points[i][0]));
    const yi = toRad(points[i][0]) * EARTH_RADIUS_M;
    const xj = toRad(points[j][1]) * EARTH_RADIUS_M * Math.cos(toRad(points[j][0]));
    const yj = toRad(points[j][0]) * EARTH_RADIUS_M;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

function m2ToAcres(m2: number) { return m2 / 4046.856; }
function m2ToHa(m2: number) { return m2 / 10_000; }

/** Perimeter in metres */
function perimeter(points: [number, number][]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += haversine(points[i], points[(i + 1) % points.length]);
  }
  return total;
}

// ─── Map auto-fit helper ──────────────────────────────────────────────────────

function MapFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
  }, [points, map]);
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Waypoint { lat: number; lng: number; timestamp: string }

interface FarmSurveyProps {
  customerId?: string;
  pendingCustomerTempId?: string;
  onSave?: (areaAcres: number, perimeterM: number, waypoints: Waypoint[]) => void;
}

export default function FarmSurvey({ customerId, pendingCustomerTempId, onSave }: FarmSurveyProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const latLngs: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
  const areaM2 = polygonAreaM2(latLngs);
  const perimM  = perimeter(latLngs);
  const areaAcres = m2ToAcres(areaM2);
  const areaHa    = m2ToHa(areaM2);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device');
      return;
    }
    setTracking(true);
    setGpsError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setCurrentPos([pos.coords.latitude, pos.coords.longitude]),
      (err) => setGpsError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
  }, []);

  const stopTracking = useCallback(() => {
    setTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const addWaypoint = useCallback(() => {
    if (!currentPos) return;
    setWaypoints((prev) => [
      ...prev,
      { lat: currentPos[0], lng: currentPos[1], timestamp: new Date().toISOString() },
    ]);
  }, [currentPos]);

  const removeWaypoint = useCallback((idx: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = useCallback(async () => {
    if (waypoints.length < 3) return;
    setSaving(true);
    try {
      const tempId = crypto.randomUUID();
      await db.farmSurveys.add({
        tempId,
        customerId,
        pendingCustomerTempId,
        waypoints,
        areaAcres: areaAcres,
        perimeterM: perimM,
        capturedAt: new Date().toISOString(),
        synced: false,
      });
      setSaved(true);
      onSave?.(areaAcres, perimM, waypoints);
    } finally {
      setSaving(false);
    }
  }, [waypoints, customerId, pendingCustomerTempId, areaAcres, perimM, onSave]);

  // Cleanup watcher on unmount
  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  const defaultCenter: [number, number] = currentPos ?? [-0.0236, 37.9062]; // Kenya centroid

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary-700" /> GPS Farm Survey
        </h2>

        {gpsError && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700 mb-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {gpsError}
          </div>
        )}

        {/* Map */}
        <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 320 }}>
          <MapContainer
            center={defaultCenter}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {latLngs.length >= 3 && (
              <Polygon
                positions={latLngs}
                pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.25 }}
              />
            )}
            {waypoints.map((wp, i) => (
              <Marker key={i} position={[wp.lat, wp.lng]}>
                <Popup>
                  Point {i + 1}<br />
                  {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}<br />
                  <button
                    onClick={() => removeWaypoint(i)}
                    className="text-red-600 text-xs hover:underline mt-1"
                  >
                    Remove
                  </button>
                </Popup>
              </Marker>
            ))}
            {currentPos && (
              <Marker position={currentPos} icon={L.divIcon({
                html: '<div class="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6],
                className: '',
              })}>
                <Popup>Your position</Popup>
              </Marker>
            )}
            {latLngs.length > 0 && <MapFitter points={latLngs} />}
          </MapContainer>
        </div>

        {/* Stats */}
        {waypoints.length >= 3 && (
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{areaAcres.toFixed(2)}</div>
              <div className="text-xs text-green-600">acres</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{areaHa.toFixed(3)}</div>
              <div className="text-xs text-green-600">hectares</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{Math.round(perimM)}</div>
              <div className="text-xs text-green-600">m perimeter</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {!tracking ? (
            <button onClick={startTracking} className="btn-primary flex items-center gap-2">
              <Play className="h-4 w-4" /> Start GPS Tracking
            </button>
          ) : (
            <>
              <button onClick={stopTracking} className="btn-secondary flex items-center gap-2">
                <Square className="h-4 w-4" /> Stop Tracking
              </button>
              <button
                onClick={addWaypoint}
                disabled={!currentPos}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Navigation className="h-4 w-4" /> Add Waypoint
              </button>
            </>
          )}
          {waypoints.length > 0 && (
            <button onClick={() => setWaypoints([])} className="btn-secondary flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {currentPos && tracking && (
          <p className="text-xs text-gray-500">
            Current position: {currentPos[0].toFixed(6)}, {currentPos[1].toFixed(6)}
            <br />{waypoints.length} waypoints recorded
          </p>
        )}

        {/* Waypoint list */}
        {waypoints.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {waypoints.map((wp, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                <span className="text-gray-600">
                  {i + 1}. {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}
                </span>
                <button onClick={() => removeWaypoint(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {waypoints.length >= 3 && !saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Survey'}
          </button>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            Survey saved ({areaAcres.toFixed(2)} acres). Will sync when online.
          </div>
        )}

        {waypoints.length < 3 && waypoints.length > 0 && (
          <p className="text-xs text-gray-400">Add at least 3 waypoints to calculate area</p>
        )}
      </div>
    </div>
  );
}
