const DEFAULT_SETTINGS = {
  footer: {
    phone: "",
    whatsapp: "",
    address: "",
    openingHours: "",
  },
  seo: {
    titleSuffix: "",
    defaultOgImage: "",
  },
  features: {
    blogEnabled: true,
    madEnabled: true,
  },
};

function ensureDefaultSettings(db) {
  const existing = db.prepare("SELECT key FROM settings").all();
  const keys = new Set(existing.map((row) => row.key));
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!keys.has(key)) {
      db.prepare("INSERT INTO settings (key, value_json) VALUES (?, ?)").run(key, JSON.stringify(value));
    }
  }
}

function getSettings(db) {
  const rows = db.prepare("SELECT key, value_json FROM settings").all();
  const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value_json);
    } catch (err) {
      settings[row.key] = DEFAULT_SETTINGS[row.key] || {};
    }
  }
  return settings;
}

function updateSettings(db, input) {
  const settings = {
    footer: input.footer || DEFAULT_SETTINGS.footer,
    seo: input.seo || DEFAULT_SETTINGS.seo,
    features: input.features || DEFAULT_SETTINGS.features,
  };

  for (const [key, value] of Object.entries(settings)) {
    db.prepare("INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json").run(
      key,
      JSON.stringify(value)
    );
  }

  return getSettings(db);
}

module.exports = {
  DEFAULT_SETTINGS,
  ensureDefaultSettings,
  getSettings,
  updateSettings,
};
