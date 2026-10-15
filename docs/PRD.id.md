---
title: PRD - Astra (Bahasa Indonesia)
type: prd
author: Project001
date: 2026-10-14
updated: 2026-10-15
status: Draft
priority: P0
tags:
  - prd
  - astra
  - desktop
  - visual-web-designer
  - local-first
  - electron
  - bahasa-indonesia
aliases:
  - PRD-Astra-ID
  - PRD-Astra-bahasa-indo
  - Astra
---

# PRD - Astra (Versi Bahasa Indonesia)

> [!abstract] Astra - Design visually. Own your code.
>
> Astra adalah aplikasi desktop *local-first* untuk mendesain web secara visual, khusus untuk
> Windows. Pengguna membuka proyek website lokal yang sebenarnya, mengeditnya lewat canvas
> langsung, inspector elemen, dan editor kode, lalu menyimpan perubahan langsung ke file
> HTML, CSS, dan JavaScript standar. Tidak ada akun, tidak ada cloud wajib, dan tidak ada
> format keluaran proprietary. Kode sumber tetap terbaca, portabel, dan ramah Git.

> [!warning] Status Dokumen - Implementasi Belum Dimulai
>
> Dokumen ini hanyalah **spesifikasi**. Belum ada logika aplikasi yang dibangun, diuji, atau
> dirilis. Repositori sumber (`D:\code-web\Astra`) paling banyak berisi scaffold proyek (build
> tooling dan dependency) dan tidak ada fitur yang diimplementasikan. Setiap requirement di bawah
> ini menjelaskan perilaku yang diinginkan, bukan fitur yang sudah jadi. Semua angka performa,
> estimasi usaha, dan target success metric bersifat **provisional** kecuali secara eksplisit
> ditandai sebagai hasil pengukuran.
>
> Tidak ditemukan gambar *"supplied Astra visual reference"* di workspace. Karena itu bagian
> UI/UX menentukan arah desain dalam bentuk prosa (Bagian 9). Jika gambar referensi diberikan
> nanti, dokumen ini harus direkonsiliasi dengannya, dan referensi tersebut harus diperlakukan
> sebagai niat desain, bukan bukti perilaku yang sudah diimplementasikan.

---

## Kontrol Dokumen

| Field | Nilai |
|---|---|
| Produk | Astra |
| Kategori | Desktop Visual Web Designer |
| Tagline | Design visually. Own your code. |
| Platform utama | Windows 10/11 (x64) |
| Platform sekunder (nanti) | macOS, Linux |
| Versi dokumen | 0.1 (Draft untuk review) |
| Status | Hanya spesifikasi - implementasi belum dimulai |
| Pemilik | Project001 |
| Reviewer | Product, Architecture, UX, Security, QA (belum ditentukan) |
| Dokumen terkait | `PRD-Visual-Web-Builder (Astra).md`, `PRD-Local-Visual-Web-Builder.md` (konsep terkait yang sudah ada; dokumen ini mendefinisikan produk saudara berbasis Electron) |

### Cara membaca ID requirement

| Prefix | Arti |
|---|---|
| `FR-###` | Functional requirement (kebutuhan fungsional) |
| `NFR-###` | Non-functional requirement (kebutuhan non-fungsional) |
| `SEC-###` | Requirement keamanan / privasi |
| `UX-###` | Requirement UI/UX |
| `TEST-###` | Test case |
| `RISK-###` | Risiko terdaftar |
| `OQ-###` | Open question (pertanyaan terbuka) |
| `ASM-###` | Asumsi |
| `AC-###` | Kriteria penerimaan MVP |
| `DoD-###` | Item definition of done |

Skala prioritas: **P0** = wajib untuk MVP; **P1** = wajib sebelum rilis umum, boleh dirilis setelah MVP; **P2** = diinginkan, pasca-GA.

---

## 1. Ringkasan Eksekutif

Astra adalah aplikasi desktop Windows yang memungkinkan seseorang mendesain website secara
visual sambil mengedit **kode sumber asli** website tersebut. Astra mengisi celah yang saat ini
masih terbuka:

- Code editor (VS Code, Sublime, JetBrains) memang kuat dan menghasilkan kode nyata, tapi hampir
  tidak punya manipulasi HTML dan CSS secara visual.
- Visual "no-code" website builder menawarkan desain drag-and-drop, tapi sering menyimpan proyek
  dalam format proprietary, bergantung pada akun dan layanan cloud, serta menyembunyikan source
  atau menghasilkan markup yang sulit dipelihara manusia.
- Design tool (Figma dan sejenisnya) menghasilkan desain yang terputus dari kode produksi;
  developer mengimplementasikannya ulang secara manual.

Tesis Astra adalah bahwa **editing visual harus beroperasi langsung pada teknologi web standar
dan harus menghasilkan kode sumber yang portabel dan mudah dipelihara**. Canvas merender website
asli. Perubahan yang dibuat secara visual diterjemahkan menjadi perubahan teks yang minimal dan
*surgical* pada file HTML/CSS/JS. Perubahan yang dibuat di editor kode tercermin kembali ke
canvas. Proyek di disk tetap berupa website normal: bisa dibuka di browser apa pun dan code
editor apa pun tanpa Astra.

Produk ini *local-first* secara desain: tanpa akun, tanpa telemetri secara default, dan semua
fitur inti bekerja offline. Preview website di-*sandbox* sehingga kode proyek yang tidak
dipercaya tidak bisa menjangkau API desktop yang istimewa atau filesystem.

Astra diimplementasikan sebagai aplikasi desktop **Electron**: main process Node.js yang
menghosting layanan proyek yang terkendali, renderer React + TypeScript untuk UI, dan
`contextBridge` yang sempit di antara keduanya. Electron adalah pilihan implementasi, bukan
pembeda produk Astra (Bagian 10; ADR-001 di Bagian 10.7).

Risiko rekayasa utamanya adalah **sinkronisasi**: menjaga model dokumen visual dan file sumber
nyata tetap konsisten tanpa merusak formatting, komentar, atau sintaks yang tidak didukung, dan
tanpa terjebak infinite update loop atau konflik dengan perubahan eksternal. Bagian 7G, 11, dan 13
memperlakukannya sebagai hal utama yang harus diprototipekan dan dibuktikan sebelum berinvestasi
pada keluasan UI.

PRD ini mendefinisikan visi, persona, requirement dengan acceptance criteria yang testable,
arsitektur modular, MVP, roadmap bertahap, model keamanan, strategi testing, success metric,
risiko, dan pertanyaan terbuka. Semuanya adalah materi perencanaan; tidak ada yang sudah
diimplementasikan.

---

## 2. Visi Produk

**Visi.** Siapa pun harus bisa membuka website yang sudah ada, memahaminya secara visual,
memperbaikinya secara visual, dan meninggalkan kode yang setidaknya sama bersihnya - tanpa
menyerahkan kepemilikan atas file, data, atau alur kerja mereka.

**Positioning statement.** Untuk developer dan designer web yang menginginkan kecepatan editing
visual tanpa kehilangan kendali atas kode sumber, Astra adalah designer web desktop *local-first*
yang mengedit HTML, CSS, dan JavaScript asli langsung di tempatnya. Berbeda dari no-code builder,
Astra menghasilkan kode standar, portabel, dan ramah Git dengan tanpa runtime proprietary dan
tanpa layanan cloud wajib.

**Prinsip panduan.**

1. **Sovereignty (Kedaulatan)** - file dan mesin pengguna adalah sumber kebenaran. Tanpa akun,
   tanpa cloud, tanpa telemetri secara default, fitur inti bisa offline.
2. **Composability (Komposabilitas)** - arsitektur modular, komponen yang dapat digunakan ulang,
   teknologi web standar, dan dependency yang minimal serta bisa diganti.
3. **Security (Keamanan)** - proyek yang diimpor diperlakukan sebagai tidak terpercaya; preview
   diisolasi dari privilege desktop; akses filesystem mengikuti least privilege; tidak ada
   perubahan destruktif yang senyap.
4. **Code Ownership (Kepemilikan Kode)** - keluaran terbaca dan bisa diedit; tidak ada format
   proprietary; struktur yang ada dan sintaks yang tidak didukung dipertahankan; perubahan
   menghasilkan Git diff yang bisa dipahami.

**Interaksi bintang utara.** Buka proyek nyata, klik elemen, ubah, simpan, dan lihat perubahan
muncul sebagai diff kecil yang masuk akal di file nyata - lalu buka file itu di browser apa pun
dan lihat hasilnya bekerja.

---

## 3. Problem Statement (Pernyataan Masalah)

Astra menargetkan celah spesifik antara tooling desain visual dan kepemilikan kode. Berikut
dinyatakan sebagai **hipotesis yang harus divalidasi** (lihat Bagian 18, `OQ-001`..`OQ-004`),
bukan sebagai fakta yang sudah terbukti. Status bukti dibuat eksplisit.

### 3.1 Masalah utama (hipotesis, sebagian didukung pola tooling sejenis)

> Mengedit website HTML/CSS yang **sudah ada** secara visual - sambil mempertahankan struktur
> kode sumber aslinya - kurang didukung. Tooling yang ada bisa mengedit secara visual tetapi
> menyembunyikan/mengabstraksi kode, atau mengedit kode tetapi tidak memberi pengguna kemampuan
> memanipulasi halaman secara visual.

Observasi pendukung (harus divalidasi lewat riset pengguna, belum dilakukan):

- Visual builder umumnya mengharuskan proyek ditulis *di dalam* tool dan disimpan dalam format
  milik tool tersebut (`OQ-001`).
- Design tool mengekspor artefak statis atau kode spesifik framework, bukan mengedit situs
  yang ditulis tangan yang sudah ada (`OQ-002`).
- Proyek website di disk "hanyalah file"; sebagian besar tooling visual tidak memperlakukan
  file-file itu sebagai kebenaran yang bisa diedit (`OQ-003`).

### 3.2 Masalah sekunder (belum divalidasi)

- **Design/code drift.** Keputusan desain dan codebase menyimpang karena tidak ada satu artefak
  yang bisa diedit keduanya (`OQ-002`).
- **Friksi prototyping.** Developer menulis ulang markup untuk eksperimen visual kecil karena
  tidak ada loop visual cepat atas file nyata (`OQ-004`).
- **Lock-in dan ketergantungan infrastruktur.** Beberapa desktop builder memerlukan login,
  penyimpanan cloud, atau infrastruktur hosting untuk perilaku inti (`OQ-001`).
- **Biaya pemahaman.** Pelajar visual kesulitan memetakan HTML/CSS ke hasil render secara mental;
  canvas yang live dan bisa diinspeksi mengurangi biaya itu (`OQ-004`).

### 3.3 Masalah yang secara eksplisit DI LUAR cakupan

- Membangun code editor atau IDE general-purpose sebagai pengganti.
- Hosting, publishing, atau deployment website.
- Editing multi-pengguna real-time atau kolaborasi tim.
- Menggantikan Figma untuk desain statis high-fidelity dan handoff desain.
- Mengedit aplikasi dinamis arbitrer (runtime SPA, framework server-rendered) dengan fidelitas
  visual penuh.
- Mengelola CMS, database, atau backend untuk situs pengguna.

### 3.4 Ringkasan asumsi vs temuan tervalidasi

| Klaim | Status | Cara validasi |
|---|---|---|
| Editing visual situs yang sudah ada kurang dilayani | Asumsi | 10-15 wawancara pengguna; teardown kompetitor |
| Pengguna cukup menghargai kepemilikan source untuk pindah tool | Asumsi | Studi willingness-to-use; retensi setelah MVP |
| Surgical source patching mempertahankan formatting dengan cukup baik | Hipotesis rekayasa yang belum terbukti | Prototipe Phase 0 (lihat Bagian 13) |
| Local-first/offline adalah pembeda untuk segmen ini | Asumsi | Wawancara persona; survei tanpa telemetri |

---

## 4. Target Pengguna dan Persona

Astra menargetkan pengguna yang secara teknis ingin tahu dan peduli pada kepemilikan kode.
Persona adalah **hipotesis** untuk memprioritaskan requirement; belum divalidasi lewat riset.

### 4.1 Persona A - Rina, "The Visual Learner" (developer web pemula)

| Dimensi | Detail |
|---|---|
| Peran | Junior dev yang pindah karier / siswa bootcamp |
| Skill teknis | Rendah-sedang (memahami tag HTML, sedang belajar CSS) |
| Tujuan | Membangun situs pribadi; memahami bagaimana CSS menghasilkan hasil visual; menghindari merusak sesuatu |
| Masalah utama | Konsep CSS (box model, flex/grid, specificity) sulit diintuisikan dari teks; takut kesalahan yang tidak bisa dibatalkan |
| Alur kerja sekarang | VS Code + browser, reload terus-menerus, copy-paste tutorial |
| Manfaat yang diharapkan | Melihat sebab-akibat seketika; eksperimen aman dengan undo; belajar dengan menginspeksi kode nyata |
| Alasan memilih Astra dibanding alternatif | Umpan balik visual atas file **miliknya sendiri**; tanpa akun; masih bisa membuka kode di VS Code |
| Requirement kunci | FR-B, FR-C, FR-E, FR-F, FR-I (undo) |

### 4.2 Persona B - Bagas, "The Speed Pro" (developer / freelancer)

| Dimensi | Detail |
|---|---|
| Peran | Front-end developer freelancer |
| Skill teknis | Tinggi |
| Tujuan | Prototipe halaman marketing dan ubah situs klien dengan cepat; menjaga Git diff tetap bersih |
| Masalah utama | Mengedit markup repetitif secara manual lambat; ingin eksperimen layout visual tanpa menulis ulang |
| Alur kerja sekarang | VS Code, browser devtools, sesekali no-code builder yang ia tidak percaya untuk pekerjaan klien |
| Manfaat yang diharapkan | Iterasi visual cepat atas file nyata; diff tetap bisa direview; tanpa langkah export/rebuild |
| Alasan memilih Astra dibanding alternatif | Mengedit file nyata di tempat; keluaran portabel; tanpa framework lock-in; offline di lokasi klien |
| Requirement kunci | FR-D, FR-E, FR-G, FR-H, FR-J |

### 4.3 Persona C - Sinta, "The Ownership Designer" (designer yang merilis kode)

| Dimensi | Detail |
|---|---|
| Peran | Product/UI designer yang menulis HTML/CSS |
| Skill teknis | Sedang (HTML semantik, CSS modern, design tokens) |
| Tujuan | Mengendalikan markup dan CSS persis yang dirilis; menjaga konsistensi design system |
| Masalah utama | Tool handoff mengeluarkan kode yang harus ia tulis ulang; tool visual melawan struktur yang sudah ada |
| Alur kerja sekarang | Figma -> HTML/CSS ditulis tangan, kadang Tailwind |
| Manfaat yang diharapkan | Mendesain langsung di kode produksi; menggunakan ulang token/komponen; bantuan aksesibilitas yang bersifat saran |
| Alasan memilih Astra dibanding alternatif | Kepemilikan kode + editing visual sekaligus; penyimpanan komponen/token yang portabel |
| Requirement kunci | FR-E, FR-I, FR-H, FR-J (aksesibilitas sebagai saran) |

### 4.4 Persona D - Andre, "The Privacy-Conscious Localist"

| Dimensi | Detail |
|---|---|
| Peran | Senior engineer / konsultan di konteks sensitif keamanan |
| Skill teknis | Sangat tinggi |
| Tujuan | Bekerja sepenuhnya offline; tanpa telemetri; tanpa akun; mengaudit apa yang bisa diakses aplikasi |
| Masalah utama | Curiga pada cloud builder; ingin akses filesystem least-privilege; butuh isolasi preview |
| Alur kerja sekarang | Editor lokal + browser; memeriksa dependency |
| Manfaat yang diharapkan | Operasi offline yang bisa diverifikasi; permission filesystem terbatas; preview ter-sandbox |
| Alasan memilih Astra dibanding alternatif | Local-first, tanpa telemetri secara default, isolasi preview, set dependency yang bisa diaudit |
| Requirement kunci | FR-K, SEC-*, NFR offline, preview sandbox |

### 4.5 Persona E (sekunder) - "The Inheritor" (pemelihara situs legacy)

| Dimensi | Detail |
|---|---|
| Peran | Developer yang diminta memperbarui situs lama hasil tulis tangan/ekspor WordPress |
| Skill teknis | Sedang-tinggi |
| Tujuan | Memahami codebase HTML/CSS yang tidak dikenal dan berantakan, lalu melakukan perubahan visual yang terarah |
| Masalah utama | Takut merusak markup yang tidak dikenal; CSS yang berantakan |
| Alur kerja sekarang | Devtools + edit manual hati-hati |
| Manfaat yang diharapkan | Peta visual halaman; edit surgical; mempertahankan sintaks legacy/yang tidak didukung |
| Alasan memilih Astra dibanding alternatif | Membaca HTML/CSS yang ada tanpa menuntut penulisan ulang; mempertahankan apa yang tidak dipahaminya |
| Requirement kunci | FR-B, FR-C, FR-G (preservasi), FR-J |

### 4.6 Prioritas persona

Untuk MVP, optimalkan untuk **Persona B (developer/freelancer)** dan **Persona E (inheritor)**,
karena keduanya menguji pembeda paling keras (mengedit proyek *nyata* yang sudah ada). Persona A
menyempurnakan onboarding dan keamanan undo; Persona C menyempurnakan pekerjaan komponen/token
nanti; Persona D membatasi model keamanan sejak hari pertama.

---

## 5. Goals dan Non-Goals

### 5.1 Goals produk (keseluruhan)

| ID | Goal |
|---|---|
| G-01 | Membuka folder proyek website lokal yang ada dan menampilkannya dengan setia. |
| G-02 | Merender website asli di canvas visual yang live. |
| G-03 | Memilih dan menginspeksi elemen HTML apa pun yang dirender. |
| G-04 | Menyisipkan dan menata ulang elemen lewat drag-and-drop. |
| G-05 | Mengedit properti CSS umum secara visual. |
| G-06 | Menyinkronkan perubahan visual yang didukung ke kode sumber. |
| G-07 | Menyinkronkan perubahan editor sumber yang didukung kembali ke canvas. |
| G-08 | Menyimpan perubahan ke file proyek nyata dengan aman dan atomik. |
| G-09 | Preview layout desktop, tablet, dan mobile. |
| G-10 | Beroperasi tanpa layanan cloud, akun, atau koneksi jaringan wajib. |

### 5.2 Non-goals untuk MVP, beserta alasan

| Non-goal | Alasan dikeluarkan dari MVP |
|---|---|
| Sinkronisasi cloud | Menambah akun, server, kompleksitas konflik/merge, dan permukaan kepercayaan; melanggar default local-first. Validasi permintaan dulu. |
| Akun pengguna | Tidak perlu untuk tool lokal satu pengguna; menambah autentikasi, penyimpanan, dan tanggung jawab privasi. |
| Kolaborasi real-time | Memerlukan backend dan model CRDT/OT; ortogonal terhadap risiko inti sinkronisasi-dengan-file yang harus diselesaikan dulu. |
| Publishing website terhosting | Deployment adalah urusan produk terpisah (FTP, Git, CDN); Astra mengedit kode, bukan menghosting. |
| Pengganti Figma | Astra menyasar kode produksi, bukan tooling desain statis high-fidelity; bersaing dengan Figma di luar cakupan. |
| Dukungan penuh untuk semua framework JS | Semantik spesifik framework (JSX, SFC, DSL template) melipatgandakan kompleksitas sinkronisasi; mulai dari teknologi web biasa. |
| Runtime rendering proprietary | Bertentangan dengan kepemilikan kode dan portabilitas; keluaran harus berjalan di browser biasa. |
| Fitur AI wajib | AI memperkenalkan non-determinisme, biaya, pertanyaan privasi, dan beban review; jaga agar opsional dan aditif. |
| Editing visual penuh aplikasi dinamis arbitrer | DOM yang dihasilkan saat runtime tidak dapat di-*round-trip* ke source secara andal; mengeditnya berisiko merusak logika aplikasi. |

