import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function decodeContent(data: unknown): string {
  if (data && typeof data === 'object' && 'type' in (data as Record<string, unknown>) && (data as Record<string, unknown>).type === 'Buffer') {
    return Buffer.from((data as { data: number[] }).data).toString('utf-8');
  }
  if (typeof data === 'string') {
    if (data.startsWith('\\x')) return Buffer.from(data.slice(2), 'hex').toString('utf-8');
    try {
      const p = JSON.parse(data);
      if (p?.type === 'Buffer') return Buffer.from(p.data).toString('utf-8');
    } catch { /* */ }
    return data;
  }
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  return String(data);
}

// GET: read messages of a conversation (creator only)
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId');
  if (!conversationId) return Response.json({ error: 'Conversation ID required' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('id').eq('clerk_id', userId).single();
  if (!profile) return Response.json({ error: 'Not found' }, { status: 404 });

  // Verify creator owns the twin in this conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, twin_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('id', conversation.twin_id)
    .eq('creator_id', profile.id)
    .single();

  if (!twin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content_encrypted, created_at, flagged')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  const decoded = (messages || []).map((m) => ({
    id: m.id,
    role: m.role,
    content: decodeContent(m.content_encrypted),
    created_at: m.created_at,
    flagged: m.flagged,
  }));

  return Response.json({ messages: decoded });
}

// POST: flag/unflag a conversation
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { conversationId, action } = body;

  if (!conversationId || !action) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('id').eq('clerk_id', userId).single();
  if (!profile) return Response.json({ error: 'Not found' }, { status: 404 });

  // Verify ownership
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, twin_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 });

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('id', conversation.twin_id)
    .eq('creator_id', profile.id)
    .single();

  if (!twin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  if (action === 'flag') {
    await supabase.from('conversations').update({ flagged: true }).eq('id', conversationId);
  } else if (action === 'unflag') {
    await supabase.from('conversations').update({ flagged: false }).eq('id', conversationId);
  }

  return Response.json({ success: true });
}
