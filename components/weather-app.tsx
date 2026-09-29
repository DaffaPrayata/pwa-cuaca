'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Cloud, CloudLightning, CloudRain, CloudSun, Droplets, Download, LocateFixed,
  MapPin, Navigation, Search, Sun, Sunrise, Sunset, Thermometer, Umbrella,
  Wind, X, Snowflake, LoaderCircle,
} from 'lucide-react'

type WeatherData = {
  current: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; is_day: number; precipitation: number; weather_code: number; wind_speed_10m: number; uv_index: number }
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[]; relative_humidity_2m: number[]; wind_speed_10m: number[] }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; sunrise: string[]; sunset: string[]; uv_index_max: number[]; precipitation_probability_max: number[] }
}
type Place = { name: string; country: string; latitude: number; longitude: number; admin1?: string }

const DEFAULT_PLACE: Place = { name: 'San Francisco', country: 'United States', admin1: 'California', latitude: 37.7749, longitude: -122.4194 }

function weatherInfo(code: number, isDay = 1) {
  if (code === 0) return { label: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? Sun : CloudSun, tone: 'sunny' }
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: CloudSun, tone: 'cloudy' }
  if (code === 3) return { label: 'Overcast', icon: Cloud, tone: 'cloudy' }
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: Cloud, tone: 'cloudy' }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: code >= 80 ? 'Rain showers' : 'Light rain', icon: CloudRain, tone: 'rainy' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow showers', icon: Snowflake, tone: 'snowy' }
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorms', icon: CloudLightning, tone: 'stormy' }
  return { label: 'Mixed conditions', icon: CloudSun, tone: 'cloudy' }
}

function formatTime(value: string, options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }) { return new Date(value).toLocaleTimeString([], options) }
function formatDay(value: string, index: number) { return index === 0 ? 'Today' : new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'short' }) }