---

## 6. User Story dan User Journey

### 6.1 User journey

**Journey 1 - Pertama kali membuka proyek yang sudah ada (Persona B/E).**

```text
Luncurkan Astra
  -> Welcome / belum ada proyek terbuka (empty state: "Buka folder untuk memulai")
  -> "Open Project" -> folder picker native
  -> Astra memindai folder, mendeteksi HTML entri (index.html), menautkan CSS/JS
  -> Canvas merender situs
  -> File muncul di Project Explorer
  -> Pengguna mengklik elemen, inspector menampilkan HTML + style-nya
```

**Journey 2 - Edit visual menjadi kode (Persona A/B).**

```text
Pilih elemen
  -> Edit teks / ubah nilai CSS di Inspector
  -> Model dokumen internal diperbarui (preview sementara)
  -> Sync engine menghitung patch source minimal
  -> Tab editor sumber menampilkan source terbaru (diff tersorot)
  -> Save (Ctrl+S) atau debounce autosave
  -> Penulisan atomik ke disk
  -> Indikator "Saved"; working tree Git menunjukkan diff kecil
```

**Journey 3 - Edit kode menjadi canvas (Persona B).**

```text
Buka styles.css di tab Code Editor
  -> Ketik rule baru
  -> Debounce parse -> model diperbarui
  -> Canvas merender ulang subtree yang terdampak
  -> Pengguna melihat perubahan tanpa keluar dari Astra
```

**Journey 4 - Perubahan eksternal saat Astra terbuka (Persona B/D).**

```text
Pengguna mengedit index.html di VS Code dan menyimpan
  -> File watcher mendeteksi perubahan (mtime + hash berbeda)
  -> Jika Astra tidak punya perubahan belum tersimpan untuk file itu: reload senyap, catat aktivitas
  -> Jika Astra punya perubahan belum tersimpan: prompt konflik (Keep mine / Take theirs / Compare)
  -> Tidak ada file yang ditimpa tanpa keputusan eksplisit
```

**Journey 5 - Penyesuaian responsive (Persona C).**

```text
Ganti preset viewport ke Mobile
  -> Canvas berubah ukuran ke frame mobile; breakpoint aktif ditandai
  -> Edit properti saat Mobile aktif
  -> Perubahan ditulis ke media query yang cocok (yang sudah ada atau baru)
  -> Save
```

**Journey 6 - Proyek berantakan warisan (Persona E).**

```text
Buka folder legacy
  -> Astra memparse HTML meski malformed (best-effort, non-destruktif)
  -> Elemen yang tidak didukung tetap ditampilkan tetapi ditandai "tidak sepenuhnya dapat diedit"
  -> Pengguna melakukan perubahan teks/style terarah
  -> Hanya rentang yang disentuh yang berubah di disk; sisanya byte-identik
```

### 6.2 User story (pilihan; cakupan penuh di Bagian 7)

Format: `Sebagai <persona>, saya ingin <kemampuan>, supaya <manfaat>.`

| ID | Story |
|---|---|
| US-001 | Sebagai developer, saya ingin membuka folder proyek yang ada, supaya saya bisa bekerja pada kode nyata saya. |
| US-002 | Sebagai developer, saya ingin melihat situs saya ter-render, supaya saya bisa menilai hasilnya tanpa berpindah aplikasi. |
| US-003 | Sebagai developer, saya ingin mengklik elemen dan melihat HTML serta CSS-nya, supaya saya bisa memahami dan mengubahnya. |
| US-004 | Sebagai developer, saya ingin men-drag komponen ke dalam halaman, supaya saya bisa membangun layout dengan cepat. |
| US-005 | Sebagai pemula, saya ingin undo/redo untuk edit visual, supaya saya bisa bereksperimen dengan aman. |
| US-006 | Sebagai developer, saya ingin perubahan saya tersimpan ke file nyata, supaya Git diff tetap bermakna. |
| US-007 | Sebagai pengguna yang peduli privasi, saya ingin aplikasi bekerja offline tanpa akun, supaya pekerjaan saya tetap privat. |
| US-008 | Sebagai designer, saya ingin pratinjau mobile/tablet/desktop, supaya saya bisa mengambil keputusan responsive secara visual. |
| US-009 | Sebagai pemelihara, saya ingin markup yang tidak didukung/legacy dipertahankan, supaya Astra tidak pernah merusak kode yang tidak dipahaminya secara senyap. |
| US-010 | Sebagai designer, saya ingin komponen dan token yang dapat digunakan ulang, supaya desain saya tetap konsisten. |
| US-011 | Sebagai pengguna mana pun, saya ingin peringatan aksesibilitas, supaya saya bisa memperbaiki masalah dasar tanpa otomatisasi menulis ulang kode saya. |

---

## 7. Functional Requirements

Format per requirement: **ID - prioritas** - deskripsi; **Story**; **Acceptance criteria**;
**Dependencies**; **Known limitations** (batasan yang diketahui).

### A. Aplikasi Desktop

#### FR-A01 - Jendela aplikasi native (P0)
Astra berjalan sebagai jendela desktop Windows native yang dihosting oleh Electron, bukan tab browser.
- **Story:** Sebagai pengguna, saya ingin aplikasi desktop nyata, supaya terintegrasi dengan OS saya.
- **Acceptance:** Diberikan aplikasi terpasang, ketika diluncurkan, maka muncul satu jendela aplikasi
  dengan title bar native, bisa di-resize dengan lancar, dan punya kontrol min/max/close OS; tidak ada
  chrome browser.
- **Dependencies:** Shell Electron (Bagian 10), pipeline build.
- **Limitations:** Windows-first; macOS/Linux nanti.

#### FR-A02 - Menu aplikasi dan kontrol jendela (P0)
Menu native/aplikasi yang mengekspos aksi File, Edit, View, dan Help.
- **Story:** Sebagai pengguna, saya ingin akses menu ke aksi inti.
- **Acceptance:** Diberikan aplikasi terfokus, ketika saya membuka menu, maka File berisi
  New/Open/Close/Save/Save All/Settings/Exit; Edit berisi Undo/Redo/Find; View berisi preset
  viewport, zoom, dan toggle panel; setiap item memicu aksi terkait atau dinonaktifkan saat
  tidak tersedia.
- **Dependencies:** FR-A01, command bus.
- **Limitations:** Tata letak menu mungkin berbeda di non-Windows nanti.

#### FR-A03 - Buka dan tutup proyek (P0)
Membuka proyek dengan memilih folder lokal; menutup proyek saat ini.
- **Story:** Sebagai pengguna, saya ingin membuka dan menutup proyek dengan bersih.
- **Acceptance:** Diberikan layar welcome, ketika saya memilih "Open Project" dan memilih folder yang
  berisi setidaknya satu file `.html`, maka proyek dimuat, nama folder menjadi judul proyek, dan
  explorer menampilkan file-file di dalamnya. Diberikan proyek terbuka, ketika saya memilih "Close
  Project", maka saya kembali ke layar welcome dan tidak ada file handle yang tersisa terbuka.
- **Dependencies:** Filesystem adapter, project manager.
- **Limitations:** Satu proyek terbuka dalam satu waktu di MVP (lihat `OQ-007`).

#### FR-A04 - Peringatan perubahan belum tersimpan (P0)
Memberi peringatan sebelum membuang perubahan yang belum disimpan.
- **Story:** Sebagai pengguna, saya ingin dilindungi dari kehilangan data tak sengaja.
- **Acceptance:** Diberikan dokumen yang "kotor", ketika saya menutup proyek, menutup jendela, atau
  membuka proyek lain, maka muncul modal yang menawarkan Save / Discard / Cancel; memilih Cancel
  membatalkan aksi; memilih Discard tidak menulis; memilih Save menulis secara atomik sebelum lanjut.
- **Dependencies:** FR-G (pelacakan dirty), FR-A03.
- **Limitations:** Jika aplikasi dimatikan paksa, autosave/recovery (FR-A04b) adalah satu-satunya pelindung.

#### FR-A04b - Pemulihan setelah crash (P1)
Memulihkan pekerjaan yang belum tersimpan setelah keluar abnormal.
- **Acceptance:** Diberikan sesi dengan perubahan belum tersimpan dan jurnal penulisan tertunda,
  ketika aplikasi dimulai setelah crash, maka Astra menawarkan memulihkan perubahan tertunda dari
  `.astra/recovery/`; pemulihan tidak pernah menimpa file di disk yang lebih baru tanpa konfirmasi.
- **Dependencies:** Journal, backup.
- **Limitations:** Pemulihan bersifat best-effort dan dibatasi jendela debounce.

#### FR-A05 - Pengaturan aplikasi (P1)
Menyimpan preferensi pengguna.
- **Story:** Sebagai pengguna, saya ingin mengonfigurasi Astra sesuai kebutuhan saya.
- **Acceptance:** Diberikan panel Settings, ketika saya mengubah pengaturan (tema, ukuran font,
  interval autosave, toggle telemetri - default mati, kebijakan formatting, kebijakan sumber daya
  eksternal), maka pengaturan bertahan setelah restart dan berlaku langsung jika relevan.
- **Dependencies:** Local config store (tanpa database).
- **Limitations:** Pengaturan bersifat per-pengguna, bukan per-proyek (config per-proyek adalah P2).

#### FR-A06 - Installer dan build Windows terkemas (P0)
Merilis paket Windows yang bisa diinstal, di-sign atau jelas-jelas unsigned.
- **Story:** Sebagai pengguna, saya ingin menginstal Astra tanpa toolchain.
- **Acceptance:** Diberikan build release, ketika saya menjalankan installer di mesin Windows 10/11
  bersih, maka Astra terpasang, bisa diluncurkan offline, dan bisa membuka proyek tanpa ada dev tool.
- **Dependencies:** Packaging Electron (Electron Forge atau electron-builder; NSIS/Squirrel), CI build.
- **Limitations:** Code signing memerlukan sertifikat (`OQ-011`); build unsigned mungkin memicu
  peringatan SmartScreen.

### B. Project Explorer

#### FR-B01 - Buka folder proyek lokal yang ada (P0)
Lihat FR-A03. Explorer berakar pada folder yang dipilih dan tidak pernah menavigasi ke atasnya.

#### FR-B02 - Menampilkan direktori dan file (P0)
- **Acceptance:** Diberikan proyek terbuka, ketika explorer dirender, maka menampilkan pohon direktori
  (tanpa folder yang diabaikan sesuai FR-B07) dengan folder yang bisa diperluas/diringkas; memilih file
  menampilkan ikon tipe dan membukanya sesuai FR-B04.
- **Dependencies:** Filesystem adapter.
- **Limitations:** Pohon yang sangat besar dimuat lazily per direktori (performa, NFR).

#### FR-B03 - Dukungan HTML, CSS, JS, dan aset web umum (P0)
- **Acceptance:** Diberikan proyek, ketika explorer menampilkan file, maka `.html/.htm`, `.css`,
  `.js/.mjs/.cjs`, gambar (`.png/.jpg/.jpeg/.gif/.svg/.webp/.avif`), font, dan `.json` dikenali dengan
  ikon yang sesuai; file tak dikenal tetap terdaftar tetapi hanya bisa dipratinjau sebagai teks atau
  tidak dibuka.
- **Dependencies:** FR-B02.
- **Limitations:** Sumber preprocessor (`.scss`, `.ts`, `.jsx`) terdaftar tetapi diperlakukan sebagai
  teks biasa dengan catatan "tidak dapat diedit secara visual" di MVP (`OQ-005`).

#### FR-B04 - Membuka file di code editor (P0)
- **Acceptance:** Diberikan explorer, ketika saya mengklik file teks yang bisa diedit, maka file terbuka
  di tab Code Editor bawah dalam 300 ms untuk file <= 1 MB, dengan syntax highlighting sesuai FR-F.
- **Dependencies:** Code editor (Monaco).
- **Limitations:** File biner tidak dibuka sebagai teks.

#### FR-B05 - Mendeteksi file yang dimodifikasi eksternal (P0)
- **Acceptance:** Diberikan file terbuka yang juga diubah di disk oleh program lain, ketika watcher
  aktif, maka Astra membandingkan hash konten dengan hash terakhir yang diketahui; jika dokumen bersih
  ia reload (dengan toast halus), dan jika kotor ia memunculkan konflik sesuai FR-G-Conflict tanpa
  menulis apa pun secara otomatis.
- **Dependencies:** File watcher (Node `fs.watch` di main process), hashing.
- **Limitations:** Event watcher bergantung OS dan bisa bergabung; Astra melakukan debounce dan
  fallback ke pengecekan hash.

#### FR-B06 - Menangani file hilang atau tidak dapat diakses dengan aman (P0)
- **Acceptance:** Diberikan file yang dihapus atau dibuat tidak terbaca saat terbuka, ketika Astra
  mengaksesnya berikutnya, maka tidak crash; menandai dokumen sebagai "hilang/tidak dapat diakses",
  mempertahankan konten di memori, dan menawarkan Save-As / Retry / Close tanpa kehilangan data.
- **Dependencies:** Pemetaan error filesystem adapter.
- **Limitations:** Konten pada drive yang dilepas tidak dapat dipulihkan hanya dari Astra.

#### FR-B07 - Default aman dan ignore (P1)
- **Acceptance:** Diberikan proyek terbuka, maka `node_modules`, `.git`, `.astra`, dan pola ignore lain
  yang dapat dikonfigurasi disembunyikan/diringkas secara default; folder yang diabaikan tidak pernah
  di-watch atau dipindai untuk titik entri canvas kecuali pengguna secara eksplisit memilih ikut.
- **Dependencies:** Settings, scoping watcher.
- **Limitations:** Daftar ignore bersifat heuristik; pengguna mungkin perlu menyesuaikannya.

### C. Canvas Visual

#### FR-C01 - Merender website asli (P0)
- **Story:** Sebagai pengguna, saya ingin melihat situs asli saya.
- **Acceptance:** Diberikan proyek dengan `index.html` (atau entri yang dipilih pengguna), ketika canvas
  dimuat, maka ia merender HTML dengan CSS dan JS lokal yang tertaut diterapkan, sesuai dengan file yang
  sama dibuka langsung di browser biasa untuk fitur yang didukung.
- **Dependencies:** Preview sandbox (SEC), resolusi aset.
- **Limitations:** Fitur server-side dan build-step tidak berjalan; elemen yang tidak didukung dirender
  apa adanya oleh browser tetapi tidak dapat diedit secara visual.

#### FR-C02 - Memilih elemen dengan mengklik (P0)
- **Acceptance:** Diberikan canvas, ketika saya mengklik elemen yang dirender, maka elemen itu menjadi
  seleksi aktif, outline seleksi muncul (box + label tag), dan Inspector serta Layer tree keduanya
  mencerminkan seleksi dalam 100 ms.
- **Dependencies:** Selection bridge (postMessage), pemetaan model.
- **Limitations:** Elemen dengan `pointer-events: none` dapat dipilih lewat Layer tree.

#### FR-C03 - Menampilkan outline seleksi (P0)
- **Acceptance:** Diberikan sebuah seleksi, maka outline (mis. aksen 1-2 px, dengan pembedaan hover vs.
  selected) digambar tanpa memengaruhi layout atau CSS milik situs sendiri.
- **Dependencies:** FR-C02.
- **Limitations:** Outline dirender oleh layer overlay Astra yang disuntikkan ke preview, yang juga
  harus tetap terisolasi dari style proyek.

#### FR-C04 - Menampilkan hierarki elemen (P1)
- **Acceptance:** Diberikan elemen terpilih, maka breadcrumb path (mis. `body > main > section > h1`)
  ditampilkan dan setiap segmen dapat diklik untuk memilih ancestor tersebut.
- **Dependencies:** FR-C02, model.
- **Limitations:** Path berbasis DOM, bukan berbasis source, untuk elemen yang dihasilkan saat runtime.

#### FR-C05 - Menyinkronkan seleksi dengan layer tree (P0)
- **Acceptance:** Diberikan seleksi di canvas, maka node Layer tree yang sesuai di-scroll ke tampilan
  dan disorot; memilih di Layer tree memilih di canvas.
- **Dependencies:** FR-C02, Layer tree.
- **Limitations:** Node yang dibuat murni saat runtime dan tidak punya padanan source muncul di tree
  sebagai "runtime (read-only)".

#### FR-C06 - Menangani elemen tidak didukung tanpa merusak proyek (P0)
- **Acceptance:** Diberikan elemen yang tidak sepenuhnya didukung Astra (mis. custom element tak dikenal,
  internal `<svg>`, `<canvas>`, node yang dihasilkan `<script>` inline), ketika pengguna memilih atau
  menginspeksinya, maka Astra menampilkannya read-only, tidak menghasilkan perubahan source, dan tidak
  pernah menghapus atau menulis ulang elemen itu selama edit yang tidak terkait.
- **Dependencies:** Aturan preservasi sync (FR-G).
- **Limitations:** Beberapa elemen dapat diinspeksi tetapi tidak dapat diedit secara visual di MVP.

### D. Drag-and-Drop

#### FR-D01 - Men-drag komponen dari panel komponen (P0 untuk dasar; library penuh P1)
- **Acceptance:** Diberikan panel komponen, ketika saya menekan dan men-drag komponen, maka preview drag
  mengikuti pointer dan canvas menampilkan target drop yang valid; melepas di target valid menyisipkan
  elemen sesuai FR-D02.
- **Dependencies:** dnd-kit, validasi (FR-D05), sync (FR-G).
- **Limitations:** MVP merilis set komponen terkurasi kecil (Bagian 12); library besar adalah P1.

#### FR-D02 - Menyisipkan elemen ke lokasi valid (P0)
- **Acceptance:** Diberikan target drop yang valid, ketika saya drop, maka elemen baru disisipkan pada
  posisi yang ditunjukkan di model dokumen dan, saat save, di source pada lokasi yang cocok dengan
  nesting yang benar.
- **Dependencies:** FR-D01, model, sync.
- **Limitations:** Penyisipan menggunakan markup terserialisasi yang diformat; formatting sibling yang
  ada tetap dipertahankan di tempat lain.

#### FR-D03 - Memindahkan elemen dalam hierarki dokumen (P0)
- **Acceptance:** Diberikan elemen terpilih, ketika saya men-drag-nya ke parent/posisi valid lain dan
  drop, maka elemen berpindah (bukan duplikat) di model maupun source, dan perpindahan itu menjadi
  satu langkah undo.
- **Dependencies:** FR-D02, history.
- **Limitations:** Memindahkan melewati batas sintaks yang tidak dapat diwakili Astra diblokir dengan penjelasan.

#### FR-D04 - Menampilkan indikator penyisipan (P0)
- **Acceptance:** Diberikan drag aktif, maka canvas menampilkan indikator drop yang jelas (garis atau
  placeholder) pada posisi prospektif, plus kontainer target yang disorot; target tidak valid menunjukkan
  kursor/indikator terlarang.
- **Dependencies:** FR-D01, validasi.
- **Limitations:** Presisi indikator untuk target yang sangat bersarang atau berketinggian nol mungkin
  memerlukan Layer tree sebagai fallback.

