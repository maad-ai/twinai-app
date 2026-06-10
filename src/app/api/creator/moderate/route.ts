import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeMessage } from '@/lib/encryption';
import { parseBody, moderateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// GET: read messages of a conversation (creator only)
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId');
  if (!conversationId) return Response.json({ error: 'Conversation ID required' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('id').eq('clerk_id', userId).maybeSingle();
  if (!profile) return Response.json({ error: 'Not found' }, { status: 404 });

  // Verify creator owns the twin in this conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, twin_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('id', conversation.twin_id)
    .eq('creator_id', profile.id)
    .maybeSingle();

  if (!twin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content_encrypted, content_iv, created_at, flagged')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  const decoded = (messages || []).map((m) => ({
    id: m.id,
    role: m.role,
    content: decodeMessage(m.content_encrypted, m.content_iv),
    created_at: m.created_at,
    flagged: m.flagged,
  }));

  return Response.json({ messages: decoded });
}

// POST: flag/unflag a conversation
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: body, error: validationError } = await parseBody(req, moderateSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('id').eq('clerk_id', userId).maybeSingle();
  if (!profile) return Response.json({ error: 'Not found' }, { status: 404 });

  // Verify ownership
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, twin_id')
    .eq('id', body.conversationId)
    .maybeSingle();

  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 });

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('id', conversation.twin_id)
    .eq('creator_id', profile.id)
    .maybeSingle();

  if (!twin) return Response.json({ error: 'Unauthorized' }, { status: 403 });

  await supabase
    .from('conversations')
    .update({ flagged: body.action === 'flag' })
    .eq('id', body.conversationId);

  return Response.json({ success: true });
}
