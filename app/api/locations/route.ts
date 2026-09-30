import { NextResponse } from 'next/server'

const headers = { 'User-Agent': 'Atmos Weather PWA/1.0' }
const mapPlace = (item: any, adm4 = '') => ({
  name: item.address?.city || item.address?.town || item.address?.municipality || item.address?.county || item.name || item.display_name?.split(',')[0],
  region: item.address?.state || item.address?.province || 'Indonesia',
  adm4: adm4 || item.address?.adm4 || item.extratags?.adm4 || item.extratags?.['ref:bmkg'] || '',
})

async function reverseAdm4(item: any) {
  if (item.address?.adm4 || item.extratags?.adm4 || item.extratags?.['ref:bmkg']) return mapPlace(item)
  if (!item.lat || !item.lon) return mapPlace(item)
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&extratags=1&lat=${item.lat}&lon=${item.lon}`, { headers, next: { revalidate: 3600 } })
  if (!response.ok) return mapPlace(item)
  const reversed = await response.json()
  return mapPlace(item, reversed.address?.adm4 || reversed.extratags?.adm4 || reversed.extratags?.['ref:bmkg'] || '')
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = params.get('q')
  const endpoint = query
    ? `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=12&countrycodes=id&q=${encodeURIComponent(`${query}, Indonesia`)}`
    : `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&extratags=1&lat=${params.get('lat')}&lon=${params.get('lon')}`
  const response = await fetch(endpoint, { headers, next: { revalidate: 3600 } })
  if (!response.ok) return NextResponse.json([])
  const data = await response.json()
  const results = Array.isArray(data) ? data : [data]
  const cityResults = query ? results.filter((item: any) => {
    const type = item.type || ''
    const address = item.address || {}
    return ['city', 'town', 'municipality', 'county'].includes(type) || address.city || address.town || address.municipality || address.county
  }) : results
  const places = query ? await Promise.all(cityResults.map(reverseAdm4)) : results.map((item: any) => mapPlace(item))
  const unique = new Map(places.map(place => [`${place.name}-${place.region}`, place]))
  return NextResponse.json(Array.from(unique.values()))
}

export const runtime = 'edge'
