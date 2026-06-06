import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId');

  if (!conversationId) {
    return Response.json({ error: 'Conversation ID required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Verify the user owns this conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, twin_id')
    .eq('id', conversationId)
    .eq('fan_id', profile.id)
    .single();

  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Get messages
  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content_encrypted, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);

  const decryptedMessages = (messages || []).map((m) => ({
    id: m.id,
    role: m.role,
    content: Buffer.from(m.content_encrypted).toString('utf-8'),
    created_at: m.created_at,
  }));

  return Response.json({ messages: decryptedMessages });
}
