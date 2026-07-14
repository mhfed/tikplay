import { type NextRequest, NextResponse } from 'next/server';
import { createAutoRule, deleteAutoRule, getAutoRules } from '@/lib/db/queries';

export async function GET() {
  return NextResponse.json({ ok: true, rules: getAutoRules() });
}

export async function POST(req: NextRequest) {
  const { playlistId, keyword, matchMode } = await req.json();
  const rule = createAutoRule(playlistId, keyword, matchMode || 'contains');
  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteAutoRule(id);
  return NextResponse.json({ ok: true });
}
