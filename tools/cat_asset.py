"""Cắt tờ asset (ảnh tạo bằng AI, nền trơn) thành từng file PNG nền trong suốt.

Cách dùng: python tools/cat_asset.py <ảnh> <thư mục ra> [ngưỡng loang] [màu nền r,g,b] [ngưỡng xóa toàn ảnh]
Nền được loang từ mép ảnh (giống công cụ cục tẩy thần kỳ), nên chỗ tối bên trong
hình (viền, bóng) không bị xóa dù nền màu đen. Mỗi mảng hình rời nhau thành một file
01.png, 02.png... xếp theo hàng rồi theo cột, kèm _xem.png đánh số để đối chiếu.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MARK = (13, 254, 7)


def bg_mask(im, thresh):
    work = im.convert('RGB').copy()
    w, h = work.size
    seeds = [(x, y) for x in range(0, w, 16) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 16) for x in (0, w - 1)]
    for s in seeds:
        if work.getpixel(s) != MARK:
            ImageDraw.floodfill(work, s, MARK, thresh=thresh)
    a = np.asarray(work)
    return (a[:, :, 0] == MARK[0]) & (a[:, :, 1] == MARK[1]) & (a[:, :, 2] == MARK[2])


def runs(profile, min_gap, min_len):
    """Các đoạn liên tục có hình trên một trục, bỏ qua khe nhỏ hơn min_gap."""
    on = profile > 0
    out, start, gap = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                end = i - gap + 1
                if end - start >= min_len:
                    out.append((start, end))
                start, gap = None, 0
    if start is not None and len(on) - start >= min_len:
        out.append((start, len(on) - gap))
    return out


def components(fg):
    """Gom các điểm có hình liền nhau (8 hướng) thành từng mảng, trả về khung bao của mỗi mảng."""
    parent = {}
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    prev, boxes, nid, allruns = [], {}, 0, []
    for y in range(fg.shape[0]):
        row = fg[y]
        d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        cur = []
        for x0, x1 in zip(starts, ends):
            nid += 1
            parent[nid] = nid
            boxes[nid] = [x0, y, x1, y + 1]
            for px0, px1, pid in prev:
                if px0 <= x1 and px1 >= x0:
                    a, b = find(nid), find(pid)
                    if a != b:
                        parent[a] = b
            cur.append((x0, x1, nid))
            allruns.append((y, x0, x1, nid))
        prev = cur
    merged = {}
    for k, (x0, y0, x1, y1) in boxes.items():
        r = find(k)
        m = merged.setdefault(r, [x0, y0, x1, y1])
        m[0], m[1], m[2], m[3] = min(m[0], x0), min(m[1], y0), max(m[2], x1), max(m[3], y1)
    label = np.zeros(fg.shape, np.int32)
    for y, x0, x1, k in allruns:
        label[y, x0:x1] = find(k)
    return [(tuple(int(v) for v in m), r) for r, m in merged.items()], label


def xy_cut(fg, x0, y0, depth=0):
    """Cắt đệ quy theo khe trống: hàng → cột → hàng... tới khi không cắt được nữa."""
    rows = runs(fg.sum(axis=1), 6, 8)
    cols = runs(fg.sum(axis=0), 6, 8)
    if len(rows) <= 1 and len(cols) <= 1:
        if not rows or not cols:
            return []
        (r0, r1), (c0, c1) = rows[0], cols[0]
        return [(x0 + c0, y0 + r0, x0 + c1, y0 + r1)]
    boxes = []
    if len(rows) > 1:
        for r0, r1 in rows:
            boxes += xy_cut(fg[r0:r1], x0, y0 + r0, depth + 1)
    else:
        for c0, c1 in cols:
            boxes += xy_cut(fg[:, c0:c1], x0 + c0, y0, depth + 1)
    return boxes


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    out.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert('RGB')
    bg = bg_mask(im, thresh)
    if len(sys.argv) > 4:   # nền lọt trong hình (khe giữa song rào...): xóa luôn chỗ gần đúng màu nền
        key = np.array([int(v) for v in sys.argv[4].split(',')])
        bg |= np.abs(np.asarray(im).astype(int) - key).sum(axis=2) < int(sys.argv[5] if len(sys.argv) > 5 else 30)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype('uint8'))
    px = np.asarray(im).astype(float)
    key = px[2, 2]
    a = np.asarray(alpha).copy()
    if key.sum() > 150:
        # nền sáng/màu: dải 4px sát nền thường lẫn màu nền (viền tím, viền xám) → tính độ trong theo
        # khoảng cách tới màu nền rồi tách màu nền ra khỏi điểm ảnh
        ring = (np.asarray(alpha.filter(ImageFilter.MinFilter(9))) == 0) & ~bg
        dist = np.sqrt(((px - key) ** 2).sum(axis=2))
        k = np.clip((dist - 30) / 150, 0, 1)
        un = np.clip((px - (1 - k[..., None]) * key) / np.maximum(k, 0.05)[..., None], 0, 255)
        px = np.where(ring[..., None], un, px)
        a = np.where(ring, (k * 255).astype('uint8'), a)
    else:
        # nền đen: chỉ làm mềm 1px mép cho đỡ răng cưa
        edge = np.asarray(alpha.filter(ImageFilter.MinFilter(3))) < np.asarray(alpha)
        a[edge] = 140
    rgba = np.dstack([px.astype('uint8'), a])
    fg = a > 40
    # co mảng lại vài px trước khi gom để tách hai hình chỉ chạm nhau ở mép (lá cây chạm ô gạch), rồi nới khung ra lại
    er = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    core = np.asarray(Image.fromarray(fg.astype('uint8') * 255).filter(ImageFilter.MinFilter(2 * er + 1))) > 0 if er else fg
    h, w = fg.shape
    comps, label = components(core)
    comps = [(b, r) for b, r in comps if (b[2] - b[0]) * (b[3] - b[1]) > 900]
    boxes, owner = [], {}
    for b, r in comps:
        box = (max(0, b[0] - er - 2), max(0, b[1] - er - 2), min(w, b[2] + er + 2), min(h, b[3] + er + 2))
        boxes.append(box)
        # điểm thuộc mảnh này = phần lõi nới ra lại er px, giao với hình gốc
        m = Image.fromarray(((label == r) * 255).astype('uint8')).filter(ImageFilter.MaxFilter(2 * er + 3)) if er else None
        owner[box] = (np.asarray(m) > 0) & fg if er else fg
    # xếp theo hàng (tâm cách nhau dưới 120px coi là cùng hàng) rồi theo cột
    boxes.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / 120), b[0]))
    preview = Image.new('RGB', im.size, (60, 60, 60))
    preview.paste(Image.fromarray(rgba, 'RGBA'), (0, 0), Image.fromarray(rgba, 'RGBA'))
    d = ImageDraw.Draw(preview)
    for k, (x0, y0, x1, y1) in enumerate(boxes, 1):
        sub = rgba[y0:y1, x0:x1].copy()
        own = owner[(x0, y0, x1, y1)][y0:y1, x0:x1]
        if er:   # lấy lại cả viền mờ quanh phần của mảnh này
            own = np.asarray(Image.fromarray(own.astype('uint8') * 255).filter(ImageFilter.MaxFilter(5))) > 0
        sub[:, :, 3] = np.where(own, sub[:, :, 3], 0)
        piece = Image.fromarray(sub, 'RGBA')
        piece.save(out / f'{k:02d}.png')
        d.rectangle((x0, y0, x1, y1), outline=(255, 255, 0), width=2)
        d.text((x0 + 4, y0 + 2), str(k), fill=(255, 255, 0))
    preview.save(out / '_xem.png')
    print(f'{src.name}: {len(boxes)} mảnh')


if __name__ == '__main__':
    main()
