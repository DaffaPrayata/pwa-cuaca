'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type WeatherMapProps = { latitude: number; longitude: number; onClose: () => void }

export default function WeatherMap({ latitude, longitude, onClose }: WeatherMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current) return
    const map = L.map(mapRef.current, { zoomControl: false }).setView([latitude, longitude], 8)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
    L.tileLayer('https://tilecache.rainviewer.com/v2/radar/nowcast/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.5, attribution: 'Weather tiles' }).addTo(map)
    L.circleMarker([latitude, longitude], { radius: 8, color: '#f5b83d', fillColor: '#f5b83d', fillOpacity: 1, weight: 3 }).addTo(map)
    return () => map.remove()
  }, [latitude, longitude])

  return <div className="map-backdrop" role="presentation" onClick={onClose}><section className="map-panel" role="dialog" aria-modal="true" aria-labelledby="map-title" onClick={(event) => event.stopPropagation()}><div className="map-header"><div><h2 id="map-title">Peta cuaca</h2><p>Hujan di sekitar lokasi Anda</p></div><button className="settings-close" onClick={onClose} aria-label="Tutup peta">×</button></div><div ref={mapRef} className="weather-map" /></section></div>
}
