import { getImportTable, type ImportField, type ImportTableKey } from "./data-import-contract";

export type ImportRow = Record<string, unknown>;

export type ImportValidationSeverity = "error" | "warning";

export type ImportValidationIssue = {
  severity: ImportValidationSeverity;
  table: ImportTableKey;
  rowNumber: number;
  field?: string;
  code:
    | "missing_required_field"
    | "invalid_enum_value"
    | "invalid_date"
    | "invalid_number"
    | "negative_money"
    | "duplicate_key"
    | "missing_table_contract";
  message: string;
};

export type ImportValidationResult = {
  table: ImportTableKey;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  issues: ImportValidationIssue[];
};

function isBlank(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

function isDateLike(value: unknown) {
  if (isBlank(value)) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const text = String(value).trim();
  const normalized = text.includes(" ") ? text.replace(" ", "T") : text;
  return !Number.isNaN(Date.parse(normalized));
}

function isNumberLike(value: unknown) {
  if (isBlank(value)) return false;
  if (typeof value === "number") return Number.isFinite(value);
  const normalized = String(value).replaceAll(",", "").trim();
  return normalized !== "" && Number.isFinite(Number(normalized));
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  return Number(String(value).replaceAll(",", "").trim());
}

function valueForDedupe(row: ImportRow, dedupeKey: string) {
  return dedupeKey
    .split("+")
    .map((key) => String(row[key] ?? "").trim())
    .join("::");
}

function issue(
  table: ImportTableKey,
  rowNumber: number,
  code: ImportValidationIssue["code"],
  message: string,
  field?: string,
  severity: ImportValidationSeverity = "error",
): ImportValidationIssue {
  return { severity, table, rowNumber, field, code, message };
}

function validateField(table: ImportTableKey, rowNumber: number, field: ImportField, value: unknown) {
  const issues: ImportValidationIssue[] = [];

  if (field.required && isBlank(value)) {
    issues.push(issue(table, rowNumber, "missing_required_field", `${field.label}은(는) 필수값입니다.`, field.key));
    return issues;
  }

  if (isBlank(value)) return issues;

  if (field.type === "enum" && field.allowedValues && !field.allowedValues.includes(String(value).trim())) {
    issues.push(
      issue(
        table,
        rowNumber,
        "invalid_enum_value",
        `${field.label} 값 "${String(value)}"은(는) 허용 목록에 없습니다.`,
        field.key,
      ),
    );
  }

  if ((field.type === "date" || field.type === "datetime") && !isDateLike(value)) {
    issues.push(issue(table, rowNumber, "invalid_date", `${field.label}의 날짜 형식이 올바르지 않습니다.`, field.key));
  }

  if ((field.type === "number" || field.type === "money") && !isNumberLike(value)) {
    issues.push(issue(table, rowNumber, "invalid_number", `${field.label}은(는) 숫자여야 합니다.`, field.key));
  }

  if (field.type === "money" && isNumberLike(value) && toNumber(value) < 0) {
    issues.push(issue(table, rowNumber, "negative_money", `${field.label}은(는) 음수일 수 없습니다.`, field.key));
  }

  return issues;
}

export function validateImportRows(tableKey: ImportTableKey, rows: ImportRow[]): ImportValidationResult {
  const contract = getImportTable(tableKey);

  if (!contract) {
    const issues = [issue(tableKey, 0, "missing_table_contract", `${tableKey} 데이터 계약을 찾을 수 없습니다.`)];
    return { table: tableKey, totalRows: rows.length, validRows: 0, errorCount: issues.length, warningCount: 0, issues };
  }

  const issues: ImportValidationIssue[] = [];
  const seenKeys = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    contract.fields.forEach((field) => {
      issues.push(...validateField(tableKey, rowNumber, field, row[field.key]));
    });

    const dedupeValue = valueForDedupe(row, contract.dedupeKey);
    if (dedupeValue.replaceAll("::", "").trim() === "") return;

    const firstSeenRow = seenKeys.get(dedupeValue);
    if (firstSeenRow) {
      issues.push(
        issue(
          tableKey,
          rowNumber,
          "duplicate_key",
          `${contract.label} 중복 후보입니다. ${firstSeenRow}행과 같은 ${contract.dedupeKey} 값을 사용합니다.`,
          contract.dedupeKey,
          "warning",
        ),
      );
    } else {
      seenKeys.set(dedupeValue, rowNumber);
    }
  });

  const rowNumbersWithErrors = new Set(issues.filter((item) => item.severity === "error").map((item) => item.rowNumber));

  return {
    table: tableKey,
    totalRows: rows.length,
    validRows: rows.length - rowNumbersWithErrors.size,
    errorCount: issues.filter((item) => item.severity === "error").length,
    warningCount: issues.filter((item) => item.severity === "warning").length,
    issues,
  };
}
