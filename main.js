// ================================================================
//  Vua Vỉa Hè — mô phỏng buôn bán hàng rong trong khu phố
//  Lối chơi theo game Hàng Rong trên Zing Me: gian hàng trong khu phố,
//  chợ đầu mối, hàng xóm, công an phường, dân anh chị, quán cà phê.
// ================================================================
let W = 1280;            // bề rộng khung hình, co giãn theo màn hình
const H = 720, SW = 1280; // SW: bề rộng các cảnh cố định (nhà, chợ, cà phê, hồ câu)
const GROUND = 420;          // chân tường dãy nhà
const CURB = 600;            // mép vỉa hè
const WALK_Y0 = 522, WALK_Y1 = 592;   // dải vỉa hè nhân vật đi được
const STALL_X = 640, STALL_Y = 560;   // khung tọa độ gốc để vẽ một sạp
const STALL_BASE = 510, STALL_SCALE = 0.92;
const GIAN_W = 400, STREET_PAD = 120;
const STREET_W = STREET_PAD * 2 + GIAN_W * 6;   // khu phố dài hơn 2 màn hình
const gx = (i) => STREET_PAD + GIAN_W * (i + 0.5);

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

// ---------- Tiện ích ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (n) => Math.round(n).toLocaleString('vi-VN') + 'đ';
const fmtK = (n) => (n >= 1000000 ? (Math.round(n / 100000) / 10).toString().replace('.', ',') + 'tr' : n >= 1000 ? Math.round(n / 1000) + 'k' : Math.round(n) + 'đ');
const now = () => Date.now();
const clock = (t = now()) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; }
function shade(hex, amt) { const [r, g, b] = hexRgb(hex); return `rgb(${clamp(r + amt, 0, 255)},${clamp(g + amt, 0, 255)},${clamp(b + amt, 0, 255)})`; }
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
function emoji(g, ch, x, y, size) { g.font = `${size}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Dữ liệu ----------
// t = số giây để bán được 1 món trên gánh cơ bản
const GOODS = {
  tra_da:    { name: 'Trà đá',       icon: '🧊', buy: 500,   sell: 1500,   t: 5,   lvl: 1 },
  kem_chuoi: { name: 'Kem chuối',    icon: '🍌', buy: 1500,  sell: 4000,   t: 8,   lvl: 1 },
  bap:       { name: 'Bắp luộc',     icon: '🌽', buy: 2500,  sell: 6000,   t: 10,  lvl: 2 },
  banh_mi:   { name: 'Bánh mì',      icon: '🥖', buy: 6000,  sell: 13000,  t: 16,  lvl: 3 },
  keo_bong:  { name: 'Kẹo bông gòn', icon: '🍭', buy: 3000,  sell: 8000,   t: 11,  lvl: 4 },
  xoi:       { name: 'Xôi gấc',      icon: '🍙', buy: 5000,  sell: 12000,  t: 14,  lvl: 5 },
  nuoc_mia:  { name: 'Nước mía',     icon: '🥤', buy: 4000,  sell: 10000,  t: 12,  lvl: 6 },
  hot_vit:   { name: 'Hột vịt lộn',  icon: '🥚', buy: 5000,  sell: 13000,  t: 15,  lvl: 7 },
  do_choi:   { name: 'Đồ chơi',      icon: '🪀', buy: 15000, sell: 35000,  t: 34,  lvl: 8 },
  non:       { name: 'Nón vải',      icon: '👒', buy: 25000, sell: 60000,  t: 50,  lvl: 9 },
  ao_thun:   { name: 'Áo thun',      icon: '👕', buy: 40000, sell: 95000,  t: 70,  lvl: 11 },
  giay:      { name: 'Giày bata',    icon: '👟', buy: 60000, sell: 140000, t: 90,  lvl: 13 },
  kinh:      { name: 'Kính mát',     icon: '🕶️', buy: 50000, sell: 130000, t: 80,  lvl: 15 },
  tui:       { name: 'Túi xách',     icon: '👜', buy: 90000, sell: 220000, t: 120, lvl: 17 },
};
const GOOD_IDS = Object.keys(GOODS);

const STALLS = {
  ganh:   { name: 'Gánh hàng', cap: 20,   speed: 1,    price: 0,       lvl: 1 },
  xe_day: { name: 'Xe đẩy',    cap: 45,  speed: 1.2,  price: 80000,   lvl: 2 },
  sap:    { name: 'Sạp gỗ',    cap: 80,  speed: 1.45, price: 300000,  lvl: 5 },
  kiot:   { name: 'Ki-ốt',     cap: 150, speed: 1.8,  price: 1200000, lvl: 9 },
};
const STALL_ORDER = ['ganh', 'xe_day', 'sap', 'kiot'];
const DECOR = {
  du:   { name: 'Dù che nắng', price: 30000,  lvl: 1, desc: 'Bán nhanh hơn 10%' },
  ghe:  { name: 'Ghế nhựa đỏ', price: 50000,  lvl: 2, desc: 'Bán nhanh hơn 10%' },
  phep: { name: 'Giấy phép',   price: 200000, lvl: 3, desc: 'Công an kiểm tra không bị phạt' },
  bang: { name: 'Bảng hiệu',   price: 120000, lvl: 4, desc: 'Giá bán cao hơn 10%' },
};
const GIAN_COST = [[0, 1], [40000, 2], [150000, 4], [400000, 6], [900000, 9], [2000000, 11]];
const STREET2 = { price: 3000000, lvl: 12 };
const KHO = [{ cap: 100, price: 0, lvl: 1 }, { cap: 200, price: 100000, lvl: 3 }, { cap: 400, price: 400000, lvl: 6 }, { cap: 800, price: 1500000, lvl: 10 }, { cap: 1500, price: 4000000, lvl: 14 }];

// Trang phục: hat = kiểu nón, color/style = áo, color/short = quần, shoes = màu giày, acc = kiểu phụ kiện
const FASHION = {
  non_la:     { slot: 'hat',   name: 'Nón lá',          price: 20000,  lvl: 1,  beauty: 1, hat: 1 },
  mu_bao_hiem:{ slot: 'hat',   name: 'Mũ bảo hiểm',     price: 60000,  lvl: 1,  health: 1, hat: 2 },
  non_ket:    { slot: 'hat',   name: 'Nón kết',         price: 40000,  lvl: 2,  health: 1, hat: 3 },
  mu_tai_beo: { slot: 'hat',   name: 'Mũ tai bèo',      price: 90000,  lvl: 6,  beauty: 2, health: 1, hat: 4 },
  ao_ba_ba:   { slot: 'shirt', name: 'Áo bà ba',        price: 50000,  lvl: 1,  beauty: 2, color: '#4B5E8C' },
  ao_ba_lo:   { slot: 'shirt', name: 'Áo ba lỗ',        price: 70000,  lvl: 3,  health: 2, color: '#F2F2EE', style: 'tank' },
  ao_hoa:     { slot: 'shirt', name: 'Sơ mi hoa',       price: 110000, lvl: 4,  beauty: 3, color: '#2A9D8F', style: 'flower' },
  so_mi:      { slot: 'shirt', name: 'Sơ mi trắng',     price: 150000, lvl: 5,  intel: 3,  color: '#E9EEF5', style: 'collar' },
  ao_dai:     { slot: 'shirt', name: 'Áo dài đỏ',       price: 500000, lvl: 10, beauty: 6, color: '#C0392B', style: 'aodai' },
  quan_dui:   { slot: 'pants', name: 'Quần đùi',        price: 20000,  lvl: 1,  health: 1, color: '#3E7CB1', short: true },
  quan_jean:  { slot: 'pants', name: 'Quần jean',       price: 120000, lvl: 3,  beauty: 1, health: 1, color: '#2F4A7A' },
  quan_tay:   { slot: 'pants', name: 'Quần tây',        price: 200000, lvl: 6,  intel: 2,  color: '#3A3A40' },
  dep_to_ong: { slot: 'shoes', name: 'Dép tổ ong',      price: 15000,  lvl: 1,  health: 1, shoes: '#3E7CB1' },
  guoc_moc:   { slot: 'shoes', name: 'Guốc mộc',        price: 120000, lvl: 5,  beauty: 2, shoes: '#8C6A3A' },
  giay_bata:  { slot: 'shoes', name: 'Giày bata',       price: 160000, lvl: 4,  health: 3, shoes: '#F2F2EE' },
  khan_ran:   { slot: 'acc',   name: 'Khăn rằn',        price: 40000,  lvl: 2,  beauty: 1, acc: 'scarf' },
  so_tay:     { slot: 'acc',   name: 'Sổ tay ghi nợ',   price: 90000,  lvl: 3,  intel: 2,  acc: 'book' },
  kinh_can:   { slot: 'acc',   name: 'Kính cận',        price: 220000, lvl: 6,  intel: 4,  acc: 'glasses' },
  vong_tay:   { slot: 'acc',   name: 'Vòng tay gỗ',     price: 300000, lvl: 8,  beauty: 2, health: 2, acc: 'bracelet' },
};
const SLOT_NAMES = { hat: 'Nón', shirt: 'Áo', pants: 'Quần', shoes: 'Giày dép', acc: 'Phụ kiện' };

// ---------- Câu cá ----------
const FISH = {
  giay: { name: 'Giày rách',        icon: '🥾', kg: [0.3, 0.6],  perKg: 0,      w: 10,  rod: 0, junk: true },
  ro:   { name: 'Cá rô đồng',       icon: '🐟', kg: [0.1, 0.4],  perKg: 30000,  w: 34,  rod: 0 },
  tom:  { name: 'Tôm càng',         icon: '🦐', kg: [0.05, 0.2], perKg: 120000, w: 12,  rod: 0, bait: { tep: 2 } },
  cua:  { name: 'Cua đồng',         icon: '🦀', kg: [0.1, 0.3],  perKg: 60000,  w: 12,  rod: 0, bait: { giun: 1.6 } },
  tre:  { name: 'Cá trê',           icon: '🐟', kg: [0.3, 1.2],  perKg: 45000,  w: 16,  rod: 1, bait: { cam: 2 } },
  chep: { name: 'Cá chép',          icon: '🐠', kg: [0.5, 3],    perKg: 60000,  w: 12,  rod: 1, bait: { cam: 2.5 } },
  loc:  { name: 'Cá lóc',           icon: '🐟', kg: [0.6, 2.5],  perKg: 80000,  w: 9,   rod: 2, bait: { tep: 2.5 } },
  koi:  { name: 'Cá koi',           icon: '🎏', kg: [1, 4],      perKg: 150000, w: 3,   rod: 2, bait: { dacbiet: 3 } },
  rua:  { name: 'Rùa vàng',         icon: '🐢', kg: [1, 3],      perKg: 200000, w: 1.5, rod: 3, bait: { tep: 2, dacbiet: 3 } },
  rong: { name: 'Cá chép hóa rồng', icon: '🐉', kg: [5, 9],      perKg: 400000, w: 0.4, rod: 3, bait: { dacbiet: 4 } },
};
const RODS = {
  tre:    { name: 'Cần tre',    tier: 0, price: 0,       lvl: 1, window: 1,    wait: 1 },
  truc:   { name: 'Cần trúc',   tier: 1, price: 80000,   lvl: 2, window: 1.25, wait: 0.9 },
  may:    { name: 'Cần máy',    tier: 2, price: 400000,  lvl: 5, window: 1.5,  wait: 0.8 },
  carbon: { name: 'Cần carbon', tier: 3, price: 1500000, lvl: 9, window: 1.8,  wait: 0.7 },
};
const BAITS = {
  giun:    { name: 'Giun đất',      price: 1000,  icon: '🪱' },
  cam:     { name: 'Cám thơm',      price: 3000,  icon: '🌾' },
  tep:     { name: 'Tôm tép',       price: 6000,  icon: '🦐' },
  dacbiet: { name: 'Mồi bí truyền', price: 20000, icon: '✨' },
};
const BASKET_CAP = 20;

const NB_BASE = [
  { id: 'co_ba',   name: 'Cô Ba Bánh Mì',   sly: false, lvl: 6,  friend: 45, goods: ['banh_mi', 'tra_da', 'xoi'],         color: '#C0392B' },
  { id: 'chu_bay', name: 'Chú Bảy Xe Ôm',   sly: false, lvl: 4,  friend: 35, goods: ['tra_da', 'bap', 'kem_chuoi'],       color: '#1F6F8B' },
  { id: 'ti_sun',  name: 'Tí Sún',          sly: true,  lvl: 5,  friend: 20, goods: ['keo_bong', 'do_choi', 'kem_chuoi'], color: '#D98E04' },
  { id: 'chi_hai', name: 'Chị Hai Lúa',     sly: true,  lvl: 8,  friend: 25, goods: ['non', 'ao_thun', 'nuoc_mia'],       color: '#7A3E9D' },
  { id: 'anh_nam', name: 'Anh Năm Sài Gòn', sly: false, lvl: 10, friend: 30, goods: ['hot_vit', 'nuoc_mia', 'giay'],      color: '#2E7D4F' },
];
// ngoại hình cố định của từng hàng xóm (dùng ở quán cà phê, khu phố của họ, hồ câu)
const NB_LOOKS = {
  co_ba:   { skin: '#E0AC80', hair: '#1E1A1A', long: true,  hat: 1, shirt: '#C0392B', pants: '#231A14' },
  chu_bay: { skin: '#C68B5E', hair: '#2B211C', long: false, hat: 2, helmet: '#1F6F8B', shirt: '#6BA368', pants: '#3D405B' },
  ti_sun:  { skin: '#E0AC80', hair: '#1E1A1A', long: false, hat: 3, capColor: '#D98E04', shirt: '#F7B32B', pants: '#3E7CB1', short: true },
  chi_hai: { skin: '#F1C9A5', hair: '#3B2A20', long: true,  hat: 0, shirt: '#7A3E9D', pants: '#264653', acc: 'bracelet' },
  anh_nam: { skin: '#C68B5E', hair: '#1E1A1A', long: false, hat: 0, shirt: '#E9EEF5', style: 'collar', pants: '#3A3A40', acc: 'glasses' },
};
const NB_LINES = {
  honest: ['Hôm nay bán cũng được, đủ tiền chợ.', 'Ai mà vứt rác bậy bạ quá trời.', 'Có gì cần cứ kêu một tiếng nha!', 'Buôn có bạn, bán có phường mà.', 'Bữa nay mối hàng lên giá quá.'],
  sly: ['Hàng tui rẻ nhất khu này đó nghen.', 'Gian bên cạnh ế ghê, hehe.', 'Làm ăn phải có mánh chớ!', 'Công an hỏi thì nói không biết nha.', 'Mấy bữa nay ai chôm tiền két tui vậy?'],
};
const THUGS = ['Anh Hai Bẹo', 'Anh Ba Xăm', 'Anh Tư Sẹo', 'Anh Sáu Mập'];

const TITLES = ['Người bán dạo', 'Hàng rong tập sự', 'Gánh hàng quen mặt', 'Tay rao có nghề', 'Chủ gánh đầu hẻm', 'Chủ sạp khu phố',
  'Tay buôn có số má', 'Trùm chợ đầu mối', 'Anh chị vỉa hè', 'Đại gia hàng rong', 'Vua Vỉa Hè'];
const titleOf = (l) => TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 2))];
const MAX_LVL = 21;
const xpNeed = (l) => Math.round(60 * Math.pow(l, 1.5));

const SHOP_NAMES = ['TẠP HÓA', 'PHỞ BÒ', 'SỬA XE', 'CƠM TẤM', 'TIỆM VÀNG', 'HỦ TIẾU', 'NHÀ THUỐC', 'GỘI ĐẦU', 'BÚN BÒ', 'CÀ PHÊ',
  'KARAOKE', 'IN ẤN', 'ĐIỆN THOẠI', 'BÁNH CUỐN', 'PHOTOCOPY', 'VÁ XE', 'MAY ĐO', 'ỐC LUỘC'];
const HOUSE_COLORS = ['#F2C14E', '#E8875B', '#7FB3A6', '#E6D3A3', '#C9B6E4', '#F4A6A6', '#9CC5A1', '#F7E1A0', '#A7C7E7', '#E9B98B'];
const SHUTTER = ['#3F7F6F', '#2F5D8A', '#8C4A2F', '#5B7F3A', '#6B4E8C'];
const SIGN_COLORS = ['#C0392B', '#1F6F8B', '#C98404', '#2E7D4F', '#7A3E9D', '#B03A6F'];
const SHIRTS = ['#E84A5F', '#3E7CB1', '#F7B32B', '#6BA368', '#8E6FB5', '#EE8434', '#2A9D8F', '#F2F2EE', '#D1495B', '#577590'];
const PANTS = ['#2F3E46', '#3D405B', '#5C4D3C', '#1D3557', '#6D6875', '#264653'];
const BIKE_COLORS = ['#C0392B', '#1F6F8B', '#F2F2EE', '#2E2E33', '#D98E04', '#6BA368', '#8E6FB5'];
const HELMETS = ['#C0392B', '#F7B32B', '#1F6F8B', '#F2F2EE', '#2E2E33', '#E84A5F'];
const SELLER_SHIRTS = ['#4B5E8C', '#7B4B2A', '#2E7D4F', '#8E3B46', '#5B4A8A', '#3E6E8E'];

// ---------- Âm thanh ----------
const Snd = {
  ac: null, on: true,
  init() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ac = null; } }
    this.ac?.resume?.();
  },
  tone(f, d, type = 'square', v = 0.05, t0 = 0) {
    if (!this.on || !this.ac) return;
    const t = this.ac.currentTime + t0;
    const o = this.ac.createOscillator(), gn = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn).connect(this.ac.destination); o.start(t); o.stop(t + d + 0.02);
  },
  coin() { this.tone(988, 0.07, 'square', 0.04); this.tone(1319, 0.2, 'square', 0.04, 0.06); },
  bad() { this.tone(240, 0.16, 'sawtooth', 0.04); this.tone(170, 0.22, 'sawtooth', 0.04, 0.12); },
  click() { this.tone(660, 0.05, 'triangle', 0.05); },
  buy() { this.tone(520, 0.05, 'triangle', 0.05); this.tone(780, 0.07, 'triangle', 0.04, 0.04); },
  sweep() { this.tone(900, 0.05, 'triangle', 0.03); this.tone(700, 0.05, 'triangle', 0.03, 0.05); },
  siren() { for (let i = 0; i < 3; i++) { this.tone(740, 0.22, 'square', 0.035, i * 0.44); this.tone(988, 0.22, 'square', 0.035, i * 0.44 + 0.22); } },
  level() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.04, i * 0.1)); },
};

// ---------- Trạng thái ----------
const SAVE_KEY = 'vuaviahe_khupho_v2';
// Mỗi gian có 6 ô hàng; nâng cấp sạp thì mở thêm ô và mỗi ô chứa được nhiều hơn
const SLOT_OPEN = { ganh: 2, xe_day: 3, sap: 4, kiot: 6 };
const SLOT_CAP = { ganh: 10, xe_day: 15, sap: 20, kiot: 25 };
const emptySlots = () => Array.from({ length: 6 }, () => ({ good: null, qty: 0, prog: 0 }));
function newGian(open) { return { open, stall: 'ganh', slots: emptySlots(), cash: 0, trash: 0, rat: false, broken: false, du: false, ghe: false, bang: false, phep: false, pausedUntil: 0 }; }
const slotsOpen = (G) => SLOT_OPEN[G.stall];
const slotCap = (G) => SLOT_CAP[G.stall];
const gQty = (G) => G.slots.reduce((a, s, k) => a + (k < slotsOpen(G) ? s.qty : 0), 0);
const gGoods = (G) => [...new Set(G.slots.filter((s, k) => k < slotsOpen(G) && s.qty > 0).map((s) => s.good))];
function newNeighbor(b) {
  const n = 2 + Math.min(4, Math.floor(b.lvl / 3));
  return { id: b.id, friend: b.friend, lvl: b.lvl, lastTreat: 0, lastVisit: 0,
    gians: Array.from({ length: 6 }, (_, i) => ({ open: i < n, good: b.goods[i % b.goods.length], cash: Math.round(rand(3000, 20000)), trash: 0, rat: false, stall: STALL_ORDER[Math.min(3, Math.floor(b.lvl / 4))] })) };
}
function freshState() {
  const t = now();
  const s = {
    v: 2, money: 120000, xp: 0, level: 1, energy: 20, energyAt: t, karma: 0,
    kho: { kem_chuoi: 10, tra_da: 20 }, khoLvl: 0,
    streets: [{ gians: Array.from({ length: 6 }, (_, i) => newGian(i === 0)) }], cur: 0,
    debt: 0, debtAt: t, prices: {}, prevPrices: {}, pricesAt: 0,
    player: { name: 'Bạn' },
    outfit: { hat: 'non_la', shirt: null, pants: null, shoes: null, acc: null }, owned: ['non_la'],
    fishing: { rod: 'tre', rods: ['tre'], bait: { giun: 10 }, use: 'giun', basket: [], book: {} },
    neighbors: NB_BASE.map(newNeighbor), news: [], lastTick: t, tips: {},
    stats: { sold: 0, earned: 0, stolen: 0, cleaned: 0, fines: 0 },
  };
  s.streets[0].gians[0].slots[0] = { good: 'kem_chuoi', qty: 10, prog: 0 };
  return s;
}
let S = freshState();
const R = {
  view: 'street', visit: null, tool: 'hand', started: false, attract: true, modal: null, modalArg: null,
  bgCache: {}, t: 0, walkers: [], buyers: [], bikes: [], parts: [], police: null, hits: [], hover: null,
  nextPolice: rand(120, 220), nextThug: rand(260, 420), nextNb: rand(40, 80), saveT: 0, hudT: 0, newConfirm: false,
  me: { x: 300, y: 560, tx: 300, ty: 560, dir: 1, moving: false, phase: 0, then: null, sit: null }, cam: 0, keys: new Set(), visitors: [], edgeLock: 0,
  cafeSay: {}, cafeT: 0,
  clouds: Array.from({ length: 6 }, () => ({ x: rand(0, W), y: rand(40, 200), s: rand(0.6, 1.4) })),
  stars: Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, 300), r: rand(0.6, 1.6) })),
  credit: false, unread: 0,
  fish: { state: 'idle', t: 0, fx: 780, fy: 560, nib: 0, catch: null },
  chat: [],
  ripples: [],
};

const stat = (k) => Object.values(S.outfit).reduce((a, id) => a + (id ? FASHION[id][k] || 0 : 0), 0);
const energyMax = () => 20 + stat('health') * 2;
const khoCap = () => KHO[S.khoLvl].cap;
const khoCount = () => Object.values(S.kho).reduce((a, b) => a + b, 0);
const creditLimit = () => Math.round(50000 * S.level * (1 + stat('intel') * 0.05));
const allGians = () => S.streets.flatMap((st, si) => st.gians.map((g, i) => ({ g, si, i })));
const nbBase = (id) => NB_BASE.find((b) => b.id === id);
const nbState = (id) => S.neighbors.find((n) => n.id === id);
const realHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

function gianMult(G, si) {
  if (!G.open || G.broken || G.pausedUntil > now()) return 0;
  let m = STALLS[G.stall].speed * (1 + (G.du ? 0.1 : 0) + (G.ghe ? 0.1 : 0));
  m *= 1 - 0.15 * Math.min(3, G.trash);
  if (G.rat) m *= 0.5;
  m *= 1 + stat('beauty') * 0.02;
  if (S.karma >= 20) m *= 1.05;
  if (si === 1) m *= 1.3;
  const h = realHour();
  if (h < 5 || h >= 23) m *= 0.5;
  return m;
}
// tổng số món bán được mỗi giây của cả gian (các ô bán song song)
function gianRate(G, si) {
  const m = gianMult(G, si);
  if (!m) return 0;
  return G.slots.reduce((a, s, k) => a + (k < slotsOpen(G) && s.qty > 0 ? m / GOODS[s.good].t : 0), 0);
}
const unitPrice = (G, good) => Math.round(GOODS[good].sell * (G.bang ? 1.1 : 1));

function rollPrices() {
  S.prevPrices = { ...S.prices };
  const intel = stat('intel');
  for (const id of GOOD_IDS) S.prices[id] = Math.max(100, Math.round((GOODS[id].buy * rand(0.85, 1.15) * (1 - 0.01 * intel)) / 100) * 100);
  if (!Object.keys(S.prevPrices).length) S.prevPrices = { ...S.prices };
  S.pricesAt = now();
}

function save() { try { S.lastTick = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* bỏ qua */ } }
function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function applySave(d) {
  const f = freshState();
  S = { ...f, ...d, stats: { ...f.stats, ...(d.stats || {}) }, outfit: { ...f.outfit, ...(d.outfit || {}) }, tips: { ...(d.tips || {}) },
    player: { ...f.player, ...(d.player || {}) }, fishing: { ...f.fishing, ...(d.fishing || {}) } };
  for (const slot of Object.keys(S.outfit)) if (S.outfit[slot] && !FASHION[S.outfit[slot]]) S.outfit[slot] = null;
  if (!RODS[S.fishing.rod]) S.fishing.rod = 'tre';
  if (!Array.isArray(S.streets) || !S.streets.length) S.streets = f.streets;
  S.streets.forEach((st) => {
    st.gians = st.gians.map((g) => {
      const n = { ...newGian(false), ...g };
      if (!Array.isArray(g.slots)) { n.slots = emptySlots(); if (g.good && g.qty) n.slots[0] = { good: g.good, qty: g.qty, prog: g.prog || 0 }; }
      delete n.good; delete n.qty; delete n.prog;
      return n;
    });
  });
  const have = new Set((S.neighbors || []).map((n) => n.id));
  S.neighbors = [...(S.neighbors || []).filter((n) => nbBase(n.id)), ...NB_BASE.filter((b) => !have.has(b.id)).map(newNeighbor)];
  if (!KHO[S.khoLvl]) S.khoLvl = 0;
  if (S.cur >= S.streets.length) S.cur = 0;
  if (!Object.keys(S.prices || {}).length) rollPrices();
}

// ---------- Tin tức, thông báo ----------
function news(text, kind = '') {
  S.news.unshift({ t: now(), text, kind });
  S.news.length = Math.min(S.news.length, 40);
  R.unread++;
  if (R.started) renderDock();
}
function toast(msg, kind = '') {
  const area = $('toasts');
  while (area.children.length >= 4) area.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  area.append(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4100);
}

// ---------- Mô phỏng bán hàng ----------
function tickGians(dt, visual) {
  S.streets.forEach((st, si) => st.gians.forEach((G, i) => {
    const m = gianMult(G, si);
    if (!m) return;
    const had = gQty(G) > 0;
    const show = visual && R.view === 'street' && S.cur === si;
    G.slots.forEach((s, k) => {
      if (k >= slotsOpen(G) || s.qty <= 0) { s.prog = 0; return; }
      s.prog += (m / GOODS[s.good].t) * dt;
      while (s.prog >= 1 && s.qty > 0) {
        s.prog -= 1; s.qty--;
        const p = unitPrice(G, s.good);
        G.cash += p; S.stats.sold++;
        if (show) onSaleVisual(i, p, s.good);
      }
      if (s.qty <= 0) s.prog = 0;
    });
    if (had && gQty(G) <= 0 && show) R.parts.push({ type: 'text', x: gx(i), y: 300, vy: -20, text: 'Hết hàng!', color: '#F9C9C0', life: 1.8, max: 1.8 });
  }));
}
function onSaleVisual(i, p, good) {
  R.parts.push({ type: 'text', x: gx(i) + rand(-20, 20), y: 370, vy: -40, text: '+' + fmtK(p), color: '#FFE08A', life: 1.1, max: 1.1, small: true });
  const cx = gx(i);
  if (R.buyers.length < 8 && cx > R.cam - 100 && cx < R.cam + W + 100) {
    const fromLeft = Math.random() < 0.5;
    R.buyers.push({ x: fromLeft ? R.cam - 40 : R.cam + W + 40, y: rand(WALK_Y0 + 10, WALK_Y0 + 40), dir: fromLeft ? 1 : -1, look: makeLook(), tx: cx + (fromLeft ? -70 : 70),
      state: 'walk', t: 0, speed: rand(170, 210), phase: 0, moving: true, item: GOODS[good]?.icon });
  }
}
function tickNeighbors(dt) {
  for (const n of S.neighbors) for (const g of n.gians) if (g.open) {
    g.cash = Math.min(80000 + n.lvl * 6000, g.cash + dt * (30 + n.lvl * 8) * (g.trash ? 0.7 : 1) * (g.rat ? 0.5 : 1));
    if (Math.random() < dt / 900) g.trash = Math.min(3, g.trash + 1);
  }
}
function neighborActs(silent) {
  const n = pick(S.neighbors), b = nbBase(n.id);
  const mine = allGians().filter((x) => x.g.open);
  if (!mine.length) return;
  const harass = b.sly ? (n.friend < 60 ? 0.7 : 0.35) : n.friend < 20 ? 0.45 : 0.08;
  const target = pick(mine);
  const label = `gian ${target.i + 1}${S.streets.length > 1 ? ' khu phố ' + (target.si + 1) : ''}`;
  if (Math.random() < harass) {
    if (Math.random() < 0.7) { target.g.trash = Math.min(3, target.g.trash + 1); news(`<b>${b.name}</b> vừa vứt rác trước ${label} của bạn.`, 'bad'); }
    else { target.g.rat = true; news(`<b>${b.name}</b> thả chuột vô ${label}! Hàng bán chậm hẳn.`, 'bad'); }
    if (!silent && R.view === 'street' && S.cur === target.si) Snd.bad();
  } else if (n.friend >= 50 && Math.random() < 0.6) {
    const dirty = mine.find((x) => x.g.trash > 0 || x.g.rat);
    if (dirty) { if (dirty.g.rat) dirty.g.rat = false; else dirty.g.trash--; news(`<b>${b.name}</b> ghé dọn giúp gian ${dirty.i + 1}. Hàng xóm tốt ghê!`, 'good'); }
    else { const gift = 2000 * n.lvl; target.g.cash += gift; news(`<b>${b.name}</b> ghé mua ủng hộ ${label}, để lại ${fmt(gift)} trong két.`, 'good'); }
  } else if (!silent && Math.random() < 0.5) {
    news(`<b>${b.name}</b>: "${pick(b.sly ? NB_LINES.sly : NB_LINES.honest)}"`);
  }
}
function applyOffline(sec) {
  if (sec < 30) return;
  const before = allGians().reduce((a, x) => a + x.g.cash, 0);
  const sold0 = S.stats.sold;
  let left = Math.min(sec, 8 * 3600);
  while (left > 0) { const d = Math.min(60, left); tickGians(d, false); tickNeighbors(d); left -= d; }
  regenEnergy();
  const acts = Math.min(4, Math.floor(sec / 240));
  for (let i = 0; i < acts; i++) neighborActs(true);
  const got = allGians().reduce((a, x) => a + x.g.cash, 0) - before;
  const sold = S.stats.sold - sold0;
  if (sold > 0) R.offline = `Trong lúc bạn vắng, các gian bán được <b>${sold}</b> món, két đang chờ thu <b>${fmt(got)}</b>.`;
}
function regenEnergy() {
  const max = energyMax(), t = now();
  if (S.energy >= max) { S.energyAt = t; return; }
  const n = Math.floor((t - S.energyAt) / 45000);
  if (n > 0) { S.energy = Math.min(max, S.energy + n); S.energyAt += n * 45000; if (S.energy >= max) S.energyAt = t; }
}
function useEnergy(n) {
  if (S.energy < n) { toast(`Hết sức rồi! Cần ${n} sức. Nghỉ chút, sức tự hồi 1 điểm mỗi 45 giây.`, 'bad'); Snd.bad(); return false; }
  if (S.energy >= energyMax()) S.energyAt = now();
  S.energy -= n;
  return true;
}
function addXp(n) {
  S.xp += n;
  while (S.level < MAX_LVL && S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    const oldTitle = titleOf(S.level);
    S.level++;
    Snd.level();
    toast(`Lên cấp ${S.level}!${titleOf(S.level) !== oldTitle ? ` Danh hiệu mới: <b>${titleOf(S.level)}</b>` : ''}`, 'gold');
    const goods = GOOD_IDS.filter((id) => GOODS[id].lvl === S.level).map((id) => GOODS[id].icon + ' ' + GOODS[id].name);
    if (goods.length) toast('Chợ đầu mối có hàng mới: ' + goods.join(', '), 'good');
    GIAN_COST.forEach(([, l], i) => { if (l === S.level && i > 0) toast(`Đủ cấp thuê gian số ${i + 1} rồi!`, 'good'); });
    if (S.level === MAX_LVL - 1) news('Cả thành phố bắt đầu gọi bạn là <b>Vua Vỉa Hè</b>!', 'good');
  }
}
function changeKarma(d) { S.karma = clamp(S.karma + d, -100, 100); }

// ---------- Hành động trên gian của mình ----------
function collect(si, i, quiet) {
  const G = S.streets[si].gians[i];
  if (G.cash <= 0) return 0;
  const amt = Math.round(G.cash);
  S.money += amt; S.stats.earned += amt; G.cash = 0;
  addXp(Math.max(1, Math.round(amt / 1000)));
  if (!quiet && R.view === 'street' && S.cur === si) {
    for (let k = 0; k < 6; k++) R.parts.push({ type: 'coin', x: gx(i), y: 262, vx: rand(-110, 110), vy: rand(-380, -200), life: 0.8, max: 0.8 });
    R.parts.push({ type: 'text', x: gx(i), y: 232, vy: -40, text: '+' + fmt(amt), color: '#FFE08A', life: 1.4, max: 1.4 });
    Snd.coin();
  }
  if (!S.tips.collected) { S.tips.collected = 1; toast('Thu tiền xong! Hết hàng thì bấm vào gian để <b>Bày hàng</b> tiếp từ kho.', 'gold'); }
  return amt;
}
function collectAll() {
  let total = 0;
  S.streets.forEach((st, si) => st.gians.forEach((_, i) => { total += collect(si, i, si !== S.cur); }));
  if (!total) toast('Két gian nào cũng trống, chờ khách mua thêm đã.');
  else if (S.streets.length > 1) toast(`Thu hết được ${fmt(total)}.`, 'good');
}
function stockSlot(si, i, k, id) {
  const G = S.streets[si].gians[i];
  if (k == null) k = G.slots.findIndex((s, j) => j < slotsOpen(G) && (!s.qty || s.good === id));
  if (k < 0 || k >= slotsOpen(G)) { toast('Các ô đều đang có hàng. Chọn một ô để thay, hoặc nâng cấp để mở thêm ô.', 'bad'); return; }
  const s = G.slots[k], cap = slotCap(G);
  if (s.good && s.good !== id && s.qty > 0) { S.kho[s.good] = (S.kho[s.good] || 0) + s.qty; s.qty = 0; }
  if (s.good !== id) { s.good = id; s.prog = 0; }
  const n = Math.min(cap - s.qty, S.kho[id] || 0);
  if (n <= 0) { toast(s.qty >= cap ? 'Ô này đầy hàng rồi.' : 'Trong kho hết món này. Lên chợ đầu mối gom thêm.', 'bad'); return; }
  s.qty += n; S.kho[id] -= n;
  if (!S.kho[id]) delete S.kho[id];
  Snd.buy();
  if (!S.tips.stocked) { S.tips.stocked = 1; toast('Bày xong! Mỗi ô bán song song. Có đồng xu hiện lên trên gian là bấm vào để thu tiền.', 'gold'); }
}
function unstockSlot(si, i, k) {
  const s = S.streets[si].gians[i].slots[k];
  if (!s || !s.good || s.qty <= 0) return 0;
  const n = Math.min(khoCap() - khoCount(), s.qty);
  if (n <= 0) { toast('Kho đầy, không dọn về được.', 'bad'); return 0; }
  S.kho[s.good] = (S.kho[s.good] || 0) + n; s.qty -= n;
  return n;
}
function clearGian(si, i) {
  let n = 0;
  for (let k = 0; k < 6; k++) n += unstockSlot(si, i, k);
  if (n) { Snd.click(); toast(`Dọn ${n} món về kho.`); }
}
function autoStock() {
  let did = 0;
  const profit = (id) => (GOODS[id].sell - GOODS[id].buy) / GOODS[id].t;
  S.streets.forEach((st) => st.gians.forEach((G) => {
    if (!G.open || G.broken) return;
    for (let k = 0; k < slotsOpen(G); k++) {
      const s = G.slots[k], cap = slotCap(G);
      if (s.qty > 0) {
        if (S.kho[s.good] && s.qty < cap) { const n = Math.min(cap - s.qty, S.kho[s.good]); s.qty += n; S.kho[s.good] -= n; if (!S.kho[s.good]) delete S.kho[s.good]; did++; }
        continue;
      }
      const inGian = gGoods(G);
      const cands = Object.keys(S.kho).filter((id) => S.kho[id] > 0);
      if (!cands.length) continue;
      cands.sort((a, b) => (inGian.includes(a) - inGian.includes(b)) || profit(b) - profit(a));
      const best = cands[0];
      s.good = best; s.prog = 0;
      const n = Math.min(cap, S.kho[best]);
      s.qty = n; S.kho[best] -= n; if (!S.kho[best]) delete S.kho[best];
      did++;
    }
  }));
  if (did) { Snd.buy(); toast(`Đã bày thêm hàng vào ${did} ô.`, 'good'); }
  else toast(khoCount() ? 'Ô nào cũng đầy rồi.' : 'Kho trống trơn. Lên chợ đầu mối gom hàng đi!', khoCount() ? '' : 'bad');
}
function cleanTrash(si, i) {
  const G = S.streets[si].gians[i];
  if (G.trash <= 0 || !useEnergy(1)) return;
  G.trash--; S.stats.cleaned++; addXp(2); changeKarma(0.5);
  Snd.sweep();
  R.parts.push({ type: 'text', x: gx(i), y: 530, vy: -30, text: 'Sạch!', color: '#DDF2C9', life: 1, max: 1, small: true });
}
function chaseRat(si, i) {
  const G = S.streets[si].gians[i];
  if (!G.rat || !useEnergy(1)) return;
  G.rat = false; addXp(3);
  Snd.sweep();
  R.parts.push({ type: 'text', x: gx(i) + 60, y: 530, vy: -30, text: 'Cút!', color: '#DDF2C9', life: 1, max: 1, small: true });
}
function gianCost(si, i) { const [c, l] = GIAN_COST[i]; return si === 0 ? [c, l] : [Math.round((c || 20000) * 2.5), l + 4]; }
function rentGian(si, i) {
  const [cost, lvl] = gianCost(si, i);
  if (S.level < lvl) { toast(`Cần cấp ${lvl} mới thuê được gian này.`, 'bad'); return; }
  if (S.money < cost) { toast(`Cần ${fmt(cost)} để thuê gian.`, 'bad'); return; }
  S.money -= cost; S.streets[si].gians[i].open = true;
  Snd.level();
  toast(`Thuê được gian số ${i + 1}! Bày hàng ra bán liền.`, 'gold');
  news(`Bạn vừa thuê thêm gian số ${i + 1}${S.streets.length > 1 ? ' ở khu phố ' + (si + 1) : ''}.`, 'good');
  if (S.streets[si].gians.every((g) => g.open) && S.streets.length === 1) toast(`Đủ 6 gian rồi! Lên cấp ${STREET2.lvl} là mua được <b>Khu phố 2</b>.`, 'gold');
  renderDock();
}
function upgradeStall(si, i) {
  const G = S.streets[si].gians[i];
  const next = STALL_ORDER[STALL_ORDER.indexOf(G.stall) + 1];
  if (!next) return;
  const st = STALLS[next];
  if (S.level < st.lvl || S.money < st.price) return;
  S.money -= st.price; G.stall = next;
  Snd.level(); toast(`Gian ${i + 1} lên đời <b>${st.name}</b>: chứa ${st.cap} món, bán nhanh hơn.`, 'gold');
}
function buyDecor(si, i, k) {
  const G = S.streets[si].gians[i], d = DECOR[k];
  if (G[k] || S.level < d.lvl || S.money < d.price) return;
  S.money -= d.price; G[k] = true;
  Snd.buy(); toast(`Gian ${i + 1} có thêm ${d.name}.`, 'good');
}
const repairCost = () => 20000 + 8000 * S.level;
function repairGian(si, i) {
  const G = S.streets[si].gians[i];
  const cost = repairCost();
  if (!G.broken || S.money < cost) return;
  S.money -= cost; G.broken = false;
  Snd.buy(); toast(`Sửa xong gian ${i + 1}, bán lại được rồi.`, 'good');
}
function buyStreet2() {
  if (S.streets.length > 1 || S.level < STREET2.lvl || S.money < STREET2.price) return;
  S.money -= STREET2.price;
  S.streets.push({ gians: Array.from({ length: 6 }, (_, i) => newGian(i === 0)) });
  S.cur = 1;
  enterView('street');
  Snd.level(); toast('Mua được <b>Khu phố 2</b>! Người qua lại đông hơn, bán nhanh hơn 30%.', 'gold');
  news('Bạn mở rộng làm ăn sang Khu phố 2.', 'good');
  closeModal(); renderDock();
}

// ---------- Chợ đầu mối, kho, nợ ----------
function buy(id, n) {
  const price = S.prices[id];
  const space = khoCap() - khoCount();
  if (space <= 0) { toast('Kho đầy rồi! Nâng cấp kho hoặc bày bớt ra gian.', 'bad'); Snd.bad(); return; }
  const budget = S.money + (R.credit ? Math.max(0, creditLimit() - S.debt) : 0);
  const afford = Math.floor(budget / price);
  const k = Math.min(n === 'max' ? Infinity : Number(n), space, afford);
  if (k <= 0) { toast(R.credit ? 'Hết hạn mức mua chịu rồi!' : 'Không đủ tiền. Bật <b>Mua chịu</b> để ghi sổ nợ.', 'bad'); Snd.bad(); return; }
  let cost = k * price;
  const fromCash = Math.min(S.money, cost);
  S.money -= fromCash; cost -= fromCash;
  if (cost > 0) { if (!S.debt) S.debtAt = now(); S.debt += cost; }
  S.kho[id] = (S.kho[id] || 0) + k;
  Snd.buy();
  refreshModal();
}
function repayDebt() {
  const n = Math.min(S.money, S.debt);
  if (n <= 0) return;
  S.money -= n; S.debt -= n;
  if (S.debt <= 0) { S.debt = 0; changeKarma(2); toast('Trả hết nợ mối hàng. Uy tín tăng!', 'good'); }
  Snd.coin();
}
function tickDebt() {
  if (S.debt <= 0) return;
  const t = now();
  while (t - S.debtAt >= 300000) {
    S.debtAt += 300000;
    S.debt = Math.round(S.debt * 1.05);
    if (S.debt > creditLimit() * 1.3) seizeDebt();
    if (S.debt <= 0) break;
  }
}
function seizeDebt() {
  let owed = S.debt;
  const taken = [];
  for (const id of Object.keys(S.kho).sort((a, b) => GOODS[b].buy - GOODS[a].buy)) {
    if (owed <= 0) break;
    const unit = S.prices[id] || GOODS[id].buy;
    const n = Math.min(S.kho[id], Math.ceil(owed / unit));
    owed -= n * unit; S.kho[id] -= n; if (!S.kho[id]) delete S.kho[id];
    taken.push(`${n} ${GOODS[id].name}`);
  }
  if (owed > 0) { const m = Math.min(S.money, owed); S.money -= m; owed -= m; }
  S.debt = Math.max(0, Math.round(owed));
  changeKarma(-5);
  news(`Chủ mối lên <b>siết nợ</b>: lấy ${taken.join(', ') || 'tiền mặt'}. Uy tín giảm.`, 'bad');
  toast('Nợ quá hạn mức, chủ mối tới siết nợ!', 'bad'); Snd.bad();
}
function upgradeKho() {
  const next = KHO[S.khoLvl + 1];
  if (!next || S.level < next.lvl || S.money < next.price) return;
  S.money -= next.price; S.khoLvl++;
  Snd.level(); toast(`Kho mới chứa được ${next.cap} món.`, 'gold');
}

// ---------- Hàng xóm ----------
function visitNeighbor(id) {
  R.visit = id; R.tool = 'hand';
  nbState(id).lastVisit = now();
  enterView('neighbor');
  toast(`Sang chơi khu phố của <b>${nbBase(id).name}</b>. Dọn rác giúp để thân hơn, hoặc… tùy bạn.`);
}
function goHome() { enterView('street'); }
function nbClean(n, i) {
  const g = n.gians[i];
  if ((g.trash <= 0 && !g.rat) || !useEnergy(1)) return;
  if (g.rat) g.rat = false; else g.trash--;
  n.friend = clamp(n.friend + 3, 0, 100); changeKarma(1); addXp(4);
  Snd.sweep();
  R.parts.push({ type: 'text', x: gx(i), y: 530, vy: -30, text: '+3 thân thiết', color: '#DDF2C9', life: 1.2, max: 1.2, small: true });
}
function nbSteal(n, i) {
  const g = n.gians[i], b = nbBase(n.id);
  if (!g.open || g.cash < 1000 || !useEnergy(3)) return;
  if (Math.random() < 0.65 - n.friend / 400) {
    const amt = Math.round(g.cash * rand(0.3, 0.5));
    g.cash -= amt; S.money += amt; S.stats.stolen += amt;
    changeKarma(-4); n.friend = clamp(n.friend - 5, 0, 100); addXp(3);
    Snd.coin();
    R.parts.push({ type: 'text', x: gx(i), y: 232, vy: -40, text: '+' + fmt(amt), color: '#FFE08A', life: 1.4, max: 1.4 });
    toast(`Chôm được ${fmt(amt)} trong két của ${b.name}. Gian xảo ghê!`);
  } else {
    const fine = Math.min(S.money, 20000 + 5000 * S.level);
    S.money -= fine; S.stats.fines += fine;
    changeKarma(-6); n.friend = clamp(n.friend - 15, 0, 100);
    Snd.bad();
    toast(`Bị ${b.name} bắt quả tang! Đền ${fmt(fine)}, mất mặt quá.`, 'bad');
    news(`Bạn chôm tiền két của <b>${b.name}</b> bị bắt quả tang, đền ${fmt(fine)}.`, 'bad');
  }
}
function nbDirty(n, i, kind) {
  const g = n.gians[i], b = nbBase(n.id);
  if (!g.open) return;
  if (kind === 'rat' && g.rat) { toast('Gian này có chuột rồi.'); return; }
  if (kind === 'trash' && g.trash >= 3) { toast('Rác ngập rồi, thôi tha cho người ta.'); return; }
  if (!useEnergy(kind === 'rat' ? 3 : 2)) return;
  if (kind === 'rat') g.rat = true; else g.trash++;
  changeKarma(-2); n.friend = clamp(n.friend - 4, 0, 100); addXp(1);
  Snd.bad();
  if (Math.random() < 0.25) {
    const fine = Math.min(S.money, 15000 + 4000 * S.level);
    S.money -= fine; S.stats.fines += fine;
    toast(`Bị dân phòng bắt gặp ${kind === 'rat' ? 'thả chuột' : 'xả rác'}, phạt ${fmt(fine)}!`, 'bad');
  }
  if (Math.random() < 0.3) setTimeout(() => news(`<b>${b.name}</b> tức lắm, hăm he trả đũa bạn!`, 'bad'), 1500);
}
function treat(id) {
  const n = nbState(id), b = nbBase(id);
  if (now() - n.lastTreat < 120000) { toast(`Mới mời ${b.name} rồi, lát nữa mời tiếp.`); return; }
  if (S.money < 15000) { toast('Không đủ 15.000đ mời cà phê.', 'bad'); return; }
  S.money -= 15000; n.lastTreat = now();
  n.friend = clamp(n.friend + 8, 0, 100); changeKarma(0.5); addXp(2);
  R.cafeSay[id] = { text: pick(['Cảm ơn nghen!', 'Ly bạc xỉu ngon quá!', 'Để bữa sau tui mời lại.', 'Có gì tui canh gian giùm cho.']), t: 3 };
  Snd.buy();
}

// ---------- Sự kiện: công an, anh chị ----------
function eligiblePolice() { return allGians().filter(({ g, si }) => si === S.cur && g.open && !g.phep && gQty(g) > 0 && !g.broken && g.pausedUntil <= now()); }
function startPolice() {
  R.police = { phase: 'warn', t: 5, total: 5, x: 0 };
  $('police-alert').hidden = false;
  $('police-timer').style.width = '100%';
  Snd.siren();
  $('btn-flee').focus({ preventScroll: true });
}
function flee() {
  if (!R.police || R.police.phase !== 'warn') return;
  const list = eligiblePolice();
  for (const { g } of list) g.pausedUntil = now() + 45000;
  R.police.phase = 'drive'; R.police.caught = false; R.police.x = R.cam - 320;
  $('police-alert').hidden = true;
  addXp(5);
  toast(`Dẹp kịp ${list.length} gian! Xe đi khỏi thì 45 giây sau tự bày lại.`, 'good');
}
function updatePolice(dt) {
  const p = R.police;
  if (!p) {
    if (R.view !== 'street' || R.modal) return;
    R.nextPolice -= dt * (S.karma <= -15 ? 1.6 : 1);
    if (R.nextPolice <= 0) { R.nextPolice = rand(180, 320); if (eligiblePolice().length) startPolice(); }
    return;
  }
  if (p.phase === 'warn') {
    p.t -= dt;
    $('police-timer').style.width = (clamp(p.t / p.total, 0, 1) * 100) + '%';
    if (p.t <= 0) { p.phase = 'drive'; p.caught = true; p.x = R.cam - 320; $('police-alert').hidden = true; }
  } else {
    if (p.caught && !p.stopped && !p.done && p.x >= R.cam + 380) { p.stopped = true; p.stopT = 2.2; policePenalty(); }
    if (p.stopped) { p.stopT -= dt; if (p.stopT <= 0) { p.stopped = false; p.done = true; } }
    else p.x += 330 * dt;
    if (p.x > R.cam + W + 340) R.police = null;
  }
}
function policePenalty() {
  const list = eligiblePolice();
  let fine = 0, lost = 0;
  for (const { g } of list) { fine += 15000 + 3000 * S.level; for (const sl of g.slots) { const n = Math.ceil(sl.qty * 0.3); sl.qty -= n; lost += n; } }
  fine = Math.min(S.money, fine);
  S.money -= fine; S.stats.fines += fine;
  Snd.bad();
  toast(`Bị lập biên bản lấn chiếm vỉa hè: phạt ${fmt(fine)}, tịch thu ${lost} món.`, 'bad');
  news(`Công an phường phạt ${list.length} gian không giấy phép: ${fmt(fine)}. Sắm giấy phép cho yên tâm.`, 'bad');
}
function startThug() {
  const name = pick(THUGS);
  const demand = 10000 + 4000 * S.level;
  const power = 4 + S.level * 1.2;
  const me = 3 + stat('health') * 2;
  const chance = clamp(me / (me + power), 0.05, 0.9);
  const buddy = S.neighbors.filter((n) => n.friend >= 70).sort((a, b) => b.friend - a.friend)[0];
  R.thug = { name, demand, chance, buddy: buddy?.id };
  openModal('Dân anh chị ghé thăm', `
    <p class="event-text"><b>${name}</b> dẫn hai đàn em tới, gõ bàn: "Khu này anh bảo kê. Mỗi tuần <b>${fmt(demand)}</b>, đóng thì yên ổn làm ăn, không đóng thì đừng trách."</p>
    <p class="event-text">Sức khỏe của bạn: <b>${stat('health')}</b>. Khả năng đuổi được họ: <b>${Math.round(chance * 100)}%</b>.</p>
    <div class="choice">
      <button class="btn" data-thug="pay">Đóng tiền<small>Mất ${fmt(Math.min(S.money, demand))}</small></button>
      <button class="btn red" data-thug="fight">Không đóng<small>Thua là bị đập sạp</small></button>
      <button class="btn blue" data-thug="buddy" ${buddy ? '' : 'disabled'}>Nhờ hàng xóm<small>${buddy ? nbBase(buddy.id).name + ' ra mặt' : 'Chưa ai đủ thân (70)'}</small></button>
    </div>`, { kind: 'thug', noClose: true });
  Snd.bad();
}
function resolveThug(choice) {
  const T = R.thug;
  if (!T) return;
  R.thug = null;
  closeModal();
  if (choice === 'pay') {
    const n = Math.min(S.money, T.demand);
    S.money -= n;
    toast(`Đóng ${fmt(n)} tiền bảo kê cho ${T.name}. Xót ruột ghê.`);
    news(`Bạn đóng tiền bảo kê cho <b>${T.name}</b>: ${fmt(n)}.`);
  } else if (choice === 'buddy') {
    const n = nbState(T.buddy); n.friend = clamp(n.friend - 20, 0, 100);
    toast(`${nbBase(T.buddy).name} ra mặt nói giúp, ${T.name} bỏ đi. Nhớ mời người ta ly cà phê nha!`, 'good');
    news(`<b>${nbBase(T.buddy).name}</b> đứng ra bênh bạn trước ${T.name}.`, 'good');
    addXp(8);
  } else if (Math.random() < T.chance) {
    changeKarma(3); addXp(15);
    toast(`Bạn đứng thẳng lưng, ${T.name} chột dạ bỏ đi! Uy tín tăng.`, 'good');
    news(`Bạn không đóng tiền bảo kê, đuổi được <b>${T.name}</b>.`, 'good');
  } else {
    const tgt = pick(allGians().filter(({ g }) => g.open && !g.broken));
    if (tgt) { tgt.g.broken = true; tgt.g.cash = 0; }
    Snd.bad();
    toast(`${T.name} cho đàn em đập phá gian ${tgt ? tgt.i + 1 : ''}! Phải sửa mới bán được.`, 'bad');
    news(`<b>${T.name}</b> đập phá gian ${tgt ? tgt.i + 1 : ''} vì bạn không đóng bảo kê.`, 'bad');
  }
}

// ---------- Câu cá ----------
const rod = () => RODS[S.fishing.rod];
const basketValue = () => S.fishing.basket.reduce((a, f) => a + f.value, 0);
function fishAction() {
  const F = R.fish;
  if (F.state === 'idle' || F.state === 'done') return castLine();
  if (F.state === 'wait' || F.state === 'cast') {
    F.state = 'done'; F.t = 0;
    toast('Giật sớm quá, cá chạy mất! Chờ phao chìm hẳn rồi hãy giật.', 'bad'); Snd.bad();
  } else if (F.state === 'bite') {
    landFish();
  }
  renderDock();
}
function castLine() {
  const F = R.fish, FS = S.fishing;
  if (FS.basket.length >= BASKET_CAP) { toast('Giỏ đầy cá rồi! Bán bớt cho lái cá đã.', 'bad'); Snd.bad(); return; }
  if (!(FS.bait[FS.use] > 0)) { toast(`Hết ${BAITS[FS.use].name}. Mua thêm ở Tiệm đồ câu.`, 'bad'); Snd.bad(); return; }
  if (!useEnergy(1)) return;
  FS.bait[FS.use]--;
  if (!FS.bait[FS.use]) delete FS.bait[FS.use];
  F.bait = FS.use;
  F.state = 'cast'; F.t = 0.7; F.fx = rand(640, 980); F.fy = rand(520, 610);
  Snd.click();
  renderDock();
}
function pickFish(bait, tier) {
  const pairs = Object.entries(FISH).filter(([, f]) => f.rod <= tier)
    .map(([id, f]) => [id, f.w * (f.bait?.[bait] || 1) * (f.junk ? Math.max(0.3, 1 - tier * 0.25) : 1)]);
  const total = pairs.reduce((a, p) => a + p[1], 0);
  let r = Math.random() * total;
  for (const [id, w] of pairs) if ((r -= w) <= 0) return id;
  return 'ro';
}
function landFish() {
  const F = R.fish, FS = S.fishing;
  const id = pickFish(F.bait, rod().tier), f = FISH[id];
  const kg = Math.round((f.kg[0] + (f.kg[1] - f.kg[0]) * Math.random() ** 2) * 100) / 100;
  const value = Math.round((kg * f.perKg) / 500) * 500;
  const fresh = !FS.book[id];
  const rec = FS.book[id] || { count: 0, best: 0 };
  rec.count++; const newBest = kg > rec.best; rec.best = Math.max(rec.best, kg);
  FS.book[id] = rec;
  if (!f.junk) FS.basket.push({ id, kg, value });
  F.state = 'reel'; F.t = 1.1; F.catch = { id, kg, value };
  addXp(f.junk ? 1 : 3 + Math.round(value / 20000));
  if (f.junk) { toast('Kéo lên được… một chiếc giày rách. Xui ghê!'); Snd.bad(); }
  else {
    Snd.coin();
    toast(`Dính <b>${f.name}</b> ${String(kg).replace('.', ',')} kg (~${fmt(value)})!${fresh ? ' Loài mới trong sổ câu!' : newBest ? ' Kỷ lục mới!' : ''}`, f.w < 3 ? 'gold' : 'good');
    if (f.w < 3) news(`Bạn câu được <b>${f.name}</b> nặng ${String(kg).replace('.', ',')} kg ở hồ câu!`, 'good');
  }
}
function updateFish(dt) {
  const F = R.fish;
  if (F.nib > 0) F.nib -= dt;
  if (F.state === 'cast') { F.t -= dt; if (F.t <= 0) { F.state = 'wait'; F.t = rand(3, 9) * rod().wait; R.ripples.push({ x: F.fx, y: F.fy, r: 4, life: 1 }); } }
  else if (F.state === 'wait') {
    F.t -= dt;
    if (Math.random() < dt * 0.7) { F.nib = 0.22; R.ripples.push({ x: F.fx, y: F.fy, r: 3, life: 0.6 }); }
    if (F.t <= 0) { F.state = 'bite'; F.t = 0.9 * rod().window; Snd.tone(1200, 0.08, 'square', 0.05); R.ripples.push({ x: F.fx, y: F.fy, r: 6, life: 1 }); renderDock(); }
  } else if (F.state === 'bite') {
    F.t -= dt;
    if (F.t <= 0) { F.state = 'done'; toast('Chậm tay rồi, cá ăn mất mồi!', 'bad'); Snd.bad(); renderDock(); }
  } else if (F.state === 'reel') {
    F.t -= dt;
    if (F.t <= 0) { F.state = 'done'; renderDock(); }
  }
  for (const r of R.ripples) { r.life -= dt; r.r += dt * 30; }
  R.ripples = R.ripples.filter((r) => r.life > 0);
}
function sellBasket() {
  const v = basketValue(), n = S.fishing.basket.length;
  if (!n) return;
  S.money += v; S.stats.earned += v; S.fishing.basket = [];
  addXp(Math.round(v / 2000));
  Snd.coin(); toast(`Bán ${n} con cá cho lái cá được ${fmt(v)}.`, 'good');
}
function openPond() { R.fish.state = 'idle'; enterView('fish'); if (!S.tips.fish) { S.tips.fish = 1; toast('Bấm <b>Thả câu</b> (Space). Khi phao <b>chìm hẳn</b> và hiện dấu "!" thì bấm <b>Giật</b> liền. Phao nhấp nhẹ là cá rỉa mồi, đừng giật!', 'gold'); } }
function fishShopHTML() {
  const rods = Object.entries(RODS).map(([id, r]) => {
    const owned = S.fishing.rods.includes(id), using = S.fishing.rod === id, locked = r.lvl > S.level;
    const foot = using ? '<span class="tag">Đang dùng</span>' : owned ? `<button class="mini" data-rod="${id}">Dùng cần này</button>`
      : locked ? `<span class="lock">Cần cấp ${r.lvl}</span>` : `<button class="mini" data-rod="${id}" ${S.money < r.price ? 'disabled' : ''}>Mua</button>`;
    return `<div class="card ${using ? 'using' : ''} ${locked && !owned ? 'locked' : ''}"><b class="c-name">${r.name}</b><span class="c-stats">Giật dễ hơn ×${String(r.window).replace('.', ',')} · cá cắn nhanh hơn ${Math.round((1 - r.wait) * 100)}%</span><p>${['Câu cá rô, tôm, cua.', 'Câu được cá trê, cá chép.', 'Câu được cá lóc, cá koi.', 'Câu được rùa vàng, cá chép hóa rồng.'][r.tier]}</p><div class="c-foot"><span class="c-price">${owned ? '' : r.price ? fmt(r.price) : 'Có sẵn'}</span>${foot}</div></div>`;
  }).join('');
  const baits = Object.entries(BAITS).map(([id, b]) => `<div class="card"><b class="c-name">${b.icon} ${b.name}</b><span class="c-stats">Đang có ${S.fishing.bait[id] || 0} · ${fmt(b.price)}/mồi</span><p>${{ giun: 'Mồi rẻ, cua đồng khoái.', cam: 'Cá trê, cá chép mê mùi này.', tep: 'Nhử cá lóc, tôm càng, rùa.', dacbiet: 'Cá hiếm ngửi thấy là tới.' }[id]}</p><div class="c-foot"><button class="mini" data-bait-buy="${id}" data-n="10">+10</button><button class="mini" data-bait-buy="${id}" data-n="50">+50</button></div></div>`).join('');
  return `<div class="stats-line"><span>Tiền: <b>${fmt(S.money)}</b></span><span>Sức: <b>${S.energy}/${energyMax()}</b> (mỗi lần thả câu tốn 1)</span></div>
    <section class="shop-sec"><h3>Cần câu</h3><div class="cards">${rods}</div></section>
    <section class="shop-sec"><h3>Mồi câu</h3><div class="cards">${baits}</div></section>`;
}
function basketHTML() {
  const B = S.fishing.basket;
  if (!B.length) return '<p class="empty-note">Giỏ trống. Ra cầu gỗ thả câu đi!</p>';
  return `<div class="stats-line"><span>Trong giỏ <b>${B.length}/${BASKET_CAP}</b> con</span><span>Lái cá trả <b>${fmt(basketValue())}</b></span></div>
    <div class="pick-grid">${B.map((f) => `<div class="pick"><span class="pi">${FISH[f.id].icon}</span><span><b>${FISH[f.id].name}</b><small>${String(f.kg).replace('.', ',')} kg · ${fmt(f.value)}</small></span></div>`).join('')}</div>
    <div class="btn-row" style="margin-top:16px"><button class="btn" data-act="sellfish">Bán hết cho lái cá</button></div>`;
}
function bookHTML() {
  const got = Object.keys(S.fishing.book).length, all = Object.keys(FISH).length;
  return `<div class="stats-line"><span>Đã câu được <b>${got}/${all}</b> loài</span></div>
    <div class="pick-grid">${Object.entries(FISH).map(([id, f]) => {
      const r = S.fishing.book[id];
      return r ? `<div class="pick"><span class="pi">${f.icon}</span><span><b>${f.name}</b><small>${r.count} lần · to nhất ${String(r.best).replace('.', ',')} kg</small></span></div>`
        : `<div class="pick" style="opacity:.5"><span class="pi">❔</span><span><b>Chưa biết</b><small>${['Cần tre', 'Cần trúc', 'Cần máy', 'Cần carbon'][f.rod]} trở lên</small></span></div>`;
    }).join('')}</div>`;
}

// ---------- Lớp mạng ----------
// Hiện game chạy ngoại tuyến: "người chơi" ở quán cà phê là các hàng xóm do máy điều khiển.
// Khi có server, thay LocalNet bằng một đối tượng có cùng các hàm dưới đây
// (gọi REST/WebSocket tới server); phần còn lại của game không phải sửa.
//   myProfile()        -> hồ sơ công khai của mình để gửi lên server
//   roomPlayers()      -> danh sách người đang ở quán cà phê (chỗ tụ tập)
//   sendChat(text)     -> gửi một câu chat vào phòng; tin tới gọi receiveChat(id, name, text)
//   fetchStreet(id)    -> khu phố của một người để sang nhà chơi
//   streetAction(id, action, gian) -> dọn rác / vứt rác / thả chuột / chôm két nhà người đó
const LocalNet = {
  online: false,
  myProfile() {
    return { id: 'me', name: S.player.name, level: S.level, title: titleOf(S.level), look: playerLook(), outfit: { ...S.outfit },
      streets: S.streets.map((st) => st.gians.map((g) => ({ open: g.open, stall: g.stall, good: g.good, cash: Math.round(g.cash), trash: g.trash, rat: g.rat }))) };
  },
  roomPlayers() { return NB_BASE.map((b) => ({ id: b.id, name: b.name, level: nbState(b.id).lvl, look: npcLook(b.id), bot: true })); },
  sendChat(text) { receiveChat('me', S.player.name, text); botReply(text); },
  fetchStreet(id) { return nbState(id); },
  streetAction(id, action, i) {
    const n = nbState(id);
    if (action === 'clean') nbClean(n, i); else if (action === 'steal') nbSteal(n, i); else nbDirty(n, i, action);
  },
};
const Net = LocalNet;

function npcLook(id) { return { scale: 1, capColor: '#C0392B', helmet: '#C0392B', ...NB_LOOKS[id] }; }
function receiveChat(id, name, text) {
  R.chat.push({ id, name, text, t: now() });
  if (R.chat.length > 30) R.chat.shift();
  R.cafeSay[id] = { text, t: 4 };
  if (R.view === 'cafe') renderChatLog();
}
const BOT_REPLIES = [
  [/chào|hello|hi\b|xin chào/i, ['Chào nha!', 'Ờ chào bạn, bữa nay buôn bán sao rồi?', 'Chào, ngồi xuống làm ly cà phê đi!']],
  [/câu|cá/i, ['Hồ câu bữa nay cá cắn dữ lắm.', 'Tui mới câu được con cá lóc 2 ký!', 'Mua mồi bí truyền đi, câu cá hiếm dễ hơn.']],
  [/công an|trật tự/i, ['Mua giấy phép đi cho yên tâm.', 'Hồi nãy công an mới đi qua khu tui.']],
  [/bảo kê|anh chị|giang hồ/i, ['Mấy ông đó tới là tui đóng cho yên.', 'Sức khỏe cao thì khỏi sợ, mua giày bata đi!']],
  [/giá|chợ|hàng/i, ['Giá sỉ lên xuống hoài, canh lúc rẻ mà gom.', 'Áo thun lời nhiều mà bán chậm.']],
  [/cảm ơn|thanks/i, ['Có gì đâu!', 'Hàng xóm với nhau mà.']],
];
function botReply(text) {
  const bots = NB_BASE.filter(() => Math.random() < 0.6);
  const who = bots.length ? pick(bots) : pick(NB_BASE);
  const rule = BOT_REPLIES.find(([re]) => re.test(text));
  const line = rule ? pick(rule[1]) : pick(who.sly ? NB_LINES.sly : NB_LINES.honest);
  setTimeout(() => receiveChat(who.id, who.name, line), rand(1200, 2800));
}
function renderChatLog() {
  const el = $('chat-log');
  if (!el) return;
  el.innerHTML = R.chat.slice(-3).map((m) => `<div><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('') || '<div class="dim">Chưa ai nói gì. Chào mọi người một câu đi!</div>';
}
function sendChat() {
  const inp = $('chat-input');
  const text = inp.value.trim().slice(0, 80);
  if (!text) return;
  inp.value = '';
  Net.sendChat(text);
}
function profileHTML(id) {
  const b = nbBase(id), n = nbState(id);
  const wait = Math.max(0, Math.ceil((120000 - (now() - n.lastTreat)) / 1000));
  return `<div class="gian">
    <div class="gian-card" style="align-items:center"><canvas id="char-preview" width="260" height="300" aria-label="Nhân vật ${esc(b.name)}"></canvas><b style="font:800 22px var(--font-display)">${b.name}</b><small>Cấp ${n.lvl} · ${titleOf(n.lvl)}</small></div>
    <div class="gian-right">
      <div class="kv"><span>Tiếng tăm</span><b>${b.sly ? 'Gian thương' : 'Làm ăn đàng hoàng'}</b></div>
      <div class="kv"><span>Số gian</span><b>${n.gians.filter((g) => g.open).length}/6</b></div>
      <div class="friend">Thân thiết ${Math.round(n.friend)}/100<div class="meter"><i style="width:${n.friend}%"></i></div></div>
      <div class="btn-row"><button class="btn blue" data-visit="${id}">Sang nhà chơi</button><button class="btn" data-treat="${id}" ${wait ? 'disabled' : ''}>${wait ? `Mời lại sau ${wait}s` : 'Mời cà phê · 15k'}</button></div>
      <p class="empty-note">${Net.online ? '' : 'Đang chơi ngoại tuyến: người trong quán là hàng xóm do máy điều khiển. Khi có server, bạn bè thật sẽ ngồi ở đây.'}</p>
    </div></div>`;
}
function openProfile(id) { openModal(nbBase(id).name, profileHTML(id), { kind: 'profile', arg: id }); drawPreview(npcLook(id)); }
function charHTML() {
  return `<div class="gian">
    <div class="gian-card" style="align-items:center">
      <canvas id="char-preview" width="260" height="300" aria-label="Nhân vật của bạn"></canvas>
      <label class="name-field" for="char-name">Tên nhân vật<input id="char-name" maxlength="16" value="${esc(S.player.name)}" autocomplete="off" /></label>
      <small>Cấp ${S.level} · ${titleOf(S.level)}</small>
    </div>
    <div class="gian-right">${fashionHTML()}</div></div>`;
}
function openChar() { openModal('Nhân vật của bạn', charHTML(), { kind: 'char' }); drawPreview(playerLook()); }
function drawPreview(look) {
  const cv = $('char-preview');
  if (!cv) return;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const grd = g.createLinearGradient(0, 0, 0, cv.height);
  grd.addColorStop(0, '#CFE8F2'); grd.addColorStop(1, '#F3E3B8');
  g.fillStyle = grd; rr(g, 0, 0, cv.width, cv.height, 14); g.fill();
  g.fillStyle = '#CDBB9C'; g.fillRect(0, 250, cv.width, 50);
  g.save(); g.translate(130, 262); g.scale(1.9, 1.9);
  drawPerson(g, { x: 0, y: 0, dir: 1, look: { ...look, scale: 1 }, moving: false, phase: 0 });
  g.restore();
}

