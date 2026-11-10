export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const PAGE_SIZE = 25;

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  department: string;
  job_title: string;
  is_active: boolean;
  roles: Role[];
  created_at: string;
}

export type ContractType = "permanent" | "fixed_term" | "part_time" | "contractor" | "intern";
export type ContractStatus = "draft" | "active" | "ended" | "terminated";

export interface Contract {
  id: number;
  user: number;
  user_email: string;
  contract_type: ContractType;
  status: ContractStatus;
  job_title: string;
  start_date: string;
  end_date: string | null;
  weekly_hours: string;
  annual_salary: string | null;
  currency: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export interface Timesheet {
  id: number;
  user: number;
  user_email: string;
  work_date: string;
  hours: string;
  project: string;
  client: string;
  description: string;
  status: TimesheetStatus;
  reviewer: number | null;
  // The backend leaves these out entirely when there is no reviewer.
  reviewer_email?: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LeaveType = "annual" | "sick" | "personal" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: number;
  user: number;
  user_email: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  reviewer: number | null;
  reviewer_email?: string;
  reviewer_comment: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTRACT_TYPES: Record<ContractType, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed term",
  part_time: "Part time",
  contractor: "Contractor",
  intern: "Internship",
};

export const CONTRACT_STATUSES: Record<ContractStatus, string> = {
  draft: "Draft",
  active: "Active",
  ended: "Ended",
  terminated: "Terminated",
};

export const TIMESHEET_STATUSES: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const LEAVE_TYPES: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  personal: "Personal leave",
  unpaid: "Unpaid leave",
  other: "Other",
};

export const LEAVE_STATUSES: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
