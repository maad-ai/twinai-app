/**
 * Social-content ingestion via Apify actors (TikTok + Instagram).
 * The creator pastes their own @handle; we scrape their PUBLIC posts'
 * captions to train the twin. Zero effort for the creator, no official
 * API / OAuth needed.
 *
 * Degrades gracefully: without APIFY_TOKEN every function reports
 * "not configured" so the app never crashes before the key is set.
 *
 * Flow is async by design (profile scrapes take 30-120s, longer than a
 * serverless request): startProfileScrape() launches a run and returns its
 * id; the train GET route later resolves finished runs lazily.
 */

const APIFY_BASE = 'https://api.apify.com/v2';

const ACTORS = {
  tiktok: 'clockworks~tiktok-scraper',
  instagram: 'apify~instagram-scraper',
} as const;

export type SocialPlatform = keyof typeof ACTORS;

export function hasApify(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

/** Strip @, URLs, query strings → bare username. */
export function normalizeHandle(input: string): string | null {
  let h = input.trim();
  if (!h) return null;
  // Pull username out of a profile URL if they pasted one
  const urlMatch = h.match(/(?:tiktok\.com\/@|instagram\.com\/)([A-Za-z0-9._]+)/i);
  if (urlMatch) h = urlMatch[1];
  h = h.replace(/^@/, '').split(/[/?#]/)[0].trim();
  if (!/^[A-Za-z0-9._]{1,40}$/.test(h)) return null;
  return h;
}

function actorInput(platform: SocialPlatform, handle: string, limit: number) {
  if (platform === 'tiktok') {
    return {
      profiles: [handle],
      resultsPerPage: limit,
      profileSorting: 'latest',
      excludePinnedPosts: false,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    };
  }
  return {
    directUrls: [`https://www.instagram.com/${handle}/`],
    resultsType: 'posts',
    resultsLimit: limit,
    addParentData: false,
  };
}

/**
 * Launch an Apify run for a profile. Returns { runId, datasetId } or throws
 * a user-presentable Error.
 */
export async function startProfileScrape(
  platform: SocialPlatform,
  handle: string,
  limit = 30
): Promise<{ runId: string; datasetId: string }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('Social import is not enabled yet.');

  const res = await fetch(`${APIFY_BASE}/acts/${ACTORS[platform]}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(actorInput(platform, handle, limit)),
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error(`Apify run start failed (${platform}):`, res.status, await res.text().catch(() => ''));
    throw new Error('Could not start the import — try again in a minute.');
  }

  const data = (await res.json()) as { data?: { id?: string; defaultDatasetId?: string } };
  if (!data.data?.id || !data.data?.defaultDatasetId) {
    throw new Error('Could not start the import — try again in a minute.');
  }
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

export type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** Poll a run's status (READY/RUNNING → RUNNING; terminal-bad → FAILED). */
export async function getRunStatus(runId: string): Promise<RunStatus> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return 'FAILED';
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`, { cache: 'no-store' });
  if (!res.ok) return 'FAILED';
  const data = (await res.json()) as { data?: { status?: string } };
  const s = data.data?.status;
  if (s === 'SUCCEEDED') return 'SUCCEEDED';
  if (s === 'READY' || s === 'RUNNING') return 'RUNNING';
  return 'FAILED'; // FAILED, TIMED-OUT, ABORTED…
}

interface TikTokItem {
  text?: string;
}
interface InstagramItem {
  caption?: string;
}

/**
 * Fetch a finished run's dataset and concatenate the captions into one
 * training blob. Returns { text, count } (count = posts found).
 */
export async function collectScrapedText(
  platform: SocialPlatform,
  datasetId: string,
  max = 50
): Promise<{ text: string; count: number }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { text: '', count: 0 };

  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&clean=true&limit=${max}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return { text: '', count: 0 };

  const items = (await res.json()) as unknown[];
  const captions: string[] = [];

  for (const raw of items) {
    const cap =
      platform === 'tiktok'
        ? (raw as TikTokItem).text
        : (raw as InstagramItem).caption;
    if (cap && cap.trim().length > 0) captions.push(cap.trim());
  }

  const text = captions.join('\n\n').slice(0, 50000);
  return { text, count: captions.length };
}
