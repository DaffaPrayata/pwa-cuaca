'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Cloud, CloudRain, CloudSun, Droplets, LocateFixed, MapPin, Search, Sun, Wind, X, Zap } from 'lucide-react'

type Place = { name: string; region?: string; latitude: number; longitude: number; country?: string }
type Point = { time: string; temp: number; feels: number; humidity: number; weather: string; wind: number; rain: number; uv: number }
type Day = { date: string; points: Point[]; high: number; low: number }
type Weather = { days: Day[] }
type Cache = { data: Weather; place: Place; updated: string }

const cacheKey = 'atmos-open-meteo-cache'
const weatherText: Record<number, string> = { 0: 'Cerah', 1: 'Cerah berawan', 2: 'Berawan sebagian', 3: 'Mendung', 45: 'Berkabut', 48: 'Berkabut', 51: 'Gerimis ringan', 53: 'Gerimis', 55: 'Gerimis lebat', 61: 'Hujan ringan', 63: 'Hujan', 65: 'Hujan lebat', 71: 'Salju ringan', 73: 'Salju', 75: 'Salju lebat', 80: 'Hujan lokal', 81: 'Hujan lokal', 82: 'Hujan deras', 95: 'Badai petir', 96: 'Badai petir', 99: 'Badai petir' }
const iconFor = (text: string) => { const value = text.toLowerCase(); if (value.includes('petir')) return Zap; if (value.includes('hujan') || value.includes('gerimis')) return CloudRain; if (value.includes('awan') || value.includes('mendung') || value.includes('kabut')) return CloudSun; return Sun }
const formatTime = (value: string) => new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
const number = (value: number | undefined) => Number.isFinite(value) ? Math.round(value as number) : 0

function normalize(raw: any): Weather {
  const times = raw.hourly.time as string[]
  const points = times.slice(0, 24).map((time, index) => ({ time, temp: raw.hourly.temperature_2m[index], feels: raw.hourly.apparent_temperature[index], humidity: raw.hourly.relative_humidity_2m[index], weather: weatherText[raw.hourly.weather_code[index]] ?? 'Berawan', wind: raw.hourly.wind_speed_10m[index], rain: raw.hourly.precipitation_probability[index], uv: raw.hourly.uv_index[index] }))
  return { days: raw.daily.time.slice(0, 7).map((date: string, index: number) => ({ date, points: points.filter(point => point.time.slice(0, 10) === date), high: raw.daily.temperature_2m_max[index], low: raw.daily.temperature_2m_min[index] })) }
}

const apiUrl = (place: Place) => `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation_probability,uv_index&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,uv_index&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7&models=best_match`