// ---------- Thế giới, camera, di chuyển ----------
// Khu phố dài hơn một màn hình; nhân vật đi tự do trên vỉa hè, camera trượt theo.
const isStreetView = () => R.view === 'street' || R.view === 'neighbor';
const worldW = () => (isStreetView() ? STREET_W : SW);
const sceneMargin = () => (isStreetView() ? 0 : (W - SW) / 2);
const camTarget = () => (isStreetView() ? clamp(R.me.x - W / 2, 0, STREET_W - W) : -sceneMargin());
function walkBand() {
  if (R.view === 'fish') return { x0: 250, x1: 470, y0: 606, y1: 610 };
  if (R.view === 'cafe') return { x0: 40, x1: SW - 40, y0: 578, y1: 606 };
  if (R.view === 'home') return { x0: 60, x1: SW - 60, y0: WALK_Y0, y1: WALK_Y1 };
  if (R.view === 'market') return { x0: 60, x1: SW - 60, y0: 548, y1: 604 };
  return { x0: 40, x1: STREET_W - 40, y0: WALK_Y0, y1: WALK_Y1 };
}
function walkTo(x, y, then) {
  const b = walkBand(), M = R.me;
  M.tx = clamp(x, b.x0, b.x1); M.ty = clamp(y, b.y0, b.y1);
  M.then = then || null; M.sit = null;
}
function placeMe(x, y) {
  const b = walkBand(), M = R.me;
  M.x = M.tx = clamp(x, b.x0, b.x1); M.y = M.ty = clamp(y, b.y0, b.y1);
  M.then = null; M.sit = null; M.moving = false;
  R.cam = camTarget();
}
function enterView(view, opts = {}) {
  R.view = view;
  if (view !== 'neighbor') R.visit = null;
  R.walkers = []; R.buyers = []; R.visitors = []; R.bikes = [];
  closeModal();
  if (view === 'street' || view === 'neighbor') placeMe(opts.fromRight ? STREET_W - 160 : 170, 560);
  else if (view === 'home') placeMe(opts.fromRight ? SW - 140 : 640, 566);
  else if (view === 'market') placeMe(640, 590);
  else if (view === 'cafe') placeMe(640, 596);
  else if (view === 'fish') placeMe(420, 606);
  renderDock();
}
function updateMe(dt) {
  const M = R.me;
  const k = R.keys;
  const vx = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
  const vy = (k.has('ArrowDown') || k.has('s') ? 1 : 0) - (k.has('ArrowUp') || k.has('w') ? 1 : 0);
  if ((vx || vy) && !R.modal && R.view !== 'fish') {
    const b = walkBand();
    M.then = null; M.sit = null;
    M.tx = clamp(M.x + vx * 40, b.x0, b.x1); M.ty = clamp(M.y + vy * 30, b.y0, b.y1);
    if (vx < 0 && M.x <= b.x0 + 2) edgeTravel(-1);
    else if (vx > 0 && M.x >= b.x1 - 2) edgeTravel(1);
  }
  const dx = M.tx - M.x, dy = M.ty - M.y, d = Math.hypot(dx, dy);
  if (d > 2) {
    const step = Math.min(1, (270 * dt) / d);
    M.x += dx * step; M.y += dy * step; M.moving = true;
    if (Math.abs(dx) > 1) M.dir = Math.sign(dx);
    M.phase += dt * 10;
  } else {
    M.moving = false;
    if (M.then) { const f = M.then; M.then = null; f(); }
  }
  const target = camTarget();
  R.cam = isStreetView() ? lerp(R.cam, target, clamp(dt * 6, 0, 1)) : target;
}
// đi hết đầu/cuối phố thì sang khu kế bên
function portalsFor() {
  if (R.view === 'home') return [{ side: 1, label: 'KHU PHỐ 1', go: () => { S.cur = 0; enterView('street'); } }];
  if (R.view === 'neighbor') return [{ side: -1, label: 'VỀ NHÀ', go: () => enterView('home', { fromRight: true }) }];
  if (R.view !== 'street') return [];
  const list = [];
  list.push(S.cur === 0
    ? { side: -1, label: 'NHÀ RIÊNG', go: () => enterView('home', { fromRight: true }) }
    : { side: -1, label: 'KHU PHỐ ' + S.cur, go: () => { S.cur--; enterView('street', { fromRight: true }); } });
  if (S.cur + 1 < S.streets.length) list.push({ side: 1, label: 'KHU PHỐ ' + (S.cur + 2), go: () => { S.cur++; enterView('street'); } });
  else if (S.cur === 0) list.push({ side: 1, label: 'ĐẤT TRỐNG', go: () => openModal('Mở rộng làm ăn', street2HTML(), { kind: 'street2' }) });
  return list;
}
function edgeTravel(side) {
  if (R.edgeLock > 0) return;
  const p = portalsFor().find((q) => q.side === side);
  if (p) { R.edgeLock = 1; p.go(); }
}
function updateCrowd(dt) {
  const b = walkBand();
  const crowd = R.view === 'fish' ? 0 : R.view === 'cafe' ? 0.35 : R.view === 'market' ? 1 : 0.8;
  if (Math.random() < dt * crowd && R.walkers.length < 9) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    R.walkers.push({ x: dir > 0 ? R.cam - 40 : R.cam + W + 40, y: rand(b.y0 + 4, b.y1), dir, look: makeLook(), speed: rand(55, 95), phase: rand(0, 6), moving: true });
  }
  for (const w of R.walkers) { w.x += w.dir * w.speed * dt; w.phase += dt * 9; }
  R.walkers = R.walkers.filter((w) => w.x > R.cam - 160 && w.x < R.cam + W + 160);
  for (const q of R.buyers) {
    if (q.state === 'walk') {
      const dx = q.tx - q.x;
      if (Math.abs(dx) <= q.speed * dt) { q.x = q.tx; q.state = 'buy'; q.t = 0.8; q.moving = false; }
      else { q.x += Math.sign(dx) * q.speed * dt; q.dir = Math.sign(dx); }
    } else if (q.state === 'buy') { q.t -= dt; if (q.t <= 0) { q.state = 'leave'; q.moving = true; } }
    else q.x += q.dir * q.speed * dt;
    if (q.moving) q.phase += dt * 10;
  }
  R.buyers = R.buyers.filter((q) => q.state !== 'leave' || (q.x > R.cam - 160 && q.x < R.cam + W + 160));
  // hàng xóm đi dạo trên phố của mình
  if (R.view === 'street' && R.started && R.visitors.length < 2 && Math.random() < dt * 0.04) {
    const nb = pick(NB_BASE.filter((x) => !R.visitors.some((v) => v.id === x.id)));
    if (nb) R.visitors.push({ id: nb.id, x: rand(R.cam + 100, R.cam + W - 100), y: rand(b.y0 + 6, b.y1), tx: 0, ty: 0, wait: 0, dir: 1, phase: 0, moving: false, life: rand(40, 90) });
  }
  for (const v of R.visitors) {
    v.life -= dt;
    if (v.wait > 0) { v.wait -= dt; v.moving = false; continue; }
    if (!v.tx) { v.tx = clamp(v.x + rand(-300, 300), b.x0, b.x1); v.ty = rand(b.y0 + 6, b.y1); }
    const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
    if (d < 3) { v.tx = 0; v.wait = rand(2, 6); if (Math.random() < 0.3) R.cafeSay[v.id] = { text: pick(nbBase(v.id).sly ? NB_LINES.sly : NB_LINES.honest), t: 3 }; }
    else { const s = Math.min(1, (70 * dt) / d); v.x += dx * s; v.y += dy * s; v.dir = Math.sign(dx) || v.dir; v.moving = true; v.phase += dt * 8; }
  }
  R.visitors = R.visitors.filter((v) => v.life > 0 && R.view === 'street');
  if (R.view !== 'cafe' && R.view !== 'market' && Math.random() < dt) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    R.bikes.push({ x: dir > 0 ? R.cam - 120 : R.cam + W + 120, y: dir > 0 ? 652 : 632, dir, speed: rand(170, 290), color: pick(BIKE_COLORS),
      rider: { skin: pick(['#F1C9A5', '#E0AC80', '#C68B5E']), shirt: pick(SHIRTS), helmet: pick(HELMETS) },
      pass: Math.random() < 0.25 ? { shirt: pick(SHIRTS), helmet: pick(HELMETS) } : null, cargo: Math.random() < 0.15 });
  }
  for (const q of R.bikes) q.x += q.dir * q.speed * dt;
  R.bikes = R.bikes.filter((q) => q.x > R.cam - 200 && q.x < R.cam + W + 200);
}

