import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const adm4 = new URL(request.url).searchParams.get('adm4')
  if (!adm4 || !/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(adm4)) return NextResponse.json({ error: 'adm4 tidak valid' }, { status: 400 })
  const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`, { next: { revalidate: 900 } })
  if (!response.ok) return NextResponse.json({ error: 'Data BMKG tidak tersedia' }, { status: response.status })
  return NextResponse.json(await response.json(), { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } })
}

export const runtime = 'edge'
