import { NextResponse } from 'next/server'

const headers = { 'User-Agent': 'Atmos Weather PWA/1.0' }
const mapPlace = (item: any) => ({ name: item.address?.village || item.address?.town || item.address?.suburb || item.name || item.display_name?.split(',')[0], region: item.address?.city || item.address?.county || item.address?.state, adm4: item.address?.adm4 || item.extratags?.adm4 || item.extratags?.['ref:bmkg'] || '' })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = params.get('q')
  const endpoint = query ? `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=8&q=${encodeURIComponent(`${query}, Indonesia`)}` : `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&extratags=1&lat=${params.get('lat')}&lon=${params.get('lon')}`
  const response = await fetch(endpoint, { headers, next: { revalidate: 3600 } })
  if (!response.ok) return NextResponse.json([])
  const data = await response.json()
  const results = Array.isArray(data) ? data : [data]
  return NextResponse.json(results.map(mapPlace).filter((place: any) => place.adm4))
}

export const runtime = 'edge'