// ---------- Chợ đầu mối: cảnh đi vào được ----------
const MARKET_STALLS = [
  { id: 'an',   name: 'Sạp đồ ăn',          owner: 'Dì Năm',  x: 260,  color: '#C0392B', goods: ['kem_chuoi', 'bap', 'banh_mi', 'xoi', 'hot_vit'],
    look: { skin: '#E0AC80', hair: '#1E1A1A', long: true, hat: 1, shirt: '#8E3B46', pants: '#231A14' } },
  { id: 'nuoc', name: 'Sạp nước giải khát', owner: 'Chú Sáu', x: 510,  color: '#1F6F8B', goods: ['tra_da', 'nuoc_mia'],
    look: { skin: '#C68B5E', hair: '#2B211C', long: false, hat: 3, capColor: '#1F6F8B', shirt: '#F2F2EE', style: 'tank', pants: '#3D405B' } },
  { id: 'keo',  name: 'Sạp kẹo, đồ chơi',   owner: 'Cô Út',   x: 760,  color: '#D98E04', goods: ['keo_bong', 'do_choi'],
    look: { skin: '#F1C9A5', hair: '#3B2A20', long: true, hat: 0, shirt: '#F7B32B', style: 'flower', pants: '#264653' } },
  { id: 'ao',   name: 'Sạp quần áo',        owner: 'Bà Tám',  x: 1010, color: '#7A3E9D', goods: ['non', 'ao_thun', 'giay', 'kinh', 'tui'],
    look: { skin: '#E0AC80', hair: '#DDD', long: true, hat: 0, shirt: '#7A3E9D', pants: '#231A14', acc: 'glasses' } },
];
const MARKET_BOSS = { name: 'Ông Chủ Mối', x: 1180, look: { skin: '#C68B5E', hair: '#1E1A1A', long: false, hat: 0, shirt: '#E9EEF5', style: 'collar', pants: '#3A3A40', acc: 'book' } };
const MK_Y = 500;
function drawMarketBg(g, rnd, lights, PM) {
  // mái tôn, kèo thép
  g.fillStyle = '#5B6570'; g.fillRect(-PM, 0, SW + 2 * PM, 120);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2;
  for (let x = -PM; x < SW + PM; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 120); g.stroke(); }
  g.fillStyle = '#CFC2A8'; g.fillRect(-PM, 120, SW + 2 * PM, GROUND - 120);
  g.strokeStyle = '#3E4448'; g.lineWidth = 6;
  for (let x = -PM - 80; x < SW + PM; x += 320) {
    g.beginPath(); g.moveTo(x, 120); g.lineTo(x + 160, 40); g.lineTo(x + 320, 120); g.stroke();
    g.beginPath(); g.moveTo(x + 160, 40); g.lineTo(x + 160, 120); g.moveTo(x + 80, 80); g.lineTo(x + 160, 120); g.moveTo(x + 240, 80); g.lineTo(x + 160, 120); g.stroke();
  }
  g.fillStyle = '#3E4448'; g.fillRect(-PM, 116, SW + 2 * PM, 10);
  // bảng tên chợ
  g.fillStyle = '#C0392B'; rr(g, 380, 140, 520, 56, 10); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 3; g.stroke();
  signText(g, 'CHỢ ĐẦU MỐI · BÁN SỈ', 640, 168, 34, '#FFE08A', 480);
  // đèn treo
  for (let x = 120; x < SW; x += 200) {
    g.strokeStyle = '#231A14'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 126); g.lineTo(x, 214); g.stroke();
    g.fillStyle = '#FFE08A'; g.beginPath(); g.arc(x, 222, 9, 0, 7); g.fill();
    g.fillStyle = '#3E4448'; g.beginPath(); g.moveTo(x - 18, 216); g.lineTo(x + 18, 216); g.lineTo(x + 8, 206); g.lineTo(x - 8, 206); g.closePath(); g.fill();
    lights.push({ x: x - 40, y: 212, w: 80, h: 40, on: true, warm: true });
  }
  // thùng, bao, sọt dọc tường
  for (let x = -PM; x < SW + PM; x += 70) {
    const k = Math.floor(rnd() * 3);
    g.fillStyle = ['#B07A3A', '#C9A06A', '#E6D3A3'][k];
    if (k === 2) { g.beginPath(); g.ellipse(x + 30, GROUND - 26, 26, 28, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(x + 18, GROUND - 50); g.lineTo(x + 42, GROUND - 50); g.stroke(); }
    else { g.fillRect(x + 6, GROUND - 48, 52, 48); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.strokeRect(x + 6, GROUND - 48, 52, 48); g.beginPath(); g.moveTo(x + 6, GROUND - 24); g.lineTo(x + 58, GROUND - 24); g.stroke(); }
  }
  // các sạp: bạt che, kệ sau lưng
  for (const m of MARKET_STALLS) {
    const x = m.x;
    g.fillStyle = '#6B4F3A'; g.fillRect(x - 104, 250, 6, 250); g.fillRect(x + 98, 250, 6, 250);
    g.fillStyle = m.color; g.beginPath(); g.moveTo(x - 120, 250); g.lineTo(x + 120, 250); g.lineTo(x + 130, 290); g.lineTo(x - 130, 290); g.closePath(); g.fill();
    g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; for (let k = x - 118; k < x + 110; k += 34) { g.beginPath(); g.moveTo(k, 250); g.lineTo(k + 17, 250); g.lineTo(k + 20, 290); g.lineTo(k + 3, 290); g.fill(); }
    g.fillStyle = '#FFF4D6'; rr(g, x - 92, 296, 184, 30, 6); g.fill(); g.strokeStyle = '#231A14'; g.stroke();
    signText(g, m.name.toUpperCase(), x, 311, 16, m.color, 170);
    g.fillStyle = '#8C6A4A'; g.fillRect(x - 96, 340, 192, 8); g.fillRect(x - 96, 380, 192, 8);
    m.goods.forEach((id, k) => { emoji(g, GOODS[id].icon, x - 70 + (k % 5) * 35, 328 + (k % 2) * 40, 22); emoji(g, GOODS[id].icon, x - 52 + (k % 5) * 35, 370 - (k % 2) * 40, 18); });
  }
  // bàn chủ mối
  const bx = MARKET_BOSS.x;
  g.fillStyle = '#3B2E2A'; rr(g, bx - 70, 300, 140, 110, 8); g.fill();
  g.fillStyle = '#FFF4D6'; rr(g, bx - 62, 268, 124, 30, 6); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2; g.stroke();
  signText(g, 'SỔ NỢ · CHỦ MỐI', bx, 283, 14, '#C0392B', 116);
}
function drawMarketFloor(g, BW) {
  g.fillStyle = '#B9B2A5'; g.fillRect(0, GROUND, BW, H - GROUND);
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < BW; x += 160) g.fillRect(x, GROUND, 2, H - GROUND);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, GROUND, BW, 8);
  g.fillStyle = 'rgba(90,120,140,.18)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(Math.random() * BW, 560 + Math.random() * 120, 40 + Math.random() * 40, 8, 0, 0, 7); g.fill(); }
}
function marketObjects(hits, layer) {
  // bảng giá phấn
  const cheap = (id) => S.prices[id] < (S.prevPrices[id] || S.prices[id]) * 0.97;
  ctx.fillStyle = '#2E4034'; rr(ctx, 20, 230, 110, 150, 8); ctx.fill(); ctx.strokeStyle = '#8C6A4A'; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = '#F2F2EE'; ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GIÁ SỈ HÔM NAY', 75, 248);
  ctx.font = '600 12px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'left';
  GOOD_IDS.filter((id) => GOODS[id].lvl <= S.level).slice(0, 7).forEach((id, k) => { ctx.fillStyle = cheap(id) ? '#9CE07A' : '#F2F2EE'; ctx.fillText(`${GOODS[id].name.slice(0, 9)} ${fmtK(S.prices[id])}`, 28, 268 + k * 16); });
  ctx.strokeStyle = '#6B4F3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(50, 380); ctx.lineTo(44, 470); ctx.moveTo(100, 380); ctx.lineTo(106, 470); ctx.stroke();
  hits.push({ x: 10, y: 220, w: 130, h: 260, kind: 'board', pri: 2 });
  for (const m of MARKET_STALLS) {
    const x = m.x;
    layer.push({ y: MK_Y - 2, draw: () => drawPerson(ctx, { x: x + 20, y: MK_Y - 16, dir: -1, look: { scale: 1.1, ...m.look }, moving: false, phase: 0 }) });
    layer.push({ y: MK_Y, draw: () => {
      ctx.fillStyle = '#8C6A4A'; ctx.fillRect(x - 110, MK_Y - 64, 220, 16); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.strokeRect(x - 110, MK_Y - 64, 220, 16);
      ctx.fillStyle = shade(m.color, -20); ctx.fillRect(x - 110, MK_Y - 48, 220, 48);
      ctx.fillStyle = '#6B4F3A'; ctx.fillRect(x - 104, MK_Y - 48, 8, 48); ctx.fillRect(x + 96, MK_Y - 48, 8, 48);
      m.goods.slice(0, 5).forEach((id, k) => {
        const gx2 = x - 84 + k * 42;
        ctx.fillStyle = '#B07A3A'; ctx.fillRect(gx2 - 16, MK_Y - 86, 32, 22);
        emoji(ctx, GOODS[id].icon, gx2, MK_Y - 90, 22);
        if (GOODS[id].lvl > S.level) { ctx.fillStyle = 'rgba(35,26,20,.55)'; ctx.fillRect(gx2 - 16, MK_Y - 104, 32, 40); }
      });
      nameTag(ctx, m.owner, x, MK_Y - 262, false, m.goods.some(cheap) ? 'Có món rẻ hôm nay!' : 'Mối hàng sỉ');
    } });
    if (m.goods.some((id) => cheap(id) && GOODS[id].lvl <= S.level)) exclaim(x + 92, MK_Y - 272);
    hits.push({ x: x - 120, y: 240, w: 240, h: MK_Y - 240 + 10, kind: 'mstall', id: m.id, pri: 2 });
  }
  const b = MARKET_BOSS;
  layer.push({ y: 470, draw: () => {
    drawPerson(ctx, { x: b.x, y: 452, dir: -1, look: { scale: 1.1, ...b.look }, moving: false, phase: 0 });
    ctx.fillStyle = '#6B4F3A'; ctx.fillRect(b.x - 80, 430, 160, 60); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.strokeRect(b.x - 80, 430, 160, 60);
    ctx.fillStyle = '#FFF4D6'; ctx.fillRect(b.x - 30, 424, 50, 8);
    nameTag(ctx, b.name, b.x, 250, false, S.debt ? 'Đang nợ ' + fmtK(S.debt) : 'Cho mua chịu');
  } });
  hits.push({ x: b.x - 90, y: 240, w: 180, h: 250, kind: 'boss', pri: 2 });
}
function openMarketStall(id) {
  const m = MARKET_STALLS.find((q) => q.id === id);
  openModal(`${m.name} · ${m.owner}`, marketHTML(id), { kind: 'market', arg: id });
}
function debtHTML() {
  return `<p class="event-text">Ông Chủ Mối cho mua chịu tới <b>${fmt(creditLimit())}</b>. Nợ tính lãi 5% mỗi 5 phút, vượt 130% hạn mức là bị siết nợ. Trí tuệ cao thì được nợ nhiều hơn.</p>
    <div class="stats-line"><span>Đang nợ: <b class="${S.debt ? 'neg' : ''}">${fmt(S.debt)}</b></span><span>Tiền mặt: <b>${fmt(S.money)}</b></span></div>
    <div class="btn-row"><button class="btn" data-act="repay" ${S.debt && S.money ? '' : 'disabled'}>Trả nợ</button><button class="btn ${R.credit ? 'red' : 'paper'}" data-act="credit">${R.credit ? 'Đang bật mua chịu' : 'Bật mua chịu'}</button></div>`;
}

