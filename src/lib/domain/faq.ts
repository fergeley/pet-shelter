import type { FaqCategoryValue } from "@/lib/validations/faq";

/**
 * A FAQ entry as consumed by the UI. Mirrors the Prisma `Faq` model but with
 * `createdAt` / `updatedAt` serialised to ISO strings so the value can cross
 * the Server Component boundary without a Date serialisation warning.
 */
export interface FaqEntry {
  id: string;
  category: FaqCategoryValue;
  question: string;
  answer: string;
  questionMs?: string | null;
  answerMs?: string | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FaqCategoryMeta {
  value: FaqCategoryValue;
  /** Short label used by the admin table and category badges. */
  label: string;
  labelMs: string;
  /** Longer label used by the public filter pills, per the page spec. */
  pillLabel: string;
  pillLabelMs: string;
}

export const FAQ_CATEGORIES: readonly FaqCategoryMeta[] = [
  {
    value: "ADOPTION",
    label: "Adoption",
    labelMs: "Adopsi",
    pillLabel: "Adoption Process & Fees",
    pillLabelMs: "Proses & Yuran Adopsi",
  },
  {
    value: "VOLUNTEERING",
    label: "Volunteering",
    labelMs: "Kesukarelawanan",
    pillLabel: "Volunteering",
    pillLabelMs: "Kesukarelawanan",
  },
  {
    value: "ANIMAL_CARE",
    label: "Animal Care",
    labelMs: "Penjagaan Haiwan",
    pillLabel: "Stray Animal Care & Surrenders",
    pillLabelMs: "Penjagaan Haiwan Terbiar & Penyerahan",
  },
  {
    value: "SHELTER_INFO",
    label: "Shelter Info",
    labelMs: "Maklumat Santuari",
    pillLabel: "Shelter Location & Visiting Hours",
    pillLabelMs: "Lokasi Santuari & Waktu Lawatan",
  },
] as const;

export const FAQ_CATEGORY_VALUES: readonly FaqCategoryValue[] = FAQ_CATEGORIES.map(
  (c) => c.value
);

export function getFaqCategoryMeta(value: FaqCategoryValue): FaqCategoryMeta | undefined {
  return FAQ_CATEGORIES.find((c) => c.value === value);
}

/** Resolves the category label for the active language, falling back to English. */
export function faqCategoryLabel(value: FaqCategoryValue, isMs = false): string {
  const meta = getFaqCategoryMeta(value);
  if (!meta) return value;
  return isMs ? meta.labelMs : meta.label;
}

/**
 * Picks the question/answer copy for the active language.
 *
 * Malay translations are optional, so an entry that staff have not translated
 * yet still renders (in English) rather than showing an empty accordion row.
 */
export function resolveFaqCopy(
  entry: FaqEntry,
  isMs: boolean
): { question: string; answer: string } {
  if (isMs) {
    return {
      question: entry.questionMs?.trim() || entry.question,
      answer: entry.answerMs?.trim() || entry.answer,
    };
  }
  return { question: entry.question, answer: entry.answer };
}

/**
 * Locale-independent string comparison.
 *
 * `localeCompare` without an explicit locale collates using the runtime's
 * default, which differs between the server (Node's ICU default) and the
 * browser (the visitor's locale — plausibly ms-MY for this audience). This list
 * is sorted on the server for the initial HTML and again on the client inside
 * `FaqBrowser`, so a locale-sensitive tiebreak could order two entries
 * differently on each side and produce a hydration mismatch. Code-unit order is
 * arbitrary but identical everywhere, which is what "stable" has to mean here.
 */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Deterministic public ordering: `displayOrder` ascending, ties broken by
 * question text so the list never reshuffles between renders.
 */
export function sortFaqs(entries: readonly FaqEntry[]): FaqEntry[] {
  return [...entries].sort(
    (a, b) => a.displayOrder - b.displayOrder || compareText(a.question, b.question)
  );
}

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * True when the query appears in any of the entry's searchable text.
 *
 * Both languages are searched regardless of the active UI language: a visitor
 * reading the English page who types a Malay term still finds the entry.
 */
export function faqMatchesQuery(entry: FaqEntry, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;

  const haystack = [entry.question, entry.answer, entry.questionMs, entry.answerMs]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map(normalise);

  // Every whitespace-separated term must appear somewhere in the entry, so
  // "adoption fee" narrows the list instead of matching either word alone.
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.some((text) => text.includes(term)));
}

