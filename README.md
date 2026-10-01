# Vua Vỉa Hè

Game mô phỏng buôn bán hàng rong ở Sài Gòn, làm theo lối chơi của game Hàng Rong trên Zing Me ngày xưa. Chạy trên trình duyệt, vẽ bằng canvas, không cần thư viện ngoài.

## Chạy thử

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Game tự lưu trong trình duyệt (localStorage).

## Lối chơi

- **Khu phố** có 2 hàng lô trên vỉa hè (12 lô). Lô mở lần lượt từng ô: hàng 1, hàng 2, đủ Khu phố 1 mới sang Khu phố 2.
- **Sạp chở trên xe máy**: bấm xe máy để mở tủ sạp, chọn sạp rồi chọn lô trống; một cô hoặc một anh bán hàng chạy ra đứng sạp và rao. Mỗi sạp có 6 ô hàng bán song song; nâng cấp gánh → xe đẩy → sạp gỗ → ki-ốt để mở thêm ô.
- **Nhân vật** đi tự do trên vỉa hè (bấm chuột, phím mũi tên hoặc WASD). Bấm gian, đồng xu, rác thì nhân vật đi tới rồi mới làm.
- **Chợ đầu mối**: 4 sạp mối hàng, bảng giá sỉ, Ông Chủ Mối cho mua chịu (nợ có lãi, quá hạn mức bị siết nợ).
- **Nhà riêng**: tủ đồ, kho hàng, hộp thư, ông Tư bán đất (mua Khu phố 2).
- **Hàng xóm**: dọn giúp để thân, hoặc làm gian thương (chôm két, vứt rác, thả chuột).
- **Công an phường** và **dân anh chị** đòi bảo kê.
- **Hồ câu**: thả câu, phao chìm hẳn mới giật, 10 loại cá, sổ câu.
- **Quán cà phê**: chỗ tụ tập có chat, bấm vào người khác để sang nhà; **góc giải trí** có Vòng quay, Bầu cua, Bài cào (tiền trong game).
- Khung hình tự co giãn theo màn hình, màn rộng thì cảnh mở rộng sang hai bên.

## Chuẩn bị cho server

Mọi thứ liên quan tới người chơi khác đi qua đối tượng `Net` trong `main.js` (hiện là `LocalNet`, chạy ngoại tuyến với hàng xóm do máy điều khiển). Khi có server, viết một đối tượng có cùng các hàm `myProfile`, `roomPlayers`, `sendChat`, `fetchStreet`, `streetAction` rồi gán cho `Net`.