// ---------- Góc giải trí ở quán cà phê: vòng quay, bầu cua, bài cào ----------
// Chỉ dùng tiền trong game. Mỗi lần chơi đều ghi vào S.fun để xem lời lỗ.
const WHEEL = [
  { label: '2k', money: 2000, color: '#F7C948', w: 22 },
  { label: 'Trượt', color: '#B8B2A6', w: 18 },
  { label: '10k', money: 10000, color: '#6BA368', w: 14 },
  { label: '+5 sức', energy: 5, color: '#3E8FD9', w: 10 },
  { label: '5k', money: 5000, color: '#EE8434', w: 18 },
  { label: '3 mồi', bait: 3, color: '#8E6FB5', w: 7 },
  { label: '50k', money: 50000, color: '#D7372B', w: 2 },
  { label: 'Trượt', color: '#B8B2A6', w: 18 },
];
const SPIN_COOLDOWN = 10 * 60 * 1000, SPIN_PRICE = 5000;
const BAUCUA = [['bau', 'Bầu', '🍐'], ['cua', 'Cua', '🦀'], ['tom', 'Tôm', '🦐'], ['ca', 'Cá', '🐟'], ['ga', 'Gà', '🐓'], ['nai', 'Nai', '🦌']];
const CHIPS = [1000, 5000, 10000, 50000];
const SUITS = [['♠', 'b'], ['♣', 'b'], ['♥', 'r'], ['♦', 'r']];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const funState = () => (S.fun ||= { spinAt: 0, net: 0, played: 0 });
function funRecord(delta) { const F = funState(); F.net += delta; F.played++; }