export interface FaqFilterOptions {
  category?: FaqCategoryValue | "all";
  search?: string;
}

/** Applies the category pill and the search box, then sorts. */
export function filterFaqs(
  entries: readonly FaqEntry[],
  { category = "all", search = "" }: FaqFilterOptions = {}
): FaqEntry[] {
  const byCategory =
    category === "all" ? entries : entries.filter((e) => e.category === category);
  const bySearch = search.trim()
    ? byCategory.filter((e) => faqMatchesQuery(e, search))
    : byCategory;
  return sortFaqs(bySearch);
}

/** Groups sorted entries under their category, dropping empty categories. */
export function groupFaqsByCategory(
  entries: readonly FaqEntry[]
): { meta: FaqCategoryMeta; entries: FaqEntry[] }[] {
  return FAQ_CATEGORIES.map((meta) => ({
    meta,
    entries: sortFaqs(entries.filter((e) => e.category === meta.value)),
  })).filter((group) => group.entries.length > 0);
}

/** Per-category counts for the filter pills, including the "all" total. */
export function countFaqsByCategory(
  entries: readonly FaqEntry[]
): Record<FaqCategoryValue | "all", number> {
  const counts = {
    all: entries.length,
  } as Record<FaqCategoryValue | "all", number>;

  for (const meta of FAQ_CATEGORIES) {
    counts[meta.value] = entries.filter((e) => e.category === meta.value).length;
  }

  return counts;
}

/** The minimum an entry needs for reorder planning. */
export interface FaqOrderable {
  id: string;
  displayOrder: number;
  question: string;
}

/**
 * Plans moving one entry a single slot up or down among its siblings, returning
 * the rows whose `displayOrder` must change. `null` means the entry is already
 * at the boundary, or is not in the list.
 *
 * Callers must pass only the entries of ONE category — ordering is scoped to a
 * category, and this function deliberately does no filtering of its own so it
 * can be given a narrow projection rather than whole rows.
 *
 * The result renumbers the affected span contiguously from 0 rather than
 * swapping the two values. A swap looks cheaper but cannot express a move
 * between two rows that already share a `displayOrder`: the earlier version
 * nudged the moved row to `neighbour - 1`, which produced -1 whenever two
 * entries sat at 0. `faqFormSchema` rejects a negative `displayOrder`, so that
 * row could then never be saved from the edit dialog again. Renumbering also
 * heals any pre-existing ties and gaps in the category.
 */
export function planFaqRenumber(
  siblings: readonly FaqOrderable[],
  id: string,
  direction: "up" | "down"
): { id: string; displayOrder: number }[] | null {
  const ordered = [...siblings].sort(
    (a, b) => a.displayOrder - b.displayOrder || compareText(a.question, b.question)
  );

  const index = ordered.findIndex((e) => e.id === id);
  if (index === -1) return null;

  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= ordered.length) return null;

  [ordered[index], ordered[neighbourIndex]] = [ordered[neighbourIndex], ordered[index]];

  return ordered
    .map((entry, position) => ({ id: entry.id, displayOrder: position }))
    .filter((row, position) => ordered[position].displayOrder !== row.displayOrder);
}

/**
 * Canonical launch content for the FAQ knowledge base.
 *
 * This array is the single source of truth: `prisma/seed.ts` writes it to
 * PostgreSQL, and `getPublicFaqs()` renders it verbatim when the database is
 * unreachable. Keeping one copy avoids the seed and the offline fallback
 * drifting apart.
 */
export interface FaqSeedRecord {
  id: string;
  category: FaqCategoryValue;
  question: string;
  answer: string;
  questionMs: string;
  answerMs: string;
  displayOrder: number;
}

