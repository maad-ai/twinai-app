/**
 * Zero-effort YouTube ingestion: the creator pastes a video URL and we pull
 * the transcript server-side via youtubei.js (maintained InnerTube client —
 * survives YouTube's anti-bot changes far better than raw scraping).
 *
 * Strategy: create a local session, read caption_tracks from getInfo(), and
 * fetch the best track as json3. Original-language human captions preferred,
 * auto-generated (asr) accepted as fallback.
 */
import { Innertube } from 'youtubei.js';

let innertubePromise: Promise<Innertube> | null = null;

function getInnertube(): Promise<Innertube> {
  if (!innertubePromise) {
    // Note: the player IS required — caption_tracks come from the player response.
    innertubePromise = Innertube.create({ generate_session_locally: true });
  }
  return innertubePromise;
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const short = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      if (short) return short[2];
    }
    return null;
  } catch {
    return null;
  }
}

interface CaptionTrack {
  base_url: string;
  language_code?: string;
  vss_id?: string; // '.en' = human captions, 'a.en' = auto-generated
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack {
  const human = tracks.filter((t) => !String(t.vss_id || '').startsWith('a.'));
  const preferred = ['en', 'fr', 'es'];
  for (const lang of preferred) {
    const hit = human.find((t) => (t.language_code || '').startsWith(lang));
    if (hit) return hit;
  }
  return human[0] || tracks[0];
}

interface Json3Event {
  segs?: { utf8?: string }[];
}

/**
 * Fetch the transcript of a public YouTube video.
 * Returns { title, text } or throws with a user-presentable message.
 */
export async function fetchYouTubeTranscript(
  videoId: string
): Promise<{ title: string; text: string }> {
  const yt = await getInnertube();

  // Datacenter IPs (Vercel) often get bot-gated responses with no captions
  // on the default WEB client — fall back through alternate clients.
  let info: { basic_info?: { title?: string }; captions?: { caption_tracks?: unknown }; playability_status?: { status?: string; reason?: string } } | null = null;
  let tracks: CaptionTrack[] = [];
  let lastPlayability = '';

  for (const client of [undefined, 'MWEB', 'TV_EMBEDDED'] as const) {
    try {
      info = client
        ? await yt.getBasicInfo(videoId, { client })
        : await yt.getInfo(videoId);
      tracks = (info.captions?.caption_tracks || []) as CaptionTrack[];
      lastPlayability = info.playability_status?.status || '';
      if (tracks.length) break;
      console.warn(
        `[youtube] no captions via ${client || 'WEB'} (playability: ${lastPlayability} ${info.playability_status?.reason || ''})`
      );
    } catch (err) {
      console.warn(`[youtube] ${client || 'WEB'} client failed:`, err instanceof Error ? err.message : err);
    }
  }

  if (!info) {
    throw new Error('Could not load this video — check the link and try again.');
  }

  const title: string = info.basic_info?.title || 'YouTube video';

  if (!tracks.length) {
    if (lastPlayability && lastPlayability !== 'OK') {
      throw new Error(
        'YouTube is blocking our server right now — try again in a few minutes, or paste the script as text.'
      );
    }
    throw new Error('This video has no captions — paste the script as text instead.');
  }

  const track = pickTrack(tracks);

  let text = '';
  try {
    const res = await fetch(`${track.base_url}&fmt=json3`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    });
    const body = await res.text();
    if (!res.ok || !body) throw new Error('empty');
    const data = JSON.parse(body) as { events?: Json3Event[] };
    text = (data.events || [])
      .flatMap((e) => (e.segs || []).map((s) => s.utf8 || ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    throw new Error('Could not download the captions — try again or paste the text.');
  }

  if (text.length < 100) {
    throw new Error('The captions are too short to train on — paste the script as text instead.');
  }

  return { title, text: text.slice(0, 50000) };
}