function funHTML() {
  const tab = R.funTab || 'wheel';
  const F = funState();
  const tabs = [['wheel', 'Vòng quay'], ['baucua', 'Bầu cua'], ['baicao', 'Bài cào']]
    .map(([k, n]) => `<button class="fun-tab${tab === k ? ' on' : ''}" data-funtab="${k}">${n}</button>`).join('');
  const body = tab === 'wheel' ? wheelHTML() : tab === 'baucua' ? baucuaHTML() : baicaoHTML();
  return `<div class="fun-head"><div class="fun-tabs">${tabs}</div>
    <span class="fun-net">Tiền: <b>${fmt(S.money)}</b> · Lời lỗ ở đây: <b class="${F.net >= 0 ? 'pos' : 'neg'}">${F.net >= 0 ? '+' : '−'}${fmt(Math.abs(F.net))}</b></span></div>
    ${body}<p class="fun-note">Chơi cho vui bằng tiền trong game. Chơi hoài dễ cháy túi nha!</p>`;
}
// Vòng quay
function wheelSVG() {
  const n = WHEEL.length, R0 = 130, c = 140;
  const seg = WHEEL.map((s, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = c + R0 * Math.cos(a0), y0 = c + R0 * Math.sin(a0), x1 = c + R0 * Math.cos(a1), y1 = c + R0 * Math.sin(a1);
    const am = (a0 + a1) / 2, tx = c + R0 * 0.64 * Math.cos(am), ty = c + R0 * 0.64 * Math.sin(am);
    const rot = (am * 180) / Math.PI + 90;
    return `<path d="M${c} ${c} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R0} ${R0} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${s.color}" stroke="#231a14" stroke-width="3"/>
      <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" class="wheel-txt">${s.label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 280 280" class="wheel-svg" aria-label="Vòng quay may mắn"><g id="wheel-g" style="transform-origin:140px 140px;transform:rotate(${R.wheelDeg || 0}deg)">${seg}
    <circle cx="140" cy="140" r="26" fill="#fff4d6" stroke="#231a14" stroke-width="4"/></g>
</svg>`;
}
function wheelHTML() {
  const F = funState();
  const free = now() - F.spinAt >= SPIN_COOLDOWN;
  const wait = Math.ceil((SPIN_COOLDOWN - (now() - F.spinAt)) / 60000);
  return `<div class="fun-body wheel-body">
    <div class="wheel-box"><div class="wheel-pin" aria-hidden="true"></div>${wheelSVG()}</div>
    <div class="fun-side">
      <p class="event-text">Quay trúng tiền, sức hay mồi câu. Mỗi 10 phút được <b>quay miễn phí</b> một lần, còn lại ${fmt(SPIN_PRICE)} một lượt.</p>
      <button class="btn big" data-fun="spin" ${R.spinning ? 'disabled' : ''}>${R.spinning ? 'Đang quay…' : free ? 'Quay miễn phí' : `Quay · ${fmt(SPIN_PRICE)}`}</button>
      ${free ? '' : `<small>Lượt miễn phí tiếp theo sau ${wait} phút.</small>`}
      ${R.wheelMsg ? `<p class="fun-result">${R.wheelMsg}</p>` : ''}
    </div></div>`;
}
function spinWheel() {
  if (R.spinning) return;
  const F = funState();
  const free = now() - F.spinAt >= SPIN_COOLDOWN;
  if (!free) { if (S.money < SPIN_PRICE) { toast('Không đủ tiền quay.', 'bad'); return; } S.money -= SPIN_PRICE; funRecord(-SPIN_PRICE); }
  else F.spinAt = now();
  const total = WHEEL.reduce((a, s) => a + s.w, 0);
  let r = Math.random() * total, idx = 0;
  for (let i = 0; i < WHEEL.length; i++) { if ((r -= WHEEL[i].w) <= 0) { idx = i; break; } }
  const seg = 360 / WHEEL.length;
  const base = Math.ceil((R.wheelDeg || 0) / 360) * 360 + 360 * 5;
  R.wheelDeg = base - (idx * seg + seg / 2) + rand(-seg * 0.3, seg * 0.3);
  R.spinning = true; R.wheelMsg = '';
  refreshModal();
  const g = $('wheel-g');
  if (g) { g.style.transition = 'none'; g.style.transform = `rotate(${(R.wheelDeg - 360 * 5) % 360}deg)`; void g.getBoundingClientRect(); g.style.transition = 'transform 3.4s cubic-bezier(.17,.67,.21,1)'; g.style.transform = `rotate(${R.wheelDeg}deg)`; }
  for (let i = 0; i < 10; i++) Snd.tone(600 + i * 40, 0.04, 'square', 0.03, i * 0.3);
  setTimeout(() => {
    R.spinning = false;
    const s = WHEEL[idx];
    if (s.money) { S.money += s.money; funRecord(s.money); R.wheelMsg = `Trúng <b>${fmt(s.money)}</b>!`; Snd.coin(); }
    else if (s.energy) { S.energy = Math.min(energyMax(), S.energy + s.energy); R.wheelMsg = 'Trúng <b>+5 sức</b>!'; Snd.coin(); }
    else if (s.bait) { S.fishing.bait.dacbiet = (S.fishing.bait.dacbiet || 0) + 3; R.wheelMsg = 'Trúng <b>3 mồi bí truyền</b>, ra hồ câu cá hiếm đi!'; Snd.coin(); }
    else { R.wheelMsg = 'Trượt rồi, lần sau may hơn!'; Snd.bad(); }
    if (R.modal === 'fun') refreshModal();
  }, 3500);
}
// Bầu cua: đặt cược lên 1 hay nhiều con, lắc 3 hột; mỗi hột trùng ăn 1 lần tiền cược
function bcState() { return (R.bc ||= { chip: 5000, bets: {}, dice: null, rolling: false, msg: '' }); }
function baucuaHTML() {
  const B = bcState();
  const total = Object.values(B.bets).reduce((a, b) => a + b, 0);
  const dice = B.rolling ? '<div class="bc-dish shaking">Đang lắc…</div>'
    : B.dice ? `<div class="bc-dice">${B.dice.map((d) => `<span class="die">${BAUCUA.find((x) => x[0] === d)[2]}</span>`).join('')}</div>`
    : '<div class="bc-dish">Đặt cược rồi bấm Lắc</div>';
  return `<div class="fun-body bc-body">
    <div class="bc-board">${BAUCUA.map(([id, n, ic]) => `<button class="bc-cell${B.dice && B.dice.includes(id) ? ' hit' : ''}" data-bet="${id}" ${B.rolling ? 'disabled' : ''}><span class="ic">${ic}</span><b>${n}</b>${B.bets[id] ? `<span class="bet">${fmtK(B.bets[id])}</span>` : ''}</button>`).join('')}</div>
    <div class="fun-side">
      ${dice}
      <div class="chips">${CHIPS.map((c) => `<button class="chip${B.chip === c ? ' on' : ''}" data-chip="${c}">${fmtK(c)}</button>`).join('')}</div>
      <div class="kv"><span>Tổng cược</span><b>${fmt(total)}</b></div>
      <div class="btn-row"><button class="btn big" data-fun="roll" ${B.rolling || !total ? 'disabled' : ''}>Lắc!</button><button class="btn paper" data-fun="clearbet" ${B.rolling || !total ? 'disabled' : ''}>Xóa cược</button></div>
      ${B.msg ? `<p class="fun-result">${B.msg}</p>` : ''}
    </div></div>`;
}
function bcBet(id) {
  const B = bcState();
  if (B.rolling) return;
  const total = Object.values(B.bets).reduce((a, b) => a + b, 0);
  if (total + B.chip > S.money) { toast('Không đủ tiền đặt thêm.', 'bad'); return; }
  if (B.dice) { B.dice = null; B.msg = ''; }
  B.bets[id] = (B.bets[id] || 0) + B.chip;
  Snd.click();
}
function bcRoll() {
  const B = bcState();
  const total = Object.values(B.bets).reduce((a, b) => a + b, 0);
  if (!total || B.rolling || total > S.money) return;
  S.money -= total;
  B.rolling = true; B.msg = ''; B.dice = null;
  refreshModal();
  for (let i = 0; i < 8; i++) Snd.tone(300 + Math.random() * 200, 0.05, 'triangle', 0.04, i * 0.12);
  setTimeout(() => {
    B.rolling = false;
    B.dice = [0, 1, 2].map(() => pick(BAUCUA)[0]);
    let back = 0;
    for (const [id, amt] of Object.entries(B.bets)) { const m = B.dice.filter((d) => d === id).length; if (m) back += amt + amt * m; }
    S.money += back;
    funRecord(back - total);
    B.msg = back > total ? `Ăn <b>${fmt(back - total)}</b>!` : back === total ? 'Huề vốn.' : `Thua <b>${fmt(total - back)}</b>.`;
    back > total ? Snd.coin() : Snd.bad();
    B.bets = {};
    if (R.modal === 'fun') refreshModal();
  }, 1300);
}
// Bài cào: 3 lá, điểm = tổng % 10 (J Q K và 10 tính 0); ba lá J/Q/K là "ba tây", ăn gấp đôi
function bkState() { return (R.bk ||= { chip: 5000, me: null, dealer: null, reveal: false, msg: '' }); }
const cardVal = (c) => { const i = RANKS.indexOf(c.r); return i >= 9 ? 0 : i + 1; };
const isTay = (h) => h.every((c) => ['J', 'Q', 'K'].includes(c.r));
const handScore = (h) => (isTay(h) ? 10 : h.reduce((a, c) => a + cardVal(c), 0) % 10);
function cardHTML(c, hidden) {
  if (hidden) return '<span class="pcard back"></span>';
  return `<span class="pcard ${c.col}"><b>${c.r}</b><i>${c.s}</i></span>`;
}
function baicaoHTML() {
  const K = bkState();
  const hand = (h, hide) => (h ? h.map((c) => cardHTML(c, hide)).join('') : '<span class="pcard back"></span>'.repeat(3));
  const label = (h) => (h ? (isTay(h) ? 'Ba tây!' : `${handScore(h)} nút`) : '');
  return `<div class="fun-body bk-body">
    <div class="bk-table">
      <div class="bk-row"><span class="bk-who">Nhà cái ${K.reveal ? `· <b>${label(K.dealer)}</b>` : ''}</span><div class="bk-hand">${hand(K.dealer, !K.reveal)}</div></div>
      <div class="bk-row"><span class="bk-who">${esc(S.player.name)} ${K.me ? `· <b>${label(K.me)}</b>` : ''}</span><div class="bk-hand">${hand(K.me, false)}</div></div>
    </div>
    <div class="fun-side">
      <p class="event-text">Mỗi người 3 lá, cộng điểm lấy hàng đơn vị. 10, J, Q, K tính 0 nút. Ba lá hình (J Q K) là <b>ba tây</b>, ăn gấp đôi.</p>
      <div class="chips">${CHIPS.map((c) => `<button class="chip${K.chip === c ? ' on' : ''}" data-bkchip="${c}">${fmtK(c)}</button>`).join('')}</div>
      <button class="btn big" data-fun="deal" ${K.me && !K.reveal ? 'disabled' : ''}>Chia bài · cược ${fmt(K.chip)}</button>
      ${K.msg ? `<p class="fun-result">${K.msg}</p>` : ''}
    </div></div>`;
}
function bkDeal() {
  const K = bkState();
  if (K.me && !K.reveal) return;
  if (S.money < K.chip) { toast('Không đủ tiền cược.', 'bad'); return; }
  S.money -= K.chip;
  const deck = [];
  for (const [s, col] of SUITS) for (const r of RANKS) deck.push({ r, s, col });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  K.me = deck.slice(0, 3); K.dealer = deck.slice(3, 6); K.reveal = false; K.msg = '';
  Snd.click();
  refreshModal();
  setTimeout(() => {
    K.reveal = true;
    const a = handScore(K.me), b = handScore(K.dealer);
    let back = 0;
    if (a > b) back = K.chip * (isTay(K.me) ? 3 : 2);
    else if (a === b) back = K.chip;
    S.money += back;
    funRecord(back - K.chip);
    K.msg = a > b ? `Thắng <b>${fmt(back - K.chip)}</b>!${isTay(K.me) ? ' Ba tây ăn đậm!' : ''}` : a === b ? 'Bằng nút, huề.' : `Nhà cái ăn ${fmt(K.chip)}.`;
    a > b ? Snd.coin() : a === b ? Snd.click() : Snd.bad();
    if (R.modal === 'fun') refreshModal();
  }, 1100);
}
function openFun() { openModal('Góc giải trí', funHTML(), { kind: 'fun' }); }
function onFunClick(d) {
  if (d.funtab) { R.funTab = d.funtab; Snd.click(); }
  else if (d.fun === 'spin') { spinWheel(); return; }
  else if (d.fun === 'roll') { bcRoll(); return; }
  else if (d.fun === 'clearbet') { bcState().bets = {}; }
  else if (d.fun === 'deal') { bkDeal(); return; }
  else if (d.bet) bcBet(d.bet);
  else if (d.chip) { bcState().chip = Number(d.chip); Snd.click(); }
  else if (d.bkchip) { bkState().chip = Number(d.bkchip); Snd.click(); }
  refreshModal();
}
// góc giải trí vẽ trong quán cà phê (bên trái)
function drawFunCorner(hits, layer) {
  const x = 110;
  layer.push({ y: 560, draw: () => {
    ctx.fillStyle = '#6B3E26'; ctx.fillRect(x - 60, 520, 120, 10); ctx.fillRect(x - 50, 530, 8, 40); ctx.fillRect(x + 42, 530, 8, 40);
    ctx.fillStyle = '#2E7D4F'; ctx.fillRect(x - 56, 512, 112, 10);
    const t = R.t * 1.5;
    ctx.save(); ctx.translate(x, 452); ctx.rotate(t);
    const cols = ['#F7C948', '#D7372B', '#6BA368', '#3E8FD9', '#EE8434', '#8E6FB5'];
    for (let k = 0; k < 6; k++) { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 34, (k * Math.PI) / 3, ((k + 1) * Math.PI) / 3); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = '#231A14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, 452, 34, 0, 7); ctx.stroke();
    ctx.fillStyle = '#6E6A64'; ctx.fillRect(x - 3, 486, 6, 28);
    ctx.fillStyle = '#D7372B'; ctx.beginPath(); ctx.moveTo(x, 424); ctx.lineTo(x - 7, 410); ctx.lineTo(x + 7, 410); ctx.closePath(); ctx.fill();
    emoji(ctx, '🎲', x - 34, 504, 18); emoji(ctx, '🃏', x + 34, 504, 18);
    ctx.fillStyle = '#FFF4D6'; rr(ctx, x - 62, 372, 124, 26, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
    signText(ctx, 'GÓC GIẢI TRÍ', x, 385, 15, '#C0392B');
  } });
  exclaim(x + 58, 380);
  hits.push({ x: x - 70, y: 366, w: 140, h: 210, kind: 'fun', pri: 2 });
}

// ---------- Nhà riêng ----------
function drawHomeFront(g, lights) {
  // nhà mình: nhà một tầng sơn xanh, mái đỏ, cổng sắt, dàn hoa
  const x0 = 430, w = 420, top = GROUND - 250;
  g.fillStyle = '#E9E2CF'; g.fillRect(x0 - 150, GROUND - 120, 150, 120); g.fillRect(x0 + w, GROUND - 120, 150, 120);
  g.strokeStyle = 'rgba(35,26,20,.35)'; g.lineWidth = 2; g.strokeRect(x0 - 150, GROUND - 120, 150, 120); g.strokeRect(x0 + w, GROUND - 120, 150, 120);
  g.fillStyle = '#5DA34E'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(x0 - 140 + (i % 8) * 18, GROUND - 120 + Math.floor(i / 8) * 16, 12, 0, 7); g.fill(); }
  g.fillStyle = '#6FB8C8'; g.fillRect(x0, top, w, 250);
  g.strokeStyle = 'rgba(35,26,20,.5)'; g.lineWidth = 2.5; g.strokeRect(x0, top, w, 250);
  g.fillStyle = '#C0392B'; g.beginPath(); g.moveTo(x0 - 20, top); g.lineTo(x0 + 40, top - 40); g.lineTo(x0 + w - 40, top - 40); g.lineTo(x0 + w + 20, top); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.fillRect(x0 + 90, top + 16, w - 180, 26);
  g.strokeStyle = '#9AA0A6'; g.lineWidth = 2; g.beginPath(); for (let k = x0 + 96; k < x0 + w - 90; k += 8) { g.moveTo(k, top + 18); g.lineTo(k, top + 40); } g.stroke();
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#FFF4D6' : '#D7372B'; g.beginPath(); g.moveTo(x0 + 10 + i * 45, top + 60); g.lineTo(x0 + 55 + i * 45, top + 60); g.lineTo(x0 + 55 + i * 45, top + 96); g.quadraticCurveTo(x0 + 32 + i * 45, top + 108, x0 + 10 + i * 45, top + 96); g.closePath(); g.fill(); }
  g.fillStyle = '#2F6B3A'; g.fillRect(x0 + 30, top + 110, w - 60, 140);
  g.strokeStyle = '#1F3D2B'; g.lineWidth = 3; g.beginPath(); for (let k = x0 + 36; k < x0 + w - 30; k += 14) { g.moveTo(k, top + 110); g.lineTo(k, GROUND); } g.moveTo(x0 + 30, top + 150); g.lineTo(x0 + w - 30, top + 150); g.stroke();
  g.fillStyle = '#3B2E2A'; g.fillRect(x0 + 160, top + 130, 100, 120);
  lights.push({ x: x0 + 160, y: top + 130, w: 100, h: 120, on: true, warm: true, shop: true });
  g.fillStyle = '#E84A5F'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x0 + 150 + i * 20, top + 124 + Math.sin(i) * 4, 7, 0, 7); g.fill(); }
  g.fillStyle = '#F7B32B'; g.beginPath(); g.arc(x0 + 210, top + 118, 10, 0, 7); g.fill();
  g.fillStyle = '#8C6A4A'; rr(g, x0 + 150, GROUND - 60, 28, 24, 3); g.fill();
}
function homeObjects(hits) {
  // ông Tư bán đất
  const oldLook = { skin: '#E0AC80', hair: '#DDD', long: false, hat: 3, capColor: '#2E2E33', shirt: '#E9EEF5', pants: '#3A3A40', scale: 1.1, glasses: true };
  ctx.fillStyle = '#E6CB85'; rr(ctx, 100, 540, 110, 24, 4); ctx.fill();
  drawPerson(ctx, { x: 150, y: 548, dir: 1, look: oldLook, seated: true, moving: false, phase: 0 });
  ctx.fillStyle = '#FFF4D6'; rr(ctx, 210, 452, 96, 34, 4); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#6B4F3A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(258, 486); ctx.lineTo(258, 540); ctx.stroke();
  signText(ctx, 'BÁN ĐẤT', 258, 468, 17, '#C0392B');
  nameTag(ctx, 'Ông Tư', 150, 548 - 150, false, 'Bán đất');
  hits.push({ x: 90, y: 380, w: 230, h: 180, kind: 'land', pri: 2 });
  // hàng thanh lý = kho của mình
  ctx.fillStyle = '#C9A06A';
  [[930, 548, 60, 40], [980, 540, 50, 48], [950, 512, 54, 36], [1020, 552, 44, 30]].forEach(([x, y, w, h]) => { ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(35,26,20,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke(); });
  ctx.fillStyle = '#FFF4D6'; rr(ctx, 942, 566, 80, 20, 3); ctx.fill();
  signText(ctx, 'KHO HÀNG', 982, 575, 13, '#C0392B');
  hits.push({ x: 910, y: 480, w: 150, h: 115, kind: 'kho', pri: 2 });
  // cửa nhà = tủ đồ
  hits.push({ x: 590, y: 300, w: 100, h: 125, kind: 'door', pri: 2 });
  // hộp thư = tin tức
  ctx.fillStyle = '#1F6F8B'; rr(ctx, 360, 470, 34, 30, 4); ctx.fill(); ctx.fillStyle = '#6B4F3A'; ctx.fillRect(374, 500, 6, 40);
  ctx.fillStyle = '#FFF4D6'; ctx.fillRect(366, 480, 22, 4);
  if (R.unread) { ctx.fillStyle = '#D7372B'; ctx.beginPath(); ctx.arc(394, 468, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '800 12px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.min(9, R.unread), 394, 469); }
  hits.push({ x: 350, y: 455, w: 56, h: 90, kind: 'mail', pri: 2 });
  // xe máy của mình dưới lòng đường
  drawBike(ctx, { x: 760, y: 638, dir: 1, color: '#6BA368', parked: true, cargo: false });
  ctx.fillStyle = '#D7372B'; rr(ctx, 716, 580, 34, 28, 4); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
}
function exclaim(x, y) {
  const b = Math.sin(R.t * 5) * 4;
  ctx.fillStyle = '#6BA368'; ctx.beginPath(); ctx.arc(x, y + b, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '800 18px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + b + 1);
}
function drawPortal(p) {
  const x = p.side < 0 ? 70 : worldW() - 70, y = 470;
  ctx.fillStyle = '#1F6F8B'; ctx.strokeStyle = '#FFF4D6'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (p.side > 0) { ctx.moveTo(x - 70, y - 20); ctx.lineTo(x + 40, y - 20); ctx.lineTo(x + 62, y); ctx.lineTo(x + 40, y + 20); ctx.lineTo(x - 70, y + 20); }
  else { ctx.moveTo(x + 70, y - 20); ctx.lineTo(x - 40, y - 20); ctx.lineTo(x - 62, y); ctx.lineTo(x - 40, y + 20); ctx.lineTo(x + 70, y + 20); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#6E6A64'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, WALK_Y0 + 6); ctx.stroke();
  signText(ctx, p.label, x + (p.side > 0 ? -8 : 8), y, 15, '#FFF4D6', 120);
  return { x: x - 75, y: y - 26, w: 150, h: 90, kind: 'portal', side: p.side, pri: 2 };
}

// ---------- Vòng lặp logic ----------
function update(dt) {
  R.t += dt;
  if (R.started) {
    tickGians(dt, true);
    tickNeighbors(dt);
    regenEnergy();
    tickDebt();
    if (now() - S.pricesAt > 600000) { rollPrices(); news('Chợ đầu mối vừa đổi giá sỉ.'); }
    updatePolice(dt);
    if (!R.modal && !R.police) {
      R.nextThug -= dt;
      if (R.nextThug <= 0) { R.nextThug = rand(360, 600); if (S.level >= 2 && allGians().some(({ g }) => g.open)) startThug(); }
    }
    R.nextNb -= dt;
    if (R.nextNb <= 0) { R.nextNb = rand(50, 110); neighborActs(false); }
    R.saveT += dt;
    if (R.saveT > 10) { R.saveT = 0; save(); }
  }
  updateCrowd(dt);
  updateMe(dt);
  if (R.edgeLock > 0) R.edgeLock -= dt;
  for (const p of R.parts) { p.life -= dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.type === 'coin') p.vy += 1100 * dt; }
  R.parts = R.parts.filter((p) => p.life > 0);
  for (const c of R.clouds) { c.x += dt * 6 * c.s; if (c.x > W + 120) c.x = -160; }
  for (const k of Object.keys(R.cafeSay)) { R.cafeSay[k].t -= dt; if (R.cafeSay[k].t <= 0) delete R.cafeSay[k]; }
  if (R.view === 'cafe') {
    R.cafeT -= dt;
    if (R.cafeT <= 0) { R.cafeT = rand(7, 14); const b = pick(NB_BASE); receiveChat(b.id, b.name, pick(b.sly ? NB_LINES.sly : NB_LINES.honest)); }
  }
  if (R.view === 'fish') updateFish(dt);
}

// ---------- Modal ----------
function openModal(title, html, opts = {}) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal-body').scrollTop = 0;
  $('modal-close').hidden = !!opts.noClose;
  $('modal').hidden = false;
  R.modal = opts.kind || 'x';
  R.modalArg = opts.arg ?? null;
  R.hover = null;
  Snd.click();
}
function closeModal() {
  if ($('modal').hidden) return;
  $('modal').hidden = true;
  R.modal = null; R.modalArg = null;
}
const MODAL_HTML = { market: () => marketHTML(R.modalArg), debt: () => debtHTML(), fun: () => funHTML(), kho: () => khoHTML(), gian: () => gianHTML(...R.modalArg), neighbors: () => neighborsHTML(),
  fashion: () => fashionHTML(), news: () => newsHTML(), cafe: () => cafeHTML(), street2: () => street2HTML(),
  fishshop: () => fishShopHTML(), basket: () => basketHTML(), book: () => bookHTML(), profile: () => profileHTML(R.modalArg), char: () => charHTML() };
function refreshModal() {
  if (!R.modal || !MODAL_HTML[R.modal]) return;
  const b = $('modal-body');
  const st = b.scrollTop;
  b.innerHTML = MODAL_HTML[R.modal]();
  b.scrollTop = st;
  if (R.modal === 'char') drawPreview(playerLook());
  if (R.modal === 'profile') drawPreview(npcLook(R.modalArg));
  if (R.view === 'fish') renderDock();
}

function trendMark(id) {
  const p = S.prices[id], prev = S.prevPrices[id] || p;
  return p > prev * 1.03 ? '<span class="up" title="Tăng so với đợt trước">▲</span>' : p < prev * 0.97 ? '<span class="down" title="Rẻ hơn đợt trước">▼</span>' : '<span class="flat">•</span>';
}
function marketHTML(cat) {
  const only = cat ? MARKET_STALLS.find((m) => m.id === cat)?.goods : null;
  const mins = Math.max(0, Math.ceil((600000 - (now() - S.pricesAt)) / 60000));
  const rows = GOOD_IDS.filter((id) => !only || only.includes(id)).map((id) => {
    const g = GOODS[id], locked = g.lvl > S.level;
    const perMin = Math.round(60 / g.t * (g.sell - g.buy));
    const btns = locked ? `<span class="lock">Cấp ${g.lvl}</span>`
      : [10, 50].map((n) => `<button class="mini" data-buy="${id}" data-n="${n}">+${n}</button>`).join('') + `<button class="mini max" data-buy="${id}" data-n="max">Tối đa</button>`;
    return `<div class="row ${locked ? 'locked' : ''}">
      <div class="r-icon">${g.icon}</div>
      <div class="r-name"><b>${g.name}</b><small>Bán lẻ ${fmt(g.sell)} · ~${g.t} giây/món · lời ~${fmtK(perMin)}/phút mỗi gánh</small></div>
      <div class="r-price"><small>Giá sỉ</small><b>${fmt(S.prices[id])} ${trendMark(id)}</b></div>
      <div class="r-have"><small>Trong kho</small><b>${S.kho[id] || 0}</b></div>
      <div class="r-btns">${btns}</div>
    </div>`;
  }).join('');
  return `<div class="debt-box">
      <span>Tiền mặt: <b>${fmt(S.money)}</b></span>
      <span>Kho: <b>${khoCount()}/${khoCap()}</b></span>
      <span>Nợ mối: <b class="${S.debt ? 'neg' : ''}">${fmt(S.debt)}</b> / hạn mức ${fmt(creditLimit())}</span>
      <button class="mini ${R.credit ? 'on' : ''}" data-act="credit">${R.credit ? 'Đang mua chịu' : 'Mua chịu'}</button>
      <button class="mini" data-act="repay" ${S.debt && S.money ? '' : 'disabled'}>Trả nợ</button>
      <small>Nợ tính lãi 5% mỗi 5 phút. Vượt 130% hạn mức là chủ mối tới siết nợ. Giá sỉ đổi sau ${mins} phút.</small>
    </div><div class="rows">${rows}</div>`;
}
function khoHTML() {
  const ids = Object.keys(S.kho).filter((id) => S.kho[id] > 0);
  const next = KHO[S.khoLvl + 1];
  const list = ids.length ? `<div class="pick-grid">${ids.map((id) => `<div class="pick"><span class="pi">${GOODS[id].icon}</span><span><b>${GOODS[id].name}</b><small>${S.kho[id]} món</small></span></div>`).join('')}</div>`
    : '<p class="empty-note">Kho trống trơn. Lên chợ đầu mối gom hàng.</p>';
  return `<div class="stats-line"><span>Đang chứa <b>${khoCount()}/${khoCap()}</b> món</span></div>${list}
    <div class="btn-row" style="margin-top:16px">
      <button class="btn" data-act="autostock">Bày hết ra gian</button>
      ${next ? `<button class="btn green" data-act="kho" ${S.level < next.lvl || S.money < next.price ? 'disabled' : ''}>Nâng kho lên ${next.cap} món · ${fmt(next.price)}${S.level < next.lvl ? ` (cấp ${next.lvl})` : ''}</button>` : ''}
    </div>`;
}
function gianHTML(si, i) {
  const G = S.streets[si].gians[i];
  if (!G.open) {
    const [cost, lvl] = gianCost(si, i);
    return `<p class="event-text">Gian này đang <b>cho thuê</b>. Thuê rồi là có thêm một tủ hàng 6 ô để bày bán.</p>
      <div class="stats-line"><span>Giá thuê: <b>${fmt(cost)}</b></span><span>Cần cấp: <b>${lvl}</b></span><span>Tiền đang có: <b>${fmt(S.money)}</b></span></div>
      <div class="btn-row"><button class="btn" data-act="rent" ${S.level < lvl || S.money < cost ? 'disabled' : ''}>Thuê gian số ${i + 1}</button></div>`;
  }
  const open = slotsOpen(G), cap = slotCap(G);
  const cells = G.slots.map((s, k) => {
    if (k >= open) {
      const need = STALL_ORDER.find((t) => SLOT_OPEN[t] > k);
      return `<div class="slot-cell locked"><span class="lk">Khóa</span><small>Lên ${STALLS[need].name} để mở</small></div>`;
    }
    const sel = R.slotSel === k ? ' sel' : '';
    if (!s.qty) return `<button class="slot-cell empty${sel}" data-slot="${k}"><span class="plus">+</span><small>Ô ${k + 1} · bày hàng</small></button>`;
    const g = GOODS[s.good];
    return `<button class="slot-cell${sel}" data-slot="${k}"><span class="si">${g.icon}</span><b>${g.name}</b><span class="meter"><i style="width:${(s.qty / cap) * 100}%"></i></span><small>${s.qty}/${cap} · ${fmtK(unitPrice(G, s.good))}/món</small></button>`;
  }).join('');
  const rate = gianRate(G, si);
  const flags = [
    G.broken ? '<span class="flag-chip bad">Bị đập phá</span>' : '',
    G.pausedUntil > now() ? '<span class="flag-chip">Đang dẹp tạm</span>' : '',
    G.trash ? `<span class="flag-chip bad">Rác ×${G.trash}</span>` : '',
    G.rat ? '<span class="flag-chip bad">Có chuột</span>' : '',
    G.phep ? '<span class="flag-chip ok">Có giấy phép</span>' : '<span class="flag-chip">Chưa có giấy phép</span>',
  ].join('');
  let side;
  if (R.gianTab === 'up') {
    const next = STALL_ORDER[STALL_ORDER.indexOf(G.stall) + 1];
    const decor = Object.entries(DECOR).map(([k, d]) => G[k] ? `<span class="flag-chip ok">${d.name}</span>` : `<button class="btn paper" data-decor="${k}" title="${d.desc}" ${S.level < d.lvl || S.money < d.price ? 'disabled' : ''}>${d.name} · ${fmt(d.price)}${S.level < d.lvl ? ` (cấp ${d.lvl})` : ''}<small>${d.desc}</small></button>`).join('');
    side = `<p class="sec-title">Nâng cấp sạp</p>
      ${next ? `<div class="kv"><span>Hiện tại</span><b>${STALLS[G.stall].name} · ${open} ô × ${cap} món</b></div>
        <div class="kv"><span>Lên đời</span><b>${STALLS[next].name} · ${SLOT_OPEN[next]} ô × ${SLOT_CAP[next]} món</b></div>
        <button class="btn green" data-act="upstall" ${S.level < STALLS[next].lvl || S.money < STALLS[next].price ? 'disabled' : ''}>Nâng cấp · ${fmt(STALLS[next].price)}${S.level < STALLS[next].lvl ? ` (cần cấp ${STALLS[next].lvl})` : ''}</button>`
        : '<p class="empty-note">Đã là ki-ốt xịn nhất, đủ 6 ô.</p>'}
      <p class="sec-title">Trang trí, giấy tờ</p><div class="btn-row decor-row">${decor}</div>`;
  } else if (R.slotSel != null && R.slotSel < open) {
    const s = G.slots[R.slotSel];
    const picks = Object.keys(S.kho).filter((id) => S.kho[id] > 0);
    side = `<p class="sec-title">Ô số ${R.slotSel + 1}: ${s.qty ? `đang bán ${GOODS[s.good].name}` : 'đang trống'}</p>
      ${picks.length ? `<div class="pick-grid">${picks.map((id) => `<button class="pick" data-stock="${id}"><span class="pi">${GOODS[id].icon}</span><span><b>${GOODS[id].name}</b><small>Kho còn ${S.kho[id]}${s.good === id && s.qty ? ' · thêm vào' : s.qty ? ' · thay món' : ''}</small></span></button>`).join('')}</div>`
        : '<p class="empty-note">Kho trống. Bấm <b>Mua hàng</b> để lên chợ đầu mối.</p>'}
      ${s.qty ? '<button class="btn paper" data-act="unslot">Dọn ô này về kho</button>' : ''}`;
  } else {
    side = `<p class="empty-note">Bấm vào một ô trong tủ để bày hàng hoặc thay món.</p>`;
  }
  return `<div class="gian-panel">
    <div class="cab-wrap">
      <div class="cabinet"><div class="cab-roof"></div><div class="cab-grid">${cells}</div></div>
      <div class="cab-actions">
        <button class="btn red" data-act="clear" ${gQty(G) ? '' : 'disabled'}>Bỏ hết hàng</button>
        <button class="btn green" data-act="buymore">Mua hàng</button>
        <button class="btn blue${R.gianTab === 'up' ? ' on' : ''}" data-act="uptab">Nâng cấp</button>
      </div>
    </div>
    <div class="gian-side">
      <div class="gian-card">
        <div class="kv"><span>${STALLS[G.stall].name}</span><b>${open}/6 ô mở</b></div>
        <div class="kv"><span>Tốc độ bán</span><b>${rate ? '~' + (rate * 60).toFixed(1).replace('.', ',') + ' món/phút' : 'Đứng yên'}</b></div>
        <div class="kv"><span>Tiền trong két</span><b>${fmt(G.cash)}</b></div>
        <div class="flags">${flags}</div>
        <div class="btn-row">
          <button class="btn" data-act="collect" ${G.cash > 0 ? '' : 'disabled'}>Thu tiền</button>
          <button class="btn paper" data-act="autofill" ${khoCount() ? '' : 'disabled'}>Bày đầy ô trống</button>
          ${G.trash ? '<button class="btn paper" data-act="clean">Dọn rác</button>' : ''}
          ${G.rat ? '<button class="btn paper" data-act="rat">Đuổi chuột</button>' : ''}
          ${G.broken ? `<button class="btn red" data-act="repair" ${S.money < repairCost() ? 'disabled' : ''}>Sửa sạp · ${fmt(repairCost())}</button>` : ''}
        </div>
      </div>
      ${side}
    </div>
  </div>`;
}
function nbFace(b) { return `<div class="nb-face" style="background:${b.color}">${b.name.split(' ').pop()[0]}</div>`; }
function neighborsHTML() {
  return `<div class="nb-list">${S.neighbors.map((n) => {
    const b = nbBase(n.id);
    const cash = n.gians.reduce((a, g) => a + (g.open ? g.cash : 0), 0);
    const dirty = n.gians.reduce((a, g) => a + g.trash + (g.rat ? 1 : 0), 0);
    return `<div class="nb-row">${nbFace(b)}
      <div><b>${b.name}</b><small>Cấp ${n.lvl} · ${n.gians.filter((g) => g.open).length} gian · ${b.sly ? 'Tiếng là gian thương' : 'Làm ăn đàng hoàng'} · két ~${fmtK(cash)}${dirty ? ` · ${dirty} chỗ bẩn` : ''}</small></div>
      <div class="friend">Thân thiết ${Math.round(n.friend)}/100<div class="meter"><i style="width:${n.friend}%"></i></div></div>
      <div class="nb-btns"><button class="mini" data-visit="${n.id}">Ghé thăm</button></div>
    </div>`;
  }).join('')}</div>`;
}
function cafeHTML() {
  return `<p class="event-text" style="margin-bottom:12px">Quán cà phê cóc đầu hẻm, chỗ dân buôn bán tụ tập tán dóc. Mời hàng xóm một ly để thân hơn. Ai thân từ 50 trở lên hay ghé dọn giúp gian của bạn, thân từ 70 sẽ đứng ra bênh khi dân anh chị tới.</p>
  <div class="nb-list">${S.neighbors.map((n) => {
    const b = nbBase(n.id);
    const wait = Math.max(0, Math.ceil((120000 - (now() - n.lastTreat)) / 1000));
    return `<div class="nb-row">${nbFace(b)}
      <div><b>${b.name}</b><small>${b.sly ? 'Miệng ngọt nhưng hay giở trò' : 'Người hiền, dễ thân'}</small></div>
      <div class="friend">Thân thiết ${Math.round(n.friend)}/100<div class="meter"><i style="width:${n.friend}%"></i></div></div>
      <div class="nb-btns"><button class="mini" data-treat="${n.id}" ${wait ? 'disabled' : ''}>${wait ? `Chờ ${wait}s` : 'Mời cà phê · 15k'}</button></div>
    </div>`;
  }).join('')}</div>`;
}
function fashionHTML() {
  const b = stat('beauty'), it = stat('intel'), h = stat('health');
  const slots = Object.keys(SLOT_NAMES).map((slot) => {
    const items = Object.entries(FASHION).filter(([, f]) => f.slot === slot);
    return `<section class="shop-sec"><h3>${SLOT_NAMES[slot]}</h3><div class="cards">${items.map(([id, f]) => {
      const owned = S.owned.includes(id), wearing = S.outfit[slot] === id, locked = f.lvl > S.level;
      const st = [f.beauty ? `Sắc đẹp +${f.beauty}` : '', f.intel ? `Trí tuệ +${f.intel}` : '', f.health ? `Sức khỏe +${f.health}` : ''].filter(Boolean).join(' · ');
      const foot = wearing ? `<button class="mini" data-wear="${id}">Cởi ra</button>` : owned ? `<button class="mini" data-wear="${id}">Mặc vào</button>`
        : locked ? `<span class="lock">Cần cấp ${f.lvl}</span>` : `<button class="mini" data-dress="${id}" ${S.money < f.price ? 'disabled' : ''}>Mua</button>`;
      return `<div class="card ${wearing ? 'using' : ''} ${locked && !owned ? 'locked' : ''}"><b class="c-name">${f.name}</b><span class="c-stats">${st}</span><div class="c-foot"><span class="c-price">${owned ? '' : fmt(f.price)}</span>${foot}</div></div>`;
    }).join('')}</div></section>`;
  }).join('');
  return `<div class="stats-line"><span>Sắc đẹp <b>${b}</b> · bán nhanh hơn ${b * 2}%</span><span>Trí tuệ <b>${it}</b> · giá sỉ rẻ hơn ${it}%, nợ được nhiều hơn</span><span>Sức khỏe <b>${h}</b> · sức tối đa ${energyMax()}, đối phó anh chị</span></div>${slots}`;
}
function newsHTML() {
  if (!S.news.length) return '<p class="empty-note">Khu phố yên ắng, chưa có chuyện gì.</p>';
  return `<div class="news-list">${S.news.map((n) => `<div class="news-item ${n.kind}"><span class="when">${clock(n.t)}</span><span>${n.text}</span></div>`).join('')}</div>`;
}
function street2HTML() {
  return `<p class="event-text">Khu phố 2 nằm ngay mặt đường lớn, người qua lại đông hơn nên hàng bán nhanh hơn 30%. Có thêm 6 gian để thuê.</p>
    <div class="stats-line"><span>Giá: <b>${fmt(STREET2.price)}</b></span><span>Cần cấp: <b>${STREET2.lvl}</b></span><span>Tiền đang có: <b>${fmt(S.money)}</b></span></div>
    <div class="btn-row"><button class="btn" data-act="street2" ${S.level < STREET2.lvl || S.money < STREET2.price ? 'disabled' : ''}>Mua Khu phố 2</button></div>`;
}
function openGian(si, i) {
  const G = S.streets[si].gians[i];
  R.gianTab = 'hang';
  R.slotSel = G.open ? (G.slots.findIndex((sl, k) => k < slotsOpen(G) && !sl.qty) >= 0 ? G.slots.findIndex((sl, k) => k < slotsOpen(G) && !sl.qty) : null) : null;
  openModal(`Gian số ${i + 1}${S.streets.length > 1 ? ' · Khu phố ' + (si + 1) : ''}`, gianHTML(si, i), { kind: 'gian', arg: [si, i] }); }
const openMarket = () => openModal('Chợ đầu mối', marketHTML(), { kind: 'market' });
const openKho = () => openModal('Kho hàng', khoHTML(), { kind: 'kho' });
const openNeighbors = () => openModal('Hàng xóm', neighborsHTML(), { kind: 'neighbors' });
const openFashion = () => openModal('Tiệm thời trang', fashionHTML(), { kind: 'fashion' });
function openNews() { R.unread = 0; renderDock(); openModal('Tin khu phố', newsHTML(), { kind: 'news' }); }
function openCafe() {
  enterView('cafe');
  if (!S.tips.cafe) { S.tips.cafe = 1; toast('Quán cà phê là chỗ tụ tập. Gõ chat ở dưới, bấm vào ai đó để xem hồ sơ và <b>sang nhà</b> họ chơi.', 'gold'); }
}

$('modal-body').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (R.modal === 'fun') return onFunClick(d);
  const [si, i] = Array.isArray(R.modalArg) ? R.modalArg : [];
  if (d.buy) return buy(d.buy, d.n);
  if (d.visit) return visitNeighbor(d.visit);
  if (d.thug) return resolveThug(d.thug);
  if (d.slot !== undefined) { const k = Number(d.slot); R.slotSel = R.slotSel === k ? null : k; R.gianTab = 'hang'; Snd.click(); }
  else if (d.stock) stockSlot(si, i, R.slotSel, d.stock);
  else if (d.decor) buyDecor(si, i, d.decor);
  else if (d.treat) treat(d.treat);
  else if (d.rod) {
    const r = RODS[d.rod];
    if (S.fishing.rods.includes(d.rod)) S.fishing.rod = d.rod;
    else if (S.level >= r.lvl && S.money >= r.price) { S.money -= r.price; S.fishing.rods.push(d.rod); S.fishing.rod = d.rod; Snd.level(); toast(`Sắm được ${r.name}!`, 'gold'); }
  }
  else if (d.baitBuy) {
    const b = BAITS[d.baitBuy], k = Math.min(Number(d.n), Math.floor(S.money / b.price));
    if (k <= 0) { toast('Không đủ tiền mua mồi.', 'bad'); return; }
    S.money -= k * b.price; S.fishing.bait[d.baitBuy] = (S.fishing.bait[d.baitBuy] || 0) + k; Snd.buy();
  }
  else if (d.act === 'sellfish') sellBasket();
  else if (d.dress) { const f = FASHION[d.dress]; if (S.money >= f.price) { S.money -= f.price; S.owned.push(d.dress); S.outfit[f.slot] = d.dress; Snd.buy(); } }
  else if (d.wear) { const f = FASHION[d.wear]; S.outfit[f.slot] = S.outfit[f.slot] === d.wear ? null : d.wear; Snd.click(); }
  else switch (d.act) {
    case 'credit': R.credit = !R.credit; Snd.click(); break;
    case 'repay': repayDebt(); break;
    case 'kho': upgradeKho(); break;
    case 'autostock': autoStock(); break;
    case 'rent': rentGian(si, i); break;
    case 'collect': collect(si, i); break;
    case 'unslot': if (unstockSlot(si, i, R.slotSel)) Snd.click(); break;
    case 'clear': clearGian(si, i); break;
    case 'buymore': closeModal(); openMarket(); return;
    case 'uptab': R.gianTab = R.gianTab === 'up' ? 'hang' : 'up'; Snd.click(); break;
    case 'autofill': autoStock(); break;
    case 'clean': cleanTrash(si, i); break;
    case 'rat': chaseRat(si, i); break;
    case 'repair': repairGian(si, i); break;
    case 'upstall': upgradeStall(si, i); break;
    case 'street2': return buyStreet2();
  }
  refreshModal();
});
$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal' && !$('modal-close').hidden) closeModal(); });

// ---------- Thanh điều hướng (dưới), nút chức năng (trên), nút theo cảnh (nổi) ----------
// Thanh dưới chỉ để đi lại, giống nhau ở mọi cảnh.
function renderDock() {
  const cur = R.view === 'street' ? 'kp' + S.cur : R.view;
  const kps = [0, 1].map((k) => {
    const locked = k >= S.streets.length;
    return `<button class="kp${cur === 'kp' + k ? ' on' : ''}${locked ? ' locked' : ''}" data-go="kp${k}" title="${locked ? `Khu phố ${k + 1}: chưa mua` : `Khu phố ${k + 1}`}"><span class="kp-sign">${locked ? '<i class="kp-lock" aria-hidden="true"></i>' : ''}KP ${k + 1}</span><span class="kp-post"></span><span class="kp-pin"></span></button>`;
  }).join('');
  const ic = (go, icon, label) => `<button class="nav-ic${cur === go ? ' on' : ''}" data-go="${go}"><span class="ni" aria-hidden="true">${icon}</span><span class="nl">${label}</span></button>`;
  $('dock').innerHTML = `${ic('home', '🏠', 'Nhà riêng')}<div class="kp-track"><span class="kp-road"></span>${kps}</div>${ic('market', '🛒', 'Chợ')}${ic('cafe', '☕', 'Cà phê')}${ic('fish', '🎣', 'Hồ câu')}${ic('kho', '🎒', 'Túi đồ')}`;
  $('topicons').innerHTML = `
    <button class="top-ic" data-nav="news" title="Tin khu phố (N)" aria-label="Tin khu phố"><span aria-hidden="true">📰</span>${R.unread ? `<span class="badge">${Math.min(R.unread, 9)}</span>` : ''}<em>Tin</em></button>
    <button class="top-ic" data-nav="neighbors" title="Hàng xóm (X)" aria-label="Hàng xóm"><span aria-hidden="true">👥</span><em>Hàng xóm</em></button>
    <button class="top-ic" data-nav="char" title="Nhân vật (T)" aria-label="Nhân vật"><span aria-hidden="true">👕</span><em>Nhân vật</em></button>`;
  renderCtx();
}
// Nút riêng của từng cảnh, nổi phía trên thanh dưới
function renderCtx() {
  const C = $('ctx');
  let html = '';
  if (R.view === 'street') {
    const cash = S.streets[S.cur].gians.reduce((a, g) => a + g.cash, 0);
    html = `<button class="btn coin-btn" data-nav="collect"><span>Thu tiền</span><b>${fmtK(cash)}</b><kbd>Space</kbd></button>`;
  } else if (R.view === 'neighbor') {
    const tools = [['hand', 'Tay không', 'Dọn giúp · chôm két'], ['trash', 'Vứt rác', '2 sức'], ['rat', 'Thả chuột', '3 sức']];
    html = `<div class="ctx-card"><div class="tools">${tools.map(([k, n, s]) => `<button class="tool${R.tool === k ? ' on' : ''}" data-tool="${k}">${n}<small>${s}</small></button>`).join('')}</div>
      <p class="ctx-note">${R.tool === 'hand' ? 'Bấm rác, chuột để dọn giúp. Bấm đồng xu trên gian để chôm tiền két.' : `Bấm vào một gian để ${R.tool === 'trash' ? 'vứt rác' : 'thả chuột'}. Uy tín giảm, dễ bị phạt.`}</p></div>`;
  } else if (R.view === 'cafe') {
    html = `<div class="ctx-card chat"><div id="chat-log" class="chat-log" aria-live="polite"></div>
      <form id="chat-form" class="chat-form"><input id="chat-input" maxlength="80" autocomplete="off" placeholder="Gõ đi bạn ơi… (Enter để gửi)" aria-label="Tin nhắn" /><button class="mini" type="submit">Gửi</button></form></div>
      <div class="ctx-col"><button class="btn green" data-nav="fun">Trò chơi</button><button class="btn" data-nav="cafelist">Mời cà phê</button></div>`;
  } else if (R.view === 'fish') {
    const FS = S.fishing, F = R.fish;
    const label = F.state === 'bite' ? 'GIẬT!' : F.state === 'wait' || F.state === 'cast' ? 'Đang chờ…' : F.state === 'reel' ? 'Kéo lên…' : 'Thả câu';
    html = `<div class="ctx-card"><div class="tools">${Object.entries(BAITS).map(([id, b]) => `<button class="tool${FS.use === id ? ' on' : ''}" data-baituse="${id}">${b.icon} ${b.name}<small>Còn ${FS.bait[id] || 0}</small></button>`).join('')}</div>
      <div class="btn-row"><button class="btn paper" data-nav="basket">Giỏ cá ${FS.basket.length}/${BASKET_CAP}</button><button class="btn paper" data-nav="book">Sổ câu</button><button class="btn" data-nav="fishshop">Đồ câu</button></div></div>
      <button class="btn fish-act ${F.state === 'bite' ? 'red' : 'green'}" data-nav="fishact">${label}<kbd>Space</kbd></button>`;
  }
  C.className = 'ctx-' + R.view;
  C.hidden = !html;
  C.innerHTML = html;
  if (R.view === 'cafe') {
    renderChatLog();
    $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
  }
}
function onUiClick(e) {
  const t = e.target.closest('button');
  if (!t || !R.started || t.closest('form')) return;
  Snd.init();
  if (t.dataset.tool) { R.tool = t.dataset.tool; Snd.click(); renderCtx(); return; }
  if (t.dataset.baituse) { S.fishing.use = t.dataset.baituse; Snd.click(); renderCtx(); return; }
  const go = t.dataset.go;
  if (go) {
    Snd.click();
    if (go === 'home') enterView('home');
    else if (go === 'kp0') { S.cur = 0; enterView('street'); }
    else if (go === 'kp1') { if (S.streets.length < 2) openModal('Mở rộng làm ăn', street2HTML(), { kind: 'street2' }); else { S.cur = 1; enterView('street'); } }
    else if (go === 'market') enterView('market');
    else if (go === 'cafe') openCafe();
    else if (go === 'fish') openPond();
    else if (go === 'kho') openKho();
    return;
  }
  const nav = t.dataset.nav;
  if (nav === 'kho') openKho();
  else if (nav === 'neighbors') openNeighbors();
  else if (nav === 'fashion' || nav === 'char') openChar();
  else if (nav === 'cafelist') openModal('Quán cà phê cóc', cafeHTML(), { kind: 'cafe' });
  else if (nav === 'collect') { collectAll(); renderCtx(); }
  else if (nav === 'news') openNews();
  else if (nav === 'fun') openFun();
  else if (nav === 'fishact') fishAction();
  else if (nav === 'basket') openModal('Giỏ cá', basketHTML(), { kind: 'basket' });
  else if (nav === 'book') openModal('Sổ câu', bookHTML(), { kind: 'book' });
  else if (nav === 'fishshop') openModal('Tiệm đồ câu', fishShopHTML(), { kind: 'fishshop' });
}
['dock', 'ctx', 'topicons'].forEach((id) => $(id).addEventListener('click', onUiClick));
$('modal-body').addEventListener('input', (e) => {
  if (e.target.id === 'char-name') { S.player.name = e.target.value.trim().slice(0, 16) || 'Bạn'; }
});

function updateHUD() {
  const cb = document.querySelector('.coin-btn b');
  if (cb) cb.textContent = fmtK(S.streets[S.cur].gians.reduce((a, g) => a + g.cash, 0));
  $('money-val').textContent = fmt(S.money);
  $('level-val').textContent = S.level;
  $('title-val').textContent = titleOf(S.level);
  $('xp-bar').style.width = (S.level >= MAX_LVL ? 100 : clamp(S.xp / xpNeed(S.level), 0, 1) * 100) + '%';
  $('energy-bar').style.width = (S.energy / energyMax() * 100) + '%';
  $('energy-val').textContent = `${S.energy}/${energyMax()}`;
  $('energy-pill').classList.toggle('low', S.energy < 3);
  const sly = S.karma < 0;
  $('karma-pill').classList.toggle('sly', sly);
  $('karma-lbl').textContent = sly ? 'Gian xảo' : 'Uy tín';
  $('karma-val').textContent = Math.round(Math.abs(S.karma));
  $('clock-val').textContent = clock();
  $('debt-val').textContent = S.debt ? 'Nợ ' + fmtK(S.debt) : 'Không nợ';
  $('debt-val').classList.toggle('owe', S.debt > 0);
  $('place-val').textContent = R.view === 'neighbor' ? 'Nhà ' + nbBase(R.visit).name : R.view === 'cafe' ? `Quán cà phê · ${Net.roomPlayers().length + 1} người` : R.view === 'fish' ? 'Hồ câu' : R.view === 'home' ? 'Nhà riêng' : R.view === 'market' ? 'Chợ đầu mối' : `Khu phố ${S.cur + 1}`;
}

// ================================================================
//  VẼ CẢNH
// ================================================================
function buildBg(id) {
  const wide = id.startsWith('street') || id.startsWith('nb_');
  const BW = wide ? STREET_W : W;
  const PM = wide ? 0 : (W - SW) / 2;   // lề thêm hai bên cho màn hình rộng
  const c = document.createElement('canvas');
  c.width = BW; c.height = H;
  const g = c.getContext('2d');
  const rnd = mulberry32(hashStr(id) + 11);
  const rp = (a) => a[Math.floor(rnd() * a.length)];
  const lights = [], lamps = [];
  g.fillStyle = 'rgba(118,132,160,0.5)';
  for (let x = -20; x < BW;) {
    const w = 50 + rnd() * 90, h = 80 + rnd() * 170;
    g.fillRect(x, GROUND - 250 - h, w, h + 250);
    for (let wy = GROUND - 240 - h; wy < GROUND - 60; wy += 18) for (let wx = x + 6; wx < x + w - 8; wx += 14) if (rnd() < 0.5) lights.push({ x: wx - PM, y: wy, w: 6, h: 8, on: rnd() < 0.5, warm: rnd() < 0.5, far: true });
    x += w + rnd() * 30;
  }
  g.save(); g.translate(PM, 0);
  if (id === 'pond') { drawPondBg(g, rnd, rp, lights, PM); g.restore(); return { canvas: c, lights, lamps }; }
  if (id === 'market') { drawMarketBg(g, rnd, lights, PM); g.restore(); drawMarketFloor(g, BW); return { canvas: c, lights, lamps }; }
  const fill = (a, b) => { let xx = a; while (xx < b - 1) { let w = 90 + Math.floor(rnd() * 50); if (b - (xx + w) < 60) w = b - xx; drawHouse(g, xx, w, rnd, rp, lights); xx += w; } };
  if (id === 'cafe') { fill(-10 - PM, 270); fill(1010, SW + 10 + PM); drawCafeFront(g, lights); }
  else if (id === 'home') { fill(-10 - PM, 280); fill(1000, SW + 10 + PM); drawHomeFront(g, lights); }
  else { fill(-10, STREET_PAD); for (let i = 0; i < 6; i++) drawHouse(g, STREET_PAD + i * GIAN_W, GIAN_W, rnd, rp, lights); fill(STREET_PAD + 6 * GIAN_W, BW + 10); }
  g.restore();
  drawSidewalk(g, rnd, BW, wide, id === 'street_1' || id.startsWith('nb_') || id === 'street_demo');
  if (wide) { drawHydrant(g, STREET_PAD - 40, 560); drawBin(g, BW - STREET_PAD + 40, 556); drawHydrant(g, gx(3) - GIAN_W / 2, 562); }
  else if (id === 'home') drawBin(g, 1110 + PM, 556);
  drawWires(g, rnd, BW);
  return { canvas: c, lights, lamps };
}
function drawHydrant(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x, y, 16, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#D7372B'; rr(g, x - 10, y - 44, 20, 44, 5); g.fill();
  g.beginPath(); g.arc(x, y - 44, 11, Math.PI, 0); g.fill();
  g.fillRect(x - 16, y - 32, 32, 8);
  g.fillStyle = '#F7C948'; g.fillRect(x - 3, y - 58, 6, 6);
}
function drawBin(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x, y, 22, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#2E8B57'; g.beginPath(); g.moveTo(x - 20, y - 56); g.lineTo(x + 20, y - 56); g.lineTo(x + 16, y); g.lineTo(x - 16, y); g.closePath(); g.fill();
  g.fillStyle = '#1F6B45'; rr(g, x - 24, y - 64, 48, 10, 4); g.fill();
  g.fillStyle = '#FFF4D6'; g.font = '700 8px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.fillText('BỎ RÁC', x, y - 30);
}
function drawHouse(g, x, w, rnd, rp, lights) {
  const FH = 76;
  const floors = 2 + Math.floor(rnd() * 3);
  const h = floors * FH + 14;
  const top = GROUND - h;
  const col = rp(HOUSE_COLORS);
  g.fillStyle = col; g.fillRect(x, top, w, h);
  g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x + w - 5, top, 5, h);
  g.fillStyle = shade(col, -30); g.fillRect(x - 2, top - 8, w + 4, 10);
  if (rnd() < 0.55) {
    const tx = x + 14 + rnd() * Math.max(1, w - 50);
    g.fillStyle = '#7C8488'; g.fillRect(tx + 3, top - 18, 3, 10); g.fillRect(tx + 23, top - 18, 3, 10);
    g.fillStyle = '#D5DBDE'; rr(g, tx, top - 44, 29, 28, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(tx + 6, top - 40, 4, 20);
  }
  if (rnd() < 0.35) {
    const ax = x + w * 0.3;
    g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath();
    g.moveTo(ax, top - 8); g.lineTo(ax, top - 52); g.moveTo(ax - 12, top - 44); g.lineTo(ax + 12, top - 44); g.moveTo(ax - 8, top - 36); g.lineTo(ax + 8, top - 36);
    g.stroke();
  }
  const shut = rp(SHUTTER);
  const n = w > 125 ? 3 : 2;
  for (let f = 0; f < floors - 1; f++) {
    const fy = top + 10 + f * FH;
    const span = (w - 20) / n;
    for (let i = 0; i < n; i++) {
      const wx = x + 10 + i * span + 6, ww = span - 12;
      g.fillStyle = '#2C3440'; g.fillRect(wx, fy + 8, ww, 42);
      lights.push({ x: wx, y: fy + 8, w: ww, h: 42, on: rnd() < 0.6, warm: rnd() < 0.7 });
      g.fillStyle = shut; g.fillRect(wx - 5, fy + 8, 7, 42); g.fillRect(wx + ww - 2, fy + 8, 7, 42);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath();
      for (let k = fy + 12; k < fy + 50; k += 5) { g.moveTo(wx - 5, k); g.lineTo(wx + 2, k); g.moveTo(wx + ww - 2, k); g.lineTo(wx + ww + 5, k); }
      g.stroke();
    }
    const by = fy + FH - 16;
    g.fillStyle = shade(col, -38); g.fillRect(x + 4, by, w - 8, 5);
    g.strokeStyle = 'rgba(35,26,20,.55)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(x + 6, by - 14); g.lineTo(x + w - 6, by - 14);
    for (let k = x + 8; k < x + w - 6; k += 7) { g.moveTo(k, by - 14); g.lineTo(k, by); }
    g.stroke();
    if (rnd() < 0.6) {
      const px = x + 12 + rnd() * Math.max(1, w - 30);
      g.fillStyle = '#A0522D'; g.fillRect(px, by - 10, 12, 10);
      g.fillStyle = rp(['#3F8A4A', '#5DA34E', '#2F6B3A']); g.beginPath(); g.arc(px + 6, by - 16, 9, 0, 7); g.fill();
      if (rnd() < 0.5) { g.fillStyle = rp(['#E84A5F', '#F7B32B', '#F25F5C']); g.beginPath(); g.arc(px + 3, by - 20, 3, 0, 7); g.arc(px + 10, by - 15, 3, 0, 7); g.fill(); }
    }
    if (rnd() < 0.25) {
      g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 8, by - 30); g.lineTo(x + w - 8, by - 30); g.stroke();
      for (let k = x + 14; k < x + w - 20; k += 16) { g.fillStyle = rp(SHIRTS); g.fillRect(k, by - 30, 11, 14 + rnd() * 6); }
    }
  }
  const gy = GROUND - FH + 10;
  const signY = gy - 26;
  if (rnd() < 0.3) {
    g.fillStyle = '#A3ABB0'; g.fillRect(x + 8, gy, w - 16, GROUND - gy);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath();
    for (let k = gy + 4; k < GROUND; k += 5) { g.moveTo(x + 8, k); g.lineTo(x + w - 8, k); }
    g.stroke();
  } else {
    g.fillStyle = '#3B2E2A'; g.fillRect(x + 8, gy, w - 16, GROUND - gy);
    lights.push({ x: x + 8, y: gy, w: w - 16, h: GROUND - gy, on: true, warm: true, shop: true });
    for (let s = 0; s < 3; s++) {
      const sy = gy + 10 + s * 18;
      for (let k = x + 14; k < x + w - 20; k += 10) if (rnd() < 0.8) { g.fillStyle = rp(['#E84A5F', '#F7B32B', '#3F8A4A', '#2F5D8A', '#F2F2EE', '#D98E04']); g.fillRect(k, sy, 7, 10); }
      g.fillStyle = '#6B4F3A'; g.fillRect(x + 12, sy + 10, w - 24, 3);
    }
  }
  g.fillStyle = rp(SIGN_COLORS); g.fillRect(x + 6, signY, w - 12, 24);
  g.strokeStyle = 'rgba(35,26,20,.6)'; g.lineWidth = 2; g.strokeRect(x + 6, signY, w - 12, 24);
  const name = rp(SHOP_NAMES);
  let fs = 14;
  g.font = `700 ${fs}px "Be Vietnam Pro", sans-serif`;
  while (g.measureText(name).width > w - 22 && fs > 9) { fs--; g.font = `700 ${fs}px "Be Vietnam Pro", sans-serif`; }
  g.fillStyle = '#FFF4D6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, x + w / 2, signY + 13);
  if (rnd() < 0.5) {
    const ac = rp(['#1F6F8B', '#C0392B', '#2E7D4F', '#D98E04']);
    g.fillStyle = ac; g.beginPath();
    g.moveTo(x + 6, gy); g.lineTo(x + w - 6, gy); g.lineTo(x + w + 2, gy + 16); g.lineTo(x - 2, gy + 16); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = x + 6; k < x + w - 10; k += 22) { g.beginPath(); g.moveTo(k, gy); g.lineTo(k + 11, gy); g.lineTo(k + 13, gy + 16); g.lineTo(k + 1, gy + 16); g.fill(); }
  }
  g.strokeStyle = 'rgba(35,26,20,.35)'; g.lineWidth = 2; g.strokeRect(x, top, w, h);
}
function signText(g, text, cx, cy, size, color, maxW) {
  let fs = size;
  g.font = `800 ${fs}px "Baloo 2", sans-serif`;
  while (maxW && g.measureText(text).width > maxW && fs > 10) { fs--; g.font = `800 ${fs}px "Baloo 2", sans-serif`; }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cx, cy + 2);
}
function drawCafeFront(g, lights) {
  const x0 = 270, w = 740, top = GROUND - 280;
  g.fillStyle = '#E9D8B4'; g.fillRect(x0, top, w, 280);
  g.strokeStyle = 'rgba(35,26,20,.45)'; g.lineWidth = 2; g.strokeRect(x0, top, w, 280);
  for (let i = 0; i < 6; i++) { const wx = x0 + 30 + i * 120; g.fillStyle = '#2C3440'; g.fillRect(wx, top + 20, 80, 60); lights.push({ x: wx, y: top + 20, w: 80, h: 60, on: true, warm: true }); g.fillStyle = '#3F7F6F'; g.fillRect(wx - 6, top + 20, 8, 60); g.fillRect(wx + 78, top + 20, 8, 60); }
  g.fillStyle = '#6B3E26'; rr(g, x0 + 150, top + 100, w - 300, 50, 8); g.fill(); g.stroke();
  signText(g, 'CÀ PHÊ CÓC · CHÚ TƯ', 640, top + 124, 30, '#FFE08A');
  g.fillStyle = '#3B2E2A'; g.fillRect(x0 + 20, GROUND - 120, w - 40, 120);
  lights.push({ x: x0 + 20, y: GROUND - 120, w: w - 40, h: 120, on: true, warm: true, shop: true });
  g.fillStyle = '#8C6A4A'; g.fillRect(x0 + 60, GROUND - 60, 260, 60);
  g.fillStyle = '#C9D1D6'; rr(g, x0 + 90, GROUND - 100, 60, 40, 6); g.fill();
  g.fillStyle = '#E8F1F5'; g.fillRect(x0 + 560, GROUND - 110, 90, 110);
  g.fillStyle = '#9CC9DE'; for (let k = 0; k < 4; k++) g.fillRect(x0 + 568, GROUND - 104 + k * 26, 74, 20);
  g.fillStyle = '#231A14'; rr(g, x0 + 360, GROUND - 112, 170, 90, 6); g.fill();
  g.fillStyle = '#FFF4D6'; g.font = '700 14px "Be Vietnam Pro", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  ['Đen đá ........ 12k', 'Sữa đá ........ 15k', 'Bạc xỉu ....... 18k', 'Trà đá .......... 3k'].forEach((s, k) => g.fillText(s, x0 + 372, GROUND - 96 + k * 20));
}
function drawSidewalk(g, rnd, BW, dividers, wave) {
  g.fillStyle = wave ? '#E9E4D8' : '#CDBB9C'; g.fillRect(0, GROUND, BW, CURB - GROUND);
  if (wave) { // gạch sóng đen trắng kiểu phố đi bộ
    g.save(); g.beginPath(); g.rect(0, GROUND, BW, CURB - GROUND); g.clip();
    g.strokeStyle = 'rgba(59,58,63,.78)'; g.lineWidth = 7; g.lineCap = 'round';
    for (let y = GROUND + 14, r = 0; y < CURB + 10; y += 30, r++) {
      g.beginPath();
      for (let x = -20; x <= BW + 20; x += 8) { const yy = y + Math.sin((x + r * 30) / 22) * 7; if (x === -20) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    }
    g.restore();
  } else {
    g.strokeStyle = 'rgba(90,70,50,.2)'; g.lineWidth = 1.5;
    let row = 0;
    for (let y = GROUND + 16; y < CURB; y += 20 + row * 2, row++) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(BW, y); g.stroke();
      const step = 56 + row * 8;
      g.beginPath();
      for (let x = (row % 2) * step / 2; x < BW; x += step) { g.moveTo(x, y - 20 - row * 2 + 2); g.lineTo(x, y); }
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, GROUND, BW, 6);
  if (dividers) {
    g.strokeStyle = 'rgba(255,196,60,.55)'; g.setLineDash([10, 8]); g.lineWidth = 3;
    for (let i = 0; i <= 6; i++) { const x = STREET_PAD + i * GIAN_W; g.beginPath(); g.moveTo(x, GROUND + 10); g.lineTo(x, WALK_Y0 - 6); g.stroke(); }
    g.setLineDash([]);
  }
  g.fillStyle = '#9A948A'; g.fillRect(0, CURB, BW, 10);
  g.fillStyle = '#6F6A62'; g.fillRect(0, CURB + 10, BW, 4);
  g.fillStyle = '#44474F'; g.fillRect(0, CURB + 14, BW, H - CURB - 14);
  g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < BW / 4; i++) g.fillRect(rnd() * BW, CURB + 14 + rnd() * (H - CURB), 2, 2);
  g.fillStyle = '#E8C547'; for (let x = 20; x < BW; x += 140) g.fillRect(x, 636, 70, 6);
}
function drawWires(g, rnd, BW) {
  const poles = [];
  for (let x = 8; x < BW; x += 640) poles.push(x);
  for (const px of poles) {
    g.fillStyle = '#8E8A84'; g.fillRect(px - 5, 150, 10, GROUND + 26 - 150);
    g.fillStyle = '#6E6A64'; g.fillRect(px - 22, 170, 44, 6); g.fillRect(px - 16, 200, 32, 5);
  }
  g.strokeStyle = 'rgba(25,20,18,.72)'; g.lineWidth = 1.6;
  for (let k = 0; k < poles.length; k++) {
    const a = poles[k], b = poles[k + 1] ?? BW + 20;
    for (let i = 0; i < 8; i++) {
      const y1 = 150 + i * 4 + rnd() * 6, y2 = 150 + i * 4 + rnd() * 6, sag = 10 + rnd() * 30;
      g.beginPath(); g.moveTo(a, y1); g.quadraticCurveTo((a + b) / 2, y1 + sag, b, y2); g.stroke();
    }
    for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(a + (rnd() - 0.5) * 22, 178 + rnd() * 22, 10 + rnd() * 14, 4 + rnd() * 6, rnd() * Math.PI * 2, 0, Math.PI * 2); g.stroke(); }
  }
}