export const FAQ_SEED_CONTENT: readonly FaqSeedRecord[] = [
  // ---------------------------------------------------------------- ADOPTION
  {
    id: "faq-adopt-01",
    category: "ADOPTION",
    question: "How much does it cost to adopt a pet from Hope for Strays?",
    answer:
      "All of our adoptions are free of charge. We do not sell animals. Every adoption already includes spay/neuter surgery, core vaccinations (6-in-1 for dogs, FVRCP for cats), microchip registration, deworming, and tick and flea treatment. We do welcome a voluntary donation to help us cover the next rescue's medical bill, but it is never a condition of adoption and no adopter is ever turned away for declining.",
    questionMs: "Berapakah kos untuk mengadopsi haiwan dari Hope for Strays?",
    answerMs:
      "Semua adopsi kami adalah percuma. Kami tidak menjual haiwan. Setiap adopsi sudah merangkumi pembedahan pemandulan, vaksinasi teras (6-dalam-1 untuk anjing, FVRCP untuk kucing), pendaftaran mikrocip, nyahcacing, serta rawatan kutu dan pinjal. Kami mengalu-alukan sumbangan sukarela untuk menampung kos perubatan haiwan seterusnya, tetapi ia bukan syarat adopsi dan tiada pengadopsi ditolak kerana tidak menyumbang.",
    displayOrder: 0,
  },
  {
    id: "faq-adopt-02",
    category: "ADOPTION",
    question: "Do you carry out a home visit before approving an adoption?",
    answer:
      "Yes. After your application passes the initial review we arrange a home visit, either in person for homes within the Klang Valley or over a video call for applicants further afield. The visit is not an inspection of how tidy your home is. We are checking that balconies and windows are gridded or netted, that gates and fencing are secure, that the animal will live indoors with the family rather than chained outside, and that everyone in the household agrees to the adoption. Most visits take under thirty minutes.",
    questionMs: "Adakah anda menjalankan lawatan rumah sebelum meluluskan adopsi?",
    answerMs:
      "Ya. Selepas permohonan anda melepasi semakan awal, kami akan mengatur lawatan rumah, sama ada secara bersemuka bagi kediaman di Lembah Klang atau melalui panggilan video bagi pemohon yang jauh. Lawatan ini bukan pemeriksaan kekemasan rumah anda. Kami memastikan balkoni dan tingkap bergrill atau berjaring, pagar selamat, haiwan akan tinggal di dalam rumah bersama keluarga dan bukan dirantai di luar, serta semua ahli isi rumah bersetuju dengan adopsi ini. Kebanyakan lawatan mengambil masa kurang tiga puluh minit.",
    displayOrder: 1,
  },
  {
    id: "faq-adopt-03",
    category: "ADOPTION",
    question: "What are the eligibility requirements to adopt?",
    answer:
      "Adopters must be at least 21 years old and able to show proof of identity and address. If you rent, or live in a condominium, apartment or flat, we require written consent from your landlord or the building management, because many high-rise developments in Selangor restrict pet ownership. We also ask that you agree to post-adoption check-ins at one, three and six months, and that you commit to returning the animal to us rather than rehoming it independently if your circumstances ever change.",
    questionMs: "Apakah syarat kelayakan untuk mengadopsi?",
    answerMs:
      "Pengadopsi mestilah berumur sekurang-kurangnya 21 tahun dan boleh menunjukkan bukti pengenalan dan alamat. Jika anda menyewa, atau tinggal di kondominium, apartmen atau rumah pangsa, kami memerlukan kebenaran bertulis daripada tuan rumah atau pihak pengurusan bangunan, kerana banyak pembangunan bertingkat tinggi di Selangor mengehadkan pemilikan haiwan. Kami juga meminta anda bersetuju dengan susulan pada bulan pertama, ketiga dan keenam, serta berjanji memulangkan haiwan kepada kami dan bukan memindahkan miliknya sendiri sekiranya keadaan anda berubah.",
    displayOrder: 2,
  },
  {
    id: "faq-adopt-04",
    category: "ADOPTION",
    question: "How long does the adoption process take from application to homecoming?",
    answer:
      "Most applications are reviewed within one to two working days. Allowing for the home visit and a meet-and-greet at the sanctuary, the full process usually completes within one to two weeks. Applications for animals with ongoing medical treatment, or for puppies and kittens still completing their vaccination course, can take longer because we will not release an animal before its treatment is finished.",
    questionMs: "Berapa lamakah proses adopsi dari permohonan sehingga pulang ke rumah?",
    answerMs:
      "Kebanyakan permohonan disemak dalam tempoh satu hingga dua hari bekerja. Dengan mengambil kira lawatan rumah dan sesi suai kenal di santuari, keseluruhan proses biasanya selesai dalam satu hingga dua minggu. Permohonan bagi haiwan yang masih menerima rawatan perubatan, atau anak anjing dan anak kucing yang belum melengkapkan jadual vaksinasi, mungkin mengambil masa lebih lama kerana kami tidak melepaskan haiwan sebelum rawatannya selesai.",
    displayOrder: 3,
  },
  {
    id: "faq-adopt-05",
    category: "ADOPTION",
    question: "Can I bring my current dog to meet an adoptable dog first?",
    answer:
      "Please do, and we strongly encourage it for dog-to-dog placements. We run structured, supervised introductions in the outdoor compound at our Petaling Jaya sanctuary so both animals meet on neutral ground. Bring your dog's vaccination card, keep it on a non-retractable leash, and set aside about an hour. If the first meeting does not go well, that is useful information rather than a rejection, and our coordinators will help you consider a different match.",
    questionMs: "Bolehkah saya membawa anjing saya untuk bertemu anjing yang hendak diadopsi?",
    answerMs:
      "Silakan, malah kami amat menggalakkannya bagi penempatan anjing dengan anjing. Kami menjalankan sesi perkenalan berstruktur dan diselia di kawasan lapang santuari kami di Petaling Jaya supaya kedua-dua haiwan bertemu di tempat neutral. Bawa kad vaksinasi anjing anda, gunakan tali leher yang tidak boleh ditarik panjang, dan peruntukkan lebih kurang sejam. Jika pertemuan pertama kurang lancar, itu adalah maklumat berguna dan bukan penolakan, dan penyelaras kami akan membantu anda mempertimbangkan padanan lain.",
    displayOrder: 4,
  },

  // ----------------------------------------------------------- VOLUNTEERING
  {
    id: "faq-vol-01",
    category: "VOLUNTEERING",
    question: "How do I sign up to volunteer, and what is the minimum commitment?",
    answer:
      "Register your interest through the Volunteer & Foster section of this site and our coordinator will invite you to the next orientation, which we run on the first Saturday of each month at the sanctuary. Volunteers must be 18 or older to handle animals unsupervised; those aged 13 to 17 are welcome when accompanied by a parent or guardian. We ask for one four-hour shift a month so that the animals see familiar faces, but many of our volunteers come weekly.",
    questionMs: "Bagaimanakah cara mendaftar sebagai sukarelawan, dan apakah komitmen minimum?",
    answerMs:
      "Daftarkan minat anda melalui bahagian Sukarelawan & Jagaan Sementara di laman ini dan penyelaras kami akan menjemput anda ke orientasi seterusnya, yang diadakan pada Sabtu pertama setiap bulan di santuari. Sukarelawan mestilah berumur 18 tahun ke atas untuk mengendalikan haiwan tanpa penyeliaan; mereka yang berumur 13 hingga 17 tahun dialu-alukan jika ditemani ibu bapa atau penjaga. Kami memohon satu syif empat jam sebulan supaya haiwan mengenali wajah yang biasa, namun ramai sukarelawan kami hadir setiap minggu.",
    displayOrder: 0,
  },
  {
    id: "faq-vol-02",
    category: "VOLUNTEERING",
    question: "What does fostering involve, and who pays for the costs?",
    answer:
      "Fosterers take an animal into their home temporarily, most often a nursing mother with her litter, an under-socialised rescue, or a dog recovering from surgery that cannot rest properly in a kennel. Hope for Strays supplies the food, litter, crate and all veterinary care, and covers every medical cost for the duration of the placement. You supply the space, the routine and the patience. Placements typically run from two weeks to three months, and we never ask a fosterer to keep an animal longer than they agreed to.",
    questionMs: "Apakah yang terlibat dalam jagaan sementara, dan siapa menanggung kosnya?",
    answerMs:
      "Penjaga sementara membawa haiwan pulang ke rumah buat sementara waktu, selalunya ibu yang sedang menyusu bersama anaknya, haiwan yang kurang bersosial, atau anjing yang sedang pulih daripada pembedahan dan tidak dapat berehat dengan baik di kandang. Hope for Strays membekalkan makanan, pasir kucing, sangkar dan semua rawatan veterinar, serta menanggung setiap kos perubatan sepanjang tempoh penempatan. Anda menyediakan ruang, rutin dan kesabaran. Penempatan biasanya berlangsung dua minggu hingga tiga bulan, dan kami tidak sekali-kali meminta penjaga menyimpan haiwan lebih lama daripada yang dipersetujui.",
    displayOrder: 1,
  },
  {
    id: "faq-vol-03",
    category: "VOLUNTEERING",
    question: "Can my company or school arrange a group volunteering day?",
    answer:
      "Yes. We host corporate CSR groups and school or university societies, capped at fifteen people per session so the animals are not overwhelmed. A typical day covers kennel cleaning, enrichment activities, dog walking and a short talk on responsible pet ownership and TNRM. Please email us at least three weeks ahead so we can schedule enough staff supervision.",
    questionMs: "Bolehkah syarikat atau sekolah saya mengaturkan hari kesukarelawanan berkumpulan?",
    answerMs:
      "Boleh. Kami menerima kumpulan CSR korporat serta persatuan sekolah atau universiti, dihadkan kepada lima belas orang setiap sesi supaya haiwan tidak terganggu. Hari biasa merangkumi pembersihan kandang, aktiviti pengayaan, membawa anjing berjalan dan ceramah ringkas mengenai pemilikan haiwan bertanggungjawab serta TNRM. Sila e-mel kami sekurang-kurangnya tiga minggu lebih awal supaya kami dapat menyusun penyeliaan kakitangan yang mencukupi.",
    displayOrder: 2,
  },

  // ------------------------------------------------------------ ANIMAL_CARE
  {
    id: "faq-care-01",
    category: "ANIMAL_CARE",
    question: "I have found an injured stray. What should I do right now?",
    answer:
      "Call our shelter desk on 03-7876 5432 during operating hours and describe the animal's condition and exact location. If the animal is bleeding heavily, has been hit by a vehicle, or cannot stand, take it straight to the nearest veterinary clinic; tell them it is a rescue case and call us on the way so we can discuss the bill directly with the clinic. Do not attempt to move an animal that is growling, cowering or badly injured without gloves and a carrier, as frightened animals bite. Outside our hours, please contact an emergency veterinary hospital first and reach us the next morning.",
    questionMs: "Saya menjumpai haiwan terbiar yang cedera. Apakah yang perlu saya lakukan sekarang?",
    answerMs:
      "Hubungi meja santuari kami di 03-7876 5432 pada waktu operasi dan nyatakan keadaan haiwan serta lokasi tepatnya. Jika haiwan itu berdarah teruk, dilanggar kenderaan, atau tidak mampu berdiri, bawa terus ke klinik veterinar terdekat; beritahu mereka ia kes penyelamatan dan hubungi kami dalam perjalanan supaya kami boleh berbincang tentang bil terus dengan klinik. Jangan cuba mengalihkan haiwan yang menyalak, meringkuk ketakutan atau cedera parah tanpa sarung tangan dan bekas pembawa, kerana haiwan yang takut akan menggigit. Di luar waktu operasi, sila hubungi hospital veterinar kecemasan dahulu dan hubungi kami keesokan pagi.",
    displayOrder: 0,
  },
  {
    id: "faq-care-02",
    category: "ANIMAL_CARE",
    question: "What is TNRM and do you help with community cats and dogs?",
    answer:
      "TNRM stands for Trap-Neuter-Release-Manage. Community animals are humanely trapped, sterilised and vaccinated, ear-tipped so they are recognisable at a glance, then returned to the territory they know while a local feeder keeps an eye on them. It is the only method proven to reduce street populations humanely over time, because removing animals simply leaves a vacuum that unsterilised newcomers fill. We run TNRM drives across Petaling Jaya and can lend humane traps, share our subsidised clinic rates and coach first-time feeders through a colony plan. Contact us with the colony's location and a rough headcount to get started.",
    questionMs: "Apakah itu TNRM dan adakah anda membantu kucing serta anjing komuniti?",
    answerMs:
      "TNRM bermaksud Perangkap-Mandul-Lepas-Urus. Haiwan komuniti diperangkap secara berperikemanusiaan, dimandulkan dan divaksin, telinganya dipotong sedikit supaya mudah dikenali, kemudian dilepaskan semula ke kawasan yang dikenalinya sambil diawasi oleh pemberi makan tempatan. Ia satu-satunya kaedah yang terbukti mengurangkan populasi jalanan secara berperikemanusiaan, kerana memindahkan haiwan hanya meninggalkan ruang kosong yang akan diisi haiwan baharu yang tidak dimandulkan. Kami menjalankan program TNRM di seluruh Petaling Jaya dan boleh meminjamkan perangkap, berkongsi kadar klinik bersubsidi serta membimbing pemberi makan baharu menyusun pelan koloni. Hubungi kami dengan lokasi koloni dan anggaran bilangannya untuk bermula.",
    displayOrder: 1,
  },
  {
    id: "faq-care-03",
    category: "ANIMAL_CARE",
    question: "Can I surrender my pet to the shelter?",
    answer:
      "We accept owner surrenders only when we genuinely have space, and our kennels are usually full, so please contact us before bringing an animal to the sanctuary. Speak to a coordinator first: many surrenders are driven by a landlord dispute, a new baby, a behavioural problem or a vet bill, and we can often help you resolve the underlying issue and keep your pet at home. If surrender really is the only option, we will ask for the animal's vaccination and medical records and an honest account of its temperament, because accurate information is what lets us find the right next home rather than a failed placement.",
    questionMs: "Bolehkah saya menyerahkan haiwan peliharaan saya kepada santuari?",
    answerMs:
      "Kami menerima penyerahan daripada pemilik hanya apabila kami benar-benar mempunyai ruang, dan kandang kami selalunya penuh, jadi sila hubungi kami sebelum membawa haiwan ke santuari. Berbincang dengan penyelaras terlebih dahulu: banyak penyerahan berpunca daripada pertikaian dengan tuan rumah, kelahiran anak, masalah tingkah laku atau bil veterinar, dan selalunya kami dapat membantu anda menyelesaikan punca sebenar serta mengekalkan haiwan itu di rumah. Sekiranya penyerahan benar-benar satu-satunya pilihan, kami akan meminta rekod vaksinasi dan perubatan haiwan serta gambaran jujur tentang perangainya, kerana maklumat yang tepat membolehkan kami mencari rumah seterusnya yang sesuai dan mengelakkan penempatan yang gagal.",
    displayOrder: 2,
  },
  {
    id: "faq-care-04",
    category: "ANIMAL_CARE",
    question: "Are your animals vaccinated and sterilised before they go home?",
    answer:
      "Every animal leaves us sterilised, microchipped, vaccinated with the core course for its species, dewormed and treated for ticks and fleas. The only exception is a puppy or kitten too young for surgery: in that case we place it on a sterilisation undertaking, hold a refundable deposit, and book the procedure with our panel clinic once it reaches the right age and weight. You will receive the full medical record and microchip number at handover.",
    questionMs: "Adakah haiwan anda divaksin dan dimandulkan sebelum dibawa pulang?",
    answerMs:
      "Setiap haiwan meninggalkan kami dalam keadaan telah dimandulkan, bermikrocip, divaksin dengan jadual teras bagi spesiesnya, dinyahcacing serta dirawat kutu dan pinjal. Satu-satunya pengecualian ialah anak anjing atau anak kucing yang terlalu muda untuk pembedahan: dalam kes itu kami mengikatnya dengan akujanji pemandulan, menyimpan deposit yang boleh dikembalikan, dan menempah prosedur dengan klinik panel kami sebaik ia mencapai umur dan berat yang sesuai. Anda akan menerima rekod perubatan penuh dan nombor mikrocip semasa penyerahan.",
    displayOrder: 3,
  },

  // ----------------------------------------------------------- SHELTER_INFO
  {
    id: "faq-info-01",
    category: "SHELTER_INFO",
    question: "Where is the shelter and when can I visit?",
    answer:
      "Our sanctuary is at No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor. We are open to visitors Tuesday to Sunday, 10:00 AM to 5:00 PM, and closed every Monday for deep cleaning and veterinary rounds. No appointment is needed to browse, but if you have a particular animal in mind, message us ahead so we can make sure it is not already out on a meet-and-greet.",
    questionMs: "Di manakah lokasi santuari dan bilakah saya boleh melawat?",
    answerMs:
      "Santuari kami terletak di No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor. Kami dibuka kepada pelawat pada hari Selasa hingga Ahad, 10:00 pagi hingga 5:00 petang, dan ditutup setiap hari Isnin untuk pembersihan menyeluruh dan pemeriksaan veterinar. Tiada temu janji diperlukan untuk melihat-lihat, tetapi jika anda berminat dengan haiwan tertentu, hubungi kami lebih awal supaya kami dapat memastikan ia tidak sedang keluar untuk sesi suai kenal.",
    displayOrder: 0,
  },
  {
    id: "faq-info-02",
    category: "SHELTER_INFO",
    question: "How do I get to the sanctuary by public transport or car?",
    answer:
      "The sanctuary is a ten-minute walk from Taman Bahagia LRT station on the Kelana Jaya line, and several RapidKL bus routes stop along Jalan SS 2/24. If you are driving, free street parking is available along the service road, and there is a covered visitor bay beside the main gate reserved for adopters collecting an animal. E-hailing drop-offs should use the gate on Jalan SS 2/72 rather than the rear service lane, which is used by our transport van.",
    questionMs: "Bagaimanakah cara ke santuari menggunakan pengangkutan awam atau kereta?",
    answerMs:
      "Santuari ini sepuluh minit berjalan kaki dari stesen LRT Taman Bahagia di laluan Kelana Jaya, dan beberapa laluan bas RapidKL berhenti di sepanjang Jalan SS 2/24. Jika anda memandu, tempat letak kereta percuma tersedia di sepanjang jalan susur, dan terdapat petak pelawat berbumbung di sebelah pintu utama yang dikhaskan untuk pengadopsi yang datang mengambil haiwan. Pemandu e-hailing hendaklah menurunkan penumpang di pintu Jalan SS 2/72 dan bukan di lorong servis belakang, yang digunakan oleh van pengangkutan kami.",
    displayOrder: 1,
  },
  {
    id: "faq-info-03",
    category: "SHELTER_INFO",
    question: "Can I bring my children to visit the shelter?",
    answer:
      "Children are very welcome and we think meeting the animals teaches them a great deal, but they must stay with an adult at all times inside the kennel areas. Some of our residents are recent rescues that are still nervous around fast movement and loud noise, so our staff will point out which enclosures are suitable for young visitors on the day. We ask that children do not put fingers through the fencing.",
    questionMs: "Bolehkah saya membawa anak-anak melawat santuari?",
    answerMs:
      "Kanak-kanak amat dialu-alukan dan kami percaya pertemuan dengan haiwan mengajar mereka banyak perkara, tetapi mereka mesti sentiasa bersama orang dewasa di dalam kawasan kandang. Sebahagian penghuni kami ialah haiwan yang baru diselamatkan dan masih gementar dengan pergerakan pantas serta bunyi kuat, jadi kakitangan kami akan menunjukkan kandang yang sesuai untuk pelawat muda pada hari tersebut. Kami memohon agar kanak-kanak tidak memasukkan jari melalui pagar.",
    displayOrder: 2,
  },
] as const;

/**
 * The seed content projected into the runtime `FaqEntry` shape, used as the
 * offline fallback for the public page.
 */
export function getFallbackFaqs(): FaqEntry[] {
  const timestamp = new Date(0).toISOString();
  return FAQ_SEED_CONTENT.map((record) => ({
    id: record.id,
    category: record.category,
    question: record.question,
    answer: record.answer,
    questionMs: record.questionMs,
    answerMs: record.answerMs,
    displayOrder: record.displayOrder,
    isPublished: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}
