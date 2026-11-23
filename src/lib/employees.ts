import type { Role } from "@/lib/roles";

export type CompanyCode = "BCI" | "MKTECH" | "MNT" | "DPI" | "LBB" | "PIC";

export type EmployeeSeed = {
  name: string;
  company: CompanyCode;
  jobTitle: string;
  role: Role;
};

/** Daftar karyawan resmi per PT */
export const EMPLOYEES: EmployeeSeed[] = [
  // BCI
  { name: "Anandita Amanda", company: "BCI", jobTitle: "MANAGER HOLDING", role: "DIREKSI" },
  { name: "Silvia Federova Lumban Tobing", company: "BCI", jobTitle: "BUSINESS DEVELOPMENT", role: "STAFF" },
  { name: "Muhaemin", company: "BCI", jobTitle: "ADMIN KEUANGAN", role: "KEUANGAN" },
  { name: "Yeni Naviah ( Novi )", company: "BCI", jobTitle: "ADMIN HR", role: "HRD" },
  { name: "Raden Mas Muhammad Dava Aprilio Pratama", company: "BCI", jobTitle: "Design Grafis", role: "STAFF" },
  { name: "Dinda Rahmadany Putri", company: "BCI", jobTitle: "Staff", role: "STAFF" },
  { name: "Yogi Pratama", company: "BCI", jobTitle: "Office Boy", role: "STAFF" },
  {
    name: "Muhammad Alshaff Bimantara Sinau Sakke ( Babas )",
    company: "BCI",
    jobTitle: "Design Grafis",
    role: "STAFF",
  },
  { name: "Elsha Kalista Lallo", company: "BCI", jobTitle: "BUSINESS DEVELOPMENT", role: "STAFF" },
  { name: "Reyvika Purwayani Putrie", company: "BCI", jobTitle: "Admin Keuangan", role: "STAFF" },
  { name: "Achmad Fazrie", company: "BCI", jobTitle: "BUSINESS DEVELOPMENT", role: "STAFF" },
  { name: "Ervaldo Tri Sinaga", company: "BCI", jobTitle: "BUSINESS DEVELOPMENT", role: "STAFF" },
  { name: "Rio Fredericco", company: "BCI", jobTitle: "BUSINESS DEVELOPMENT", role: "STAFF" },

  // LBB
  { name: "Seprian Nugroho (Mas Rian)", company: "LBB", jobTitle: "MANAGER LBB", role: "LEAD" },
  { name: "Abdul Wahid", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Ramdani ( Adam )", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Tika Harwati", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Sri Wulan", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Nomores Lestisa ( Mores )", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Stieveen Hans ( Stieveen )", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Rizki Ramdhani (Mas Rizki)", company: "LBB", jobTitle: "Staff", role: "STAFF" },
  { name: "Muhamad Rijal Maulana", company: "LBB", jobTitle: "Staff", role: "STAFF" },

  // DPI
  { name: "Nur Hadiyanto", company: "DPI", jobTitle: "SENIOR HEAD OF ENGINEER", role: "STAFF" },
  { name: "Antonius Vendhy K.", company: "DPI", jobTitle: "HEAD OF BD", role: "STAFF" },
  { name: "Erwin Mirza", company: "DPI", jobTitle: "HEAD OF ENGINEER", role: "STAFF" },
  { name: "Indra Lesmana", company: "DPI", jobTitle: "OFFICE BOY", role: "STAFF" },

  // MKTECH
  { name: "Putu Hadi Purnama Jati (Mas Jati)", company: "MKTECH", jobTitle: "DIREKTUR MKTECH", role: "SUPER_ADMIN" },
  { name: "Andhika Sulistio Pratama", company: "MKTECH", jobTitle: "IT LEAD MKTECH", role: "SUPER_ADMIN" },

  // MNT
  { name: "Putri Faridatus (Mbak Putri)", company: "MNT", jobTitle: "Staff", role: "STAFF" },
  { name: "Leonydas Cannavaro", company: "MNT", jobTitle: "Staff", role: "STAFF" },

  // PIC (konsultan)
  { name: "Khaesar Baradian Marwoto", company: "PIC", jobTitle: "Staff Konsultan Internal", role: "STAFF" },
  { name: "Ahmad Fauzy", company: "PIC", jobTitle: "Staff Konsultan Eksternal", role: "STAFF" },
  { name: "Dimas Indra Prayasto", company: "PIC", jobTitle: "Staff Konsultan Eksternal", role: "STAFF" },
  { name: "Muhammad Hadi Rizaldin", company: "PIC", jobTitle: "Staff Konsultan Internal", role: "STAFF" },
];
