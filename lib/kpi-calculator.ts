import type { ImportRow } from "./import-validator";

export type ImportedDashboardRows = {
  leads: ImportRow[];
  appointments: ImportRow[];
  visits: ImportRow[];
  payments: ImportRow[];
  adSpend: ImportRow[];
};

export type ImportedKpiSummary = {
  inquiry: number;
  phoneInquiry: number;
  onlineInquiry: number;
  reservation: number;
  phoneReservation: number;
  onlineReservation: number;
  visit: number;
  newVisit: number;
  bookedVisit: number;
  walkInVisit: number;
  walkInRate: number | null;
  noShow: number;
  noShowEligible: number;
  noShowRate: number | null;
  sales: number;
  adSpend: number;
  reservationRate: number | null;
  reservationVisitRate: number | null;
  inquiryVisitRate: number | null;
  cpl: number | null;
  cpv: number | null;
  roas: number | null;
};

export type DepartmentKpiSummary = {
  department: string;
  inquiries: number;
  phoneInquiries: number;
  onlineInquiries: number;
  reservations: number;
  phoneReservations: number;
  onlineReservations: number;
  reservationRate: number | null;
  newVisits: number;
  bookedVisits: number;
  walkInVisits: number;
  visits: number;
  sales: number;
};

export type ChannelKpiSummary = {
  channel: string;
  inquiries: number;
  phoneInquiries: number;
  onlineInquiries: number;
  reservations: number;
  phoneReservations: number;
  onlineReservations: number;
  visits: number;
  sales: number;
  adSpend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  conversionRate: number | null;
  conversionCost: number | null;
  cpl: number | null;
  cpv: number | null;
  roas: number | null;
};

export type ReferralKpiSummary = {
  source: string;
  newVisits: number;
  share: number | null;
};

export type ImportedKpiResult = {
  summary: ImportedKpiSummary;
  departments: DepartmentKpiSummary[];
  channels: ChannelKpiSummary[];
  referrals: ReferralKpiSummary[];
};

