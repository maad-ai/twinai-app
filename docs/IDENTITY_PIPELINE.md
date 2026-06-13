# Identity Pipeline — comment un twin devient « exactement la personne »

Objectif produit : zéro compétence technique côté créateur. Trois couches,
chacune avec sa source et son point d'injection.

## Les 3 couches

| Couche | Quoi | Source créateur | Injection |
|---|---|---|---|
| **1. IDENTITÉ** (qui je suis) | surnom des fans, salutation, catchphrases, opinions, jamais-dire, backstory | Questionnaire « Make it sound like you » (`/creator/twin/identity`) | Sections IDENTITY du system prompt (`lib/twin-prompt.ts`) |
| **2. VOIX** (comment je parle) | vraies paires Q→R écrites par le créateur | Même questionnaire, section « Answer like you would » | Few-shot VOICE dans le system prompt — le signal le plus puissant |
| **3. SAVOIR** (ce que je sais) | transcripts vidéos, posts, textes | Training (`/creator/twin/training`) : coller un lien YouTube (transcript auto via `lib/youtube.ts` + youtubei.js) ou du texte | Chunks en contexte RAG au moment du chat (`lib/ai/provider.ts`) |

Tout est stocké dans `twins.settings.identity` (JSONB) + `training_content`.
Chaque sauvegarde régénère `system_prompt` via `buildPromptFromTwin()` qui
relit TOUTES les couches (identité + langues + sujets bloqués) — ne jamais
reconstruire le prompt ailleurs.

## Implémenté (2026-06-12)

- Questionnaire identité complet + PATCH `/api/twin/identity`
- Voice examples en few-shot dans le prompt
- Multi-langues (`settings.languages`, réponse dans la langue du fan)
- YouTube : coller un lien → transcript automatique (youtubei.js, session
  locale, préférence captions humaines en/fr/es, fallback erreurs claires)
- Plancher de rentabilité : `MIN_CENTS_PER_CREDIT` (6¢/message) +
  `MIN_TIER_CENTS` (4,99 $) appliqués serveur (Zod) et UI

## Prochaines étapes (ordre conseillé)

1. **Embeddings + pgvector (Vague 3)** — aujourd'hui le chat injecte les 5
   premiers chunks sans recherche. Choisir Voyage AI ou équivalent, table
   `chunks` avec vecteurs, RPC `search_twin_content`.
2. **Chaîne YouTube complète** — coller l'URL de la chaîne → lister les
   N dernières vidéos (youtubei.js `getChannel`) → ingérer chaque transcript.
3. ~~**TikTok / Instagram**~~ ✅ FAIT (2026-06-13) — `lib/apify.ts` + route
   `/api/twin/connect-social` (lance le run async) + résolution paresseuse
   dans `GET /api/twin/train` (vérifie le run, récupère les captions quand
   SUCCEEDED). UI: onglet « TikTok / Instagram » avec @handle + consentement
   + polling auto 5s. Acteurs `clockworks~tiktok-scraper` (item.text) et
   `apify~instagram-scraper` (item.caption). **DORMANT jusqu'à APIFY_TOKEN
   sur Vercel** (sans: POST → 503 propre). Marc: créer compte apify.com
   (free tier ~$5/mois de crédit), copier le token, l'ajouter dans Vercel
   env du projet `app` (+ .env.local pour tester en local).
4. **Vidéos sans captions** — télécharger l'audio + Whisper (ou Deepgram).
5. **Auto-refresh** — cron hebdo qui ré-ingère les nouvelles vidéos des
   sources connectées.
6. **Mining des conversations** — proposer au créateur les réponses qu'il a
   corrigées (page Questions) comme nouveaux voice examples en 1 clic.

## Pièges connus

- `Innertube.create()` DOIT garder le player (pas de `retrieve_player:false`,
  sinon `caption_tracks` est vide). Endpoint `get_transcript` = 400, ne pas
  l'utiliser; passer par `caption_tracks[].base_url + &fmt=json3`.
- `youtubei.js` est dans `serverExternalPackages` (next.config) — requis.
- timedtext scrappé à la main sans session = réponse vide (token "pot").
