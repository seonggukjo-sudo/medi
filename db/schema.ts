import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const hospitals = sqliteTable("hospitals", {
  hospitalId: text("hospital_id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

export const users = sqliteTable(
  "users",
  {
    userId: text("user_id").primaryKey(),
    hospitalId: text("hospital_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["owner", "admin", "marketer", "counselor", "viewer"] }).notNull(),
    status: text("status").notNull().default("active"),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    hospitalIdx: index("users_hospital_idx").on(table.hospitalId),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

export const hospitalSettings = sqliteTable(
  "hospital_settings",
  {
    hospitalId: text("hospital_id").primaryKey(),
    operationProfile: text("operation_profile").notNull().default("weekly_meeting"),
    alertPolicyJson: text("alert_policy_json").notNull().default("{}"),
    notificationTargetsJson: text("notification_targets_json").notNull().default("[]"),
    updatedBy: text("updated_by").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const uploadBatches = sqliteTable(
  "upload_batches",
  {
    batchId: text("batch_id").primaryKey(),
    hospitalId: text("hospital_id").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
    status: text("status", { enum: ["validated", "needs_review", "failed"] }).notNull(),
    rowCount: integer("row_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
  },
  (table) => ({
    hospitalUploadedIdx: index("upload_batches_hospital_uploaded_idx").on(table.hospitalId, table.uploadedAt),
  }),
);

export const uploadedFiles = sqliteTable(
  "uploaded_files",
  {
    fileId: text("file_id").primaryKey(),
    batchId: text("batch_id").notNull(),
    hospitalId: text("hospital_id").notNull(),
    tableKey: text("table_key").notNull(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    batchIdx: index("uploaded_files_batch_idx").on(table.batchId),
    hospitalIdx: index("uploaded_files_hospital_idx").on(table.hospitalId),
  }),
);

export const leads = sqliteTable(
  "leads",
  {
    hospitalId: text("hospital_id").notNull(),
    leadId: text("lead_id").notNull(),
    patientKey: text("patient_key").notNull(),
    department: text("department").notNull(),
    sourceChannel: text("source_channel").notNull(),
    inquiryType: text("inquiry_type").notNull(),
    receivedAt: text("received_at").notNull(),
    status: text("status").notNull(),
    batchId: text("batch_id").notNull(),
  },
  (table) => ({
    leadPk: primaryKey({ columns: [table.hospitalId, table.leadId] }),
    patientIdx: index("leads_patient_idx").on(table.hospitalId, table.patientKey),
    receivedIdx: index("leads_received_idx").on(table.hospitalId, table.receivedAt),
  }),
);

export const appointments = sqliteTable(
  "appointments",
  {
    hospitalId: text("hospital_id").notNull(),
    appointmentId: text("appointment_id").notNull(),
    leadId: text("lead_id"),
    patientKey: text("patient_key").notNull(),
    department: text("department").notNull(),
    bookedAt: text("booked_at").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status").notNull(),
    batchId: text("batch_id").notNull(),
  },
  (table) => ({
    appointmentPk: primaryKey({ columns: [table.hospitalId, table.appointmentId] }),
    bookedIdx: index("appointments_booked_idx").on(table.hospitalId, table.bookedAt),
    scheduledIdx: index("appointments_scheduled_idx").on(table.hospitalId, table.scheduledAt),
  }),
);

export const visits = sqliteTable(
  "visits",
  {
    hospitalId: text("hospital_id").notNull(),
    visitId: text("visit_id").notNull(),
    appointmentId: text("appointment_id"),
    patientKey: text("patient_key").notNull(),
    department: text("department").notNull(),
    visitSource: text("visit_source").notNull(),
    visitType: text("visit_type").notNull(),
    visitedAt: text("visited_at").notNull(),
    batchId: text("batch_id").notNull(),
  },
  (table) => ({
    visitPk: primaryKey({ columns: [table.hospitalId, table.visitId] }),
    visitedIdx: index("visits_visited_idx").on(table.hospitalId, table.visitedAt),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    hospitalId: text("hospital_id").notNull(),
    paymentId: text("payment_id").notNull(),
    visitId: text("visit_id"),
    patientKey: text("patient_key").notNull(),
    department: text("department").notNull(),
    grossAmount: integer("gross_amount").notNull().default(0),
    refundAmount: integer("refund_amount").notNull().default(0),
    netAmount: integer("net_amount").notNull(),
    paidAt: text("paid_at").notNull(),
    batchId: text("batch_id").notNull(),
  },
  (table) => ({
    paymentPk: primaryKey({ columns: [table.hospitalId, table.paymentId] }),
    paidIdx: index("payments_paid_idx").on(table.hospitalId, table.paidAt),
  }),
);

export const adSpend = sqliteTable(
  "ad_spend",
  {
    hospitalId: text("hospital_id").notNull(),
    spendId: text("spend_id").notNull(),
    channel: text("channel").notNull(),
    campaignName: text("campaign_name").notNull(),
    cost: integer("cost").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    spendDate: text("spend_date").notNull(),
    batchId: text("batch_id").notNull(),
  },
  (table) => ({
    spendPk: primaryKey({ columns: [table.hospitalId, table.spendId] }),
    dateIdx: index("ad_spend_date_idx").on(table.hospitalId, table.spendDate),
  }),
);

export const aiReports = sqliteTable(
  "ai_reports",
  {
    reportId: text("report_id").primaryKey(),
    hospitalId: text("hospital_id").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    generatedBy: text("generated_by").notNull(),
    generatedAt: text("generated_at").notNull(),
    modelVersion: text("model_version").notNull(),
    reportJson: text("report_json").notNull(),
  },
  (table) => ({
    hospitalPeriodIdx: index("ai_reports_hospital_period_idx").on(table.hospitalId, table.periodStart, table.periodEnd),
  }),
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    logId: text("log_id").primaryKey(),
    hospitalId: text("hospital_id").notNull(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    createdAt: text("created_at").notNull(),
    metadataJson: text("metadata_json"),
  },
  (table) => ({
    hospitalCreatedIdx: index("audit_logs_hospital_created_idx").on(table.hospitalId, table.createdAt),
    actionIdx: index("audit_logs_action_idx").on(table.action),
  }),
);

export const kpiSnapshots = sqliteTable(
  "kpi_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    hospitalId: text("hospital_id").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    inquiry: integer("inquiry").notNull(),
    reservation: integer("reservation").notNull(),
    visit: integer("visit").notNull(),
    sales: integer("sales").notNull(),
    adSpend: integer("ad_spend").notNull(),
    roas: real("roas"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    hospitalPeriodIdx: index("kpi_snapshots_hospital_period_idx").on(table.hospitalId, table.periodStart, table.periodEnd),
  }),
);
