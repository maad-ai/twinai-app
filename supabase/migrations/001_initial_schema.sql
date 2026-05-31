-- ============================================================
-- Twiinn AI — Initial Schema
-- ============================================================

-- Profiles (extension de Clerk user)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id      TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'fan'
                CHECK (role IN ('fan', 'creator', 'both')),
  stripe_customer_id    TEXT,
  stripe_connect_id     TEXT,
  onboarding_completed  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_profiles_clerk ON profiles(clerk_id);

-- Twins (le chatbot AI d'un creator)
CREATE TABLE twins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  tagline       TEXT,
  niche         TEXT,
  avatar_url    TEXT,
  photo_url     TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  personality   JSONB DEFAULT '{}',
  settings      JSONB DEFAULT '{
    "auto_moderation": false,
    "blocked_topics": [],
    "welcome_message": "",
    "response_style": "casual"
  }',
  status        TEXT DEFAULT 'draft'
                CHECK (status IN ('draft', 'training', 'active', 'paused')),
  monthly_price_cents  INT NOT NULL DEFAULT 999,
  stripe_price_id      TEXT,
  stripe_product_id    TEXT,
  total_subscribers    INT DEFAULT 0,
  total_messages       INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_twins_creator ON twins(creator_id);
CREATE INDEX idx_twins_slug ON twins(slug);
CREATE INDEX idx_twins_status ON twins(status);

-- Training content (contenu uploade par le creator)
CREATE TABLE training_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id       UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL
                CHECK (source_type IN ('upload', 'youtube', 'tiktok', 'instagram', 'text', 'questionnaire')),
  source_url    TEXT,
  file_path     TEXT,
  raw_text      TEXT,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'embedded', 'error')),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_training_twin ON training_content(twin_id);

-- Subscriptions (abonnement fan -> twin)
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  twin_id       UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  credits_remaining  INT DEFAULT 100,
  credits_total      INT DEFAULT 100,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fan_id, twin_id)
);
CREATE INDEX idx_subs_fan ON subscriptions(fan_id);
CREATE INDEX idx_subs_twin ON subscriptions(twin_id);

-- Conversations
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  twin_id       UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  last_message_at   TIMESTAMPTZ DEFAULT now(),
  message_count     INT DEFAULT 0,
  flagged           BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fan_id, twin_id)
);
CREATE INDEX idx_convos_fan ON conversations(fan_id);
CREATE INDEX idx_convos_twin ON conversations(twin_id);

-- Messages (chiffrees)
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted  BYTEA NOT NULL,
  content_iv        BYTEA NOT NULL,
  flagged       BOOLEAN DEFAULT FALSE,
  tokens_used   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_convo ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at DESC);

-- Credit transactions
CREATE TABLE credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('monthly_reset', 'message_sent', 'pack_purchased')),
  amount        INT NOT NULL,
  balance_after INT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Earnings (revenus creators)
CREATE TABLE earnings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  twin_id       UUID NOT NULL REFERENCES twins(id),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  gross_amount_cents    INT NOT NULL DEFAULT 0,
  platform_fee_cents    INT NOT NULL DEFAULT 0,
  net_amount_cents      INT NOT NULL DEFAULT 0,
  stripe_transfer_id    TEXT,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending', 'paid', 'failed')),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_earnings_creator ON earnings(creator_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE twins ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for webhooks)
CREATE POLICY "Service role full access" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON twins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON training_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON earnings FOR ALL USING (true) WITH CHECK (true);