// ---------- Người ----------
function makeLook() {
  const role = pick(['adult', 'adult', 'adult', 'student', 'kid']);
  const L = { role, skin: pick(['#F1C9A5', '#E0AC80', '#C68B5E', '#F5D5B8']), hair: pick(['#1E1A1A', '#2B211C', '#3B2A20']),
    long: Math.random() < 0.45, hat: pick([0, 0, 0, 1, 2, 3]), shirt: pick(SHIRTS), pants: pick(PANTS), scale: 1,
    helmet: pick(HELMETS), capColor: pick(['#1F6F8B', '#C0392B', '#2E2E33', '#F7B32B']) };
  if (role === 'student') { L.shirt = '#F7F7F2'; L.pants = pick(['#1F3A73', '#243B6B']); L.scale = 0.78; L.bag = pick(['#D94F4F', '#3E7CB1', '#E0A526']); L.scarf = '#D62828'; L.hat = 0; }
  else if (role === 'kid') { L.scale = 0.68; L.hat = pick([0, 3]); }
  return L;
}
function drawPerson(g, p) {
  const L = p.look, s = L.scale || 1;
  const swing = p.moving ? Math.sin(p.phase) : 0;
  g.save();
  g.translate(p.x, p.y);
  if (!p.seated) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, 0, 20 * s, 5 * s, 0, 0, Math.PI * 2); g.fill(); }
  g.scale(s * (p.dir < 0 ? -1 : 1), s);
  g.lineCap = 'round';
  g.strokeStyle = L.pants; g.lineWidth = 10;
  if (p.seated) {
    g.beginPath(); g.moveTo(-2, -44); g.lineTo(14, -40); g.lineTo(16, -5); g.stroke();
  } else {
    g.beginPath(); g.moveTo(-4, -44); g.lineTo(-4 + swing * 12, -5); g.stroke();
    g.beginPath(); g.moveTo(4, -44); g.lineTo(4 - swing * 12, -5); g.stroke();
    if (L.short) { // quần đùi: nửa dưới chân là da
      g.strokeStyle = L.skin; g.lineWidth = 8;
      g.beginPath(); g.moveTo(-4 + swing * 5, -26); g.lineTo(-4 + swing * 12, -6); g.moveTo(4 - swing * 5, -26); g.lineTo(4 - swing * 12, -6); g.stroke();
    }
    g.fillStyle = L.shoes || '#2A211B';
    g.fillRect(-4 + swing * 12 - 5, -5, 13, 5); g.fillRect(4 - swing * 12 - 5, -5, 13, 5);
  }
  if (L.bag) { g.fillStyle = L.bag; rr(g, -25, -94, 14, 40, 5); g.fill(); }
  g.fillStyle = L.shirt; rr(g, -14, -99, 28, 58, 9); g.fill();
  if (L.long_dress) { g.beginPath(); g.moveTo(-14, -48); g.lineTo(14, -48); g.lineTo(18, -14); g.lineTo(-18, -14); g.closePath(); g.fill(); }
  if (L.style === 'flower') { g.fillStyle = '#F7E1A0'; for (const [a, b] of [[-8, -90], [5, -84], [-4, -72], [8, -62], [-9, -54], [2, -48]]) { g.beginPath(); g.arc(a, b, 2.6, 0, 7); g.fill(); } }
  if (L.style === 'collar') { g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(-9, -99); g.lineTo(0, -90); g.lineTo(9, -99); g.lineTo(4, -86); g.lineTo(0, -90); g.lineTo(-4, -86); g.closePath(); g.fill(); g.fillStyle = '#9AA0A6'; for (let yy = -84; yy < -46; yy += 9) { g.beginPath(); g.arc(0, yy, 1.4, 0, 7); g.fill(); } }
  if (L.style === 'aodai') { g.fillStyle = 'rgba(255,224,138,.8)'; g.fillRect(-2, -99, 4, 56); }
  g.strokeStyle = 'rgba(35,26,20,.35)'; g.lineWidth = 1.5; rr(g, -14, -99, 28, 58, 9); g.stroke();
  if (L.acc === 'scarf') { for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#F2F2EE' : '#231A14'; g.fillRect(-10 + k * 5, -100, 5, 7); } g.fillStyle = '#231A14'; g.beginPath(); g.moveTo(4, -94); g.lineTo(12, -76); g.lineTo(6, -76); g.closePath(); g.fill(); }
  if (L.scarf) { g.fillStyle = L.scarf; g.beginPath(); g.moveTo(-7, -97); g.lineTo(9, -97); g.lineTo(3, -80); g.closePath(); g.fill(); }
  const hx = (p.moving ? -swing * 14 : 4) + 2, hy = -56;
  g.strokeStyle = L.style === 'tank' ? L.skin : L.shirt; g.lineWidth = 8;
  g.beginPath(); g.moveTo(0, -90); g.lineTo(hx, hy); g.stroke();
  g.fillStyle = L.skin; g.beginPath(); g.arc(hx, hy + 2, 4.5, 0, 7); g.fill();
  if (L.acc === 'bracelet') { g.strokeStyle = '#8C5B2A'; g.lineWidth = 3; g.beginPath(); g.arc(hx - (hx - 0) * 0.12, hy - 4, 4.5, 0, 7); g.stroke(); }
  if (L.acc === 'book') { g.fillStyle = '#C0392B'; g.fillRect(hx - 2, hy - 8, 10, 13); g.fillStyle = '#FFF4D6'; g.fillRect(hx, hy - 6, 6, 9); }
  if (p.rod) { g.strokeStyle = '#8C6A3A'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + 120, hy - 150); g.stroke(); }
  if (p.item && p.state === 'leave') emoji(g, p.item, hx + 6, hy, 16);
  g.fillStyle = L.skin; g.fillRect(-4, -106, 8, 9);
  g.beginPath(); g.arc(0, -115, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = L.hair;
  g.beginPath(); g.arc(-1, -118, 13.5, Math.PI * 0.92, Math.PI * 2.05); g.fill();
  if (L.long) { rr(g, -14, -120, 9, 32, 4); g.fill(); }
  g.fillStyle = '#231A14'; g.beginPath(); g.arc(7, -115, 1.8, 0, 7); g.fill();
  if (L.glasses || L.acc === 'glasses') { g.strokeStyle = '#231A14'; g.lineWidth = 1.5; g.beginPath(); g.arc(7, -115, 4.5, 0, 7); g.stroke(); }
  drawHat(g, L);
  g.restore();
}
function drawHat(g, L) {
  if (L.hat === 1) {
    g.fillStyle = '#E6CB85'; g.beginPath(); g.moveTo(-27, -118); g.lineTo(27, -118); g.lineTo(0, -144); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,90,40,.55)'; g.lineWidth = 1.2; g.beginPath();
    for (let i = 1; i < 5; i++) { g.moveTo(0, -144); g.lineTo(-27 + i * 10.8, -118); }
    g.stroke();
  } else if (L.hat === 2) {
    g.fillStyle = L.helmet; g.beginPath(); g.arc(0, -118, 15, Math.PI, 0); g.fill(); g.fillRect(-15, -119, 30, 4);
  } else if (L.hat === 3) {
    g.fillStyle = L.capColor; g.beginPath(); g.arc(0, -119, 13.5, Math.PI, 0); g.fill(); g.fillRect(0, -122, 22, 4);
  } else if (L.hat === 4) {
    g.fillStyle = '#EFE2BF'; g.beginPath(); g.ellipse(0, -122, 25, 5, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(0, -123, 12, Math.PI, 0); g.fill();
    g.fillStyle = '#8B5A2B'; g.fillRect(-12, -125, 24, 3);
  }
}
function playerLook() {
  const o = S.outfit, F = (slot) => (o[slot] ? FASHION[o[slot]] : null);
  const shirt = F('shirt'), pants = F('pants');
  return { skin: '#E0AC80', hair: '#1E1A1A', long: true, scale: 1.05, capColor: '#C0392B', helmet: '#D98E04',
    hat: F('hat')?.hat || 0, shirt: shirt?.color || '#8E6FB5', style: shirt?.style, long_dress: shirt?.style === 'aodai',
    pants: pants?.color || '#231A14', short: !!pants?.short, shoes: F('shoes')?.shoes, acc: F('acc')?.acc };
}
function nameTag(g, name, x, y, mine, sub) {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = '800 17px "Baloo 2", sans-serif';
  g.lineWidth = 4; g.strokeStyle = '#231A14'; g.strokeText(name, x, y - 12);
  g.fillStyle = mine ? '#FFB347' : '#FFF4D6'; g.fillText(name, x, y - 12);
  if (sub) {
    g.font = '700 12px "Be Vietnam Pro", sans-serif';
    g.lineWidth = 3; g.strokeText(sub, x, y + 4);
    g.fillStyle = mine ? '#FFE08A' : '#E6D3A3'; g.fillText(sub, x, y + 4);
  }
}
function sellerLook(i, seed = 0) {
  const r = mulberry32(i * 31 + seed + 7);
  return { skin: ['#E0AC80', '#F1C9A5', '#C68B5E'][Math.floor(r() * 3)], hair: '#1E1A1A', long: r() < 0.6, hat: r() < 0.6 ? 1 : 3, capColor: '#1F6F8B', shirt: SELLER_SHIRTS[Math.floor(r() * SELLER_SHIRTS.length)], pants: '#231A14', scale: 1.05 };
}