export type ImportedKpiOptions = {
  noShowAppointments?: ImportRow[];
  allVisits?: ImportRow[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(part: number, total: number) {
  if (total === 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function roundMoney(value: number) {
  return Math.round(value);
}

function uniqueCount(rows: ImportRow[], key: string, predicate: (row: ImportRow) => boolean = () => true) {
  const values = new Set<string>();
  rows.forEach((row) => {
    if (!predicate(row)) return;
    const id = text(row[key]);
    if (id) values.add(id);
  });
  return values.size;
}

function uniqueRows(rows: ImportRow[], key: string) {
  const values = new Map<string, ImportRow>();
  rows.forEach((row) => {
    const id = text(row[key]);
    if (id) values.set(id, row);
  });
  return [...values.values()];
}

function sumRows(rows: ImportRow[], key: string, predicate: (row: ImportRow) => boolean = () => true) {
  return rows.reduce((total, row) => (predicate(row) ? total + money(row[key]) : total), 0);
}

function isValidLead(row: ImportRow) {
  return text(row.status) !== "스팸";
}

function isPhoneLead(row: ImportRow) {
  return isValidLead(row) && text(row.inquiry_type) === "전화문의";
}

function isBooked(row: ImportRow) {
  return ["예약확정", "내원완료"].includes(text(row.status));
}

function isCompletedVisit(row: ImportRow) {
  return Boolean(text(row.visit_id));
}

function isNewVisit(row: ImportRow) {
  return isCompletedVisit(row) && text(row.visit_type) === "신환";
}

function resolveLeadChannel(row: ImportRow) {
  return text(row.source_channel) || "기타";
}

function resolveAdChannel(row: ImportRow) {
  return text(row.channel) || "기타";
}

function resolveVisitChannel(row: ImportRow) {
  return text(row.visit_source) || "기타";
}

function leadDepartmentById(leads: ImportRow[]) {
  return new Map<string, string>(leads
    .map((row): [string, string] => [text(row.lead_id), text(row.department)])
    .filter(([leadId]) => Boolean(leadId)));
}

function leadChannelById(leads: ImportRow[]) {
  return new Map<string, string>(leads
    .map((row): [string, string] => [text(row.lead_id), resolveLeadChannel(row)])
    .filter(([leadId]) => Boolean(leadId)));
}

function visitDepartmentById(visits: ImportRow[]) {
  return new Map<string, string>(visits
    .map((row): [string, string] => [text(row.visit_id), text(row.department)])
    .filter(([visitId]) => Boolean(visitId)));
}

function appointmentDepartment(row: ImportRow, leadDepartments: Map<string, string>) {
  return text(row.department) || leadDepartments.get(text(row.lead_id)) || "";
}

function paymentDepartment(row: ImportRow, visitDepartments: Map<string, string>) {
  return text(row.department) || visitDepartments.get(text(row.visit_id)) || "";
}

function resolvedDepartment(value: string) {
  return value || "미분류";
}

export function calculateImportedKpis(rows: ImportedDashboardRows, options: ImportedKpiOptions = {}): ImportedKpiResult {
  // A business entity may be present in more than one upload batch. Resolve it
  // once before dimensional aggregation so detail totals cannot exceed totals.
  const validLeads = uniqueRows(rows.leads.filter(isValidLead), "lead_id");
  const bookedAppointments = uniqueRows(rows.appointments.filter(isBooked), "appointment_id");
  const completedVisits = uniqueRows(rows.visits.filter(isCompletedVisit), "visit_id");
  const newVisits = rows.visits.filter(isNewVisit);
  const bookedAppointmentIds = new Set(bookedAppointments.map((row) => text(row.appointment_id)).filter(Boolean));
  const bookedVisitIds = new Set(completedVisits
    .filter((row) => bookedAppointmentIds.has(text(row.appointment_id)))
    .map((row) => text(row.visit_id))
    .filter(Boolean));
  const newVisitIds = new Set(newVisits.map((row) => text(row.visit_id)).filter(Boolean));
  const bookedVisit = [...bookedVisitIds].filter((visitId) => newVisitIds.has(visitId)).length;
  const walkInVisit = [...newVisitIds].filter((visitId) => !bookedVisitIds.has(visitId)).length;
  const noShowAppointments = uniqueRows((options.noShowAppointments ?? bookedAppointments).filter(isBooked), "appointment_id");
  const allCompletedVisits = uniqueRows((options.allVisits ?? completedVisits).filter(isCompletedVisit), "visit_id");
  const visitedAppointmentIds = new Set(allCompletedVisits.map((row) => text(row.appointment_id)).filter(Boolean));
  const noShowEligible = uniqueCount(noShowAppointments, "appointment_id");
  const noShow = noShowAppointments.filter((row) => !visitedAppointmentIds.has(text(row.appointment_id))).length;

  const inquiry = uniqueCount(validLeads, "lead_id");
  const reservation = uniqueCount(bookedAppointments, "appointment_id");
  const visit = uniqueCount(completedVisits, "visit_id");
  const newVisit = uniqueCount(newVisits, "visit_id");
  const sales = roundMoney(sumRows(rows.payments, "net_amount"));
  const adSpend = roundMoney(sumRows(rows.adSpend, "cost"));

  const summary: ImportedKpiSummary = {
    inquiry,
    phoneInquiry: uniqueCount(validLeads, "lead_id", isPhoneLead),
    onlineInquiry: Math.max(0, inquiry - uniqueCount(validLeads, "lead_id", isPhoneLead)),
    reservation,
    phoneReservation: uniqueCount(bookedAppointments, "appointment_id", (row) => {
      const lead = validLeads.find((item) => text(item.lead_id) === text(row.lead_id));
      return Boolean(lead && isPhoneLead(lead));
    }),
    onlineReservation: Math.max(0, reservation - uniqueCount(bookedAppointments, "appointment_id", (row) => {
      const lead = validLeads.find((item) => text(item.lead_id) === text(row.lead_id));
      return Boolean(lead && isPhoneLead(lead));
    })),
    visit,
    newVisit,
    bookedVisit,
    walkInVisit,
    walkInRate: percent(walkInVisit, newVisit),
    noShow,
    noShowEligible,
    noShowRate: percent(noShow, noShowEligible),
    sales,
    adSpend,
    reservationRate: percent(reservation, inquiry),
    reservationVisitRate: percent(bookedVisit, reservation),
    inquiryVisitRate: percent(newVisit, inquiry),
    cpl: inquiry === 0 ? null : roundMoney(adSpend / inquiry),
    cpv: newVisit === 0 ? null : roundMoney(adSpend / newVisit),
    roas: adSpend === 0 ? null : percent(sales, adSpend),
  };

  const leadDepartments = leadDepartmentById(rows.leads);
  const leadChannels = leadChannelById(rows.leads);
  const visitDepartments = visitDepartmentById(rows.visits);

  const departmentValues = [
    ...validLeads.map((row) => resolvedDepartment(text(row.department))),
    ...bookedAppointments.map((row) => resolvedDepartment(appointmentDepartment(row, leadDepartments))),
    ...completedVisits.map((row) => resolvedDepartment(text(row.department))),
    ...rows.payments.map((row) => resolvedDepartment(paymentDepartment(row, visitDepartments))),
  ];
  const departments = [...new Set(departmentValues)].map((department) => {
    const inquiries = uniqueCount(validLeads, "lead_id", (row) => resolvedDepartment(text(row.department)) === department);
    const phoneInquiries = uniqueCount(validLeads, "lead_id", (row) => resolvedDepartment(text(row.department)) === department && isPhoneLead(row));
    const onlineInquiries = Math.max(0, inquiries - phoneInquiries);
    const reservations = uniqueCount(bookedAppointments, "appointment_id", (row) => resolvedDepartment(appointmentDepartment(row, leadDepartments)) === department);
    const phoneReservations = uniqueCount(bookedAppointments, "appointment_id", (row) => {
      const lead = validLeads.find((item) => text(item.lead_id) === text(row.lead_id));
      return resolvedDepartment(appointmentDepartment(row, leadDepartments)) === department && Boolean(lead && isPhoneLead(lead));
    });
    const onlineReservations = Math.max(0, reservations - phoneReservations);
    const departmentVisits = completedVisits.filter((row) => resolvedDepartment(text(row.department)) === department);
    const visits = uniqueCount(departmentVisits, "visit_id");
    const newVisits = uniqueCount(departmentVisits, "visit_id", isNewVisit);
    const bookedVisits = uniqueCount(departmentVisits, "visit_id", (row) => isNewVisit(row) && bookedAppointmentIds.has(text(row.appointment_id)));
    const walkInVisits = Math.max(0, newVisits - bookedVisits);
    const sales = roundMoney(sumRows(rows.payments, "net_amount", (row) => resolvedDepartment(paymentDepartment(row, visitDepartments)) === department));

    return {
      department,
      inquiries,
      phoneInquiries,
      onlineInquiries,
      reservations,
      phoneReservations,
      onlineReservations,
      reservationRate: percent(reservations, inquiries),
      newVisits,
      bookedVisits,
      walkInVisits,
      visits,
      sales,
    };
  });

  const channels = [...new Set([
    ...validLeads.map(resolveLeadChannel),
    ...completedVisits.map(resolveVisitChannel),
    ...rows.adSpend.map(resolveAdChannel),
  ])]
    .map((channel) => {
      const inquiries = uniqueCount(validLeads, "lead_id", (row) => resolveLeadChannel(row) === channel);
      const phoneInquiries = uniqueCount(validLeads, "lead_id", (row) => resolveLeadChannel(row) === channel && isPhoneLead(row));
      const onlineInquiries = Math.max(0, inquiries - phoneInquiries);
      const reservations = uniqueCount(bookedAppointments, "appointment_id", (row) => leadChannels.get(text(row.lead_id)) === channel);
      const phoneReservations = uniqueCount(bookedAppointments, "appointment_id", (row) => {
        const lead = validLeads.find((item) => text(item.lead_id) === text(row.lead_id));
        return leadChannels.get(text(row.lead_id)) === channel && Boolean(lead && isPhoneLead(lead));
      });
      const onlineReservations = Math.max(0, reservations - phoneReservations);
      const channelVisits = completedVisits.filter((row) => resolveVisitChannel(row) === channel);
      const visits = uniqueCount(channelVisits, "visit_id");
      const adSpend = roundMoney(sumRows(rows.adSpend, "cost", (row) => resolveAdChannel(row) === channel));
      const impressions = roundMoney(sumRows(rows.adSpend, "impressions", (row) => resolveAdChannel(row) === channel));
      const clicks = roundMoney(sumRows(rows.adSpend, "clicks", (row) => resolveAdChannel(row) === channel));
      const importedConversions = roundMoney(sumRows(rows.adSpend, "conversions", (row) => resolveAdChannel(row) === channel));
      const conversions = importedConversions > 0 ? importedConversions : visits;
      const channelVisitIds = new Set(channelVisits.map((row) => text(row.visit_id)));
      const sales = roundMoney(sumRows(rows.payments, "net_amount", (row) => channelVisitIds.has(text(row.visit_id))));

      return {
        channel,
        inquiries,
        phoneInquiries,
        onlineInquiries,
        reservations,
        phoneReservations,
        onlineReservations,
        visits,
        sales,
        adSpend,
        impressions,
        clicks,
        conversions,
        ctr: percent(clicks, impressions),
        cpc: clicks === 0 ? null : roundMoney(adSpend / clicks),
        conversionRate: percent(conversions, clicks),
        conversionCost: conversions === 0 ? null : roundMoney(adSpend / conversions),
        cpl: inquiries === 0 ? null : roundMoney(adSpend / inquiries),
        cpv: visits === 0 ? null : roundMoney(adSpend / visits),
        roas: adSpend === 0 ? null : percent(sales, adSpend),
      };
    });

  const referrals = [...new Set(newVisits.map(resolveVisitChannel))].map((source) => {
    const count = uniqueCount(newVisits, "visit_id", (row) => resolveVisitChannel(row) === source);
    return { source, newVisits: count, share: percent(count, newVisit) };
  });

  return { summary, departments, channels, referrals };
}
