import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'peliculas.json');
    const fileData = fs.readFileSync(filePath, 'utf-8');
    return new Response(fileData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error("Error loading catalog API:", error);
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 });
  }
}
