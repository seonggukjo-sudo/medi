const schemaSql = `
CREATE TABLE IF NOT EXISTS hospitals (hospital_id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Seoul', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY NOT NULL, hospital_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', last_login_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS users_hospital_idx ON users (hospital_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE TABLE IF NOT EXISTS hospital_settings (hospital_id TEXT PRIMARY KEY NOT NULL, operation_profile TEXT NOT NULL DEFAULT 'weekly_meeting', alert_policy_json TEXT NOT NULL DEFAULT '{}', notification_targets_json TEXT NOT NULL DEFAULT '[]', updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS upload_batches (batch_id TEXT PRIMARY KEY NOT NULL, hospital_id TEXT NOT NULL, uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL, status TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0, warning_count INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS upload_batches_hospital_uploaded_idx ON upload_batches (hospital_id, uploaded_at);
CREATE TABLE IF NOT EXISTS uploaded_files (file_id TEXT PRIMARY KEY NOT NULL, batch_id TEXT NOT NULL, hospital_id TEXT NOT NULL, table_key TEXT NOT NULL, file_name TEXT NOT NULL, storage_key TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0, warning_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS uploaded_files_batch_idx ON uploaded_files (batch_id);
CREATE INDEX IF NOT EXISTS uploaded_files_hospital_idx ON uploaded_files (hospital_id);
CREATE TABLE IF NOT EXISTS leads (hospital_id TEXT NOT NULL, lead_id TEXT NOT NULL, patient_key TEXT NOT NULL, department TEXT NOT NULL, source_channel TEXT NOT NULL, inquiry_type TEXT NOT NULL, received_at TEXT NOT NULL, status TEXT NOT NULL, batch_id TEXT NOT NULL, PRIMARY KEY (hospital_id, lead_id));
CREATE INDEX IF NOT EXISTS leads_patient_idx ON leads (hospital_id, patient_key);
CREATE INDEX IF NOT EXISTS leads_received_idx ON leads (hospital_id, received_at);
CREATE TABLE IF NOT EXISTS appointments (hospital_id TEXT NOT NULL, appointment_id TEXT NOT NULL, lead_id TEXT, patient_key TEXT NOT NULL, department TEXT NOT NULL, scheduled_at TEXT NOT NULL, status TEXT NOT NULL, batch_id TEXT NOT NULL, PRIMARY KEY (hospital_id, appointment_id));
CREATE INDEX IF NOT EXISTS appointments_scheduled_idx ON appointments (hospital_id, scheduled_at);
CREATE TABLE IF NOT EXISTS visits (hospital_id TEXT NOT NULL, visit_id TEXT NOT NULL, appointment_id TEXT, patient_key TEXT NOT NULL, department TEXT NOT NULL, visit_source TEXT NOT NULL, visit_type TEXT NOT NULL, visited_at TEXT NOT NULL, batch_id TEXT NOT NULL, PRIMARY KEY (hospital_id, visit_id));
CREATE INDEX IF NOT EXISTS visits_visited_idx ON visits (hospital_id, visited_at);
CREATE TABLE IF NOT EXISTS payments (hospital_id TEXT NOT NULL, payment_id TEXT NOT NULL, visit_id TEXT, patient_key TEXT NOT NULL, department TEXT NOT NULL, net_amount INTEGER NOT NULL, paid_at TEXT NOT NULL, batch_id TEXT NOT NULL, PRIMARY KEY (hospital_id, payment_id));
CREATE INDEX IF NOT EXISTS payments_paid_idx ON payments (hospital_id, paid_at);
CREATE TABLE IF NOT EXISTS ad_spend (hospital_id TEXT NOT NULL, spend_id TEXT NOT NULL, channel TEXT NOT NULL, campaign_name TEXT NOT NULL, cost INTEGER NOT NULL, impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, spend_date TEXT NOT NULL, batch_id TEXT NOT NULL, PRIMARY KEY (hospital_id, spend_id));
CREATE INDEX IF NOT EXISTS ad_spend_date_idx ON ad_spend (hospital_id, spend_date);
CREATE TABLE IF NOT EXISTS ai_reports (report_id TEXT PRIMARY KEY NOT NULL, hospital_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, generated_by TEXT NOT NULL, generated_at TEXT NOT NULL, model_version TEXT NOT NULL, report_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ai_reports_hospital_period_idx ON ai_reports (hospital_id, period_start, period_end);
CREATE TABLE IF NOT EXISTS audit_logs (log_id TEXT PRIMARY KEY NOT NULL, hospital_id TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, created_at TEXT NOT NULL, metadata_json TEXT);
CREATE INDEX IF NOT EXISTS audit_logs_hospital_created_idx ON audit_logs (hospital_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE TABLE IF NOT EXISTS kpi_snapshots (snapshot_id TEXT PRIMARY KEY NOT NULL, hospital_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, inquiry INTEGER NOT NULL, reservation INTEGER NOT NULL, visit INTEGER NOT NULL, sales INTEGER NOT NULL, ad_spend INTEGER NOT NULL, roas REAL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS kpi_snapshots_hospital_period_idx ON kpi_snapshots (hospital_id, period_start, period_end);
`;

let schemaPromise: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
  if (schemaPromise) return schemaPromise;

  const statements = schemaSql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => db.prepare(statement));

  schemaPromise = db.batch(statements).then(() => undefined).catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}
