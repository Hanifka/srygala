export interface Credentials {
  username: string;
  password: string;
}

export interface Ticket {
  id: string;
  timestamp?: string;
  agent?: Record<string, any>;
  rule?: Record<string, any>;
  level?: number;
  status?: string;
  assigned?: string;
  note?: string;
  case_id?: string;
  case_title?: string;
  cases_no?: string;
  cases_description?: string;
}

export interface Case {
  id:               string;
  title:            string;
  severity:         "low" | "medium" | "high" | "critical";
  description:      string;
  notes:            string;
  created_by:       string;
  created_at:       string;
  assigned:         string;
  ticket_count:     number;
  linked_event_ids: string[];    // ← renamed from linked_ticket_ids, matches backend
  tickets?:         Ticket[];
  case_number?:     string;
  updated_at?:      string;
  status?:          string;
}

export interface CaseListResponse {
  total: number;
  cases: Case[];
}
