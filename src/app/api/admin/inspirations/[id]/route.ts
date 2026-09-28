import { NextRequest, NextResponse } from 'next/server';
import { deleteInspiration } from '@/storage/database/inspirationManager';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteInspiration(id);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Inspiration not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting inspiration:', error);
    return NextResponse.json(
      { error: 'Failed to delete inspiration' },
      { status: 500 }
    );
  }
}
