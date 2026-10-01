"""Cắt 3 tờ asset trong assets/raw rồi đặt tên, thu nhỏ, lưu vào public/assets để game dùng.

Chạy lại sau khi thay tờ mới: python tools/xuat_asset.py
Số thứ tự mảnh lấy theo _xem.png mà tools/cat_asset.py sinh ra (xếp hàng trên xuống, trái sang phải).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / 'assets' / 'raw', ROOT / 'public' / 'assets'

# tờ, ngưỡng loang, màu nền xóa toàn ảnh, ngưỡng xóa, độ co để tách mảnh dính
SHEETS = {
    'icon': ('icon.webp', '60', '248,5,248', '90', '0'),
    'duong-pho': ('duong-pho.webp', '30', '0,0,0', '24', '4'),
    'toa-nha': ('toa-nha.webp', '22', '225,234,238', '0', '6'),
}
# số mảnh → (thư mục, tên, cạnh dài tối đa)
NAMES = {
    'icon': {1: 'avatar-mau', 2: 'tien', 3: 'kim-cuong', 4: 'suc', 5: 'nhiem-vu', 6: 'cho', 7: 'qua', 8: 'tui-do',
             9: 'hang-xom', 10: 'cai-dat', 11: 'ban-do', 12: 'thanh-tich', 13: 'diem-danh', 14: 'tin-nhan', 15: 'uy-tin',
             16: 'nha', 17: 'nhom', 18: 'so', 19: 'loa', 20: 'ruong'},
    'duong-pho': {1: 'le-gach', 2: 'le-cay', 3: 'le-tru-nuoc', 4: 'le-cong', 5: 'le-nap-ho', 6: 'le-goc', 7: 'le-goc-cong',
                  8: 'le-ngan', 9: 'duong-vach', 10: 'duong-vach-qua', 11: 'duong-T', 12: 'duong-I', 13: 'duong-cua',
                  14: 'duong-cua-le', 15: 'cay', 16: 'song-cong', 17: 'nap-ho-tron', 18: 'nap-ho-vuong', 19: 'bui-hoa',
                  20: 'den-duong', 21: 'tru-nuoc', 22: 'guong-cau', 25: 'hang-rao', 26: 'bon-hoa', 27: 'chau-cay',
                  28: 'cong-le', 29: 'gach-vo'},
    'toa-nha': {1: 'shop', 2: 'cafe', 3: 'van-phong', 4: 'nha'},
}
FOLDER = {'icon': ('ui', 128), 'duong-pho': ('pho', 400), 'toa-nha': ('nha', 560)}


def tach_cay(im):
    """Mảnh 15 là ô đường dính cây ở dưới: giữ phần cây (dưới mép ô đường, cộng tán lá xanh chồm lên)."""
    a = np.asarray(im).copy()
    rgb = a[:, :, :3].astype(int)
    road_bottom = 208
    green = (rgb[:, :, 1] > rgb[:, :, 0] + 12) & (rgb[:, :, 1] > rgb[:, :, 2] + 12)
    keep = np.zeros(a.shape[:2], bool)
    keep[road_bottom:] = True
    keep[150:road_bottom] |= green[150:road_bottom]
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    out = Image.fromarray(a, 'RGBA')
    return out.crop(out.getbbox())


def main():
    with tempfile.TemporaryDirectory() as tmp:
        for sheet, (src, *args) in SHEETS.items():
            dst = Path(tmp) / sheet
            subprocess.run([sys.executable, str(ROOT / 'tools' / 'cat_asset.py'), str(RAW / src), str(dst), *args], check=True)
            folder, size = FOLDER[sheet]
            (OUT / folder).mkdir(parents=True, exist_ok=True)
            for k, name in NAMES[sheet].items():
                im = Image.open(dst / f'{k:02d}.png').convert('RGBA')
                if sheet == 'duong-pho' and name == 'cay':
                    im = tach_cay(im)
                im.thumbnail((size, size), Image.LANCZOS)
                im.save(OUT / folder / f'{name}.png', optimize=True)
            print(sheet, len(NAMES[sheet]), 'file')


if __name__ == '__main__':
    main()
