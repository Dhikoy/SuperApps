import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

const TOC = [
  ["karyawan", "Master Karyawan"],
  ["pt", "Perusahaan (PT)"],
  ["organisasi", "Struktur Organisasi"],
  ["jabatan", "Jabatan & Grade"],
  ["divisi", "Divisi"],
  ["rekrutmen", "Rekrutmen"],
  ["onboarding", "Onboarding"],
  ["kontrak", "Kontrak Kerja"],
  ["presensi", "Presensi"],
  ["shift", "Shift"],
  ["cuti", "Cuti"],
  ["ajukan-cuti", "Ajukan Cuti"],
  ["persetujuan", "Persetujuan Cuti"],
  ["laporan", "Laporan Presensi"],
  ["penalti", "Penalti"],
  ["koreksi", "Koreksi Absensi"],
  ["lembur", "Lembur"],
  ["perjalanan", "Perjalanan Dinas"],
  ["kpi", "KPI"],
  ["bpjs", "BPJS"],
  ["pph21", "PPh 21"],
  ["exit", "Exit"],
  ["pengaturan", "Pengaturan"],
] as const;

function Section({
  id,
  title,
  href,
  children,
}: {
  id: string;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
    <Card className="p-5 sm:p-6 space-y-3 text-sm text-slate-700 leading-relaxed">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <Link href={href} className="text-xs font-medium text-[#503200] hover:underline">
          Buka menu
        </Link>
      </div>
      {children}
    </Card>
    </section>
  );
}

