import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeMessage } from '@/lib/encryption';
import { MessageCircle, Flag, Shield } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { timeAgo } from '@/lib/format';

export const metadata = { title: 'Conversations' };

export default async function CreatorConversationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) redirect('/choose-role');

  const { data: twin } = await supabase
    .from('twins')
    .select('id, name')
    .eq('creator_id', profile.id)
    .single();

  if (!twin) redirect('/creator/onboarding');

  // Get all conversations for this twin
  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id,
      message_count,
      last_message_at,
      flagged,
      fan_id,
      profiles!conversations_fan_id_fkey (
        display_name,
        avatar_url
      )
    `)
    .eq('twin_id', twin.id)
    .order('last_message_at', { ascending: false });

  // Get last message for each conversation
  const convosWithLastMsg = await Promise.all(
    (conversations || []).map(async (conv) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('role, content_encrypted, content_iv, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...conv,
        lastMessage: lastMsg ? decodeMessage(lastMsg.content_encrypted, lastMsg.content_iv) : null,
        lastMessageRole: lastMsg?.role,
      };
    })
  );

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Conversations</h1>
      </div>
      <p className="text-[#94A3B8] mb-6 text-sm">
        Review how your twin is chatting with fans. Flag inappropriate conversations.
      </p>

      {!convosWithLastMsg.length ? (
        <div className="card rounded-2xl p-12 text-center">
          <MessageCircle className="w-10 h-10 text-[#94A3B8]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">No conversations yet</p>
          <p className="text-sm text-[#94A3B8]">When fans chat with your twin, conversations will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {convosWithLastMsg.map((conv) => {
            const fanProfile = conv.profiles as unknown as { display_name: string } | null;
            const fanName = fanProfile?.display_name || 'Anonymous';
            return (
              <Link
                key={conv.id}
                href={`/creator/conversations/${conv.id}`}
                className={`card rounded-xl p-4 flex items-center gap-3 block transition-all hover:border-[#A855F7]/20 ${
                  conv.flagged ? 'border-[#FF6B6B]/30 bg-[#FF6B6B]/5' : ''
                }`}
              >
                <Avatar name={fanName} size="md" variant="neutral" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-600 text-sm text-[#0F0F23]">{fanName}</p>
                    {conv.flagged && <Flag className="w-3 h-3 text-[#FF6B6B]" />}
                  </div>
                  <p className="text-xs text-[#94A3B8] truncate">
                    {conv.lastMessageRole === 'assistant' ? `${twin.name}: ` : 'Fan: '}
                    {conv.lastMessage?.substring(0, 80) || 'No messages'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-[#94A3B8]">{timeAgo(conv.last_message_at)}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{conv.message_count} msg</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
