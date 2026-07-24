import { redirect } from 'next/navigation';
import { resolveShortCode } from '@/lib/shortlink';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const path = resolveShortCode(code);

  if (!path) {
    redirect('/');
  }

  redirect(path);
}
