const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/var/www/chatgcm.in/data/gcm_master.sqlite");

db.exec("PRAGMA foreign_keys = OFF;");

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_work_logs (
    id TEXT PRIMARY KEY,
    persona_name TEXT NOT NULL,
    lead_id TEXT,
    phone TEXT,
    website_id TEXT,
    channel TEXT,
    city TEXT,
    action_type TEXT NOT NULL,
    action_title TEXT NOT NULL,
    work_summary TEXT NOT NULL,
    details_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_agent_work_logs_persona ON agent_work_logs(persona_name);
  CREATE INDEX IF NOT EXISTS idx_agent_work_logs_created ON agent_work_logs(created_at DESC);
`);

db.prepare("UPDATE products SET id = ?, brand = ?, product_name = ? WHERE id = ?").run(
  'PROD-RUSSEA-NYLON-30',
  'RUSSEA',
  'RUSSEA™ High-Tenacity Balcony Safety Net with Installation',
  'PROD-GARWARE-NYLON-30'
);

db.prepare("UPDATE products SET id = ?, brand = ?, product_name = ? WHERE id = ?").run(
  'PROD-RUSSEA-PIGEON-25',
  'RUSSEA',
  'RUSSEA™ Invisible Monofilament Bird Netting with Installation',
  'PROD-GARWARE-PIGEON-25'
);

db.prepare("UPDATE pricing_rules SET id = ?, product_id = ? WHERE id = ? OR product_id = ?").run(
  'PR-RUS-BAL-RET',
  'PROD-RUSSEA-NYLON-30',
  'PR-GAR-BAL-RET',
  'PROD-GARWARE-NYLON-30'
);

db.prepare("UPDATE pricing_rules SET id = ?, product_id = ? WHERE id = ? OR product_id = ?").run(
  'PR-RUS-PIG-RET',
  'PROD-RUSSEA-PIGEON-25',
  'PR-GAR-PIG-RET',
  'PROD-GARWARE-PIGEON-25'
);

db.prepare("UPDATE inventory SET id = ?, product_id = ? WHERE id = ? OR product_id = ?").run(
  'INV-RUS-BAL',
  'PROD-RUSSEA-NYLON-30',
  'INV-GAR-BAL',
  'PROD-GARWARE-NYLON-30'
);

db.prepare("UPDATE inventory SET id = ?, product_id = ? WHERE id = ? OR product_id = ?").run(
  'INV-RUS-PIG',
  'PROD-RUSSEA-PIGEON-25',
  'INV-GAR-PIG',
  'PROD-GARWARE-PIGEON-25'
);

db.exec("PRAGMA foreign_keys = ON;");

console.log("Migration executed successfully!");
const prods = db.prepare("SELECT id, brand, product_name FROM products WHERE brand = 'RUSSEA'").all();
console.log("RUSSEA Products in DB:", prods);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Database Tables:", tables.map(t => t.name));
