# Migrations à appliquer (2 minutes)

Trois nouvelles features ont besoin de colonnes/tables en DB. **Le site fonctionne
sans** (le code dégrade proprement), mais les features s'activent seulement après.

👉 Ouvre le **SQL Editor** de Supabase (projet `kakyqyenwgozwgkllhax`) et colle le
bloc ci-dessous, puis Run :

```sql
-- 003: badge "Twiinn Certified"
ALTER TABLE twins
  ADD COLUMN IF NOT EXISTS certified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_twins_certified ON twins (certified) WHERE certified;

-- 004: questions auxquelles le twin n'a pas su répondre
CREATE TABLE IF NOT EXISTS unanswered_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id     UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  normalized  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unanswered_twin_norm
  ON unanswered_questions (twin_id, normalized);
CREATE INDEX IF NOT EXISTS idx_unanswered_twin_created
  ON unanswered_questions (twin_id, created_at DESC);

-- 005: compte Stripe Connect du créateur (payouts)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
```

## Après les migrations

- **Certifier un twin** (manuel pour l'instant) :
  `UPDATE twins SET certified = TRUE WHERE slug = 'le-slug';`
- **Tester les questions sans réponse** : demande à ton twin un truc hors sujet
  ("c'est quoi ta crypto préférée?") → ça apparaît dans Creator → Questions.
- **Payouts** : Creator → Earnings → "Set up payouts" (Stripe Express, mode test
  en local / live en prod selon les clés).

Ce fichier peut être supprimé une fois les migrations passées.
