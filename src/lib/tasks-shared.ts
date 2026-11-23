import type { TaskStatus } from "@/generated/prisma/enums";

/** Status yang bisa dipilih (kolom papan task). */
export const TASK_STATUSES: TaskStatus[] = ["BELUM_MULAI", "PROSES", "ON_REVIEW", "DONE"];

/** Termasuk ON_PROSES lama — tetap valid, tampil di kolom Proses. */
export const VALID_TASK_STATUSES: TaskStatus[] = [...TASK_STATUSES, "ON_PROSES"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BELUM_MULAI: "Belum mulai",
  PROSES: "Proses",
  ON_REVIEW: "Review",
  ON_PROSES: "Proses",
  DONE: "Selesai",
};

export const TASK_BOARD_COLUMNS: { status: TaskStatus; label: string; dot: string; includes: TaskStatus[] }[] = [
  { status: "BELUM_MULAI", label: "Belum mulai", dot: "bg-slate-400", includes: ["BELUM_MULAI"] },
  { status: "PROSES", label: "Proses", dot: "bg-amber-500", includes: ["PROSES", "ON_PROSES"] },
  { status: "ON_REVIEW", label: "Review", dot: "bg-indigo-500", includes: ["ON_REVIEW"] },
  { status: "DONE", label: "Selesai", dot: "bg-emerald-600", includes: ["DONE"] },
];

export type TaskProgressRow = {
  id: string;
  taskId: string;
  authorId: string;
  note: string;
  status: TaskStatus | null;
  createdAt: string;
  author: { nik: string; name: string };
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  company: string;
  status: TaskStatus;
  assigneeId: string | null;
  assignee: { nik: string; name: string; company: string } | null;
  createdAt: string;
  updatedAt: string;
  progressLogs?: TaskProgressRow[];
};

export type TaskFormData = {
  title: string;
  description: string;
  company: string;
  status: TaskStatus;
  assigneeId: string;
};

export const emptyTaskForm = (company = "BCI"): TaskFormData => ({
  title: "",
  description: "",
  company,
  status: "BELUM_MULAI",
  assigneeId: "",
});
