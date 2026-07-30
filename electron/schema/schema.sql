CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_updated_at ON shops(updated_at);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_updated_at ON social_accounts(updated_at);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_updated_at ON emails(updated_at);

CREATE TABLE IF NOT EXISTS phones (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_phones_user_id ON phones(user_id);
CREATE INDEX IF NOT EXISTS idx_phones_updated_at ON phones(updated_at);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_updated_at ON companies(updated_at);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_updated_at ON credentials(updated_at);

CREATE TABLE IF NOT EXISTS general_accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_general_accounts_user_id ON general_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_general_accounts_updated_at ON general_accounts(updated_at);

CREATE TABLE IF NOT EXISTS website_account_categories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_wac_user_id ON website_account_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_wac_updated_at ON website_account_categories(updated_at);

CREATE TABLE IF NOT EXISTS website_accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_wa_user_id ON website_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_updated_at ON website_accounts(updated_at);

CREATE TABLE IF NOT EXISTS todo_categories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_tc_user_id ON todo_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tc_updated_at ON todo_categories(updated_at);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON todos(updated_at);

CREATE TABLE IF NOT EXISTS quick_reply_categories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_qrc_user_id ON quick_reply_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_qrc_updated_at ON quick_reply_categories(updated_at);

CREATE TABLE IF NOT EXISTS quick_replies (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_qr_user_id ON quick_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_updated_at ON quick_replies(updated_at);

CREATE TABLE IF NOT EXISTS clipboard_categories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_cc_user_id ON clipboard_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_updated_at ON clipboard_categories(updated_at);

CREATE TABLE IF NOT EXISTS clipboard_items (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_ci_user_id ON clipboard_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ci_updated_at ON clipboard_items(updated_at);

CREATE TABLE IF NOT EXISTS memo_categories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_mc_user_id ON memo_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_mc_updated_at ON memo_categories(updated_at);

CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at);

CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS pending_operations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  synced INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_po_user_id ON pending_operations(user_id);

CREATE TABLE IF NOT EXISTS plugin_data (
  id TEXT PRIMARY KEY, plugin_id TEXT NOT NULL, user_id TEXT NOT NULL,
  data_key TEXT NOT NULL, data_value TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_pd_plugin ON plugin_data(plugin_id);
CREATE INDEX IF NOT EXISTS idx_pd_user ON plugin_data(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pd_unique ON plugin_data(plugin_id, user_id, data_key);