#### FR-D05 - Validasi batasan nesting HTML dasar (P0)
- **Acceptance:** Diberikan drop, ketika nesting yang dihasilkan tidak valid menurut sekumpulan aturan
  terdokumentasi (mis. `<button>` tidak boleh memuat `<section>`; `<p>` tidak boleh memuat konten block;
  tidak ada elemen interaktif bersarang di elemen interaktif), maka drop ditolak dengan pesan eksplisit
  ("Komponen ini tidak dapat ditempatkan di sini") dan tidak ada perubahan model/source.
- **Dependencies:** Set aturan, model.
- **Limitations:** Set aturan sengaja tidak lengkap pada awalnya; kasus tak dikenal default ke
  allow-with-warning daripada blok (`OQ-006`).

#### FR-D06 - Undo dan redo untuk operasi drag (P0)
- **Acceptance:** Diberikan insert/move/reorder apa pun, ketika saya menekan Ctrl+Z, maka operasi
  dikembalikan di model dan source sebagai satu langkah; Ctrl+Shift+Z (atau Ctrl+Y) mengulanginya.
- **Dependencies:** Modul history.
- **Limitations:** Lihat FR-G-Undo untuk aturan granularitas.

### E. Property Inspector

#### FR-E01 - Mengedit teks dan atribut HTML yang didukung (P0)
- **Acceptance:** Diberikan elemen terpilih, ketika saya mengedit konten teks atau atribut yang didukung
  (`href`, `src`, `alt`, `title`, `id`, `class`, `target`, `rel`, `width`, `height`, `placeholder`,
  `type`, `value`, `aria-*`, `data-*`), maka model, canvas, dan (saat save) source diperbarui; atribut
  yang tidak didukung ditampilkan read-only.
- **Dependencies:** Model, sync.
- **Limitations:** Editing atribut berbasis schema; schema berkembang seiring waktu.

#### FR-E02 - Mengedit tipografi CSS (P0)
- **Acceptance:** Diberikan seleksi, ketika saya mengubah font-family, font-size, font-weight,
  line-height, letter-spacing, text-align, color, atau text-transform, maka perubahan tercermin di canvas
  dan ditulis ke rule stylesheet (atau inline style sesuai kebijakan), bukan di-hardcode ke markup.
- **Dependencies:** CSS parser, sync.
- **Limitations:** Penanganan unit dan shorthand mengikuti kebijakan normalisasi terdokumentasi.

#### FR-E03 - Mengedit warna dan background (P0)
- **Acceptance:** Diberikan seleksi, ketika saya mengubah `color`, `background-color`, `background-image`
  (URL/preset gradient), atau opacity, maka canvas diperbarui dan rule target ditambal di source.
- **Dependencies:** FR-E02.
- **Limitations:** Gradient kompleks mungkin diedit sebagai nilai mentah di MVP.

#### FR-E04 - Mengedit spacing, border, dan dimensi (P0)
- **Acceptance:** Diberikan seleksi, ketika saya mengubah margin, padding, border (width/style/color/
  radius), width, height, dimensi min/max, atau dasar display/position, maka perubahan tercermin dan
  ditulis ke rule yang benar; editing box-model menunjukkan dari mana setiap nilai saat ini berasal.
- **Dependencies:** FR-E02, pembacaan computed style.
- **Limitations:** Interaksi sizing anak flex/grid ditampilkan tetapi tidak sepenuhnya dimodelkan di MVP.

#### FR-E05 - Mengonfigurasi Flexbox dan CSS Grid (P1)
- **Acceptance:** Diberikan kontainer dengan `display:flex` atau `display:grid`, ketika saya menggunakan
  tab Layout, maka saya dapat mengatur direction, wrap, justify/align, gap, dan nilai track/area template,
  dengan canvas diperbarui live dan rule ditambal di source.
- **Dependencies:** FR-E04.
- **Limitations:** Editor penempatan grid-area penuh adalah P1/P2.

#### FR-E06 - Mengelola class CSS (P0)
- **Acceptance:** Diberikan seleksi, ketika saya menambah/menghapus class, maka atribut `class` diperbarui
  di source, dan inspector mendaftar rule stylesheet mana yang cocok dengan elemen beserta asalnya
  (file + selector).
- **Dependencies:** FR-E01, CSS parser.
- **Limitations:** Manipulasi class dinamis via JS tidak dilacak.

#### FR-E07 - Menampilkan selector/rule source untuk sebuah style (P0)
- **Story:** Sebagai developer, saya ingin tahu di mana sebuah style berada.
- **Acceptance:** Diberikan computed style pada elemen terpilih, maka inspector menampilkan file dan
  selector rule asalnya (dapat ditautkan ke editor sumber), membedakan inline style dari rule stylesheet
  sejauh memungkinkan.
- **Dependencies:** Resolusi cascade CSS.
- **Limitations:** Resolusi cascade bersifat perkiraan untuk `!important`, layers (`@layer`), dan
  specificity kompleks; perkiraan diberi label.

#### FR-E08 - Membedakan style inherited / stylesheet / inline (P1)
- **Acceptance:** Diberikan sebuah properti, maka inspector memberi label apakah ia inherited (dan dari
  mana), rule stylesheet, inline, atau default browser, sesuai kategorisasi ala devtools untuk kasus umum.
- **Dependencies:** FR-E07.
- **Limitations:** Perbedaan computed vs. specified mungkin disederhanakan di MVP.

#### FR-E09 - Editing properti responsive (P0)
- **Acceptance:** Diberikan viewport non-desktop yang aktif, ketika saya mengedit properti, maka Astra
  menulisnya ke media query yang cocok dengan breakpoint saat ini (rule yang ada jika ada, jika tidak
  membuat rule baru di lokasi yang terdokumentasi dan deterministik).
- **Dependencies:** FR-H, CSS parser, sync.
- **Limitations:** Breakpoint di MVP berasal dari tiga preset dan media query yang ada; penulisan
  breakpoint sembarang adalah P1.

### F. Code Editor

#### FR-F01 - Editing HTML, CSS, dan JS dengan syntax highlighting (P0)
- **Acceptance:** Diberikan file `.html/.css/.js` yang terbuka, ketika saya melihat Code Editor, maka ia
  menampilkan syntax highlighting, nomor baris, bracket matching, dan code folding untuk bahasa itu
  melalui Monaco.
- **Dependencies:** Monaco Editor.
- **Limitations:** Preprocessor dan framework hanya mendapat highlighting biasa (MVP).

#### FR-F02 - Pencarian dalam file (P0)
- **Acceptance:** Diberikan file terbuka, ketika saya menekan Ctrl+F, maka kotak pencarian dalam file
  menemukan kecocokan dengan navigasi next/previous dan jumlah kecocokan; Ctrl+H menawarkan replace.
- **Dependencies:** Monaco.
- **Limitations:** Pencarian seluruh proyek adalah P1.

#### FR-F03 - Umpan balik error (P0)
- **Acceptance:** Diberikan error sintaks yang diperkenalkan di editor, maka pass parser yang di-debounce
  memunculkan marker inline dan jumlah di status bar dalam ~500 ms; canvas tidak crash dan, jika parsing
  gagal, render terakhir yang baik dipertahankan dengan banner peringatan.
- **Dependencies:** Parser, status bar.
- **Limitations:** Error JS semantik (bukan hanya sintaksis) tidak terdeteksi.

#### FR-F04 - Simpan dan reload file (P0)
- **Acceptance:** Diberikan file yang diedit, ketika saya menekan Ctrl+S, maka file ditulis secara atomik
  (FR-G-Write) dan indikator dirty tab hilang; me-reload menunjukkan konten identik.
- **Dependencies:** Filesystem adapter.
- **Limitations:** Lock eksternal dapat menyebabkan kegagalan tulis, ditangani sesuai FR-G-Write.

#### FR-F05 - Perubahan source tercermin di preview (P0)
- **Acceptance:** Diberikan HTML/CSS valid yang diubah di editor, ketika debounce berakhir (default
  <= 400 ms), maka canvas mencerminkan perubahan tanpa reload aplikasi penuh.
- **Dependencies:** Sync (FR-G), watcher tidak diperlukan untuk self-edit.
- **Limitations:** Perubahan dengan efek samping pada JS runtime tercermin seperti browser menjalankannya.

### G. Synchronization Engine

Sync engine adalah risiko arsitektur inti. Ia merekonsiliasi tiga representasi:

```text
   Visual Editor (canvas + inspector + dnd)
              |
              v
   Internal Document Model (ter-parse, ter-address, dapat didiff)
              |
              v
   Source Files (HTML / CSS / JS asli di disk)
```

**File di disk adalah sumber kebenaran yang tahan lama.** Model adalah proyeksi live yang cukup
lossless dan mencatat source anchor sehingga edit dapat ditulis kembali secara surgical.

#### FR-G01 - Parsing source dengan source anchor (P0)
- **Acceptance:** Diberikan file HTML, ketika diparse, maka setiap node membawa offset awal/akhir
  source-nya dan, untuk CSS, setiap rule/declaration membawa teks mentah dan offset-nya, sehingga node
  yang tidak dimodifikasi dapat di-emit ulang byte-identik dengan teks aslinya.
