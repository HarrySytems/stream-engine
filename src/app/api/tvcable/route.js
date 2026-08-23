import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'tvcable.json');
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      return new Response(fileData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=300'
        }
      });
    }
    return NextResponse.json([]);
  } catch (error) {
    console.error("Error loading tvcable API:", error);
    return NextResponse.json({ error: 'Failed to load tvcable' }, { status: 500 });
  }
}