export default function WeatherApp() {
  const [place, setPlace] = useState(DEFAULT_PLACE)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [error, setError] = useState('')

  const loadWeather = useCallback(async (nextPlace: Place) => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ latitude: String(nextPlace.latitude), longitude: String(nextPlace.longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,uv_index', hourly: 'temperature_2m,precipitation_probability,weather_code,relative_humidity_2m,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max', timezone: 'auto', forecast_days: '7' })
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      if (!response.ok) throw new Error('Weather service unavailable')
      setWeather(await response.json())
      setPlace(nextPlace)
    } catch { setError('Could not refresh weather. Check your connection and try again.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadWeather(DEFAULT_PLACE) }, [loadWeather])
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])

  async function searchPlaces(value: string) {
    setQuery(value); if (value.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(value)}`)
      const data = await response.json()
      setResults(data.map((item: any) => ({ name: item.name || item.display_name.split(',')[0], country: item.address?.country || '', admin1: item.address?.state, latitude: Number(item.lat), longitude: Number(item.lon) })))
    } catch { setResults([]) } finally { setSearching(false) }
  }
  function useLocation() {
    if (!navigator.geolocation) { setError('Geolocation is not supported by this browser.'); return }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const next = { name: 'Current location', country: '', latitude: coords.latitude, longitude: coords.longitude }
      try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`); const data = await response.json(); next.name = data.address?.city || data.address?.town || data.address?.village || 'Current location'; next.country = data.address?.country || '' } catch {}
      await loadWeather(next); setLocationLoading(false)
    }, () => { setError('Location access was denied. Search for a city instead.'); setLocationLoading(false) })
  }
  async function installApp() { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null) }

  const info = weather ? weatherInfo(weather.current.weather_code, weather.current.is_day) : weatherInfo(0)
  const CurrentIcon = info.icon
  const hourlyStart = weather ? Math.max(0, weather.hourly.time.findIndex((time) => new Date(time) >= new Date())) : 0
  const hourly = weather ? weather.hourly.time.slice(hourlyStart, hourlyStart + 24) : []
  const background = `weather-shell ${info.tone}`

  return (
    <main className={background}>
      <div className="weather-noise" aria-hidden="true" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-12">
        <header className="relative z-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="brand-mark"><CloudSun aria-hidden="true" /></div><span className="font-display text-xl font-semibold tracking-tight">atmos</span></div>
          <div className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/60 sm:flex"><span className="live-dot" />Live conditions</div>
          <button className="location-button" onClick={useLocation} disabled={locationLoading}><LocateFixed aria-hidden="true" />{locationLoading ? 'Locating…' : 'Use my location'}</button>
        </header>

        <section className="relative z-10 mt-10 grid flex-1 gap-8 lg:mt-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div className="flex flex-col justify-end">
            <div className="relative max-w-xl">
              <label className="sr-only" htmlFor="city-search">Search city</label>
              <div className="search-wrap"><Search aria-hidden="true" /><input id="city-search" value={query} onChange={(event) => searchPlaces(event.target.value)} placeholder="Search a city…" autoComplete="off" /><kbd>⌘ K</kbd></div>
              <AnimatePresence>{(results.length > 0 || searching) && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="search-results">{searching && <div className="search-status"><LoaderCircle className="animate-spin" />Searching places…</div>}{results.map((result) => <button key={`${result.latitude}-${result.longitude}`} onClick={() => { loadWeather(result); setQuery(''); setResults([]) }}><MapPin aria-hidden="true" /><span><strong>{result.name}</strong><small>{[result.admin1, result.country].filter(Boolean).join(', ')}</small></span></button>)}</motion.div>}</AnimatePresence>
            </div>
            <div className="mt-12 flex items-start gap-4"><MapPin className="mt-2 text-white/60" aria-hidden="true" /><div><p className="eyebrow">Currently in</p><h1 className="font-display text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">{place.name}</h1><p className="mt-2 text-sm text-white/60">{place.admin1 ? `${place.admin1}, ` : ''}{place.country} <span className="mx-2 text-white/30">•</span> Updated just now</p></div></div>
            <div className="mt-12 flex items-center gap-6 sm:gap-10"><motion.div key={weather?.current.temperature_2m} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display text-[7rem] font-semibold leading-none tracking-[-0.1em] sm:text-[10rem]">{loading ? '—' : Math.round(weather?.current.temperature_2m ?? 0)}<span className="align-top text-4xl font-normal tracking-normal sm:text-6xl">°</span></motion.div><div className="border-l border-white/20 pl-6 sm:pl-10"><CurrentIcon className="weather-icon" aria-hidden="true" /><p className="mt-3 text-lg font-medium">{info.label}</p><p className="text-sm text-white/60">Feels like {Math.round(weather?.current.apparent_temperature ?? 0)}°</p></div></div>
          </div>
          <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .6 }} className="hero-orbit"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><div className="sun-orb"><CurrentIcon aria-hidden="true" /></div><div className="orbit-label orbit-label-top"><span>UV index</span><strong>{weather?.current.uv_index.toFixed(0) ?? '—'}</strong></div><div className="orbit-label orbit-label-bottom"><span>Precipitation</span><strong>{weather?.current.precipitation ?? 0} mm</strong></div></motion.div>
        </section>

        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X /></button></div>}
        <section className="relative z-10 mt-14 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="glass-panel overflow-hidden"><div className="panel-heading"><div><p className="eyebrow">Next 24 hours</p><h2>Hourly forecast</h2></div><Navigation className="text-white/40" aria-hidden="true" /></div><div className="hourly-scroll">{hourly.map((time, index) => { const hourIndex = hourlyStart + index; const hourlyInfo = weatherInfo(weather?.hourly.weather_code[hourIndex] ?? 0); const Icon = hourlyInfo.icon; return <div className="hour-card" key={time}><span className="hour-time">{index === 0 ? 'Now' : formatTime(time, { hour: 'numeric' })}</span><Icon className="hour-icon" aria-hidden="true" /><strong>{Math.round(weather?.hourly.temperature_2m[hourIndex] ?? 0)}°</strong><span className="rain-chance"><Droplets aria-hidden="true" />{weather?.hourly.precipitation_probability[hourIndex] ?? 0}%</span></div> })}</div></div>
          <div className="glass-panel"><div className="panel-heading"><div><p className="eyebrow">Today’s rhythm</p><h2>Sun & details</h2></div><Sunrise className="text-white/40" aria-hidden="true" /></div><div className="sun-times"><div><Sunrise aria-hidden="true" /><span>Sunrise</span><strong>{weather ? formatTime(weather.daily.sunrise[0]) : '—'}</strong></div><div><Sunset aria-hidden="true" /><span>Sunset</span><strong>{weather ? formatTime(weather.daily.sunset[0]) : '—'}</strong></div></div><div className="details-grid"><div><Droplets aria-hidden="true" /><span>Humidity</span><strong>{weather?.current.relative_humidity_2m ?? '—'}%</strong></div><div><Wind aria-hidden="true" /><span>Wind</span><strong>{Math.round(weather?.current.wind_speed_10m ?? 0)} km/h</strong></div><div><Umbrella aria-hidden="true" /><span>Rain chance</span><strong>{weather?.daily.precipitation_probability_max[0] ?? '—'}%</strong></div><div><Thermometer aria-hidden="true" /><span>High / low</span><strong>{Math.round(weather?.daily.temperature_2m_max[0] ?? 0)}° / {Math.round(weather?.daily.temperature_2m_min[0] ?? 0)}°</strong></div></div></div>
        </section>
        <section className="relative z-10 mt-4 glass-panel"><div className="panel-heading"><div><p className="eyebrow">The week ahead</p><h2>7-day forecast</h2></div><span className="text-xs text-white/50">°C</span></div><div className="daily-grid">{weather?.daily.time.map((day, index) => { const dayInfo = weatherInfo(weather.daily.weather_code[index]); const Icon = dayInfo.icon; return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} className={`day-card ${index === 0 ? 'today' : ''}`} key={day}><span>{formatDay(day, index)}</span><Icon aria-hidden="true" /><strong>{Math.round(weather.daily.temperature_2m_max[index])}°</strong><small>{Math.round(weather.daily.temperature_2m_min[index])}°</small><em>{weather.daily.precipitation_probability_max[index]}%</em></motion.div> })}</div></section>
        <footer className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40"><span>Data by Open-Meteo · Maps by OpenStreetMap</span><span>Atmos Weather <span className="mx-1">/</span> 2026</span></footer>
      </div>
      {installPrompt && !installDismissed && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="install-banner"><div className="install-icon"><Download aria-hidden="true" /></div><div><strong>Take atmos with you</strong><span>Install the app for quick weather checks.</span></div><button className="install-action" onClick={installApp}>Install</button><button className="install-dismiss" onClick={() => setInstallDismissed(true)} aria-label="Dismiss install prompt"><X /></button></motion.div>}
    </main>
  )
}
