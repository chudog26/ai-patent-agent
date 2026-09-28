import { NextRequest, NextResponse } from 'next/server';
import { getInspirations } from '@/storage/database/inspirationManager';

export async function GET(request: NextRequest) {
  try {
    const inspirations = await getInspirations();
    return NextResponse.json(inspirations);
  } catch (error) {
    console.error('Error fetching inspirations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspirations' },
      { status: 500 }
    );
  }
}
