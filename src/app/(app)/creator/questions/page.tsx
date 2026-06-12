import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { timeAgo } from '@/lib/format';
import { HelpCircle, ArrowRight, Sparkles } from 'lucide-react';

export const metadata = { title: 'Unanswered Questions' };
export const dynamic = 'force-dynamic';

interface QuestionRow {
  question: string;
  normalized: string;
  created_at: string;
}

interface GroupedQuestion {
  question: string;
  count: number;
  lastAsked: string;
}

export default async function CreatorQuestionsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) redirect('/choose-role');

  const twin = await getCreatorTwin(supabase, profile.id, 'id, name');
  if (!twin) redirect('/creator/onboarding');

  // The table may not exist yet (migration 004) — show the empty state.
  let rows: QuestionRow[] = [];
  try {
    const { data, error } = await supabase
      .from('unanswered_questions')
      .select('question, normalized, created_at')
      .eq('twin_id', twin.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) rows = data as QuestionRow[];
  } catch {
    rows = [];
  }

  // Group by normalized text, most recurring first (then most recent)
  const groups = new Map<string, GroupedQuestion>();
  for (const row of rows) {
    const existing = groups.get(row.normalized);
    if (existing) {
      existing.count += 1;
      if (row.created_at > existing.lastAsked) existing.lastAsked = row.created_at;
    } else {
      groups.set(row.normalized, {
        question: row.question,
        count: 1,
        lastAsked: row.created_at,
      });
    }
  }
  const grouped = [...groups.values()].sort(
    (a, b) => b.count - a.count || b.lastAsked.localeCompare(a.lastAsked)
  );

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <HelpCircle className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Unanswered questions</h1>
      </div>
      <p className="text-sm text-[#94A3B8] mb-8">
        Fans asked these, but {twin.name} couldn&apos;t answer — most frequent first. Train your
        twin on the answers and they become wins.
      </p>

      {grouped.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center max-w-md mx-auto">
          <Sparkles className="w-10 h-10 text-[#A855F7]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">Nothing here yet</p>
          <p className="text-sm text-[#94A3B8]">
            Your twin has handled everything fans asked. Questions it can&apos;t answer will appear
            here, most frequent first.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div
              key={g.question}
              className="card rounded-2xl p-5 flex flex-wrap items-center gap-4 justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-600 text-[#0F0F23] leading-snug">&ldquo;{g.question}&rdquo;</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-700 text-[#A855F7] bg-[#A855F7]/10 px-2 py-0.5 rounded-full">
                    asked {g.count}&times;
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    last asked {timeAgo(g.lastAsked)}
                  </span>
                </div>
              </div>
              <Link
                href="/creator/twin/training"
                className="text-sm font-600 text-[#A855F7] hover:underline flex items-center gap-1 flex-shrink-0"
              >
                Train the answer <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