- **Dependencies:** parse5 (dengan `sourceCodeLocationInfo`), PostCSS (`node.raws`, `source`).
- **Limitations:** Normalisasi spesifik parser diminimalkan tetapi tidak dihilangkan; test round-trip
  (TEST-### di Bagian 15) adalah gerbangnya.

#### FR-G02 - Mendeteksi perubahan source (P0)
- **Acceptance:** Diberikan edit dari Astra dan edit eksternal keduanya, maka Astra melacak hash konten
  per file dan membedakan "diubah oleh Astra", "diubah eksternal", dan "diubah keduanya"; setiap kasus
  mengambil jalur terdokumentasi (self-write: tanpa reload loop; eksternal bersih: reload; eksternal
  kotor: prompt konflik).
- **Dependencies:** Watcher, hashing, revision token.
- **Limitations:** Race pada milidetik yang sama ditangani dengan hashing, bukan dengan timing.

#### FR-G03 - Menerjemahkan perubahan visual menjadi perubahan source (P0)
- **Acceptance:** Diberikan edit visual (teks, atribut, style, insert, move, delete), maka Astra
  menghasilkan set patch tekstual minimal yang mewujudkannya di source, menerapkannya, memparse ulang,
  dan memverifikasi node hasil cocok dengan state model yang dimaksud.
- **Dependencies:** FR-G01, patch engine.
- **Limitations:** Edit yang tidak dapat diekspresikan sebagai patch lokal ditolak dengan penjelasan,
  bukan didekati secara senyap (`OQ-006`).

#### FR-G04 - Penanganan konflik (P0)
- **Acceptance:** Diberikan file yang diubah di disk sejak Astra terakhir membacanya sementara Astra juga
  punya perubahan belum tersimpan, ketika save atau reload dipicu, maka tidak ada penimpaan otomatis;
  pengguna ditampilkan opsi (Keep Mine / Take Theirs / Compare), dan Compare menyajikan diff unified
  dalam aplikasi sebelum pengguna berkomitmen.
- **Dependencies:** FR-G02, tampilan diff.
- **Limitations:** MVP berbasis baris/teks, bukan three-way merge penuh (`OQ-008`).

#### FR-G05 - Mempertahankan sintaks yang tidak didukung (P0)
- **Acceptance:** Diberikan konstruksi yang tidak dimodelkan Astra (`<script>` inline, template literal,
  `<template>`, conditional comment, at-rule CSS eksotis, `style` dalam bentuk tak dikenal), ketika edit
  yang tidak terkait terjadi, maka rentang byte tersebut tidak tersentuh; test preservasi menegaskan
  byte-equality di luar rentang yang diedit.
- **Dependencies:** FR-G01.
- **Limitations:** Edit yang *mengharuskan* mengubah sintaks tidak didukung ditolak, bukan ditebak.

#### FR-G06 - Mencegah infinite synchronization loop (P0)
- **Acceptance:** Diberikan satu edit pengguna, maka jumlah penulisan disk tepat satu (di-debounce), dan
  watcher tidak memicu reparse yang menghasilkan edit lanjutan; self-write ditandai dan dicocokkan
  berdasarkan hash sehingga tidak pernah menggema kembali sebagai "eksternal".
- **Dependencies:** Revision token, penandaan origin, pencocokan hash.
- **Limitations:** Tool pihak ketiga yang menulis ulang formatting dalam loop watch tetap tanggung jawab
  pengguna; Astra berhenti menggema berdasarkan hash.

#### FR-G07 - Undo/redo lintas model dan source (P0)
- **Acceptance:** Diberikan urutan edit, maka undo/redo memulihkan model dan state source yang sesuai;
  setiap aksi pengguna logis adalah satu langkah; meng-undo sebuah save tetap meninggalkan file konsisten
  (undo mengedit konten, bukan fakta bahwa save terjadi).
- **Dependencies:** Command stack dengan patch invers.
- **Limitations:** Granularitas digabung untuk pengetikan cepat (mis. satu langkah per ~500 ms atau per
  jeda), didokumentasikan di settings.

#### FR-G08 - Commit perubahan ke disk dengan aman (P0)
- **Acceptance:** Diberikan save, maka Astra: (1) mengambil lock/lease file; (2) memverifikasi hash base
  di disk masih cocok; (3) menulis ke file temp di direktori yang sama; (4) fsync; (5) melakukan rename
  atomik menimpa target; (6) mencatat backup di `.astra/backups/`. Jika ada langkah gagal, file asli
  dibiarkan utuh dan pengguna diberi tahu.
- **Dependencies:** Filesystem adapter.
- **Limitations:** Tidak semua network/shared drive mendukung rename atomik; Astra mendeteksi dan memberi
  peringatan.

#### FR-G09 - Mempertahankan formatting dan komentar (P0)
- **Acceptance:** Diberikan edit pada satu nilai, maka indentasi, line ending, gaya kutip atribut,
  konvensi self-closing, whitespace, dan komentar di tempat lain di file tetap byte-identik; nilai baru
  diformat konsisten dengan konteks langsungnya.
- **Dependencies:** FR-G01, FR-G03.
- **Limitations:** Fragmen yang baru dihasilkan menggunakan kebijakan formatter yang dapat dikonfigurasi
  (deteksi gaya proyek bersifat best-effort).

#### FR-G10 - Kebijakan editing: stylesheet vs inline (P0)
- **Acceptance:** Diberikan edit style pada elemen yang cocok dengan rule stylesheet yang ada, maka Astra
  memperbarui rule itu secara default; jika tidak ada rule yang cocok, Astra membuat rule (default: class
  pada elemen + rule di stylesheet terkait) daripada inline style, kecuali pengguna memilih inline;
  pilihan diingat per proyek.
- **Dependencies:** Resolusi cascade.
- **Limitations:** Memilih stylesheet yang "benar" saat banyak yang ada bersifat heuristik (`OQ-009`).

#### FR-G11 - Kesadaran multi-file dan multi-entri (P1)
- **Acceptance:** Diberikan proyek dengan beberapa halaman HTML dan stylesheet, maka edit pada CSS
  bersama diterapkan sekali dan me-render ulang semua halaman yang terdampak; explorer menunjukkan file
  mana yang disentuh oleh sebuah edit sebelum menyimpan.
- **Dependencies:** Project graph.
- **Limitations:** MVP mungkin beroperasi pada halaman aktif + stylesheet yang tertaut.

### H. Responsive Design

#### FR-H01 - Preset viewport (P0)
- **Acceptance:** Diberikan toolbar, ketika saya memilih Desktop/Tablet/Mobile, maka canvas berubah ukuran
  ke lebar preset (default sementara: Desktop = penuh/fleksibel, Tablet = 768 px, Mobile = 390 px) dan
  preset aktif ditandai dengan jelas.
- **Dependencies:** Canvas.
- **Limitations:** Lebar preset adalah default; dapat disesuaikan pengguna nanti.

#### FR-H02 - Dimensi viewport yang dapat disesuaikan (P1)
- **Acceptance:** Diberikan preset, ketika saya men-drag tepi frame atau mengetik lebar/tinggi, maka
  canvas berubah ukuran live dan nilai tercermin di indikator.
- **Dependencies:** FR-H01.
- **Limitations:** Profil perangkat spesifik adalah P2.

#### FR-H03 - Editing CSS sadar breakpoint (P0)
- **Acceptance:** Diberikan preset non-desktop dan media query yang ada untuk rentang itu, ketika saya
  mengedit properti, maka ia ditulis ke media query itu untuk selector yang cocok; jika tidak ada,
  blok `@media` baru dibuat di lokasi deterministik dengan breakpoint default proyek.
- **Dependencies:** FR-E09, CSS parser, sync.
- **Limitations:** Nilai breakpoint disimpulkan di MVP; editor breakpoint khusus adalah P1.

#### FR-H04 - Dukungan media query nyata (P0)
- **Acceptance:** Diberikan rule `@media` yang ada di CSS proyek, maka mengubah ukuran canvas melewati
  ambang media query secara visual mengubah hasil render persis seperti yang akan diterapkan browser
  (tanpa jalur render khusus Astra).
- **Dependencies:** Preview sandbox (mesin browser asli).
- **Limitations:** Bergantung pada dukungan CSS webview yang cocok dengan browser target pengguna.

#### FR-H05 - Indikasi breakpoint aktif yang jelas (P0)
- **Acceptance:** Diberikan lebar viewport saat ini, maka Astra menunjukkan media query mana yang aktif
  untuk seleksi dan rule stylesheet mana yang saat ini menang untuk properti yang diinspeksi.
- **Dependencies:** FR-E08, FR-H03.
- **Limitations:** Rentang yang tumpang tindih/`min-max` diringkas.

### I. Komponen dan Design Token

#### FR-I01 - Definisi komponen yang dapat digunakan ulang (P1)
- **Acceptance:** Diberikan elemen/subtree terpilih, ketika saya memilih "Create Component", maka Astra
  menyimpan definisi (nama + markup + style) di lokasi portabel yang terdokumentasi dan menyisipkan
  referensi di anchor; edit berikutnya pada definisi memperbarui semua referensi di proyek aktif.
- **Dependencies:** Model, sync, format penyimpanan.
- **Limitations:** MVP: ditunda. Tooling komponen penuh adalah P1+/Phase 5. MVP merilis palet komponen
  terkurasi, bukan komponen buatan pengguna.

#### FR-I02 - Token warna dan tipografi bersama (P1)
- **Acceptance:** Diberikan proyek, ketika saya mendefinisikan/mendefinisikan ulang token (warna, keluarga/
  ukuran font, skala spacing), maka semua elemen yang mereferensikannya diperbarui, dan token muncul di
  inspector sebagai nilai yang dapat dipilih.
- **Dependencies:** CSS custom properties.
- **Limitations:** MVP: menampilkan token yang ada secara read-only jika ada; editing adalah P1.

#### FR-I03 - Dukungan CSS custom property (P0 untuk membaca, P1 untuk mengedit)
- **Acceptance:** Diberikan proyek yang menggunakan `--custom-properties`, maka Astra menampilkan nilai
  token yang ter-resolve di inspector dan, jika nilainya berupa custom property, menunjukkan nama properti
  dan lokasi definisinya. Mengedit nilai token adalah P1.
- **Dependencies:** CSS parser, cascade.
- **Limitations:** Fallback `var()` yang ter-computed ditampilkan sebagai ter-resolve atau mentah, berlabel.

#### FR-I04 - Format penyimpanan portabel (P1)
- **Acceptance:** Diberikan komponen/token, maka mereka disimpan dalam file yang dapat dibaca manusia
  (CSS custom property + HTML/partial, atau JSON terdokumentasi tanpa dependency runtime), dan proyek
  hasilnya tetap bisa dibuka di browser biasa tanpa Astra.
- **Dependencies:** Keputusan arsitektur (`OQ-010`).
- **Limitations:** Mekanisme persisnya ditunda ke Phase 5.

**Batas MVP (sesuai Bagian 12):** FR-I03 *membaca* ada di MVP; FR-I01, FR-I02, FR-I04 dan FR-I03
*mengedit* ditunda.

### J. Aksesibilitas

Semua temuan aksesibilitas bersifat **saran (advisory)**. Astra tidak boleh menulis ulang kode proyek
secara senyap.

#### FR-J01 - Teks alt gambar yang hilang (P0, saran)
- **Acceptance:** Diberikan `<img>` tanpa `alt`, maka checker menandainya (severity: warning/error sesuai
  kebijakan), mendaftarkannya di panel Accessibility, dan mengkliknya memilih elemen; Astra tidak menambah
  `alt` secara otomatis.
- **Dependencies:** Analyzer.
- **Limitations:** Gambar dekoratif dengan `alt=""` benar dan tidak boleh ditandai.

#### FR-J02 - Nama aksesibel yang hilang (P0, saran)
- **Acceptance:** Diberikan elemen interaktif tanpa nama aksesibel yang dapat dipahami (button, link,
  input), maka mereka ditandai beserta alasannya; tanpa perbaikan otomatis.
- **Dependencies:** Analyzer.
- **Limitations:** Komputasi nama aksesibel yang akurat itu kompleks; MVP memakai heuristik dan
  melabelinya sebagai perkiraan.

#### FR-J03 - Masalah label form (P0, saran)
- **Acceptance:** Diberikan kontrol form tanpa label/`aria-label`/`aria-labelledby` yang terkait, maka ia
  ditandai, dan perbaikannya dijelaskan (tidak diterapkan).
- **Dependencies:** FR-J02.
- **Limitations:** Asosiasi label implicit lewat wrapping terdeteksi; kasus eksotis mungkin terlewat.

#### FR-J04 - Peringatan hierarki heading (P1, saran)
- **Acceptance:** Diberikan heading yang melompati level atau tidak punya `h1`, maka peringatan
  ditampilkan dengan outline yang bermasalah.
- **Dependencies:** Analyzer.
- **Limitations:** Murni struktural; hanya saran.

#### FR-J05 - Pengecekan kontras dasar (P1, saran)
- **Acceptance:** Diberikan elemen teks, maka rasio kontras diperkirakan dari warna dan background
  ter-computed dan ditandai terhadap ambang WCAG AA jika dapat dihitung.
- **Dependencies:** Computed style.
- **Limitations:** Background dari gambar/gradient mungkin tak dapat ditentukan; dilaporkan sebagai
  "tidak dapat dihitung" bukan lulus.

#### FR-J06 - Pengecekan aksesibilitas keyboard (P2, saran)
- **Acceptance:** Diberikan risiko urutan fokus/perangkap yang jelas (mis. `tabindex` positif), maka
  peringatan ditampilkan.
- **Dependencies:** Analyzer.
- **Limitations:** Testing traversal keyboard penuh di luar cakupan MVP.

### K. Operasi Local-First

#### FR-K01 - Tanpa koneksi jaringan wajib (P0)
- **Acceptance:** Diberikan mesin tanpa koneksi, ketika Astra diluncurkan dan pengguna membuka, mengedit,
  serta menyimpan proyek lokal, maka semua alur inti berhasil tanpa akses jaringan.
- **Dependencies:** Arsitektur; tanpa panggilan remote di jalur inti.
- **Limitations:** Fitur opsional (mis. AI, pratinjau font remote) mungkin butuh jaringan dan harus
  degrade dengan mulus.

#### FR-K02 - Tanpa keharusan akun (P0)
- **Acceptance:** Diberikan pemasangan baru, maka Astra sepenuhnya dapat digunakan tanpa sign-in, email,
  atau aktivasi lisensi.
- **Dependencies:** Tidak ada.
- **Limitations:** Tier berbayar opsional di masa depan tidak boleh mengunci editing inti (`OQ-012`).

#### FR-K03 - Tanpa telemetri secara default (P0)
- **Acceptance:** Diberikan pengaturan default, maka Astra tidak mengirim analitik atau data penggunaan;
  telemetri di masa depan harus opt-in, terdokumentasi, dan diungkapkan dengan tepat.
- **Dependencies:** Settings, kebijakan jaringan.
- **Limitations:** Crash reporting, jika pernah ditambahkan, harus opt-in eksplisit.

#### FR-K04 - Batas jelas untuk sumber daya eksternal (P0)
- **Acceptance:** Diberikan proyek yang mereferensikan aset remote (CSS/JS CDN, webfont, gambar remote),
  maka Astra menampilkan indikator "sumber daya eksternal", menerapkan kebijakan yang dapat dikonfigurasi
  (Blokir secara default di MVP; Izinkan dengan konfirmasi), dan tidak pernah menjalankan script remote
  secara senyap tanpa kebijakan pengguna yang mengizinkan.
- **Dependencies:** Preview sandbox, CSP.
- **Limitations:** Memblokir semua sumber daya remote dapat membuat sebagian situs tampak rusak offline;
  UI menjelaskan alasannya.

#### FR-K05 - Penyimpanan proyek lokal (P0)
- **Acceptance:** Diberikan proyek, maka ia disimpan hanya di folder yang dipilih pengguna plus direktori
  metadata `.astra/`; tidak ada data proyek yang disalin ke cloud mana pun oleh Astra.
- **Dependencies:** Filesystem adapter.
- **Limitations:** `.astra/` menyimpan metadata non-esensial (ID, backup, settings); menghapusnya tidak
  boleh merusak proyek.

#### FR-K06 - Operasi offline yang mulus (P0)
- **Acceptance:** Diberikan hilangnya konektivitas di tengah sesi, maka tidak ada fitur inti yang error;
  fitur yang butuh jaringan menampilkan catatan offline yang jelas.
- **Dependencies:** FR-K01.
- **Limitations:** Tidak ada yang material.

### L. AI Opsional (ekstensi masa depan)

#### FR-L01 - Adapter provider (P2)
- **Acceptance:** Diberikan konfigurasi provider AI opsional, maka Astra dapat merutekan permintaan AI
  melalui antarmuka adapter yang mendukung runtime lokal (mis. Ollama) dan, secara opsional, provider
  terhosting jika pengguna mengonfigurasinya; tidak ada provider yang diperlukan untuk fungsi inti.
- **Dependencies:** Tidak ada untuk inti; ditunda ke Phase 6.
- **Limitations:** Tidak ada di MVP; sepenuhnya opt-in.

#### FR-L02 - Perubahan AI yang dapat direview (P2)
- **Acceptance:** Diberikan usulan perubahan AI apa pun (generate komponen, jelaskan CSS, saran perbaikan
  responsive, refactor seleksi, saran perbaikan a11y), maka usulan ditampilkan sebagai diff dan diterapkan
  hanya atas persetujuan eksplisit; AI tidak pernah menjalankan perintah shell dan tidak pernah menimpa
  file tanpa otorisasi.
- **Dependencies:** Tampilan diff, permission.
- **Limitations:** Tidak ada di MVP.

---

## 8. Non-Functional Requirements

Semua target numerik di bawah ini **provisional** dan harus diukur sebelum diperlakukan sebagai
komitmen (`ASM-001`). Di mana ada target, metode pengukuran disebutkan. Target dipilih untuk laptop
Windows kelas menengah (mis. CPU 4-core, RAM 16 GB, SSD) dan juga harus divalidasi pada perangkat yang
lebih sederhana (CPU 4-core, RAM 8 GB), mengingat model multi-proses Electron. Karena Electron
membundel Chromium dan menjalankan beberapa proses, angka memori dan ukuran distribusi diperkirakan
akan jauh lebih tinggi daripada shell system-webview yang lebih ringan; angka-angka itu dinyatakan
sebagai target yang harus diukur, bukan sebagai janji.

#### NFR-001 - Waktu startup (provisional)
Cold start sampai jendela welcome interaktif: **target <= 3 s** (P95 atas 20 run).
Pengukuran: timestamp terinstrumentasi dari proses mulai sampai paint interaktif pertama; dicatat di log
diagnostik lokal (opt-in).

#### NFR-002 - Waktu membuka proyek (provisional)
Membuka proyek sedang (<= 200 file, <= 5 MB total, HTML entri <= 500 KB): **target <= 1.5 s** sampai paint
canvas pertama, tidak termasuk sumber daya remote.
Pengukuran: timer di sekitar pipeline load proyek.

#### NFR-003 - Responsivitas interaksi (provisional)
Klik-ke-seleksi dan edit-properti-ke-update-canvas: **target <= 100 ms** lokal, P95.
Pengukuran: performance mark di sekitar pipeline seleksi dan edit.

#### NFR-004 - Penggunaan memori (provisional)
Diukur di seluruh pohon proses Electron (main + renderer + helper GPU/utility): idle (layar welcome)
**target <= 350 MB total RSS**; proyek sedang terbuka dengan preview termuat **target <= 900 MB total
RSS**. Pengukuran: jumlah metrik semua proses aplikasi yang disampel selama skenario ter-skrip pada
mesin 16 GB maupun 8 GB; laporkan rincian per proses. Batas provisional ini sengaja lebih longgar
daripada shell system-webview untuk mencerminkan model proses Electron.

#### NFR-005 - Penanganan pohon besar (provisional)
Editing dalam dokumen hingga ~5.000 node HTML: tidak ada operasi yang memblok UI > 200 ms.
Pengukuran: dokumen stress sintetis dengan edit ter-skrip.

#### NFR-006 - Keandalan
Tidak ada crash dalam sesi editing ter-skrip 2 jam; nol kejadian kelas "source corruption" (NFR-010) di
seluruh suite acceptance. Pengukuran: soak otomatis + test preservasi.

#### NFR-007 - Integritas data (P0)
Setiap save bersifat atomik; tidak ada save yang terganggu meninggalkan file tertulis sebagian. Jika
penulisan gagal, konten sebelumnya tetap utuh. Pengukuran: test fault-injection (matikan di tengah
penulisan, simulasi disk penuh) yang menegaskan konten file adalah salah satu dari {lama, baru}, tidak
pernah campuran.

#### NFR-008 - Postur keamanan
Kode preview tidak dapat memanggil perintah desktop yang istimewa; akses filesystem terbatas pada root
proyek yang dibuka. Pengukuran: test sandbox-escape otomatis (Bagian 15) harus gagal keluar.

#### NFR-009 - Aksesibilitas Astra sendiri (P1)
UI Astra sendiri memenuhi WCAG 2.1 AA untuk kontras warna dan dapat dioperasikan keyboard untuk alur
utama: buka proyek, pilih elemen, edit properti, save. Pengukuran: tooling audit kontras + checklist
walkthrough keyboard-only.

#### NFR-010 - Maintainability
Batas modular (Bagian 11) tanpa dependency siklus antar modul inti; TypeScript strict mode; lint bersih
(main, preload, renderer); antarmuka publik terdokumentasi. Pengukuran: lint dependency-graph, typecheck, gerbang lint di CI.

#### NFR-011 - Cakupan offline
100% test acceptance MVP lulus dengan jaringan dimatikan (kecuali test yang secara eksplisit ditandai
network-optional). Pengukuran: job CI yang menjalankan suite dengan jaringan diblokir.

#### NFR-012 - Kompatibilitas
Mendukung Windows 10 (21H2+) dan Windows 11; preview yang dirender memakai engine Chromium yang
dibundel dengan versi Electron yang di-pin pada aplikasi (bukan webview sistem di mesin pengguna).
Pengukuran: matriks versi OS di CI/manual; versi Electron/Chromium yang di-pin dicatat per rilis.

#### NFR-013 - Integritas data saat perubahan eksternal
Modifikasi eksternal saat Astra terbuka tidak pernah menghasilkan kehilangan data senyap. Pengukuran:
test penulis bersamaan (Bagian 15).

#### NFR-014 - Observability tanpa telemetri
Diagnostik hanya lokal: log yang dapat dilihat pengguna dan bundle diagnostik yang dapat diekspor
opt-in. Tidak ada data yang meninggalkan mesin kecuali pengguna mengekspornya. Pengukuran: capture
jaringan selama penggunaan normal menunjukkan tidak ada egress.

#### NFR-015 - Penskalaan ukuran file
File hingga 5 MB terbuka di code editor tanpa freeze; file lebih besar terbuka dengan peringatan dan
fallback read-only jika latensi editing tidak dapat diterima. Pengukuran: waktu buka file besar yang
di-generate.

#### NFR-016 - Latensi refresh preview (provisional)
Setelah edit source yang sudah settled, preview mencerminkan perubahan dalam **target <= 400 ms**
(konsisten dengan FR-F05), P95, untuk proyek sedang. Pengukuran: performance mark dari edit yang
di-debounce sampai paint preview.

#### NFR-017 - Stabilitas renderer
Tidak ada crash proses renderer dalam sesi ter-skrip 2 jam; jika renderer memang crash, aplikasi
memulihkan state UI tanpa kehilangan data dan tanpa me-restart main process. Pengukuran: soak otomatis
plus test injeksi crash paksa (`TEST-032`).

#### NFR-018 - Ukuran distribusi dan instalasi (provisional, diukur bukan dijanjikan)
Electron membawa runtime Chromium, sehingga artefaknya besar. **Ukur** daripada menargetkan: catat
jejak terpasang (MB) dan ukuran installer untuk setiap rilis di Windows x64 dan publikasikan angkanya.
Anggaran perencanaan provisional berupa "orde ratusan MB terpasang" dicatat hanya untuk estimasi; tidak
boleh dikutip ke pengguna sebagai jaminan. Pengukuran: penghitungan ukuran file pada instalasi bersih.

---

## 9. Spesifikasi UI/UX

> [!note] Mengenai referensi visual
> Prompt menyebut "supplied Astra visual reference". Tidak ada gambar semacam itu di workspace saat
> penulisan. Berikut menentukan bahasa desain yang diinginkan dalam prosa. Jika referensi diberikan
> nanti, perlakukan sebagai otoritatif untuk detail visual spesifik (hue persis, skala spacing) dan
> rekonsiliasikan bagian ini; perlakukan sebagai niat desain, bukan bukti fungsionalitas yang sudah
> diimplementasikan.

### 9.1 Bahasa desain

- Lingkungan pengembangan desktop profesional, padat dan kaya informasi, bukan halaman marketing.
- Basis **dark charcoal** (mis. permukaan near-neutral seperti `#1E1E1E` dengan elevasi berlapis),
  aksen interaksi **burgundy dan gold** yang tertahan, kecuali referensi menentukan lain.
- Hierarki tipografi yang jelas, skala spacing yang konsisten, border 1 px halus, efek dekoratif
  minimal. Tanpa gradien berlebihan, glassmorphism, neon, kartu bulat raksasa, atau gaya "AI dashboard"
  generik.

### 9.2 Wilayah layout

```text
+---------------------------------------------------------------------------+
| TOOLBAR: project | current file | undo/redo | preview | D/T/M | zoom | save | ⚙ |
+------------+------------------------------------------------+-------------+
| LEFT       |                 CENTER CANVAS                  |  RIGHT      |
| Sidebar    |          (situs nyata + overlay)               |  Inspector  |
|            |                                                |             |
| Files      |        selection outline / breadcrumb          | Inspector   |
| Components |        drop indicators                         | Styles      |
| Design Sys |                                                | Layout      |
| Assets     |                                                | Attributes  |
| Settings   |                                                |             |
+------------+------------------------------------------------+-------------+
| BOTTOM CODE EDITOR: [HTML] [CSS] [JS]  ... syntax highlighted ...         |
|                      (tinggi panel dapat di-resize)                       |
+---------------------------------------------------------------------------+
| STATUS BAR: selection path | breakpoint | errors | save state | ext-resources|
+---------------------------------------------------------------------------+
```

### 9.3 Toolbar atas (UX-001)
Project selector; breadcrumb file saat ini; undo/redo; toggle live-preview (mode edit vs. preview);
preset perangkat (Desktop/Tablet/Mobile); kontrol zoom (fit, 100%, +/-); Save; Settings. Setiap kontrol
punya tooltip dengan shortcut keyboard-nya; kontrol yang tidak tersedia terlihat disabled (tidak
disembunyikan) untuk menjaga stabilitas layout.

### 9.4 Sidebar kiri (UX-002)
Tab/seksi: **Project files** (pohon sesuai FR-B), **Components** (palet yang dapat di-drag sesuai FR-D),
**Design system** (token, read-only di MVP), **Assets** (gambar/font yang dipakai), **Settings**.
Dapat diringkas; mengingat state scroll/ekspansi per proyek.

### 9.5 Canvas tengah (UX-003)
Merender situs nyata di dalam preview yang ter-sandbox. Overlay (outline seleksi, highlight hover,
breadcrumb, indikator drop) digambar oleh Astra di layer overlay terpisah yang tidak boleh membocorkan
style ke situs dan tidak boleh ikut tertangkap di output yang disimpan. Empty state: prompt di tengah
"Buka folder proyek untuk memulai" dengan tombol Open dan daftar proyek terakhir (daftar recent adalah P1).

### 9.6 Inspector kanan (UX-004)
Tab: **Inspector** (identitas elemen + atribut), **Styles** (rule yang cocok + computed value),
**Layout** (box model, flex/grid), **Attributes** (atribut HTML), plus kontrol tipografi dan spacing
yang disajikan dalam Styles. Setiap nilai menunjukkan asalnya (inline / file rule + selector / inherited
/ default) sesuai FR-E07/E08. Nilai responsive diberi label breakpoint tempatnya berlaku.

### 9.7 Code editor bawah (UX-005)
Berbasis Monaco, dengan tab HTML/CSS/JS (satu tab per file terbuka). Syntax highlighting, pencarian,
marker error (FR-F03). Tinggi panel dapat disesuaikan pengguna dan persisten. Editing di panel memberi
masukan ke sync engine (FR-F05).

### 9.8 States (UX-006)
- **Empty:** layar welcome; explorer kosong ("Folder ini tidak punya file web"); inspector kosong
  ("Pilih elemen untuk diedit").
- **Loading:** canvas menampilkan skeleton/frame dengan indikator loading; buka proyek menampilkan
  progres; parse panjang menampilkan spinner non-blok.
- **Error:** gagal parse (banner: "Tidak dapat memparse index.html; menampilkan render terakhir yang
  baik"), elemen tidak didukung (badge read-only), save gagal (dialog dengan penyebab + retry), konflik
  (FR-G04), sumber daya eksternal diblokir (indikator status bar dengan penjelasan).
- **Success:** indikator "Saved" transien di status bar (tanpa modal).

### 9.9 Shortcut keyboard (UX-007, provisional)

| Shortcut | Aksi |
|---|---|
| Ctrl+S | Simpan file saat ini |
| Ctrl+Shift+S | Simpan semua |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+C / Ctrl+V | Copy / Paste seleksi |
| Ctrl+D | Duplikat seleksi |
| Delete | Hapus seleksi |
| Ctrl+F / Ctrl+H | Find / Replace dalam file |
| Ctrl+Shift+F | Pencarian seluruh proyek (P1) |
| Ctrl+O | Buka proyek |
| Ctrl+W | Tutup file/proyek (dengan guard belum tersimpan) |
| Ctrl+1 / 2 / 3 | Desktop / Tablet / Mobile |
| Ctrl+P | Toggle mode preview |
| Ctrl+Shift+A | Toggle panel aksesibilitas |
| Ctrl+, | Settings |

Shortcut tidak boleh aktif saat code editor memiliki fokus bila akan berkonflik dengan pengetikan atau
default Monaco; konflik diselesaikan demi kepentingan editor yang terfokus.

### 9.10 Pertimbangan aksesibilitas untuk Astra sendiri (UX-008)
Panel yang dapat dinavigasi keyboard, focus ring yang terlihat, role ARIA untuk tree/tabs/dialog, label
screen-reader untuk tombol ikon-saja, dan menghormati reduced-motion. Target NFR-009.

---

## 10. Technical Stack dan Rasional

> [!note] Keputusan framework
> Framework desktop yang dipakai adalah **Electron** (ADR-001, Bagian 10.7). Electron adalah pilihan
> implementasi, bukan pembeda produk Astra - pembedanya tetap editing visual atas kode sumber nyata
> yang portabel (Bagian 2). Bagian ini menggantikan rencana Tauri/Rust sebelumnya.

### 10.1 Stack (baseline yang disetujui)

| Area | Pilihan | Wajib untuk MVP | Alasan | Trade-off / keamanan |
|---|---|---|---|---|
| Desktop framework | **Electron** | Ya | Membundel versi Chromium yang diketahui untuk rendering yang konsisten dan otomasi yang matang; main process Node.js untuk pekerjaan filesystem; ekosistem besar dan stabil. | Ukuran distribusi lebih besar dan memori lebih tinggi daripada shell system-webview; keamanan bergantung pada pemisahan main/preload/renderer yang benar (Bagian 14). |
| Frontend | **React + TypeScript** | Ya | Ekosistem matang untuk UI editor kompleks; typing kuat mengurangi bug model. | Overhead virtual DOM untuk pohon besar (dimigasi oleh virtualisasi/memoization). |
| Main process aplikasi | **Node.js + TypeScript** | Ya | Filesystem, watcher, penulisan atomik, hashing, dialog, dan validasi IPC di satu tempat yang istimewa. | Konteks istimewa; setiap permintaan IPC harus divalidasi dan API Node tidak boleh sampai ke konten tak terpercaya. |
| Renderer bridge | **preload script + `contextBridge`** | Ya | Mengekspos API kecil, eksplisit, dan bertipe sambil mempertahankan `contextIsolation` aktif. | Setiap channel yang ditambahkan di sini memperlebar permukaan kepercayaan; jaga tetap minimal dan teraudit. |
| Build tool / dev server | **Vite** dengan integrasi Electron (mis. `electron-vite` atau plugin Vite setara) | Ya | HMR cepat dan dukungan TS untuk renderer; bundling main/preload yang sederhana. | Jaga `base`/path aset tetap kompatibel dengan Electron (memuat dari `file://`). |
| Packaging | **Electron Forge** atau **electron-builder** | Ya | Keduanya menghasilkan installer/portable Windows untuk proyek standar tanpa toolchain C++ milik kita sendiri. | Penanganan signing/SmartScreen; ukuran installer besar (Bagian 10.6). |
| Code editor | **Monaco Editor** | Ya | Terbukti, kaya fitur (highlighting, find, folding), mampu offline saat dibundel lokal. | Bundle besar; harus disajikan lokal (bukan dari CDN) untuk memenuhi offline. |
| HTML parser | **parse5** | Ya | Parsing patuh spec, info lokasi source untuk patching surgical. | Harus mempertahankan raw text via offset lokasi; parse5 sendiri tidak round-trip formatting, jadi perlu layer patch. |
| CSS parser | **PostCSS** | Ya | AST dengan preservasi `raws` dan offset source; ekosistem plugin luas. | Fidelitas formatting butuh kehati-hatian; at-rule kompleks butuh penanganan eksplisit. |
| Drag-and-drop | **dnd-kit** | Ya (Phase 4) | Aksesibel, modern, ramah React; bekerja untuk palet dan reorder. | Paritas pointer/keyboard butuh pengujian eksplisit. |
| State management | **Zustand** | Ya | Minimal, non-opinionated, menghindari prop-drilling; baik untuk state editor. | Bukan framework penuh; butuh disiplin agar slice tetap modular. |
| Styling | **Tailwind CSS (opsional)** | Opsional | Design system cepat dan konsisten untuk shell jika diadopsi. | Sertakan hanya jika jelas membantu; harus di-scope agar tidak pernah bocor ke situs yang dipratinjau. |
| Unit / integration testing | **Vitest** | Ya | Cepat, native Vite, ramah TS. | Test sinkronisasi level DOM butuh jsdom/happy-dom plus fixture parser. |
| E2E / app testing | **Playwright** (dukungan Electron) | Ya | Dapat meluncurkan dan mengemudikan aplikasi Electron nyata lintas main/preload/renderer/preview; kuat untuk test lintas alur. | Perilaku level OS (installer, dialog native, SmartScreen) tetap butuh verifikasi manual (Bagian 15). |

### 10.2 Mengapa Electron

UI Astra adalah aplikasi sekelas code editor: pohon React besar (canvas, layer tree, inspector,
explorer), editor Monaco yang tertanam, dan state lokal yang berumur panjang. Electron selaras dengan
bentuk itu:

- **Renderer Chromium:** satu engine yang dapat diprediksi dan mutakhir merender preview proyek
  sekaligus UI aplikasi, terlepas dari webview sistem yang kebetulan terpasang di mesin.
- **Main process Node.js:** API filesystem, proses, dan dialog kelas satu mendukung layanan proyek
  yang terkendali (Bagian 11.6) tanpa bahasa implementasi kedua atau bridge lintas bahasa.
- **Satu bahasa dan ekosistem:** TypeScript di kedua sisi IPC mengurangi bug serialisasi dan menjaga
  satu model dependency (hanya `npm`).
- **Tooling yang matang:** packaging (Electron Forge / electron-builder) dan otomasi (Playwright) sudah
  mapan untuk Electron.

**Trade-off (eksplisit).**

| Dimensi | Konsekuensi Electron | Mitigasi / catatan |
|---|---|---|
| Memori | Setiap renderer adalah proses Chromium; memori idle dan per-view melebihi shell system-webview. | Renderer lebih sedikit dan digunakan ulang; inisialisasi preview secara lazy; unload view yang tidak terpakai; target terukur di `NFR-004` (provisional). |
| Ukuran bundle / distribusi | Membawa runtime Chromium, sehingga installer besar (orde ratusan MB). | Trade-off yang diterima; diukur, bukan dijanjikan (Bagian 10.6, `NFR-018`). |
| Waktu startup | Cold start mencakup inisialisasi Electron/Chromium. | Tunda pekerjaan non-kritis sampai setelah paint pertama; target di `NFR-001` (provisional). |
| Keamanan | Main process sangat kuat; kesalahan konfigurasi dapat mengekspos privilege ke kode proyek. | Pemisahan proses yang ditegakkan dan pengaturan yang diperkeras (Bagian 14); preview diisolasi dari API istimewa. |

Ini adalah **trade-off, bukan cacat**. Semuanya diterima karena Astra adalah tool desktop lokal yang
besar, tempat konsistensi renderer dan kematangan tooling lebih penting daripada biner minimal.
Electron adalah detail implementasi; jaminan local-first, tanpa akun, offline, dan kepemilikan source
(Bagian 2 dan 14) tidak berubah.

### 10.3 Tiga jenis "building" yang berbeda (jangan dicampur)

1. **Pengembangan frontend** - Vite membundel React/TypeScript dan UI aplikasi. Hanya memerlukan
   Node.js dan dependency npm proyek; tanpa compiler native.
2. **Packaging aplikasi** - membundel aplikasi bersama runtime Electron menjadi installer/portable
   Windows. Proyek standar memakai **biner Electron prebuilt** yang diunduh oleh npm/Electron Forge;
   developer **tidak** mengompilasi Electron atau Chromium.
3. **Kompilasi dependency native** - sebagian paket npm adalah addon native C/C++. Jika sebuah paket
   mengirimkan **biner prebuilt untuk ABI Electron/Node target**, tidak ada compiler yang dibutuhkan.
   Jika paket itu harus dibangun dari source (node-gyp), ia mungkin memerlukan **build tool tambahan**,
   yang di Windows dapat mencakup Microsoft C++ Build Tools dan, tergantung dependency-nya, Windows SDK.

> [!important] Catatan akurasi soal toolchain
> Electron **tidak** secara kategoris menghilangkan kebutuhan akan Microsoft C++ Build Tools atau
> Windows SDK. Untuk proyek standar yang dependency-nya mengirim biner prebuilt, keduanya biasanya
> tidak diperlukan. Kebutuhannya sepenuhnya bergantung pada dependency dan konfigurasi build yang
> dipilih. Pernyataan apa pun tentang tool mana yang perlu atau tidak perlu harus dikonfirmasi dengan
> benar-benar mencoba melakukan build di mesin target, jangan pernah diasumsikan.

Set dependency MVP Astra sengaja dipilih untuk menghindari addon native sejauh praktis (Bagian 10.4).
Jika dependency di masa depan memerlukan kompilasi native, biaya itu dievaluasi saat itu.

### 10.4 Library tambahan (masing-masing dengan tanggung jawab yang jelas)

- **File watching:** `fs.watch` bawaan Node untuk root proyek, dengan debouncing dan hash konten
  sebagai sumber kebenaran (event watcher bersifat saran dan bergantung OS; FR-B05). Library seperti
  `chokidar` hanya boleh diadopsi jika `fs.watch` terbukti tidak memadai di Windows; jika diadopsi, ia
  harus dibenarkan dan diaudit.
- **Hashing:** `node:crypto` bawaan Node (mis. SHA-256) untuk hash konten yang dipakai di logika
  sync/konflik.
- **Diffing:** library diff JS yang kecil (mis. `diff`) untuk tampilan Compare (FR-G04).
- **Sanitasi HTML (hanya UI Astra sendiri):** sanitizer yang terverifikasi seperti DOMPurify untuk
  setiap tempat Astra menyuntikkan string tak terpercaya ke UI Astra **sendiri**; ini pertahanan
  berlapis dan bukan pengganti sandboxing preview.
- **Database:** **Tidak ada.** Tidak ada requirement yang membenarkannya. State proyek hidup di file;
  pengaturan aplikasi hidup di file config kecil (`ASM-002`).

### 10.5 Alur kerja pengembangan dan build (Windows)

Proposal skrip npm. Nama-nama ini adalah usulan; tooling yang dipilih harus mendukungnya dan perilaku
aktualnya harus didefinisikan setelah scaffold difinalisasi.

| Skrip | Tujuan | Catatan |
|---|---|---|
| `npm run dev` | Meluncurkan Electron dalam mode pengembangan dengan dev server Vite dan HMR renderer. | Tidak melakukan packaging. |
| `npm run build` | Type-check dan build bundle frontend (renderer + main + preload). | Menghasilkan output build, bukan installer. |
| `npm run package` | Melakukan packaging aplikasi ke direktori (unpacked) yang dapat dijalankan. | Electron Forge `package` / electron-builder `--dir`. |
| `npm run make` | Menghasilkan distributable Windows: installer dan/atau portable (Bagian 10.6). | Electron Forge `make` / electron-builder `--win`. |
| `npm test` / `npm run test:e2e` | Test unit/integrasi dan end-to-end (Bagian 15). | |
| `npm run lint` / `npm run typecheck` | Pemeriksaan statis. | |

Tahapan berurutan: **develop -> build frontend -> package -> make installer -> sign/publish.** Seorang
developer dapat menjalankan dan menguji aplikasi hanya dengan Node.js terpasang; menghasilkan installer
adalah langkah terpisah yang mungkin juga mengunduh tool packaging.

**CI (opsional).** Workflow GitHub Actions (runner Windows) dapat melakukan lint, test, package, dan
publish artefak Windows. Runner Windows terhosting menyediakan build tooling tanpa mengharuskan
developer memasang toolchain lengkap secara lokal, tetapi ini **bukan jaminan** bahwa setiap dependency
native akan ter-build tanpa tool tambahan. CI **tidak wajib untuk MVP**; ia menjadi berharga setelah
packaging dan rilis stabil.

### 10.6 Packaging, update, dan distribusi

- **Target:** Windows x64, dipaket dengan Electron Forge atau electron-builder.
- **Opsi distribusi:** installer (mis. NSIS atau Squirrel) dan, jika didukung, build portable. Set
  persisnya menjadi keputusan terbuka setelah tool packaging ditetapkan.
- **Versioning:** versi aplikasi dilacak di `package.json` dan ditampilkan di UI About.
- **Artefak rilis:** installer/portable plus manifes checksum. Jangan publikasikan ukuran yang
  dijanjikan sampai diukur (Bagian 10.3; estimasi tidak boleh menjadi janji).
- **Code signing:** diinginkan untuk mengurangi friksi SmartScreen; memerlukan sertifikat dan
  merupakan pertanyaan terbuka (`OQ-011`). Build unsigned harus didokumentasikan sebagai demikian.
- **Update:** auto-update (mis. via `electron-updater`) bersifat **opsional dan opt-in**; ia harus
  dijelaskan bersama implikasi keamanannya (verifikasi signature, integritas transport) dan tidak boleh
  pernah menjadi egress tersembunyi yang merusak postur local-first (FR-K03, SEC-010, SEC-021).
- **Manajemen dependency / kerentanan:** dependency minimal ter-pin, `npm audit` (dan, jika relevan,
  `npm audit signatures`) di CI, review sebelum menambah dependency, dan tanpa pemuatan aset remote
  (Bagian 14).
- **Operasi offline:** setelah instalasi aplikasi harus berjalan sepenuhnya offline; tidak ada alur
  inti yang boleh memerlukan akses jaringan (FR-K01, FR-K06).

### 10.7 Architecture Decision Record

**ADR-001 - Framework desktop: Electron**

- **Decision:** Electron adalah framework desktop yang disetujui untuk Astra.
- **Status:** Accepted.
- **Context:** Tim mengevaluasi opsi implementasi desktop untuk designer web visual local-first dan
  memilih Electron, menyelaraskan aplikasi desktop dengan ekosistem TypeScript/React dan mengurangi
  ketergantungan pada alur kerja pengembangan khusus Rust.
- **Rationale:** keselarasan ekosistem JavaScript/TypeScript, integrasi React yang lugas, kemampuan
  desktop yang matang (jendela, dialog, filesystem, packaging), dan model dependency serta tooling yang
  seragam.
- **Trade-offs:** ukuran distribusi aplikasi yang lebih besar dan potensi penggunaan memori yang lebih
  tinggi dibanding alternatif system-webview yang lebih ringan.
- **Consequences:** pemisahan main/preload/renderer, persyaratan keamanan khusus Electron (Bagian 14),
  dan alur kerja packaging serta testing berbasis Electron (Bagian 10.5, 10.6, 15).
- **Reconsideration criteria:** tinjau ulang framework hanya jika persyaratan performa, keamanan,
  pemeliharaan, atau distribusi yang terukur tidak dapat dipenuhi secara wajar (`OQ-013` mencakup
  pertanyaan tooling E2E). Tidak ada studi benchmark formal yang dilakukan untuk mencapai keputusan ini.

---

## 11. Arsitektur Sistem

### 11.1 Peta modul (17 modul yang diminta)

| # | Modul | Tanggung jawab | Bergantung pada |
|---|---|---|---|
| 1 | Desktop Shell | Electron main process: siklus hidup jendela, menu, permukaan IPC, validasi IPC, settings. | OS, Electron |
| 2 | Project Manager | Buka/tutup proyek, deteksi entri, project graph (halaman ↔ aset), daftar recent. | 3 Filesystem Adapter |
| 3 | Filesystem Adapter | Baca/tulis/list/watch ter-scope, hashing, penulisan atomik, backup, pemetaan error. | Node fs (main process), watcher |
| 4 | HTML Parser | Parse HTML ke AST dengan source anchor; emit ulang rentang; laporkan isu sintaks. | parse5 |
| 5 | CSS Parser | Parse CSS ke AST dengan raws/source; media query; input cascade. | PostCSS |
| 6 | Internal Document Model | Proyeksi ter-address dan dapat didiff; identitas node; operasi edit; pelacakan dirty. | 4, 5 |
| 7 | Visual Canvas | Host render ter-sandbox, injeksi overlay, pembingkaian viewport. | 1, 3, 12 |
| 8 | Selection & Layer Tree | State seleksi, hover, breadcrumb, virtualisasi tree, sinkronisasi canvas↔tree. | 6, 7 |
| 9 | Drag-and-Drop Engine | Sumber/target drag, hook validasi, indikator penyisipan, reorder. | 6, 8 |
| 10 | Property Inspector | Editing berbasis schema; pembacaan computed style; atribusi origin. | 6, 8 |
| 11 | Code Editor | Host Monaco, layanan bahasa, find/replace, marker. | 6 |
| 12 | Synchronization Engine | Diff source↔model, generate/apply patch, penanganan konflik, pencegahan loop. | 3, 4, 5, 6 |
| 13 | Undo/Redo History | Command stack dengan patch invers; penggabungan; scoping per file. | 6, 12 |
| 14 | Responsive Preview | Preset viewport, kontrol ukuran, komputasi breakpoint aktif. | 7, 5 |
| 15 | Component Manager | Palet, definisi/referensi komponen (P1). | 6, 12 |
| 16 | Design Token Manager | Penemuan token (MVP), editing token (P1). | 5, 6 |
| 17 | Accessibility Analyzer | Pengecekan saran atas model; daftar temuan. | 6 |

### 11.2 Arsitektur proses aplikasi (Electron)

Electron menjalankan beberapa proses. Astra memberi masing-masing tingkat kepercayaan dan permukaan
API yang jelas.

| Layer | Proses | Kepercayaan | Tanggung jawab | Tidak boleh |
|---|---|---|---|---|
| Main | Electron main (Node.js) | Istimewa / terpercaya | Siklus hidup aplikasi, manajemen jendela dan menu, dialog native, pelacakan project root, layanan filesystem yang terkendali, validasi permintaan IPC, settings. | Merender konten proyek yang tidak terpercaya. |
| Preload | Preload per-renderer | Bridge terpercaya, minimal | Mengekspos API kecil, eksplisit, dan bertipe via `contextBridge`; menerjemahkan panggilan hanya ke channel IPC yang sudah diverifikasi. | Mengekspos `ipcRenderer`, `require`, `process`, atau nama channel arbitrer. |
| Renderer (UI) | Chromium renderer | Terpercaya (UI Astra sendiri) | UI React: host canvas, layer tree, inspector, explorer, Monaco, state (Zustand). | Menerima API Node. Berjalan dengan `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. |
| Preview | Renderer terisolasi / view bersarang | **Tidak terpercaya** | Merender HTML/CSS/JS proyek pengguna. | Mengakses IPC/preload/main, bernavigasi bebas, membuka jendela, atau menyentuh filesystem. |

```text
  +--------------------------------------------------------------+
  |                   Electron Main (Node.js)                    |
  |  lifecycle | windows | menus | dialogs | settings            |
  |  filesystem service (scoped)   |   IPC request validation    |
  +-------------------^-----------------------------^------------+
                      |  ipcMain.handle (validated) |
        +-------------+--------------+              |
        |                            |              |
  +-----v-------------+   +----------v-----------+  |
  |  Preload (UI)     |   |  Preload (Preview)   |  |
  |  contextBridge    |   |  minimal / none      |  |
  +-----^-------------+   +----------^-----------+  |
        |                            |              |
  +-----v-------------+   +----------v-----------+  |
  |  Renderer: Astra  |   |  Preview renderer    |  |
  |  UI (React)       |   |  (untrusted project) |  |
  +-------------------+   +----------------------+  |
        ^                                            |
        |  validated postMessage (selection/overlay) |
        +--------------------------------------------+
```

Batas kepercayaan:

1. **Main <-> Renderer** (istimewa vs UI): setiap pesan yang menyeberang ke main divalidasi (allowlist
   channel, schema payload, containment project root).
2. **UI Astra <-> Preview** (UI terpercaya vs proyek tidak terpercaya): komunikasi memakai protokol
   postMessage tervalidasi dan terversi; preview tidak menerima channel istimewa.
3. **App <-> Filesystem:** hanya layanan filesystem di main process yang menyentuh disk, ter-scope ke
   root proyek aktif (Bagian 11.6).
4. **App <-> Network:** mati secara default untuk sumber daya proyek (FR-K04); tanpa egress di jalur inti.

### 11.3 Arah dependency berlapis

```text
            +---------------------------------------------------+
            |                    Desktop Shell (1)              |
            +---------------------------------------------------+
                 |            |             |            |
        +--------v---+  +-----v------+ +----v-----+ +----v------+
        | Project Mgr|  |  Canvas(7) | | Code Ed. | | Inspector |
        |    (2)     |  |  + Sel(8)  | |  (11)    | |   (10)    |
        +-----+------+  |  + DnD(9)  | +----+-----+ +----+------+
              |         |  + Resp(14)|      |            |
        +-----v---------v------------v------v------------v------+
        |                Internal Document Model (6)             |
        +-----+--------------------+--------------------+-------+
              |                    |                    |
     +--------v-------+  +---------v--------+  +--------v--------+
     | HTML Parser (4)|  | CSS Parser (5)   |  | History (13)    |
     +--------+-------+  +---------+--------+  +--------+--------+
              |                    |                    |
              +----------+---------+--------------------+
                         |
              +----------v-----------+
              | Synchronization (12) |
              +----------+-----------+
                         |
              +----------v-----------+
              | Filesystem Adapter(3)|
              +----------+-----------+
                         |
                  File proyek nyata (disk)

  Modul samping: Components(15), Tokens(16), A11y(17) mengamati model;
  Responsive Preview(14) mengemudikan viewport Canvas(7).
```

Dependency mengarah **ke bawah dan ke dalam** (UI -> model -> parser/sync -> filesystem).
Tidak ada modul inti yang bergantung pada modul UI. Ini menjaga parser dan sync tetap dapat diuji
secara terisolasi.

### 11.4 Aliran data

**Jalur baca (buka proyek):**

```text
Pilih folder -> FS Adapter mendaftar file -> Project Manager memilih entri
  -> HTML Parser + CSS Parser -> Document Model
  -> Canvas memuat preview ter-sandbox dari file (via protokol ter-scope)
  -> Selection/Layer Tree dan Inspector terhidrasi dari model
```

**Jalur edit visual:**

```text
Inspector/DnD -> mutasi Model (operasi) -> update canvas sementara
  -> Sync Engine menghitung patch source minimal -> menerapkan ke buffer source
  -> Code editor mencerminkan source baru -> debounce Autosave -> tulis atomik + backup
```

**Jalur edit source:**

```text
Perubahan Code Editor -> parse ter-debounce -> update Model
  -> Sync Engine mengonfirmasi origin mandiri (tanpa konflik eksternal) -> re-render Canvas
```

**Jalur perubahan eksternal:**

```text
Event watcher -> FS Adapter me-hash file -> bandingkan dengan hash terakhir diketahui
  -> dokumen bersih: reload (update hash)
  -> dokumen kotor: prompt konflik (tanpa auto-write)
```

### 11.5 Strategi penanganan error

- **Tidak pernah destruktif saat error:** kegagalan parser, kegagalan save, dan konflik harus
  meninggalkan file di disk tetap valid dan buffer di memori dapat dipulihkan.
- **Error bertipe dan dipetakan:** Error FS -> kategori menghadap pengguna (not-found, permission,
  locked, disk-full, path-invalid). Error parse -> diagnostik terstruktur dengan rentang.
- **Batas:** setiap modul mengembalikan hasil bergaya `Result`/`Result<T,E>`; UI merender permukaan error
  yang konsisten (toast untuk transien, banner untuk persisten, dialog untuk keputusan).
- **Fallback:** gagal parse -> pertahankan render terakhir yang baik; gagal save -> pertahankan buffer
  kotor dan tawarkan retry/Save-As; konstruksi tidak didukung -> read-only, tidak pernah tulis ulang.

### 11.6 Filesystem dan manajemen proyek (main process Electron)

Renderer tidak pernah menyentuh filesystem secara langsung. Semua akses disk adalah **layanan
terkendali di main process Electron**, yang dipanggil lewat IPC yang tervalidasi.

- **Pemilihan folder:** dialog native (gestur pengguna) menghasilkan sebuah **project root**.
- **Pelacakan project root:** main process menyimpan root kanonik dan mengeluarkan handle proyek; setiap
  operasi memerlukan handle itu.
- **Operasi yang di-allowlist:** read, list, stat, watch, write, create, rename, delete - masing-masing
  handler IPC bernama dan bertipe. Tidak ada channel generik "baca path apa pun", "tulis path apa pun",
  atau "exec".
- **Penanganan path yang aman:** kanonikalisasi setiap path; verifikasi containment di dalam project
  root; tolak traversal `..`, escape symlink, dan nama non-UTF-8/aneh dengan mulus.
- **Batas:** tegakkan batas ukuran file dan operasi yang wajar; tolak membuka atau menimpa di luar batas itu.
- **Save atomik / dapat dipulihkan:** tulis ke file temp di direktori yang sama, fsync, rename atomik
  menimpa target, dan catat backup di `.astra/backups/` (FR-G08). Jika gagal, file asli tetap utuh.
- **File yang diubah / dipindah / dihapus di luar:** dideteksi via watcher + hash konten dan
  direkonsiliasi sesuai FR-B05/FR-G02 (reload bersih vs. prompt konflik); tidak pernah ditimpa secara senyap.
- **Operasi destruktif:** memerlukan konfirmasi eksplisit; tidak ada yang dihapus secara senyap.
- **Preview:** menerima **tanpa** kemampuan filesystem; aset proyek sampai ke sana hanya via mekanisme
  read-only yang ter-scope (Bagian 11.7).
- `.astra/` hanya menyimpan metadata non-esensial dan tetap opsional untuk validitas proyek.

### 11.7 Strategi isolasi preview (lihat juga Bagian 14)

Preview merender kode proyek yang tidak terpercaya dan harus dipisahkan dari API istimewa.

- **Renderer terpisah, konteks terpisah:** preview berjalan di **renderer Electron-nya sendiri**
  (`BrowserWindow`/`WebContentsView` khusus), bukan di renderer UI Astra dan bukan di main process. Ia
  dimuat dengan `nodeIntegration: false`, `contextIsolation: true`, dan `sandbox: true`, serta **tanpa
  preload bridge** (atau bridge yang tidak mengekspos apa pun yang istimewa).
- **Tanpa IPC istimewa:** preview tidak punya akses ke `ipcRenderer`/`ipcMain`, tidak punya handle
  proyek, dan tidak punya channel filesystem. Pesan apa pun yang dikirim Astra bersifat satu arah atau
  divalidasi secara ketat.
- **Pengiriman aset via mekanisme read-only yang ter-scope:** file proyek disajikan melalui protokol
  kustom (atau skema read-only setara yang berakar pada direktori proyek) sehingga escape `../` tidak
  mungkin di layer transport; preview tidak dapat membaca path arbitrer.
- **Pembatasan navigasi dan jendela:** blokir navigasi dalam halaman menjauh dari origin yang
  disajikan, tolak `window.open` dan permintaan jendela baru, dan tolak URL eksternal yang tak terduga.
  Sumber daya eksternal mengikuti kebijakan FR-K04 (diblokir secara default).
- **CSP:** terapkan Content Security Policy yang ketat pada dokumen preview; eksekusi script hanya
  diizinkan untuk script milik proyek sendiri sejauh diperlukan untuk rendering yang setia.
- **Channel overlay/seleksi:** Astra menggambar outline seleksi dan menerima data inspeksi via
  **protokol postMessage tervalidasi dan terversi** (shape pesan, sumber, dan origin dicek; pesan tak
  dikenal diabaikan). Protokol dirancang agar proyek yang jahat tidak dapat memalsukan pesan UI Astra
  melintasi batas kepercayaan.
- **Justifikasi (mengapa bukan sekadar "iframe"):** iframe ter-sandbox (`sandbox="allow-scripts"` tanpa
  `allow-same-origin`) adalah mekanisme kontainmen yang layak dan dapat dipakai di tempat yang cocok.
  Renderer Electron terpisah lebih disukai untuk Astra karena memberi isolasi tingkat proses, kebijakan
  CSP/navigasi yang independen, dan batas bersih yang dapat disasar test escape. Pilihan akhir dicatat
  sebagai pertanyaan terbuka (`OQ-015`) dan harus divalidasi oleh test escape (`TEST-017`, `TEST-018`),
  tidak pernah diasumsikan aman.

### 11.8 Batas pengujian

- Proyek tingkat repo (`fixtures/`) dengan HTML/CSS/JS sintetis untuk setiap kasus tepi.
- Modul parser dan Sync bersifat murni dan diuji tanpa aplikasi berjalan.
- FS Adapter diuji di main process terhadap direktori temporer (dan fault-injected).
- Handler IPC main process dan API preload diuji unit/integrasi secara terisolasi.
- UI diuji tingkat komponen; journey penuh dijalankan sebagai E2E Electron dengan Playwright (Bagian 15).

### 11.9 Modul yang dapat dikembangkan secara independen

Ini dapat dibangun dan diuji secara paralel setelah antarmuka dipatok:
parser (4,5), sync (12), history (13), FS adapter (3), analyzer (17), penemuan token (16).
Canvas (7), selection (8), DnD (9), dan inspector (10) berbagi model dan lebih terikat;
mereka berjalan setelah antarmuka model stabil.

---

## 12. Definisi MVP

MVP sengaja dibuat sebagai **produk terkecil yang membuktikan loop inti**:
`buka proyek nyata -> render -> pilih -> edit -> tulis kembali ke file nyata -> verifikasi di browser`.

### 12.1 Dalam cakupan (MVP)

| Area | Termasuk |
|---|---|
| Desktop shell | Jendela, menu, buka/tutup proyek, settings (dasar), build Windows terkemas. |
| Explorer | Buka folder, daftar file, buka HTML/CSS/JS di code editor, deteksi perubahan eksternal, penanganan aman file hilang. |
| Canvas | Render situs nyata di preview ter-sandbox, klik-pilih, outline seleksi, sinkronisasi seleksi↔layer (tree dasar). |
| Inspector | Edit teks + atribut yang didukung; edit CSS umum (tipografi, warna/background, spacing, border, dimensi); manajemen class; menampilkan rule asal; editing responsive untuk tiga preset. |
| Code editor | HTML/CSS/JS dengan highlighting, find/replace, marker, save/reload, tercermin di preview. |
| Sync engine | Parse dengan anchor, write-back patch minimal, save atomik + backup, prompt konflik, pencegahan loop, preservasi formatting/komentar, undo/redo satu langkah untuk model+source. |
| Responsive | Tiga preset, media query nyata, indikasi breakpoint aktif. |
| A11y | Saran: alt text, nama aksesibel, label form (FR-J01..03). |
| Local-first | Offline, tanpa akun, tanpa telemetri, kebijakan sumber daya eksternal (blokir dulu). |
| Komponen | **Palet terkurasi kecil yang dapat di-drag** (beberapa blok semantik) yang cukup untuk membuktikan insert/reorder/move via DnD (FR-D adalah P0 dalam bentuk dasar). |
| Token | Tampilan read-only CSS custom property yang ada di inspector. |

### 12.2 Ditunda (secara eksplisit tidak di MVP)

- Authoring/referensi komponen penuh (FR-I01), editing token (FR-I02/I04), library komponen besar.
- Editor visual Flexbox/Grid penuh (FR-E05) dan editing cascade lanjutan.
- Pencarian seluruh proyek (FR-F02 P1), kesadaran multi-entri (FR-G11).
- Durabilitas pemulihan crash melampaui best-effort (FR-A04b P1) - usahakan sertakan versi minimal.
- Pengecekan aksesibilitas di luar J01-J03.
- Fitur AI apa pun (FR-L*).

### 12.3 Pengecualian eksplisit (sepenuhnya di luar cakupan untuk saat ini)

Akun, sinkronisasi cloud, kolaborasi, publishing/hosting, pengganti Figma, editing spesifik framework,
runtime proprietary, CMS/database, pembayaran, plugin marketplace.

### 12.4 Dependencies (MVP)

- Bukti Phase 0 bahwa write-back surgical mempertahankan formatting (jika tidak, tesis gagal).
- Antarmuka model yang stabil + strategi source anchor.
- Preview sandbox terbukti mengisolasi kode tak terpercaya.
- Primitif penulisan atomik + backup di main process Electron (Node.js).
- Set komponen terkurasi yang memetakan ke markup semantik bersih.

### 12.5 Risiko MVP utama

Lihat Bagian 17. Risiko dominan adalah `RISK-001` (korupsi sync/patch) dan `RISK-002` (escape preview
sandbox), keduanya gerbang Phase 0.

### 12.6 Uji penerimaan MVP

Lihat Bagian 19 (`AC-###`). Gerbang end-to-end adalah `AC-010`: proyek yang diedit secara visual di Astra
lalu dibuka di browser biasa (dan diinspeksi di code editor / git diff biasa) menunjukkan perubahan yang
diharapkan dan tidak ada yang lain.

### 12.7 Estimasi usaha (provisional, sarat asumsi)

**Asumsi:** satu developer full-stack berpengalaman (TS/Node kuat) bekerja solo, atau tim dua
orang untuk sekitar setengah waktu kalender; familiar dengan Electron/Monaco/parse5/PostCSS.

| Workstream | Estimasi solo (dev-hari) | Catatan |
|---|---|---|
| Prototipe Phase 0 (parse/patch/round-trip, sandbox) | 8-15 | Ketidakpastian tertinggi; bisa lebih |
| Shell + build + installer | 6-10 | Electron packaging + unknown CI signing |
| FS adapter + watcher + penulisan atomik | 6-10 | Berat di main process (Node) |
| Model + parser + addressing | 8-15 | Inti |
| Canvas + sandbox + selection/layer tree | 8-15 | Overlay/protokol rumit |
| Inspector (editing berbasis schema) | 8-15 | Keluasan properti |
| Integrasi code editor | 4-8 | Bundling Monaco offline |
| Sync engine (patch/konflik/undo) | 15-25 | Risiko inti; tumpang tindih dengan Phase 0 |
| Responsive + editing breakpoint | 5-10 | Bergantung pada editing CSS |
| DnD dasar + palet | 6-12 | Validasi + indikator |
| A11y saran (3 pengecekan) | 4-8 | Heuristik |
| Test, fixture, hardening | 10-20 | Berkelanjutan |
| **Total (kasar)** | **~90-160 dev-hari** | Rentang optimistis-sampai-realistis; bukan jaminan |

**Pernyataan ketidakpastian:** estimasi ini bukan komitmen. Hasil Phase 0 dapat menggesernya dengan
margin lebar, terutama jika write-back surgical terbukti lebih sulit dari asumsi.

### 12.8 Definition of Done (MVP)

Lihat Bagian 20 (`DoD-###`).

---

## 13. Roadmap Produk

Roadmap memprioritaskan **validasi teknis sync engine HTML/CSS** sebelum investasi UI yang luas.

### Phase 0 - Validasi teknis dan prototipe arsitektur (gerbang untuk semua)
- **Deliverables:** (a) prototipe parser+patch yang membuktikan round-trip byte-preserving pada fixture
  HTML/CSS berantakan; (b) prototipe sandbox yang membuktikan preview tidak dapat menjangkau perintah
  desktop; (c) primitif penulisan atomik + backup; (d) proposal model/addressing yang terdokumentasi.
- **Prasyarat:** Scaffold repo, kerangka CI.
- **Acceptance:** Suite test round-trip lulus pada korpus fixture (termasuk HTML malformed, komentar,
  formatting eksotis); upaya escape yang disengaja dari preview gagal; penulisan atomik bertahan dari
  fault injection.
- **Risiko:** Fidelitas preservasi (`RISK-001`), asumsi sandbox (`RISK-002`).
- **Testing:** Fixture parser, test round-trip/preservasi, test escape sandbox, fault injection.
- **Exit:** Go/no-go tertulis dengan bukti. No-go memicu desain ulang strategi sync.

### Phase 1 - Fondasi desktop dan pemuatan proyek
- **Deliverables:** Shell Electron (jendela, menu, settings), layanan FS main process + watcher, explorer, project manager
  + deteksi entri, build terkemas.
- **Prasyarat:** Exit Phase 0.
- **Acceptance:** Buka/tutup folder nyata; file terdaftar; perubahan eksternal terdeteksi; file hilang
  ditangani; installer berjalan offline.
- **Risiko:** Packaging/signing Windows; keandalan watcher.
- **Testing:** Test integrasi FS, E2E buka-proyek, run installer manual.
- **Exit:** Pengguna dapat membuka folder proyek dan menelusuri file dengan andal.

### Phase 2 - Canvas dan editing visual dasar
- **Deliverables:** Canvas ter-sandbox merender CSS/JS nyata; klik-pilih; outline seleksi; layer tree
  dasar; tampilan origin inspector read-only.
- **Prasyarat:** Phase 1.
- **Acceptance:** Paritas render dengan file yang sama di browser untuk fitur yang didukung; sinkronisasi
  seleksi bekerja dua arah; elemen tidak didukung read-only dan dipertahankan.
- **Risiko:** Ketidakcocokan preview/build; kebocoran style overlay.
- **Testing:** Snapshot paritas render, E2E seleksi, test sandbox.
- **Exit:** Pengguna dapat melihat dan menginspeksi situs nyatanya.

### Phase 3 - Sinkronisasi source dan penyimpanan aman
- **Deliverables:** Editing properti (teks/atribut/CSS umum) menulis ke source via patch minimal; save
  atomik + backup; prompt konflik; pencegahan loop; undo/redo lintas model+source; code editor terhubung
  ke model yang sama.
- **Prasyarat:** Phase 2, prototipe Phase 0 yang diperkuat.
- **Acceptance:** Setiap edit yang didukung menghasilkan tepat satu penulisan ter-debounce, atomik, dan
  byte-preserving; konflik eksternal tidak pernah menimpa secara senyap; undo/redo memulihkan source.
- **Risiko:** `RISK-001`, race konflik (`RISK-006`).
- **Testing:** Suite preservasi, konflik, rapid-edit, undo/redo, failed-save.
- **Exit:** Loop inti MVP bekerja end-to-end (`AC-010`).

### Phase 4 - Drag-and-drop dan editing responsive
- **Deliverables:** Palet terkurasi yang dapat di-drag; insert/move/reorder dengan indikator dan validasi;
  preset responsive dengan editing sadar media query; UI breakpoint aktif.
- **Prasyarat:** Phase 3.
- **Acceptance:** Operasi DnD adalah langkah undo tunggal dengan markup yang benar; edit responsive masuk
  ke media query yang benar; drop tidak valid ditolak dengan pesan.
- **Risiko:** Presisi DnD, kelengkapan validasi, inferensi breakpoint.
- **Testing:** E2E DnD, unit test validasi, E2E responsive.
- **Exit:** Konstruksi layout sederhana secara visual andal.

### Phase 5 - Komponen, design token, aksesibilitas
- **Deliverables:** Komponen yang dapat digunakan ulang buatan pengguna (penyimpanan portabel);
  manajemen token; perluasan analyzer aksesibilitas (heading, kontras, saran keyboard).
- **Prasyarat:** Phase 4.
- **Acceptance:** Komponen memperbarui semua referensi dan tetap bisa dibuka di browser tanpa Astra;
  token berlaku seluruh proyek; temuan a11y bersifat saran dan tidak pernah diterapkan otomatis.
- **Risiko:** Desain format penyimpanan (`OQ-010`), scope creep.
- **Testing:** Test komponen/referensi, test token, test aturan a11y.
- **Exit:** Fitur design-system dapat digunakan tanpa merusak portabilitas.

### Phase 6 - AI lokal opsional dan fitur lanjutan
- **Deliverables:** Adapter provider (model lokal via Ollama, opsional hosted), aksi AI berbasis diff
  yang dapat direview, editor layout lanjutan, build non-Windows.
- **Prasyarat:** Phase 5.
- **Acceptance:** Semua aksi AI memerlukan persetujuan eksplisit; tanpa eksekusi shell; menonaktifkan AI
  membuat produk tetap berfungsi penuh.
- **Risiko:** Privasi, biaya, non-determinisme.
- **Testing:** Test gerbang persetujuan, test adapter provider, test offline-dengan-AI-mati.
- **Exit:** AI bersifat aditif dan dapat direview.

---

## 14. Keamanan dan Privasi

Threat model Astra mengasumsikan **file proyek tidak terpercaya**. Membuka proyek tidak boleh pernah
memberi privilege proyek itu atas mesin.

### 14.1 Aset dan batas kepercayaan

- **Terpercaya:** kode Astra sendiri, dependency yang dibundel, UI jendela utama.
- **Tidak terpercaya:** HTML/CSS/JS proyek, sumber daya remote yang direferensikan proyek, JSON
  komponen/token yang diimpor, dan teks eksternal apa pun.
- **Batas 1:** renderer UI Astra vs. renderer preview (batas terkuat); main process adalah satu-satunya
  konteks istimewa.
- **Batas 2:** aplikasi vs. filesystem (ter-scope ke root proyek).
- **Batas 3:** aplikasi vs. jaringan (mati secara default untuk sumber daya proyek; tanpa egress di inti).

### 14.2 Ancaman dan mitigasi

| ID | Ancaman | Mitigasi |
|---|---|---|
| SEC-001 | File proyek berbahaya (HTML/CSS/JS) dieksekusi di konteks aplikasi dan memanggil IPC istimewa. | Kode proyek hanya dimuat di renderer preview yang terisolasi (Bagian 11.7) dengan `nodeIntegration: false`, `contextIsolation: true`, dan tanpa preload/IPC istimewa; kode proyek tidak pernah dieksekusi di renderer UI Astra atau di main process. Test escape (`TEST-017`, `TEST-028`) menjadi gerbangnya. |
| SEC-002 | JS preview menjangkau UI Astra atau main process dan mencuri data atau menaikkan privilege. | Renderer preview terpisah tanpa DOM bersama dan tanpa bridge istimewa; postMessage tervalidasi dan terversi hanya untuk inspeksi; navigasi/jendela baru ditolak. Test escape (`TEST-017`, `TEST-029`). |
| SEC-003 | Akses filesystem lolos dari root proyek. | Permukaan fs hanya via perintah; kanonikalisasi + cek prefix; tolak `..` dan escape symlink; protokol kustom ter-scope untuk aset preview. |
| SEC-004 | Path traversal via referensi aset atau nama file yang dibuat khusus. | Normalisasi dan validasi setiap path terhadap root; tolak nama yang aneh/non-UTF-8 dengan mulus. |
| SEC-005 | Pemuatan sumber daya eksternal membocorkan data atau menjalankan script remote. | CSP pada preview; kebijakan default memblokir sumber daya remote; opt-in eksplisit dengan indikator terlihat; tidak pernah fetch senyap. |
| SEC-006 | Kerentanan dependency. | Dependency minimal ter-pin; `npm audit` (dan `npm audit signatures` jika relevan) di CI; review sebelum menambah dep; bundel aset lokal (tanpa CDN). |
| SEC-007 | Korupsi kode sumber tak sengaja oleh patching yang buggy. | Patch rentang surgical + test preservasi; penulisan atomik; backup di `.astra/backups/`; validasi re-parse sebelum commit; tidak menulis jika post-check gagal. |
| SEC-008 | Modifikasi eksternal yang berkonflik menyebabkan kehilangan data. | Deteksi perubahan berbasis hash; prompt konflik; tidak ada penimpaan otomatis saat kedua sisi berubah; tampilan compare sebelum berkomitmen. |
| SEC-009 | Kode hasil AI memperkenalkan kerentanan atau menerapkan perubahan yang tidak diinginkan. | AI opt-in dan review-only: perubahan ditampilkan sebagai diff, diterapkan atas persetujuan; tanpa eksekusi shell; adapter provider adalah satu-satunya egress dan dikonfigurasi pengguna. |
| SEC-010 | Kebocoran telemetri/privasi. | Tanpa telemetri secara default; diagnostik hanya lokal; ekspor opt-in; test capture jaringan menegaskan tidak ada egress. |
| SEC-011 | Data impor berbahaya (JSON komponen/token). | Validasi schema pada impor; tolak struktur tak dikenal/terlalu besar; perlakukan string yang diimpor sebagai teks, tidak pernah `eval`; tidak pernah menjalankan template yang diimpor. |
| SEC-012 | `eval`/eksekusi kode dinamis atas konten proyek di dalam Astra. | Larangan eksplisit: Astra tidak pernah `eval` kode proyek; rendering terjadi hanya di preview yang terisolasi. |
| SEC-013 | Escape symlink dari root proyek. | Resolve symlink (kanonikalisasi) dan cek ulang containment; secara opsional menolak mengikuti symlink di luar root. |
| SEC-014 | Kehilangan data saat save terputus. | Temp-file + fsync + rename atomik; test fault-injection `NFR-007`. |
| SEC-015 | Konfigurasi renderer yang tidak aman merosot selama pengembangan. | Tegakkan dan uji `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true` untuk renderer UI dan preview; konfigurasi efektif diassert oleh test otomatis (`TEST-028`). |
| SEC-016 | Payload IPC tidak divalidasi; renderer mengirim input palsu. | Validasi setiap payload IPC di main process (allowlist channel, schema, tipe, handle proyek, containment path); tolak channel tak dikenal; jangan pernah memercayai path yang dipasok renderer (`TEST-027`). |
| SEC-017 | Preload mengekspos terlalu banyak ke renderer. | Hanya API `contextBridge` yang di-allowlist dan bertipe; jangan pernah mengekspos `ipcRenderer`, `require`, `process`, nama channel dinamis, atau bawaan Node (`TEST-030`). |
| SEC-018 | Navigasi tak terduga, jendela baru, atau prompt izin OS. | Tolak permintaan `will-navigate`/jendela baru yang tak terduga; tolak permintaan izin OS secara default; buka tautan eksternal hanya lewat handler eksplisit yang dikonfirmasi pengguna (`TEST-029`). |
| SEC-019 | Eksekusi shell/proses arbitrer dari konten renderer. | Tidak ada jalur renderer yang dapat menjalankan proses atau perintah shell; main process tidak mengekspos channel semacam itu; preview sama sekali tidak punya akses proses. |
| SEC-020 | File proyek yang malformed atau berbahaya membuat parser crash atau dieksploitasi. | Perlakukan semua konten proyek sebagai tidak terpercaya; batasi input parser; gagal dengan aman (read-only / render terakhir yang baik) alih-alih crash; fixture malformed dan berbahaya ada di test (`TEST-033`). |
| SEC-021 | Channel auto-update yang tidak aman. | Update bersifat opt-in, terverifikasi signature, dan dikirim via TLS; channel update yang dikompromikan tidak boleh memasang kode secara senyap; mati secara default (Bagian 10.6). |
| SEC-022 | Postur local-first/privasi merosot karena egress tersembunyi. | Tanpa telemetri; tanpa egress di jalur inti; egress hanya via fitur eksplisit yang dikonfigurasi pengguna; diverifikasi oleh test capture jaringan (`TEST-021`). |

### 14.3 Ringkasan pemisahan permission

| Capability | Main process | Renderer UI Astra | Renderer preview |
|---|---|---|---|
| IPC istimewa (filesystem, dialog) | Ya (tervalidasi, ter-allowlist) | Hanya via bridge preload yang sempit | **Tidak** |
| API Node.js | Ya | **Tidak** (`nodeIntegration: false`) | **Tidak** |
| Baca file proyek | Ya (ter-scope) | Via IPC main process | Read-only via protokol ter-scope |
| Tulis file proyek | Ya (ter-scope, atomik) | Via IPC main process | **Tidak** |
| Egress jaringan | Diatur kebijakan | Diblokir secara default | Diatur kebijakan FR-K04/CSP |
| Akses API OS | Ya (dialog, jendela) | Minimal (kontrol jendela) | **Tidak** |

### 14.4 Persyaratan hardening Electron (normatif)

Pengaturan ini wajib untuk renderer UI dan preview kecuali ada pengecualian yang disetujui dan
didokumentasikan:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` (di mana didukung dan sesuai)
- `webSecurity: true` (jangan pernah dinonaktifkan)
- **Content Security Policy** yang ketat pada dokumen yang dirender.
- **IPC:** handler `ipcMain.handle` memvalidasi setiap payload; channel di-allowlist; tanpa nama
  channel dinamik; `ipcRenderer` tidak pernah diekspos ke renderer.
- **Preload:** hanya API `contextBridge` yang kecil dan bertipe; tanpa bawaan Node, tanpa `require`,
  tanpa `process`.
- **Navigasi:** blokir navigasi menjauh dari aplikasi/origin yang disajikan; tolak jendela baru dan URL
  eksternal yang tak terduga; tolak permintaan izin OS secara default.
- **Filesystem:** terbatas pada project root yang disetujui pengguna, dengan kanonikalisasi dan
  pengecekan containment (Bagian 11.6).
- **Tanpa eksekusi shell** dari konten renderer dan tanpa `eval` kode proyek (SEC-012).
- **Tanpa edit destruktif senyap:** penulisan bersifat atomik/dapat dipulihkan dan aksi destruktif
  memerlukan konfirmasi eksplisit pengguna (Bagian 11.6).

Referensi normatif: dokumentasi keamanan resmi Electron (security checklist dan process model) adalah
baseline-nya. Di mana ia bertentangan dengan pernyataan mana pun di PRD ini, kontrol yang lebih ketat
yang berlaku. Renderer yang dikompromikan tidak boleh bisa menjangkau API istimewa hanya karena main
process berjalan lokal - isolasi ditegakkan oleh batas proses dan konfigurasi, bukan oleh asumsi.

### 14.5 Postur privasi

Tanpa akun, tanpa cloud, tanpa telemetri secara default, tanpa egress tersembunyi. Diagnostik hanya
hidup di mesin. Fitur jaringan apa pun di masa depan bersifat opt-in, diungkapkan, dan dapat
dimatikan, dan produk inti tetap berfungsi penuh secara offline.

---

## 15. Strategi Testing

Testing memprioritaskan **sync engine dan preservasi** karena korupsi adalah kegagalan berdampak
tertinggi. Tooling: Vitest (unit/integrasi), Playwright dengan dukungan Electron (E2E terhadap aplikasi
nyata), test integrasi main process untuk layanan filesystem/IPC, plus fault injection.

### 15.1 Lapisan test

- **Unit:** fungsi murni (komputasi patch, resolusi cascade, aturan validasi, pemilihan breakpoint,
  logika hash/compare).
- **Test parser:** berbasis fixture; menegaskan parse -> emit ulang byte-equality untuk konten tak dimodifikasi.
- **Test sinkronisasi:** diberikan (source, operasi), menegaskan source hasil yang persis dan stabilitas
  round-trip (idempotensi: menerapkan model yang sama tidak menghasilkan diff lanjutan).
- **Test integrasi filesystem:** proyek di temp-dir; penulisan atomik, backup, event watcher, perilaku file
  terkunci, simulasi disk penuh.
- **Test API main-process dan preload:** otorisasi/validasi handler IPC dan permukaan `contextBridge`
  yang diekspos, diuji secara terisolasi.
- **Test UI:** perilaku tingkat komponen dari inspector, tree, urutan palet.
- **Test end-to-end:** journey pengguna penuh (Bagian 6) terhadap aplikasi Electron nyata (main +
  preload + renderer + preview).
- **Test keamanan:** upaya escape sandbox, validasi IPC/input, pemblokiran navigasi/jendela, path
  traversal, kebijakan sumber daya eksternal, validasi impor, penegasan tanpa egress.
- **Packaging smoke test:** build Windows terkemas diluncurkan, membuka proyek, menyimpan, dan keluar
  secara offline.
- **Verifikasi manual:** paritas render, installer, dan perilaku SmartScreen di mesin Windows nyata.

> [!note] Electron E2E
> Playwright dapat meluncurkan dan mengemudikan aplikasi Electron secara langsung. Strategi: jalankan
> journey pengguna penuh terhadap aplikasi Electron nyata (main + preload + renderer + preview);
> pertahankan test unit/komponen yang cepat untuk logika; dan pertahankan set kecil test browser murni
> untuk alur UI-saja. Perilaku level OS (installer, SmartScreen, dialog native) tetap verifikasi manual.

### 15.2 Test case yang wajib (dengan ID)

| ID | Kasus | Ekspektasi |
|---|---|---|
| TEST-001 | HTML malformed (tag tak tertutup, `<` nyasar, salah nesting) | Parse best-effort; saat save, rentang tak dimodifikasi byte-identik; tanpa korupsi; UI memberi peringatan. |
| TEST-002 | CSS tak didukung (at-rule tak dikenal, `@layer`, nesting, hack browser) | Dipertahankan verbatim di luar edit; tanpa tulis ulang. |
| TEST-003 | Preservasi komentar (komentar HTML/CSS/JS) | Komentar dipertahankan byte-identik setelah edit tak terkait. |
| TEST-004 | Preservasi formatting (indentasi, CRLF/LF, gaya kutip) | Byte-identik kecuali rentang yang diedit; nilai baru cocok gaya lokal. |
| TEST-005 | Edit cepat (banyak perubahan dalam jendela debounce) | Tepat satu penulisan atomik per state yang settled; tanpa interleaving; file akhir benar. |
| TEST-006 | Urutan undo/redo (campuran model+source) | Model dan source keduanya pulih; tanpa diff orphan. |
| TEST-007 | Perubahan file eksternal saat bersih | Reload senyap; toast; tanpa data yang ditulis. |
| TEST-008 | Perubahan file eksternal saat kotor | Prompt konflik; tanpa auto-overwrite; setiap jalur resolusi dihormati. |
| TEST-009 | Save gagal (file read-only, disk penuh, file terkunci) | Asli utuh; buffer kotor dipertahankan; error jelas; retry/Save-As ditawarkan. |
| TEST-010 | File terbuka hilang/dihapus | Tanpa crash; buffer dipertahankan; Save-As bekerja. |
| TEST-011 | Idempotensi round-trip | Parse->model->emit sama dengan input; sync berulang tidak menghasilkan diff. |
| TEST-012 | Guard infinite-loop | Edit menghasilkan satu penulisan; watcher tidak memicu edit ulang. |
| TEST-013 | Insert/move/delete via DnD | Markup benar; langkah undo tunggal; validasi menolak nesting tidak valid. |
| TEST-014 | Perutean edit responsive | Properti masuk ke media query yang benar; canvas cocok dengan browser pada ambang. |
| TEST-015 | Edit class + atribusi origin | Atribut `class` ditambal; inspector menunjukkan file/selector rule asal. |
| TEST-016 | Paritas render vs. browser | Fitur yang didukung cocok dengan screenshot browser biasa dalam toleransi. |
| TEST-017 | Escape sandbox (JS proyek mencoba IPC/akses parent) | Upaya gagal; tanpa panggilan istimewa; aplikasi tak terpengaruh. |
| TEST-018 | Path traversal (`../../`) via aset/protokol | Diblokir; error muncul; tanpa pembacaan file di luar root. |
| TEST-019 | Kebijakan sumber daya eksternal | Diblokir secara default; opt-in memuat dengan indikator; CSP ditegakkan. |
| TEST-020 | Validasi impor (JSON komponen/token) | Input malformed/terlalu besar ditolak; tanpa eksekusi kode. |
| TEST-021 | Tanpa egress jaringan selama alur inti | Capture jaringan menunjukkan tidak ada trafik keluar. |
| TEST-022 | Suite lengkap offline | Semua test acceptance MVP lulus dengan jaringan dimatikan. |
| TEST-023 | File besar (5 MB) dibuka | Terbuka tanpa freeze atau dengan fallback read-only terdokumentasi. |
| TEST-024 | Pohon besar (~5.000 node) editing | Tidak ada UI block > 200 ms dalam skenario ter-skrip. |
| TEST-025 | Kebenaran saran aksesibilitas | Kasus yang ditandai/terlewat cocok dengan heuristik terdokumentasi; tidak pernah diterapkan otomatis. |
| TEST-026 | Atomicity saat dimatikan paksa | Konten file adalah lama atau baru, tidak pernah parsial. |
| TEST-027 | Validasi input IPC (payload malformed/palsu, traversal via IPC) | Main process menolak payload tidak valid dan channel tak dikenal; tanpa akses di luar root; tanpa crash. |
| TEST-028 | Konfigurasi hardening renderer | Assert otomatis bahwa renderer UI dan preview berjalan dengan `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`; tanpa global Node di preview. |
| TEST-029 | Pemblokiran navigasi dan jendela baru | Preview tidak dapat bernavigasi menjauh, membuka jendela baru, atau memicu prompt izin OS. |
| TEST-030 | Permukaan preload | Hanya API yang di-allowlist yang diekspos; `ipcRenderer`/`require`/`process` tidak ada. |
| TEST-031 | Packaging smoke test (Windows x64) | Build terkemas diluncurkan, membuka proyek, menyimpan secara atomik, dan keluar, offline. |
| TEST-032 | Pemulihan crash renderer | Crash renderer yang dipaksa tidak menghilangkan data yang tersimpan dan UI pulih (`NFR-017`). |
| TEST-033 | Penanganan proyek malformed/berbahaya | Parsing terbatas; tanpa crash; fallback read-only/render terakhir yang baik; tanpa panggilan istimewa. |

### 15.3 Cakupan dan gerbang

- Suite sync + parser + preservasi bersifat **release-blocking** untuk Phase 0 dan 3.
- Test keamanan (`TEST-017`..`TEST-021` dan `TEST-027`..`TEST-030`) bersifat release-blocking untuk setiap phase.
- Target coverage bersifat provisional: usahakan branch coverage tinggi pada modul parser/sync; coverage
  UI diukur lewat penyelesaian journey daripada persentase (`ASM-001`).

---

## 16. Success Metrics

Setiap metrik menyatakan apa yang ditunjukkannya dan cara mengukurnya. Metrik vanity (unduhan, ukuran
waitlist) sengaja dihilangkan.

| ID | Metrik | Menunjukkan | Pengukuran |
|---|---|---|---|
| SM-001 | Tingkat keberhasilan save untuk edit yang didukung >= 99.9% | Kebenaran loop inti | Suite otomatis + (opt-in) counter lokal; rasio edit yang diterapkan dapat diverifikasi di browser. |
| SM-002 | Tingkat korupsi source = 0 di seluruh suite acceptance | Integritas data / kepercayaan | Test preservasi + round-trip + atomicity (`NFR-010`, `TEST-011`, `TEST-026`). |
| SM-003 | Tingkat keberhasilan buka proyek >= 98% pada korpus situs nyata | Keluasan kompatibilitas | Buka N folder dunia nyata representatif; hitung keberhasilan dan alasan kegagalan. |
| SM-004 | Konsistensi preview (paritas render) >= 95% elemen yang diinspeksi cocok dengan browser | Fidelitas | Perbandingan screenshot/elemen otomatis pada korpus fixture. |
| SM-005 | Keandalan undo/redo = 100% di suite | Keamanan editing | Tingkat lulus `TEST-006`; tanpa divergensi state. |
| SM-006 | Waktu tugas edit median (mis. "ubah teks heading + warna") <= 15 s | Produktivitas | Studi tugas berwaktu (n>=10) vs. baseline mengedit manual di code editor. |
| SM-007 | Cakupan fitur offline = 100% fitur MVP dapat digunakan offline | Janji local-first | Tingkat lulus `TEST-022` dengan jaringan dimatikan. |
| SM-008 | Tingkat lulus test acceptance MVP = 100% sebelum sign-off MVP | Kesiapan rilis | Suite Bagian 19 hijau. |
| SM-009 | Nol trafik jaringan keluar selama alur inti | Janji privasi | Capture `TEST-021` bersih. |
| SM-010 | Penanganan konflik: 0 penimpaan senyap di test penulis bersamaan | Integritas data | Lulus `TEST-007/008`; log menunjukkan prompt, bukan auto-write. |
| SM-011 | Tingkat sesi tanpa crash >= 99% pada soak ter-skrip | Keandalan | Run soak otomatis. |
| SM-012 | Tingkat lulus preservasi formatting = 100% pada korpus fixture | Kualitas kepemilikan kode | Lulus `TEST-003/004/011`. |

Catatan: persentase adalah target provisional yang dikalibrasi setelah Phase 0. Metrik yang memerlukan
data pengguna (SM-006) harus dikumpulkan secara lokal/konsensual atau dalam studi khusus, tidak pernah
lewat telemetri tersembunyi.

---

## 17. Risiko dan Mitigasi

Probabilitas (P) dan Dampak (I) memakai Low/Medium/High. Metode validasi menentukan bagaimana setiap
risiko dieliminasi atau dibatasi.

| ID | Risiko | P | I | Mitigasi | Validasi |
|---|---|---|---|---|---|
| RISK-001 | Sinkronisasi/write-back merusak source (formatting, komentar, sintaks tak didukung). | High | High | Patch rentang surgical; source anchor; test preservasi; validate-before-write; backup; tolak edit yang mengharuskan tulis ulang sintaks tak didukung. | Korpus round-trip Phase 0; `TEST-001`..`TEST-004`, `TEST-011`, `TEST-016`. |
| RISK-002 | Isolasi preview gagal; kode proyek menjangkau privilege desktop. | Medium | High | Renderer preview terpisah tanpa preload/IPC istimewa; protokol read-only ter-scope; CSP; penolakan navigasi/jendela; no-eval; test escape. | `TEST-017`, `TEST-018`, `TEST-028`, `TEST-029` harus gagal escape. |
| RISK-003 | Sync engine terlalu kompleks; scope meledak; MVP molor parah. | High | High | Batasi MVP ke HTML/CSS/JS biasa, set properti terbatas, satu halaman aktif + stylesheet tertaut; tunda komponen/token. | Go/no-go Phase 0; review scope MVP. |
| RISK-004 | Ketidakcocokan paritas render antara preview Astra dan browser target. | Medium | Medium | Pakai engine asli (versi Chromium yang di-pin bersama Electron); dokumentasikan fitur yang didukung; snapshot paritas; degrade dengan mulus. | `TEST-016`, `SM-004`. |
| RISK-005 | Isu packaging atau otomasi E2E Electron memblok pengiriman yang andal. | Medium | Medium | Pin versi Electron; pakai biner prebuilt; packaging smoke test di CI; pertahankan fallback browser untuk alur UI-saja. | Spike packaging/E2E Phase 1 (`OQ-013`). |
| RISK-006 | Race konflik (edit eksternal + edit Astra) menyebabkan kehilangan. | Medium | High | Deteksi berbasis hash; prompt konflik; tampilan compare; tanpa auto-overwrite. | `TEST-007`, `TEST-008`, `SM-010`. |
| RISK-007 | Pengguna merasa tool tidak mampu mengedit proyek nyata mereka (berantakan/kompleks). | Medium | High | Desain preservation-first; read-only untuk konstruksi tak didukung; buka korpus nyata di Phase 1. | `SM-003`, `SM-004`. |
| RISK-008 | Kerentanan dependency atau isu supply-chain. | Medium | Medium | Dep minimal ter-pin; `npm audit` di CI; tanpa pemuatan aset remote. | Gerbang `npm audit`; `TEST-021`. |
| RISK-009 | Isu packaging/signing Windows (peringatan SmartScreen). | Medium | Low/Medium | Spike packaging CI lebih awal; dokumentasikan perilaku unsigned; kejar signing. | Test installer Phase 1 (`OQ-011`). |
| RISK-010 | Performa kolaps pada proyek besar. | Medium | Medium | Tree ter-virtualisasi; lazy loading; parse ter-debounce; fallback file besar. | `TEST-023`, `TEST-024`, NFR-004/005. |
| RISK-011 | Pengguna salah memahami perilaku a11y saran/tanpa-auto-apply. | Low | Medium | Label "hanya saran" yang jelas; tidak pernah auto-fix; jelaskan perbaikan yang disarankan. | `TEST-025`, review usability. |
| RISK-012 | AI (nanti) memperkenalkan non-determinisme/masalah privasi. | Medium | Medium | Hanya opt-in; adapter provider; gerbang review diff; tanpa shell; inti berfungsi tanpanya. | Test Phase 6. |
| RISK-013 | Over-scoping menuju pengganti Figma/IDE. | Medium | Medium | Non-goals eksplisit; tegakkan keputusan scope MVP. | Review roadmap. |
| RISK-014 | Kehilangan data akibat crash sebelum autosave. | Medium | Medium | Jurnal/backup recovery best-effort (`FR-A04b`). | Test crash-recovery. |
| RISK-015 | Jejak sumber daya Electron (memori, ukuran distribusi) merugikan mesin kelas bawah atau adopsi. | Medium | Medium | Target terukur (`NFR-004`, `NFR-018`); inisialisasi preview secara lazy; gunakan ulang satu renderer preview; dokumentasikan jejaknya. | `NFR-004`, `NFR-018`, `TEST-023`. |

---

## 18. Asumsi dan Pertanyaan Terbuka

### 18.1 Asumsi (default sementara; tinjau kembali)

| ID | Asumsi | Dampak jika salah |
|---|---|---|
| ASM-001 | Semua angka performa/success bersifat provisional sampai diukur; "smooth" diganti target terukur. | Target mungkin tidak realistis; kalibrasi ulang setelah Phase 0. |
| ASM-002 | Tidak perlu database; file + config store kecil cukup. | Mungkin perlu index untuk proyek sangat besar (tambahkan hanya jika terukur). |
| ASM-003 | MVP menyasar HTML/CSS/JS biasa, satu halaman aktif + stylesheet tertaut. | Sinkronisasi multi-halaman/global menambah kompleksitas (sudah P1 via FR-G11). |
| ASM-004 | Windows x64 dengan Chromium (Electron) yang di-pin dan di-bundel adalah satu-satunya platform MVP. | Cross-platform nanti memerlukan validasi ulang fs, watcher, dan packaging. |
| ASM-005 | Pengguna menerima penghindaran atribut `style`: edit lebih memilih rule stylesheet secara default. | Sebagian pengguna lebih suka inline; kebijakan dapat dikonfigurasi (FR-G10). |
| ASM-006 | Palet DnD terkurasi cukup untuk MVP meski library penuh/authoring komponen ditunda. | Jika tidak, scope DnD MVP harus ditinjau ulang. |
| ASM-007 | Temuan aksesibilitas harus saran dan tidak pernah auto-apply. | Jika pengguna minta auto-fix, tambahkan batch fix eksplisit dan dapat direview nanti. |
| ASM-008 | Monaco dapat dibundel sepenuhnya offline tanpa CDN. | Jika tidak, janji offline (FR-K01) berisiko; pakai editor lokal lain. |
| ASM-009 | Set dependency MVP mengirim biner prebuilt, sehingga tidak diperlukan compiler native (MSVC/Windows SDK); ini dikonfirmasi dengan mencoba melakukan build. | Jika addon native diperkenalkan, kebutuhan build tool berubah dan harus didokumentasikan. |

### 18.2 Pertanyaan terbuka (dengan default sementara agar tidak memblok)

| ID | Pertanyaan | Default sementara |
|---|---|---|
| OQ-001 | Apakah celah pasar untuk editing visual *proyek yang sudah ada* benar-benar ada sebesar yang diasumsikan? | Asumsikan ya; validasi dengan 10-15 wawancara sebelum Phase 2. |
| OQ-002 | Apakah pengguna design-to-code ingin editing visual atas kode produksi, atau hanya handoff? | Asumsikan ya untuk sebagian (Persona B/C/E); segmentasikan nanti. |
| OQ-003 | Bagaimana pengguna mengharapkan "proyek" diidentifikasi (single folder vs. multi-root)? | Satu folder per proyek. |
| OQ-004 | Apakah kepemilikan source benar-benar pendorong perpindahan atau hanya nice-to-have? | Asumsikan pendorong nyata untuk segmen target; ukur retensi. |
| OQ-005 | Seberapa besar dukungan preprocessor/framework yang dibutuhkan lebih awal (SCSS, TS, JSX)? | Tidak ada di MVP; daftar file, perlakukan sebagai teks, tandai tidak dapat diedit. |
| OQ-006 | Saat edit visual tidak dapat diekspresikan dengan aman di source, blokir atau dekati? | Blokir dengan penjelasan jelas; tidak pernah mendekati secara senyap. |
| OQ-007 | Satu proyek terbuka sekaligus, atau banyak? | Satu di MVP; multi-root nanti jika diminta. |
| OQ-008 | Apakah three-way merge penuh diperlukan untuk konflik? | Compare baris/teks di MVP; 3-way nanti jika perlu. |
| OQ-009 | Bagaimana memilih stylesheet yang "benar" saat membuat rule? | Utamakan stylesheet yang tertaut paling dekat ke halaman elemen; ingat pilihan pengguna per proyek. |
| OQ-010 | Format portabel apa untuk komponen/token? | CSS custom property + HTML/JSON terdokumentasi; putuskan di Phase 5. |
| OQ-011 | Apakah rilis akan di-code-sign? | Asumsikan unsigned awalnya; dokumentasikan; kejar sertifikat. |
| OQ-012 | Monetisasi masa depan yang tidak mengunci editing inti? | Jaga inti gratis/offline; tier berbayar apa pun opsional dan aditif. |
| OQ-013 | Apakah dukungan Electron dari Playwright cukup untuk E2E, dan tool packaging mana (Electron Forge vs. electron-builder) yang kita standarkan? | Asumsikan Playwright + Electron untuk alur aplikasi; pilih tool packaging di Phase 1. |
| OQ-014 | Bagaimana node DOM yang dihasilkan runtime direpresentasikan (read-only vs. disembunyikan)? | Read-only di tree; tidak pernah ditulis ke source. |
| OQ-015 | Mana model isolasi yang lebih baik: renderer preview terpisah atau iframe ter-sandbox? | Asumsikan renderer Electron terpisah; validasi dengan test escape (`TEST-017`, `TEST-018`). |

---

## 19. Kriteria Penerimaan (MVP)

Ini adalah kriteria end-state yang testable untuk sign-off MVP. "Browser biasa" berarti browser normal
yang membuka proyek dari disk tanpa Astra.

| ID | Kriteria penerimaan |
|---|---|
| AC-001 | Membuka folder berisi `index.html` merender situs di canvas; menutup tidak meninggalkan handle terbuka. |
| AC-002 | Paritas render: untuk korpus fixture, elemen yang diinspeksi cocok dengan browser biasa dalam toleransi yang ditentukan untuk fitur yang didukung. |
| AC-003 | Mengklik elemen yang dirender memilihnya, menggambar outline, dan memperbarui inspector serta layer tree dalam 100 ms (P95). |
| AC-004 | Mengedit teks/atribut dan CSS umum (tipografi, warna/background, spacing, border, dimensi) memperbarui canvas dan, saat save, source. |
| AC-005 | Setiap edit yang didukung menghasilkan tepat satu penulisan atomik dan byte-preserving; git diff hanya berisi perubahan yang dimaksud plus formatting konsisten dengan gaya lokal. |
| AC-006 | Mengedit source di code editor memperbarui canvas dalam <= 400 ms tanpa restart aplikasi. |
| AC-007 | Undo/redo mengembalikan/memulihkan model dan source per aksi pengguna logis; tidak ada divergensi tersisa setelah urutan penuh. |
| AC-008 | Komentar, sintaks tak didukung, dan formatting di luar rentang yang diedit byte-identik setelah edit (`TEST-003/004/011`). |
| AC-009 | Edit eksternal terdeteksi; dokumen bersih reload, dokumen kotor memunculkan prompt konflik tanpa penimpaan otomatis. |
| AC-010 | **Gerbang end-to-end:** situs yang diedit secara visual di Astra lalu dibuka di browser biasa menunjukkan hasil yang diharapkan dan tidak ada yang lain (`SM-001`, `SM-002`). |
| AC-011 | Save yang gagal (terkunci/read-only/disk penuh) tidak pernah merusak file; buffer kotor bertahan dan opsi pemulihan ditawarkan. |
| AC-012 | Preset responsive mengubah ukuran canvas; edit properti dirutekan ke media query yang benar; media query yang ada berperilaku persis seperti di browser. |
| AC-013 | Drag insert/move/reorder dasar bekerja dengan indikator jelas dan validasi nesting HTML; drop tidak valid ditolak dengan pesan. |
| AC-014 | Pengecekan a11y saran (alt text, nama aksesibel, label form) menandai isu, memilih elemen saat diklik, dan tidak pernah memodifikasi source. |
| AC-015 | Dengan jaringan dimatikan, semua alur MVP bekerja; mengaktifkan jaringan tidak menyebabkan egress senyap. |
| AC-016 | Preview tidak dapat memanggil IPC istimewa atau menjangkau main process/renderer UI; upaya path traversal dan navigasi diblokir (`TEST-017/018/027/029`). |
| AC-017 | Build Windows terkemas terpasang dan berjalan offline di mesin Windows 10/11 bersih. |

---

## 20. Definition of Done

### 20.1 Definition of Done MVP

| ID | Item |
|---|---|
| DoD-001 | Semua kriteria penerimaan MVP (AC-001..AC-017) lulus di CI jika dapat diotomasi dan di verifikasi manual jika tidak. |
| DoD-002 | Suite release-blocking hijau: parser/preservasi, sync, atomicity, keamanan, dan hardening/IPC Electron (`TEST-001`..`TEST-021` dan `TEST-027`..`TEST-033`). |
| DoD-003 | Nol defect korupsi source yang diketahui; nol defect penimpaan senyap. |
| DoD-004 | Dokumentasi: panduan pengguna (buka/edit/simpan), perilaku sync + kebijakan (style vs. inline, formatting), dan daftar "apa yang tidak akan disentuh Astra". |
| DoD-005 | Build Windows terkemas dan dapat diinstal ada serta berjalan offline; instal/luncur diverifikasi di mesin bersih. |
| DoD-006 | Paritas render terdokumentasi: fitur yang didukung vs. tidak didukung didaftar secara eksplisit. |
| DoD-007 | Review keamanan selesai: isolasi preview, hardening renderer, validasi IPC, penanganan path, sumber daya eksternal, validasi impor, tanpa egress (`SEC-001`..`SEC-022` ditinjau). |
| DoD-008 | TypeScript strict + lint bersih di main, preload, dan renderer; dependency graph modul tanpa siklus inti (`NFR-010`). |
| DoD-009 | Suite E2E offline lulus dengan jaringan dimatikan (`TEST-022`). |
| DoD-010 | Target performa provisional (NFR-001..NFR-005) diukur dan dipenuhi atau dinegosiasikan ulang secara eksplisit dengan bukti. |
| DoD-011 | Metadata `.astra/` terbukti non-esensial: menghapusnya tidak merusak proyek. |
| DoD-012 | Tanpa telemetri; diagnostik hanya lokal; diverifikasi via capture jaringan (`TEST-021`). |

### 20.2 Definisi exit per phase

Setiap phase roadmap (Bagian 13) mendefinisikan deliverable, acceptance, testing, risiko, dan kondisi
exit-nya sendiri; sebuah phase selesai hanya ketika kriteria penerimaannya dan test release-blocking-nya
lulus, dan tidak ada risiko release-blocking baru yang dibiarkan tanpa mitigasi tanpa keputusan yang
eksplisit dan terdokumentasi.

---

## Lampiran A - Indeks ID Requirement

| Area | ID |
|---|---|
| Aplikasi desktop | FR-A01..FR-A06 |
| Explorer | FR-B01..FR-B07 |
| Canvas | FR-C01..FR-C06 |
| Drag & drop | FR-D01..FR-D06 |
| Inspector | FR-E01..FR-E09 |
| Code editor | FR-F01..FR-F05 |
| Sync engine | FR-G01..FR-G11 |
| Responsive | FR-H01..FR-H05 |
| Komponen/token | FR-I01..FR-I04 |
| Aksesibilitas | FR-J01..FR-J06 |
| Local-first | FR-K01..FR-K06 |
| AI opsional | FR-L01..FR-L02 |
| Non-fungsional | NFR-001..NFR-018 |
| UI/UX | UX-001..UX-008 |
| Keamanan | SEC-001..SEC-022 |
| Testing | TEST-001..TEST-033 |
| Success | SM-001..SM-012 |
| Risiko | RISK-001..RISK-015 |
| Asumsi/Pertanyaan | ASM-001..ASM-009, OQ-001..OQ-015 |
| Penerimaan MVP | AC-001..AC-017 |
| Definition of done | DoD-001..DoD-012 |

---

## Lampiran B - Glosarium

| Istilah | Arti |
|---|---|
| Source anchor | Rentang offset byte di file asli yang menjadi padanan sebuah node ter-parse. |
| Surgical patch | Edit tekstual yang diterapkan hanya pada rentang persis yang dipengaruhi suatu operasi, membiarkan sisanya byte-identik. |
| Document Model | Proyeksi proyek di memori milik Astra, ter-address, dipakai untuk editing dan diffing. |
| Preview sandbox | Konteks rendering terisolasi tempat kode proyek tak terpercaya berjalan tanpa privilege desktop. |
| Self-write | Penulisan disk yang dilakukan Astra, ditandai agar watcher tidak memperlakukannya sebagai perubahan eksternal. |
| Arrow / pencegahan loop | Logika yang memastikan edit Astra tidak memicu reparse yang sendirinya menghasilkan edit lain. |
| Entry point | File HTML yang dirender Astra sebagai halaman aktif (default `index.html`). |
| Token | Nilai desain yang dapat digunakan ulang (warna, font, spacing) yang diekspresikan sebagai CSS custom property atau config terdokumentasi. |
| Saran (a11y) | Temuan yang ditunjukkan ke pengguna yang tidak pernah diterapkan otomatis oleh Astra. |

---

## Lampiran C - Pemberitahuan Eksplisit Belum Diimplementasikan

Untuk menegaskan kembali status dokumen: **Logika aplikasi Astra belum diimplementasikan.**
Direktori proyek (`D:\code-web\Astra`) paling banyak berisi scaffold proyek (tooling dan dependency);
tidak ada fitur yang dijelaskan di sini yang dibangun atau diuji.
PRD ini adalah materi perencanaan yang dimaksudkan untuk memandu arsitektur, perencanaan implementasi,
dan pengujian penerimaan. Tidak ada bagian dari dokumen ini yang boleh dibaca sebagai bukti bahwa suatu
requirement telah dibangun atau diuji. Ketika implementasi dimulai, dokumen ini harus direkonsiliasi
dengan referensi visual yang diberikan (jika ada) dan diperbarui seiring pengukuran menggantikan target
provisional di atas.