export default function PanduanHrPage() {
  return (
    <div className="space-y-6 max-w-3xl p-8">
      <PageHeader
        title="Panduan Modul HR"
        subtitle="Tata cara untuk HRD. Ikuti urutan menu di Modul HR."
      />

      <Card className="p-5 sm:p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Daftar isi</p>
        <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-[#503200] hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Section id="karyawan" title="Master Karyawan" href="/dashboard/karyawan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Buka daftar karyawan. HRD bisa menambah, mengubah, dan menonaktifkan akun.</li>
          <li>Isi nama, User ID, NIK, role, perusahaan, dan jabatan.</li>
          <li>Lengkapi tanggal lahir, tanggal masuk, rekening, dan alamat dari profil karyawan.</li>
          <li>Centang absensi fleksibel hanya untuk karyawan yang tidak terikat jam shift.</li>
        </ol>
      </Section>

      <Section id="pt" title="Perusahaan (PT)" href="/dashboard/hr/pt">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Klik Tambah PT.</li>
          <li>Isi kode perusahaan (misalnya BCI) dan nama lengkapnya.</li>
          <li>Kode ini dipakai di karyawan, divisi, presensi, dan penalti.</li>
        </ol>
      </Section>

      <Section id="organisasi" title="Struktur Organisasi" href="/dashboard/hr/organisasi">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan.</li>
          <li>Pilih atasannya, atau kosongkan kalau dia paling atas.</li>
          <li>Simpan Atasan. Hierarki ini menentukan siapa yang menyetujui cuti tahap atasan.</li>
        </ol>
      </Section>

      <Section id="jabatan" title="Jabatan & Grade" href="/dashboard/hr/jabatan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Isi nama jabatan, grade (G1, G2, dan seterusnya), dan perusahaan.</li>
          <li>Gaji minimum dan maksimum boleh dikosongkan.</li>
          <li>Klik Tambah Jabatan.</li>
        </ol>
      </Section>

      <Section id="divisi" title="Divisi" href="/dashboard/hr/divisi">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Isi nama divisi dan pilih PT.</li>
          <li>Deskripsi boleh dikosongkan.</li>
          <li>Klik Tambah Divisi. Jumlah karyawan di divisi itu tampil di tabel.</li>
        </ol>
      </Section>

      <Section id="rekrutmen" title="Rekrutmen" href="/dashboard/hr/rekrutmen">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Isi posisi, PT, nama kandidat, email, dan telepon.</li>
          <li>Klik Tambah Kandidat.</li>
          <li>Ubah status di tabel: Open, Interview, Offer, Hired, Rejected, atau Closed.</li>
          <li>Saat status menjadi Hired, sistem bisa membuat akun karyawan baru.</li>
        </ol>
      </Section>

      <Section id="onboarding" title="Onboarding" href="/dashboard/hr/onboarding">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan baru.</li>
          <li>Tambah task orientasi satu per satu, misalnya serah terima laptop atau pengenalan tim.</li>
          <li>Centang task yang sudah selesai. Progress tampil dalam persen.</li>
        </ol>
      </Section>

      <Section id="kontrak" title="Kontrak Kerja" href="/dashboard/hr/kontrak">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan, tipe PKWT atau PKWTT, lalu tanggal mulai dan selesai.</li>
          <li>Klik Simpan Kontrak.</li>
          <li>Kontrak yang berakhir dalam 30 hari ditandai supaya bisa diperpanjang.</li>
        </ol>
      </Section>

      <Section id="presensi" title="Presensi" href="/dashboard/presensi">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih bulan untuk melihat absensi semua karyawan.</li>
          <li>Cek jam masuk, jam pulang, status, dan foto selfie.</li>
          <li>Karyawan clock in sendiri lewat menu Clock In atau bot Telegram.</li>
        </ol>
      </Section>

      <Section id="shift" title="Shift" href="/dashboard/jadwal">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Klik Tambah Shift.</li>
          <li>Isi nama shift, jam masuk standar, dan jam pulang standar.</li>
          <li>Simpan. Jam ini jadi patokan terlambat di presensi.</li>
        </ol>
      </Section>

      <Section id="cuti" title="Cuti" href="/dashboard/cuti">
        <p>Halaman ini daftar semua pengajuan. HRD melihat seluruh karyawan, bukan hanya cuti sendiri.</p>
        <p>
          Alur cuti tahunan, melahirkan, dan cuti penting: karyawan, lalu atasan, lalu HRD. Sakit dan izin terlambat
          langsung ke HRD.
        </p>
      </Section>

      <Section id="ajukan-cuti" title="Ajukan Cuti" href="/dashboard/cuti/ajukan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih jenis cuti, tanggal mulai, dan tanggal selesai.</li>
          <li>Isi keterangan. Lampiran dipakai kalau jenis cutinya mewajibkan dokumen.</li>
          <li>Kirim. Status awalnya menunggu persetujuan.</li>
        </ol>
      </Section>

      <Section id="persetujuan" title="Persetujuan Cuti" href="/dashboard/persetujuan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Buka antrian yang menunggu HRD.</li>
          <li>Baca jenis, tanggal, dan keterangan.</li>
          <li>Setujui atau tolak. Setelah HRD menyetujui, status cuti selesai dan presensi hari itu menjadi izin.</li>
        </ol>
      </Section>

      <Section id="laporan" title="Laporan Presensi" href="/dashboard/presensi/laporan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih bulan, tahun, dan karyawan kalau mau satu orang saja.</li>
          <li>Lihat ringkasan hadir, terlambat, izin, dan alpha.</li>
          <li>Export CSV atau PDF untuk arsip.</li>
        </ol>
      </Section>

      <Section id="penalti" title="Penalti" href="/dashboard/presensi/penalti">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Catat poin di{" "}
            <Link href="/dashboard/presensi/harian" className="font-medium text-[#503200] hover:underline">
              Rekap Harian
            </Link>
            , kolom Penalti. Klik + Penalti, isi poin 1–100 dan catatan. Satu hari boleh lebih dari satu entri.
          </li>
          <li>Buka menu Penalti untuk rekap bulan kalender. Klik baris karyawan untuk rincian per tanggal.</li>
          <li>Isi rate rupiah per poin. Sebelum diisi, potongan tertulis Belum ditentukan, bukan nol.</li>
          <li>Kunci periode setelah rate ada. Setelah terkunci, poin dan rate tidak bisa diubah.</li>
          <li>Buka kunci hanya Super Admin, dengan alasan.</li>
          <li>Payroll memotong hanya periode yang sudah dikunci. Export Excel ada di halaman Penalti.</li>
        </ol>
      </Section>

      <Section id="koreksi" title="Koreksi Absensi" href="/dashboard/hr/koreksi-absensi">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Filter Pending untuk permintaan dari web atau Telegram.</li>
          <li>Cocokkan tanggal, jam yang diminta, dan alasan.</li>
          <li>Setujui atau tolak. Jam absen berubah hanya setelah disetujui.</li>
        </ol>
      </Section>

      <Section id="lembur" title="Lembur" href="/dashboard/payroll/lembur">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Isi tanggal, total jam, jam mulai, jam selesai, dan detail pekerjaan.</li>
          <li>Ajukan. Hari kerja dihitung ×1,5. Hari libur nasional ×2.</li>
          <li>Di tabel riwayat, setujui atau tolak pengajuan yang masih pending.</li>
        </ol>
      </Section>

      <Section id="perjalanan" title="Perjalanan Dinas" href="/dashboard/hr/perjalanan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan, tujuan, tanggal, keperluan, dan budget.</li>
          <li>Klik Ajukan Perjalanan.</li>
          <li>Approve atau tolak pengajuan yang masih menunggu.</li>
        </ol>
      </Section>

      <Section id="kpi" title="Penilaian Kinerja (KPI)" href="/dashboard/hr/kpi">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan dan periode.</li>
          <li>Isi skor 0–100 dan catatan.</li>
          <li>Simpan Penilaian. Riwayat review tampil di bawah form.</li>
        </ol>
      </Section>

      <Section id="bpjs" title="BPJS" href="/dashboard/hr/bpjs">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan.</li>
          <li>Isi nomor BPJS Kesehatan dan BPJS Ketenagakerjaan.</li>
          <li>Klik Daftarkan BPJS. Menu ini masih pencatatan kepesertaan.</li>
        </ol>
      </Section>

      <Section id="pph21" title="PPh 21" href="/dashboard/hr/pph21">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan, isi NPWP, dan pilih status PTKP.</li>
          <li>Simpan Profil Pajak.</li>
          <li>Tabel menampilkan estimasi potongan. Ini profil pajak, bukan hitungan final pajak.</li>
        </ol>
      </Section>

      <Section id="exit" title="Exit Management" href="/dashboard/hr/exit">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Pilih karyawan, tanggal resign, dan alasan.</li>
          <li>Klik Ajukan Exit.</li>
          <li>Majukan status satu tahap: Pengajuan, Disetujui, Clearance, lalu Selesai.</li>
        </ol>
      </Section>

      <Section id="pengaturan" title="Pengaturan Presensi & Cuti" href="/dashboard/pengaturan">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Dari Dashboard HR, buka kartu Pengaturan Presensi & Cuti.</li>
          <li>Atur jenis cuti: nama, apakah perlu persetujuan atasan, dan urutannya.</li>
          <li>Atur lokasi kantor dan radius geofence untuk clock in.</li>
        </ol>
      </Section>
    </div>
  );
}
