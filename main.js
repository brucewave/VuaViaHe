// ================================================================
//  Vua Vỉa Hè — mô phỏng buôn bán hàng rong trong khu phố
//  Lối chơi theo game Hàng Rong trên Zing Me: gian hàng trong khu phố,
//  chợ đầu mối, hàng xóm, công an phường, dân anh chị, quán cà phê.
// ================================================================
import { HERO_FRAMES } from './hero-sprite.js';
let W = 1280;            // bề rộng khung hình, co giãn theo màn hình
const H = 720, SW = 1280; // SW: bề rộng các cảnh cố định (nhà, chợ, cà phê, hồ câu)
const GROUND = 420;          // chân tường dãy nhà
const CURB = 636;            // mép vỉa hè
const WALK_Y0 = 452, WALK_Y1 = 626;   // cả vỉa hè, từ chân tường nhà tới mép đường
const FRONT_Y = 540;                  // chỗ đứng ngay trước quầy sạp
// đứng xa (sát nhà) thì nhỏ hơn, đứng gần mép đường thì to hơn
const depthScale = (y) => { const b = walkBand(); return 0.88 + 0.22 * clamp((y - b.y0) / (b.y1 - b.y0), 0, 1); };
const STALL_X = 640, STALL_Y = 560;   // khung tọa độ gốc để vẽ một sạp
const STALL_BASE = 510, STALL_SCALE = 0.92;
const GIAN_W = 400, STREET_PAD = 120;
const STREET_W = STREET_PAD * 2 + GIAN_W * 6 + 200;   // khu phố dài hơn 2 màn hình, chừa chỗ cho hàng lô thứ 2
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
// Giờ trong game: 1 giây ngoài đời = 1 phút trong game, một ngày trong game dài 24 phút.
// S.clockOff dời đồng hồ để ván mới bắt đầu lúc 6 giờ sáng.
const GMIN = 1000, GHOUR = 60 * GMIN, GDAY = 24 * GHOUR;
const gameNow = (t = now()) => t + (S.clockOff || 0);
const gameHour = (t) => ((((gameNow(t) % GDAY) + GDAY) % GDAY) / GHOUR);
const gameDay = (t) => Math.floor(gameNow(t) / GDAY) - (S.day0 || 0) + 1;
const gclock = (t) => { const m = Math.floor(gameHour(t) * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
// giờ h có nằm trong một trong các khung [từ, tới) không; khung qua nửa đêm thì từ > tới
const inHours = (h, wins) => wins.some(([a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b));
const hoursText = (wins) => wins.map(([a, b]) => `${a}h–${b % 24}h`).join(', ');
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

// Nhân vật chọn lúc chơi mới: dáng chibi khác nhau, mỗi người giỏi một món.
// hair: kiểu tóc (bun = búi, pony = cột đuôi ngựa, short = tóc ngắn); hat, shirt, pants: đồ mặc sẵn khi chưa sắm đồ.
const CHARS = {
  co_ba:   { name: 'Cô Ba Nón Lá',     skin: '#F6D7BE', hair: '#3A2A22', style: 'bun',   hat: 1, shirt: '#7E5538', pants: '#2F2420', bonus: { beauty: 2 },
    desc: 'Duyên dáng, rao hàng ngọt như mía lùi.', perk: 'Sắc đẹp +2: khách ghé đông hơn' },
  anh_tu:  { name: 'Anh Tư Ba Gác',    skin: '#D9A27A', hair: '#1E1A1A', style: 'short', hat: 3, shirt: '#3E7CB1', pants: '#2F3E46', cap: '#C0392B', tank: true, bonus: { health: 2 },
    desc: 'Vai u thịt bắp, giang hồ nhìn là chùn.', perk: 'Sức khỏe +2: thêm sức, đánh lại giang hồ dễ hơn' },
  chi_nam: { name: 'Chị Năm Sổ Sách',  skin: '#F1C9A5', hair: '#2B211C', style: 'pony',  hat: 0, shirt: '#E9EEF5', pants: '#3A3A40', collar: true, glasses: true, bonus: { intel: 2 },
    desc: 'Tính nhẩm lẹ hơn máy, trả giá có nghề.', perk: 'Trí tuệ +2: giá sỉ rẻ hơn, trả giá dễ hơn' },
  be_ut:   { name: 'Bé Út Lanh Chanh', skin: '#F6D7BE', hair: '#4A2E1E', style: 'short', hat: 4, shirt: '#E84A5F', pants: '#3E7CB1', short: true, bonus: { beauty: 1, health: 1 },
    desc: 'Nhỏ mà có võ, chạy rượt móc túi không ai bằng.', perk: 'Sắc đẹp +1, sức khỏe +1' },
};
const charOf = () => CHARS[S.player.char] || CHARS.co_ba;

// ---------- Câu cá ----------
const FISH = {
  giay: { name: 'Giày rách',        icon: '🥾', kg: [0.3, 0.6],  perKg: 5000,    w: 10,  rod: 0, junk: true },
  ro:   { name: 'Cá rô đồng',       icon: '🐟', kg: [0.1, 0.4],  perKg: 80000,   w: 34,  rod: 0 },
  tom:  { name: 'Tôm càng',         icon: '🦐', kg: [0.05, 0.2], perKg: 300000,  w: 12,  rod: 0, bait: { tep: 2 } },
  cua:  { name: 'Cua đồng',         icon: '🦀', kg: [0.1, 0.3],  perKg: 160000,  w: 12,  rod: 0, bait: { giun: 1.6 } },
  tre:  { name: 'Cá trê',           icon: '🐟', kg: [0.3, 1.2],  perKg: 110000,  w: 16,  rod: 1, bait: { cam: 2 } },
  chep: { name: 'Cá chép',          icon: '🐠', kg: [0.5, 3],    perKg: 140000,  w: 12,  rod: 1, bait: { cam: 2.5 } },
  loc:  { name: 'Cá lóc',           icon: '🐟', kg: [0.6, 2.5],  perKg: 200000,  w: 9,   rod: 2, bait: { tep: 2.5 } },
  koi:  { name: 'Cá koi',           icon: '🎏', kg: [1, 4],      perKg: 400000,  w: 3,   rod: 2, bait: { dacbiet: 3 }, rare: true },
  rua:  { name: 'Rùa vàng',         icon: '🐢', kg: [1, 3],      perKg: 600000,  w: 1.5, rod: 3, bait: { tep: 2, dacbiet: 3 }, rare: true },
  rong: { name: 'Cá chép hóa rồng', icon: '🐉', kg: [5, 9],      perKg: 1000000, w: 0.4, rod: 3, bait: { dacbiet: 4 }, rare: true },
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
const SELLER_NAMES = { f: ['Cô Hạnh', 'Cô Lan', 'Cô Thắm', 'Cô Bảy', 'Cô Mận', 'Cô Tư'], m: ['Anh Tài', 'Anh Lộc', 'Anh Phúc', 'Anh Hai', 'Anh Tèo', 'Anh Dũng'] };

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
// một lô trên vỉa hè; khi có sạp bày lên thì placed = true và mang theo dữ liệu của sạp
function newGian(open) { return { open, placed: false, stall: 'ganh', slots: emptySlots(), cash: 0, trash: 0, rat: false, broken: false, du: false, ghe: false, bang: false, phep: false, pausedUntil: 0, seller: null, sellerAway: false }; }
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
  const clockOff = 6 * GHOUR - (t % GDAY);   // ván mới bắt đầu lúc 6 giờ sáng
  const s = {
    v: 2, money: 120000, xp: 0, level: 1, energy: 20, energyAt: t, karma: 0,
    clockOff, day0: Math.floor((t + clockOff) / GDAY),
    rep: 50, reviews: [], tickets: [], ach: {}, flags: {}, barg: { at: 0, st: {} }, paperSeen: 0,
    kho: {}, khoLvl: 0, quest: 'meet',
    streets: Array.from({ length: 10 }, (_, si) => ({ gians: Array.from({ length: 6 }, (_, i) => newGian(si === 0 && i === 0)) })), cur: 0,
    bike: [newUnit('ganh')],
    debt: 0, debtAt: t, prices: {}, prevPrices: {}, pricesAt: 0,
    player: { name: 'Bạn', char: 'co_ba' },
    outfit: { hat: 'non_la', shirt: null, pants: null, shoes: null, acc: null }, owned: ['non_la'],
    fishing: { rod: 'tre', rods: ['tre'], bait: { giun: 10 }, use: 'giun', basket: [], book: {} },
    neighbors: NB_BASE.map(newNeighbor), news: [], lastTick: t, tips: {},
    stats: { sold: 0, earned: 0, stolen: 0, cleaned: 0, fines: 0 },
  };
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
  credit: false, unread: 0, runners: [], cries: {}, marks: [], guests: [], actor: null, boost: null, rain: null, 
  fish: { state: 'idle', t: 0, fx: 780, fy: 560, nib: 0, catch: null },
  chat: [],
  ripples: [],
};

const stat = (k) => Object.values(S.outfit).reduce((a, id) => a + (id ? FASHION[id][k] || 0 : 0), 0) + (charOf().bonus[k] || 0);
const energyMax = () => 20 + stat('health') * 2;
const khoCap = () => KHO[S.khoLvl].cap;
const khoCount = () => Object.values(S.kho).reduce((a, b) => a + b, 0);
const khoSpace = () => Math.max(0, khoCap() - khoCount());
const creditLimit = () => Math.round(50000 * S.level * (1 + stat('intel') * 0.05));
const allGians = () => S.streets.flatMap((st, si) => st.gians.map((g, i) => ({ g, si, i })));
const nbBase = (id) => NB_BASE.find((b) => b.id === id);
const nbState = (id) => S.neighbors.find((n) => n.id === id);
// đánh giá của khách (0–100, khởi đầu 50): cao thì khách ghé nhiều hơn
const repMult = () => 0.85 + clamp(S.rep ?? 50, 0, 100) * 0.003;
const repStars = () => (1 + clamp(S.rep ?? 50, 0, 100) / 25).toFixed(1).replace('.', ',');

function gianMult(G, si) {
  if (!G.placed || G.sellerAway || G.broken || G.pausedUntil > now()) return 0;
  let m = STALLS[G.stall].speed * (1 + (G.du ? 0.1 : 0) + (G.ghe ? 0.1 : 0));
  m *= 1 - 0.15 * Math.min(3, G.trash);
  if (G.rat) m *= 0.5;
  m *= 1 + stat('beauty') * 0.02;
  if (S.karma >= 20) m *= 1.05;
  m *= 1 + si * 0.08 + (isVip(si) ? 0.4 : 0);
  m *= kpTimeMult(si) * repMult();
  return m;
}
// tốc độ bán riêng của một ô: hàng hợp gu khu phố "đông khách" thì bán nhanh gấp đôi
const slotSpeed = (si, good) => (themeHit(si, good) && kpTheme(si).bonus === 'speed' ? 2 : 1);
// tổng số món bán được mỗi giây của cả gian (các ô bán song song)
function gianRate(G, si) {
  const m = gianMult(G, si);
  if (!m) return 0;
  return G.slots.reduce((a, s, k) => a + (k < slotsOpen(G) && s.qty > 0 ? (m * slotSpeed(si, s.good)) / GOODS[s.good].t : 0), 0);
}
// giá bán lẻ một món: bảng hiệu +10%, hàng hợp gu khu phố "giá cao" ×2, món hot trên báo hôm nay +30%
function unitPrice(G, good, si = S.cur) {
  let p = GOODS[good].sell * (G.bang ? 1.1 : 1);
  if (themeHit(si, good) && kpTheme(si).bonus === 'price') p *= 2;
  if (good === hotGood()) p *= 1.3;
  return Math.round(p);
}

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
  if (d.quest === undefined) S.quest = 'done';   // bản lưu cũ đã qua phần mở đầu
  S.streets.forEach((st) => {
    st.gians = st.gians.map((g) => {
      const n = { ...newGian(false), ...g };
      if (!Array.isArray(g.slots)) { n.slots = emptySlots(); if (g.good && g.qty) n.slots[0] = { good: g.good, qty: g.qty, prog: g.prog || 0 }; }
      delete n.good; delete n.qty; delete n.prog;
      if (g.placed === undefined) { n.placed = !!g.open; if (n.placed && !n.seller) n.seller = randomSeller(); }
      return n;
    });
  });
  // đổi bản lưu cũ (2 khu phố × 12 lô hoặc 6 gian) sang 10 khu phố × 6 lô, giữ số lô đã thuê và các sạp đang bày
  if (S.streets.length !== 10 || S.streets.some((st) => st.gians.length !== 6)) {
    const old = S.streets.flatMap((st) => st.gians);
    const rented = old.filter((g) => g.open).length;
    const placedOld = old.filter((g) => g.placed);
    const flat = Array.from({ length: 60 }, (_, n) => (n < placedOld.length ? { ...placedOld[n], open: true } : newGian(n < Math.max(1, rented))));
    S.streets = Array.from({ length: 10 }, (_, si) => ({ gians: flat.slice(si * 6, si * 6 + 6) }));
    if (S.cur >= 10) S.cur = 0;
  }
  if (!Array.isArray(S.bike)) S.bike = [];
  if (S.quest === 'stock') S.quest = 'place';
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
  if (R.started) renderTop();
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
    const m = gianMult(G, si) * eventMult(si, i);
    if (!m) return;
    const had = gQty(G) > 0;
    const show = visual && R.view === 'street' && S.cur === si;
    G.slots.forEach((s, k) => {
      if (k >= slotsOpen(G) || s.qty <= 0) { s.prog = 0; return; }
      s.prog += ((m * slotSpeed(si, s.good)) / GOODS[s.good].t) * dt;
      while (s.prog >= 1 && s.qty > 0) {
        s.prog -= 1; s.qty--;
        const p = unitPrice(G, s.good, si);
        G.cash += p; S.stats.sold++;
        if (show) onSaleVisual(i, p, s.good);
      }
      if (s.qty <= 0) s.prog = 0;
    });
    if (had && gQty(G) <= 0 && show) R.parts.push({ type: 'text', x: lotX(i), y: lotBase(i) - 160, vy: -20, text: 'Hết hàng!', color: '#F9C9C0', life: 1.8, max: 1.8 });
  }));
}
function onSaleVisual(i, p, good) {
  R.parts.push({ type: 'text', x: lotX(i) + rand(-20, 20), y: lotBase(i) - 100, vy: -40, text: '+' + fmtK(p), color: '#FFE08A', life: 1.1, max: 1.1, small: true });
  const cx = lotX(i);
  if (R.buyers.length < 8 && cx > R.cam - 100 && cx < R.cam + W + 100) {
    const fromLeft = Math.random() < 0.5;
    R.buyers.push({ x: fromLeft ? R.cam - 40 : R.cam + W + 40, y: Math.min(lotBase(i) + rand(12, 24), walkBand().y1), dir: fromLeft ? 1 : -1, look: makeLook(), tx: cx + (fromLeft ? -70 : 70),
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
  const mine = allGians().filter((x) => x.g.placed);
  if (!mine.length) return;
  const harass = b.sly ? (n.friend < 60 ? 0.7 : 0.35) : n.friend < 20 ? 0.45 : 0.08;
  const target = pick(mine);
  const label = `${lotName(target.i)} khu phố ${target.si + 1}`;
  if (Math.random() < harass) {
    if (Math.random() < 0.7) { target.g.trash = Math.min(3, target.g.trash + 1); news(`<b>${b.name}</b> vừa vứt rác trước ${label} của bạn.`, 'bad'); }
    else { target.g.rat = true; news(`<b>${b.name}</b> thả chuột vô ${label}! Hàng bán chậm hẳn.`, 'bad'); }
    if (!silent && R.view === 'street' && S.cur === target.si) Snd.bad();
  } else if (n.friend >= 50 && Math.random() < 0.6) {
    const dirty = mine.find((x) => x.g.trash > 0 || x.g.rat);
    if (dirty) { if (dirty.g.rat) dirty.g.rat = false; else dirty.g.trash--; news(`<b>${b.name}</b> ghé dọn giúp ${lotName(dirty.i)}. Hàng xóm tốt ghê!`, 'good'); }
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
  while (left > 0) { const d = Math.min(60, left); tickGians(d, false); tickShops(d, false); tickNeighbors(d); left -= d; }
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
    for (let k = 0; k < 6; k++) R.parts.push({ type: 'coin', x: lotX(i), y: lotBase(i) - 186, vx: rand(-110, 110), vy: rand(-380, -200), life: 0.8, max: 0.8 });
    R.parts.push({ type: 'text', x: lotX(i), y: lotBase(i) - 214, vy: -40, text: '+' + fmt(amt), color: '#FFE08A', life: 1.4, max: 1.4 });
    Snd.coin();
  }
  questProgress('collect');
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
  questProgress('stock');
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
  S.streets.forEach((st, si) => st.gians.forEach((G) => {
    if (!G.placed || G.broken) return;
    for (let k = 0; k < slotsOpen(G); k++) {
      const s = G.slots[k], cap = slotCap(G);
      if (s.qty > 0) {
        if (S.kho[s.good] && s.qty < cap) { const n = Math.min(cap - s.qty, S.kho[s.good]); s.qty += n; S.kho[s.good] -= n; if (!S.kho[s.good]) delete S.kho[s.good]; did++; }
        continue;
      }
      const inGian = gGoods(G);
      const cands = Object.keys(S.kho).filter((id) => S.kho[id] > 0);
      if (!cands.length) continue;
      cands.sort((a, b) => (inGian.includes(a) - inGian.includes(b)) || themeHit(si, b) - themeHit(si, a) || profit(b) - profit(a));
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
  R.parts.push({ type: 'text', x: lotX(i), y: lotBase(i) + 20, vy: -30, text: 'Sạch!', color: '#DDF2C9', life: 1, max: 1, small: true });
}
function chaseRat(si, i) {
  const G = S.streets[si].gians[i];
  if (!G.rat || !useEnergy(1)) return;
  G.rat = false; addXp(3);
  Snd.sweep();
  R.parts.push({ type: 'text', x: lotX(i) + 60, y: lotBase(i) + 20, vy: -30, text: 'Cút!', color: '#DDF2C9', life: 1, max: 1, small: true });
}
function gianCost(si, i) { return lotCost(si, i); }
function rentGian(si, i) {
  const nl = nextLot();
  if (!nl || nl.si !== si || nl.li !== i) { toast('Thuê lần lượt từng lô nha, lô này chưa tới lượt.', 'bad'); return; }
  const [cost, lvl] = gianCost(si, i);
  if (S.level < lvl) { toast(`Cần cấp ${lvl} mới thuê được lô này.`, 'bad'); return; }
  if (S.money < cost) { toast(`Cần ${fmt(cost)} để thuê gian.`, 'bad'); return; }
  S.money -= cost; S.streets[si].gians[i].open = true;
  Snd.level();
  toast(isShopLot(si, i) ? 'Thuê được mặt bằng! Chọn ngành nghề để khai trương.' : `Thuê được ${lotName(i)}! Bấm vào lô để chọn sạp đem ra bày.`, 'gold');
  news(`Bạn vừa thuê ${lotName(i)} ở khu phố ${si + 1}.`, 'good');
  closeModal();
  if (S.streets[si].gians.every((g) => g.open) && si + 1 < KP_COUNT) { toast(`Thuê đủ 6 lô ${kpLabel(si)}! <b>${kpLabel(si + 1)}</b> đã mở${isVip(si + 1) ? ', là phố mặt tiền: thuê được tiệm phía sau để làm ăn' : ''}.`, 'gold'); news(`${kpLabel(si + 1)} mở cửa cho bạn thuê lô.`, 'good'); }
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
// Giỏ hàng ở chợ: bấm +/− chỉ bỏ vào giỏ, bấm Thanh toán mới trả tiền và chở về kho.
const cartQty = (id) => R.cart?.[id] || 0;
const cartCount = () => Object.values(R.cart || {}).reduce((a, n) => a + n, 0);
const cartCost = () => Object.entries(R.cart || {}).reduce((a, [id, n]) => a + n * wholesale(id), 0);
// mua chịu thì chủ mối ghi sổ thêm CREDIT_FEE tiền lời trên phần chưa trả
const buyBudget = () => S.money + (R.credit ? Math.max(0, creditLimit() - S.debt) / (1 + CREDIT_FEE) : 0);
function addCart(id, n) {
  R.cart ||= {};
  const have = cartQty(id);
  const ms = stallOfGood(id);
  if (ms && bargBanned(ms.id)) { toast(`${ms.owner} đang giận, không bán cho bạn. Chờ chợ đổi giá sỉ đã.`, 'bad'); Snd.bad(); return; }
  if (Number(n) < 0) { R.cart[id] = Math.max(0, have + Number(n)); if (!R.cart[id]) delete R.cart[id]; Snd.click(); refreshModal(); return; }
  const price = wholesale(id);
  const space = khoCap() - khoCount() - cartCount();
  const afford = Math.floor((buyBudget() - cartCost()) / price);
  const k = Math.min(n === 'max' ? Infinity : Number(n), space, afford);
  if (k <= 0) {
    if (space <= 0) toast(khoCount() >= khoCap() ? 'Kho đầy rồi! Nâng cấp kho hoặc bày bớt ra gian.' : 'Giỏ đã đủ chỗ trống trong kho rồi.', 'bad');
    else toast(R.credit ? 'Hết hạn mức mua chịu rồi!' : 'Không đủ tiền. Bật <b>Mua chịu</b> để ghi sổ nợ (có tính lời).', 'bad');
    Snd.bad(); return;
  }
  R.cart[id] = have + k;
  Snd.click(); refreshModal();
}
function checkout() {
  const items = Object.entries(R.cart || {}).filter(([, n]) => n > 0);
  if (!items.length) return;
  if (cartCount() > khoCap() - khoCount()) { toast('Kho không đủ chỗ cho cả giỏ. Bớt hàng trong giỏ hoặc nâng kho.', 'bad'); Snd.bad(); return; }
  let cost = cartCost();
  if (cost > buyBudget()) { toast(R.credit ? 'Vượt hạn mức mua chịu rồi! Bớt hàng trong giỏ.' : 'Không đủ tiền. Bớt hàng hoặc bật <b>Mua chịu</b>.', 'bad'); Snd.bad(); return; }
  const fromCash = Math.min(S.money, cost);
  S.money -= fromCash; cost -= fromCash;
  if (cost > 0) {
    if (!S.debt) S.debtAt = now();
    const owe = Math.round(cost * (1 + CREDIT_FEE));
    S.debt += owe;
    toast(`Ghi sổ nợ <b>${fmt(owe)}</b>, trong đó ${fmt(owe - cost)} là tiền lời mua chịu. Nợ còn tính lãi 5% mỗi 5 phút.`);
  }
  const n = cartCount();
  for (const [id, k] of items) S.kho[id] = (S.kho[id] || 0) + k;
  R.cart = {};
  toast(`Đã nhập <b>${n} món</b> về kho.`, 'good');
  questProgress('buy');
  Snd.buy();
  refreshModal();
}
// ---------- Trả giá với mối hàng ----------
// Cấp càng cao càng dám trả giá mạnh. Trả hụt 3 lần thì mối giận, không bán tới lúc chợ đổi giá sỉ.
const CREDIT_FEE = 0.1;
const BARG_OPTS = [{ pct: 0.05, lvl: 1 }, { pct: 0.1, lvl: 4 }, { pct: 0.2, lvl: 8 }, { pct: 0.3, lvl: 14 }];
const stallOfGood = (id) => MARKET_STALLS.find((m) => m.goods.includes(id));
function bargOf(stallId) {
  if (!S.barg || S.barg.at !== S.pricesAt) S.barg = { at: S.pricesAt, st: {} };
  return (S.barg.st[stallId] ||= { fails: 0, disc: 0 });
}
const bargBanned = (stallId) => bargOf(stallId).fails >= 3;
const bargChance = (pct) => clamp(0.8 + S.level * 0.02 + stat('intel') * 0.02 - pct * 3.2, 0.05, 0.92);
// giá sỉ thực trả: đã trừ phần trả giá được và giảm giá chợ sớm
function wholesale(id) {
  const m = stallOfGood(id);
  const disc = m ? bargOf(m.id).disc : 0;
  return Math.max(100, Math.round((S.prices[id] * (1 - disc) * (areaPeak('market') ? 0.9 : 1)) / 100) * 100);
}
function bargain(stallId, pct) {
  const m = MARKET_STALLS.find((q) => q.id === stallId), B = bargOf(stallId);
  const opt = BARG_OPTS.find((o) => o.pct === pct);
  if (!m || !opt || S.level < opt.lvl || bargBanned(stallId) || pct <= B.disc) return;
  const pc = Math.round(pct * 100);
  if (Math.random() < bargChance(pct)) {
    B.disc = pct; S.flags.bargain = (S.flags.bargain || 0) + 1; addXp(3 + pc / 5);
    Snd.coin();
    toast(`${m.owner}: "${pick(['Thôi được, mối quen bớt cho', 'Nói ngọt quá, bớt luôn', 'Lần này thôi nghen, bớt'])} ${pc}%!" Hàng sạp này rẻ hơn tới lúc chợ đổi giá.`, 'good');
  } else {
    B.fails++;
    Snd.bad();
    if (B.fails >= 3) {
      toast(`${m.owner} giận rồi: "Trả giá gì kỳ cục, hổng bán nữa!" Phải chờ chợ đổi giá sỉ mới mua được ở sạp này.`, 'bad');
      news(`Bạn trả giá quá đà, <b>${m.owner}</b> (${m.name.toLowerCase()}) không bán cho bạn tới đợt giá sau.`, 'bad');
    } else toast(`${m.owner}: "${pick(['Giá vốn rồi con ơi!', 'Bớt vậy tui lỗ sao?', 'Trả vậy ai bán!', 'Đi chợ khác đi!'])}" Trả giá hụt ${B.fails}/3.`, 'bad');
  }
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
  R.parts.push({ type: 'text', x: lotX(i), y: lotBase(i) + 20, vy: -30, text: '+3 thân thiết', color: '#DDF2C9', life: 1.2, max: 1.2, small: true });
}
function nbSteal(n, i) {
  const g = n.gians[i], b = nbBase(n.id);
  if (!g.open || g.cash < 1000 || !useEnergy(3)) return;
  if (Math.random() < 0.65 - n.friend / 400) {
    const amt = Math.round(g.cash * rand(0.3, 0.5));
    g.cash -= amt; S.money += amt; S.stats.stolen += amt;
    changeKarma(-4); n.friend = clamp(n.friend - 5, 0, 100); addXp(3);
    Snd.coin();
    R.parts.push({ type: 'text', x: lotX(i), y: lotBase(i) - 214, vy: -40, text: '+' + fmt(amt), color: '#FFE08A', life: 1.4, max: 1.4 });
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
// lẻn chôm hàng trên sạp hàng xóm đem về kho
function nbStealGoods(n, i) {
  const g = n.gians[i], b = nbBase(n.id);
  if (!g.open) return;
  if (khoSpace() <= 0) { toast('Kho đầy rồi, chôm về cũng không có chỗ cất.', 'bad'); return; }
  if (!useEnergy(3)) return;
  if (Math.random() < 0.6 - n.friend / 400) {
    const k = khoAdd(g.good, Math.round(rand(3, 8)));
    S.flags.stealGoods = (S.flags.stealGoods || 0) + k;
    changeKarma(-4); n.friend = clamp(n.friend - 5, 0, 100); addXp(3);
    Snd.coin();
    R.parts.push({ type: 'text', x: lotX(i), y: lotBase(i) - 214, vy: -40, text: `+${k} ${GOODS[g.good].icon}`, color: '#FFE08A', life: 1.4, max: 1.4 });
    toast(`Chôm được ${k} ${GOODS[g.good].name.toLowerCase()} trên sạp ${b.name}, bỏ vô kho. Gian thiệt!`);
  } else {
    const fine = Math.min(S.money, 25000 + 5000 * S.level);
    S.money -= fine; S.stats.fines += fine;
    changeKarma(-6); n.friend = clamp(n.friend - 15, 0, 100);
    Snd.bad();
    toast(`${b.name} túm được tay bạn đang bốc hàng! Đền ${fmt(fine)}, quê một cục.`, 'bad');
    news(`Bạn chôm hàng trên sạp <b>${b.name}</b> bị bắt tại trận, đền ${fmt(fine)}.`, 'bad');
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
function eligiblePolice() { return allGians().filter(({ g, si }) => si === S.cur && g.placed && !g.sellerAway && !g.phep && gQty(g) > 0 && !g.broken && g.pausedUntil <= now()); }
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
    if (R.view !== 'street' || R.modal || R.fight) return;
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
  const demand = 10000 + 4000 * S.level + 30000 * allGians().filter(({ g }) => g.biz).length;   // có tiệm thì đòi nhiều hơn
  const buddy = S.neighbors.filter((n) => n.friend >= 70).sort((a, b) => b.friend - a.friend)[0];
  R.thug = { name, demand, buddy: buddy?.id };
  openModal('Dân anh chị ghé thăm', `
    <p class="event-text"><b>${name}</b> dẫn hai đàn em tới, gõ bàn: "Khu này anh bảo kê. Mỗi tuần <b>${fmt(demand)}</b>, đóng thì yên ổn làm ăn, không đóng thì đừng trách."</p>
    <p class="event-text">Sức khỏe của bạn: <b>${stat('health')}</b>. Không đóng thì phải <b>đánh lại</b>: bấm đủ <b>${fightNeed()} cú</b> trong 5 giây. Sức khỏe càng cao càng ít cú.</p>
    <div class="choice">
      <button class="btn" data-thug="pay">Đóng tiền<small>Mất ${fmt(Math.min(S.money, demand))}</small></button>
      <button class="btn red" data-thug="fight">Đánh lại!<small>Thua là bị đập sạp</small></button>
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
  } else startFight(T);
}
// ---------- Đánh lại dân anh chị: bấm liên tục cho đủ cú đấm trước khi hết giờ ----------
const FIGHT_TIME = 5;
const fightNeed = () => clamp(Math.round(9 + S.level * 0.5 - stat('health') * 1.2), 5, 24);
function startFight(T) {
  R.fight = { ...T, t: FIGHT_TIME, hits: 0, need: fightNeed() };
  $('fight-alert').hidden = false;
  $('fight-sub').innerHTML = `<b>${T.name}</b> xắn tay áo xông tới! Bấm đủ <b>${R.fight.need} cú</b> trong ${FIGHT_TIME} giây để đuổi hắn đi.`;
  updateFightUI();
  Snd.siren();
  $('btn-fight').focus({ preventScroll: true });
}
function updateFightUI() {
  const F = R.fight;
  if (!F) return;
  $('fight-power').style.width = clamp(F.hits / F.need, 0, 1) * 100 + '%';
  $('fight-count').textContent = `${F.hits}/${F.need} cú`;
  $('fight-timer').style.width = clamp(F.t / FIGHT_TIME, 0, 1) * 100 + '%';
}
function fightHit() {
  const F = R.fight;
  if (!F) return;
  F.hits++;
  heroAct('attack', pick([[1, 2], [3, 4], [5, 6], [7, 8]]), 14);
  Snd.tone(180 + F.hits * 25, 0.07, 'square', 0.05);
  if (R.view !== 'fish') R.parts.push({ type: 'text', x: R.me.x + rand(-50, 50), y: R.me.y - 190 + rand(-20, 20), vy: -70, text: pick(['BỐP!', 'HỰ!', 'BINH!', 'CHÁT!', 'HÁ!']), color: '#FFE08A', life: 0.6, max: 0.6, small: true });
  if (F.hits >= F.need) endFight(true); else updateFightUI();
}
function updateFight(dt) {
  const F = R.fight;
  if (!F) return;
  F.t -= dt;
  if (F.t <= 0) endFight(false); else updateFightUI();
}
function endFight(win) {
  const T = R.fight;
  R.fight = null;
  $('fight-alert').hidden = true;
  if (win) {
    changeKarma(3); addXp(15); S.flags.fightWin = (S.flags.fightWin || 0) + 1;
    Snd.level();
    toast(`Một mình chấp hết! ${T.name} ôm mặt bỏ chạy. Uy tín tăng.`, 'gold');
    news(`Bạn không đóng tiền bảo kê, đánh đuổi được <b>${T.name}</b>.`, 'good');
    return;
  }
  heroAct('hurt', [0, 1, 2, 3, 3, 4], 6, 1.6);
  const tgt = pick(allGians().filter(({ g }) => (g.placed || g.biz) && !g.broken));
  if (tgt) { tgt.g.broken = true; tgt.g.cash = 0; }
  Snd.bad();
  toast(`Đuối sức rồi! ${T.name} cho đàn em đập phá sạp ở ${tgt ? lotName(tgt.i) : 'khu phố'}. Phải sửa mới bán được.`, 'bad');
  news(`<b>${T.name}</b> đập phá sạp ở ${tgt ? lotName(tgt.i) : 'khu phố'} vì bạn không đóng bảo kê.`, 'bad');
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
  F.state = 'cast'; F.t = 0.7; F.fx = rand(720, 1060); F.fy = rand(374, 470);
  Snd.click();
  renderDock();
}
function pickFish(bait, tier) {
  const pairs = Object.entries(FISH).filter(([, f]) => f.rod <= tier)
    .map(([id, f]) => [id, f.w * (f.bait?.[bait] || 1) * (f.junk ? Math.max(0.3, 1 - tier * 0.25) : 1) * (f.rare && areaPeak('fish') ? 1.6 : 1)]);
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
  else S.money += value;   // giày rách bán ve chai
  R.parts.push({ type: 'text', x: POND_ME.x + 60, y: POND_ME.y - 200, vy: -30, text: '+' + fmt(value), color: '#FFE08A', life: 1.8, max: 1.8 });
  if (f.rare) S.flags.rareFish = (S.flags.rareFish || 0) + 1;
  F.state = 'reel'; F.t = 1.1; F.catch = { id, kg, value };
  addXp(f.junk ? 1 : 3 + Math.round(value / 20000));
  if (f.junk) { toast(`Kéo lên được… một chiếc giày rách. Bán ve chai được ${fmt(value)}.`); Snd.bad(); }
  else {
    Snd.coin();
    toast(`Dính <b>${f.name}</b> ${String(kg).replace('.', ',')} kg (~${fmt(value)})!${fresh ? ' Loài mới trong sổ câu!' : newBest ? ' Kỷ lục mới!' : ''}`, f.w < 3 ? 'gold' : 'good');
    if (f.w < 3) news(`Bạn câu được <b>${f.name}</b> nặng ${String(kg).replace('.', ',')} kg ở hồ câu!`, 'good');
  }
}
function updateFish(dt) {
  const F = R.fish;
  if (F.nib > 0) F.nib -= dt;
  if (F.state === 'cast') { F.t -= dt; if (F.t <= 0) { F.state = 'wait'; F.t = rand(3, 9) * rod().wait * (areaPeak('fish') ? 0.6 : 1); R.ripples.push({ x: F.fx, y: F.fy, r: 4, life: 1 }); } }
  else if (F.state === 'wait') {
    F.t -= dt;
    if (Math.random() < dt * 0.7) { F.nib = 0.22; R.ripples.push({ x: F.fx, y: F.fy, r: 3, life: 0.6 }); }
    if (F.t <= 0) { F.state = 'bite'; F.t = 0.9 * rod().window; Snd.tone(1200, 0.08, 'square', 0.05); R.ripples.push({ x: F.fx, y: F.fy, r: 6, life: 1 }); renderDock(); }
  } else if (F.state === 'bite') {
    F.t -= dt;
    if (F.t <= 0) { F.state = 'done'; toast('Chậm tay rồi, cá ăn mất mồi!', 'bad'); Snd.bad(); renderDock(); }
  } else if (F.state === 'reel') {
    F.t -= dt;
    if (F.t <= 0) { F.state = 'done'; if (!FISH[F.catch.id].junk) heroAct('fish', [3], 1, 1.2); renderDock(); }
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
      return r ? `<div class="pick"><span class="pi">${f.icon}</span><span><b>${f.name}</b><small>${r.count} lần · to nhất ${String(r.best).replace('.', ',')} kg · lái cá trả ${fmtK(f.perKg)}/kg</small></span></div>`
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
    if (action === 'clean') nbClean(n, i); else if (action === 'steal') nbSteal(n, i); else if (action === 'goods') nbStealGoods(n, i); else nbDirty(n, i, action);
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
      <small>Cấp ${S.level} · ${titleOf(S.level)} · ${charOf().name}</small>
      <small class="perk">${charOf().perk}</small>
      <div class="char-swap">${Object.entries(CHARS).map(([id, c]) => `<button class="mini${S.player.char === id ? ' on' : ''}" data-setchar="${id}" title="${esc(c.name)}: ${esc(c.perk)}" ${S.player.char === id || S.money < CHAR_SWAP ? 'disabled' : ''}>${c.name.split(' ').slice(0, 2).join(' ')}</button>`).join('')}</div>
      <small>Đổi dáng nhân vật: ${fmt(CHAR_SWAP)} tiền đi tiệm</small>
    </div>
    <div class="gian-right">${fashionHTML()}</div></div>`;
}
const CHAR_SWAP = 50000;
function openChar() { openModal('Nhân vật của bạn', charHTML(), { kind: 'char' }); drawPreview(playerLook()); }
// ---------- Chọn nhân vật lúc chơi mới ----------
function pickCharHTML() {
  const sel = R.pickChar || 'co_ba';
  return `<p class="event-text">Chọn người sẽ dọn về hẻm 42 làm ăn. Mỗi người giỏi một món riêng, vào game vẫn sắm đồ thay đổi được.</p>
    <div class="char-grid">${Object.entries(CHARS).map(([id, c]) => `<button class="char-card${id === sel ? ' on' : ''}" data-pchar="${id}"><canvas id="pc-${id}" width="182" height="210" aria-hidden="true"></canvas><b>${c.name}</b><small>${c.desc}</small><span class="perk">${c.perk}</span></button>`).join('')}</div>
    <div class="char-foot"><label class="name-field" for="pc-name">Tên nhân vật<input id="pc-name" maxlength="16" value="${esc(R.pickName || '')}" placeholder="${esc(CHARS[sel].name)}" autocomplete="off" /></label>
      <button class="btn paper" data-pact="back">Quay lại</button><button class="btn big" data-pact="go">Bắt đầu buôn bán</button></div>`;
}
function drawCharPreviews() { for (const [id, c] of Object.entries(CHARS)) drawPreview(charLook(c), 'pc-' + id); }
function openPickChar() {
  R.pickChar ||= 'co_ba';
  $('title-screen').hidden = true;
  openModal('Chọn nhân vật', pickCharHTML(), { kind: 'pickchar', noClose: true });
  drawCharPreviews();
}
function onPickChar(d) {
  if (d.pchar) { R.pickChar = d.pchar; Snd.click(); refreshModal(); return; }
  if (d.pact === 'back') { closeModal(); $('title-screen').hidden = false; return; }
  if (d.pact === 'go') {
    const c = CHARS[R.pickChar] ? R.pickChar : 'co_ba';
    const name = (($('pc-name')?.value || '').trim() || CHARS[c].name.split(' ').slice(0, 2).join(' ')).slice(0, 16);
    beginGame(true, { char: c, name });
  }
}
function drawPreview(look, id = 'char-preview') {
  const cv = $(id);
  if (!cv) return;
  const g = cv.getContext('2d');
  g.setTransform(cv.width / 260, 0, 0, cv.height / 300, 0, 0);
  g.clearRect(0, 0, 260, 300);
  const grd = g.createLinearGradient(0, 0, 0, 300);
  grd.addColorStop(0, '#CFE8F2'); grd.addColorStop(1, '#F3E3B8');
  g.fillStyle = grd; rr(g, 0, 0, 260, 300, 14); g.fill();
  g.fillStyle = '#CDBB9C'; g.fillRect(0, 250, 260, 50);
  g.save(); g.translate(130, 262); g.scale(1.9, 1.9);
  drawPerson(g, { x: 0, y: 0, dir: 1, look: { ...look, scale: 1 }, moving: false, phase: 0 });
  g.restore();
}

// ---------- Thế giới, camera, di chuyển ----------
// Khu phố dài hơn một màn hình; nhân vật đi tự do trên vỉa hè, camera trượt theo.
const isStreetView = () => R.view === 'street' || R.view === 'neighbor';
const worldW = () => SW;
const sceneMargin = () => (W - SW) / 2;
const camTarget = () => -sceneMargin();
const personBase = () => (isStreetView() ? 0.86 : 1);   // khu phố nhìn xa hơn nên người nhỏ lại
function walkBand() {
  if (R.view === 'fish') return { x0: 560, x1: 640, y0: 538, y1: 542 };
  if (R.view === 'cafe') return { x0: 40, x1: SW - 40, y0: 578, y1: 626 };
  if (R.view === 'home') return { x0: 60, x1: SW - 60, y0: WALK_Y0, y1: WALK_Y1 };
  if (R.view === 'market') return { x0: 60, x1: SW - 60, y0: 512, y1: 626 };
  return { x0: 40, x1: SW - 40, y0: ST_WALK.y0, y1: ST_WALK.y1 };
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
  R.spill = null; R.actor = null; R.guests = [];
  if (view !== 'neighbor') R.visit = null;
  R.walkers = []; R.buyers = []; R.visitors = []; R.bikes = [];
  closeModal();
  if (view === 'street' || view === 'neighbor') placeMe(opts.fromRight ? SW - 150 : 160, 470);
  else if (view === 'home') placeMe(opts.fromRight ? SW - 140 : opts.fromLeft ? 150 : 640, 566);
  else if (view === 'market') placeMe(opts.fromRight ? SW - 150 : opts.arrive ? 210 : 640, 600);
  else if (view === 'cafe') placeMe(640, 596);
  else if (view === 'fish') placeMe(POND_ME.x, POND_ME.y);
  if (!R.trip) R.me.hidden = false;
  renderDock();
}
function updateMe(dt) {
  const M = R.me;
  const k = R.keys;
  const vx = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
  const vy = (k.has('ArrowDown') || k.has('s') ? 1 : 0) - (k.has('ArrowUp') || k.has('w') ? 1 : 0);
  if ((vx || vy) && !R.modal && !R.dlg && !R.trip && R.view !== 'fish') {
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
    if (M.then) { const f = M.then; M.then = null; heroAct('pickup', [0, 1, 2], 9); f(); }
  }
  updateHeroAct(dt);
  const target = camTarget();
  R.cam = target;
}
// đi hết đầu/cuối phố thì sang khu kế bên
function portalsFor() {
  if (R.view === 'home') return [{ side: 1, label: 'KHU PHỐ 1', go: () => { S.cur = 0; enterView('street'); } }, { side: -1, label: 'CHỢ ĐẦU MỐI', go: () => enterView('market', { fromRight: true }) }];
  if (R.view === 'market') return [{ side: 1, label: 'NHÀ RIÊNG', y: 560, go: () => enterView('home', { fromLeft: true }) }];
  if (R.view === 'neighbor') return [{ side: -1, label: 'VỀ NHÀ', go: () => enterView('home', { fromRight: true }) }];
  if (R.view !== 'street') return [];
  const list = [];
  list.push(S.cur === 0
    ? { side: -1, y: 392, label: 'NHÀ RIÊNG', go: () => enterView('home', { fromRight: true }) }
    : { side: -1, y: 392, label: 'KHU PHỐ ' + S.cur, go: () => { S.cur--; enterView('street', { fromRight: true }); } });
  if (S.cur + 1 < KP_COUNT) list.push({ side: 1, y: 392, label: 'KHU PHỐ ' + (S.cur + 2), go: () => { if (kpOpen(S.cur + 1)) { S.cur++; enterView('street'); } else toast(`${kpLabel(S.cur + 1)} chưa mở. Thuê đủ 6 lô ${kpLabel(S.cur)} trước đã.`, 'bad'); } });
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
  if (R.view !== 'cafe' && R.view !== 'market' && Math.random() < dt * 0.5) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    R.bikes.push({ x: dir > 0 ? R.cam - 120 : R.cam + W + 120, y: isStreetView() ? (dir > 0 ? 648 : 618) : (dir > 0 ? 712 : 700), dir, speed: rand(170, 290), color: pick(BIKE_COLORS),
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
    if (m.goods.some((id) => cheap(id) && GOODS[id].lvl <= S.level)) exclaim(x + 92, MK_Y - 290, 'Hàng rẻ');
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
  return `<p class="event-text">Ông Chủ Mối cho mua chịu tới <b>${fmt(creditLimit())}</b>. Mua chịu thì ghi sổ thêm <b>10% tiền lời</b>, nợ còn tính <b>lãi 5% mỗi 5 phút</b>, vượt 130% hạn mức là bị siết nợ. Trí tuệ cao thì được nợ nhiều hơn.</p>
    <div class="stats-line"><span>Đang nợ: <b class="${S.debt ? 'neg' : ''}">${fmt(S.debt)}</b></span><span>Tiền mặt: <b>${fmt(S.money)}</b></span>${S.debt ? `<span>Lãi kế tiếp sau <b>${interestIn()}</b>: +${fmt(S.debt * 0.05)}</span>` : ''}</div>
    <div class="btn-row"><button class="btn" data-act="repay" ${S.debt && S.money ? '' : 'disabled'}>Trả nợ</button><button class="btn ${R.credit ? 'red' : 'paper'}" data-act="credit">${R.credit ? 'Đang bật mua chịu' : 'Bật mua chịu'}</button></div>`;
}

// ---------- Góc giải trí ở quán cà phê: vòng quay, bầu cua, bài cào ----------
// Không dùng tiền: cược bằng hàng hóa trong kho, thắng thì ăn thêm hàng. Lời lỗ tính bằng số món.
const WHEEL = [
  { label: '+3 món', goods: 3, color: '#F7C948', w: 22 },
  { label: 'Trượt', color: '#B8B2A6', w: 18 },
  { label: '+10 món', goods: 10, color: '#6BA368', w: 12 },
  { label: '+5 sức', energy: 5, color: '#3E8FD9', w: 10 },
  { label: '+5 món', goods: 5, color: '#EE8434', w: 18 },
  { label: '3 mồi', bait: 3, color: '#8E6FB5', w: 7 },
  { label: 'Hàng xịn', rare: 5, color: '#D7372B', w: 3 },
  { label: 'Trượt', color: '#B8B2A6', w: 18 },
];
const SPIN_COOLDOWN = 10 * 60 * 1000, SPIN_PRICE = 2;   // quay thêm tốn 2 món hàng
const BAUCUA = [['bau', 'Bầu', '🍐'], ['cua', 'Cua', '🦀'], ['tom', 'Tôm', '🦐'], ['ca', 'Cá', '🐟'], ['ga', 'Gà', '🐓'], ['nai', 'Nai', '🦌']];
const CHIPS = [1, 2, 5, 10];   // số món mỗi lần đặt
const SUITS = [['♠', 'b'], ['♣', 'b'], ['♥', 'r'], ['♦', 'r']];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const funState = () => (S.fun ||= { spinAt: 0, items: 0, played: 0 });
function funRecord(delta) { const F = funState(); F.items = (F.items || 0) + delta; F.played++; }
// thêm/bớt hàng trong kho; thêm thì không vượt sức chứa, trả về số món thật sự thêm được
function khoAdd(id, n) { const k = Math.max(0, Math.min(n, khoSpace())); if (k) S.kho[id] = (S.kho[id] || 0) + k; return k; }
function khoTake(id, n) { if ((S.kho[id] || 0) < n) return false; S.kho[id] -= n; if (!S.kho[id]) delete S.kho[id]; return true; }
// món đang đem ra cược: món người chơi chọn, không thì món nhiều nhất trong kho
function funGood() {
  if (R.funGood && S.kho[R.funGood] > 0) return R.funGood;
  const ids = Object.keys(S.kho).filter((id) => S.kho[id] > 0).sort((a, b) => S.kho[b] - S.kho[a]);
  return (R.funGood = ids[0] || null);
}
const itemTxt = (n, id) => `${n} ${id ? GOODS[id].name.toLowerCase() : 'món'}`;
function funHTML() {
  const tab = R.funTab || 'wheel';
  const F = funState(), fg = funGood();
  const tabs = [['wheel', 'Vòng quay'], ['baucua', 'Bầu cua'], ['baicao', 'Bài cào']]
    .map(([k, n]) => `<button class="fun-tab${tab === k ? ' on' : ''}" data-funtab="${k}">${n}</button>`).join('');
  const body = tab === 'wheel' ? wheelHTML() : tab === 'baucua' ? baucuaHTML() : baicaoHTML();
  const ids = Object.keys(S.kho).filter((id) => S.kho[id] > 0);
  const picker = ids.length ? ids.map((id) => `<button class="fgood${id === fg ? ' on' : ''}" data-fgood="${id}" title="${GOODS[id].name}"><span>${GOODS[id].icon}</span><small>${S.kho[id]}</small></button>`).join('')
    : '<span class="dim">Kho trống trơn, lên chợ đầu mối gom hàng rồi hẵng chơi.</span>';
  const net = F.items || 0;
  return `<div class="fun-head"><div class="fun-tabs">${tabs}</div>
    <span class="fun-net">Lời lỗ ở đây: <b class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${Math.abs(net)} món</b></span></div>
    <div class="fun-goods"><span class="lbl">Cược bằng</span>${picker}</div>
    ${body}<p class="fun-note">Ở đây không ăn thua bằng tiền: đặt cược bằng hàng trong kho, thắng thì được thêm hàng. Kho đầy thì phần thắng dư bị bỏ lại.</p>`;
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
  const F = funState(), fg = funGood();
  const free = now() - F.spinAt >= SPIN_COOLDOWN;
  const wait = Math.ceil((SPIN_COOLDOWN - (now() - F.spinAt)) / 60000);
  const canPay = fg && S.kho[fg] >= SPIN_PRICE;
  return `<div class="fun-body wheel-body">
    <div class="wheel-box"><div class="wheel-pin" aria-hidden="true"></div>${wheelSVG()}</div>
    <div class="fun-side">
      <p class="event-text">Quay trúng hàng hóa, sức hay mồi câu. Mỗi 10 phút được <b>quay miễn phí</b> một lần, còn lại mỗi lượt đổi <b>${SPIN_PRICE} món</b> hàng đang chọn.</p>
      <button class="btn big" data-fun="spin" ${R.spinning || (!free && !canPay) ? 'disabled' : ''}>${R.spinning ? 'Đang quay…' : free ? 'Quay miễn phí' : `Quay · ${itemTxt(SPIN_PRICE, fg)}`}</button>
      ${free ? '' : `<small>Lượt miễn phí tiếp theo sau ${wait} phút.</small>`}
      ${R.wheelMsg ? `<p class="fun-result">${R.wheelMsg}</p>` : ''}
    </div></div>`;
}
// một món ngẫu nhiên đã mở khóa; hàng xịn là món đắt nhất đã mở
const randomGood = () => pick(GOOD_IDS.filter((id) => GOODS[id].lvl <= S.level));
const bestGood = () => GOOD_IDS.filter((id) => GOODS[id].lvl <= S.level).sort((a, b) => GOODS[b].sell - GOODS[a].sell)[0];
function spinWheel() {
  if (R.spinning) return;
  const F = funState(), fg = funGood();
  const free = now() - F.spinAt >= SPIN_COOLDOWN;
  if (!free) { if (!fg || !khoTake(fg, SPIN_PRICE)) { toast(`Cần ${SPIN_PRICE} món hàng trong kho để quay.`, 'bad'); return; } funRecord(-SPIN_PRICE); }
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
    if (s.goods || s.rare) {
      const id = s.rare ? bestGood() : randomGood(), n = s.rare || s.goods;
      const got = khoAdd(id, n);
      funRecord(got);
      R.wheelMsg = got ? `Trúng <b>${got} ${GOODS[id].icon} ${GOODS[id].name}</b>!${got < n ? ' Kho đầy, bỏ lại phần dư.' : ''}` : 'Trúng hàng mà kho đầy, đành bỏ lại!';
      Snd.coin();
    } else if (s.energy) { S.energy = Math.min(energyMax(), S.energy + s.energy); R.wheelMsg = 'Trúng <b>+5 sức</b>!'; Snd.coin(); }
    else if (s.bait) { S.fishing.bait.dacbiet = (S.fishing.bait.dacbiet || 0) + 3; R.wheelMsg = 'Trúng <b>3 mồi bí truyền</b>, ra hồ câu cá hiếm đi!'; Snd.coin(); }
    else { R.wheelMsg = 'Trượt rồi, lần sau may hơn!'; Snd.bad(); }
    if (R.modal === 'fun') refreshModal();
  }, 3500);
}
// Bầu cua: đặt hàng lên 1 hay nhiều con, lắc 3 hột; mỗi hột trùng ăn thêm 1 lần số hàng đã đặt
function bcState() { return (R.bc ||= { chip: 1, bets: {}, good: null, dice: null, rolling: false, msg: '' }); }
function baucuaHTML() {
  const B = bcState(), fg = funGood();
  const total = Object.values(B.bets).reduce((a, b) => a + b, 0);
  const dice = B.rolling ? '<div class="bc-dish shaking">Đang lắc…</div>'
    : B.dice ? `<div class="bc-dice">${B.dice.map((d) => `<span class="die">${BAUCUA.find((x) => x[0] === d)[2]}</span>`).join('')}</div>`
    : '<div class="bc-dish">Đặt hàng rồi bấm Lắc</div>';
  return `<div class="fun-body bc-body">
    <div class="bc-board">${BAUCUA.map(([id, n, ic]) => `<button class="bc-cell${B.dice && B.dice.includes(id) ? ' hit' : ''}" data-bet="${id}" ${B.rolling || !fg ? 'disabled' : ''}><span class="ic">${ic}</span><b>${n}</b>${B.bets[id] ? `<span class="bet">${B.bets[id]} ${GOODS[B.good].icon}</span>` : ''}</button>`).join('')}</div>
    <div class="fun-side">
      ${dice}
      <div class="chips">${CHIPS.map((c) => `<button class="chip${B.chip === c ? ' on' : ''}" data-chip="${c}">${c} món</button>`).join('')}</div>
      <div class="kv"><span>Tổng cược</span><b>${total ? itemTxt(total, B.good) : '0 món'}</b></div>
      <div class="btn-row"><button class="btn big" data-fun="roll" ${B.rolling || !total ? 'disabled' : ''}>Lắc!</button><button class="btn paper" data-fun="clearbet" ${B.rolling || !total ? 'disabled' : ''}>Xóa cược</button></div>
      ${B.msg ? `<p class="fun-result">${B.msg}</p>` : ''}
    </div></div>`;
}
function bcBet(id) {
  const B = bcState(), fg = funGood();
  if (B.rolling || !fg) return;
  if (B.good !== fg) { B.bets = {}; B.good = fg; }
  const total = Object.values(B.bets).reduce((a, b) => a + b, 0);
  if (total + B.chip > (S.kho[fg] || 0)) { toast(`Trong kho không đủ ${GOODS[fg].name.toLowerCase()} để đặt thêm.`, 'bad'); return; }
  if (B.dice) { B.dice = null; B.msg = ''; }
  B.bets[id] = (B.bets[id] || 0) + B.chip;
  Snd.click();
}
function bcRoll() {
  const B = bcState();
  const total = Object.values(B.bets).reduce((a, b) => a + b, 0);
  if (!total || B.rolling || !B.good || !khoTake(B.good, total)) return;
  const good = B.good;
  B.rolling = true; B.msg = ''; B.dice = null;
  refreshModal();
  for (let i = 0; i < 8; i++) Snd.tone(300 + Math.random() * 200, 0.05, 'triangle', 0.04, i * 0.12);
  setTimeout(() => {
    B.rolling = false;
    B.dice = [0, 1, 2].map(() => pick(BAUCUA)[0]);
    let back = 0;
    for (const [id, amt] of Object.entries(B.bets)) { const m = B.dice.filter((d) => d === id).length; if (m) back += amt + amt * m; }
    const got = khoAdd(good, back);
    funRecord(got - total);
    B.msg = back > total ? `Ăn <b>${itemTxt(back - total, good)}</b>!${got < back ? ' Kho đầy, bỏ lại phần dư.' : ''}` : back === total ? 'Huề, lấy lại đủ hàng.' : `Thua <b>${itemTxt(total - back, good)}</b>.`;
    back > total ? Snd.coin() : Snd.bad();
    B.bets = {};
    if (R.modal === 'fun') refreshModal();
  }, 1300);
}
// Bài cào: 3 lá, điểm = tổng % 10 (J Q K và 10 tính 0); ba lá J/Q/K là "ba tây", ăn gấp đôi
function bkState() { return (R.bk ||= { chip: 1, good: null, me: null, dealer: null, reveal: false, msg: '' }); }
const cardVal = (c) => { const i = RANKS.indexOf(c.r); return i >= 9 ? 0 : i + 1; };
const isTay = (h) => h.every((c) => ['J', 'Q', 'K'].includes(c.r));
const handScore = (h) => (isTay(h) ? 10 : h.reduce((a, c) => a + cardVal(c), 0) % 10);
function cardHTML(c, hidden) {
  if (hidden) return '<span class="pcard back"></span>';
  return `<span class="pcard ${c.col}"><b>${c.r}</b><i>${c.s}</i></span>`;
}
function baicaoHTML() {
  const K = bkState(), fg = funGood();
  const hand = (h, hide) => (h ? h.map((c) => cardHTML(c, hide)).join('') : '<span class="pcard back"></span>'.repeat(3));
  const label = (h) => (h ? (isTay(h) ? 'Ba tây!' : `${handScore(h)} nút`) : '');
  return `<div class="fun-body bk-body">
    <div class="bk-table">
      <div class="bk-row"><span class="bk-who">Nhà cái ${K.reveal ? `· <b>${label(K.dealer)}</b>` : ''}</span><div class="bk-hand">${hand(K.dealer, !K.reveal)}</div></div>
      <div class="bk-row"><span class="bk-who">${esc(S.player.name)} ${K.me ? `· <b>${label(K.me)}</b>` : ''}</span><div class="bk-hand">${hand(K.me, false)}</div></div>
    </div>
    <div class="fun-side">
      <p class="event-text">Mỗi người 3 lá, cộng điểm lấy hàng đơn vị. 10, J, Q, K tính 0 nút. Ba lá hình (J Q K) là <b>ba tây</b>, ăn gấp đôi.</p>
      <div class="chips">${CHIPS.map((c) => `<button class="chip${K.chip === c ? ' on' : ''}" data-bkchip="${c}">${c} món</button>`).join('')}</div>
      <button class="btn big" data-fun="deal" ${(K.me && !K.reveal) || !fg ? 'disabled' : ''}>Chia bài · cược ${itemTxt(K.chip, fg)}</button>
      ${K.msg ? `<p class="fun-result">${K.msg}</p>` : ''}
    </div></div>`;
}
function bkDeal() {
  const K = bkState(), fg = funGood();
  if (K.me && !K.reveal) return;
  if (!fg || !khoTake(fg, K.chip)) { toast('Trong kho không đủ hàng để cược.', 'bad'); return; }
  K.good = fg;
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
    const got = khoAdd(K.good, back);
    funRecord(got - K.chip);
    K.msg = a > b ? `Thắng <b>${itemTxt(back - K.chip, K.good)}</b>!${isTay(K.me) ? ' Ba tây ăn đậm!' : ''}` : a === b ? 'Bằng nút, huề.' : `Nhà cái ăn ${itemTxt(K.chip, K.good)}.`;
    a > b ? Snd.coin() : a === b ? Snd.click() : Snd.bad();
    if (R.modal === 'fun') refreshModal();
  }, 1100);
}
function openFun() { openModal('Góc giải trí', funHTML(), { kind: 'fun' }); }
function onFunClick(d) {
  if (d.funtab) { R.funTab = d.funtab; Snd.click(); }
  else if (d.fgood) { R.funGood = d.fgood; Snd.click(); }
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
  exclaim(x + 62, 352, 'Chơi');
  hits.push({ x: x - 70, y: 366, w: 140, h: 210, kind: 'fun', pri: 2 });
}

// ---------- Khu phố: một màn hình, 2 hàng × 3 lô, có 10 khu phố ----------
// Phía sau là bờ tường thấp (khu phố VIP mới có dãy nhà lớn), vỉa hè sâu, mặt đường rộng.
const KP_COUNT = 10, LOTS_PER_KP = 6;
const ST_GROUND = 300, ST_CURB = 566;          // chân tường, mép vỉa hè của khu phố
const ST_WALK = { y0: 314, y1: 576 };
const LOT_XS = [250, 640, 1030];
const ROW_BASE = [404, 508];
const VIP_KP = [4, 9];                          // KP5 và KP10 là phố VIP: nhà lớn phía sau, bán nhanh hơn
const isVip = (si) => si >= 4;   // từ KP5: phố mặt tiền, có dãy nhà và tiệm cho thuê
const lotRow = (i) => (i < 3 ? 0 : 1);
const lotX = (i) => LOT_XS[i % 3] + (i < 3 ? 0 : 50);
const lotBase = (i) => ROW_BASE[lotRow(i)];
const lotName = (i) => `lô ${i + 1} (hàng ${lotRow(i) + 1})`;
const kpOpen = (si) => si === 0 || (si < KP_COUNT && S.streets[si - 1].gians.every((g) => g.open));
const kp2Open = () => kpOpen(1);
function nextLot() {
  for (let si = 0; si < S.streets.length; si++) for (let li = 0; li < LOTS_PER_KP; li++) if (!S.streets[si].gians[li].open) return { si, li };
  return null;
}
function lotCost(si, li) {
  const n = si * LOTS_PER_KP + li;
  return n === 0 ? [0, 1] : [Math.round((15000 * Math.pow(n, 1.6)) / 1000) * 1000, Math.min(MAX_LVL, 1 + Math.floor(n / 3))];
}
const KP_NAMES = ['Hẻm Chợ Cũ', 'Đường Ray Cũ', 'Cổng Trường', 'Bờ Kênh', 'Phố Đi Bộ', 'Cầu Chữ Y', 'Bến Xe Cũ', 'Chợ Đêm', 'Bờ Sông', 'Phố Tây'];
const kpLabel = (si) => `Khu phố ${si + 1}`;
// Mỗi khu phố một gu riêng và một giờ đông khách riêng.
//   goods: món dân ở đây chuộng; bonus 'price' = bán món đó giá gấp đôi, 'speed' = khách mua nhanh gấp đôi
//   peak: giờ cao điểm trong game (cả khu bán nhanh ×1,5); slow: giờ vắng (×0,6); khu không ghi slow thì vắng từ 23h tới 5h (×0,5)
const KP_THEME = [
  { tag: 'Đồ ăn sáng',     goods: ['xoi', 'banh_mi', 'bap'],           bonus: 'speed', peak: [[5, 9]] },
  { tag: 'Giải khát',      goods: ['tra_da', 'nuoc_mia', 'kem_chuoi'], bonus: 'price', peak: [[11, 15]] },
  { tag: 'Học trò',        goods: ['keo_bong', 'do_choi', 'kem_chuoi'], bonus: 'speed', peak: [[6, 8], [16, 18]], slow: [[20, 6]] },
  { tag: 'Ăn vặt chiều',   goods: ['hot_vit', 'bap', 'tra_da'],        bonus: 'price', peak: [[16, 21]] },
  { tag: 'Du khách',       goods: ['non', 'kinh', 'keo_bong'],         bonus: 'price', peak: [[18, 23]] },
  { tag: 'Dân lao động',   goods: ['banh_mi', 'nuoc_mia', 'tra_da'],   bonus: 'speed', peak: [[5, 8], [11, 13]] },
  { tag: 'Khách đi xa',    goods: ['banh_mi', 'non', 'ao_thun'],       bonus: 'speed', peak: [[4, 8], [17, 20]] },
  { tag: 'Thời trang đêm', goods: ['ao_thun', 'giay', 'tui'],          bonus: 'price', peak: [[19, 2]], slow: [[6, 16]] },
  { tag: 'Hẹn hò ven sông', goods: ['hot_vit', 'nuoc_mia', 'kem_chuoi'], bonus: 'speed', peak: [[18, 23]] },
  { tag: 'Khách Tây',      goods: ['kinh', 'tui', 'giay'],             bonus: 'price', peak: [[20, 3]], slow: [[7, 15]] },
];
const kpTheme = (si) => KP_THEME[si] || KP_THEME[0];
const themeHit = (si, good) => kpTheme(si).goods.includes(good);
const kpPeak = (si, h = gameHour()) => inHours(h, kpTheme(si).peak);
const kpSlow = (si, h = gameHour()) => (kpTheme(si).slow ? inHours(h, kpTheme(si).slow) : h < 5 || h >= 23);
function kpTimeMult(si) {
  const T = kpTheme(si);
  if (kpPeak(si)) return 1.5;
  if (kpSlow(si)) return T.slow ? 0.6 : 0.5;
  return 1;
}
const themeIcons = (si) => kpTheme(si).goods.map((id) => GOODS[id].icon).join('');
const themeLine = (si) => `${kpTheme(si).tag}: ${kpTheme(si).goods.map((id) => GOODS[id].name).join(', ')} ${kpTheme(si).bonus === 'price' ? 'bán giá ×2' : 'khách mua nhanh ×2'} · đông khách ${hoursText(kpTheme(si).peak)}`;
// món hot trong ngày theo báo: bán ở đâu cũng được giá hơn 30%
function hotGood(day = gameDay()) {
  const open = GOOD_IDS.filter((id) => GOODS[id].lvl <= Math.max(3, S.level));
  return open[Math.floor(mulberry32(day * 7919 + 17)() * open.length)];
}
// giờ của các nơi khác
const AREA_TIME = {
  market: { peak: [[2, 6]], text: 'Chợ sớm 2h–6h: giá sỉ rẻ hơn 10%' },
  fish:   { peak: [[5, 8], [17, 19]], text: 'Bình minh 5h–8h, chiều 17h–19h: cá cắn nhanh, cá hiếm hay ăn mồi' },
  cafe:   { peak: [[6, 9], [19, 22]], text: 'Sáng 6h–9h, tối 19h–22h: quán đông, chat rôm rả' },
};
const areaPeak = (k) => inHours(gameHour(), AREA_TIME[k].peak);

// nền khu phố: trời, nhà cao tầng xa, cây, bờ tường có dán quảng cáo rao vặt
const WALL_ADS = ['KHOAN CẮT BÊ TÔNG', 'DẠY KÈM TẠI NHÀ', 'SỬA ĐIỆN NƯỚC', 'CHO THUÊ NHÀ', 'THÔNG CỐNG NGHẸT', 'NHẬN GIỮ TRẺ', 'MUA VE CHAI', 'CẦM ĐỒ GIÁ CAO'];
function drawWallBg(g, rnd, rp, lights, PM, si) {
  const X0 = -PM, XW = SW + 2 * PM;
  // cao ốc xa
  for (let x = X0; x < SW + PM;) {
    const w = 60 + rnd() * 70, h = 60 + rnd() * 110;
    g.fillStyle = rp(['#9FB3C8', '#B7C4D4', '#8EA3B8', '#C4CDD8']);
    g.fillRect(x, ST_GROUND - 70 - h, w, h + 70);
    for (let wy = ST_GROUND - 64 - h; wy < ST_GROUND - 80; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (rnd() < 0.55) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(wx, wy, 6, 7); lights.push({ x: wx, y: wy, w: 6, h: 7, on: rnd() < 0.5, warm: rnd() < 0.6, far: true }); }
    x += w + rnd() * 20;
  }
  // tán cây sau tường
  for (let i = 0; i < 30; i++) { g.fillStyle = ['#2F6B3A', '#3F8A4A', '#4E9A52'][i % 3]; g.beginPath(); g.arc(X0 + rnd() * XW, ST_GROUND - 80 + rnd() * 20, 26 + rnd() * 26, 0, 7); g.fill(); }
  // bờ tường
  const wallTop = ST_GROUND - 88;
  const wc = rp(['#C9C2B3', '#D8CDB5', '#BFC6C2', '#D4C3A8']);
  g.fillStyle = wc; g.fillRect(X0, wallTop, XW, 88);
  g.fillStyle = shade(wc, -30); g.fillRect(X0, wallTop - 8, XW, 10);
  g.strokeStyle = 'rgba(35,26,20,.18)'; g.lineWidth = 2;
  for (let x = X0; x < SW + PM; x += 160) { g.beginPath(); g.moveTo(x, wallTop); g.lineTo(x, ST_GROUND); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 40; i++) g.fillRect(X0 + rnd() * XW, wallTop + rnd() * 80, 6 + rnd() * 20, 2);
  // quảng cáo rao vặt dán tường
  for (let i = 0; i < 6; i++) {
    const x = X0 + 80 + rnd() * (XW - 200), y = wallTop + 14 + rnd() * 34, w = 90 + rnd() * 30;
    g.fillStyle = rp(['#FFF4D6', '#F7E1A0', '#F2F2EE', '#FFD6D6']); g.fillRect(x, y, w, 30);
    g.fillStyle = rp(['#C0392B', '#1F6F8B', '#231A14']); g.font = '800 10px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(rp(WALL_ADS), x + w / 2, y + 10, w - 6); g.font = '700 9px "Be Vietnam Pro", sans-serif'; g.fillText('LH: 09xx.xxx.' + String(Math.floor(rnd() * 900) + 100), x + w / 2, y + 22, w - 6);
  }
  // biển tên khu phố gắn tường
  g.fillStyle = '#6E6A64'; g.fillRect(443, wallTop - 20, 6, 22);
  g.fillStyle = '#1F6F8B'; rr(g, 335, wallTop - 56, 220, 38, 8); g.fill(); g.strokeStyle = '#FFF4D6'; g.lineWidth = 3; g.stroke();
  signText(g, `${kpLabel(si).toUpperCase()} · ${KP_NAMES[si].toUpperCase()}`, 445, wallTop - 37, 17, '#FFF4D6', 206);
}
function drawStreetGround(g, rnd, BW, wave) {
  g.fillStyle = wave ? '#E9E4D8' : '#CDBB9C'; g.fillRect(0, ST_GROUND, BW, ST_CURB - ST_GROUND);
  if (wave) {
    g.save(); g.beginPath(); g.rect(0, ST_GROUND, BW, ST_CURB - ST_GROUND); g.clip();
    g.strokeStyle = 'rgba(59,58,63,.7)'; g.lineWidth = 7; g.lineCap = 'round';
    for (let y = ST_GROUND + 14, r = 0; y < ST_CURB + 10; y += 30, r++) {
      g.beginPath();
      for (let x = -20; x <= BW + 20; x += 8) { const yy = y + Math.sin((x + r * 30) / 22) * 7; if (x === -20) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    }
    g.restore();
  } else {
    g.strokeStyle = 'rgba(90,70,50,.18)'; g.lineWidth = 1.5;
    for (let y = ST_GROUND + 22, row = 0; y < ST_CURB; y += 26 + row, row++) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(BW, y); g.stroke();
      const step = 60 + row * 6;
      g.beginPath(); for (let x = (row % 2) * step / 2; x < BW; x += step) { g.moveTo(x, y - 26 - row + 2); g.lineTo(x, y); } g.stroke();
    }
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, ST_GROUND, BW, 6);
  // lề, mặt đường rộng
  g.fillStyle = '#9A948A'; g.fillRect(0, ST_CURB, BW, 10);
  g.fillStyle = '#6F6A62'; g.fillRect(0, ST_CURB + 10, BW, 4);
  g.fillStyle = '#44474F'; g.fillRect(0, ST_CURB + 14, BW, H - ST_CURB - 14);
  g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < BW / 3; i++) g.fillRect(rnd() * BW, ST_CURB + 14 + rnd() * (H - ST_CURB), 2, 2);
  g.fillStyle = '#E8C547'; for (let x = 20; x < BW; x += 140) g.fillRect(x, 640, 70, 6);
  // ổ gà
  for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(20,20,24,.5)'; g.beginPath(); g.ellipse(rnd() * BW, 600 + rnd() * 60, 18 + rnd() * 10, 5, 0, 0, 7); g.fill(); }
}

// ---------- Sự kiện trên đường ----------
// Xe chạy ngang xả rác lên vỉa hè; xe ba gác chở bia vấp ổ gà, đổ hàng ra đường.
function updateRoad(dt) {
  if (R.view !== 'street' || !R.started || R.attract) return;
  const placed = S.streets[S.cur].gians.map((g, i) => (g.placed ? i : -1)).filter((i) => i >= 0);
  if (placed.length && Math.random() < dt / 35) {
    const li = pick(placed), dir = Math.random() < 0.5 ? 1 : -1;
    R.bikes.push({ x: dir > 0 ? R.cam - 120 : R.cam + W + 120, y: dir > 0 ? 646 : 618, dir, speed: rand(200, 260), color: pick(BIKE_COLORS),
      rider: { skin: pick(['#F1C9A5', '#E0AC80', '#C68B5E']), shirt: pick(SHIRTS), helmet: pick(HELMETS) }, pass: null, cargo: false, litter: li });
  }
  for (const b of R.bikes) {
    if (b.litter == null) continue;
    const tx = lotX(b.litter);
    if ((b.dir > 0 && b.x >= tx) || (b.dir < 0 && b.x <= tx)) {
      const G = S.streets[S.cur].gians[b.litter];
      if (G.placed) {
        G.trash = Math.min(3, G.trash + 1);
        b.say = pick(['Vứt cái ly nè!', 'Bịch rác nè, khỏi cảm ơn!', 'Ủa có ai thấy đâu!']); b.sayT = 2;
        R.parts.push({ type: 'text', x: tx, y: lotBase(b.litter) + 10, vy: -30, text: 'Ai xả rác!', color: '#F9C9C0', life: 1.4, max: 1.4, small: true });
        news(`Có người chạy xe ngang xả rác trước ${lotName(b.litter)}.`, 'bad');
      }
      b.litter = null;
    }
  }
  for (const b of R.bikes) if (b.sayT > 0) b.sayT -= dt;
  // xe ba gác đổ hàng
  const SP = R.spill;
  if (!SP && Math.random() < dt / 60) {
    R.spill = { phase: 'come', x: R.cam - 260, stopX: rand(380, 900), items: [], t: 0, say: null, sayT: 0, picked: 0 };
  } else if (SP) {
    SP.t += dt; if (SP.sayT > 0) SP.sayT -= dt;
    if (SP.phase === 'come') {
      SP.x += dt * 230;
      if (SP.x >= SP.stopX) {
        SP.phase = 'spilled'; SP.t = 0; Snd.bad();
        const pool = ['bia', 'bia', 'bia', ...GOOD_IDS.filter((id) => GOODS[id].lvl <= S.level)];
        SP.items = Array.from({ length: 7 + Math.floor(Math.random() * 4) }, (_, k) => ({ x: SP.x + (k % 2 ? rand(170, 330) : rand(-300, -110)), y: rand(598, 650), kind: pick(pool) }));
        SP.say = 'Ui ui, đổ hết bia rồi! Bà con đừng lụm nha!'; SP.sayT = 3;
      }
    } else if (SP.phase === 'spilled') {
      // tài xế tự nhặt dần
      if (SP.t > 2.6 && SP.items.length) { SP.items.shift(); SP.t = 0; }
      if (!SP.items.length) { SP.phase = 'go'; SP.say = SP.picked ? 'Mất mấy chai rồi, xui ghê!' : 'Nhặt đủ rồi, đi tiếp!'; SP.sayT = 2; }
    } else {
      SP.x += dt * 260;
      if (SP.x > R.cam + W + 320) R.spill = null;
    }
  }
}
function pickSpill(it) {
  const SP = R.spill;
  if (!SP || SP.phase !== 'spilled') return;
  const k = SP.items.indexOf(it);
  if (k < 0) { toast('Chú ba gác nhặt mất rồi!'); return; }
  SP.items.splice(k, 1); SP.picked++;
  changeKarma(-1);
  if (it.kind === 'bia') { S.money += 5000; toast('Lụm được chai bia, bán ve chai được 5.000đ. Hơi kỳ nha!'); }
  else if (khoCount() + 3 <= khoCap()) { S.kho[it.kind] = (S.kho[it.kind] || 0) + 3; toast(`Lụm được 3 ${GOODS[it.kind].name} bỏ vô kho.`); }
  else { S.money += 3000; toast('Kho đầy, đem bán lại được 3.000đ.'); }
  SP.say = pick(['Ui ui, đừng lụm bia của tui mà!', 'Ê ê, đồ của tui đó!', 'Trời ơi, lụm chi vậy!']); SP.sayT = 2.2;
  Snd.coin();
}
function helpSpill() {
  const SP = R.spill;
  if (!SP || SP.phase !== 'spilled' || !SP.items.length) return;
  if (!useEnergy(2)) return;
  SP.items = []; SP.t = 0;
  changeKarma(3); addXp(6); S.money += 10000;
  SP.say = 'Cảm ơn nha! Cầm 10 ngàn uống cà phê!'; SP.sayT = 2.6;
  Snd.coin(); toast('Phụ nhặt hàng giùm, được bo 10.000đ. Uy tín tăng!', 'good');
}
function drawCargoTrike(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(40, 0, 130, 7, 0, 0, 7); ctx.fill();
  wheel(ctx, -60, -16, 16, R.t * 8); wheel(ctx, 60, -16, 16, R.t * 8); wheel(ctx, 140, -16, 16, R.t * 8);
  ctx.fillStyle = '#1F6F8B'; ctx.fillRect(-90, -54, 180, 18); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.strokeRect(-90, -54, 180, 18);
  ctx.fillStyle = '#2E2E33'; ctx.fillRect(-90, -76, 6, 24); ctx.fillRect(84, -76, 6, 24);
  const full = !R.spill || R.spill.phase === 'come';
  for (let r = 0; r < (full ? 3 : 1); r++) for (let k = 0; k < 6; k++) { ctx.fillStyle = (k + r) % 2 ? '#C0392B' : '#D98E04'; ctx.fillRect(-82 + k * 28, -78 - r * 20, 26, 20); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeRect(-82 + k * 28, -78 - r * 20, 26, 20); }
  ctx.strokeStyle = '#2E2E33'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(90, -46); ctx.lineTo(130, -46); ctx.lineTo(140, -16); ctx.moveTo(126, -46); ctx.lineTo(120, -80); ctx.stroke();
  ctx.restore();
  drawPerson(ctx, { x: x + 124, y: y - 14, dir: 1, look: { skin: '#C68B5E', hair: '#1E1A1A', long: false, hat: 2, helmet: '#F7B32B', shirt: '#3E7CB1', pants: '#2F3E46', scale: 0.95 }, seated: true, moving: false, phase: 0 });
}
function drawRoad(hits) {
  const SP = R.spill;
  if (SP) {
    drawCargoTrike(SP.x, 650);
    for (const it of SP.items) {
      if (it.kind === 'bia') { ctx.fillStyle = '#2E7D4F'; ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(1.2); rr(ctx, -12, -4, 24, 9, 3); ctx.fill(); ctx.fillStyle = '#F2F2EE'; ctx.fillRect(-4, -4, 7, 9); ctx.restore(); }
      else emoji(ctx, GOODS[it.kind].icon, it.x, it.y - 6, 22);
      hits.push({ x: it.x - 20, y: it.y - 24, w: 40, h: 34, kind: 'spill', item: it, pri: 3 });
    }
    if (SP.phase === 'spilled') hits.push({ x: SP.x + 90, y: 540, w: 70, h: 110, kind: 'driver', pri: 3 });
    if (SP.sayT > 0 && SP.say) bubble(SP.say, SP.x + 124, 540, { size: 15, bg: '#FFF4D6', maxW: 320 });
  }
  for (const b of R.bikes) if (b.sayT > 0 && b.say) bubble(b.say, b.x, b.y - 108, { size: 14 });
}

// ---------- Phố mặt tiền (từ Khu phố 5): thuê tiệm để làm ăn ----------
// Ở KP5 trở đi, 3 lô hàng 1 là 3 căn tiệm phía sau vỉa hè. Thuê mặt bằng rồi chọn ngành nghề.
// Tiệm không cần nhập hàng: khách tự vô, tiền vào két đều đặn và cao hơn sạp.
const SHOP_FROM = 4;
const isShopKP = (si) => si >= SHOP_FROM;
const isShopLot = (si, li) => isShopKP(si) && li < 3;
const SHOP_TYPES = {
  hot_toc:   { name: 'Tiệm hớt tóc',    short: 'HỚT TÓC',     icon: '💈', price: 1500000, lvl: 9,  rate: 900,  color: '#1F6F8B', props: ['💈', '✂️', '🪑'] },
  sua_xe:    { name: 'Tiệm sửa xe',     short: 'SỬA XE',      icon: '🔧', price: 2000000, lvl: 9,  rate: 1200, color: '#2E7D4F', props: ['🔧', '🛞', '🛵'] },
  com_tam:   { name: 'Quán cơm tấm',    short: 'CƠM TẤM',     icon: '🍛', price: 2500000, lvl: 10, rate: 1500, color: '#C0392B', props: ['🍛', '🍳', '🥢'] },
  tap_hoa:   { name: 'Tiệm tạp hóa',    short: 'TẠP HÓA',     icon: '🛒', price: 3000000, lvl: 11, rate: 1800, color: '#D98E04', props: ['🥫', '🧴', '🍜'] },
  dien_thoai:{ name: 'Tiệm điện thoại', short: 'ĐIỆN THOẠI',  icon: '📱', price: 3500000, lvl: 12, rate: 2100, color: '#7A3E9D', props: ['📱', '🔋', '🎧'] },
  ca_phe_t:  { name: 'Quán cà phê',     short: 'CÀ PHÊ',      icon: '☕', price: 4000000, lvl: 13, rate: 2400, color: '#6B3E26', props: ['☕', '🧋', '🍰'] },
  tiem_vang: { name: 'Tiệm vàng',       short: 'TIỆM VÀNG',   icon: '💍', price: 8000000, lvl: 15, rate: 5000, color: '#B8860B', props: ['💍', '📿', '⚖️'] },
};
const SHOP_MAX_LVL = 5;
const shopRateMul = (lv) => 1 + 0.6 * (lv - 1);
const shopUpCost = (G) => Math.round(SHOP_TYPES[G.biz].price * 0.6 * G.bizLvl);
function shopRate(G, si) {
  if (!G.biz || G.broken) return 0;
  let m = shopRateMul(G.bizLvl) * (1 - 0.12 * Math.min(3, G.trash)) * (1 + stat('beauty') * 0.02) * (1 + (si - SHOP_FROM) * 0.06) * eventMult(si, null);
  m *= kpTimeMult(si) * repMult();
  return SHOP_TYPES[G.biz].rate * m;   // đồng mỗi giây
}
function tickShops(dt, visual) {
  S.streets.forEach((st, si) => st.gians.forEach((G, li) => {
    if (!G.biz) return;
    G.cash += shopRate(G, si) * dt;
    if (visual && si === S.cur && R.view === 'street' && Math.random() < dt / 7) spawnShopGuest(li);
  }));
}
function openBiz(si, li, type) {
  const G = S.streets[si].gians[li], T = SHOP_TYPES[type];
  if (G.biz || S.level < T.lvl || S.money < T.price) return;
  S.money -= T.price;
  G.biz = type; G.bizLvl = 1; G.cash = 0; G.clerk = randomSeller();
  Snd.level();
  toast(`Khai trương <b>${T.name}</b>! ${G.clerk.name} đứng tiệm giùm bạn.`, 'gold');
  news(`Bạn khai trương ${T.name} ở ${kpLabel(si)}.`, 'good');
}
function upgradeBiz(si, li) {
  const G = S.streets[si].gians[li];
  if (!G.biz || G.bizLvl >= SHOP_MAX_LVL) return;
  const c = shopUpCost(G);
  if (S.money < c) return;
  S.money -= c; G.bizLvl++;
  Snd.level(); toast(`${SHOP_TYPES[G.biz].name} lên cấp ${G.bizLvl}, khách đông hơn!`, 'gold');
}
function closeBiz(si, li) {
  const G = S.streets[si].gians[li];
  if (!G.biz) return;
  collect(si, li, true);
  const back = Math.round(SHOP_TYPES[G.biz].price * 0.4);
  S.money += back;
  toast(`Sang lại tiệm, thu về ${fmt(back)}. Mặt bằng trống, chọn ngành khác được.`);
  G.biz = null; G.bizLvl = 0; G.clerk = null;
}
function shopHTML(si, li) {
  const G = S.streets[si].gians[li];
  if (!G.biz) {
    const cards = Object.entries(SHOP_TYPES).map(([id, T]) => {
      const locked = S.level < T.lvl;
      return `<div class="card${locked ? ' locked' : ''}"><b class="c-name">${T.icon} ${T.name}</b><span class="c-stats">~${fmtK(T.rate * 60)}/phút · không cần nhập hàng</span>
        <div class="c-foot"><span class="c-price">${fmt(T.price)}</span>${locked ? `<span class="lock">Cần cấp ${T.lvl}</span>` : `<button class="mini" data-biz="${id}" ${S.money < T.price ? 'disabled' : ''}>Mở tiệm</button>`}</div></div>`;
    }).join('');
    return `<p class="event-text">Mặt bằng ${lotName(li)} ở ${kpLabel(si)} đang trống. Chọn ngành nghề để khai trương. Có mặt bằng thì khách tự vô, không phải nhập hàng, thu nhập cao hơn bày sạp.</p>
      <div class="cards">${cards}</div>`;
  }
  const T = SHOP_TYPES[G.biz], rate = shopRate(G, si);
  const up = G.bizLvl < SHOP_MAX_LVL ? shopUpCost(G) : 0;
  return `<div class="gian-panel">
    <div class="cab-wrap"><div class="shop-hero" style="--c:${T.color}"><span class="shop-ic">${T.icon}</span><b>${T.name}</b><small>Cấp ${G.bizLvl}/${SHOP_MAX_LVL} · ${G.clerk?.name || ''} đứng tiệm</small><span class="shop-props">${T.props.join(' ')}</span></div></div>
    <div class="gian-side">
      <div class="gian-card">
        <div class="kv"><span>Thu nhập</span><b>${rate ? '~' + fmtK(rate * 60) + '/phút' : 'Đang nghỉ'}</b></div>
        <div class="kv"><span>Tiền trong két</span><b>${fmt(G.cash)}</b></div>
        <div class="flags">${G.trash ? `<span class="flag-chip bad">Rác ×${G.trash}</span>` : ''}${G.broken ? '<span class="flag-chip bad">Bị đập phá</span>' : ''}<span class="flag-chip ok">Có mặt bằng, khỏi lo công an</span></div>
        <div class="btn-row">
          <button class="btn" data-act="collect" ${G.cash > 0 ? '' : 'disabled'}>Thu tiền</button>
          ${G.trash ? '<button class="btn paper" data-act="clean">Dọn rác</button>' : ''}
          ${G.broken ? `<button class="btn red" data-act="repair" ${S.money < repairCost() ? 'disabled' : ''}>Sửa tiệm · ${fmt(repairCost())}</button>` : ''}
        </div>
      </div>
      ${up ? `<button class="btn green" data-act="bizup" ${S.money < up ? 'disabled' : ''}>Nâng cấp tiệm · ${fmt(up)}<small>Thu nhập ×${String(shopRateMul(G.bizLvl + 1)).replace('.', ',')}</small></button>` : '<span class="tag">Tiệm đã cấp tối đa</span>'}
      <button class="btn paper" data-act="bizclose">Sang lại tiệm (thu về 40% vốn)</button>
    </div></div>`;
}
// khách vô tiệm (chỉ để nhìn cho vui)
function spawnShopGuest(li) {
  if (R.guests.length > 6) return;
  const fromLeft = Math.random() < 0.5;
  R.guests.push({ li, x: fromLeft ? R.cam - 40 : R.cam + W + 40, y: rand(330, 360), dir: fromLeft ? 1 : -1, look: makeLook(), speed: rand(120, 160), phase: 0, moving: true, state: 'in' });
}
function updateGuests(dt) {
  for (const g of R.guests) {
    const tx = lotX(g.li), ty = ST_GROUND + 18;
    if (g.state === 'in') {
      const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
      if (d < 4) { g.state = 'gone'; R.parts.push({ type: 'text', x: tx, y: ST_GROUND - 140, vy: -30, text: '+khách', color: '#DDF2C9', life: 1, max: 1, small: true }); }
      else { const s = Math.min(1, (g.speed * dt) / d); g.x += dx * s; g.y += dy * s; g.dir = Math.sign(dx) || g.dir; g.phase += dt * 9; }
    }
  }
  R.guests = R.guests.filter((g) => g.state !== 'gone' && R.view === 'street');
}
// vẽ mặt tiền tiệm đè lên tầng trệt dãy nhà
function drawShopFront(cx, G, i, si, hits, nl) {
  const w = 330, top = ST_GROUND - 132, x0 = cx - w / 2;
  if (!G.open) {
    ctx.fillStyle = '#A3ABB0'; ctx.fillRect(x0, top + 30, w, 102);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = top + 34; k < ST_GROUND; k += 5) { ctx.moveTo(x0, k); ctx.lineTo(x0 + w, k); } ctx.stroke();
    ctx.fillStyle = '#6E6A64'; ctx.fillRect(x0 - 4, top + 24, w + 8, 10);
    const next = nl && nl.si === si && nl.li === i;
    ctx.fillStyle = next ? '#FFF4D6' : '#E3E0D8'; rr(ctx, cx - 110, top + 50, 220, 58, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
    signText(ctx, 'CHO THUÊ MẶT BẰNG', cx, top + 68, 17, '#C0392B', 206);
    if (next) {
      const [cost, lvl] = gianCost(si, i);
      ctx.font = '700 14px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#231A14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.level < lvl ? `Cần cấp ${lvl}` : fmt(cost), cx, top + 92);
      hits.push({ x: x0, y: top, w, h: 142, kind: 'gian', i, pri: 1 });
    } else { ctx.font = '600 12px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#7A6552'; ctx.fillText('Chưa tới lượt thuê', cx, top + 92); }
    return;
  }
  const T = G.biz ? SHOP_TYPES[G.biz] : null;
  // tường, cửa, mái hiên
  ctx.fillStyle = '#3B2E2A'; ctx.fillRect(x0 + 10, top + 40, w - 20, 92);
  if (T) {
    ctx.fillStyle = T.color; rr(ctx, x0, top, w, 34, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
    signText(ctx, `${T.short} · ${S.player.name.toUpperCase()}`, cx, top + 17, 19, '#FFF4D6', w - 20);
    for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#FFF4D6' : T.color; ctx.beginPath(); ctx.moveTo(x0 + k * 33, top + 34); ctx.lineTo(x0 + (k + 1) * 33, top + 34); ctx.lineTo(x0 + (k + 1) * 33 + 4, top + 52); ctx.lineTo(x0 + k * 33 + 4, top + 52); ctx.closePath(); ctx.fill(); }
    // đồ đạc trong tiệm
    ctx.fillStyle = 'rgba(255,220,140,.25)'; ctx.fillRect(x0 + 14, top + 56, w - 28, 72);
    T.props.forEach((ic, k) => emoji(ctx, ic, x0 + 60 + k * 80, top + 96, 30));
    ctx.fillStyle = '#8C6A4A'; ctx.fillRect(x0 + 20, top + 112, w - 40, 10);
    drawPerson(ctx, { x: cx + 110, y: ST_GROUND + 4, dir: -1, look: { ...sellerLookFor(G.clerk), scale: 0.78 }, moving: false, phase: 0 });
    for (let k = 0; k < G.bizLvl; k++) { ctx.fillStyle = '#F7C948'; ctx.beginPath(); ctx.arc(x0 + 14 + k * 14, top - 8, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#8C6A12'; ctx.lineWidth = 1.5; ctx.stroke(); }
  } else {
    ctx.fillStyle = '#E3E0D8'; rr(ctx, x0, top, w, 34, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
    signText(ctx, 'MẶT BẰNG TRỐNG · CHỌN NGÀNH NGHỀ', cx, top + 17, 15, '#7A6552', w - 20);
    ctx.fillStyle = 'rgba(255,244,214,.18)'; ctx.fillRect(x0 + 14, top + 56, w - 28, 72);
  }
  ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 10, top + 40, w - 20, 92);
  hits.push({ x: x0, y: top - 10, w, h: 152, kind: 'gian', i, pri: 1 });
}

// ---------- Sự kiện nhỏ trong khu phố ----------
// Cứ 1–2 phút lại có một chuyện xảy ra: thanh tra, khách quỵt, YouTuber, du khách, mưa, vé số, chó hoang, móc túi.
const FOOD = ['tra_da', 'kem_chuoi', 'bap', 'banh_mi', 'keo_bong', 'xoi', 'nuoc_mia', 'hot_vit'];
function eventMult(si, li) {
  let m = 1;
  const B = R.boost;
  if (B && now() < B.until && (B.si == null || B.si === si) && (B.li == null || B.li === li)) m *= B.mult;
  if (R.rain && now() < R.rain.until && li != null) { const G = S.streets[si].gians[li]; if (G && !G.du) m *= 0.5; }
  return m;
}
const myPlaced = () => S.streets[S.cur].gians.map((g, i) => ({ g, i })).filter(({ g }) => g.placed && !g.sellerAway);
const EVENTS = [
  { id: 'thanhtra', w: 8, ok: () => myPlaced().some(({ g }) => gGoods(g).some((id) => FOOD.includes(id))), run: evThanhTra },
  { id: 'quyt', w: 10, ok: () => myPlaced().some(({ g }) => gQty(g) > 2), run: evQuyt },
  { id: 'review', w: 6, ok: () => myPlaced().length > 0, run: evReview },
  { id: 'dukhach', w: 7, ok: () => myPlaced().length > 0, run: evDuKhach },
  { id: 'mua', w: 7, ok: () => myPlaced().length > 0 && !(R.rain && now() < R.rain.until), run: evMua },
  { id: 'veso', w: 9, ok: () => S.money >= 10000, run: evVeSo },
  { id: 'cho', w: 9, ok: () => myPlaced().some(({ g }) => gQty(g) > 2), run: evCho },
  { id: 'moctui', w: 8, ok: () => S.money >= 20000, run: evMocTui },
  { id: 'tromcho', w: 7, ok: () => myPlaced().length > 0, run: evTromCho },
];
function updateEvents(dt) {
  if (!R.started || R.attract || R.view !== 'street' || R.modal || R.dlg || R.trip || R.police || R.fight) return;
  R.nextEv = (R.nextEv ?? rand(40, 70)) - dt;
  if (R.nextEv > 0) return;
  R.nextEv = rand(60, 120);
  const pool = EVENTS.filter((e) => !R.actor || !['cho', 'moctui', 'tromcho'].includes(e.id)).filter((e) => e.ok());
  if (!pool.length) return;
  const total = pool.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * total;
  for (const e of pool) if ((r -= e.w) <= 0) { e.run(); return; }
}
const PEOPLE = {
  thanhtra: { skin: '#E0AC80', hair: '#1E1A1A', long: false, hat: 3, capColor: '#1F4E8C', shirt: '#E9EEF5', style: 'collar', pants: '#2F3E46', acc: 'book' },
  khach: { skin: '#C68B5E', hair: '#2B211C', long: false, hat: 2, helmet: '#2E2E33', shirt: '#E84A5F', pants: '#3D405B' },
  youtuber: { skin: '#F1C9A5', hair: '#D98E04', long: true, hat: 4, shirt: '#F7B32B', style: 'flower', pants: '#264653', acc: 'glasses' },
  huongdan: { skin: '#E0AC80', hair: '#1E1A1A', long: true, hat: 3, capColor: '#C0392B', shirt: '#2A9D8F', pants: '#231A14' },
  veso: { skin: '#C68B5E', hair: '#BBB', long: true, hat: 1, shirt: '#8E3B46', pants: '#231A14', acc: 'book' },
};
function evThanhTra() {
  const dirty = myPlaced().filter(({ g }) => g.trash > 0);
  const fine = dirty.length * (30000 + 5000 * S.level);
  const chance = clamp(0.3 + S.karma / 100, 0.1, 0.85);
  talk('Đoàn thanh tra', PEOPLE.thanhtra, [
    'Đoàn kiểm tra vệ sinh an toàn thực phẩm đây. Cho xem quầy hàng coi!',
    dirty.length ? `Trời đất, trước ${dirty.length} sạp còn rác kìa. Vậy là không đạt nha!` : 'Coi bộ quầy cũng sạch sẽ ha…',
  ], { choices: [
    { label: 'Mời kiểm tra', sub: dirty.length ? `Phạt ${fmt(Math.min(S.money, fine))}` : 'Sạch sẽ', fn: () => {
      if (!dirty.length) { changeKarma(2); addXp(8); toast('Đoàn khen sạp sạch sẽ! Uy tín tăng.', 'good'); news('Thanh tra khen sạp của bạn sạch sẽ.', 'good'); return; }
      const f = Math.min(S.money, fine); S.money -= f; S.stats.fines += f; Snd.bad(); toast(`Bị phạt vệ sinh ${fmt(f)}. Dọn rác thường xuyên nha!`, 'bad');
    } },
    { label: 'Xin bỏ qua lần này', sub: `Nhờ uy tín · ${Math.round(chance * 100)}%`, fn: () => {
      if (!dirty.length || Math.random() < chance) { toast('Đoàn cười cười rồi đi. Hú hồn!', 'good'); return; }
      const f = Math.min(S.money, fine * 2); S.money -= f; S.stats.fines += f; changeKarma(-2); Snd.bad(); toast(`Xin xỏ không được, bị phạt gấp đôi: ${fmt(f)}!`, 'bad');
    } },
  ] });
}
function evQuyt() {
  const { g, i } = pick(myPlaced().filter(({ g }) => gQty(g) > 2));
  const sl = g.slots.find((s, k) => k < slotsOpen(g) && s.qty > 0);
  const n = Math.min(3, sl.qty), loss = n * unitPrice(g, sl.good, S.cur);
  sl.qty -= n;
  const chance = clamp(0.45 + stat('health') * 0.04, 0.2, 0.9);
  talk(g.seller?.name || 'Người bán', sellerLookFor(g.seller), [`Trời ơi! Ông khách ăn ${n} ${GOODS[sl.good].name.toLowerCase()} ở ${lotName(i)} rồi lên xe vọt mất, chưa trả tiền!`], { choices: [
    { label: 'Rượt theo', sub: `3 sức · ${Math.round(chance * 100)}%`, fn: () => {
      if (!useEnergy(3)) return;
      if (Math.random() < chance) { g.cash += loss; addXp(10); changeKarma(1); Snd.coin(); toast(`Rượt kịp, ông khách xin lỗi rồi trả đủ ${fmt(loss)}!`, 'good'); }
      else { Snd.bad(); toast('Chạy hụt hơi mà không kịp. Mất trắng!', 'bad'); }
    } },
    { label: 'Thôi kệ', sub: `Mất ${fmt(loss)}`, fn: () => toast('Thôi coi như làm phước.') },
  ] });
}
function evReview() {
  const { g, i } = pick(myPlaced());
  talk('YouTuber ẩm thực', PEOPLE.youtuber, [`Hello cả nhà! Hôm nay mình review ${g.seller?.name ? 'sạp của ' + g.seller.name : 'sạp này'} ở ${lotName(i)} nè. Cho xin quay một clip nha!`], { choices: [
    { label: 'Mời ăn thử miễn phí', sub: 'Mất 3 món · bán ×3 trong 3 phút', fn: () => {
      const sl = g.slots.find((s, k) => k < slotsOpen(g) && s.qty > 0); if (sl) sl.qty = Math.max(0, sl.qty - 3);
      R.boost = { si: S.cur, li: i, mult: 3, until: now() + 180000 }; addXp(6); toast(`Clip lên xu hướng! ${lotName(i)} bán gấp 3 trong 3 phút.`, 'gold');
    } },
    { label: 'Cứ quay đi', sub: 'Bán ×2 trong 3 phút', fn: () => { R.boost = { si: S.cur, li: i, mult: 2, until: now() + 180000 }; toast(`Có người coi clip tìm tới, ${lotName(i)} bán gấp đôi 3 phút.`, 'good'); } },
  ] });
}
function evDuKhach() {
  R.boost = { si: S.cur, li: null, mult: 2, until: now() + 90000 };
  for (let k = 0; k < 8; k++) R.walkers.push({ x: R.cam - 40 - k * 50, y: rand(ST_WALK.y0 + 10, ST_WALK.y1), dir: 1, look: { ...makeLook(), hat: 4, skin: pick(['#F6D7C3', '#EFC3A4']), hair: pick(['#D9B26F', '#A0522D']) }, speed: rand(55, 80), phase: rand(0, 6), moving: true });
  talk('Hướng dẫn viên', PEOPLE.huongdan, ['Cả đoàn du khách dừng chân ở đây nha! Ai muốn ăn vặt, mua quà thì ghé mấy sạp này!'], { onDone: () => toast('Đoàn du khách tới! Cả khu phố bán gấp đôi trong 1 phút rưỡi.', 'gold') });
}
function evMua() {
  R.rain = { until: now() + 120000 };
  const noDu = myPlaced().filter(({ g }) => !g.du);
  const cost = noDu.length * 20000;
  talk('Trời đổ mưa', playerLook(), ['Mây đen kéo tới, mưa rào rồi! Sạp nào không có dù che thì khách chạy hết.'], { choices: [
    ...(noDu.length ? [{ label: `Mua bạt che ${noDu.length} sạp`, sub: fmt(cost), fn: () => { if (S.money < cost) { toast('Không đủ tiền mua bạt.', 'bad'); return; } S.money -= cost; for (const { g } of noDu) g.du = true; Snd.buy(); toast('Che bạt xong, mưa cứ mưa, bán cứ bán!', 'good'); } }] : []),
    { label: 'Chịu ướt', fn: () => toast('Mưa 2 phút, sạp không dù bán chậm một nửa.') },
  ] });
}
function evVeSo() {
  const no = randTicketNo(), id = nextDraw();
  talk('Cô bán vé số', PEOPLE.veso, [`Con ơi mua giùm cô tờ vé số đi! Tờ số <b>${no}</b> đẹp lắm, xổ lúc <b>${drawLabel(id)}</b> nè. Có gì ra quán cà phê dò số nha.`], { choices: [
    { label: `Mua tờ ${no}`, sub: fmt(TICKET_PRICE), fn: () => { if (buyTicket(no)) changeKarma(1); } },
    { label: 'Không mua', fn: () => toast('Cô vé số cười hiền rồi đi qua sạp khác.') },
  ] });
}
// ---------- Vé số: xổ mỗi 6 giờ trong game (0h, 6h, 12h, 18h); mua vé, dò số ở quán cà phê ----------
// Kết quả mỗi kỳ tính từ số kỳ nên lúc vắng mặt vẫn dò được.
const DRAW_EVERY = 6 * GHOUR, TICKET_PRICE = 10000, MAX_PENDING = 20;
const PRIZES = [
  { key: 'db', name: 'Đặc biệt', len: 6, n: 1, amt: 100000000 },
  { key: 'g1', name: 'Giải nhất', len: 5, n: 1, amt: 5000000 },
  { key: 'g3', name: 'Giải ba', len: 4, n: 2, amt: 1000000 },
  { key: 'g6', name: 'Giải sáu', len: 3, n: 3, amt: 300000 },
  { key: 'g8', name: 'Giải tám', len: 2, n: 4, amt: 100000 },
];
const lastDraw = () => Math.floor(gameNow() / DRAW_EVERY);   // kỳ vừa xổ gần nhất
const nextDraw = () => lastDraw() + 1;                        // kỳ đang bán vé, xổ lúc nextDraw() * DRAW_EVERY
function drawLabel(id) {
  const t = id * DRAW_EVERY, h = Math.round(((t % GDAY) + GDAY) % GDAY / GHOUR);
  return `${h}h ngày ${Math.floor(t / GDAY) - (S.day0 || 0) + 1}`;
}
function drawResult(id) {
  const r = mulberry32(id * 99991 + 7);
  const num = (len) => String(Math.floor(r() * 10 ** len)).padStart(len, '0');
  const res = {};
  for (const P of PRIZES) res[P.key] = Array.from({ length: P.n }, () => num(P.len));
  return res;
}
// giải cao nhất mà tờ vé trúng (so đuôi số), không trúng thì null
function ticketPrize(no, res) {
  for (const P of PRIZES) if (res[P.key].includes(no.slice(-P.len))) return P;
  return null;
}
const randTicketNo = () => String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
const pendingTickets = () => (S.tickets || []).filter((k) => !k.done);
function buyTicket(no) {
  if (!/^\d{6}$/.test(no)) { toast('Số vé phải đủ 6 chữ số.', 'bad'); return false; }
  if (S.money < TICKET_PRICE) { toast('Không đủ 10.000đ mua vé.', 'bad'); Snd.bad(); return false; }
  if (pendingTickets().length >= MAX_PENDING) { toast(`Đang giữ ${MAX_PENDING} tờ chờ xổ rồi, mua nữa ôm không xuể!`, 'bad'); return false; }
  const draw = nextDraw();
  if (S.tickets.some((k) => k.no === no && k.draw === draw)) { toast(`Đã có tờ ${no} kỳ này rồi.`); return false; }
  S.money -= TICKET_PRICE;
  S.tickets.push({ no, draw });
  Snd.buy();
  toast(`Mua tờ <b>${no}</b>, xổ lúc ${drawLabel(draw)}. Ra quán cà phê dò số nha!`, 'good');
  return true;
}
// dò các tờ đã tới giờ xổ, trúng thì nhận tiền liền
function checkDraws() {
  const last = lastDraw();
  let won = 0, n = 0;
  for (const k of S.tickets || []) {
    if (k.done || k.draw > last) continue;
    const P = ticketPrize(k.no, drawResult(k.draw));
    k.done = true; k.win = P ? P.amt : 0; k.prize = P ? P.name : '';
    n++;
    if (P) {
      won += P.amt;
      news(`Tờ vé số <b>${k.no}</b> kỳ ${drawLabel(k.draw)} trúng <b>${P.name}</b>: ${fmt(P.amt)}!`, 'good');
    }
  }
  if (!n) return;
  if (won) { S.money += won; S.stats.earned += won; S.flags.lottoWin = (S.flags.lottoWin || 0) + 1; Snd.level(); toast(`Xổ số rồi! Bạn trúng tổng cộng <b>${fmt(won)}</b>!`, 'gold'); }
  else if (R.started) toast(`Xổ số kỳ ${drawLabel(last)} rồi, ${n} tờ của bạn trật hết. Lần sau may hơn!`);
  // chỉ giữ vé của vài kỳ gần nhất
  S.tickets = S.tickets.filter((k) => !k.done || k.draw > last - 3).slice(-40);
  if (R.modal === 'veso') refreshModal();
}
function vesoHTML() {
  const tab = R.vsTab || 'buy';
  const nd = nextDraw(), left = Math.max(0, nd * DRAW_EVERY - gameNow());
  const lh = Math.floor(left / GHOUR), lm = Math.floor((left % GHOUR) / GMIN);
  const tabs = [['buy', 'Mua vé'], ['mine', `Vé của tôi (${pendingTickets().length})`], ['kq', 'Kết quả xổ số']]
    .map(([k, n]) => `<button class="fun-tab${tab === k ? ' on' : ''}" data-vstab="${k}">${n}</button>`).join('');
  let body = '';
  if (tab === 'buy') {
    R.vsOffer ||= Array.from({ length: 8 }, randTicketNo);
    body = `<p class="event-text">Cô Năm vé số có xấp vé kỳ <b>${drawLabel(nd)}</b>. Chọn tờ nào ưng bụng thì mua, mỗi tờ ${fmt(TICKET_PRICE)}. Muốn số riêng thì gõ vào ô bên dưới.</p>
      <div class="tickets">${R.vsOffer.map((no) => { const has = S.tickets.some((k) => k.no === no && k.draw === nd); return `<button class="ticket${has ? ' owned' : ''}" data-ticket="${no}" ${has ? 'disabled' : ''}><small>XỔ SỐ VỈA HÈ</small><b>${no.slice(0, 3)} ${no.slice(3)}</b><small>${has ? 'Đã mua' : `Kỳ ${drawLabel(nd)} · 10k`}</small></button>`; }).join('')}</div>
      <div class="btn-row vs-own"><button class="btn paper" data-vs="shuffle">Xem xấp khác</button>
        <label class="name-field" for="vs-own">Tự chọn số<input id="vs-own" maxlength="6" inputmode="numeric" autocomplete="off" placeholder="6 chữ số" /></label>
        <button class="btn" data-vs="own">Mua số này</button></div>`;
  } else if (tab === 'mine') {
    const list = [...(S.tickets || [])].reverse();
    body = list.length ? `<div class="pick-grid">${list.map((k) => `<div class="pick ${k.done ? (k.win ? 'won' : 'lost') : ''}"><span class="pi">🎫</span><span><b>${k.no}</b><small>Kỳ ${drawLabel(k.draw)} · ${!k.done ? 'chờ xổ' : k.win ? `trúng ${k.prize} ${fmt(k.win)}` : 'trật'}</small></span></div>`).join('')}</div>`
      : '<p class="empty-note">Chưa có tờ nào. Mua thử một tờ cầu may đi!</p>';
  } else {
    const ids = [lastDraw(), lastDraw() - 1, lastDraw() - 2];
    body = ids.map((id) => { const res = drawResult(id); return `<div class="kq"><b class="kq-title">Kỳ ${drawLabel(id)}</b>${PRIZES.map((P) => `<div class="kq-row"><span>${P.name}</span><b class="${P.key === 'db' ? 'db' : ''}">${res[P.key].join(' · ')}</b><small>${fmtK(P.amt)}</small></div>`).join('')}</div>`; }).join('');
    body = `<p class="event-text">So đuôi số trên vé với các giải. Trúng giải nào thì tiền tự cộng vào túi lúc xổ.</p><div class="kq-list">${body}</div>`;
  }
  return `<div class="fun-head"><div class="fun-tabs">${tabs}</div><span class="fun-net">Kỳ tới xổ lúc <b>${drawLabel(nd)}</b> · còn ${lh} giờ ${lm} phút</span></div>${body}
    <p class="fun-note">Xổ mỗi 6 giờ trong game (0h, 6h, 12h, 18h). Một ngày trong game dài 24 phút ngoài đời.</p>`;
}
function openVeso(tab) { R.vsTab = tab || 'buy'; R.vsOffer = null; openModal('Vé số · Cô Năm', vesoHTML(), { kind: 'veso' }); }
function onVesoClick(d) {
  if (d.vstab) { R.vsTab = d.vstab; Snd.click(); }
  else if (d.ticket) buyTicket(d.ticket);
  else if (d.vs === 'shuffle') { R.vsOffer = null; Snd.click(); }
  else if (d.vs === 'own') { const v = ($('vs-own')?.value || '').trim(); buyTicket(v); }
  refreshModal();
}
// chó hoang chạy tới tha hàng; bấm vào nó để đuổi
function evCho() {
  const { i } = pick(myPlaced().filter(({ g }) => gQty(g) > 2));
  const fromLeft = Math.random() < 0.5;
  R.actor = { type: 'cho', li: i, x: fromLeft ? R.cam - 60 : R.cam + W + 60, y: Math.min(lotBase(i) + 16, ST_WALK.y1), dir: fromLeft ? 1 : -1, t: 0, phase: 0 };
  toast(`Có con chó hoang đang chạy về phía ${lotName(i)}! Bấm vào nó để đuổi.`, 'bad');
  Snd.tone(300, 0.15, 'sawtooth', 0.04); Snd.tone(260, 0.15, 'sawtooth', 0.04, 0.18);
}
// kẻ móc túi lân la lại gần nhân vật; bấm vào hắn để bắt
function evMocTui() {
  const fromLeft = R.me.x > SW / 2;
  R.actor = { type: 'moctui', x: fromLeft ? R.cam - 60 : R.cam + W + 60, y: R.me.y, dir: fromLeft ? 1 : -1, t: 0, phase: 0 };
  toast('Có thằng đội nón trùm đầu đang lân la lại gần… coi chừng móc túi! Bấm vào hắn để bắt.', 'bad');
}
function updateActor(dt) {
  const A = R.actor;
  if (!A) return;
  if (R.view !== 'street') { R.actor = null; return; }
  A.t += dt; A.phase += dt * 14;
  if (A.type === 'tromcho') return updateDogThief(A, dt);
  if (A.state === 'flee') { A.x += A.dir * 420 * dt; if (A.x < R.cam - 120 || A.x > R.cam + W + 120) R.actor = null; return; }
  const tx = A.type === 'cho' ? lotX(A.li) + 30 : R.me.x - A.dir * 30;
  const ty = A.type === 'cho' ? A.y : R.me.y;
  const dx = tx - A.x, dy = ty - A.y, d = Math.hypot(dx, dy);
  const sp = A.type === 'cho' ? 170 : 110;
  if (d > 6) { const s = Math.min(1, (sp * dt) / d); A.x += dx * s; A.y += dy * s; A.dir = Math.sign(dx) || A.dir; return; }
  // tới nơi
  if (A.type === 'cho') {
    const G = S.streets[S.cur].gians[A.li];
    let lost = 0;
    for (const sl of G.slots) if (sl.qty > 0 && lost < 3) { const n = Math.min(3 - lost, sl.qty); sl.qty -= n; lost += n; }
    Snd.bad(); toast(`Con chó tha mất ${lost} món ở ${lotName(A.li)} rồi chạy mất!`, 'bad');
  } else {
    const n = Math.min(200000, Math.round(S.money * 0.05));
    S.money -= n; Snd.bad(); toast(`Bị móc túi mất ${fmt(n)}! Lần sau để ý xung quanh nha.`, 'bad'); news(`Bạn bị móc túi mất ${fmt(n)} ở ${kpLabel(S.cur)}.`, 'bad');
  }
  A.state = 'flee'; A.dir = A.x < SW / 2 ? -1 : 1;
}
function catchActor() {
  const A = R.actor;
  if (!A || A.state === 'flee') return;
  if (A.type === 'tromcho') return catchDogThief(A);
  if (A.type === 'cho') { if (!useEnergy(1)) return; addXp(3); toast('Xùy xùy! Đuổi được con chó hoang.', 'good'); }
  else { S.money += 20000; changeKarma(2); addXp(8); Snd.coin(); toast('Tóm được thằng móc túi! Bà con thưởng nóng 20.000đ.', 'good'); news('Bạn bắt được một tên móc túi ở khu phố.', 'good'); }
  A.state = 'flee'; A.dir = A.x < R.me.x ? -1 : 1;
}
function drawActor(layer, hits) {
  const A = R.actor;
  if (!A) return;
  if (A.type === 'tromcho') return drawDogThief(A, layer, hits);
  if (A.type === 'cho') {
    layer.push({ y: A.y, draw: () => {
      ctx.save(); ctx.translate(A.x, A.y); ctx.scale(A.dir, 1);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 5, 0, 0, 7); ctx.fill();
      const leg = Math.sin(A.phase) * 5;
      ctx.strokeStyle = '#7B4B2A'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-14 + leg, -2); ctx.moveTo(14, -16); ctx.lineTo(14 - leg, -2); ctx.stroke();
      ctx.fillStyle = '#9C6B3F'; ctx.beginPath(); ctx.ellipse(0, -22, 22, 11, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(22, -30, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#7B4B2A'; ctx.beginPath(); ctx.ellipse(20, -40, 4, 7, -0.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#9C6B3F'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, -24); ctx.quadraticCurveTo(-32, -38 + Math.sin(A.phase) * 4, -30, -44); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(26, -32, 1.8, 0, 7); ctx.fill();
      ctx.restore();
      if (A.state !== 'flee') bubble('Gâu gâu!', A.x, A.y - 56, { size: 13 });
    } });
    hits.push({ x: A.x - 40, y: A.y - 60, w: 80, h: 66, kind: 'actor', pri: 4 });
  } else {
    const look = { skin: '#C68B5E', hair: '#1E1A1A', long: false, hat: 3, capColor: '#2E2E33', shirt: '#3A3A40', pants: '#2F3E46', scale: 0.95 };
    layer.push({ y: A.y, draw: () => { drawPerson(ctx, { x: A.x, y: A.y, dir: A.dir, look: { ...look, scale: 0.95 * personBase() * depthScale(A.y) }, moving: true, phase: A.phase }); if (A.state !== 'flee') bubble('…', A.x, A.y - 150, { size: 14 }); } });
    hits.push({ x: A.x - 30, y: A.y - 140, w: 60, h: 146, kind: 'actor', pri: 4 });
  }
}
// trộm chó: hai thằng chạy xe máy rề rề tới, thòng lọng bắt con chó của hàng xóm đang nằm trên vỉa hè.
// Bấm vào xe trước khi tụi nó rồ ga để bắt.
function evTromCho() {
  const owner = pick(NB_BASE);
  const fromLeft = Math.random() < 0.5;
  R.actor = { type: 'tromcho', owner: owner.id, dogName: pick(['con Vàng', 'con Mực', 'con Ki', 'con Lu']), dogX: rand(320, 960), dogY: ST_WALK.y1 - 4,
    x: fromLeft ? R.cam - 160 : R.cam + W + 160, y: 606, dir: fromLeft ? 1 : -1, t: 0, phase: 0, state: 'come', hasDog: false };
  toast(`Hai thằng chạy xe rề rề, dòm chằm chằm ${R.actor.dogName} của ${owner.name}… <b>trộm chó!</b> Bấm vào xe để bắt!`, 'bad');
  Snd.siren();
}
function updateDogThief(A, dt) {
  if (A.state === 'flee') { A.x += A.dir * 480 * dt; if (A.x < R.cam - 220 || A.x > R.cam + W + 220) R.actor = null; return; }
  if (A.state === 'come') {
    const tx = A.dogX - A.dir * 50;
    A.x += A.dir * 150 * dt;
    if ((A.dir > 0 && A.x >= tx) || (A.dir < 0 && A.x <= tx)) { A.x = tx; A.state = 'grab'; A.t = 0; }
    return;
  }
  // đang thòng lọng bắt chó: hết giờ là chở chó chạy mất
  if (A.t > 3.2) {
    A.state = 'flee'; A.hasDog = true;
    const b = nbBase(A.owner);
    Snd.bad();
    toast(`Tụi trộm chó rồ ga chở ${A.dogName} chạy mất tiêu! ${b.name} khóc ròng.`, 'bad');
    news(`Trộm chó bắt mất ${A.dogName} của <b>${b.name}</b> ngay giữa ${kpLabel(S.cur)}.`, 'bad');
  }
}
function catchDogThief(A) {
  if (!useEnergy(2)) return;
  const b = nbBase(A.owner), n = nbState(A.owner);
  const chance = clamp(0.6 + stat('health') * 0.04 + S.level * 0.01, 0.3, 0.95);
  if (Math.random() < chance) {
    const reward = 40000 + 5000 * S.level;
    S.money += reward; changeKarma(3); addXp(15); n.friend = clamp(n.friend + 10, 0, 100);
    S.flags.dogThief = (S.flags.dogThief || 0) + 1;
    Snd.level();
    toast(`Túm cổ được thằng trộm chó! ${b.name} ôm ${A.dogName} mừng rơn, bà con thưởng nóng ${fmt(reward)}.`, 'gold');
    news(`Bạn bắt được tụi trộm chó, cứu ${A.dogName} của <b>${b.name}</b>. Cả phố khen!`, 'good');
    A.hasDog = false;
  } else {
    Snd.bad();
    A.hasDog = A.state === 'grab';
    toast(A.hasDog ? `Hụt tay! Tụi nó rồ ga chở ${A.dogName} chạy mất.` : 'Hụt tay! Tụi nó hoảng quá rồ ga bỏ chạy, chó còn nguyên.', 'bad');
    if (A.hasDog) news(`Trộm chó bắt mất ${A.dogName} của <b>${b.name}</b>, bạn rượt không kịp.`, 'bad');
  }
  A.state = 'flee';
}
function drawDog(x, y, dir, phase, sit) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 5, 0, 0, 7); ctx.fill();
  const leg = sit ? 0 : Math.sin(phase) * 5;
  ctx.strokeStyle = '#B8862F'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-14 + leg, -2); ctx.moveTo(14, -16); ctx.lineTo(14 - leg, -2); ctx.stroke();
  ctx.fillStyle = '#E0A84A'; ctx.beginPath(); ctx.ellipse(0, -20, 22, 11, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(22, -30, 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#B8862F'; ctx.beginPath(); ctx.ellipse(20, -40, 4, 7, -0.4, 0, 7); ctx.fill();
  ctx.strokeStyle = '#E0A84A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, -22); ctx.quadraticCurveTo(-32, -36 + Math.sin(phase) * 4, -30, -42); ctx.stroke();
  ctx.fillStyle = '#C0392B'; ctx.fillRect(14, -26, 10, 3);   // vòng cổ đỏ: chó có chủ
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(26, -32, 1.8, 0, 7); ctx.fill();
  ctx.restore();
}
function drawDogThief(A, layer, hits) {
  if (!A.hasDog) {
    layer.push({ y: A.dogY, draw: () => {
      drawDog(A.dogX, A.dogY, A.state === 'grab' ? -A.dir : 1, A.phase, A.state !== 'grab');
      if (A.state === 'grab') bubble('Ẳng ẳng!', A.dogX, A.dogY - 56, { size: 13 });
    } });
  }
  layer.push({ y: A.y, draw: () => {
    drawBike(ctx, { x: A.x, y: A.y, dir: A.dir, color: '#2E2E33', rider: { skin: '#C68B5E', shirt: '#3A3A40', helmet: '#2E2E33' }, pass: { shirt: '#5C4D3C', helmet: '#3A3A40' }, cargo: false });
    if (A.hasDog) drawDog(A.x - A.dir * 54, A.y - 46, A.dir, A.phase, true);
    if (A.state === 'grab' && !A.hasDog) {
      // cây thòng lọng chìa ra phía con chó
      ctx.strokeStyle = '#6B4F3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(A.x - A.dir * 24, A.y - 80); ctx.lineTo(A.dogX, A.dogY - 40); ctx.stroke();
      ctx.strokeStyle = '#C9A06A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(A.dogX + 4, A.dogY - 30, 9, 0, 7); ctx.stroke();
    }
    if (A.state !== 'flee') bubble(A.state === 'grab' ? 'Lẹ lên mày!' : 'Con đó mập nè…', A.x, A.y - 124, { size: 14, bg: '#F9C9C0' });
    else if (A.hasDog) bubble('Chạy!', A.x, A.y - 124, { size: 14 });
  } });
  if (A.state !== 'flee') hits.push({ x: A.x - 80, y: A.y - 130, w: 160, h: 140, kind: 'actor', pri: 4 });
}
function drawRain() {
  if (!R.rain || now() >= R.rain.until || !isStreetView()) return;
  ctx.strokeStyle = 'rgba(210,222,240,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let k = 0; k < 140; k++) { const x = ((k * 97 + R.t * 220) % (W + 200)) - 100 + R.cam, y = (k * 53 + R.t * 820) % H; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 18); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,50,70,.18)'; ctx.fillRect(R.cam, 0, W, H);
}

// ---------- Sạp: cất sẵn (S.bike) hoặc đang bày ngoài lô ----------
const UNIT_FIELDS = ['stall', 'slots', 'du', 'ghe', 'bang', 'phep', 'broken', 'seller'];
const UNIT_PRICE = (n) => Math.round((30000 * Math.pow(1.6, n)) / 1000) * 1000;
const MAX_UNITS = 24;
function randomSeller() { const f = Math.random() < 0.55; return { f, name: pick(SELLER_NAMES[f ? 'f' : 'm']), seed: Math.floor(Math.random() * 9999) }; }
function newUnit(stall = 'ganh') { return { stall, slots: emptySlots(), du: false, ghe: false, bang: false, phep: false, broken: false, seller: randomSeller() }; }
function sellerLookFor(sel) {
  if (!sel) return sellerLook(0, 0);
  const r = mulberry32(sel.seed + 13);
  return { skin: ['#E0AC80', '#F1C9A5', '#C68B5E'][Math.floor(r() * 3)], hair: sel.f ? pick2(r, ['#1E1A1A', '#3B2A20']) : '#1E1A1A', long: sel.f, hat: sel.f ? (r() < 0.7 ? 1 : 0) : (r() < 0.6 ? 3 : 2),
    capColor: pick2(r, ['#C0392B', '#1F6F8B', '#2E2E33']), helmet: pick2(r, HELMETS), shirt: pick2(r, SELLER_SHIRTS.concat(['#E84A5F', '#F7B32B'])), style: sel.f ? undefined : (r() < 0.4 ? 'tank' : undefined), pants: '#231A14', scale: 1.05 };
}
function pick2(r, a) { return a[Math.floor(r() * a.length)]; }
const unitQty = (u) => u.slots.reduce((a, s, k) => a + (k < SLOT_OPEN[u.stall] ? s.qty : 0), 0);
const unitGoods = (u) => [...new Set(u.slots.filter((s, k) => k < SLOT_OPEN[u.stall] && s.qty > 0).map((s) => s.good))];
function totalUnits() { return S.bike.length + allGians().filter(({ g }) => g.placed).length; }
// si: khu phố sạp đang/ sắp bày, để ưu tiên món hợp gu khu đó
function fillUnit(u, si) {
  let did = 0;
  const gu = (id) => (si != null && themeHit(si, id) ? 1 : 0);
  const profit = (id) => (GOODS[id].sell - GOODS[id].buy) / GOODS[id].t;
  for (let k = 0; k < SLOT_OPEN[u.stall]; k++) {
    const s = u.slots[k], cap = SLOT_CAP[u.stall];
    if (s.qty > 0) { if (S.kho[s.good] && s.qty < cap) { const n = Math.min(cap - s.qty, S.kho[s.good]); s.qty += n; S.kho[s.good] -= n; if (!S.kho[s.good]) delete S.kho[s.good]; did += n; } continue; }
    const inU = unitGoods(u);
    const cands = Object.keys(S.kho).filter((id) => S.kho[id] > 0).sort((a, b) => (inU.includes(a) - inU.includes(b)) || gu(b) - gu(a) || profit(b) - profit(a));
    if (!cands.length) break;
    const id = cands[0], n = Math.min(cap, S.kho[id]);
    s.good = id; s.qty = n; s.prog = 0; S.kho[id] -= n; if (!S.kho[id]) delete S.kho[id];
    did += n;
  }
  return did;
}
function clearUnit(u) {
  let n = 0;
  for (const s of u.slots) {
    if (!s.qty) continue;
    const m = Math.min(khoCap() - khoCount(), s.qty);
    if (m <= 0) break;
    S.kho[s.good] = (S.kho[s.good] || 0) + m; s.qty -= m; n += m;
  }
  return n;
}
// đem sạp đang cất ra lô: người bán chạy từ chỗ mình đứng tới lô rồi đứng rao
function placeUnit(k, si, li) {
  const G = S.streets[si].gians[li];
  if (!G.open || G.placed) return;
  const u = S.bike.splice(k, 1)[0];
  if (!u) return;
  if (!unitQty(u)) fillUnit(u, si);
  for (const f of UNIT_FIELDS) G[f] = u[f];
  G.placed = true; G.cash = 0; G.pausedUntil = 0; G.sellerAway = true;
  R.runners.push({ si, li, x: R.me.x, y: Math.min(R.me.y, ST_WALK.y1 - 2), look: sellerLookFor(G.seller), name: G.seller.name, dir: 1, phase: 0, moving: true });
  Snd.buy();
  toast(`${G.seller.name} ôm ${STALLS[G.stall].name.toLowerCase()} chạy ra ${lotName(li)}!`, 'good');
  if (!unitQty(G)) toast('Sạp chưa có hàng, kho cũng trống. Ra chợ đầu mối gom hàng đi!', 'bad');
  questProgress('place');
  renderCtx();
}
function pickupUnit(si, li) {
  const G = S.streets[si].gians[li];
  if (!G.placed) return;
  if (S.bike.length + 1 > MAX_UNITS) return;
  collect(si, li, true);
  const u = {};
  for (const f of UNIT_FIELDS) u[f] = G[f];
  S.bike.push(u);
  G.placed = false; G.slots = emptySlots(); G.stall = 'ganh'; G.du = G.ghe = G.bang = G.phep = G.broken = false; G.seller = null; G.sellerAway = false;
  R.runners = R.runners.filter((r) => !(r.si === si && r.li === li));
  delete R.cries[si + '-' + li];
  Snd.click(); toast('Đã cất sạp. Bấm lô trống nào cũng bày lại được.');
}
function updateRunners(dt) {
  for (const r of R.runners) {
    const tx = lotX(r.li) + 40, ty = Math.min(lotBase(r.li) + 18, ST_WALK.y1);
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
    if (d < 4) {
      r.done = true;
      const G = S.streets[r.si]?.gians[r.li];
      if (G && G.placed) {
        G.sellerAway = false;
        R.cries[r.si + '-' + r.li] = { text: G.seller.f ? 'Có cô đây! Bán hàng đây bà con ơi!' : 'Có anh lo! Ghé coi đi bà con ơi!', t: 3.2 };
      }
    } else { const s = Math.min(1, (320 * dt) / d); r.x += dx * s; r.y += dy * s; r.dir = Math.sign(dx) || r.dir; r.phase += dt * 14; }
  }
  R.runners = R.runners.filter((r) => !r.done);
  // tiếng rao của người bán
  for (const k of Object.keys(R.cries)) { R.cries[k].t -= dt; if (R.cries[k].t <= 0) delete R.cries[k]; }
  if (R.view !== 'street') return;
  S.streets[S.cur].gians.forEach((G, li) => {
    if (!G.placed || G.sellerAway || !gQty(G) || G.broken || G.pausedUntil > now()) return;
    const key = S.cur + '-' + li;
    if (!R.cries[key] && Math.random() < dt / 11) {
      const gl = gGoods(G);
      R.cries[key] = { text: CRIES[pick(gl)] || 'Ghé coi đi bà con ơi!', t: 3 };
    }
  });
}
const CRIES = {
  tra_da: 'Trà đá mát lạnh đâyyy!', kem_chuoi: 'Kem chuối mát rượi đây!', bap: 'Bắp luộc nóng hổi đây!', banh_mi: 'Bánh mì nóng giòn đâyyy!',
  keo_bong: 'Kẹo bông gòn đây các bé ơi!', xoi: 'Xôi nóng đây! Xôi gấc xôi đậu!', nuoc_mia: 'Nước mía siêu sạch đây!', hot_vit: 'Hột vịt lộn nóng hổi đâyyy!',
  do_choi: 'Đồ chơi rẻ bất ngờ nè!', non: 'Nón đẹp che nắng đây!', ao_thun: 'Áo thun đồng giá đây!', giay: 'Giày bata xịn, giá bèo!',
  kinh: 'Kính mát thời trang đây!', tui: 'Túi xách hàng hiệu… giá vỉa hè!',
};

// ---------- Tủ sạp trên xe máy (như ảnh game gốc) ----------
const thumbCache = {};
function stallThumb(u) {
  const icons = unitGoods(u).map((id) => GOODS[id].icon);
  const key = u.stall + '|' + icons.join('') + (u.du ? 'd' : '');
  if (thumbCache[key]) return thumbCache[key];
  const c = document.createElement('canvas'); c.width = 240; c.height = 200;
  const g = c.getContext('2d');
  g.translate(120 - STALL_X * 0.62, 192 - STALL_Y * 0.62); g.scale(0.62, 0.62);
  drawStallFrame(g, { stall: u.stall, icons: icons.length ? Array.from({ length: 8 }, (_, k) => icons[k % icons.length]) : [], open: icons.length > 0, look: null, du: u.du, ghe: false, bang: false, label: icons.length > 1 ? 'TẠP HÓA' : icons.length ? GOODS[unitGoods(u)[0]].name.toUpperCase() : 'HÀNG RONG' });
  return (thumbCache[key] = c.toDataURL());
}
// Bấm vào lô trống: chọn sạp đang cất để bày ra, hoặc mua sạp mới bày luôn
function lotHTML(si, li) {
  const n = totalUnits(), price = UNIT_PRICE(Math.max(0, n - 1)), full = n >= MAX_UNITS;
  const cells = S.bike.map((u, k) => {
    const q = unitQty(u), cap = SLOT_OPEN[u.stall] * SLOT_CAP[u.stall];
    return `<button class="slot-cell unit" data-lotput="${k}"><img src="${stallThumb(u)}" alt="" /><b>${STALLS[u.stall].name}</b><span class="meter"><i style="width:${(q / cap) * 100}%"></i></span><small>${q}/${cap} món · ${u.seller.name}</small></button>`;
  }).join('');
  return `<p class="event-text">${lotName(li)[0].toUpperCase() + lotName(li).slice(1)} đang trống. Chọn một sạp có sẵn để bày ra đây, hoặc mua sạp mới. Người bán sẽ chạy ra rao hàng giùm bạn.</p>
    ${S.bike.length ? `<p class="sec-title">Sạp có sẵn · ${S.bike.length}</p><div class="cab-grid lot-pick">${cells}</div>` : '<p class="empty-note">Chưa có sạp nào rảnh. Mua một đôi gánh mới để bày nha.</p>'}
    <div class="btn-row"><button class="btn green" data-act="lotbuy" ${S.money >= price && !full ? '' : 'disabled'}>Mua gánh mới, bày ra đây · ${fmt(price)}</button>${full ? `<small>Đã đủ ${MAX_UNITS} sạp.</small>` : ''}</div>`;
}
function openLot(si, li) { openModal(`Lô trống · ${lotName(li)} · ${kpLabel(si)}`, lotHTML(si, li), { kind: 'lot', arg: [si, li] }); }
function onLotAct(d, si, li) {
  if (d.lotput !== undefined) { closeModal(); placeUnit(Number(d.lotput), si, li); return true; }
  if (d.act === 'lotbuy') {
    const n = totalUnits(), price = UNIT_PRICE(Math.max(0, n - 1));
    if (S.money < price || n >= MAX_UNITS) return true;
    S.money -= price; S.bike.push(newUnit());
    closeModal(); placeUnit(S.bike.length - 1, si, li);
    return true;
  }
  return false;
}

// ---------- Bày tự động ----------
// Đem hết sạp trên xe ra các lô trống (ưu tiên khu phố đang đứng), rồi châm đầy hàng cho mọi sạp đang bày.
function placeUnitDirect(u, si, li) {
  const G = S.streets[si].gians[li];
  if (!unitQty(u)) fillUnit(u, si);
  for (const f of UNIT_FIELDS) G[f] = u[f];
  G.placed = true; G.cash = 0; G.pausedUntil = 0; G.sellerAway = false;
}
function autoPlaceAll(quiet) {
  let placed = 0;
  const order = [S.cur, ...Array.from({ length: S.streets.length }, (_, k) => k).filter((k) => k !== S.cur)];
  for (const si of order) {
    S.streets[si].gians.forEach((G, li) => {
      if (!S.bike.length || !G.open || G.placed || isShopLot(si, li)) return;
      if (si === S.cur && R.view === 'street' && !quiet) placeUnit(0, si, li);
      else placeUnitDirect(S.bike.shift(), si, li);
      placed++;
    });
  }
  // châm hàng cho các sạp đang bày
  let filled = 0;
  for (const { g, si } of allGians()) if (g.placed && !g.broken) filled += fillUnit(g, si);
  if (!quiet) {
    if (placed || filled) { Snd.buy(); toast(`Bày tự động: ${placed} sạp ra lô, châm thêm ${filled} món hàng.`, 'good'); }
    else toast(S.bike.length ? 'Hết lô trống. Thuê thêm lô đi!' : khoCount() ? 'Sạp nào cũng đầy hàng rồi.' : 'Kho trống, lên chợ đầu mối gom hàng trước đã.', 'bad');
    if (placed) questProgress('place');
  }
  renderCtx();
  return { placed, filled };
}

// ---------- Bảng thử nghiệm (dành cho bản test) ----------
function loadMock() {
  S.quest = 'done'; S.level = 12; S.xp = 0;
  S.money = 5000000; S.debt = 0;
  S.khoLvl = Math.max(S.khoLvl, 3);
  S.kho = {};
  for (const id of GOOD_IDS) if (GOODS[id].lvl <= S.level) S.kho[id] = 40;
  for (let si = 0; si < 3; si++) S.streets[si].gians.forEach((g) => { g.open = true; });
  const types = ['ganh', 'xe_day', 'sap', 'kiot'];
  for (const { g } of allGians()) if (g.placed) { g.placed = false; g.slots = emptySlots(); g.seller = null; }
  S.bike = Array.from({ length: 14 }, (_, k) => newUnit(types[k % 4]));
  S.bike.forEach((u, k) => { u.du = k % 2 === 0; u.ghe = k % 3 === 0; u.phep = k % 4 === 0; });
  S.fishing.rods = Object.keys(RODS); S.fishing.rod = 'carbon';
  for (const id of Object.keys(BAITS)) S.fishing.bait[id] = 50;
  S.owned = Object.keys(FASHION);
  S.outfit = { hat: 'non_ket', shirt: 'ao_hoa', pants: 'quan_jean', shoes: 'giay_bata', acc: 'khan_ran' };
  for (const n of S.neighbors) n.friend = Math.max(n.friend, 60);
  S.energy = energyMax();
  R.runners = []; R.cries = {};
  const r = autoPlaceAll(true);
  for (const id of GOOD_IDS) if (GOODS[id].lvl <= S.level) S.kho[id] = 40;   // bày xong thì nạp lại kho
  save(); renderDock(); refreshModal();
  toast(`Đã nạp dữ liệu thử: 5 triệu, cấp 12, kho đầy hàng, thuê sẵn 3 khu phố, ${r.placed} sạp đã bày ra lô.`, 'gold');
}
function mockHTML() {
  const onStreet = R.view === 'street';
  const b = (act, label, sub, dis) => `<button class="btn paper" data-mock="${act}" ${dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
  return `<p class="event-text">Công cụ cho bản thử nghiệm. Các nút này sửa thẳng vào bản lưu trên máy, chơi thật thì đừng bấm nha.</p>
    <div class="mock-grid">
      <button class="btn big" data-mock="load">Nạp dữ liệu thử<small>Ghi đè tiến trình hiện tại</small></button>
      ${b('money', '+1.000.000đ')}${b('level', 'Lên 1 cấp')}${b('energy', 'Hồi đầy sức')}${b('kho', 'Kho đầy hàng', 'Mỗi món 40')}
      ${b('police', 'Công an tới', 'Đứng ở khu phố', !onStreet)}${b('thug', 'Dân anh chị tới')}${b('spill', 'Xe đổ hàng', 'Đứng ở khu phố', !onStreet)}
      ${b('nb', 'Hàng xóm quậy')}${b('time', 'Tua 10 phút', 'Hàng bán như lúc vắng')}${b('auto', 'Bày tự động')}
      ${b('event', 'Sự kiện ngẫu nhiên', 'Đứng ở khu phố', !onStreet)}${b('tromcho', 'Trộm chó tới', 'Đứng ở khu phố', !onStreet)}${b('clock', 'Tua 6 giờ trong game', 'Xổ vé số, qua giờ khác')}${b('review', 'Khách góp ý', 'Thêm một góp ý mới')}${b('shopkp', 'Mở tới phố mặt tiền', 'Thuê KP1–KP5, cấp 15, +20 triệu')}
      ${b('look', S.flags.oldLook ? 'Bật nhân vật vẽ sẵn' : 'Tắt nhân vật vẽ sẵn', S.flags.oldLook ? 'Đang dùng dáng chibi cũ' : 'Quay về dáng chibi cũ')}
      <button class="btn red" data-mock="reset">Xóa bản lưu, chơi lại</button>
    </div>`;
}
function openMock() { openModal('Bảng thử nghiệm', mockHTML(), { kind: 'mock' }); }
function onMockAct(act) {
  switch (act) {
    case 'load': loadMock(); return;
    case 'look': S.flags.oldLook = !S.flags.oldLook; save(); refreshModal(); return;
    case 'money': S.money += 1000000; toast('+1.000.000đ', 'good'); break;
    case 'level': addXp(Math.max(1, xpNeed(S.level) - S.xp)); break;
    case 'energy': S.energy = energyMax(); toast('Sức đầy rồi.', 'good'); break;
    case 'kho': S.khoLvl = Math.max(S.khoLvl, 3); for (const id of GOOD_IDS) if (GOODS[id].lvl <= S.level) S.kho[id] = Math.max(S.kho[id] || 0, 40); toast('Kho đầy hàng.', 'good'); break;
    case 'police': closeModal(); if (!eligiblePolice().length) { toast('Không có sạp nào chưa có giấy phép ở đây để công an phạt.', 'bad'); return; } startPolice(); return;
    case 'thug': closeModal(); startThug(); return;
    case 'spill': closeModal(); R.spill = { phase: 'come', x: R.cam - 260, stopX: rand(420, 860), items: [], t: 0, say: null, sayT: 0, picked: 0 }; return;
    case 'nb': neighborActs(false); toast('Hàng xóm vừa ra tay, xem Tin khu phố.'); break;
    case 'time': { const before = allGians().reduce((a, x) => a + x.g.cash, 0); applyOffline(600); R.offline = null; toast(`Tua 10 phút: két các sạp có thêm ${fmt(allGians().reduce((a, x) => a + x.g.cash, 0) - before)}.`, 'good'); break; }
    case 'auto': autoPlaceAll(); break;
    case 'tromcho': closeModal(); if (R.actor) { toast('Đang có chuyện khác, chờ chút.', 'bad'); return; } evTromCho(); return;
    case 'clock': S.clockOff = (S.clockOff || 0) + DRAW_EVERY; checkDraws(); toast(`Tua tới ${gclock()} ngày ${gameDay()}.`, 'good'); renderDock(); break;
    case 'review': { const rv = makeReview(); if (!rv) { toast('Bày sạp trước đã.', 'bad'); break; } S.reviews.unshift(rv); renderTop(); toast(`💬 ${rv.who}: "${rv.text}"`); break; }
    case 'event': { closeModal(); const pool = EVENTS.filter((e) => e.ok()); if (!pool.length) { toast('Bày vài sạp ra trước đã, rồi gọi sự kiện.', 'bad'); return; } pick(pool).run(); return; }
    case 'shopkp': S.level = Math.max(S.level, 15); S.money += 20000000; for (let si = 0; si < 5; si++) S.streets[si].gians.forEach((g) => { g.open = true; }); toast('Đã mở tới Khu phố 5 (phố mặt tiền). Ra KP5 thuê tiệm thử nha!', 'gold'); renderDock(); break;
    case 'reset': try { localStorage.removeItem(SAVE_KEY); } catch { /* bỏ qua */ } closeModal(); beginGame(true); return;
  }
  save(); refreshModal();
}

// ---------- Đi lại: xe máy, đi bộ ----------
const FUEL_COST = 3000;
const BIKE_SPOT = { home: { x: 640, y: 654 }, street: { x: 110, y: 640 } };
const DEST_NAME = { home: 'Nhà riêng', market: 'Chợ đầu mối', cafe: 'Quán cà phê', fish: 'Hồ câu' };
const destName = (d) => (d.startsWith('kp') ? kpLabel(Number(d.slice(2))) : DEST_NAME[d]);
const curDest = () => (R.view === 'street' ? 'kp' + S.cur : R.view);
const spotKey = () => (R.view === 'home' ? 'home' : R.view === 'street' ? 'street' : null);
function goDest(d, opts = {}) {
  if (d === 'home') enterView('home', opts);
  else if (d.startsWith('kp')) { S.cur = Number(d.slice(2)); enterView('street', opts); }
  else if (d === 'market') enterView('market', opts);
  else if (d === 'cafe') openCafe();
  else if (d === 'fish') openPond();
}
function destsFor() {
  const all = ['home', ...Array.from({ length: KP_COUNT }, (_, k) => 'kp' + k).filter((d, k) => kpOpen(k)), 'market', 'cafe', 'fish'];
  return all.filter((d) => d !== curDest());
}
// mode: 'bike' | 'walk'
function startTrip(mode, dest) {
  if (R.trip || dest === curDest()) return;
  if (dest.startsWith('kp') && !kpOpen(Number(dest.slice(2)))) { const n = Number(dest.slice(2)); toast(`${kpLabel(n)} chưa mở. Thuê đủ 6 lô ${kpLabel(n - 1)} trước đã.`, 'bad'); return; }
  if (mode === 'bike' && S.money < FUEL_COST) { toast('Hết tiền đổ xăng, đành đi bộ vậy!', 'bad'); mode = 'walk'; }
  const realCost = mode === 'bike' ? FUEL_COST : 0;
  S.money -= realCost; S.stats.food = (S.stats.food || 0) + realCost;
  closeDialog(); closeModal();
  const k = spotKey();
  const T = { mode, dest, phase: 'go', t: 0 };
  if (mode === 'bike' && k) { T.x = BIKE_SPOT[k].x; T.y = BIKE_SPOT[k].y; R.me.hidden = true; Snd.tone(180, 0.3, 'sawtooth', 0.03); }
  else T.phase = 'card';
  R.trip = T; R.me.then = null; R.keys.clear();
}
function updateTrip(dt) {
  const T = R.trip;
  if (!T) return;
  T.t += dt;
  if (T.phase === 'go') {
    if (T.t > 0.35) T.x += dt * (260 + (T.t - 0.35) * 1100);
    if (T.x > R.cam + W + 160) { T.phase = 'card'; T.t = 0; }
  } else if (T.phase === 'card') {
    if (T.t > (T.mode === 'walk' ? 1.6 : 1.3)) {
      goDest(T.dest, { arrive: T.mode });
      const k = spotKey();
      T.phase = 'arrive'; T.t = 0;
      if (T.mode === 'bike' && k) { T.x = R.cam - 200; T.y = BIKE_SPOT[k].y; R.me.hidden = true; }
      else { R.trip = null; R.me.hidden = false; arrivedMsg(T); }
    }
  } else if (T.phase === 'arrive') {
    const tx = BIKE_SPOT[spotKey()].x;
    T.x = Math.min(tx, T.x + dt * Math.max(180, (tx - T.x) * 3));
    if (T.x >= tx - 1) { placeMe(tx + 30, WALK_Y1 - 4); R.me.hidden = false; R.trip = null; arrivedMsg(T); }
  }
}
function arrivedMsg(T) {
  const how = T.mode === 'bike' ? 'Chạy xe máy' : 'Đi bộ';
  toast(`${how} tới ${destName(T.dest)}.${T.dest === 'market' && T.mode !== 'walk' ? ' Gửi xe ở bãi rồi đi bộ vô chợ.' : ''}`);
}
// vẽ xe của mình đang dựng hoặc đang chạy
function drawVehicles(hits) {
  const k = spotKey();
  const T = R.trip;
  const pl = playerLook();
  const myBike = (x, y, riding) => drawBike(ctx, { x, y, dir: 1, color: '#6BA368', parked: !riding, rider: { skin: pl.skin, shirt: heroOn() ? '#26262B' : pl.shirt, helmet: '#D98E04' }, pass: null, cargo: false });
  if (k) {
    const s = BIKE_SPOT[k];
    if (T && T.mode === 'bike' && T.phase !== 'card') myBike(T.x, T.y, true);
    else {
      myBike(s.x, s.y, false);
      ctx.fillStyle = '#D7372B'; rr(ctx, s.x - 52, s.y - 62, 32, 26, 4); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
      hits.push({ x: s.x - 60, y: s.y - 80, w: 120, h: 84, kind: 'bike', pri: 3 });
    }
  }
}
function drawTripCard() {
  const T = R.trip;
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#86C5E0'); grd.addColorStop(1, '#F3E3B8');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  const off = (R.t * (T.mode === 'walk' ? 120 : 600)) % 160;
  ctx.fillStyle = '#9CC5A1'; for (let x = -off * 0.4; x < W + 200; x += 180) { ctx.beginPath(); ctx.arc(x, 380, 70, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = '#44474F'; ctx.fillRect(0, 420, W, 180);
  ctx.fillStyle = '#E8C547'; for (let x = -off; x < W; x += 160) ctx.fillRect(x, 506, 80, 8);
  const cx = W / 2, bob = Math.sin(R.t * 18) * 2;
  const pl = playerLook();
  if (T.mode === 'bike') drawBike(ctx, { x: cx, y: 560 + bob, dir: 1, color: '#6BA368', rider: { skin: pl.skin, shirt: heroOn() ? '#26262B' : pl.shirt, helmet: '#D98E04' }, pass: null, cargo: false });
  else if (heroOn()) drawHero(ctx, cx, 560, 1.4, 1, 'walk', Math.floor(R.t * 11) % 8);
  else drawPerson(ctx, { x: cx, y: 560, dir: 1, look: { ...pl, scale: 1.4 }, moving: true, phase: R.t * 10 });
  const how = T.mode === 'bike' ? 'Đang chạy xe máy' : 'Đang đi bộ';
  ctx.fillStyle = 'rgba(35,26,20,.85)'; rr(ctx, cx - 260, 150, 520, 70, 16); ctx.fill();
  signText(ctx, `${how} tới ${destName(T.dest)}…`, cx, 184, 30, '#FFE08A', 490);
}
function travelChoices() {
  return [...destsFor().map((d) => ({ label: destName(d), sub: fmt(FUEL_COST), fn: () => startTrip('bike', d) })), { label: 'Thôi', fn: closeDialog }];
}

// ---------- Hội thoại ----------
function talk(name, look, lines, opts = {}) {
  R.dlg = { name, look, lines: [].concat(lines), i: 0, choices: opts.choices || null, onDone: opts.onDone || null };
  R.keys.clear();
  showDlg();
}
function showDlg() {
  const D = R.dlg;
  $('dialog').hidden = false;
  $('dlg-name').textContent = D.name;
  $('dlg-text').innerHTML = D.lines[D.i];
  const last = D.i >= D.lines.length - 1;
  $('dlg-choices').innerHTML = last && D.choices
    ? D.choices.map((c, k) => `<button class="btn ${k === D.choices.length - 1 && c.label === 'Thôi' ? 'paper' : ''}" data-dlg="${k}">${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}</button>`).join('')
    : `<button class="btn" data-dlg="next">${last ? 'Được rồi' : 'Tiếp'}<kbd>Space</kbd></button>`;
  const cv = $('dlg-face'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#F3E3B8'; rr(g, 0, 0, cv.width, cv.height, 12); g.fill();
  g.save(); g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, 12); g.clip();
  g.translate(60, 262); g.scale(1.9, 1.9);
  drawPerson(g, { x: 0, y: 0, dir: 1, look: { ...D.look, scale: 1 }, moving: false, phase: 0 });
  g.restore();
  Snd.tone(700 + Math.random() * 200, 0.04, 'triangle', 0.04);
}
function dlgNext() {
  const D = R.dlg;
  if (!D) return;
  if (D.i < D.lines.length - 1) { D.i++; showDlg(); return; }
  if (D.choices) return;
  const f = D.onDone; closeDialog(); f?.();
}
function closeDialog() { R.dlg = null; $('dialog').hidden = true; }
$('dialog').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || !R.dlg) return;
  if (t.dataset.dlg === 'next') dlgNext();
  else { const c = R.dlg.choices[Number(t.dataset.dlg)]; const done = R.dlg.onDone; closeDialog(); c.fn?.(); done?.(); }
});

// ---------- Ông Tư và nhiệm vụ mở đầu ----------
const OLD_TU = { name: 'Ông Tư', x: 250, look: { skin: '#E0AC80', hair: '#DDD', long: false, hat: 3, capColor: '#2E2E33', shirt: '#E9EEF5', pants: '#3A3A40', scale: 1.1, glasses: true } };
const QUEST_TEXT = {
  meet: 'Đi tới chỗ <b>Ông Tư</b> bên trái để chào hỏi',
  buy: 'Ra <b>Chợ đầu mối</b> nhập hàng (đi bộ sang trái hoặc chạy xe máy)',
  place: 'Lên <b>Khu phố 1</b>, bấm vào <b>lô trống</b> để bày sạp',
  collect: 'Chờ khách mua rồi bấm <b>đồng xu</b> trên gian để thu tiền',
};
function talkOldTu() {
  if (S.quest === 'meet') {
    talk(OLD_TU.name, OLD_TU.look, [
      'Ê ê, nhỏ mới dọn về hẻm 42 hả? Nhìn cái mặt sáng sủa vầy chắc sắp làm <b>Vua Vỉa Hè</b>… hoặc vua nợ nần, hehe.',
      'Tui bán đất cả đời mà chưa bán được miếng nào, nên tui <i>rành</i> chuyện buôn bán lắm à nghen!',
      'Nghe nè: muốn bán thì phải có hàng. Ra <b>Chợ đầu mối</b> gom hàng sỉ trước đã, đi bộ qua bên trái là tới.',
      'Có hàng rồi thì lên <b>Khu phố 1</b>, bấm vào lô trống là chọn sạp bày ra liền. Có cô có chú chạy ra rao bán giùm. Nhớ né công an phường với mấy anh "bảo kê" nha.',
      'Đi bộ cho khỏe, hay leo lên con <b>xe máy</b> cà tàng dưới đường cũng được. Xăng tự đổ nha, tui không cho mượn đâu!',
    ], { onDone: () => { S.quest = 'buy'; addXp(5); news('Ông Tư chỉ đường: nhập hàng ở chợ đầu mối rồi lên khu phố bán.', 'good'); save(); } });
    return;
  }
  const banter = ['Bữa nay bán đắt hông? Đắt thì khao tui ly trà đá nghen.', 'Thấy chưa, nghe lời tui là có ngày giàu. Hồi đó tui không nghe lời tui nên giờ vầy nè.',
    'Mấy ông bảo kê mà tới là cứ nói quen Ông Tư. Họ không biết tui đâu, nhưng nói cho oai.', 'Đất này vàng đó nghen, tui để giá hữu nghị: rẻ hơn hôm qua… một chút xíu.'];
  talk(OLD_TU.name, OLD_TU.look, [pick(banter)], { choices: [
    { label: 'Hỏi thuê lô mới', fn: () => { const nl = nextLot(); if (!nl) toast('Hết lô để thuê rồi, giàu quá trời!'); else openGian(nl.si, nl.li); } },
    { label: 'Thôi', fn: null },
  ] });
}
function questProgress(ev) {
  const q = S.quest;
  if (q === 'buy' && ev === 'buy') { S.quest = 'place'; toast('Có hàng trong kho rồi! Lên <b>Khu phố 1</b>, bấm vào lô trống để bày sạp.', 'gold'); }
  else if (q === 'place' && ev === 'place') { S.quest = 'collect'; toast('Bày sạp xong! Người bán rao hàng giùm, thấy đồng xu là bấm thu tiền.', 'gold'); }
  else if (q === 'collect' && ev === 'collect') {
    S.quest = 'done'; S.money += 20000;
    toast('Xong bài học vỡ lòng! Ông Tư lì xì <b>20.000đ</b>. Giờ tự lo nha, Vua Vỉa Hè tương lai!', 'gold');
    news('Bạn hoàn thành nhiệm vụ mở đầu, nhận 20.000đ.', 'good');
  }
}
function renderQuest() {
  const el = $('quest');
  if (!el) return;
  const t = R.started && S.quest && S.quest !== 'done' ? QUEST_TEXT[S.quest] : '';
  el.hidden = !t;
  if (t && el.dataset.q !== S.quest) { el.dataset.q = S.quest; el.innerHTML = `<span class="lbl">Nhiệm vụ</span><span>${t}</span>`; }
}
const PARK_GUARD = { skin: '#C68B5E', hair: '#1E1A1A', long: false, hat: 3, capColor: '#2E8B57', shirt: '#2E8B57', style: 'collar', pants: '#2F3E46' };

function homeObjects(hits, layer) {
  // Ông Tư ngồi chiếu, cạnh bảng bán đất
  const o = OLD_TU;
  layer.push({ y: 540, draw: () => {
    ctx.fillStyle = '#E6CB85'; rr(ctx, o.x - 55, 530, 110, 24, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,40,.5)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = o.x - 50; k < o.x + 55; k += 8) { ctx.moveTo(k, 530); ctx.lineTo(k, 554); } ctx.stroke();
    drawPerson(ctx, { x: o.x, y: 538, dir: 1, look: o.look, seated: true, moving: false, phase: 0 });
    ctx.fillStyle = '#FFF4D6'; rr(ctx, o.x + 52, 452, 96, 34, 4); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#6B4F3A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x + 100, 486); ctx.lineTo(o.x + 100, 536); ctx.stroke();
    signText(ctx, 'BÁN ĐẤT', o.x + 100, 468, 17, '#C0392B');
    nameTag(ctx, o.name, o.x, 538 - 156, false, S.quest === 'meet' ? 'Bấm để nói chuyện' : 'Bán đất');
  } });
  if (S.quest === 'meet') exclaim(o.x, 538 - 214, 'Nói chuyện');
  hits.push({ x: o.x - 70, y: 380, w: 230, h: 180, kind: 'oldman', pri: 2 });
  // hàng thanh lý = kho của mình
  layer.push({ y: 556, draw: () => {
    ctx.fillStyle = '#C9A06A';
    [[930, 548, 60, 40], [980, 540, 50, 48], [950, 512, 54, 36], [1020, 552, 44, 30]].forEach(([x, y, w, h]) => { ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(35,26,20,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke(); });
    ctx.fillStyle = '#FFF4D6'; rr(ctx, 942, 566, 80, 20, 3); ctx.fill();
    signText(ctx, 'KHO HÀNG', 982, 575, 13, '#C0392B');
  } });
  hits.push({ x: 910, y: 480, w: 150, h: 115, kind: 'kho', pri: 2 });
  // cửa nhà = tủ đồ
  hits.push({ x: 590, y: 300, w: 100, h: 125, kind: 'door', pri: 2 });
  // hộp thư = tin tức
  layer.push({ y: 540, draw: () => {
    ctx.fillStyle = '#1F6F8B'; rr(ctx, 858, 470, 34, 30, 4); ctx.fill(); ctx.fillStyle = '#6B4F3A'; ctx.fillRect(872, 500, 6, 40);
    ctx.fillStyle = '#FFF4D6'; ctx.fillRect(864, 480, 22, 4);
    if (R.unread) { ctx.fillStyle = '#D7372B'; ctx.beginPath(); ctx.arc(892, 468, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '800 12px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.min(9, R.unread), 892, 469); }
  } });
  hits.push({ x: 848, y: 455, w: 56, h: 90, kind: 'mail', pri: 2 });
}
function drawParkingSign(hits) {
  const x = 210, y = 560;
  ctx.strokeStyle = '#6E6A64'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 50); ctx.stroke();
  ctx.fillStyle = '#1F6F8B'; rr(ctx, x - 70, y - 40, 140, 44, 8); ctx.fill(); ctx.strokeStyle = '#FFF4D6'; ctx.lineWidth = 2.5; ctx.stroke();
  signText(ctx, 'BÃI GIỮ XE', x, y - 18, 14, '#FFF4D6', 128);
  hits.push({ x: x - 76, y: y - 46, w: 152, h: 100, kind: 'parking', pri: 3 });
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
// dấu "!" báo có việc: gom lại, vẽ sau cùng để không bị người, bảng tên che
function exclaim(x, y, label) { R.marks.push({ x, y, label }); }
function drawMarks() {
  for (const m of R.marks) {
    const b = Math.sin(R.t * 5) * 5, y = m.y + b, pulse = (R.t * 1.4) % 1;
    ctx.strokeStyle = `rgba(247,201,72,${1 - pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(m.x, y, 20 + pulse * 16, 0, 7); ctx.stroke();
    ctx.fillStyle = '#F7C948'; ctx.strokeStyle = '#231A14'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.x, y, 20, 0, 7); ctx.moveTo(m.x - 7, y + 17); ctx.lineTo(m.x, y + 30); ctx.lineTo(m.x + 7, y + 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F7C948'; ctx.beginPath(); ctx.arc(m.x, y, 17.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#C0392B'; ctx.font = '900 30px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', m.x, y + 2);
    if (m.label) {
      ctx.font = '800 13px "Baloo 2", sans-serif';
      const w = ctx.measureText(m.label).width + 16;
      ctx.fillStyle = '#231A14'; rr(ctx, m.x - w / 2, y - 48, w, 22, 11); ctx.fill();
      ctx.fillStyle = '#FFE08A'; ctx.fillText(m.label, m.x, y - 36);
    }
  }
}
function drawPortal(p) {
  const x = p.side < 0 ? 70 : worldW() - 70, y = p.y || 470;
  ctx.fillStyle = '#1F6F8B'; ctx.strokeStyle = '#FFF4D6'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (p.side > 0) { ctx.moveTo(x - 70, y - 20); ctx.lineTo(x + 40, y - 20); ctx.lineTo(x + 62, y); ctx.lineTo(x + 40, y + 20); ctx.lineTo(x - 70, y + 20); }
  else { ctx.moveTo(x + 70, y - 20); ctx.lineTo(x - 40, y - 20); ctx.lineTo(x - 62, y); ctx.lineTo(x - 40, y + 20); ctx.lineTo(x + 70, y + 20); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#6E6A64'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, Math.max(FRONT_Y - 10, y + 40)); ctx.stroke();
  signText(ctx, p.label, x + (p.side > 0 ? -8 : 8), y, 15, '#FFF4D6', 120);
  return { x: x - 75, y: y - 26, w: 150, h: 90, kind: 'portal', side: p.side, pri: 2 };
}

// ---------- Vòng lặp logic ----------
function update(dt) {
  R.t += dt;
  if (R.started) {
    tickGians(dt, true);
    tickShops(dt, true);
    tickNeighbors(dt);
    regenEnergy();
    tickDebt();
    if (now() - S.pricesAt > 600000) { rollPrices(); news('Chợ đầu mối vừa đổi giá sỉ.'); }
    updatePolice(dt);
    updateFight(dt);
    updateTrip(dt);
    if (!R.modal && !R.police && !R.fight) {
      R.nextThug -= dt;
      if (R.nextThug <= 0) { R.nextThug = rand(360, 600); if (S.level >= 2 && allGians().some(({ g }) => g.placed)) startThug(); }
    }
    R.nextNb -= dt;
    if (R.nextNb <= 0) { R.nextNb = rand(50, 110); neighborActs(false); }
    R.secT = (R.secT || 0) + dt;
    if (R.secT >= 1) { R.secT = 0; everySecond(); }
    R.saveT += dt;
    if (R.saveT > 10) { R.saveT = 0; save(); }
  }
  updateCrowd(dt);
  updateRunners(dt);
  updateRoad(dt);
  updateEvents(dt);
  updateActor(dt);
  updateGuests(dt);
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

// ---------- Mỗi giây: dò vé số, xét thành tựu, khách để lại góp ý ----------
function everySecond() {
  checkDraws();
  checkAchievements();
  tickReviews();
  if (R.paperDay !== gameDay()) { R.paperDay = gameDay(); if (R.started) renderTop(); }
}

// ---------- Thành tựu ----------
// test() đúng là mở khóa; mỗi thành tựu thưởng tiền và kinh nghiệm một lần.
const kpCount = () => Array.from({ length: KP_COUNT }, (_, k) => k).filter(kpOpen).length;
const ACH = [
  { id: 'khoi_dau',  icon: '🌱', name: 'Khởi đầu suôn sẻ',   desc: 'Xong bài học vỡ lòng của Ông Tư',             test: () => S.quest === 'done', money: 20000 },
  { id: 'ban_dau',   icon: '🧺', name: 'Mở hàng',            desc: 'Bán được món hàng đầu tiên',                   test: () => S.stats.sold >= 1, money: 5000 },
  { id: 'ban_100',   icon: '📦', name: 'Trăm món',           desc: 'Bán được 100 món',                             test: () => S.stats.sold >= 100, prog: () => [S.stats.sold, 100], money: 30000 },
  { id: 'ban_1000',  icon: '🚚', name: 'Ngàn món',           desc: 'Bán được 1.000 món',                           test: () => S.stats.sold >= 1000, prog: () => [S.stats.sold, 1000], money: 200000 },
  { id: 'kp2',       icon: '🗺️', name: 'Chợ mới, phố mới',   desc: 'Mở được Khu phố 2',                            test: () => kpOpen(1), money: 50000 },
  { id: 'kp5',       icon: '🏪', name: 'Phố mặt tiền',       desc: 'Mở được Khu phố 5, thuê được tiệm',            test: () => kpOpen(4), prog: () => [kpCount(), 5], money: 500000 },
  { id: 'kp10',      icon: '🌆', name: 'Khắp Sài Gòn',       desc: 'Mở đủ 10 khu phố',                             test: () => kpOpen(9), prog: () => [kpCount(), 10], money: 3000000 },
  { id: 'tiem',      icon: '💈', name: 'Chủ tiệm',           desc: 'Khai trương tiệm đầu tiên',                    test: () => allGians().some(({ g }) => g.biz), money: 300000 },
  { id: 'trieu',     icon: '💰', name: 'Triệu phú vỉa hè',   desc: 'Có 1 triệu tiền mặt',                          test: () => S.money >= 1000000, money: 50000 },
  { id: 'dai_gia',   icon: '💎', name: 'Đại gia',            desc: 'Kiếm tổng cộng 20 triệu',                      test: () => S.stats.earned >= 20000000, prog: () => [S.stats.earned, 20000000], money: 1000000 },
  { id: 'cap10',     icon: '⭐', name: 'Có số má',           desc: 'Lên cấp 10',                                   test: () => S.level >= 10, prog: () => [S.level, 10], money: 200000 },
  { id: 'vua',       icon: '👑', name: 'Vua Vỉa Hè',         desc: 'Lên cấp tối đa',                               test: () => S.level >= MAX_LVL, prog: () => [S.level, MAX_LVL], money: 5000000 },
  { id: 'tra_gia',   icon: '🤝', name: 'Miệng lưỡi chợ búa', desc: 'Trả giá thành công 5 lần',                     test: () => (S.flags.bargain || 0) >= 5, prog: () => [S.flags.bargain || 0, 5], money: 30000 },
  { id: 'giang_ho',  icon: '🥊', name: 'Không đóng bảo kê',  desc: 'Đánh đuổi dân anh chị',                        test: () => (S.flags.fightWin || 0) >= 1, money: 50000 },
  { id: 'trom_cho',  icon: '🐕', name: 'Hiệp sĩ đường phố',  desc: 'Bắt được tụi trộm chó',                        test: () => (S.flags.dogThief || 0) >= 1, money: 50000 },
  { id: 'ca_hiem',   icon: '🎏', name: 'Cần thủ',            desc: 'Câu được cá hiếm (koi, rùa vàng, cá hóa rồng)', test: () => (S.flags.rareFish || 0) >= 1, money: 80000 },
  { id: 've_so',     icon: '🎫', name: 'Trúng số',           desc: 'Trúng một giải vé số',                         test: () => (S.flags.lottoWin || 0) >= 1, money: 20000 },
  { id: 'tra_loi',   icon: '💬', name: 'Khách là thượng đế', desc: 'Trả lời 10 góp ý của khách',                   test: () => (S.flags.replies || 0) >= 10, prog: () => [S.flags.replies || 0, 10], money: 50000 },
  { id: 'nam_sao',   icon: '🌟', name: 'Năm sao',            desc: 'Khách chấm sạp từ 4,6 sao trở lên',             test: () => (S.rep ?? 50) >= 90, money: 300000 },
  { id: 'gian',      icon: '🦊', name: 'Gian thương',        desc: 'Chôm được 30 món hàng của hàng xóm',           test: () => (S.flags.stealGoods || 0) >= 30, prog: () => [S.flags.stealGoods || 0, 30], money: 0 },
];
function checkAchievements() {
  S.ach ||= {};
  for (const A of ACH) {
    if (S.ach[A.id] || !A.test()) continue;
    S.ach[A.id] = now();
    if (A.money) { S.money += A.money; }
    addXp(10);
    Snd.level();
    toast(`${A.icon} Thành tựu mới: <b>${A.name}</b>${A.money ? ` · thưởng ${fmt(A.money)}` : ''}`, 'gold');
    news(`Đạt thành tựu <b>${A.name}</b>: ${A.desc.toLowerCase()}.`, 'good');
    R.achNew = (R.achNew || 0) + 1;
    if (R.started) renderTop();
  }
}
function achHTML() {
  const got = ACH.filter((A) => S.ach?.[A.id]).length;
  return `<div class="stats-line"><span>Đã đạt <b>${got}/${ACH.length}</b> thành tựu</span></div>
    <div class="ach-grid">${ACH.map((A) => {
      const at = S.ach?.[A.id];
      const pr = !at && A.prog ? A.prog() : null;
      return `<div class="ach${at ? ' got' : ''}"><span class="ach-ic">${at ? A.icon : '🔒'}</span><span><b>${A.name}</b><small>${A.desc}${A.money ? ` · thưởng ${fmtK(A.money)}` : ''}</small>
        ${pr ? `<span class="meter"><i style="width:${clamp(pr[0] / pr[1], 0, 1) * 100}%"></i></span>` : at ? `<small class="when">Đạt lúc ${gclock(at)}</small>` : ''}</span></div>`;
    }).join('')}</div>`;
}
function openAch() { R.achNew = 0; renderTop(); openModal('Thành tựu', achHTML(), { kind: 'ach' }); }

// ---------- Góp ý của khách: khách chấm sao, bạn trả lời; điểm đánh giá ảnh hưởng lượng khách ----------
const REVIEW_NAMES = ['Chị Thu', 'Anh Khoa', 'Bé Na', 'Cô Hồng', 'Chú Lâm', 'Anh Tây balô', 'Chị Ngọc', 'Bác Sáu', 'Em Vy', 'Anh Toàn', 'Cô giáo Mai', 'Anh shipper'];
const REVIEW_TEXT = {
  trash:  ['Đồ ăn ngon mà trước sạp rác quá trời, ăn hết muốn ngon.', 'Dọn rác trước sạp giùm cái, bước qua muốn té.'],
  rat:    ['Thấy con chuột chạy ngang sạp, hết hồn!', 'Sạp có chuột, tui hổng dám mua nữa.'],
  empty:  ['Ghé mua mà hết hàng, đi về tay không.', 'Bữa nào cũng hết hàng sớm, nhập thêm đi chủ sạp ơi.'],
  broken: ['Sạp bị đập tan hoang, thương ghê.'],
  theme:  ['Đúng món dân ở đây thèm, mua liền tay!', 'Khu này mà có món này là chuẩn bài luôn.'],
  good:   ['Bán dễ thương, nói chuyện có duyên.', 'Hàng tươi, giá phải chăng. Sẽ quay lại!', 'Cô bán hàng rao nghe vui tai ghê.', 'Gói hàng kỹ, thối tiền đủ.'],
  meh:    ['Cũng được, không có gì đặc biệt.', 'Giá hơi chát so với vỉa hè.', 'Chờ hơi lâu mới tới lượt.'],
};
const REPLIES = {
  thank:   { label: 'Cảm ơn khách', rep: 1, say: 'Cảm ơn bạn nhiều nha, ghé ủng hộ tiếp nghen!' },
  gift:    { label: 'Tặng phiếu giảm giá', cost: 5000, rep: 3, say: 'Lần sau ghé đưa phiếu này giảm giá liền nha!' },
  sorry:   { label: 'Xin lỗi, sẽ sửa', rep: 2, say: 'Dạ tui xin lỗi, tui sửa liền!' },
  refund:  { label: 'Đền bù', cost: 15000, rep: 4, say: 'Gửi lại tiền cho bạn, mong bạn bỏ qua.' },
  argue:   { label: 'Cãi lại', rep: -4, karma: -1, say: 'Chê thì đi chỗ khác mua đi!' },
};
function makeReview() {
  const list = allGians().filter(({ g }) => g.placed || g.biz);
  if (!list.length) return null;
  const { g, si, i } = pick(list);
  let stars = 4, kind = 'good';
  if (g.broken) { stars = 1; kind = 'broken'; }
  else if (g.rat) { stars = 1; kind = 'rat'; }
  else if (g.trash) { stars = Math.max(1, 3 - g.trash); kind = 'trash'; }
  else if (g.placed && !gQty(g)) { stars = 2; kind = 'empty'; }
  else if (g.placed && gGoods(g).some((id) => themeHit(si, id))) { stars = 5; kind = 'theme'; }
  else { stars = Math.random() < 0.35 + (S.rep ?? 50) / 200 ? 5 : Math.random() < 0.6 ? 4 : 3; kind = stars >= 4 ? 'good' : 'meh'; }
  const what = g.biz ? SHOP_TYPES[g.biz].name.toLowerCase() : `sạp ${lotName(i)}`;
  return { id: Math.floor(Math.random() * 1e9), t: now(), si, li: i, who: pick(REVIEW_NAMES), stars, kind, what, text: pick(REVIEW_TEXT[kind]), reply: null };
}
function tickReviews() {
  if (!R.started) return;
  // góp ý xấu bỏ mặc lâu quá thì mất điểm
  for (const r of S.reviews) if (!r.reply && !r.ignored && r.stars <= 2 && now() - r.t > 8 * 60000) { r.ignored = true; S.rep = clamp(S.rep - 2, 0, 100); }
  R.nextRev = (R.nextRev ?? rand(25, 45)) - 1;
  if (R.nextRev > 0) return;
  R.nextRev = rand(50, 100);
  const rv = makeReview();
  if (!rv) return;
  S.reviews.unshift(rv);
  S.reviews.length = Math.min(S.reviews.length, 24);
  // khách tự chấm: 5 sao kéo điểm lên, 1–2 sao kéo xuống
  S.rep = clamp((S.rep ?? 50) + (rv.stars - 3) * 0.8, 0, 100);
  renderTop();
  if (rv.stars <= 2) toast(`💬 ${rv.who} chấm ${rv.stars}★ ${rv.what}: "${rv.text}" Vô <b>Góp ý</b> trả lời khách nha.`, 'bad');
}
function replyReview(id, k) {
  const r = S.reviews.find((q) => q.id === id), P = REPLIES[k];
  if (!r || r.reply || !P) return;
  if (P.cost && S.money < P.cost) { toast(`Không đủ ${fmt(P.cost)}.`, 'bad'); return; }
  if (P.cost) S.money -= P.cost;
  r.reply = k;
  let d = P.rep;
  // xin lỗi mà đã sửa xong lỗi thì khách nể hơn
  const G = S.streets[r.si]?.gians[r.li];
  if (k === 'sorry' && G && !G.trash && !G.rat && !G.broken && (!G.placed || gQty(G))) d += 2;
  S.rep = clamp((S.rep ?? 50) + d, 0, 100);
  if (P.karma) changeKarma(P.karma);
  S.flags.replies = (S.flags.replies || 0) + 1;
  addXp(2);
  d > 0 ? Snd.coin() : Snd.bad();
  toast(d > 0 ? `${r.who} đọc trả lời, vui vẻ ghé lại. Điểm đánh giá +${d}.` : `${r.who} giận, rủ bạn bè tẩy chay. Điểm đánh giá ${d}.`, d > 0 ? 'good' : 'bad');
}
const unanswered = () => (S.reviews || []).filter((r) => !r.reply).length;
function reviewsHTML() {
  const L = S.reviews || [];
  const stars = (n) => '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span>';
  const list = L.length ? L.map((r) => {
    const opts = r.stars >= 4 ? ['thank', 'gift'] : ['sorry', 'refund', 'argue'];
    return `<div class="review${r.reply ? ' done' : ''}${r.stars <= 2 ? ' bad' : ''}">
      <div class="rv-head"><b>${r.who}</b><span class="stars">${stars(r.stars)}</span><small>${gclock(r.t)} · ${r.what} · ${kpLabel(r.si)}</small></div>
      <p>"${r.text}"</p>
      ${r.reply ? `<p class="rv-reply">Bạn: "${REPLIES[r.reply].say}"</p>` : `<div class="rv-btns">${opts.map((k) => `<button class="mini" data-reply="${k}" data-rid="${r.id}" ${REPLIES[k].cost && S.money < REPLIES[k].cost ? 'disabled' : ''}>${REPLIES[k].label}${REPLIES[k].cost ? ` · ${fmtK(REPLIES[k].cost)}` : ''}</button>`).join('')}</div>`}
    </div>`;
  }).join('') : '<p class="empty-note">Chưa có khách nào góp ý. Bày sạp bán một hồi là có người nhận xét.</p>';
  return `<div class="stats-line"><span>Điểm đánh giá: <b>${repStars()}★</b> (${Math.round(S.rep ?? 50)}/100)</span><span>Khách ghé ${repMult() >= 1 ? 'nhiều hơn' : 'ít hơn'} <b>${Math.round(Math.abs(repMult() - 1) * 100)}%</b></span><span>Chưa trả lời: <b>${unanswered()}</b></span></div>
    <p class="event-text">Khách mua xong hay để lại vài lời. Trả lời đàng hoàng thì điểm lên, khách ghé đông. Góp ý xấu bỏ mặc lâu là bị trừ điểm.</p>
    <div class="reviews">${list}</div>`;
}
const openReviews = () => openModal('Góp ý của khách', reviewsHTML(), { kind: 'reviews' });

// ---------- Báo Vỉa Hè: ra mỗi ngày trong game, tin nóng dẫn dắt câu chuyện ----------
// Mỗi chương truyện mở khi người chơi đạt mốc; số báo mới nhất đăng chương mới nhất.
const STORY = [
  { test: () => true, title: 'Người mới dọn về hẻm 42',
    text: (n) => `Hẻm 42 vừa đón thêm một gương mặt lạ: <b>${n}</b>. Ông Tư bán đất (đã 30 năm chưa bán được miếng nào) tuyên bố sẽ "dìu dắt" người mới. Bà con khuyên: nghe Ông Tư thì nghe, nhưng đừng mua đất của ổng.` },
  { test: () => S.stats.sold > 0, title: 'Gánh hàng mới làm xôn xao Hẻm Chợ Cũ',
    text: (n) => `Chưa đầy một buổi, gánh hàng của ${n} đã có khách quen. Dì Năm ở chợ đầu mối hé lộ: "Đứa này lanh, mà trả giá dữ lắm!" Phóng viên ghi nhận khu Hẻm Chợ Cũ đông nhất là giờ ăn sáng.` },
  { test: () => S.level >= 3, title: 'Ông Chủ Mối mở sổ nợ: ai mua chịu coi chừng tiền lời',
    text: () => `Ông Chủ Mối xác nhận ai mua chịu sẽ bị ghi thêm 10% tiền lời, cộng lãi 5% mỗi 5 phút. "Nợ quá hạn là tui siết hàng, khỏi năn nỉ," ổng nói, tay vẫn gõ bàn tính.` },
  { test: () => S.level >= 5, title: 'Băng Anh Hai Bẹo đi thu tiền bảo kê',
    text: (n) => `Nhiều tiểu thương phản ánh dân anh chị đi thu "phí giữ trật tự". Có người đóng cho yên, có người xắn tay áo đánh lại. Tin đồn nói ${n} cũng đang bị để ý.` },
  { test: () => kpOpen(1), title: 'Làn sóng hàng rong lan sang khu phố mới',
    text: (n) => `${n} đã có sạp ở nhiều khu phố. Mỗi khu một gu: Cổng Trường mê kẹo bông, đồ chơi; Bờ Kênh chiều nào cũng hết hột vịt lộn. Ai bày đúng món đúng giờ là đắt như tôm tươi.` },
  { test: () => S.level >= 7, title: 'Trộm chó hoành hành, dân phố lập tổ canh',
    text: () => `Liên tiếp nhiều vụ trộm chó bằng xe máy giữa ban ngày. Bà con kêu gọi ai thấy xe chạy rề rề, dòm chó nhà người ta thì hô hoán, túm liền. Hội hàng xóm treo thưởng cho người bắt được.` },
  { test: () => kpOpen(4), title: 'Phố mặt tiền mở cửa, hàng rong lên đời chủ tiệm',
    text: (n) => `Từ Khu phố 5, ${n} có thể thuê mặt bằng mở tiệm hớt tóc, sửa xe, cơm tấm… "Từ đôi gánh lên mặt tiền, ai mà ngờ," một người bán xôi lâu năm cảm thán.` },
  { test: () => S.level >= 15, title: 'Cuộc đua ngôi Vua Vỉa Hè nóng lên từng giờ',
    text: (n) => `Giới buôn bán đồn ầm: ${n} chỉ còn cách ngôi Vua Vỉa Hè vài bước. Chị Hai Lúa và Tí Sún bắt đầu "chơi xấu", còn Anh Năm Sài Gòn thì mời cà phê hòa giải.` },
  { test: () => S.level >= MAX_LVL || kpOpen(9), title: 'Vua Vỉa Hè đăng quang!',
    text: (n) => `Cả Sài Gòn chứng kiến <b>${n}</b> đi từ một đôi gánh tới khắp 10 khu phố. Ông Tư rưng rưng: "Tui đã nói mà!" (thật ra ổng không nói).` },
];
const storyNow = () => STORY.reduce((k, c, i) => (c.test() ? i : k), 0);
function paperHTML() {
  const day = gameDay(), k = storyNow(), name = esc(S.player.name);
  const hot = hotGood(day);
  const open = Array.from({ length: KP_COUNT }, (_, i) => i).filter(kpOpen);
  const res = drawResult(lastDraw());
  const goss = (S.news || []).slice(0, 4).map((n) => `<li>${n.text}</li>`).join('') || '<li>Khu phố yên ắng.</li>';
  const past = STORY.slice(0, k).reverse().slice(0, 3).map((c) => `<li><b>${c.title}</b></li>`).join('');
  return `<article class="paper">
    <header class="paper-head"><span>Số ${day} · Ngày ${day} trong game · ${gclock()}</span><h3>BÁO VỈA HÈ</h3><span>Tin nóng mỗi ngày · Giá 0đ</span></header>
    <div class="paper-cols">
      <section class="paper-main"><h4>${STORY[k].title}</h4><p>${STORY[k].text(name)}</p>
        ${past ? `<p class="paper-sub">Các số trước</p><ul>${past}</ul>` : ''}</section>
      <aside class="paper-side">
        <div class="paper-box hot"><b>Món hot hôm nay</b><span>${GOODS[hot].icon} ${GOODS[hot].name}: bán ở đâu cũng được giá hơn 30% tới hết ngày.</span></div>
        <div class="paper-box"><b>Giờ vàng các khu phố</b><ul>${open.map((si) => `<li>${themeIcons(si)} <b>${kpLabel(si)}</b> · ${kpTheme(si).tag}: đông ${hoursText(kpTheme(si).peak)}${kpPeak(si) ? ' <em>đang đông</em>' : ''}</li>`).join('')}</ul></div>
        <div class="paper-box"><b>Xổ số kỳ ${drawLabel(lastDraw())}</b><span>Đặc biệt <strong>${res.db[0]}</strong> · Tám ${res.g8.join(' ')}</span></div>
        <div class="paper-box"><b>Chuyện hàng xóm</b><ul>${goss}</ul></div>
      </aside>
    </div></article>`;
}
function openPaper() { S.paperSeen = gameDay(); renderTop(); openModal('Báo Vỉa Hè', paperHTML(), { kind: 'paper' }); }

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
  R.modal = null; R.modalArg = null; R.cart = {};
}
const MODAL_HTML = { market: () => marketHTML(R.modalArg), debt: () => debtHTML(), fun: () => funHTML(), kho: () => khoHTML(), gian: () => gianHTML(...R.modalArg), neighbors: () => neighborsHTML(),
  fashion: () => fashionHTML(), news: () => newsHTML(), cafe: () => cafeHTML(), street2: () => street2HTML(),
  fishshop: () => fishShopHTML(), veso: () => vesoHTML(), pickchar: () => pickCharHTML(), ach: () => achHTML(), reviews: () => reviewsHTML(), paper: () => paperHTML(), lot: () => lotHTML(...R.modalArg), mock: () => mockHTML(), basket: () => basketHTML(), book: () => bookHTML(), profile: () => profileHTML(R.modalArg), char: () => charHTML() };
function refreshModal() {
  if (!R.modal || !MODAL_HTML[R.modal]) return;
  const b = $('modal-body');
  const st = b.scrollTop;
  b.innerHTML = MODAL_HTML[R.modal]();
  b.scrollTop = st;
  if (R.modal === 'char') drawPreview(playerLook());
  if (R.modal === 'pickchar') drawCharPreviews();
  if (R.modal === 'profile') drawPreview(npcLook(R.modalArg));
  if (R.view === 'fish') renderDock();
}

function trendMark(id) {
  const p = S.prices[id], prev = S.prevPrices[id] || p;
  return p > prev * 1.03 ? '<span class="up" title="Tăng so với đợt trước">▲</span>' : p < prev * 0.97 ? '<span class="down" title="Rẻ hơn đợt trước">▼</span>' : '<span class="flat">•</span>';
}
function marketHTML(cat) {
  const M = cat ? MARKET_STALLS.find((m) => m.id === cat) : null;
  const only = M?.goods || null;
  const mins = Math.max(0, Math.ceil((600000 - (now() - S.pricesAt)) / 60000));
  const rows = GOOD_IDS.filter((id) => !only || only.includes(id)).map((id) => {
    const g = GOODS[id], locked = g.lvl > S.level, ms = stallOfGood(id), banned = ms && bargBanned(ms.id);
    const perMin = Math.round(60 / g.t * (g.sell - g.buy));
    const p = wholesale(id), off = p < S.prices[id];
    const btns = locked ? `<span class="lock">Cấp ${g.lvl}</span>` : banned ? `<span class="lock">${ms.owner} giận</span>`
      : `<button class="mini" data-buy="${id}" data-n="-10" ${cartQty(id) ? '' : 'disabled'}>−10</button><span class="cart-q${cartQty(id) ? ' on' : ''}">${cartQty(id)}</span><button class="mini" data-buy="${id}" data-n="10">+10</button><button class="mini max" data-buy="${id}" data-n="max">Tối đa</button>`;
    return `<div class="row ${locked || banned ? 'locked' : ''}">
      <div class="r-icon">${g.icon}</div>
      <div class="r-name"><b>${g.name}${id === hotGood() ? ' <span class="hot-tag">Hot hôm nay</span>' : ''}</b><small>Bán lẻ ${fmt(g.sell)} · ~${g.t} giây/món · lời ~${fmtK(perMin)}/phút mỗi gánh${M ? '' : ` · ${ms.owner}`}</small></div>
      <div class="r-price"><small>Giá sỉ${R.credit ? ' · chịu +10%' : ''}</small><b>${off ? `<s>${fmt(S.prices[id])}</s> ` : ''}${fmt(p)} ${trendMark(id)}</b></div>
      <div class="r-have"><small>Trong kho</small><b>${S.kho[id] || 0}</b></div>
      <div class="r-btns">${btns}</div>
    </div>`;
  }).join('');
  let barg = '';
  if (M) {
    const B = bargOf(M.id);
    barg = bargBanned(M.id)
      ? `<div class="barg-box angry"><b>${M.owner} đang giận</b><span>Trả giá hụt 3 lần rồi. Chờ chợ đổi giá sỉ (${mins} phút nữa) mới mua được ở sạp này.</span></div>`
      : `<div class="barg-box"><b>Trả giá với ${M.owner}</b><span>${B.disc ? `Đang được bớt <b>${Math.round(B.disc * 100)}%</b>. ` : ''}Trả hụt ${B.fails}/3 lần${B.fails ? ', hụt đủ 3 lần là bị cấm cửa tới đợt giá sau' : ''}. Cấp càng cao càng dám trả mạnh.</span>
        <div class="barg-btns">${BARG_OPTS.map((o) => {
          const pc = Math.round(o.pct * 100);
          if (S.level < o.lvl) return `<button class="mini" disabled>Bớt ${pc}%<small>Cấp ${o.lvl}</small></button>`;
          return `<button class="mini" data-barg="${o.pct}" ${o.pct <= B.disc ? 'disabled' : ''}>Bớt ${pc}%<small>${Math.round(bargChance(o.pct) * 100)}% được</small></button>`;
        }).join('')}</div></div>`;
  }
  return `<div class="debt-box">
      <span>Tiền mặt: <b>${fmt(S.money)}</b></span>
      <span>Kho: <b>${khoCount()}/${khoCap()}</b></span>
      <span>Nợ mối: <b class="${S.debt ? 'neg' : ''}">${fmt(S.debt)}</b> / hạn mức ${fmt(creditLimit())}</span>
      <button class="mini ${R.credit ? 'on' : ''}" data-act="credit">${R.credit ? 'Đang mua chịu' : 'Mua chịu'}</button>
      <button class="mini" data-act="repay" ${S.debt && S.money ? '' : 'disabled'}>Trả nợ</button>
      <small>Mua chịu bị ghi thêm 10% tiền lời, nợ còn lãi 5% mỗi 5 phút${S.debt ? ` (lần tới sau ${interestIn()}: +${fmt(S.debt * 0.05)})` : ''}. Vượt 130% hạn mức là chủ mối tới siết nợ. Giá sỉ đổi sau ${mins} phút. ${areaPeak('market') ? '<b>Đang chợ sớm: giá sỉ rẻ hơn 10%.</b>' : AREA_TIME.market.text + '.'}</small>
    </div>${barg}${M ? '' : '<p class="empty-note" style="margin:0 0 8px">Muốn trả giá thì ghé từng sạp mối trong chợ.</p>'}<div class="rows">${rows}</div>${cartBarHTML()}`;
}
function cartBarHTML() {
  const n = cartCount(), cost = cartCost(), short = cost - S.money;
  const over = cost > buyBudget(), full = n > khoCap() - khoCount();
  const note = !n ? 'Bấm +10 hoặc Tối đa để bỏ hàng vào giỏ, rồi bấm Thanh toán.'
    : full ? 'Kho không đủ chỗ cho cả giỏ.'
    : over ? (R.credit ? 'Vượt hạn mức mua chịu.' : `Thiếu ${fmt(short)}. Bớt hàng hoặc bật Mua chịu.`)
    : short > 0 ? `Tiền mặt thiếu ${fmt(short)}, phần còn lại ghi sổ nợ (+10% lời).` : `Còn lại ${fmt(S.money - cost)} tiền mặt.`;
  return `<div class="cart-bar${n ? ' on' : ''}">
    <div class="cart-sum"><span>Giỏ hàng: <b>${n} món</b> · Tổng <b>${fmt(cost)}</b></span><small>${note}</small></div>
    <button class="mini" data-act="cart-clear" ${n ? '' : 'disabled'}>Bỏ giỏ</button>
    <button class="btn green" data-act="checkout" ${n && !over && !full ? '' : 'disabled'}>Thanh toán</button>
  </div>`;
}
const interestIn = () => { const s = Math.max(0, Math.ceil((300000 - (now() - S.debtAt)) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
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
  if (!G.open && isShopLot(si, i)) {
    const [cost, lvl] = gianCost(si, i);
    return `<p class="event-text">Mặt bằng ${lotName(i)} ở ${kpLabel(si)} đang cho thuê. Thuê rồi mở tiệm sửa xe, điện thoại, cơm tấm… Có mặt bằng thì không phải nhập hàng mà thu nhập cao hơn bày sạp.</p>
      <div class="stats-line"><span>Giá thuê: <b>${fmt(cost)}</b></span><span>Cần cấp: <b>${lvl}</b></span><span>Tiền đang có: <b>${fmt(S.money)}</b></span></div>
      <div class="btn-row"><button class="btn" data-act="rent" ${S.level < lvl || S.money < cost ? 'disabled' : ''}>Thuê mặt bằng</button></div>`;
  }
  if (!G.open) {
    const [cost, lvl] = gianCost(si, i);
    return `<p class="event-text">${lotName(i)[0].toUpperCase() + lotName(i).slice(1)} ở Khu phố ${si + 1} đang <b>cho thuê</b>. Thuê rồi là có chỗ bày thêm một sạp. Lô mở lần lượt: hàng 1 trước, hàng 2 sau, thuê đủ 6 lô mới mở khu phố kế tiếp.</p>
      <div class="stats-line"><span>Giá thuê: <b>${cost ? fmt(cost) : 'Miễn phí'}</b></span><span>Cần cấp: <b>${lvl}</b></span><span>Tiền đang có: <b>${fmt(S.money)}</b></span></div>
      <div class="btn-row"><button class="btn" data-act="rent" ${S.level < lvl || S.money < cost ? 'disabled' : ''}>Thuê ${lotName(i)}</button></div>`;
  }
  if (isShopLot(si, i)) return shopHTML(si, i);
  if (!G.placed) return lotHTML(si, i);
  const open = slotsOpen(G), cap = slotCap(G);
  const cells = G.slots.map((s, k) => {
    if (k >= open) {
      const need = STALL_ORDER.find((t) => SLOT_OPEN[t] > k);
      return `<div class="slot-cell locked"><span class="lk">Khóa</span><small>Lên ${STALLS[need].name} để mở</small></div>`;
    }
    const sel = R.slotSel === k ? ' sel' : '';
    if (!s.qty) return `<button class="slot-cell empty${sel}" data-slot="${k}"><span class="plus">+</span><small>Ô ${k + 1} · bày hàng</small></button>`;
    const g = GOODS[s.good];
    return `<button class="slot-cell${sel}" data-slot="${k}">${themeHit(si, s.good) ? '<span class="x2" title="Hợp gu khu phố">×2</span>' : ''}<span class="si">${g.icon}</span><b>${g.name}</b><span class="meter"><i style="width:${(s.qty / cap) * 100}%"></i></span><small>${s.qty}/${cap} · ${fmtK(unitPrice(G, s.good, si))}/món</small></button>`;
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
      ${picks.length ? `<div class="pick-grid">${picks.map((id) => `<button class="pick" data-stock="${id}"><span class="pi">${GOODS[id].icon}</span><span><b>${GOODS[id].name}</b><small>Kho còn ${S.kho[id]}${themeHit(si, id) ? ` · hợp gu ${kpTheme(si).bonus === 'price' ? 'giá' : 'khách'} ×2` : ''}${s.good === id && s.qty ? ' · thêm vào' : s.qty ? ' · thay món' : ''}</small></span></button>`).join('')}</div>`
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
      <button class="btn paper" data-act="pickup" ${S.bike.length + 1 > MAX_UNITS ? 'disabled' : ''}>Cất sạp, để trống lô</button>
    </div>
    <div class="gian-side">
      <div class="gian-card">
        <div class="kv"><span>${STALLS[G.stall].name} · ${lotName(i)}</span><b>${open}/6 ô mở</b></div>
        <div class="kv"><span>Người bán</span><b>${G.seller ? G.seller.name : '—'}${G.sellerAway ? ' (đang chạy ra)' : ''}</b></div>
        <div class="kv"><span>Tốc độ bán</span><b>${rate ? '~' + (rate * 60).toFixed(1).replace('.', ',') + ' món/phút' : 'Đứng yên'}</b></div>
        <div class="kv"><span>Tiền trong két</span><b>${fmt(G.cash)}</b></div>
        <div class="kv"><span>Gu ${kpLabel(si)}</span><b>${themeIcons(si)} ${kpTheme(si).bonus === 'price' ? 'giá ×2' : 'khách ×2'}</b></div>
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
  return `<div class="news-list">${S.news.map((n) => `<div class="news-item ${n.kind}"><span class="when">${gclock(n.t)}</span><span>${n.text}</span></div>`).join('')}</div>`;
}
function street2HTML() {
  return `<p class="event-text">Khu phố 2 nằm ngay mặt đường lớn, người qua lại đông hơn nên hàng bán nhanh hơn 30%. Có thêm 6 gian để thuê.</p>
    <div class="stats-line"><span>Giá: <b>${fmt(STREET2.price)}</b></span><span>Cần cấp: <b>${STREET2.lvl}</b></span><span>Tiền đang có: <b>${fmt(S.money)}</b></span></div>
    <div class="btn-row"><button class="btn" data-act="street2" ${S.level < STREET2.lvl || S.money < STREET2.price ? 'disabled' : ''}>Mua Khu phố 2</button></div>`;
}
function openGian(si, i) {
  const G = S.streets[si].gians[i];
  if (G.open && !G.placed && !isShopLot(si, i)) { openLot(si, i); return; }
  R.gianTab = 'hang';
  R.slotSel = G.open ? (G.slots.findIndex((sl, k) => k < slotsOpen(G) && !sl.qty) >= 0 ? G.slots.findIndex((sl, k) => k < slotsOpen(G) && !sl.qty) : null) : null;
  openModal(`${isShopLot(si, i) ? (G.biz ? SHOP_TYPES[G.biz].name : 'Mặt bằng') : 'Sạp'} · ${lotName(i)} · ${kpLabel(si)}`, gianHTML(si, i), { kind: 'gian', arg: [si, i] }); }
const openMarket = () => openModal('Chợ đầu mối', marketHTML(), { kind: 'market' });
const openKho = () => openModal('Kho hàng', khoHTML(), { kind: 'kho' });
const openNeighbors = () => openModal('Hàng xóm', neighborsHTML(), { kind: 'neighbors' });
const openFashion = () => openModal('Tiệm thời trang', fashionHTML(), { kind: 'fashion' });
function openNews() { R.unread = 0; renderTop(); openModal('Tin khu phố', newsHTML(), { kind: 'news' }); }
function openCafe() {
  enterView('cafe');
  if (!S.tips.cafe) { S.tips.cafe = 1; toast('Quán cà phê là chỗ tụ tập. Gõ chat ở dưới, bấm vào ai đó để xem hồ sơ và <b>sang nhà</b> họ chơi.', 'gold'); }
}

$('modal-body').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (R.modal === 'pickchar') return onPickChar(d);
  if (R.modal === 'fun') return onFunClick(d);
  if (R.modal === 'veso') return onVesoClick(d);
  if (R.modal === 'mock' && d.mock) return onMockAct(d.mock);
  const [si, i] = Array.isArray(R.modalArg) ? R.modalArg : [];
  if ((R.modal === 'lot' || R.modal === 'gian') && onLotAct(d, si, i)) return;
  if (d.buy) return addCart(d.buy, d.n);
  if (d.reply) { replyReview(Number(d.rid), d.reply); refreshModal(); renderTop(); return; }
  if (d.barg) { bargain(R.modalArg, Number(d.barg)); refreshModal(); return; }
  if (d.visit) return visitNeighbor(d.visit);
  if (d.thug) return resolveThug(d.thug);
  if (d.biz) { openBiz(si, i, d.biz); refreshModal(); return; }
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
  else if (d.setchar) { if (CHARS[d.setchar] && S.money >= CHAR_SWAP) { S.money -= CHAR_SWAP; S.player.char = d.setchar; Snd.buy(); toast(`Giờ bạn là <b>${CHARS[d.setchar].name}</b>. ${CHARS[d.setchar].perk}.`, 'good'); } }
  else if (d.wear) { const f = FASHION[d.wear]; S.outfit[f.slot] = S.outfit[f.slot] === d.wear ? null : d.wear; Snd.click(); }
  else switch (d.act) {
    case 'credit': R.credit = !R.credit; Snd.click(); break;
    case 'checkout': checkout(); break;
    case 'cart-clear': R.cart = {}; Snd.click(); break;
    case 'repay': repayDebt(); break;
    case 'kho': upgradeKho(); break;
    case 'autostock': autoStock(); break;
    case 'rent': rentGian(si, i); if (isShopLot(si, i) && S.streets[si].gians[i].open) { openGian(si, i); return; } if (!R.modal) return; break;
    case 'bizup': upgradeBiz(si, i); break;
    case 'bizclose': closeBiz(si, i); break;
    case 'pickup': pickupUnit(si, i); closeModal(); return;
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
  const kps = Array.from({ length: KP_COUNT }, (_, k) => {
    const locked = !kpOpen(k);
    return `<button class="kp${cur === 'kp' + k ? ' on' : ''}${locked ? ' locked' : ''}${isVip(k) ? ' vip' : ''}" data-go="kp${k}" title="${locked ? `${kpLabel(k)}: thuê đủ 6 lô ${kpLabel(k - 1)} để mở` : `${kpLabel(k)} · ${KP_NAMES[k]}${isVip(k) ? ' (phố mặt tiền, thuê tiệm được)' : ''}`}"><span class="kp-sign">${locked ? '<i class="kp-lock" aria-hidden="true"></i>' : ''}KP ${k + 1}</span><span class="kp-post"></span><span class="kp-pin"></span></button>`;
  }).join('');
  const ic = (go, icon, label) => `<button class="nav-ic${cur === go ? ' on' : ''}" data-go="${go}"><span class="ni" aria-hidden="true">${icon}</span><span class="nl">${label}</span></button>`;
  $('dock').innerHTML = `${ic('home', '🏠', 'Nhà riêng')}<div class="kp-track"><span class="kp-road"></span>${kps}</div>${ic('market', '🛒', 'Chợ')}${ic('cafe', '☕', 'Cà phê')}${ic('fish', '🎣', 'Hồ câu')}${ic('kho', '🎒', 'Túi đồ')}`;
  renderTop();
  renderCtx();
}
// nút chức năng góc trên: báo, tin, góp ý, thành tựu, hàng xóm, nhân vật, thử nghiệm
function renderTop() {
  const badge = (n) => (n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : '');
  const top = (nav, icon, label, title, n, cls = '') => `<button class="top-ic${cls}" data-nav="${nav}" title="${title}" aria-label="${label}"><span aria-hidden="true">${icon}</span>${badge(n)}<em>${label}</em></button>`;
  $('topicons').innerHTML = top('paper', '🗞️', 'Báo', 'Báo Vỉa Hè: tin nóng mỗi ngày (P)', S.paperSeen !== gameDay() ? 1 : 0)
    + top('news', '🔔', 'Tin', 'Tin khu phố (N)', R.unread)
    + top('reviews', '💬', 'Góp ý', 'Góp ý của khách (G)', unanswered())
    + top('ach', '🏆', 'Thành tựu', 'Thành tựu (J)', R.achNew || 0)
    + top('neighbors', '👥', 'Hàng xóm', 'Hàng xóm (X)', 0)
    + top('char', '👕', 'Nhân vật', 'Nhân vật (T)', 0)
    + top('mock', '🧪', 'Thử', 'Bảng thử nghiệm: nạp dữ liệu thử, gọi sự kiện', 0, ' test');
}
// Nút riêng của từng cảnh, nổi phía trên thanh dưới
function renderCtx() {
  const C = $('ctx');
  let html = '';
  if (R.view === 'street') {
    const cash = S.streets[S.cur].gians.reduce((a, g) => a + g.cash, 0);
    const T = kpTheme(S.cur);
    html = `<div class="ctx-card theme-card" title="${esc(themeLine(S.cur))}"><b>${themeIcons(S.cur)} Gu ${T.tag.toLowerCase()}</b><small>${T.bonus === 'price' ? 'Bán giá ×2' : 'Khách mua ×2'} · đông ${hoursText(T.peak)}</small></div><button class="btn green auto-btn" data-nav="autoplace" title="Đem hết sạp đang cất ra lô trống và châm đầy hàng từ kho">Bày tự động<kbd>B</kbd></button><button class="btn coin-btn" data-nav="collect"><span>Thu tiền</span><b>${fmtK(cash)}</b><kbd>Space</kbd></button>`;
  } else if (R.view === 'neighbor') {
    const tools = [['hand', 'Tay không', 'Dọn giúp · chôm két'], ['goods', 'Chôm hàng', '3 sức'], ['trash', 'Vứt rác', '2 sức'], ['rat', 'Thả chuột', '3 sức']];
    html = `<div class="ctx-card"><div class="tools">${tools.map(([k, n, s]) => `<button class="tool${R.tool === k ? ' on' : ''}" data-tool="${k}">${n}<small>${s}</small></button>`).join('')}</div>
      <p class="ctx-note">${R.tool === 'hand' ? 'Bấm rác, chuột để dọn giúp. Bấm đồng xu trên gian để chôm tiền két.' : `Bấm vào một gian để ${R.tool === 'goods' ? 'lẻn bốc hàng trên sạp về kho' : R.tool === 'trash' ? 'vứt rác' : 'thả chuột'}. Uy tín giảm, dễ bị bắt quả tang.`}</p></div>`;
  } else if (R.view === 'cafe') {
    // thanh gọn phía trên, chừa chỗ cho bàn ghế và người ngồi; lời chat hiện thành bong bóng trên đầu
    html = `<div class="ctx-card chat"><form id="chat-form" class="chat-form"><input id="chat-input" maxlength="80" autocomplete="off" placeholder="Nói gì đó… (Enter để gửi)" aria-label="Tin nhắn" /><button class="mini" type="submit">Gửi</button></form></div>
      <button class="btn green" data-nav="fun">Trò chơi</button><button class="btn blue" data-nav="veso">Vé số</button><button class="btn" data-nav="cafelist">Mời cà phê</button>`;
  } else if (R.view === 'fish') {
    const FS = S.fishing, F = R.fish;
    const label = F.state === 'bite' ? 'GIẬT!' : F.state === 'wait' || F.state === 'cast' ? 'Đang chờ…' : F.state === 'reel' ? 'Kéo lên…' : 'Thả câu';
    html = `<div class="ctx-card"><div class="tools">${Object.entries(BAITS).map(([id, b]) => `<button class="tool${FS.use === id ? ' on' : ''}" data-baituse="${id}">${b.icon} ${b.name}<small>Còn ${FS.bait[id] || 0}</small></button>`).join('')}</div>
      <p class="ctx-note">${areaPeak('fish') ? '<b>Đang giờ cá cắn mạnh:</b> cá cắn nhanh, cá hiếm hay ăn mồi.' : AREA_TIME.fish.text + '.'}</p>
      <div class="btn-row"><button class="btn paper" data-nav="basket">Giỏ cá ${FS.basket.length}/${BASKET_CAP} · ${fmtK(basketValue())}</button><button class="btn paper" data-nav="book">Sổ câu</button><button class="btn" data-nav="fishshop">Đồ câu</button></div></div>
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
    if (go === 'kho') openKho();
    else if (!R.trip && !R.dlg) startTrip('bike', go);
    return;
  }
  const nav = t.dataset.nav;
  if (nav === 'kho') openKho();
  else if (nav === 'neighbors') openNeighbors();
  else if (nav === 'fashion' || nav === 'char') openChar();
  else if (nav === 'cafelist') openModal('Quán cà phê cóc', cafeHTML(), { kind: 'cafe' });
  else if (nav === 'collect') { collectAll(); renderCtx(); }
  else if (nav === 'news') openNews();
  else if (nav === 'paper') openPaper();
  else if (nav === 'reviews') openReviews();
  else if (nav === 'ach') openAch();
  else if (nav === 'mock') openMock();
  else if (nav === 'autoplace') autoPlaceAll();
  else if (nav === 'fun') openFun();
  else if (nav === 'veso') openVeso('buy');
  else if (nav === 'fishact') fishAction();
  else if (nav === 'basket') openModal('Giỏ cá', basketHTML(), { kind: 'basket' });
  else if (nav === 'book') openModal('Sổ câu', bookHTML(), { kind: 'book' });
  else if (nav === 'fishshop') openModal('Tiệm đồ câu', fishShopHTML(), { kind: 'fishshop' });
}
['dock', 'ctx', 'topicons'].forEach((id) => $(id).addEventListener('click', onUiClick));
$('modal-body').addEventListener('input', (e) => {
  if (e.target.id === 'char-name') { S.player.name = e.target.value.trim().slice(0, 16) || 'Bạn'; }
  if (e.target.id === 'pc-name') R.pickName = e.target.value;
});

function updateHUD() {
  renderQuest();
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
  $('debt-val').textContent = S.debt ? 'Nợ ' + fmtK(S.debt) : 'Không nợ';
  $('debt-val').classList.toggle('owe', S.debt > 0);
  $('place-val').textContent = R.view === 'neighbor' ? 'Nhà ' + nbBase(R.visit).name : R.view === 'cafe' ? `Quán cà phê · ${Net.roomPlayers().length + 1} người` : R.view === 'fish' ? 'Hồ câu' : R.view === 'home' ? 'Nhà riêng' : R.view === 'market' ? `Chợ đầu mối${areaPeak('market') ? ' · chợ sớm' : ''}` : `Khu phố ${S.cur + 1}${kpPeak(S.cur) ? ' · giờ đông khách' : kpSlow(S.cur) ? ' · giờ vắng' : ''}`;
  $('clock-pill').title = `Ngày ${gameDay()} trong game. Một ngày trong game dài 24 phút.`;
  $('clock-val').textContent = `N${gameDay()} · ${gclock()}`;
}

// ================================================================
//  VẼ CẢNH
// ================================================================
function buildBg(id) {
  const wide = false;
  const isSt = id.startsWith('street') || id.startsWith('nb_');
  const stIdx = id.startsWith('street_') ? Number(id.slice(7)) || 0 : 0;
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
  else if (isSt && isVip(stIdx)) { let xx = -10 - PM; while (xx < SW + PM + 10) { const w = 150 + Math.floor(rnd() * 70); drawHouse(g, xx, w, rnd, rp, lights, ST_GROUND, 3); xx += w; } }
  else if (isSt) drawWallBg(g, rnd, rp, lights, PM, stIdx);
  g.restore();
  if (isSt) {
    drawStreetGround(g, rnd, BW, stIdx % 2 === 1 || isVip(stIdx) || id.startsWith('nb_'));
    drawHydrant(g, PM + 1200, 548); drawBin(g, PM + 60, 360);
    drawWires(g, rnd, BW);
    return { canvas: c, lights, lamps };
  }
  drawSidewalk(g, rnd, BW, wide, false);
  if (id === 'home') drawBin(g, 1110 + PM, 556);
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
function drawHouse(g, x, w, rnd, rp, lights, gb = GROUND, maxFloors = 4) {
  const FH = 76;
  const floors = 2 + Math.floor(rnd() * (maxFloors - 1));
  const h = floors * FH + 14;
  const top = gb - h;
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
  const gy = gb - FH + 10;
  const signY = gy - 26;
  if (rnd() < 0.3) {
    g.fillStyle = '#A3ABB0'; g.fillRect(x + 8, gy, w - 16, gb - gy);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath();
    for (let k = gy + 4; k < gb; k += 5) { g.moveTo(x + 8, k); g.lineTo(x + w - 8, k); }
    g.stroke();
  } else {
    g.fillStyle = '#3B2E2A'; g.fillRect(x + 8, gy, w - 16, gb - gy);
    lights.push({ x: x + 8, y: gy, w: w - 16, h: gb - gy, on: true, warm: true, shop: true });
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
    for (let i = 0; i <= 6; i++) { const x = STREET_PAD + i * GIAN_W; g.beginPath(); g.moveTo(x, GROUND + 10); g.lineTo(x, FRONT_Y - 30); g.stroke(); }
    g.setLineDash([]);
  }
  g.fillStyle = '#9A948A'; g.fillRect(0, CURB, BW, 10);
  g.fillStyle = '#6F6A62'; g.fillRect(0, CURB + 10, BW, 4);
  g.fillStyle = '#44474F'; g.fillRect(0, CURB + 14, BW, H - CURB - 14);
  g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < BW / 4; i++) g.fillRect(rnd() * BW, CURB + 14 + rnd() * (H - CURB), 2, 2);
  g.fillStyle = '#E8C547'; for (let x = 20; x < BW; x += 140) g.fillRect(x, 690, 70, 6);
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
  if (p.look.chibi) return drawChibi(g, p);
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
// ---------- Nhân vật chính dạng khung hình vẽ sẵn ----------
// Đứng, đi, chạy, câu cá, đánh nhau, bị đánh, tương tác. Tắt được ở Bảng thử nghiệm để quay về dáng chibi vẽ bằng code.
const heroImg = new Image();
heroImg.src = import.meta.env.BASE_URL + 'sprites/hero.webp';
const HERO_K = 150 / 185;   // khung cao ~185px, dáng chibi cũ cao ~150
const HERO_IDLE = [0, 1, 2, 3, 2, 1, 0, 0, 4, 5, 4, 0, 0, 1, 6, 6, 0, 0];
const heroOn = () => !S.flags.oldLook && heroImg.complete && heroImg.naturalWidth > 0;
// diễn một đoạn rồi trở lại dáng thường; hold: số giây giữ khung cuối
function heroAct(anim, seq, fps, hold = 0) { R.me.act = { anim, seq, fps, hold, t: 0 }; }
function updateHeroAct(dt) {
  const A = R.me.act;
  if (A && (A.t += dt) > A.seq.length / A.fps + A.hold) R.me.act = null;
}
// khung đang diễn: [anim, số khung]
function heroPose(M) {
  const A = M.act;
  if (A) return [A.anim, A.seq[Math.min(Math.floor(A.t * A.fps), A.seq.length - 1)]];
  if (R.fight) return ['attack', 0];
  if (M.moving) {
    const run = Math.hypot(M.tx - M.x, M.ty - M.y) > 320;
    return run ? ['run', Math.floor(M.phase * 1.3) % 6] : ['walk', Math.floor(M.phase * 1.1) % 8];
  }
  return ['idle', HERO_IDLE[Math.floor(R.t * 5) % HERO_IDLE.length]];
}
function drawHero(g, x, y, s, dir, anim, k) {
  const f = HERO_FRAMES[anim][k], sc = s * HERO_K;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, 0, 24 * s, 6 * s, 0, 0, Math.PI * 2); g.fill();
  g.scale(sc * (dir < 0 ? -1 : 1), sc);
  g.drawImage(heroImg, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  g.restore();
}
// Nhân vật chính kiểu chibi (theo ảnh mẫu): đầu to, búi tóc, nón lá quai đỏ, áo bà ba nâu, quần ống rộng, dép.
// Quay mặt sang phải, chân ở y = 0, cao ~150 kể cả nón; vẫn ăn theo đồ mặc trong tủ (màu áo, quần, nón, giày, phụ kiện).
const CHIBI = { ol: '#3B2A20', skin: '#F6D7BE', hair: '#3A2A22', shirt: '#7E5538', pants: '#2F2420', straw: '#DDBF8E', strap: '#9A2E24', eye: '#4A2E1E', shoes: '#2A211B' };
function drawChibi(g, p) {
  const L = p.look, s = L.scale || 1, C = CHIBI;
  const skin = L.skin || C.skin, hair = L.hair || C.hair, shirt = L.shirt || C.shirt, pants = L.pants || C.pants, shoes = L.shoes || C.shoes;
  const sw = p.moving ? Math.sin(p.phase) : 0;
  const by = p.moving ? -Math.abs(Math.cos(p.phase)) * 2.5 : 0;   // nhún nhẹ khi đi
  g.save();
  g.translate(p.x, p.y);
  if (!p.seated) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, 0, 22 * s, 5.5 * s, 0, 0, Math.PI * 2); g.fill(); }
  g.scale(s * (p.dir < 0 ? -1 : 1), s);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = C.ol; g.lineWidth = 1.6;
  const fo = (fill) => { g.fillStyle = fill; g.fill(); g.stroke(); };
  const foot = (x, y) => {
    g.beginPath(); g.ellipse(x + 2, y - 2.5, 6.5, 3, 0, 0, Math.PI * 2); fo(skin);
    g.beginPath(); g.roundRect(x - 5, y - 1, 16, 3, 1.5); fo(shoes);
    g.strokeStyle = shoes; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 1, y - 4.5); g.lineTo(x + 5, y - 1); g.stroke();
    g.strokeStyle = C.ol; g.lineWidth = 1.6;
  };
  // chân: ống quần rộng túm ở cổ chân, xoay quanh hông
  const leg = (dx, ang, back) => {
    const col = back ? shade(pants, -14) : pants;
    if (p.seated) {
      g.save(); g.translate(dx, 0);
      g.lineWidth = 17; g.strokeStyle = C.ol; g.beginPath(); g.moveTo(0, -32); g.lineTo(16, -30); g.lineTo(18, -9); g.stroke();
      g.lineWidth = 14; g.strokeStyle = col; g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = C.ol;
      foot(17, 0);
      g.restore();
      return;
    }
    g.save(); g.translate(dx, -34); g.rotate(ang);
    const hem = L.short ? 16 : 29;
    if (L.short) { g.beginPath(); g.roundRect(-4, 12, 8, 19, 4); fo(skin); }
    g.beginPath(); g.moveTo(-10, -2); g.quadraticCurveTo(-16, hem * 0.6, -7, hem); g.lineTo(7, hem); g.quadraticCurveTo(16, hem * 0.6, 10, -2); g.closePath(); fo(col);
    g.translate(0, 34); g.rotate(-ang); foot(-2, 0);
    g.restore();
  };
  // tay: ống tay áo rộng + bàn tay, xoay quanh vai; trả về vị trí bàn tay
  const arm = (ang, back) => {
    g.save(); g.translate(1, -64 + by); g.rotate(ang);
    const sl = L.style === 'tank' ? skin : back ? shade(shirt, -14) : shirt;
    g.beginPath(); g.moveTo(-5, -3); g.lineTo(5, -3); g.lineTo(10, 19); g.quadraticCurveTo(1, 23, -8, 20); g.closePath(); fo(sl);
    g.beginPath(); g.arc(1, 23.5, 4.3, 0, Math.PI * 2); fo(skin);
    if (L.acc === 'bracelet' && !back) { g.strokeStyle = '#8C5B2A'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-3, 20); g.lineTo(5, 20); g.stroke(); g.strokeStyle = C.ol; g.lineWidth = 1.6; }
    g.restore();
    return { x: 1 - 23.5 * Math.sin(ang), y: -64 + by + 23.5 * Math.cos(ang) };
  };
  const armF = p.rod ? -1.15 : p.seated ? -0.5 : p.moving ? -sw * 0.55 : 0.06;
  const armB = p.seated ? -0.3 : p.moving ? sw * 0.55 : -0.06;

  // lớp sau: chân sau, tay sau, búi tóc
  leg(-2, p.moving ? -sw * 0.38 : 0, true);
  arm(armB, true);
  if (!L.hairStyle || L.hairStyle === 'bun') { g.beginPath(); g.arc(-20, -88 + by, 8.5, 0, Math.PI * 2); fo(hair); }
  else if (L.hairStyle === 'pony') { g.beginPath(); g.moveTo(-14, -104 + by); g.quadraticCurveTo(-36, -96 + by, -30, -66 + by); g.quadraticCurveTo(-22, -80 + by, -12, -92 + by); g.closePath(); fo(hair); }
  // chân trước
  leg(3, p.moving ? sw * 0.38 : 0, false);
  // cổ + thân áo bà ba
  g.beginPath(); g.roundRect(-3, -74 + by, 7, 8, 2); fo(skin);
  const hemY = L.long_dress ? -14 : -28;
  g.beginPath();
  g.moveTo(-11, -68 + by); g.quadraticCurveTo(1, -73 + by, 12, -68 + by);
  g.quadraticCurveTo(17, -50 + by, 20, hemY + by); g.lineTo(-18, hemY + by);
  g.quadraticCurveTo(-16, -50 + by, -11, -68 + by); g.closePath(); fo(shirt);
  g.strokeStyle = 'rgba(35,26,20,.45)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(1, hemY + by); g.lineTo(1, hemY - 11 + by); g.stroke();              // xẻ tà
  g.strokeStyle = C.ol; g.lineWidth = 1.6;
  if (L.style === 'flower') { g.fillStyle = '#F7E1A0'; for (const [a, b] of [[-8, -60], [6, -56], [-3, -46], [10, -40], [-9, -36]]) { g.beginPath(); g.arc(a, b + by, 2.4, 0, 7); g.fill(); } }
  else if (L.style === 'aodai') { g.fillStyle = 'rgba(255,224,138,.85)'; g.fillRect(9, -68 + by, 3, hemY + 68); }
  else { g.fillStyle = C.ol; for (const yy of [-60, -49, -38]) { g.beginPath(); g.arc(13 + (yy + 60) * 0.12, yy + by, 1.6, 0, 7); g.fill(); } }  // nút áo
  if (L.style === 'collar') { g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(2, -70 + by); g.lineTo(12, -68 + by); g.lineTo(9, -62 + by); g.closePath(); fo('#FFFFFF'); }
  if (L.acc === 'scarf') { for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#F2F2EE' : '#231A14'; g.fillRect(-8 + k * 5, -72 + by, 5, 6); } }
  // tay trước
  const hand = arm(armF, false);
  if (p.rod) { g.strokeStyle = '#8C6A3A'; g.lineWidth = 3; g.beginPath(); g.moveTo(hand.x, hand.y); g.lineTo(hand.x + 120, hand.y - 150); g.stroke(); g.strokeStyle = C.ol; g.lineWidth = 1.6; }
  if (L.acc === 'book') { g.beginPath(); g.rect(hand.x - 2, hand.y - 9, 10, 13); fo('#C0392B'); }

  // đầu to
  const hy = -95 + by;
  g.beginPath(); g.arc(3, hy, 23, 0, Math.PI * 2); fo(skin);
  // tóc: phủ sau đầu và đỉnh, mái lòa xòa phía trước
  g.beginPath();
  g.arc(2, hy, 24.5, Math.PI * 0.72, Math.PI * 1.86);
  g.quadraticCurveTo(21, hy - 3, 14, hy - 4);
  g.quadraticCurveTo(8, hy - 2, 4, hy + 5);
  g.quadraticCurveTo(-4, hy + 11, -16, hy + 15);
  g.closePath(); fo(hair);
  g.strokeStyle = hair; g.lineWidth = 3; g.beginPath(); g.moveTo(5, hy + 2); g.quadraticCurveTo(8, hy + 12, 5, hy + 20); g.stroke();  // lọn tóc mai
  g.strokeStyle = C.ol; g.lineWidth = 1.6;
  g.beginPath(); g.ellipse(-2, hy + 7, 4, 5.5, 0, 0, Math.PI * 2); fo(skin);                     // tai
  // mặt: mắt to có đốm sáng, má hồng, miệng cười
  g.fillStyle = C.eye; g.beginPath(); g.ellipse(14, hy + 4, 3.4, 4.8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(15.2, hy + 2, 1.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = C.ol; g.lineWidth = 1.8; g.beginPath(); g.moveTo(10, hy - 1.5); g.quadraticCurveTo(14, hy - 3.5, 18.5, hy - 1); g.stroke();
  g.fillStyle = 'rgba(236,128,118,.45)'; g.beginPath(); g.ellipse(11, hy + 12, 4.6, 2.6, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 1.5; g.beginPath(); g.moveTo(18.5, hy + 13); g.quadraticCurveTo(21, hy + 16, 23.5, hy + 12.5); g.stroke();
  if (L.glasses || L.acc === 'glasses') { g.beginPath(); g.arc(14, hy + 4, 6, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(8, hy + 3); g.lineTo(-1, hy + 2); g.stroke(); }
  g.lineWidth = 1.6;
  drawChibiHat(g, L, hy);
  g.restore();
}
function drawChibiHat(g, L, hy) {
  const C = CHIBI, fo = (fill) => { g.fillStyle = fill; g.fill(); g.stroke(); };
  if (L.hat === 1) {
    // quai nón đỏ thắt nơ dưới cằm
    g.strokeStyle = C.strap; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(-1, hy - 14); g.quadraticCurveTo(0, hy + 13, 13, hy + 21); g.stroke();
    g.fillStyle = C.strap; g.beginPath(); g.moveTo(13, hy + 21); g.lineTo(8, hy + 17); g.lineTo(8, hy + 25); g.closePath(); g.moveTo(13, hy + 21); g.lineTo(18, hy + 17); g.lineTo(18, hy + 25); g.closePath(); g.fill();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(13, hy + 21); g.lineTo(11, hy + 30); g.moveTo(13, hy + 21); g.lineTo(15, hy + 30); g.stroke();
    g.strokeStyle = C.ol;
    g.save(); g.translate(2, hy - 15); g.rotate(-0.1);
    g.beginPath(); g.ellipse(0, 0, 38, 6.5, 0, 0, Math.PI * 2); fo(shade(C.straw, -34));            // lòng nón
    g.beginPath(); g.moveTo(-38, 0); g.lineTo(-3, -40); g.lineTo(38, 0); g.ellipse(0, 0, 38, 2.8, 0, 0, Math.PI); g.closePath(); fo(C.straw);
    g.strokeStyle = 'rgba(120,90,40,.5)'; g.lineWidth = 1;
    g.beginPath(); for (let i = 1; i < 7; i++) { g.moveTo(-3, -40); g.lineTo(-38 + i * 76 / 7, 2.4); } g.stroke();
    g.beginPath(); g.moveTo(-24, -14); g.lineTo(23, -14); g.moveTo(-13, -26); g.lineTo(12, -26); g.stroke();
    g.restore();
  } else if (L.hat === 2) {
    g.beginPath(); g.arc(3, hy - 4, 26, Math.PI, 0); g.lineTo(29, hy + 2); g.lineTo(-23, hy + 2); g.closePath(); fo(L.helmet || '#D98E04');
    g.beginPath(); g.roundRect(14, hy - 3, 18, 5, 2); fo('#3A3A40');
  } else if (L.hat === 3) {
    g.beginPath(); g.arc(3, hy - 6, 24.5, Math.PI, 0); g.closePath(); fo(L.capColor || '#C0392B');
    g.beginPath(); g.ellipse(32, hy - 6, 13, 3.5, 0, 0, Math.PI * 2); fo(L.capColor || '#C0392B');
  } else if (L.hat === 4) {
    g.beginPath(); g.ellipse(3, hy - 12, 34, 6, 0, 0, Math.PI * 2); fo('#EFE2BF');
    g.beginPath(); g.arc(3, hy - 13, 21, Math.PI, 0); g.closePath(); fo('#EFE2BF');
    g.fillStyle = '#8B5A2B'; g.fillRect(-18, hy - 17, 42, 4);
  }
}
// dáng gốc của một nhân vật khi chưa sắm đồ
function charLook(c) {
  return { chibi: true, skin: c.skin, hair: c.hair, hairStyle: c.style, glasses: c.glasses, long: true, scale: 1.05, capColor: c.cap || '#C0392B', helmet: '#D98E04',
    hat: c.hat, shirt: c.shirt, style: c.tank ? 'tank' : c.collar ? 'collar' : undefined, pants: c.pants, short: !!c.short };
}
function playerLook() {
  const o = S.outfit, F = (slot) => (o[slot] ? FASHION[o[slot]] : null);
  const shirt = F('shirt'), pants = F('pants'), L = charLook(charOf());
  if (F('hat')) L.hat = F('hat').hat;
  if (shirt) { L.shirt = shirt.color; L.style = shirt.style; L.long_dress = shirt.style === 'aodai'; }
  if (pants) { L.pants = pants.color; L.short = !!pants.short; }
  L.shoes = F('shoes')?.shoes; L.acc = F('acc')?.acc;
  return L;
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
    if (d.look) drawPerson(g, { ...vendor, x, y: y - 10 });
    g.strokeStyle = '#8C6A3A'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 110, y + 8); g.lineTo(x + 110, y + 2); g.stroke();
    drawBasket(g, x - 60, y + 6, icons.slice(0, 2));
    drawBasket(g, x + 60, y + 6, icons.slice(2, 4));
    if (!d.open) { g.fillStyle = '#1F6F8B'; for (const bx of [-60, 60]) { rr(g, x + bx - 36, y - 44, 72, 14, 6); g.fill(); } }
  } else if (d.stall === 'xe_day') {
    if (d.look) drawPerson(g, vendor);
    wheel(g, x - 58, y - 20, 20); wheel(g, x + 58, y - 20, 20);
    g.fillStyle = '#9C6B3F'; rr(g, x - 92, y - 82, 184, 50, 6); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#FFF4D6'; g.fillRect(x - 80, y - 72, 160, 26);
    signText(g, d.label || 'HÀNG RONG', x, y - 60, 15, '#C0392B', 150);
    g.fillStyle = d.open ? 'rgba(200,230,245,.55)' : '#1F6F8B'; rr(g, x - 82, y - 134, 164, 52, 6); g.fill(); g.strokeStyle = '#6B4524'; g.lineWidth = 4; g.stroke();
    icons.slice(0, 5).forEach((it, k) => emoji(g, it, x - 60 + k * 30, y - 106, 26));
    g.strokeStyle = '#6B4524'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 92, y - 60); g.lineTo(x - 128, y - 84); g.stroke();
  } else if (d.stall === 'sap') {
    g.strokeStyle = '#6E6A64'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 112, y); g.lineTo(x - 112, y - 196); g.moveTo(x + 112, y); g.lineTo(x + 112, y - 196); g.stroke();
    if (d.look) drawPerson(g, vendor);
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
    if (d.look) drawPerson(g, { ...vendor, x: x + 30, y: y - 18 });
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
  const sc = d.scale ?? STALL_SCALE;
  g.translate(cx - STALL_X * sc, (d.base ?? STALL_BASE) - STALL_Y * sc);
  g.scale(sc, sc);
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
    return [...n.gians, ...Array.from({ length: 6 }, () => ({ open: false }))].map((g, i) => (i >= 6 ? { open: false } : { open: g.open, placed: g.open, stall: g.stall, good: g.good, qty: g.open ? 20 : 0, cash: g.cash, trash: g.trash, rat: g.rat, broken: false,
      du: i % 2 === 0, ghe: i % 3 === 0, bang: false, phep: false, paused: false, seed: hashStr(b.id) % 997, duCol: b.color, owner: b.name, cap: 20, goods: [g.good, b.goods[(i + 1) % b.goods.length]] }));
  }
  if (R.attract) {
    const demo = [['ganh', 'kem_chuoi', 1800], ['xe_day', 'banh_mi', 0], ['sap', 'ao_thun', 32000], ['kiot', 'giay', 0], ['xe_day', 'hot_vit', 9000], ['ganh', 'bap', 4000]];
    return demo.map(([stall, good, cash], i) => stall ? { open: true, placed: true, stall, goods: [good], cap: 20, qty: 20, cash, trash: i === 4 ? 1 : 0, rat: false, broken: false, du: true, ghe: i === 2, bang: i === 3, paused: false, seed: 0, owner: 'Vua Vỉa Hè' } : { open: false });
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
  if (R.trip?.phase === 'card') { drawTripCard(); R.hits = []; return; }
  const h = gameHour();
  const bg = getBg(bgIdNow());
  const hits = [];
  R.marks = [];
  const cam = Math.round(R.cam);
  ctx.clearRect(0, 0, W, H);
  drawSky(h);
  ctx.save();
  ctx.translate(-cam, 0);
  ctx.drawImage(bg.canvas, -sceneMargin(), 0);

  // các vật cần xếp theo chiều sâu (y)
  const layer = [];
  const signs = [];   // biển tên gian vẽ sau sạp để không bị mái bạt che
  const depth = (p, base = 1) => ({ ...p, look: { ...p.look, scale: (p.look.scale || 1) * base * personBase() * (R.view === 'cafe' ? 1 : depthScale(p.y)) } });
  const people = (list) => list.forEach((p) => layer.push({ y: p.y, draw: () => drawPerson(ctx, depth(p)) }));
  people(R.walkers);
  let gians = [];
  if (isStreetView()) {
    gians = currentGians();
    const mine = R.view === 'street' && !R.attract;
    const nl = mine ? nextLot() : null;
    gians.forEach((G, i) => {
      const cx = lotX(i), base = lotBase(i);
      if (R.view === 'street' && isShopLot(S.cur, i)) { drawShopFront(cx, G, i, S.cur, hits, nl); return; }
      // lô chưa thuê: chỉ lô kế tiếp mới có bảng cho thuê
      if (!G.open) {
        if (nl && nl.si === S.cur && nl.li === i) {
          const [cost, lvl] = gianCost(S.cur, i);
          layer.push({ y: base, draw: () => {
            ctx.fillStyle = '#E3C99A'; rr(ctx, cx - 72, base - 96, 144, 72, 6); ctx.fill(); ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.strokeStyle = '#6B4F3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 34, base - 24); ctx.lineTo(cx - 40, base); ctx.moveTo(cx + 34, base - 24); ctx.lineTo(cx + 40, base); ctx.stroke();
            signText(ctx, 'CHO THUÊ LÔ', cx, base - 74, 20, '#C0392B');
            ctx.font = '700 14px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#231A14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(S.level < lvl ? `Cần cấp ${lvl}` : cost ? fmt(cost) : 'Miễn phí', cx, base - 46);
          } });
          hits.push({ x: cx - 80, y: base - 104, w: 160, h: 108, kind: 'gian', i, pri: 1 });
        }
        return;
      }
      // lô đã thuê, chưa bày sạp: kẻ vạch trên vỉa hè
      if (!G.placed) {
        const hov = R.hover && R.hover.kind === 'lot' && R.hover.i === i;
        layer.push({ y: base - 60, draw: () => {
          if (hov) { ctx.fillStyle = 'rgba(237,194,94,.3)'; rr(ctx, cx - 105, base - 62, 210, 68, 10); ctx.fill(); }
          ctx.strokeStyle = hov ? '#EDC25E' : 'rgba(255,244,214,.8)'; ctx.lineWidth = hov ? 4 : 3; ctx.setLineDash([12, 8]);
          rr(ctx, cx - 105, base - 62, 210, 68, 10); ctx.stroke(); ctx.setLineDash([]);
          signText(ctx, hov ? '+ BÀY SẠP' : `LÔ ${i + 1} · TRỐNG`, cx, base - 28, hov ? 20 : 15, hov ? '#231A14' : 'rgba(255,244,214,.9)');
        } });
        if (mine) hits.push({ x: cx - 110, y: base - 72, w: 220, h: 82, kind: 'lot', i, pri: 1 });
        return;
      }
      const gl = G.goods || [];
      const title = gl.length > 1 ? 'TẠP HÓA' : gl.length ? GOODS[gl[0]].name.toUpperCase() : 'HÀNG RONG';
      const icons = gl.length && G.qty > 0 ? Array.from({ length: 8 }, (_, k) => GOODS[gl[k % gl.length]].icon) : [];
      layer.push({ y: base, draw: () => {
        drawGianStall(ctx, cx, { base, scale: 0.68, stall: G.stall, icons, open: !G.paused && G.qty > 0, look: G.sellerAway ? null : (G.seller ? sellerLookFor(G.seller) : sellerLook(i, G.seed)),
          du: G.du, ghe: G.ghe, bang: G.bang, duCol: G.duCol, label: title });
        if (G.broken) {
          ctx.strokeStyle = '#E8C547'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx - 85, base - 150); ctx.lineTo(cx + 85, base); ctx.moveTo(cx + 85, base - 150); ctx.lineTo(cx - 85, base); ctx.stroke();
          ctx.strokeStyle = '#231A14'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
        }
      } });
      for (let k = 0; k < Math.min(3, G.trash); k++) {
        const tx = cx - 60 + k * 55, ty = Math.min(base + 18 + (k % 2) * 10, ST_WALK.y1 + 4);
        layer.push({ y: ty, draw: () => drawTrash(ctx, tx, ty, k) });
        hits.push({ x: tx - 24, y: ty - 36, w: 48, h: 44, kind: 'trash', i, pri: 2, wx: tx, wy: ty });
      }
      if (G.rat) { const rx = cx + 90, ry = Math.min(base + 24, ST_WALK.y1 + 6); layer.push({ y: ry, draw: () => drawRat(ctx, rx, ry) }); hits.push({ x: rx - 34, y: ry - 30, w: 68, h: 40, kind: 'rat', i, pri: 2, wx: rx, wy: ry }); }
      hits.push({ x: cx - 100, y: base - 172, w: 200, h: 176, kind: 'gian', i });
    });
    for (const p of portalsFor()) { const hb = drawPortal(p); hits.push(hb); }
    if (R.view === 'street') { people(R.guests); drawActor(layer, hits); }
    // người bán đang chạy ra lô
    for (const r of R.runners) {
      if (r.si !== S.cur || R.view !== 'street') continue;
      layer.push({ y: r.y, draw: () => { const sc = 1.05 * personBase() * depthScale(r.y); drawPerson(ctx, { x: r.x, y: r.y, dir: r.dir, look: { ...r.look, scale: sc }, moving: true, phase: r.phase }); nameTag(ctx, r.name, r.x, r.y - 152 * sc, false, 'Đang chạy ra lô…'); } });
    }
  } else if (R.view === 'home') {
    homeObjects(hits, layer);
    for (const p of portalsFor()) hits.push(drawPortal(p));
  } else if (R.view === 'cafe') drawCafeScene(hits, layer);
  else if (R.view === 'fish') drawPondScene(hits);
  else if (R.view === 'market') { marketObjects(hits, layer); drawParkingSign(hits); for (const p of portalsFor()) hits.push(drawPortal(p)); }

  if (R.view === 'street' && !R.attract) {
    people(R.buyers);
    for (const v of R.visitors) {
      const b = nbBase(v.id), p = depth({ ...v, look: { scale: 1.15, ...npcLook(v.id) } });
      layer.push({ y: v.y, draw: () => { drawPerson(ctx, p); nameTag(ctx, b.name, v.x, v.y - 152 * p.look.scale, false, `Cấp ${nbState(v.id).lvl}`); } });
      hits.push({ x: v.x - 30, y: v.y - 175, w: 60, h: 180, kind: 'visitor', id: v.id, pri: 2 });
    }
  }
  if (R.view === 'neighbor') {
    const b = nbBase(R.visit), ox = 420, oy = 548;
    layer.push({ y: oy, draw: () => { drawPerson(ctx, { x: ox, y: oy, dir: 1, look: { scale: 1.15, ...npcLook(R.visit) }, moving: false, phase: 0 }); nameTag(ctx, b.name, ox, oy - 172, false, 'Chủ nhà'); } });
  }
  if (R.started && !R.attract && R.view !== 'fish' && R.view !== 'cafe' && !R.me.hidden) {
    const M = R.me;
    layer.push({ y: M.y, draw: () => {
      const sc = 1.2 * personBase() * depthScale(M.y);
      if (heroOn()) drawHero(ctx, M.x, M.y, sc, M.dir, ...heroPose(M));
      else drawPerson(ctx, { x: M.x, y: M.y, dir: M.dir, look: { ...playerLook(), scale: sc }, moving: M.moving, phase: M.phase });
      nameTag(ctx, S.player.name, M.x, M.y - 152 * sc, true, `Cấp ${S.level}`);
    } });
  }
  // sạp nằm sát nhà (y nhỏ) vẽ trước, rồi tới biển tên, rồi người và vật trên vỉa hè
  const back = layer.filter((o) => o.y <= STALL_BASE).sort((a, b) => a.y - b.y), front = layer.filter((o) => o.y > STALL_BASE).sort((a, b) => a.y - b.y);
  back.forEach((o) => o.draw());
  signs.forEach((f) => f());
  front.forEach((o) => o.draw());
  if (R.view === 'home' || (R.view === 'street' && !R.attract)) drawVehicles(hits);
  if (R.view !== 'fish' && R.view !== 'cafe' && R.view !== 'market') for (const b of [...R.bikes].sort((a, b2) => a.y - b2.y)) drawBike(ctx, b);
  if (R.police?.phase === 'drive') drawTruck(ctx, R.police.x, isStreetView() ? 664 : 680);
  if (R.view === 'street' && !R.attract) drawRoad(hits);
  drawRain();

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
      if (!G.placed) return;
      const lx = lotX(i), ly = lotBase(i) - 70;
      const gr = ctx.createRadialGradient(lx, ly - 30, 4, lx, ly, 180);
      gr.addColorStop(0, `rgba(255,220,140,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(lx, ly, 180, 0, 7); ctx.fill();
    });
    ctx.restore();
  }

  // bảng hàng + két tiền trên đầu mỗi gian
  gians.forEach((G, i) => {
    if (!G.placed && !G.biz) return;
    const cx = lotX(i), by = G.biz ? ST_GROUND - 122 : lotBase(i) - 206;
    if (R.view === 'street' && !G.biz) {
      const cap = G.cap || 1, gl = G.goods || [];
      ctx.save(); ctx.translate(0, by - 226);
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
      ctx.restore();
    }
    const cry = R.view === 'street' && !G.biz && R.cries[S.cur + '-' + i];
    if (cry) bubble(cry.text, cx + 60, by - 46, { size: 15, bg: '#FFF4D6', maxW: 300 });
    if (G.cash >= 500) {
      const r = clamp(17 + Math.sqrt(G.cash) / 20, 17, 28);
      const y = by - 38 + Math.sin(R.t * 3 + i) * 3;
      ctx.fillStyle = '#F7C948'; ctx.strokeStyle = '#8C6A12'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6B4E0C'; ctx.font = `800 ${Math.round(r * 0.72)}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtK(G.cash), cx, y + 1, r * 1.8);
      hits.push({ x: cx - r - 8, y: y - r - 8, w: 2 * r + 16, h: 2 * r + 16, kind: 'cash', i, pri: 3 });
    }
  });

  if (R.police?.stopped) bubble('Lập biên bản!', R.police.x + 120, 500, { size: 18, bg: '#F9C9C0' });
  // lời nói
  if (R.view === 'cafe') for (const s of R.cafeSeats || []) { const say = R.cafeSay[s.id]; if (say) bubble(say.text, s.x, s.top - 30, { size: 14, maxW: 260 }); }
  if (R.view === 'street') for (const v of R.visitors) { const say = R.cafeSay[v.id]; if (say) bubble(say.text, v.x, v.y - 152 * 1.15 * depthScale(v.y) - 40, { size: 14, maxW: 260 }); }
  if (R.cafeSay.me && R.view !== 'cafe') bubble(R.cafeSay.me.text, R.me.x, R.me.y - 152 * 1.2 * depthScale(R.me.y) - 40, { size: 14, maxW: 260 });
  if (R.view === 'fish') drawFishOverlay();
  // điểm đến khi bấm đi
  if (R.me.moving && !R.keys.size && R.view !== 'fish') { ctx.strokeStyle = 'rgba(255,244,214,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(R.me.tx, R.me.ty, 16, 5, 0, 0, 7); ctx.stroke(); }
  drawMarks();
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
    const x = seated ? CAFE_TABLES[k] - 60 : 1100, y = seated ? 540 : 596;
    const look = { scale: 1.1, ...pl.look };
    const top = y - 150 * look.scale;
    layer.push({ y: seated ? 572 : y, draw: () => { drawPerson(ctx, { x, y, dir: seated ? 1 : -1, look, seated, moving: false, phase: 0 }); nameTag(ctx, pl.name, x, top, false, `Cấp ${pl.level}`); } });
    seats.push({ id: pl.id, x, top: top - 24 });
    hits.push({ x: x - 34, y: top - 24, w: 68, h: y - top + 30, kind: 'cafe', id: pl.id, pri: 2 });
  });
  const my = M.sit ? { x: M.sit.x, y: 540, seated: true } : { x: M.x, y: M.y, seated: false };
  const top = my.y - 150 * 1.2;
  layer.push({ y: M.sit ? 573 : M.y, draw: () => {
    if (heroOn() && !M.sit) drawHero(ctx, my.x, my.y, 1.2, M.dir, ...heroPose(M));
    else drawPerson(ctx, { x: my.x, y: my.y, dir: M.sit ? -1 : M.dir, look: { ...playerLook(), scale: 1.2 }, seated: my.seated, moving: M.moving, phase: M.phase });
    nameTag(ctx, S.player.name, my.x, top, true, `${fmt(S.money)} · Cấp ${S.level}`);
  } });
  seats.push({ id: 'me', x: my.x, top: top - 24 });
  hits.push({ x: -sceneMargin(), y: 440, w: W, h: 190, kind: 'floor', pri: -1 });
  // góc giải trí, góc vé số
  drawFunCorner(hits, layer);
  drawVesoCorner(hits, layer);
  R.cafeSeats = seats;
}
// góc vé số bên phải quán: bảng dò kết quả treo tường, cô Năm đứng bán vé
const VESO_LOOK = { skin: '#C68B5E', hair: '#BBB', long: true, hat: 1, shirt: '#8E3B46', pants: '#231A14', acc: 'book', scale: 1.1 };
function drawVesoCorner(hits, layer) {
  const bx = 1080, by = 258, x = 1196;
  const last = lastDraw(), res = drawResult(last);
  ctx.fillStyle = '#2E4034'; rr(ctx, bx - 80, by, 160, 118, 8); ctx.fill(); ctx.strokeStyle = '#8C6A4A'; ctx.lineWidth = 5; ctx.stroke();
  signText(ctx, 'KẾT QUẢ XỔ SỐ', bx, by + 14, 14, '#F7D774', 140);
  ctx.font = '700 11px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#F2F2EE'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`Kỳ ${drawLabel(last)}`, bx, by + 32);
  ctx.font = '800 20px "Baloo 2", sans-serif'; ctx.fillStyle = '#FF8A7A'; ctx.fillText(res.db[0], bx, by + 54);
  ctx.font = '700 12px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#F2F2EE'; ctx.fillText('Tám: ' + res.g8.join(' '), bx, by + 76);
  ctx.fillStyle = '#9CE07A'; ctx.fillText(`Kỳ tới ${drawLabel(nextDraw())}`, bx, by + 98);
  hits.push({ x: bx - 86, y: by - 6, w: 172, h: 130, kind: 'kqboard', pri: 2 });
  const pend = pendingTickets().length;
  layer.push({ y: 597, draw: () => {
    drawPerson(ctx, { x, y: 596, dir: -1, look: VESO_LOOK, moving: false, phase: 0 });
    ctx.fillStyle = '#F7E1A0'; ctx.fillRect(x - 40, 520, 26, 18); ctx.strokeStyle = '#C0392B'; ctx.lineWidth = 2; ctx.strokeRect(x - 40, 520, 26, 18);
    nameTag(ctx, 'Cô Năm vé số', x, 596 - 196, false, pend ? `Bạn giữ ${pend} tờ` : 'Vé số đây!');
  } });
  exclaim(x + 62, 596 - 232, pend ? 'Dò số' : 'Vé số');
  hits.push({ x: x - 40, y: 410, w: 80, h: 190, kind: 'veso', pri: 2 });
}
// Hồ câu: một hồ tròn giữa bãi cỏ, cầu gỗ chìa ra từ bờ trái. Phao chỉ rơi ở nửa trên của hồ
// để không bị bảng nút câu cá ở dưới che.
const POND = { x: 800, y: 440, rx: 420, ry: 112 };
const POND_ME = { x: 600, y: 540 };
const inPond = (x, y, pad = 0) => ((x - POND.x) / (POND.rx - pad)) ** 2 + ((y - POND.y) / (POND.ry - pad)) ** 2 <= 1;
function drawPondBg(g, rnd, rp, lights, PM = 0) {
  const X0 = -PM, XW = SW + 2 * PM, HZ = 272;
  // nhà xa, cây sau hồ
  for (let x = X0 - 10; x < SW + PM;) {
    const w = 80 + rnd() * 60, h = 60 + rnd() * 70;
    g.fillStyle = rp(HOUSE_COLORS); g.fillRect(x, HZ - h, w, h);
    g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + w - 4, HZ - h, 4, h);
    for (let k = x + 10; k < x + w - 16; k += 22) { g.fillStyle = '#2C3440'; g.fillRect(k, HZ - h + 14, 12, 16); lights.push({ x: k, y: HZ - h + 14, w: 12, h: 16, on: rnd() < 0.6, warm: true }); }
    x += w;
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = ['#2F6B3A', '#3F8A4A', '#4E9A52'][i % 3]; g.beginPath(); g.arc(X0 + rnd() * XW, HZ - 4 + rnd() * 14, 24 + rnd() * 26, 0, 7); g.fill(); }
  // bãi cỏ
  const gg = g.createLinearGradient(0, HZ, 0, H);
  gg.addColorStop(0, '#86B86C'); gg.addColorStop(1, '#5C9549');
  g.fillStyle = gg; g.fillRect(X0, HZ + 6, XW, H - HZ);
  g.strokeStyle = 'rgba(40,80,30,.35)'; g.lineWidth = 2;
  for (let i = 0; i < 140; i++) { const x = X0 + rnd() * XW, y = HZ + 20 + rnd() * (H - HZ - 20); if (inPond(x, y, -30)) continue; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 7); g.moveTo(x, y); g.lineTo(x + 3, y - 8); g.stroke(); }
  // lối sỏi dẫn ra cầu
  g.fillStyle = '#D8C9A3';
  g.beginPath(); g.moveTo(170, H); g.quadraticCurveTo(220, 600, 310, 552); g.lineTo(330, 572); g.quadraticCurveTo(260, 620, 250, H); g.closePath(); g.fill();
  // bờ hồ: đất, đá viền
  g.fillStyle = '#B79F74'; g.beginPath(); g.ellipse(POND.x, POND.y + 8, POND.rx + 28, POND.ry + 20, 0, 0, 7); g.fill();
  for (let a = 0; a < Math.PI * 2; a += 0.11) {
    const x = POND.x + Math.cos(a) * (POND.rx + 12), y = POND.y + 4 + Math.sin(a) * (POND.ry + 9);
    g.fillStyle = rp(['#8E8A84', '#A39E95', '#7C776F']); g.beginPath(); g.ellipse(x, y, 12 + rnd() * 8, 6 + rnd() * 3, 0, 0, 7); g.fill();
  }
  // nước: sáng giữa, sậm ra mép
  const wg = g.createRadialGradient(POND.x - 60, POND.y - 30, 30, POND.x, POND.y, POND.rx);
  wg.addColorStop(0, '#7CC3D6'); wg.addColorStop(0.7, '#4A98B0'); wg.addColorStop(1, '#2B6E86');
  g.save(); g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, 7); g.clip();
  g.fillStyle = wg; g.fillRect(POND.x - POND.rx, POND.y - POND.ry, POND.rx * 2, POND.ry * 2);
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2;
  for (let i = 0; i < 50; i++) { const x = POND.x - POND.rx + rnd() * POND.rx * 2, y = POND.y - POND.ry + rnd() * POND.ry * 2, w = 18 + rnd() * 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
  g.fillStyle = 'rgba(20,50,60,.25)'; g.beginPath(); g.ellipse(POND.x, POND.y - POND.ry + 6, POND.rx, 14, 0, 0, 7); g.fill();
  g.restore();
  // lá sen dọc mép hồ
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, r = 0.72 + rnd() * 0.2, x = POND.x + Math.cos(a) * POND.rx * r, y = POND.y + Math.sin(a) * POND.ry * r;
    if (x < 690 && y > 500) continue;   // chừa chỗ cầu gỗ
    g.fillStyle = '#3F8A4A'; g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, 22, 8, 0, 0.35, Math.PI * 2 - 0.1); g.closePath(); g.fill();
    if (rnd() < 0.4) { g.fillStyle = '#F4A6C0'; g.beginPath(); g.arc(x + 6, y - 5, 5, 0, 7); g.fill(); }
  }
  // cầu gỗ chìa ra hồ
  g.fillStyle = '#5A4630'; for (let x = 320; x <= 640; x += 64) g.fillRect(x, 546, 9, 36);
  g.fillStyle = '#8C6A4A'; g.beginPath(); g.moveTo(300, 532); g.lineTo(660, 528); g.lineTo(664, 550); g.lineTo(296, 556); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(35,26,20,.4)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 318; x < 660; x += 22) { g.moveTo(x, 530); g.lineTo(x, 553); } g.stroke();
  // tảng đá chú Bảy ngồi câu
  g.fillStyle = '#8E8A84'; g.beginPath(); g.ellipse(1212, 488, 46, 18, 0, 0, 7); g.fill();
  g.fillStyle = '#A39E95'; g.beginPath(); g.ellipse(1206, 480, 36, 12, 0, 0, 7); g.fill();
  // chòi đồ câu trên bờ
  g.fillStyle = '#6B4F3A'; g.fillRect(18, 400, 8, 110); g.fillRect(132, 400, 8, 110);
  g.fillStyle = '#C9A45C'; g.beginPath(); g.moveTo(0, 410); g.lineTo(79, 350); g.lineTo(158, 410); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(90,60,20,.5)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 6; x < 156; x += 10) { g.moveTo(79, 352); g.lineTo(x, 410); } g.stroke();
  g.fillStyle = '#8C6A4A'; g.fillRect(14, 462, 130, 14);
  g.fillStyle = '#3B2E2A'; g.fillRect(24, 414, 110, 48);
  lights.push({ x: 24, y: 414, w: 110, h: 48, on: true, warm: true, shop: true });
  g.fillStyle = '#B07A3A'; for (let k = 0; k < 4; k++) g.fillRect(30 + k * 26, 440, 20, 22);
  g.fillStyle = '#FFF4D6'; rr(g, 20, 374, 118, 26, 5); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2; g.stroke();
  signText(g, 'ĐỒ CÂU · MỒI', 79, 386, 15, '#1F6F8B', 110);
  // bảng hồ câu
  g.strokeStyle = '#6B4F3A'; g.lineWidth = 5; g.beginPath(); g.moveTo(240, 530); g.lineTo(240, 462); g.stroke();
  g.fillStyle = '#1F6F8B'; rr(g, 168, 410, 150, 54, 6); g.fill(); g.strokeStyle = '#231A14'; g.lineWidth = 2; g.stroke();
  signText(g, 'HỒ CÂU GIẢI TRÍ', 243, 428, 16, '#FFF4D6', 140);
  signText(g, 'Lái cá thu mua tại chỗ', 243, 448, 12, '#F7D774', 140);
}
function drawPondScene(hits) {
  const F = R.fish;
  // hàng xóm ngồi câu trên tảng đá bên phải
  const nb = { x: 1204, y: 478 };
  drawPerson(ctx, { x: nb.x, y: nb.y, dir: -1, look: { scale: 1, ...npcLook('chu_bay') }, seated: true, moving: false, phase: 0, rod: true });
  nameTag(ctx, nbBase('chu_bay').name, nb.x, nb.y - 156);
  const otip = { x: nb.x - 126, y: nb.y - 206 };
  const ofy = 416 + Math.sin(R.t * 2) * 2;
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(otip.x, otip.y); ctx.quadraticCurveTo(1060, 340, 1040, ofy); ctx.stroke();
  drawFloat(1040, ofy, 0);
  // nhân vật của mình đứng đầu cầu
  let tip = { x: POND_ME.x + 132, y: POND_ME.y - 216 };
  if (heroOn()) {
    // ngồi ghế xếp: cá rỉa / cá cắn thì cần cong xuống, kéo lên thì giật cần, câu được thì đứng dậy khoe
    const reelK = F.state === 'reel' ? clamp(1 - F.t / 1.1, 0, 1) : 0;
    const k = R.me.act?.anim === 'fish' ? R.me.act.seq[0] : F.state === 'bite' || F.nib > 0 || (F.state === 'cast' && F.t > 0.35) ? 1 : F.state === 'reel' ? (reelK > 0.6 && !FISH[F.catch?.id]?.junk ? 3 : 2) : 0;
    const f = HERO_FRAMES.fish[k], sc = 1.1 * HERO_K;
    drawHero(ctx, POND_ME.x, POND_ME.y, 1.1, 1, 'fish', k);
    if (f[6] !== undefined) tip = { x: POND_ME.x + f[6] * sc, y: POND_ME.y + f[7] * sc };
  } else drawPerson(ctx, { x: POND_ME.x, y: POND_ME.y, dir: 1, look: playerLook(), moving: false, phase: 0, rod: true });
  nameTag(ctx, S.player.name, POND_ME.x, POND_ME.y - 160, true);
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
  // giờ cá cắn mạnh
  if (areaPeak('fish')) bubble('Giờ cá cắn mạnh!', POND.x, POND.y - POND.ry - 18, { size: 14, bg: '#FFF1BF' });
  hits.push({ x: POND.x - POND.rx, y: POND.y - POND.ry, w: POND.rx * 2, h: POND.ry * 2, kind: 'water' });
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
const frontOf = (i) => ({ x: lotX(i) + (R.me.x < lotX(i) ? -50 : 50), y: Math.min(lotBase(i) + 20, walkBand().y1) });
canvas.addEventListener('pointerdown', (e) => {
  if (!R.started || R.modal || R.dlg || R.trip) return;
  Snd.init();
  const p = toLogical(e);
  const h = hitAt(p);
  const k = spotKey();
  if (h && h.kind === 'bike' && k) { const sp = BIKE_SPOT[k]; walkTo(sp.x + 40, WALK_Y1 - 4, () => talk('Xe máy của bạn', playerLook(), [`Chạy đi đâu? Mỗi chuyến ${fmt(FUEL_COST)} tiền xăng.`], { choices: travelChoices() })); return; }
  if (h && h.kind === 'actor') { catchActor(); return; }
  if (h && h.kind === 'spill') { const it = h.item; walkTo(it.x, walkBand().y1, () => pickSpill(it)); return; }
  if (h && h.kind === 'driver') { walkTo(R.spill.x + 120, walkBand().y1, () => R.spill && talk('Chú ba gác', { skin: '#C68B5E', hair: '#1E1A1A', long: false, hat: 2, helmet: '#F7B32B', shirt: '#3E7CB1', pants: '#2F3E46' }, ['Trời ơi vấp cái ổ gà, đổ hết bia rồi! Phụ chú nhặt với con ơi!'], { choices: [{ label: 'Phụ nhặt giùm', sub: '2 sức', fn: helpSpill }, { label: 'Thôi', fn: null }] })); return; }
  if (h && h.kind === 'parking') { walkTo(210, 600, () => talk('Bãi giữ xe', PARK_GUARD, ['Lấy xe chạy đi đâu nè?'], { choices: travelChoices() })); return; }
  const walkFloor = () => { if (p.y > walkBand().y0 - 40 || R.view === 'cafe') walkTo(p.x, p.y); };
  if (!h) { if (R.view !== 'fish') walkFloor(); return; }
  if (h.kind === 'portal') { const pt = portalsFor().find((q) => q.side === h.side); walkTo(h.x + h.w / 2, FRONT_Y + 10, () => pt?.go()); return; }
  if (R.view === 'street') {
    const i = h.i, f = frontOf(i ?? 0);
    if (h.kind === 'cash') walkTo(f.x, f.y, () => collect(S.cur, i));
    else if (h.kind === 'trash') walkTo(h.wx, h.wy, () => cleanTrash(S.cur, i));
    else if (h.kind === 'rat') walkTo(h.wx, h.wy, () => chaseRat(S.cur, i));
    else if (h.kind === 'visitor') { const v = R.visitors.find((q) => q.id === h.id); walkTo((v?.x ?? p.x) - 60, v?.y ?? p.y, () => openProfile(h.id)); }
    else if (h.kind === 'lot') walkTo(f.x, f.y, () => openLot(S.cur, i));
    else if (h.kind === 'gian') walkTo(f.x, f.y, () => openGian(S.cur, i));
    else walkFloor();
  } else if (R.view === 'neighbor') {
    const i = h.i, f = frontOf(i ?? 0);
    const act = h.kind === 'cash' && R.tool === 'hand' ? 'steal' : (h.kind === 'trash' || h.kind === 'rat') && R.tool === 'hand' ? 'clean' : R.tool !== 'hand' && h.kind !== 'floor' ? R.tool : null;
    if (act && i != null) walkTo(h.wx ?? f.x, h.wy ?? f.y, () => Net.streetAction(R.visit, act, i));
    else walkFloor();
  } else if (R.view === 'home') {
    if (h.kind === 'door') walkTo(640, WALK_Y0 + 4, openChar);
    else if (h.kind === 'oldman') walkTo(OLD_TU.x + 70, 560, talkOldTu);
    else if (h.kind === 'kho') walkTo(900, 560, openKho);
    else if (h.kind === 'mail') walkTo(820, 560, openNews);
    else walkFloor();
  } else if (R.view === 'cafe') {
    if (h.kind === 'cafe') { const s = (R.cafeSeats || []).find((q) => q.id === h.id); walkTo((s?.x ?? p.x) + 70, 596, () => openProfile(h.id)); }
    else if (h.kind === 'chair') walkTo(h.sx, 596, () => { R.me.sit = { x: h.sx }; });
    else if (h.kind === 'fun') walkTo(150, 596, openFun);
    else if (h.kind === 'veso') walkTo(1150, 596, () => openVeso('buy'));
    else if (h.kind === 'kqboard') walkTo(1060, 596, () => openVeso('kq'));
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
  R.hover = h && ['cash', 'trash', 'rat', 'chair', 'portal', 'lot', 'spill', 'driver', 'actor', 'kho', 'door', 'mail', 'oldman', 'bike', 'parking', 'mstall', 'board', 'boss', 'fun', 'veso', 'kqboard'].includes(h.kind) ? h : null;
  canvas.style.cursor = h && h.kind !== 'floor' ? 'pointer' : 'default';
});
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's']);
window.addEventListener('keyup', (e) => { R.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
window.addEventListener('blur', () => R.keys.clear());
window.addEventListener('keydown', (e) => {
  if (!R.started) return;
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (R.fight) { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) fightHit(); } return; }
  if (R.dlg) { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); dlgNext(); } else if (e.key === 'Escape' && R.dlg.choices) closeDialog(); return; }
  if (R.trip) return;
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
  if (key === 'c') startTrip('bike', 'market'); else if (key === 'k') openKho(); else if (key === 'x') openNeighbors();
  else if (key === 'f') startTrip('bike', 'cafe'); else if (key === 't') openChar(); else if (key === 'n') openNews();
  else if (key === 'b') autoPlaceAll();
  else if (key === 'p') openPaper(); else if (key === 'g') openReviews(); else if (key === 'j') openAch();
  else if (key === 'q') startTrip('bike', 'fish'); else if (key === 'h') startTrip('bike', 'home');
  else if (/^[1-6]$/.test(key) && R.view === 'street') { const i = Number(key) - 1, f = frontOf(i); walkTo(f.x, f.y, () => openGian(S.cur, i)); }
});
$('btn-flee').addEventListener('click', flee);
$('btn-fight').addEventListener('pointerdown', (e) => { e.preventDefault(); fightHit(); });
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
function beginGame(fresh, pick) {
  Snd.init();
  if (fresh) {
    S = freshState(); rollPrices(); R.unread = 0;
    if (pick) { S.player.char = pick.char; S.player.name = pick.name; if (CHARS[pick.char].hat !== 1) S.outfit.hat = null; }
    news(`${esc(S.player.name)} vừa dọn về hẻm 42, thuê được gian số 1 ở Khu phố 1.`, 'good');
  }
  R.attract = false; R.started = true;
  R.parts = []; R.trip = null; closeDialog();
  enterView('home');
  $('title-screen').hidden = true;
  stage.classList.remove('on-title');
  renderDock(); updateHUD();
  if (fresh) toast('Bấm xuống vỉa hè để đi lại (hoặc phím mũi tên / WASD). Đi tới chỗ <b>Ông Tư</b> bên trái chào một tiếng đã.', 'gold');
  else if (R.offline) { toast(R.offline, 'gold'); R.offline = null; }
  save();
}
$('btn-new').addEventListener('click', () => {
  if (loadSave() && !R.newConfirm) { R.newConfirm = true; $('btn-new').textContent = 'Bấm lần nữa để xóa bản cũ'; return; }
  Snd.init();
  openPickChar();
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
