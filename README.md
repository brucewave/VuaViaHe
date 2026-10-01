# Vua Vỉa Hè

Game mô phỏng buôn bán hàng rong ở Sài Gòn, làm theo lối chơi của game Hàng Rong trên Zing Me ngày xưa. Chạy trên trình duyệt, vẽ bằng canvas, không cần thư viện ngoài.

## Chạy thử

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Game tự lưu trong trình duyệt (localStorage).

## Lối chơi

- **10 khu phố**, mỗi khu một màn hình: vỉa hè sâu bày 2 hàng × 3 lô, mặt đường rộng. Lô mở lần lượt từng ô (hàng 1 rồi hàng 2); thuê đủ 6 lô mới mở khu phố kế tiếp.
- **Phố mặt tiền (KP5–KP10)**: phía sau là dãy nhà phố; 3 lô hàng 1 là tiệm cho thuê mặt bằng. Thuê rồi mở tiệm hớt tóc, sửa xe, cơm tấm, tạp hóa, điện thoại, cà phê, tiệm vàng — không cần nhập hàng, có nhân viên đứng tiệm, khách ra vào, thu nhập cao hơn sạp, nâng cấp tới cấp 5.
- **Sự kiện trên đường**: xe chạy ngang xả rác lên vỉa hè; xe ba gác chở bia vấp ổ gà đổ hàng, có thể lụm (mất uy tín) hoặc phụ nhặt giùm (được bo, tăng uy tín).
- **Sạp chở trên xe máy**: bấm xe máy để mở tủ sạp, chọn sạp rồi chọn lô trống; một cô hoặc một anh bán hàng chạy ra đứng sạp và rao. Mỗi sạp có 6 ô hàng bán song song; nâng cấp gánh → xe đẩy → sạp gỗ → ki-ốt để mở thêm ô.
- **Nhân vật** đi tự do trên vỉa hè (bấm chuột, phím mũi tên hoặc WASD). Bấm gian, đồng xu, rác thì nhân vật đi tới rồi mới làm.
- **Chợ đầu mối**: 4 sạp mối hàng, bảng giá sỉ, Ông Chủ Mối cho mua chịu (nợ có lãi, quá hạn mức bị siết nợ).
- **Nhà riêng**: tủ đồ, kho hàng, hộp thư, Ông Tư chỉ đường lúc mới chơi và cho thuê lô mới; xe máy, trạm xe buýt.
- **Hàng xóm**: dọn giúp để thân, hoặc làm gian thương (chôm két, vứt rác, thả chuột).
- **Công an phường** và **dân anh chị** đòi bảo kê (có tiệm thì bị đòi nhiều hơn).
- **Sự kiện nhỏ** cứ 1–2 phút một lần: thanh tra vệ sinh thực phẩm, khách ăn quỵt, YouTuber ẩm thực quay clip (bán ×2–×3), đoàn du khách (cả phố bán ×2), trời mưa (sạp không dù bán chậm), cô bán vé số, chó hoang tha hàng (bấm để đuổi), kẻ móc túi (bấm để bắt).
- **Hồ câu**: thả câu, phao chìm hẳn mới giật, 10 loại cá, sổ câu.
- **Quán cà phê**: chỗ tụ tập có chat, bấm vào người khác để sang nhà; **góc giải trí** có Vòng quay, Bầu cua, Bài cào (tiền trong game).
- Khung hình tự co giãn theo màn hình, màn rộng thì cảnh mở rộng sang hai bên.

## Thử nghiệm nhanh

- Nút **Bày tự động** (phím B) ở khu phố: đem hết sạp trên xe ra lô trống và châm đầy hàng từ kho cho mọi sạp.
- Nút **Thử nghiệm** ở góc trên bên phải: nạp dữ liệu thử (5 triệu, cấp 12, kho đầy, thuê sẵn 3 khu phố, 14 sạp đã bày), thêm tiền, lên cấp, hồi sức, gọi công an / dân anh chị / xe đổ hàng / hàng xóm quậy, tua 10 phút, xóa bản lưu.

## Chuẩn bị cho server

Mọi thứ liên quan tới người chơi khác đi qua đối tượng `Net` trong `main.js` (hiện là `LocalNet`, chạy ngoại tuyến với hàng xóm do máy điều khiển). Khi có server, viết một đối tượng có cùng các hàm `myProfile`, `roomPlayers`, `sendChat`, `fetchStreet`, `streetAction` rồi gán cho `Net`.

## Ảnh vẽ sẵn (asset)

- Tờ gốc tạo bằng AI nằm ở `assets/raw/` (`icon.webp`, `duong-pho.webp`, `toa-nha.webp`).
- `python tools/xuat_asset.py` cắt các tờ đó (xóa nền, tách từng hình), đặt tên rồi lưu vào `public/assets/ui`, `pho`, `nha`. Thay tờ mới thì sửa bảng `NAMES` trong script cho khớp số thứ tự mảnh (xem `_xem.png` do `tools/cat_asset.py` sinh ra).
- Game tải ảnh lúc mở; ảnh nào thiếu thì chỗ đó vẫn vẽ bằng code như cũ.
