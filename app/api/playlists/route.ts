import { type NextRequest, NextResponse } from 'next/server';
import {
  createPlaylist,
  deletePlaylist,
  getAllPlaylists,
  renamePlaylist,
  reorderPlaylists,
} from '@/lib/db/queries';

export async function GET() {
  return NextResponse.json({ ok: true, playlists: getAllPlaylists() });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || normalizedName.length > 80) {
    return NextResponse.json(
      { ok: false, error: 'Tên danh sách phải có từ 1 đến 80 ký tự' },
      { status: 400 },
    );
  }
  const playlist = createPlaylist(normalizedName);
  return NextResponse.json({ ok: true, playlist });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (Array.isArray(body.ids)) {
    if (!body.ids.every((id: unknown) => Number.isInteger(id))) {
      return NextResponse.json(
        { ok: false, error: 'Thứ tự danh sách không hợp lệ' },
        { status: 400 },
      );
    }
    reorderPlaylists(body.ids);
  } else if (Number.isInteger(body.id)) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (body.id === 1 || !name || name.length > 80) {
      return NextResponse.json(
        { ok: false, error: 'Không thể đổi tên danh sách này' },
        { status: 400 },
      );
    }
    renamePlaylist(body.id, name);
  } else {
    return NextResponse.json(
      { ok: false, error: 'Dữ liệu cập nhật không hợp lệ' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!Number.isInteger(id) || id <= 1) {
    return NextResponse.json(
      { ok: false, error: 'Không thể xóa danh sách này' },
      { status: 400 },
    );
  }
  deletePlaylist(id);
  return NextResponse.json({ ok: true });
}