export default function WeatherApp() {
  const [place, setPlace] = useState<Place | null>(null), [weather, setWeather] = useState<Weather | null>(null), [query, setQuery] = useState(''), [results, setResults] = useState<Place[]>([]), [loading, setLoading] = useState(true), [searching, setSearching] = useState(false), [locating, setLocating] = useState(false), [error, setError] = useState(''), [updated, setUpdated] = useState('')
  const load = useCallback(async (next: Place) => { setLoading(true); setError(''); try { const response = await fetch(apiUrl(next)); if (!response.ok) throw new Error('fetch failed'); const data = normalize(await response.json()); const stamp = new Date().toISOString(); setWeather(data); setPlace(next); setUpdated(stamp); localStorage.setItem(cacheKey, JSON.stringify({ data, place: next, updated: stamp } satisfies Cache)) } catch { const saved = localStorage.getItem(cacheKey); if (saved) { try { const value = JSON.parse(saved) as Cache; setWeather(value.data); setPlace(value.place); setUpdated(value.updated); setError('Offline — menampilkan data terakhir.') } catch { setError('Data cuaca belum tersedia.') } } else setError('Tidak dapat memuat data cuaca.') } finally { setLoading(false) } }, [])
  useEffect(() => { let active = true; const saved = localStorage.getItem(cacheKey); if (saved) { try { const value = JSON.parse(saved) as Cache; setWeather(value.data); setPlace(value.place); setUpdated(value.updated) } catch {} }
    if (!navigator.geolocation) { setLoading(false); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => { if (active) load({ name: 'Lokasi saya', latitude: coords.latitude, longitude: coords.longitude }) }, () => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])
  useEffect(() => { const refresh = () => { if (place) load(place) }; const interval = window.setInterval(refresh, 600000); window.addEventListener('focus', refresh); if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); return () => { clearInterval(interval); window.removeEventListener('focus', refresh) } }, [load, place])
  async function search(value: string) {
    setQuery(value)
    if (value.trim().length < 2) return setResults([])
    setSearching(true)
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=10&language=id&format=json`)
      const json = await response.json()
      const cities = (json.results ?? []).filter((item: any) => item.country_code === 'ID' && String(item.feature_code ?? '').startsWith('PPL'))
      setResults(cities.map((item: any) => ({ name: item.name, region: item.admin1, latitude: item.latitude, longitude: item.longitude, country: item.country })))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }
  function useLocation() { if (!navigator.geolocation) return setError('Lokasi tidak didukung browser ini.'); setLocating(true); navigator.geolocation.getCurrentPosition(({ coords }) => { setLocating(false); load({ name: 'Lokasi saya', latitude: coords.latitude, longitude: coords.longitude }) }, () => { setLocating(false); setError('Izin lokasi ditolak. Cari kota untuk melihat cuaca.') }) }
  const first = weather?.days[0]?.points[0], today = weather?.days[0], Icon = iconFor(first?.weather ?? ''), allPoints = weather?.days.flatMap(day => day.points) ?? [], accentClass = first?.weather.toLowerCase().includes('hujan') ? 'rain' : first?.weather.toLowerCase().includes('cerah') ? 'clear' : 'cloudy'
  return <main className={`weather-shell ${accentClass}`}><div className="weather-page"><header className="topbar"><div className="masthead"><p>ATMOS / OPEN-METEO</p><h1>{place?.name ?? 'Pilih lokasi'}</h1><span>{place?.region ?? 'Cari kota atau gunakan lokasi Anda'}</span></div><div className="top-actions"><div className="search-box"><Search aria-hidden="true" /><label className="sr-only" htmlFor="city-search">Cari kota</label><input id="city-search" value={query} onChange={e => search(e.target.value)} placeholder="Cari kota" autoComplete="off" />{(results.length > 0 || searching) && <div className="search-results">{searching ? <span>Mencari...</span> : results.map(result => <button key={`${result.latitude}-${result.longitude}`} onClick={() => { load(result); setQuery(''); setResults([]) }}><MapPin aria-hidden="true" /><span><b>{result.name}</b><small>{result.region}</small></span></button>)}</div>}</div><button className="plain-button" onClick={useLocation} disabled={locating} aria-label="Gunakan lokasi saya"><LocateFixed aria-hidden="true" /><span>{locating ? 'Mencari...' : 'Lokasi saya'}</span></button></div></header>{error && <div className="notice" role="status">{error}<button onClick={() => setError('')} aria-label="Tutup"><X aria-hidden="true" /></button></div>}<section className="hero"><div><p className="section-kicker">Kondisi saat ini</p>{loading || !first ? <span className="loading-line loading-temp" /> : <motion.div key={first.time} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="temperature">{number(first.temp)}<sup>°</sup></motion.div>}</div><div className="hero-side">{loading || !first ? <><span className="loading-line loading-icon" /><span className="loading-line loading-title" /></> : <><Icon aria-hidden="true" /><strong>{first.weather}</strong><span>{number(today?.high)}° tinggi · {number(today?.low)}° rendah</span></>}</div></section><section className="details"><div><Droplets aria-hidden="true" /><p>Kelembapan</p><strong>{first ? `${number(first.humidity)}%` : '—'}</strong></div><div><Wind aria-hidden="true" /><p>Angin</p><strong>{first ? `${number(first.wind)} km/j` : '—'}</strong></div><div><Cloud aria-hidden="true" /><p>Terasa</p><strong>{first ? `${number(first.feels)}°` : '—'}</strong></div><div><Zap aria-hidden="true" /><p>UV</p><strong>{first ? number(first.uv) : '—'}</strong></div></section><section className="forecast"><div className="section-heading"><h2>Prakiraan per jam</h2><span>{updated ? `Diperbarui ${formatTime(updated)}` : 'Memuat data...'}</span></div><div className="hourly-strip">{loading && !allPoints.length ? <span className="loading-line loading-wide" /> : allPoints.map(point => <article className="hour-card" key={point.time}><time>{formatTime(point.time)}</time><strong>{number(point.temp)}°</strong><span>{point.weather}</span><small>Peluang hujan {number(point.rain)}%</small></article>)}</div><div className="section-heading"><h2>Prakiraan 7 hari</h2></div><div className="daily-list">{loading && !weather ? <span className="loading-line loading-wide" /> : weather?.days.map(day => <article key={day.date}><span>{formatDate(day.date)}</span><strong>{number(day.high)}° / {number(day.low)}°</strong><span>{day.points[0]?.weather ?? '—'}</span></article>)}</div></section><footer>Data cuaca oleh <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a></footer></div></main>
}