// ---------- Sạp hàng ----------
function drawBasket(g, x, y, items) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#B07A3A'; g.beginPath(); g.moveTo(-34, -38); g.lineTo(34, -38); g.lineTo(26, 0); g.lineTo(-26, 0); g.closePath(); g.fill();
  g.save(); g.clip(); g.strokeStyle = '#7E5424'; g.lineWidth = 1.5; g.beginPath();
  for (let i = -50; i < 50; i += 8) { g.moveTo(i, -38); g.lineTo(i + 22, 0); g.moveTo(i, -38); g.lineTo(i - 22, 0); }
  g.stroke(); g.restore();
  g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-34, -38); g.lineTo(34, -38); g.lineTo(26, 0); g.lineTo(-26, 0); g.closePath(); g.stroke();
  items.forEach((it, k) => emoji(g, it, (k - (items.length - 1) / 2) * 24, -48, 24));
  g.fillStyle = '#8C5B2A'; g.beginPath(); g.ellipse(0, -38, 36, 6, 0, 0, 7); g.fill(); g.stroke();
  g.restore();
}
function wheel(g, x, y, r, rot = 0) {
  g.fillStyle = '#2A2A2E'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#9AA0A6'; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill();
  g.strokeStyle = '#5F6368'; g.lineWidth = 1.5; g.beginPath();
  for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 4; g.moveTo(x - Math.cos(a) * r * 0.55, y - Math.sin(a) * r * 0.55); g.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); }
  g.stroke();
}
function drawUmbrella(g, col) {
  const cx = STALL_X + 10, cy = STALL_Y - 236;
  g.strokeStyle = '#6E6A64'; g.lineWidth = 5; g.beginPath(); g.moveTo(STALL_X + 84, STALL_Y - 4); g.lineTo(cx, cy - 30); g.stroke();
  const segs = 8, rx = 135;
  for (let i = 0; i < segs; i++) {
    const a = cx - rx + (i * 2 * rx) / segs, b = a + (2 * rx) / segs;
    g.fillStyle = i % 2 ? '#FFF4D6' : col;
    g.beginPath(); g.moveTo(cx, cy - 52); g.lineTo(a, cy); g.quadraticCurveTo((a + b) / 2, cy + 14, b, cy); g.closePath(); g.fill();
  }
  g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - rx, cy); g.lineTo(cx, cy - 52); g.lineTo(cx + rx, cy); g.stroke();
}
function drawStool(g, x, y) {
  g.fillStyle = '#D7372B'; g.beginPath(); g.moveTo(x - 18, y - 34); g.lineTo(x + 18, y - 34); g.lineTo(x + 22, y); g.lineTo(x - 22, y); g.closePath(); g.fill();
  g.fillStyle = '#B02A20'; g.fillRect(x - 20, y - 38, 40, 6);
  g.fillStyle = '#8E1F17'; g.beginPath(); g.arc(x, y - 16, 5, 0, 7); g.fill();
}
function drawSignBoard(g, x, y) {
  g.strokeStyle = '#6B4F3A'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 20, y); g.lineTo(x - 10, y - 40); g.moveTo(x + 20, y); g.lineTo(x + 10, y - 40); g.stroke();
  g.fillStyle = '#E3C99A'; rr(g, x - 38, y - 96, 76, 58, 4); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#C0392B'; g.font = '800 17px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('NGON', x, y - 80); g.fillStyle = '#1F4E8C'; g.fillText('BỔ · RẺ', x, y - 58);
}
// d = { stall, icons, open, look, du, ghe, bang, label, duCol }
function drawStallFrame(g, d) {
  const x = STALL_X, y = STALL_Y;
  const vendor = { x: x + 10, y: y - 14, dir: -1, look: d.look, moving: false, phase: 0 };
  const icons = d.open ? d.icons : [];
  if (d.ghe) { drawStool(g, x - 122, y + 4); drawStool(g, x + 128, y + 4); }
  if (d.du && (d.stall === 'ganh' || d.stall === 'xe_day')) drawUmbrella(g, d.duCol || '#D7372B');
  if (d.stall === 'ganh') {
    drawPerson(g, { ...vendor, x, y: y - 10 });
    g.strokeStyle = '#8C6A3A'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 110, y + 8); g.lineTo(x + 110, y + 2); g.stroke();
    drawBasket(g, x - 60, y + 6, icons.slice(0, 2));
    drawBasket(g, x + 60, y + 6, icons.slice(2, 4));
    if (!d.open) { g.fillStyle = '#1F6F8B'; for (const bx of [-60, 60]) { rr(g, x + bx - 36, y - 44, 72, 14, 6); g.fill(); } }
  } else if (d.stall === 'xe_day') {
    drawPerson(g, vendor);
    wheel(g, x - 58, y - 20, 20); wheel(g, x + 58, y - 20, 20);
    g.fillStyle = '#9C6B3F'; rr(g, x - 92, y - 82, 184, 50, 6); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#FFF4D6'; g.fillRect(x - 80, y - 72, 160, 26);
    signText(g, d.label || 'HÀNG RONG', x, y - 60, 15, '#C0392B', 150);
    g.fillStyle = d.open ? 'rgba(200,230,245,.55)' : '#1F6F8B'; rr(g, x - 82, y - 134, 164, 52, 6); g.fill(); g.strokeStyle = '#6B4524'; g.lineWidth = 4; g.stroke();
    icons.slice(0, 5).forEach((it, k) => emoji(g, it, x - 60 + k * 30, y - 106, 26));
    g.strokeStyle = '#6B4524'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 92, y - 60); g.lineTo(x - 128, y - 84); g.stroke();
  } else if (d.stall === 'sap') {
    g.strokeStyle = '#6E6A64'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 112, y); g.lineTo(x - 112, y - 196); g.moveTo(x + 112, y); g.lineTo(x + 112, y - 196); g.stroke();
    drawPerson(g, vendor);
    g.fillStyle = d.duCol || '#1F6F8B'; g.beginPath(); g.moveTo(x - 132, y - 200); g.lineTo(x + 132, y - 200); g.lineTo(x + 142, y - 168); g.lineTo(x - 142, y - 168); g.closePath(); g.fill();
    g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = x - 130; k < x + 130; k += 36) { g.beginPath(); g.moveTo(k, y - 200); g.lineTo(k + 18, y - 200); g.lineTo(k + 20, y - 168); g.lineTo(k + 2, y - 168); g.fill(); }
    g.fillStyle = '#8C6A4A'; g.fillRect(x - 118, y - 74, 236, 14); g.strokeStyle = '#231A14'; g.strokeRect(x - 118, y - 74, 236, 14);
    g.fillStyle = '#6B4F3A'; g.fillRect(x - 110, y - 60, 8, 60); g.fillRect(x + 102, y - 60, 8, 60);
    g.fillStyle = '#C0392B'; g.fillRect(x - 118, y - 60, 236, 30);
    signText(g, d.label || 'HÀNG RONG', x, y - 46, 16, '#FFF4D6', 220);
    icons.slice(0, 7).forEach((it, k) => emoji(g, it, x - 96 + k * 32, y - 90, 28));
    if (!d.open) { g.fillStyle = '#1F6F8B'; rr(g, x - 116, y - 108, 232, 36, 8); g.fill(); }
  } else if (d.stall === 'kiot') {
    g.fillStyle = '#2E7D4F'; rr(g, x - 120, y - 200, 240, 200, 6); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#3B2E2A'; g.fillRect(x - 100, y - 164, 200, 86);
    g.save(); g.beginPath(); g.rect(x - 100, y - 164, 200, 86); g.clip();
    drawPerson(g, { ...vendor, x: x + 30, y: y - 18 });
    g.fillStyle = '#6B4F3A'; g.fillRect(x - 100, y - 130, 200, 4);
    icons.slice(0, 5).forEach((it, k) => emoji(g, it, x - 80 + k * 26, y - 144, 20));
    g.restore();
    g.fillStyle = '#E3C99A'; g.fillRect(x - 108, y - 80, 216, 12);
    icons.slice(0, 6).forEach((it, k) => emoji(g, it, x - 85 + k * 34, y - 92, 26));
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#FFF4D6' : (d.duCol || '#D7372B'); g.beginPath(); g.moveTo(x - 128 + i * 32, y - 206); g.lineTo(x - 96 + i * 32, y - 206); g.lineTo(x - 96 + i * 32, y - 176); g.quadraticCurveTo(x - 112 + i * 32, y - 166, x - 128 + i * 32, y - 176); g.closePath(); g.fill(); }
    g.strokeStyle = '#231A14'; g.beginPath(); g.moveTo(x - 128, y - 206); g.lineTo(x + 128, y - 206); g.stroke();
    g.fillStyle = '#FFF4D6'; g.fillRect(x - 90, y - 56, 180, 30);
    signText(g, d.label || 'KI-ỐT', x, y - 42, 16, '#2E7D4F', 170);
    if (!d.open) { g.fillStyle = '#A3ABB0'; g.fillRect(x - 100, y - 164, 200, 86); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.beginPath(); for (let k = y - 160; k < y - 80; k += 6) { g.moveTo(x - 100, k); g.lineTo(x + 100, k); } g.stroke(); }
  }
  if (d.bang) drawSignBoard(g, x - 150, y + 4);
}
function drawGianStall(g, cx, d) {
  g.save();
  g.translate(cx - STALL_X * STALL_SCALE, STALL_BASE - STALL_Y * STALL_SCALE);
  g.scale(STALL_SCALE, STALL_SCALE);
  drawStallFrame(g, d);
  g.restore();
}
function drawTrash(g, x, y, k) {
  g.fillStyle = 'rgba(90,110,60,.35)'; g.beginPath(); g.ellipse(x, y, 18, 4, 0, 0, 7); g.fill();
  if (k === 0) { g.fillStyle = '#2F3E2F'; g.beginPath(); g.ellipse(x, y - 10, 14, 12, 0, 0, 7); g.fill(); g.fillRect(x - 3, y - 26, 6, 6); }
  else if (k === 1) { g.fillStyle = '#E8C547'; g.beginPath(); g.ellipse(x - 6, y - 4, 10, 4, -0.5, 0, 7); g.ellipse(x + 6, y - 4, 10, 4, 0.5, 0, 7); g.fill(); }
  else { g.save(); g.translate(x, y - 5); g.rotate(1.3); g.fillStyle = '#C0392B'; g.fillRect(-10, -5, 20, 10); g.fillStyle = '#BBB'; g.fillRect(8, -5, 3, 10); g.restore(); }
}
function drawRat(g, x, y) {
  const j = Math.sin(R.t * 12) * 3;
  g.save(); g.translate(x + j, y);
  g.fillStyle = '#6E6A64'; g.beginPath(); g.ellipse(0, -8, 14, 8, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(13, -11, 6, 0, 7); g.fill();
  g.fillStyle = '#E8A0A0'; g.beginPath(); g.arc(12, -17, 3, 0, 7); g.fill();
  g.strokeStyle = '#8E8A84'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(-26, -20, -32, -6); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(16, -12, 1.5, 0, 7); g.fill();
  g.restore();
}
function drawBike(g, b) {
  g.save(); g.translate(b.x, b.y); g.scale(b.dir, 1);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 0, 44, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(-28, -13, 13, 0, 7); g.arc(28, -13, 13, 0, 7); g.fill();
  g.fillStyle = '#999'; g.beginPath(); g.arc(-28, -13, 5, 0, 7); g.arc(28, -13, 5, 0, 7); g.fill();
  g.fillStyle = b.color; g.beginPath(); g.moveTo(-40, -22); g.quadraticCurveTo(-30, -44, 0, -40); g.lineTo(14, -28); g.lineTo(24, -52); g.lineTo(34, -50); g.lineTo(34, -22); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(35,26,20,.6)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#231A14'; rr(g, -34, -48, 34, 8, 3); g.fill();
  g.strokeStyle = '#444'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, -50); g.lineTo(24, -64); g.stroke();
  if (b.cargo) { g.fillStyle = '#B07A3A'; for (let k = 0; k < 3; k++) g.fillRect(-62, -58 - k * 18, 30, 16); }
  const r = b.rider;
  const rider = (ox, shirt, helm) => {
    g.fillStyle = shirt; rr(g, ox - 10, -86, 20, 40, 7); g.fill();
    g.strokeStyle = '#2F3E46'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(ox, -48); g.lineTo(ox + 14, -40); g.lineTo(ox + 14, -22); g.stroke();
    g.fillStyle = r.skin; g.beginPath(); g.arc(ox + 1, -96, 10, 0, 7); g.fill();
    g.fillStyle = helm; g.beginPath(); g.arc(ox, -99, 12, Math.PI, 0); g.fill(); g.fillRect(ox - 12, -100, 24, 4);
  };
  if (!b.parked) {
    if (b.pass) rider(-24, b.pass.shirt, b.pass.helmet);
    rider(-4, r.shirt, r.helmet);
    g.strokeStyle = r.shirt; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -78); g.lineTo(24, -62); g.stroke();
  }
  g.restore();
}
function drawTruck(g, x, y) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(140, 0, 150, 7, 0, 0, 7); g.fill();
  g.fillStyle = '#5E6E34'; rr(g, 0, -128, 196, 100, 8); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#E8C547'; g.fillRect(0, -70, 196, 12);
  signText(g, 'CÔNG AN PHƯỜNG', 98, -100, 22, '#FFF4D6', 180);
  g.fillStyle = '#6E7F3C'; g.beginPath(); g.moveTo(196, -104); g.lineTo(252, -104); g.lineTo(282, -62); g.lineTo(282, -28); g.lineTo(196, -28); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#BFD9E6'; g.beginPath(); g.moveTo(206, -96); g.lineTo(248, -96); g.lineTo(270, -64); g.lineTo(206, -64); g.closePath(); g.fill();
  g.fillStyle = '#2E2E33'; g.fillRect(-4, -34, 290, 10);
  wheel(g, 50, -18, 20, R.t * 8); wheel(g, 232, -18, 20, R.t * 8);
  g.fillStyle = Math.floor(R.t * 6) % 2 ? '#E53935' : '#1E88E5'; rr(g, 212, -116, 30, 12, 3); g.fill();
  g.restore();
}

// ---------- Trời ----------
const SKY = [[0, '#0E1328', '#1D2244'], [4.5, '#1B2440', '#3A3D6B'], [6, '#F4A871', '#FCE3B0'], [7.5, '#86C5E0', '#DDF1F6'],
  [16, '#86C5E0', '#E6F4F1'], [17.8, '#F08A5D', '#FBD38D'], [19.2, '#46407A', '#E58E6D'], [20.5, '#161D3A', '#2E3263'], [24, '#0E1328', '#1D2244']];
