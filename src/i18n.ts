export type Lang = 'id' | 'en';

/** A piece of text in both languages. */
export type L = { id: string; en: string };

const LANG_KEY = 'sachet-migration:lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'id' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'id';
}

let lang: Lang = initialLang();

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    // ignore
  }
}

document.documentElement.lang = lang;

/** Picks the current language from an L, or passes a plain string through. */
export const tx = (v: L | string) => (typeof v === 'string' ? v : v[lang]);

const strings = {
  concept: { id: 'Konsep · data contoh', en: 'Concept · sample data' },
  navCheck: { id: 'Cek produk', en: 'Check' },
  navSavings: { id: 'Migrasi saya', en: 'My switches' },
  navWhy: { id: 'Kenapa?', en: 'Why?' },

  homeTitle: { id: 'Cek dulu sebelum beli', en: 'Check before you buy' },
  homeSub: {
    id: 'Pindai barcode, lalu lihat pilihan yang lebih murah dan sampahnya lebih sedikit.',
    en: 'Scan the barcode to find a cheaper choice with less trash.',
  },
  scan: { id: 'Pindai barcode', en: 'Scan barcode' },
  photo: { id: 'Dari foto', en: 'From photo' },
  stop: { id: 'Berhenti', en: 'Stop' },
  searchLabel: { id: 'Cari produk', en: 'Search products' },
  searchPh: { id: 'Cari produk, misalnya kopi', en: 'Search, e.g. coffee' },
  aim: { id: 'Arahkan kamera ke barcode.', en: 'Point the camera at the barcode.' },
  camFail: {
    id: 'Kamera tidak bisa dibuka. Coba "Dari foto" atau cari di bawah.',
    en: 'The camera is unavailable. Try "From photo" or search below.',
  },
  reading: { id: 'Membaca barcode…', en: 'Reading barcode…' },
  noCode: {
    id: 'Barcode tidak terbaca. Coba foto lebih dekat dan jelas.',
    en: 'No barcode found. Try a closer, sharper photo.',
  },
  unknownCode: {
    id: 'Barcode {code} terbaca, tapi produknya belum ada di daftar.',
    en: 'Read {code}, but that product isn’t on the list yet.',
  },
  notFound: { id: 'Belum ada di daftar.', en: 'Not on the list yet.' },
  tip: {
    id: '<b>Jangan beli sachet sekantong.</b> Per gelasnya lebih mahal, sampahnya lebih banyak.',
    en: '<b>Skip the bag of sachets.</b> It costs more per glass and makes more trash.',
  },
  tipMore: { id: 'Kenapa?', en: 'Why?' },
  products: { id: 'Daftar produk', en: 'Products' },
  productsHint: { id: 'Pilih yang biasa kamu beli.', en: 'Pick what you usually buy.' },

  back: { id: '← Kembali', en: '← Back' },
  per: { id: 'per {unit}', en: 'per {unit}' },
  usageBefore: { id: 'Saya pakai', en: 'I use' },
  buyIntro: {
    id: 'Kalau beli ini ({portions} {unit}), dibanding {usual} untuk jumlah yang sama:',
    en: 'Buying this ({portions} {units}) instead of {usual} for the same amount:',
  },
  addonIncluded: {
    id: 'Harga sudah termasuk {list}, supaya sama dengan produkmu.',
    en: 'Price includes {list}, to match your product.',
  },
  portionLabel: { id: 'Takaran:', en: 'Portion:' },
  mine: { id: '+ Ini produk saya', en: '+ This is my product' },
  mineDone: { id: 'Produk saya ✓ Pilih pengganti di bawah.', en: 'My product ✓ Pick a switch below.' },
  newMine: { id: 'Produk baru saya ✓', en: 'My new product ✓' },
  alreadySwitched: { id: 'Kamu sudah pindah ke <b>{name}</b>. Lihat migrasi saya →', en: 'You switched to <b>{name}</b>. See my switches →' },
  migrate: { id: 'Pindah ke ini', en: 'Switch to this' },
  toastMigrate: { id: 'Pindah ke <b>{name}</b>!', en: 'Switched to <b>{name}</b>!' },
  myProducts: { id: 'Produk saya', en: 'My products' },
  migEmpty: {
    id: 'Belum ada. Pindai produk yang biasa kamu beli, lalu tekan <b>Ini produk saya</b> atau <b>Pindah ke ini</b>.',
    en: 'Nothing yet. Scan a product you usually buy, then tap <b>This is my product</b> or <b>Switch to this</b>.',
  },
  notYet: { id: 'Belum pindah', en: 'Not switched yet' },
  seeOptions: { id: 'Lihat pilihan', en: 'See options' },
  fromTo: { id: 'Dulu: {from} → sekarang: {to}', en: 'Before: {from} → now: {to}' },
  boughtTimes: { id: 'Sudah beli {n}×', en: 'Bought {n}×' },
  again: { id: '+ Beli lagi', en: '+ Bought again' },
  totalSave: { id: 'Uang hemat', en: 'Money saved' },
  totalCost: { id: 'Lebih mahal', en: 'Extra cost' },
  totalPlastic: { id: 'Sampah plastik berkurang', en: 'Less plastic trash' },
  perUnit: { id: '{value} per {unit}', en: '{value} per {unit}' },
  trapGeneric: {
    id: '<b>Hati-hati, ini sachet sekantong.</b> {n} sachet ditambah kantong luarnya, totalnya <b>{g}</b> sampah plastik. Lihat pilihan di bawah.',
    en: '<b>Careful, this is a bag of sachets.</b> {n} sachets plus the outer bag make <b>{g}</b> of plastic trash. See the options below.',
  },
  estimateNote: {
    id: 'Angka sementara, belum diukur langsung.',
    en: 'Temporary number, not measured yet.',
  },
  noBigPack: {
    id: '<b>Belum ada kemasan besar</b> untuk produk ini di minimarket. Semua masih sachet.',
    en: '<b>No bigger pack</b> of this product at the minimarket. It only comes in sachets.',
  },
  wantBig: { id: 'Saya mau kemasan besar', en: 'I want a bigger pack' },
  wantBigDone: { id: 'Tercatat ✓ Jadi bukti permintaan untuk produsen', en: 'Logged ✓ Counts as demand for the brand' },
  calcTitle: { id: 'Hitung hemat sebulan', en: 'Work out monthly savings' },
  saveBuy: { id: 'Hemat {money}', en: 'Save {money}' },
  costBuy: { id: 'Lebih mahal {money}', en: '{money} more' },
  usageAfter: { id: '{unit} sebulan', en: '{units} a month' },
  fewer: { id: 'Kurangi', en: 'Fewer' },
  more: { id: 'Tambah', en: 'More' },
  monthSachets: {
    id: 'Sebulan: <b>{money}</b>, dan <b>{n} bungkus</b> jadi sampah.',
    en: 'Each month: <b>{money}</b>, and <b>{n} single-use packs</b> in the trash.',
  },
  monthPlastic: {
    id: 'Sebulan: <b>{money}</b>, dan <b>{g}</b> sampah plastik.',
    en: 'Each month: <b>{money}</b>, and <b>{g}</b> of plastic trash.',
  },
  trap: {
    id: '<b>Hati-hati, ini jebakan.</b> Dibanding beli {n} {ref}, ini cuma hemat {money}, tapi sampahnya lebih banyak. Pilih yang di bawah.',
    en: '<b>Careful, this is a trap.</b> Compared with buying {n} × {ref}, it only saves {money}, and it makes more trash. Pick one below.',
  },
  bulkNudge: {
    id: 'Mau beli <b>{bulk}</b>? Jangan. Dibanding {n} {pack}, cuma hemat {money}, sampahnya malah lebih banyak.',
    en: 'Thinking of the <b>{bulk}</b>? Don’t. Compared with {n} × {pack}, it only saves {money} and makes more trash.',
  },
  swaps: { id: 'Pilihan lebih baik', en: 'Better choices' },
  noSwaps: {
    id: 'Ini sudah pilihan dengan sampah paling sedikit di daftar.',
    en: 'This already makes the least trash on the list.',
  },
  hidden: {
    id: '{n} pilihan lain tidak ditampilkan karena sampahnya tidak lebih sedikit.',
    en: '{n} other option(s) hidden because they don’t make less trash.',
  },
  sameVariant: { id: 'Merek & rasa sama', en: 'Same brand & flavour' },
  sameBrand: { id: 'Merek sama', en: 'Same brand' },
  refillTitle: { id: 'Isi ulang tanpa sampah', en: 'Zero-waste refill' },
  refillAt: { id: 'Di {place}', en: 'At {place}' },
  zeroTrash: { id: 'Tanpa sampah plastik sama sekali', en: 'No plastic trash at all' },
  otherBrand: { id: 'Merek lain', en: 'Other brand' },
  comingLater: { id: 'Segera hadir', en: 'Coming later' },
  saveMonth: { id: 'Hemat {money} sebulan', en: 'Save {money} a month' },
  costMonth: { id: 'Lebih mahal {money} sebulan', en: '{money} more a month' },
  sachetsKept: { id: '{n} bungkus tidak jadi sampah', en: '{n} single-use packs kept out of the trash' },
  plasticKept: { id: 'Sampah plastik berkurang {g}', en: '{g} less plastic trash' },
  bought: { id: 'Saya beli ini', en: 'I bought this' },
  logged: { id: 'Tercatat ✓', en: 'Logged ✓' },
  showMath: { id: 'Lihat hitungannya', en: 'Show the math' },
  mPrice: { id: 'Harga per {unit}', en: 'Price per {unit}' },
  mPlastic: { id: 'Plastik per {unit}', en: 'Plastic per {unit}' },
  mCheaper: { id: 'Lebih murah', en: 'Cheaper by' },
  mPricier: { id: 'Lebih mahal', en: 'Pricier by' },
  mLessPlastic: { id: 'Plastik berkurang', en: 'Less plastic' },
  mWaste: {
    id: 'Tetap lebih murah walau {pct} terbuang',
    en: 'Still cheaper even if {pct} is wasted',
  },
  mVs: { id: 'dibanding {name}', en: 'vs {name}' },

  toastSave: { id: 'Hemat <b>{money}</b>', en: 'You save <b>{money}</b>' },
  toastCost: { id: 'Lebih mahal <b>{money}</b>', en: '<b>{money}</b> more' },
  toastSachets: { id: ', {n} bungkus tidak jadi sampah.', en: ', {n} single-use packs kept out of the trash.' },
  toastPlastic: { id: ', sampah plastik berkurang {g}.', en: ', {g} less plastic trash.' },
  seeTotal: { id: 'Lihat total', en: 'See total' },

  rTitle: { id: 'STRUK HEMAT', en: 'SAVINGS RECEIPT' },
  rSub: { id: 'Dibanding tetap beli produk lama', en: 'Compared with sticking to your old products' },
  rMoney: { id: 'Uang dihemat', en: 'Money saved' },
  rSachets: { id: 'Bungkus tidak jadi sampah', en: 'Packs kept out of trash' },
  rPlastic: { id: 'Sampah plastik berkurang', en: 'Plastic trash avoided' },
  rCount: { id: 'Produk yang sudah pindah', en: 'Products switched' },
  rFoot: { id: 'Terima kasih sudah pindah dari sachet', en: 'Thanks for moving off sachets' },
  share: { id: 'Bagikan ke WhatsApp', en: 'Share on WhatsApp' },
  shareText: {
    id: 'Saya sudah hemat {money} dan {n} bungkus tidak jadi sampah, cuma dengan ganti kemasan. Cek produkmu di sini: {url}',
    en: 'I’ve saved {money} and kept {n} single-use packs out of the trash just by switching packs. Check yours here: {url}',
  },
  myPurchases: { id: 'Belanjaan saya', en: 'My purchases' },
  empty: {
    id: 'Belum ada catatan. Buka produk, pilih yang lebih hemat, lalu tekan <b>Saya beli ini</b>.',
    en: 'Nothing logged yet. Open a product, pick a better choice and tap <b>I bought this</b>.',
  },
  example: { id: 'Contoh', en: 'Example' },
  insteadOf: { id: 'ganti dari {name}', en: 'instead of {name}' },
  remove: { id: 'Hapus', en: 'Remove' },
  logTitle: { id: 'Catat belanja sebelumnya', en: 'Log an earlier purchase' },
  fBought: { id: 'Saya beli', en: 'I bought' },
  fInstead: { id: 'Biasanya saya beli', en: 'I usually buy' },
  fQty: { id: 'Berapa bungkus', en: 'How many' },
  fDate: { id: 'Kapan', en: 'When' },
  fSubmit: { id: 'Catat', en: 'Log it' },

  whyTitle: { id: 'Kenapa ini berhasil', en: 'Why this works' },
  why1Title: { id: 'Jangan beli sachet sekantong', en: 'Skip the bag of sachets' },
  why1: {
    id: 'MILO sekantong isi 18 sachet kelihatannya seperti beli banyak biar murah. Padahal tidak. MILO kemasan 790 g bisa jadi <b>{glasses} gelas</b> (takaran sama seperti sachet). Dibanding membuat jumlah yang sama dari sachet, kamu <b>hemat {money}</b> dan sampah plastiknya <b>berkurang {g}</b>.',
    en: 'A MILO bag of 18 sachets looks like buying in bulk. It isn’t. The 790 g MILO pack makes <b>{glasses} glasses</b> (same portion as a sachet). Compared with making the same amount from sachets, you <b>save {money}</b> and cut <b>{g}</b> of plastic trash.',
  },
  why1b: {
    id: 'Tidak perlu aplikasi untuk yang satu ini. Cukup ingat aturannya.',
    en: 'No app needed for this one. Just remember the rule.',
  },
  why2Title: { id: 'Bandingkan untuk jumlah yang sama', en: 'Compare the same amount' },
  why2: {
    id: 'Sekantong sachet dan kemasan besar susah dibandingkan dari label harga. Aplikasi ini menghitung: kalau kamu beli kemasan besar, berapa harga dan sampahnya kalau jumlah yang sama dibuat dari produk lamamu. Takarannya dibuat sama, dan kalau perlu tambahan seperti susu bubuk, harganya sudah dihitung.',
    en: 'A bag of sachets and a big pack are hard to compare by price tag. The app works out what the same amount would cost, and how much trash it would make, from your old product. Portions are matched, and extras like milk powder are included.',
  },
  why3Title: { id: 'Segera hadir: isi ulang tanpa plastik', en: 'Coming later: plastic-free refills' },
  why3: {
    id: 'Langkah berikutnya: tempat isi ulang di dekat rumah. Bawa wadah sendiri, tanpa bungkus plastik sama sekali.',
    en: 'Next step: refill stations near home. Bring your own container, with no plastic packaging at all.',
  },
  why4Title: { id: 'Tentang angka-angkanya', en: 'About the numbers' },
  why4: {
    id: 'Harga, ukuran, dan berat kemasan di sini adalah perkiraan contoh untuk konsep ini. Barcode yang diawali 8990000 hanya contoh. Belanjaanmu hanya disimpan di HP ini.',
    en: 'Prices, pack sizes and packaging weights are sample estimates for this concept. Barcodes starting 8990000 are placeholders. Your purchases are saved only on this phone.',
  },
  zeroPlastic: { id: '0 g plastik', en: '0 g plastic' },
} satisfies Record<string, L>;

export type StringKey = keyof typeof strings;

/** Translated UI string with {placeholders} filled in. */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return strings[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
