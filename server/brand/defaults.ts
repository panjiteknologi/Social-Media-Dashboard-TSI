import type { BrandKnowledge } from '../../shared/brand';

/**
 * The first version of the knowledge base, researched on 15 September 2026 from
 * tsicertification.com (home, company profile, impartiality and quality
 * policies, certification process, service, contact, appeal and complaint
 * pages) and the best-performing articles. Only facts stated on the website
 * are included. The impartiality rules are a draft for compliance to approve.
 */
export const DEFAULT_BRAND_KNOWLEDGE: BrandKnowledge = {
  companyProfile: `Nama resmi: PT TSI Sertifikasi Internasional. Sebutan singkat: TSI. Jangan menulis "PT TSI Certification International" atau variasi lain.
Jenis organisasi: lembaga sertifikasi (certification body) pihak ketiga yang independen.
Berdiri: 23 September 2013 di Jakarta.
Alamat: Adpremier Tower Lt. 16, Jl. TB Simatupang No. 5, Ragunan, Pasar Minggu, Jakarta Selatan 12550.
Kontak resmi: telepon +62 21 7477 5110, email info@tsicertification.co.id. Banding: appeal@tsicertification.co.id. Keluhan: complaint@tsicertification.co.id.
Website: https://tsicertification.com (bahasa Inggris) dan https://tsicertification.com/id/ (bahasa Indonesia).
Tagline: Boosting Trust for Sustainability.
Nilai: Trust (integritas di setiap audit dan interaksi), Sustainability (membantu organisasi membangun sistem yang bertahan dan berkembang), Innovation (terus memperbaiki metode dan alat kerja).

Layanan sertifikasi yang tercantum di website: ISO 9001, ISO 14001, ISO 45001, ISO/IEC 27001, ISO/IEC 20000-1, ISO 22000, HACCP, SMK3, ISPO, dan ISCC. Artikel blog juga membahas standar lain (misalnya ISO 37001, ISO 21001, ISO 27701), tetapi jangan menulis bahwa TSI menyertifikasi standar yang tidak tercantum di atas tanpa konfirmasi tim sertifikasi.
Pelatihan: TSI Academy, berupa pelatihan publik dan in-house. Website menyebut pelatihannya terakreditasi Exemplar Global dan IRCA.
Akreditasi yang ditampilkan di website: KAN (Komite Akreditasi Nasional), KAN untuk lembaga sertifikasi ISPO, ISCC, dan APMG International. Sebut akreditasi hanya untuk skema dan ruang lingkup yang benar-benar tercakup. Kalau ragu, tulis secara umum dan tandai untuk dicek tim sertifikasi.

Sektor klien: minyak dan gas, industri, pertambangan, BUMN, pemerintahan, energi, manufaktur, logistik, transportasi, distribusi, pangan, agro-kehutanan, konstruksi, rekayasa, kimia, pendidikan, TI, fintech, perbankan, telekomunikasi, dan jasa fasilitas. Wilayah operasi utama: Indonesia.

Proses sertifikasi (halaman Certification Process dan ISO Certification Process): permintaan informasi atau penawaran, tinjauan dokumen, audit tahap 1, audit tahap 2, keputusan sertifikasi oleh komite, lalu audit surveilans. Sertifikat berlaku tiga tahun dengan dua audit surveilans berjarak satu tahun, lalu resertifikasi.
Banding atas keputusan sertifikasi diajukan tertulis dalam 7 hari sejak keputusan diterima. Keluhan dijawab paling lambat 30 hari.

Pesan merek yang dipegang: sertifikasi yang diperoleh lewat audit yang objektif, bukan sertifikasi yang sekadar dibayar ("certification you earn, not certification you simply pay for").`,

  toneOfVoice: `Kepribadian: profesional, tenang, edukatif, dan objektif. Bayangkan auditor senior yang menjelaskan standar kepada manajemen dengan bahasa yang jelas, bukan tenaga penjual.

Bahasa
- Artikel blog ditulis dalam bahasa Indonesia baku yang mudah dibaca: tidak kaku, tidak gaul.
- Sapa pembaca dengan "Anda" atau "organisasi Anda". Jangan memakai "kamu", "kalian", atau "lo".
- Istilah teknis bahasa Inggris dimiringkan saat pertama muncul dan diberi penjelasan atau singkatannya, misalnya Critical Control Point (CCP). Setelah itu cukup singkatannya.
- Tulis nomor standar dengan konsisten: ISO 9001:2015, ISO/IEC 27001:2022, ISO 22000:2018. Tanpa spasi di sekitar titik dua. Sebut nama sistemnya saat pertama muncul, misalnya ISO 14001:2015 (Sistem Manajemen Lingkungan).
- Nama perusahaan saat pertama disebut: PT TSI Sertifikasi Internasional. Setelah itu boleh "TSI".

Struktur artikel yang terbukti bekerja di situs ini
- Paragraf pembuka yang langsung menjawab apa topiknya dan mengapa penting, dengan focus keyword di kalimat pertama atau kedua.
- H2 berurutan: "Mengenal/Memahami [topik]", "Mengapa [topik] penting", inti pembahasan (prinsip, tujuan, manfaat, atau langkah), peran lembaga sertifikasi dan proses sertifikasi secara netral, lalu "Kesimpulan".
- Paragraf 3 sampai 4 kalimat. Daftar berpoin untuk jenis, langkah, atau contoh.
- Heading hanya untuk judul bagian, jangan untuk paragraf.
- Tautkan 2 sampai 4 artikel terkait di situs ini dan satu halaman layanan atau proses sertifikasi yang relevan.
- Tutup dengan "Ditulis oleh Tim Digital Marketing PT TSI" bila artikel memakai byline.

Isi
- Rujuk sumber resmi bila menyebut persyaratan, angka, atau regulasi: standar ISO terkait, Codex Alimentarius, WHO, atau regulasi Indonesia. Jangan mengarang nomor klausul, statistik, atau kutipan. Kalau tidak yakin, jelaskan secara umum.
- Jelaskan persyaratan standar sebagai informasi umum yang berlaku bagi semua organisasi, bukan saran penerapan untuk satu organisasi tertentu.
- Gunakan contoh industri Indonesia bila relevan (misalnya dapur MBG, perkebunan sawit, fintech), tanpa menyebut nama perusahaan.

Hindari
- Superlatif tanpa bukti: "terbaik", "nomor 1", "paling terpercaya", "satu-satunya".
- Janji hasil: "pasti lulus", "dijamin", "sertifikat cepat".
- Kata "menjamin" untuk hasil sertifikasi atau mutu klien. Pakai "membantu menunjukkan" atau "memberikan pengakuan".
- Clickbait, huruf kapital berlebihan, tanda seru beruntun, dan emoji di artikel.

Media sosial
- Boleh lebih ringkas dan hangat, dengan kalimat pendek dan satu pesan utama per unggahan.
- Emoji secukupnya (maksimal dua) dan hanya di media sosial.
- Aturan imparsialitas dan larangan janji hasil tetap berlaku sepenuhnya.`,

  ctaRules: `Tujuan CTA: mengajak pembaca memahami proses sertifikasi atau menghubungi tim untuk informasi dan penawaran. CTA tidak pernah menjanjikan hasil audit.

Penempatan
- Artikel edukasi: satu CTA lembut di bagian Kesimpulan, dan paling banyak satu tautan kontekstual di badan artikel. Jangan menaruh CTA di paragraf pembuka.
- Halaman layanan: tombol utama "Ajukan Sertifikasi" (halaman bahasa Indonesia) atau "Apply for Certification" (halaman bahasa Inggris), mengarah ke halaman kontak.
- Media sosial: satu ajakan di akhir teks, mengarah ke halaman kontak atau halaman layanan terkait.

Tujuan tautan
- Kontak: /id/contact-us/ untuk konten bahasa Indonesia, /contact-us/ untuk bahasa Inggris.
- Halaman layanan standar terkait, misalnya /iso-9001-qms/, /haccp-certification/, /ispo-certification/.
- Proses sertifikasi: /certification-process/ atau /iso-certification-process/.
- Telepon +62 21 7477 5110 dan email info@tsicertification.co.id. Jangan menulis nomor WhatsApp: pengunjung memakai tombol chat "Let's chat!" yang sudah ada di website.

Kalimat CTA yang boleh dipakai
- "Pelajari tahapan sertifikasi [standar] bersama PT TSI Sertifikasi Internasional."
- "Hubungi tim kami untuk informasi proses dan penawaran sertifikasi [standar]."
- "Ajukan Sertifikasi" / "Apply for Certification"
- "Hubungi Kami" / "Contact Us" / "Talk to Our Team"
- "Dapatkan penawaran yang disesuaikan dalam 24 jam." (sesuai janji layanan di halaman layanan)
- Untuk TSI Academy: "Lihat jadwal pelatihan publik TSI Academy."

Dilarang
- "Dijamin lulus", "pasti tersertifikasi", "sertifikat cepat" atau "ekspres", "tanpa ribet audit".
- Diskon atau hadiah yang dikaitkan dengan hasil audit, kelulusan, atau lamanya sertifikat.
- "Konsultasi gratis penyusunan dokumen", "pendampingan sampai lulus", dan paket "konsultasi plus sertifikasi".
- Menawarkan pelatihan TSI Academy sebagai cara mempercepat atau mempermudah sertifikasi di TSI.
- Urgensi palsu seperti "hanya hari ini" atau "slot terbatas" tanpa dasar.

Pelacakan
- Di website, pakai tombol CTA dan formulir yang sudah ada, supaya klik tercatat sebagai cta_click dan generate_lead di Google Analytics.`,

  impartialityRules: `Status: DRAF, disusun dari Kebijakan Ketidakberpihakan di website dan prinsip ISO/IEC 17021-1 klausul 5.2 (pengelolaan ketidakberpihakan). Wajib ditinjau dan disetujui compliance TSI sebelum dianggap final. Selama masih draf, aturan ini tetap dipatuhi.

Prinsip dasar (dari website): TSI berkomitmen menjaga ketidakberpihakan dalam aktivitas sertifikasi. Semua keputusan sertifikasi didasarkan pada bukti objektif dan tidak dipengaruhi kepentingan pihak mana pun.

Aturan untuk semua konten
1. TSI adalah lembaga sertifikasi, bukan konsultan. Jangan menawarkan atau mengesankan jasa konsultansi sistem manajemen: penyusunan dokumen, pendampingan implementasi, atau audit internal untuk organisasi yang disertifikasi TSI.
2. Jangan menjanjikan atau mengesankan hasil sertifikasi: kelulusan, jumlah temuan, atau tanggal pasti terbitnya sertifikat. Keputusan sertifikasi diambil komite berdasarkan bukti objektif hasil audit.
3. Perkiraan waktu proses hanya boleh ditulis sebagai perkiraan umum yang bergantung pada kesiapan organisasi dan hasil audit.
4. Jangan mengaitkan sertifikasi TSI dengan konsultan atau penyedia pelatihan mana pun. Jangan menulis bahwa sertifikasi lebih mudah, cepat, atau murah bila memakai konsultan tertentu atau pelatihan TSI Academy.
5. Materi pelatihan TSI Academy bersifat umum, berbasis informasi publik. Konten pelatihan tidak boleh berisi solusi khusus untuk sistem manajemen organisasi yang sedang atau akan disertifikasi TSI, dan tidak boleh diklaim membantu lulus audit TSI.
6. Artikel edukasi boleh menjelaskan persyaratan standar secara umum. Jangan memberikan solusi siap pakai untuk organisasi tertentu, seperti template dokumen untuk klien atau "cara pasti lolos audit".
7. Auditor boleh digambarkan mengidentifikasi ketidaksesuaian dan peluang perbaikan secara umum, tetapi tidak sebagai pemberi solusi atau rekomendasi penerapan yang spesifik.
8. Harga: jangan menyebut harga pasti tanpa persetujuan tim. Jangan menawarkan diskon atau insentif yang dikaitkan dengan hasil audit. Jangan menjadikan "murah" daya tarik utama.
9. Jangan menjelekkan lembaga sertifikasi lain atau konsultan, dan jangan mengklaim sebagai satu-satunya atau yang terbaik.
10. Akreditasi dan logo: sebut akreditasi hanya untuk skema dan ruang lingkup yang tercakup. Penggunaan tanda sertifikasi dan akreditasi mengikuti Certification Mark Guidance TSI-SD-CM-02.
11. Klien: jangan menyebut nama klien, status sertifikatnya, atau temuan audit tanpa izin tertulis dan tanpa memastikan sertifikatnya masih berlaku. Informasi klien bersifat rahasia.
12. Banding dan keluhan diarahkan ke appeal@tsicertification.co.id dan complaint@tsicertification.co.id sesuai halaman resmi.
13. Bila ragu apakah konten melanggar ketidakberpihakan, jangan terbitkan. Tandai untuk ditinjau compliance.

Catatan untuk compliance: kalimat di website yang sebaiknya ikut ditinjau
- Beranda, Certification Solution: "services help you guarantee the quality of company aspects". Kata "guarantee" bisa dibaca sebagai jaminan hasil.
- Halaman ISO 9001: "surface improvement opportunities, and deliver findings that operational leaders can act on immediately". Pastikan tidak dibaca sebagai saran solusi.
- FAQ halaman layanan: "it will take approximately 2 months". Pastikan jelas sebagai perkiraan, bukan janji.
- Solusi Pelatihan dan TSI Academy in-house: pastikan terpisah dari organisasi yang disertifikasi TSI.`,

  impartialityStatus: 'draft',
  impartialityApprovedBy: null,
  impartialityApprovedOn: null,

  // The best-performing articles in Search Console, 16 Aug – 12 Sep 2026, with
  // an SEO checklist score of 91 or more. Short older articles that ranked on a
  // few clicks were left out: they are not what the AI should imitate.
  exampleArticles: [
    {
      url: 'https://tsicertification.com/blog/iso-21001-2025-sistem-manajemen-organisasi-pendidikan/',
      title: 'ISO 21001 : 2025 Sistem Manajemen Organisasi Pendidikan',
      reason: 'Paling banyak klik (5) dan 133 impressions di posisi 7,7. Skor SEO 100, 627 kata. Contoh pembuka yang langsung menjelaskan standar dan H2 yang runtut sampai peran lembaga sertifikasi.',
    },
    {
      url: 'https://tsicertification.com/blog/tujuan-dan-manfaat-iso-14001-2026-bagi-organisasi/',
      title: 'Tujuan dan Manfaat ISO 14001:2026 bagi Organisasi',
      reason: 'Impressions tertinggi (202) di posisi 6,9. Skor SEO 100, 838 kata. Contoh struktur lengkap: latar belakang, tujuan, manfaat, kontribusi keberlanjutan, lalu Kesimpulan.',
    },
    {
      url: 'https://tsicertification.com/blog/monitoring-haccp-langkah-krusial-keamanan-pangan/',
      title: 'Monitoring HACCP: Langkah Krusial Keamanan Pangan',
      reason: '2 klik dan 133 impressions di posisi 9,3. Skor SEO 100, 988 kata. Contoh rujukan sumber resmi (Codex CXC 1-1969, ISO 22000:2018) dan contoh praktis.',
    },
    {
      url: 'https://tsicertification.com/blog/iso-14001-2026-pengelolaan-limbah-industri-yang-efektif/',
      title: 'ISO 14001 : 2026 Pengelolaan Limbah Industri yang Efektif',
      reason: '1 klik dan 42 impressions di posisi 7,3. Skor SEO 100, 750 kata.',
    },
    {
      url: 'https://tsicertification.com/blog/dokumentasi-iso-14001-yang-penting-untuk-disiapkan-dan-contohnya/',
      title: 'Dokumentasi ISO 14001 Yang Penting Untuk Disiapkan Dan Contohnya',
      reason: '1 klik dan 32 impressions di posisi 7,0. Skor SEO 91, 937 kata. Topik praktis yang dicari pembaca.',
    },
    {
      url: 'https://tsicertification.com/blog/iso-22301-2019-kelangsungan-bisnis-ketahanan-operasional/',
      title: 'ISO 22301 : 2019 Kelangsungan Bisnis Ketahanan Operasional',
      reason: '112 impressions di posisi 10,8. Skor SEO 100, 685 kata.',
    },
    {
      url: 'https://tsicertification.com/blog/penerapan-haccp-di-dapur-mbg/',
      title: 'Penerapan HACCP di Dapur MBG',
      reason: '60 impressions di posisi 8,9. Skor SEO 91, 1.132 kata. Contoh topik yang dekat dengan isu Indonesia. Jangan tiru pemakaian heading untuk paragraf di artikel ini.',
    },
    {
      url: 'https://tsicertification.com/blog/hubungan-iso-27701-2019-iso-27001-2022/',
      title: 'Hubungan ISO 27701 : 2019 & ISO 27001 : 2022',
      reason: '103 impressions di posisi 16,3. Skor SEO 91, 725 kata. Contoh artikel yang menghubungkan dua standar.',
    },
  ],

  ai: {
    language: 'id',
    minWords: 800,
    maxWords: 1500,
    includeFaq: true,
    authorLine: 'Ditulis oleh Tim Digital Marketing PT TSI',
  },
};