function darkness(h) { return h < 5.5 ? 0.5 : h < 7 ? lerp(0.5, 0, (h - 5.5) / 1.5) : h < 17.5 ? 0 : h < 20 ? lerp(0, 0.48, (h - 17.5) / 2.5) : 0.5; }
function drawSky(h) {
  let i = 0;
  while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const [h0, a0, b0] = SKY[i], [h1, a1, b1] = SKY[i + 1];
  const t = clamp((h - h0) / (h1 - h0), 0, 1);
  const grd = ctx.createLinearGradient(0, 0, 0, GROUND);
  grd.addColorStop(0, mixHex(a0, a1, t)); grd.addColorStop(1, mixHex(b0, b1, t));
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, GROUND + 10);
  const d = darkness(h);
  if (d > 0.2) { ctx.fillStyle = `rgba(255,255,240,${(d - 0.2) * 1.8})`; for (const s of R.stars) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); } }
  if (h >= 5.8 && h <= 18.8) {
    const p = (h - 5.8) / 13;
    ctx.fillStyle = h > 17 || h < 7 ? '#FFC36B' : '#FFE9A8';
    ctx.beginPath(); ctx.arc(lerp(80, 1200, p), GROUND - 80 - Math.sin(Math.PI * p) * 300, 34, 0, 7); ctx.fill();
  } else {
    const p = ((h + 24 - 19) % 24) / 11;
    ctx.fillStyle = '#F4F1DE'; ctx.beginPath(); ctx.arc(lerp(100, 1180, p), GROUND - 100 - Math.sin(Math.PI * p) * 260, 24, 0, 7); ctx.fill();
  }
  ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - d)})`;
  for (const c of R.clouds) { ctx.beginPath(); ctx.ellipse(c.x, c.y, 60 * c.s, 18 * c.s, 0, 0, 7); ctx.ellipse(c.x + 30 * c.s, c.y - 12 * c.s, 40 * c.s, 18 * c.s, 0, 0, 7); ctx.fill(); }
}
function bubble(text, x, y, opts = {}) {
  ctx.font = `700 ${opts.size || 15}px "Baloo 2", sans-serif`;
  const w = Math.min(opts.maxW || 260, ctx.measureText(text).width + 22), hgt = (opts.size || 15) + 16;
  const bx = clamp(x - w / 2, 8, W - w - 8);
  ctx.fillStyle = opts.bg || '#FFFFFF'; rr(ctx, bx, y - hgt, w, hgt, 10); ctx.fill();
  ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x + 6, y - 1); ctx.lineTo(x, y + 9); ctx.closePath(); ctx.fillStyle = opts.bg || '#FFFFFF'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 9); ctx.lineTo(x + 6, y); ctx.stroke();
  ctx.fillStyle = opts.color || '#231A14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, y - hgt / 2 + 1, w - 14);
}

// ---------- Render ----------
function getBg(id) { if (!R.bgCache[id]) R.bgCache[id] = buildBg(id); return R.bgCache[id]; }
function currentGians() {
  if (R.view === 'neighbor') {
    const n = nbState(R.visit), b = nbBase(R.visit);
    return n.gians.map((g, i) => ({ open: g.open, stall: g.stall, good: g.good, qty: g.open ? 20 : 0, cash: g.cash, trash: g.trash, rat: g.rat, broken: false,
      du: i % 2 === 0, ghe: i % 3 === 0, bang: false, phep: false, paused: false, seed: hashStr(b.id) % 997, duCol: b.color, owner: b.name, cap: 20, goods: [g.good, b.goods[(i + 1) % b.goods.length]] }));
  }
  if (R.attract) {
    const demo = [['ganh', 'kem_chuoi', 1800], ['xe_day', 'banh_mi', 0], ['sap', 'ao_thun', 32000], ['kiot', 'giay', 0], ['xe_day', 'hot_vit', 9000], [null]];
    return demo.map(([stall, good, cash], i) => stall ? { open: true, stall, goods: [good], cap: 20, qty: 20, cash, trash: i === 4 ? 1 : 0, rat: false, broken: false, du: true, ghe: i === 2, bang: i === 3, paused: false, seed: 0, owner: 'Vua Vỉa Hè' } : { open: false });
  }
  return S.streets[S.cur].gians.map((g) => ({ ...g, paused: g.pausedUntil > now(), seed: S.cur * 100, owner: S.player.name, qty: gQty(g), cap: slotsOpen(g) * slotCap(g), goods: gGoods(g) }));
}
function bgIdNow() {
  if (R.view === 'fish') return 'pond';
  if (R.view === 'cafe') return 'cafe';
  if (R.view === 'home') return 'home';
  if (R.view === 'market') return 'market';
  if (R.view === 'neighbor') return 'nb_' + R.visit;
  return R.attract ? 'street_demo' : 'street_' + S.cur;
}
function render() {
  const h = realHour();
  const bg = getBg(bgIdNow());
  const hits = [];
  const cam = Math.round(R.cam);
  ctx.clearRect(0, 0, W, H);
  drawSky(h);
  ctx.save();
  ctx.translate(-cam, 0);
  ctx.drawImage(bg.canvas, -sceneMargin(), 0);

  // các vật cần xếp theo chiều sâu (y)
  const layer = [];
  const people = (list) => list.forEach((p) => layer.push({ y: p.y, draw: () => drawPerson(ctx, p) }));
  people(R.walkers);
  let gians = [];
  if (isStreetView()) {
    gians = currentGians();
    gians.forEach((G, i) => {
      const cx = gx(i);
      if (!G.open) {
        // cửa cuốn đóng + bảng cho thuê
        ctx.fillStyle = '#A3ABB0'; ctx.fillRect(cx - GIAN_W / 2 + 18, GROUND - 66, GIAN_W - 36, 66);
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = GROUND - 62; k < GROUND; k += 5) { ctx.moveTo(cx - GIAN_W / 2 + 18, k); ctx.lineTo(cx + GIAN_W / 2 - 18, k); } ctx.stroke();
        layer.push({ y: 500, draw: () => {
          ctx.fillStyle = '#E3C99A'; rr(ctx, cx - 70, 436, 140, 70, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.strokeStyle = '#6B4F3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 34, 506); ctx.lineTo(cx - 40, 530); ctx.moveTo(cx + 34, 506); ctx.lineTo(cx + 40, 530); ctx.stroke();
          signText(ctx, R.view === 'neighbor' ? 'TRỐNG' : 'CHO THUÊ', cx, 458, 24, '#C0392B');
          if (R.view === 'street' && !R.attract) {
            const [cost, lvl] = gianCost(S.cur, i);
            ctx.font = '700 14px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#231A14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(S.level < lvl ? `Cần cấp ${lvl}` : fmt(cost), cx, 488);
          }
        } });
        hits.push({ x: cx - GIAN_W / 2 + 10, y: 250, w: GIAN_W - 20, h: WALK_Y0 - 250, kind: 'gian', i });
        return;
      }
      // biển hiệu gian hàng đè lên biển của căn nhà
      const gl = G.goods || [];
      const title = gl.length > 1 ? 'TẠP HÓA' : gl.length ? GOODS[gl[0]].name.toUpperCase() : 'GIAN HÀNG';
      ctx.fillStyle = G.duCol || ['#C0392B', '#1F6F8B', '#2E7D4F', '#D98E04', '#7A3E9D', '#B03A6F'][i % 6];
      rr(ctx, cx - GIAN_W / 2 + 14, GROUND - 100, GIAN_W - 28, 34, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
      signText(ctx, `${title} · ${String(G.owner || '').toUpperCase()}`, cx, GROUND - 83, 20, '#FFF4D6', GIAN_W - 44);
      const icons = gl.length && G.qty > 0 ? Array.from({ length: 8 }, (_, k) => GOODS[gl[k % gl.length]].icon) : [];
      layer.push({ y: STALL_BASE, draw: () => {
        drawGianStall(ctx, cx, { stall: G.stall, icons, open: !G.paused && G.qty > 0, look: sellerLook(i, G.seed), du: G.du, ghe: G.ghe, bang: G.bang, duCol: G.duCol,
          label: title });
        if (G.broken) {
          ctx.strokeStyle = '#E8C547'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx - 110, 300); ctx.lineTo(cx + 110, 510); ctx.moveTo(cx + 110, 300); ctx.lineTo(cx - 110, 510); ctx.stroke();
          ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
        }
      } });
      for (let k = 0; k < Math.min(3, G.trash); k++) {
        const tx = cx - 80 + k * 70, ty = 548 + (k % 2) * 22;
        layer.push({ y: ty, draw: () => drawTrash(ctx, tx, ty, k) });
        hits.push({ x: tx - 24, y: ty - 36, w: 48, h: 44, kind: 'trash', i, pri: 2, wx: tx, wy: ty + 6 });
      }
      if (G.rat) { const rx = cx + 110, ry = 560; layer.push({ y: ry, draw: () => drawRat(ctx, rx, ry) }); hits.push({ x: rx - 34, y: ry - 30, w: 68, h: 40, kind: 'rat', i, pri: 2, wx: rx, wy: ry + 6 }); }
      hits.push({ x: cx - GIAN_W / 2 + 10, y: 230, w: GIAN_W - 20, h: WALK_Y0 - 230, kind: 'gian', i });
    });
    for (const p of portalsFor()) { const hb = drawPortal(p); hits.push(hb); }
  } else if (R.view === 'home') {
    homeObjects(hits);
    for (const p of portalsFor()) hits.push(drawPortal(p));
  } else if (R.view === 'cafe') drawCafeScene(hits, layer);
  else if (R.view === 'fish') drawPondScene(hits);
  else if (R.view === 'market') marketObjects(hits, layer);

  if (R.view === 'street' && !R.attract) {
    people(R.buyers);
    for (const v of R.visitors) {
      const b = nbBase(v.id), p = { ...v, look: { scale: 1.15, ...npcLook(v.id) } };
      layer.push({ y: v.y, draw: () => { drawPerson(ctx, p); nameTag(ctx, b.name, v.x, v.y - 172, false, `Cấp ${nbState(v.id).lvl}`); } });
      hits.push({ x: v.x - 30, y: v.y - 175, w: 60, h: 180, kind: 'visitor', id: v.id, pri: 2 });
    }
  }
  if (R.view === 'neighbor') {
    const b = nbBase(R.visit), ox = 420, oy = 548;
    layer.push({ y: oy, draw: () => { drawPerson(ctx, { x: ox, y: oy, dir: 1, look: { scale: 1.15, ...npcLook(R.visit) }, moving: false, phase: 0 }); nameTag(ctx, b.name, ox, oy - 172, false, 'Chủ nhà'); } });
  }
  if (R.started && !R.attract && R.view !== 'fish' && R.view !== 'cafe') {
    // (chợ, phố, nhà riêng: nhân vật đứng)
    const M = R.me;
    layer.push({ y: M.y, draw: () => {
      drawPerson(ctx, { x: M.x, y: M.y, dir: M.dir, look: { ...playerLook(), scale: 1.2 }, moving: M.moving, phase: M.phase });
      nameTag(ctx, S.player.name, M.x, M.y - 180, true, `Cấp ${S.level}`);
    } });
  }
  layer.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
  if (R.view !== 'fish' && R.view !== 'cafe' && R.view !== 'market') for (const b of [...R.bikes].sort((a, b2) => a.y - b2.y)) drawBike(ctx, b);
  if (R.police?.phase === 'drive') drawTruck(ctx, R.police.x, 660);

  // đêm xuống: phủ tối, đèn cửa sổ, đèn sạp
  const dk = darkness(h);
  if (dk > 0.01) {
    ctx.fillStyle = `rgba(12,16,48,${dk})`; ctx.fillRect(cam, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = clamp(dk * 1.4, 0, 0.9);
    for (const L of bg.lights) {
      if (!L.on || L.x + L.w < cam || L.x > cam + W) continue;
      ctx.fillStyle = L.warm ? `rgba(255,190,90,${a * (L.far ? 0.45 : L.shop ? 0.5 : 0.62)})` : `rgba(150,200,255,${a * (L.far ? 0.4 : 0.6)})`;
      ctx.fillRect(L.x, L.y, L.w, L.h);
    }
    gians.forEach((G, i) => {
      if (!G.open) return;
      const gr = ctx.createRadialGradient(gx(i), 400, 4, gx(i), 440, 190);
      gr.addColorStop(0, `rgba(255,220,140,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx(i), 440, 190, 0, 7); ctx.fill();
    });
    ctx.restore();
  }

  // bảng hàng + két tiền trên đầu mỗi gian
  gians.forEach((G, i) => {
    if (!G.open) return;
    const cx = gx(i);
    if (R.view === 'street') {
      const cap = G.cap || 1, gl = G.goods || [];
      ctx.fillStyle = 'rgba(255,244,214,.95)'; rr(ctx, cx - 52, 226, 104, 32, 9); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
      if (G.broken) signText(ctx, 'BỊ ĐẬP', cx, 241, 17, '#C0392B');
      else if (G.paused) signText(ctx, 'ĐANG DẸP', cx, 241, 16, '#1F6F8B');
      else if (!gl.length || G.qty <= 0) signText(ctx, 'HẾT HÀNG', cx, 241, 16, '#C0392B');
      else {
        gl.slice(0, 2).forEach((id, k) => emoji(ctx, GOODS[id].icon, cx - 40 + k * 14, 242, 16));
        ctx.fillStyle = '#E6D3A3'; rr(ctx, cx - 18, 237, 60, 10, 4); ctx.fill();
        ctx.fillStyle = G.qty / cap > 0.25 ? '#3F8A4A' : '#D7372B'; rr(ctx, cx - 18, 237, 60 * clamp(G.qty / cap, 0.04, 1), 10, 4); ctx.fill();
      }
      if (G.phep) { ctx.fillStyle = '#2E7D4F'; ctx.beginPath(); ctx.arc(cx + 52, 227, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '800 12px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', cx + 52, 228); }
    }
    if (G.cash >= 500) {
      const r = clamp(17 + Math.sqrt(G.cash) / 20, 17, 28);
      const y = 188 + Math.sin(R.t * 3 + i) * 3;
      ctx.fillStyle = '#F7C948'; ctx.strokeStyle = '#8C6A12'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6B4E0C'; ctx.font = `800 ${Math.round(r * 0.72)}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtK(G.cash), cx, y + 1, r * 1.8);
      hits.push({ x: cx - r - 8, y: y - r - 8, w: 2 * r + 16, h: 2 * r + 16, kind: 'cash', i, pri: 3 });
    }
  });
  if (R.view === 'home') exclaim(640, 286);
  if (R.police?.stopped) bubble('Lập biên bản!', R.police.x + 120, 500, { size: 18, bg: '#F9C9C0' });
  // lời nói
  if (R.view === 'cafe') for (const s of R.cafeSeats || []) { const say = R.cafeSay[s.id]; if (say) bubble(say.text, s.x, s.top - 30, { size: 14, maxW: 260 }); }
  if (R.view === 'street') for (const v of R.visitors) { const say = R.cafeSay[v.id]; if (say) bubble(say.text, v.x, v.y - 214, { size: 14, maxW: 260 }); }
  if (R.cafeSay.me && R.view !== 'cafe') bubble(R.cafeSay.me.text, R.me.x, R.me.y - 222, { size: 14, maxW: 260 });
  if (R.view === 'fish') drawFishOverlay();
  // điểm đến khi bấm đi
  if (R.me.moving && !R.keys.size && R.view !== 'fish') { ctx.strokeStyle = 'rgba(255,244,214,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(R.me.tx, R.me.ty, 16, 5, 0, 0, 7); ctx.stroke(); }
  if (R.hover) { ctx.strokeStyle = 'rgba(255,244,214,.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); rr(ctx, R.hover.x, R.hover.y, R.hover.w, R.hover.h, 10); ctx.stroke(); ctx.setLineDash([]); }
  for (const p of R.parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    if (p.type === 'text') {
      ctx.font = `800 ${p.small ? 17 : 24}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = '#231A14'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = '#F7C948'; ctx.strokeStyle = '#8C6A12'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 6, 6 * Math.abs(Math.cos(p.life * 12)) + 1, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  R.hits = hits;
}
const CAFE_TABLES = [300, 520, 760, 980];
function drawCafeScene(hits, layer) {
  const seats = [];
  const players = Net.roomPlayers();
  const M = R.me;
  CAFE_TABLES.forEach((tx, t) => {
    for (const side of [-1, 1]) {
      const sx = tx + side * 60;
      layer.push({ y: 571, draw: () => drawStool(ctx, sx, 572) });
      const taken = (side === -1 && t < players.length) || (M.sit && M.sit.x === sx);
      if (!taken) hits.push({ x: sx - 26, y: 530, w: 52, h: 46, kind: 'chair', sx, pri: 1 });
    }
    layer.push({ y: 574, draw: () => { ctx.fillStyle = '#8C8378'; ctx.fillRect(tx - 34, 520, 68, 8); ctx.fillRect(tx - 4, 528, 8, 46); emoji(ctx, '🥤', tx - 14, 508, 18); emoji(ctx, '☕', tx + 14, 508, 18); } });
  });
  players.forEach((pl, k) => {
    const seated = k < CAFE_TABLES.length;
    const x = seated ? CAFE_TABLES[k] - 60 : 1160, y = seated ? 540 : 596;
    const look = { scale: 1.1, ...pl.look };
    const top = y - 150 * look.scale;
    layer.push({ y: seated ? 572 : y, draw: () => { drawPerson(ctx, { x, y, dir: seated ? 1 : -1, look, seated, moving: false, phase: 0 }); nameTag(ctx, pl.name, x, top, false, `Cấp ${pl.level}`); } });
    seats.push({ id: pl.id, x, top: top - 24 });
    hits.push({ x: x - 34, y: top - 24, w: 68, h: y - top + 30, kind: 'cafe', id: pl.id, pri: 2 });
  });
  const my = M.sit ? { x: M.sit.x, y: 540, seated: true } : { x: M.x, y: M.y, seated: false };
  const top = my.y - 150 * 1.2;
  layer.push({ y: M.sit ? 573 : M.y, draw: () => {
    drawPerson(ctx, { x: my.x, y: my.y, dir: M.sit ? -1 : M.dir, look: { ...playerLook(), scale: 1.2 }, seated: my.seated, moving: M.moving, phase: M.phase });
    nameTag(ctx, S.player.name, my.x, top, true, `${fmt(S.money)} · Cấp ${S.level}`);
  } });
  seats.push({ id: 'me', x: my.x, top: top - 24 });
  hits.push({ x: -sceneMargin(), y: 440, w: W, h: 190, kind: 'floor', pri: -1 });
  // góc giải trí
  drawFunCorner(hits, layer);
  R.cafeSeats = seats;
}
function drawPondBg(g, rnd, rp, lights, PM = 0) {
  const X0 = -PM, XW = SW + 2 * PM;
  for (let x = X0 - 10; x < SW + PM;) {
    const w = 80 + rnd() * 60, h = 60 + rnd() * 70;
    g.fillStyle = rp(HOUSE_COLORS); g.fillRect(x, 330 - h, w, h);
    g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + w - 4, 330 - h, 4, h);
    for (let k = x + 10; k < x + w - 16; k += 22) { g.fillStyle = '#2C3440'; g.fillRect(k, 330 - h + 14, 12, 16); lights.push({ x: k, y: 330 - h + 14, w: 12, h: 16, on: rnd() < 0.6, warm: true }); }
    x += w;
  }
  for (let i = 0; i < 24; i++) { g.fillStyle = ['#2F6B3A', '#3F8A4A', '#4E9A52'][i % 3]; g.beginPath(); g.arc(X0 + rnd() * XW, 326 + rnd() * 16, 24 + rnd() * 26, 0, 7); g.fill(); }
  g.fillStyle = '#6FA05A'; g.fillRect(X0, 344, XW, 24);
  const wg = g.createLinearGradient(0, 366, 0, H);
  wg.addColorStop(0, '#5FA8BE'); wg.addColorStop(1, '#1F5C73');
  g.fillStyle = wg; g.fillRect(X0, 366, XW, H - 366);
  g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 2;
  for (let i = 0; i < 90; i++) { const x = X0 + rnd() * XW, y = 380 + rnd() * 330, w = 20 + rnd() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
  for (let i = 0; i < 10; i++) {
    const x = 520 + rnd() * 700, y = 400 + rnd() * 240;
    g.fillStyle = '#3F8A4A'; g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, 26, 9, 0, 0.35, Math.PI * 2 - 0.1); g.closePath(); g.fill();
    if (rnd() < 0.4) { g.fillStyle = '#F4A6C0'; g.beginPath(); g.arc(x + 6, y - 6, 6, 0, 7); g.fill(); }
  }
  // bờ gần, lau sậy
  g.fillStyle = '#6FA05A'; g.fillRect(X0, 520, PM, H - 520); g.beginPath(); g.moveTo(0, 520); g.quadraticCurveTo(140, 510, 200, 600); g.lineTo(230, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.strokeStyle = '#4E7A3A'; g.lineWidth = 3;
  for (let i = 0; i < 26; i++) { const x = 150 + rnd() * 90, y = 560 + rnd() * 150; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 30, x + 2 + rnd() * 10, y - 50 - rnd() * 20); g.stroke(); }
  // cầu gỗ chính
  g.fillStyle = '#5A4630'; for (let x = 210; x <= 470; x += 65) g.fillRect(x, 618, 10, 80);
  g.fillStyle = '#8C6A4A'; g.fillRect(170, 602, 320, 20);
  g.strokeStyle = 'rgba(35,26,20,.4)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 190; x < 490; x += 22) { g.moveTo(x, 602); g.lineTo(x, 622); } g.stroke();
  // cầu gỗ nhỏ bên phải
  g.fillStyle = '#5A4630'; for (let x = 1050; x <= 1190; x += 70) g.fillRect(x, 530, 8, 60);
  g.fillStyle = '#8C6A4A'; g.fillRect(1030, 518, 190, 14);
  // chòi đồ câu trên bờ
  g.fillStyle = '#6B4F3A'; g.fillRect(18, 430, 8, 110); g.fillRect(132, 430, 8, 110);
  g.fillStyle = '#C9A45C'; g.beginPath(); g.moveTo(0, 440); g.lineTo(79, 380); g.lineTo(158, 440); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(90,60,20,.5)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 6; x < 156; x += 10) { g.moveTo(79, 382); g.lineTo(x, 440); } g.stroke();
  g.fillStyle = '#8C6A4A'; g.fillRect(14, 492, 130, 14);
  g.fillStyle = '#3B2E2A'; g.fillRect(24, 444, 110, 48);
  lights.push({ x: 24, y: 444, w: 110, h: 48, on: true, warm: true, shop: true });
  g.fillStyle = '#B07A3A'; for (let k = 0; k < 4; k++) g.fillRect(30 + k * 26, 470, 20, 22);
  g.fillStyle = '#FFF4D6'; rr(g, 20, 404, 118, 26, 5); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2; g.stroke();
  signText(g, 'ĐỒ CÂU · MỒI', 79, 416, 15, '#1F6F8B', 110);
  // bảng hồ câu
  g.strokeStyle = '#6B4F3A'; g.lineWidth = 5; g.beginPath(); g.moveTo(225, 600); g.lineTo(225, 524); g.stroke();
  g.fillStyle = '#1F6F8B'; rr(g, 150, 470, 150, 54, 6); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2; g.stroke();
  signText(g, 'HỒ CÂU GIẢI TRÍ', 225, 488, 16, '#FFF4D6', 140);
  signText(g, 'Mở cửa cả ngày', 225, 508, 13, '#F7D774', 140);
}
const POND_ME = { x: 420, y: 606 };
function drawPondScene(hits) {
  const F = R.fish;
  // hàng xóm ngồi câu bên cầu phải
  drawPerson(ctx, { x: 1130, y: 520, dir: -1, look: { scale: 1, ...npcLook('chu_bay') }, seated: true, moving: false, phase: 0, rod: true });
  nameTag(ctx, nbBase('chu_bay').name, 1130, 520 - 156);
  const otip = { x: 1130 - 126, y: 520 - 206 };
  const ofy = 470 + Math.sin(R.t * 2) * 2;
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(otip.x, otip.y); ctx.quadraticCurveTo(930, 430, 900, ofy); ctx.stroke();
  drawFloat(900, ofy, 0);
  // nhân vật của mình
  drawPerson(ctx, { x: POND_ME.x, y: POND_ME.y, dir: 1, look: playerLook(), moving: false, phase: 0, rod: true });
  nameTag(ctx, S.player.name, POND_ME.x, POND_ME.y - 160, true);
  const tip = { x: POND_ME.x + 132, y: POND_ME.y - 216 };
  if (F.state !== 'idle' && F.state !== 'reel') {
    const dip = F.state === 'bite' ? 12 : F.nib > 0 ? 5 : 0;
    const k = F.state === 'cast' ? clamp(1 - F.t / 0.7, 0, 1) : 1;
    const baseY = F.fy + Math.sin(R.t * 2.2) * 2 + dip;
    const fx = lerp(tip.x, F.fx, k);
    const fy = lerp(tip.y, baseY, k) - Math.sin(Math.PI * k) * 80;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + fx) / 2, Math.min(tip.y, fy) + 40, fx, fy); ctx.stroke();
    drawFloat(fx, fy, k < 1 ? 0 : dip);
  }
  for (const r of R.ripples) { ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x, r.y + 4, r.r, r.r * 0.35, 0, 0, 7); ctx.stroke(); }
  hits.push({ x: 230, y: 360, w: SW - 230 + sceneMargin(), h: 260, kind: 'water' });
}
function drawFloat(x, y, dip) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(-10, -30, 20, 30); ctx.clip();
  ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.ellipse(0, -8 + dip * 0.2, 5, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-5, -9 + dip * 0.2, 10, 3);
  ctx.fillStyle = '#231A14'; ctx.fillRect(-1, -22 + dip * 0.2, 2, 6);
  ctx.restore();
}
function drawFishOverlay() {
  const F = R.fish;
  if (F.state === 'bite') {
    const s = 1 + Math.sin(R.t * 20) * 0.1;
    ctx.save(); ctx.translate(F.fx, F.fy - 50); ctx.scale(s, s);
    ctx.fillStyle = '#D7372B'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFF4D6'; ctx.font = '800 28px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 2);
    ctx.restore();
  } else if (F.state === 'reel' && F.catch) {
    const k = clamp(1 - F.t / 1.1, 0, 1);
    const x = lerp(F.fx, POND_ME.x + 30, k), y = lerp(F.fy, POND_ME.y - 120, k) - Math.sin(Math.PI * k) * 140;
    emoji(ctx, FISH[F.catch.id].icon, x, y, 44);
  }
}

// ---------- Nhập liệu ----------
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W + Math.round(R.cam), y: ((e.clientY - r.top) / r.height) * H };
}
function hitAt(p) {
  const list = R.hits.filter((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
  list.sort((a, b) => (b.pri || 0) - (a.pri || 0));
  return list[0] || null;
}
// đứng trước mặt gian để thao tác
const frontOf = (i) => ({ x: gx(i) + (R.me.x < gx(i) ? -40 : 40), y: WALK_Y0 + 8 });
canvas.addEventListener('pointerdown', (e) => {
  if (!R.started || R.modal) return;
  Snd.init();
  const p = toLogical(e);
  const h = hitAt(p);
  const walkFloor = () => { if (p.y > WALK_Y0 - 30 || R.view === 'cafe') walkTo(p.x, p.y); };
  if (!h) { if (R.view !== 'fish') walkFloor(); return; }
  if (h.kind === 'portal') { const pt = portalsFor().find((q) => q.side === h.side); walkTo(h.x + h.w / 2, WALK_Y0 + 20, () => pt?.go()); return; }
  if (R.view === 'street') {
    const i = h.i, f = frontOf(i ?? 0);
    if (h.kind === 'cash') walkTo(f.x, f.y, () => collect(S.cur, i));
    else if (h.kind === 'trash') walkTo(h.wx, h.wy, () => cleanTrash(S.cur, i));
    else if (h.kind === 'rat') walkTo(h.wx, h.wy, () => chaseRat(S.cur, i));
    else if (h.kind === 'visitor') { const v = R.visitors.find((q) => q.id === h.id); walkTo((v?.x ?? p.x) - 60, v?.y ?? p.y, () => openProfile(h.id)); }
    else if (h.kind === 'gian') walkTo(f.x, f.y, () => openGian(S.cur, i));
    else walkFloor();
  } else if (R.view === 'neighbor') {
    const i = h.i, f = frontOf(i ?? 0);
    const act = h.kind === 'cash' && R.tool === 'hand' ? 'steal' : (h.kind === 'trash' || h.kind === 'rat') && R.tool === 'hand' ? 'clean' : R.tool !== 'hand' && h.kind !== 'floor' ? R.tool : null;
    if (act && i != null) walkTo(h.wx ?? f.x, h.wy ?? f.y, () => Net.streetAction(R.visit, act, i));
    else walkFloor();
  } else if (R.view === 'home') {
    if (h.kind === 'door') walkTo(640, WALK_Y0 + 4, openChar);
    else if (h.kind === 'kho') walkTo(900, 560, openKho);
    else if (h.kind === 'mail') walkTo(400, WALK_Y0 + 6, openNews);
    else if (h.kind === 'land') walkTo(320, 560, () => openModal('Ông Tư bán đất', street2HTML(), { kind: 'street2' }));
    else walkFloor();
  } else if (R.view === 'cafe') {
    if (h.kind === 'cafe') { const s = (R.cafeSeats || []).find((q) => q.id === h.id); walkTo((s?.x ?? p.x) + 70, 596, () => openProfile(h.id)); }
    else if (h.kind === 'chair') walkTo(h.sx, 596, () => { R.me.sit = { x: h.sx }; });
    else if (h.kind === 'fun') walkTo(150, 596, openFun);
    else walkTo(p.x, p.y);
  } else if (R.view === 'fish' && h.kind === 'water') fishAction();
  else if (R.view === 'market') {
    if (h.kind === 'mstall') { const m = MARKET_STALLS.find((q) => q.id === h.id); walkTo(m.x, 560, () => openMarketStall(h.id)); }
    else if (h.kind === 'board') walkTo(170, 560, () => openMarket());
    else if (h.kind === 'boss') walkTo(MARKET_BOSS.x - 40, 560, () => openModal('Sổ nợ · Ông Chủ Mối', debtHTML(), { kind: 'debt' }));
    else walkTo(p.x, p.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!R.started || R.modal) { R.hover = null; return; }
  const h = hitAt(toLogical(e));
  R.hover = h && ['cash', 'trash', 'rat', 'chair', 'portal', 'kho', 'door', 'mail', 'land', 'mstall', 'board', 'boss', 'fun'].includes(h.kind) ? h : null;
  canvas.style.cursor = h && h.kind !== 'floor' ? 'pointer' : 'default';
});
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's']);
window.addEventListener('keyup', (e) => { R.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
window.addEventListener('blur', () => R.keys.clear());
window.addEventListener('keydown', (e) => {
  if (!R.started) return;
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.key === 'Escape') { if (!$('modal-close').hidden && R.modal) closeModal(); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (R.police?.phase === 'warn') flee();
    else if (!R.modal && R.view === 'street') collectAll();
    else if (!R.modal && R.view === 'fish') fishAction();
    return;
  }
  if (R.modal) return;
  if (MOVE_KEYS.has(key)) { e.preventDefault(); R.keys.add(key); return; }
  if (key === 'c') enterView('market'); else if (key === 'k') openKho(); else if (key === 'x') openNeighbors();
  else if (key === 'f') openCafe(); else if (key === 't') openChar(); else if (key === 'n') openNews();
  else if (key === 'q') openPond(); else if (key === 'h') enterView('home');
  else if (/^[1-6]$/.test(key) && R.view === 'street') { const i = Number(key) - 1, f = frontOf(i); walkTo(f.x, f.y, () => openGian(S.cur, i)); }
});
$('btn-flee').addEventListener('click', flee);
$('btn-sound').addEventListener('click', () => {
  Snd.on = !Snd.on; Snd.init();
  $('btn-sound').classList.toggle('off', !Snd.on);
  $('btn-sound').setAttribute('aria-label', Snd.on ? 'Tắt tiếng' : 'Bật tiếng');
  try { localStorage.setItem('vuaviahe_sound', Snd.on ? '1' : '0'); } catch { /* bỏ qua */ }
});
$('btn-rotate-skip').addEventListener('click', () => { document.body.classList.add('skip-rotate'); fit(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && R.started) save(); });

const stage = $('stage');
function fit() {
  const app = $('app');
  const aspect = app.clientWidth / Math.max(1, app.clientHeight);
  const nw = clamp(Math.round((H * aspect) / 2) * 2, SW, 2400);   // màn rộng thì mở rộng khung, không chừa dải đen
  if (nw !== W) {
    W = nw;
    canvas.width = W;
    stage.style.width = W + 'px';
    R.bgCache = {};
    R.stars = Array.from({ length: Math.round(W / 20) }, () => ({ x: rand(0, W), y: rand(0, 300), r: rand(0.6, 1.6) }));
    if (R.me) R.cam = camTarget();
  }
  const s = Math.min(app.clientWidth / W, app.clientHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fit);

// ---------- Khởi động ----------
function beginGame(fresh) {
  Snd.init();
  if (fresh) { S = freshState(); rollPrices(); R.unread = 0; news('Bạn vừa thuê được gian số 1 trong khu phố. Chúc buôn may bán đắt!', 'good'); }
  R.attract = false; R.started = true;
  R.parts = [];
  enterView('street');
  $('title-screen').hidden = true;
  stage.classList.remove('on-title');
  renderDock(); updateHUD();
  if (fresh) toast('Bấm xuống vỉa hè để đi lại (hoặc phím mũi tên / WASD). Gian số 1 đã bày sẵn kem chuối, thấy <b>đồng xu</b> hiện lên thì bấm để đi tới thu tiền.', 'gold');
  else if (R.offline) { toast(R.offline, 'gold'); R.offline = null; }
  save();
}
$('btn-new').addEventListener('click', () => {
  if (loadSave() && !R.newConfirm) { R.newConfirm = true; $('btn-new').textContent = 'Bấm lần nữa để xóa bản cũ'; return; }
  beginGame(true);
});
$('btn-continue').addEventListener('click', () => {
  const d = loadSave();
  if (!d) return;
  applySave(d);
  applyOffline((now() - (d.lastTick || now())) / 1000);
  beginGame(false);
});

let softT = 0;
function start(data) {
  try { if (localStorage.getItem('vuaviahe_sound') === '0') { Snd.on = false; $('btn-sound').classList.add('off'); } } catch { /* bỏ qua */ }
  fit();
  rollPrices();
  if (data?.save && data.started) {
    try { applySave(JSON.parse(data.save)); beginGame(false); } catch { /* bỏ qua */ }
  }
  if (!R.started) {
    stage.classList.add('on-title');
    const d = loadSave();
    if (d) { $('btn-continue').hidden = false; $('btn-continue').textContent = `Chơi tiếp · Cấp ${d.level}`; }
  }
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    update(dt);
    render();
    R.hudT += dt;
    if (R.hudT > 0.2 && R.started) {
      R.hudT = 0; updateHUD();
      // số liệu gian hàng, nút mời cà phê tự cập nhật (trừ khi đang thao tác trong bảng)
      if ((R.modal === 'gian' || R.modal === 'cafe') && ++softT % 5 === 0 && !$('modal-body').matches(':hover')) refreshModal();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
document.fonts?.ready?.then(() => { R.bgCache = {}; });
window.claude?.hot?.snapshot?.(() => ({ save: JSON.stringify(S), started: R.started }));
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
