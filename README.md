# Vua Vỉa Hè

Game mô phỏng buôn bán hàng rong ở Sài Gòn, làm theo lối chơi của game Hàng Rong trên Zing Me ngày xưa. Chạy trên trình duyệt, vẽ bằng canvas, không cần thư viện ngoài.

## Chạy thử

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Game tự lưu trong trình duyệt (localStorage).

## Lối chơi

- **Chọn nhân vật** lúc chơi mới: Cô Ba Nón Lá (sắc đẹp), Anh Tư Ba Gác (sức khỏe), Chị Năm Sổ Sách (trí tuệ), Bé Út Lanh Chanh. Vào game vẫn đổi dáng được ở tủ đồ (50.000đ).
- **Giờ trong game**: 1 giây ngoài đời = 1 phút trong game, một ngày dài 24 phút, ván mới bắt đầu lúc 6 giờ sáng. Đồng hồ góc trên ghi ngày và giờ.
- **10 khu phố**, mỗi khu một màn hình: vỉa hè sâu bày 2 hàng × 3 lô, mặt đường rộng. Lô mở lần lượt từng ô (hàng 1 rồi hàng 2); thuê đủ 6 lô mới mở khu phố kế tiếp.
- **Gu và giờ đông khách từng khu phố**: mỗi khu chuộng 3 món riêng (Cổng Trường mê kẹo bông, đồ chơi; Chợ Đêm mê áo thun, giày, túi…). Khu "giá cao" bán món hợp gu giá ×2, khu "đông khách" bán món hợp gu nhanh ×2. Giờ cao điểm cả khu bán nhanh ×1,5, giờ vắng thì chậm lại. Bày tự động ưu tiên món hợp gu.
- **Chợ đầu mối**: chợ sớm 2h–6h giá sỉ rẻ hơn 10%. Ghé từng sạp mối để **trả giá** (bớt 5%, 10%, 20%, 30% mở theo cấp); trả hụt 3 lần thì mối giận, không bán tới đợt đổi giá sau. **Mua chịu** bị ghi thêm 10% tiền lời, nợ còn lãi 5% mỗi 5 phút.
- **Phố mặt tiền (KP5–KP10)**: phía sau là dãy nhà phố; 3 lô hàng 1 là tiệm cho thuê mặt bằng. Thuê rồi mở tiệm hớt tóc, sửa xe, cơm tấm, tạp hóa, điện thoại, cà phê, tiệm vàng — không cần nhập hàng, có nhân viên đứng tiệm, khách ra vào, thu nhập cao hơn sạp, nâng cấp tới cấp 5.
- **Sự kiện trên đường**: xe chạy ngang xả rác lên vỉa hè; xe ba gác chở bia vấp ổ gà đổ hàng, có thể lụm (mất uy tín) hoặc phụ nhặt giùm (được bo, tăng uy tín).
- **Sạp chở trên xe máy**: bấm xe máy để mở tủ sạp, chọn sạp rồi chọn lô trống; một cô hoặc một anh bán hàng chạy ra đứng sạp và rao. Mỗi sạp có 6 ô hàng bán song song; nâng cấp gánh → xe đẩy → sạp gỗ → ki-ốt để mở thêm ô.
- **Nhân vật** đi tự do trên vỉa hè (bấm chuột, phím mũi tên hoặc WASD). Bấm gian, đồng xu, rác thì nhân vật đi tới rồi mới làm.
- **Chợ đầu mối**: 4 sạp mối hàng, bảng giá sỉ, Ông Chủ Mối cho mua chịu (quá hạn mức bị siết nợ).
- **Nhà riêng**: tủ đồ, kho hàng, hộp thư, Ông Tư chỉ đường lúc mới chơi và cho thuê lô mới; xe máy, trạm xe buýt.
- **Hàng xóm**: dọn giúp để thân, hoặc làm gian thương (chôm két, **chôm hàng trên sạp** về kho, vứt rác, thả chuột).
- **Công an phường** và **dân anh chị** đòi bảo kê (có tiệm thì bị đòi nhiều hơn). Không đóng thì **đánh lại**: hiện nút "Đấm!" như lúc dẹp hàng né công an, bấm đủ số cú trong 5 giây (sức khỏe cao thì ít cú hơn), thua là bị đập sạp.
- **Sự kiện nhỏ** cứ 1–2 phút một lần: thanh tra vệ sinh thực phẩm, khách ăn quỵt, YouTuber ẩm thực quay clip (bán ×2–×3), đoàn du khách (cả phố bán ×2), trời mưa (sạp không dù bán chậm), cô bán vé số, chó hoang tha hàng (bấm để đuổi), kẻ móc túi (bấm để bắt), **trộm chó** chạy xe máy thòng lọng chó hàng xóm (bấm vào xe để bắt, được thưởng).
- **Hồ câu**: hồ tròn giữa bãi cỏ, phao rơi giữa hồ không bị bảng nút che. Phao chìm hẳn mới giật, 10 loại cá có giá theo ký, sổ câu ghi giá lái cá trả. Bình minh và chiều tối cá cắn nhanh, cá hiếm hay ăn mồi.
- **Quán cà phê**: chỗ tụ tập có chat, bấm vào người khác để sang nhà; **góc giải trí** có Vòng quay, Bầu cua, Bài cào, cược bằng **hàng hóa trong kho** (không dùng tiền).
- **Vé số**: Cô Năm ở quán cà phê bán vé (chọn tờ trong xấp hoặc tự gõ số 6 chữ số), xổ mỗi 6 giờ trong game (0h, 6h, 12h, 18h). Bảng kết quả treo ở quán, trúng thì tiền tự cộng.
- **Báo Vỉa Hè**: mỗi ngày trong game một số báo, tin nóng theo tiến độ dẫn dắt câu chuyện, món hot trong ngày (bán giá hơn 30%), giờ vàng các khu phố, kết quả xổ số, chuyện hàng xóm.
- **Góp ý của khách**: khách chấm sao từng sạp (rác, chuột, hết hàng thì bị chê; bán đúng gu thì được khen). Trả lời cảm ơn, xin lỗi, đền bù hay cãi lại; điểm đánh giá làm khách ghé nhiều hay ít.
- **Thành tựu**: 20 thành tựu (xong bài mở đầu, mở khu phố mới, phố mặt tiền, trả giá, đánh giang hồ, bắt trộm chó, cá hiếm, trúng số…), mỗi cái có thưởng.
- Khung hình tự co giãn theo màn hình, màn rộng thì cảnh mở rộng sang hai bên.

## Thử nghiệm nhanh

- Nút **Bày tự động** (phím B) ở khu phố: đem hết sạp trên xe ra lô trống và châm đầy hàng từ kho cho mọi sạp.
- Nút **Thử nghiệm** ở góc trên bên phải: nạp dữ liệu thử (5 triệu, cấp 12, kho đầy, thuê sẵn 3 khu phố, 14 sạp đã bày), thêm tiền, lên cấp, hồi sức, gọi công an / dân anh chị / xe đổ hàng / hàng xóm quậy / trộm chó, tua 10 phút, tua 6 giờ trong game (để xổ vé số), thêm góp ý của khách, xóa bản lưu.
- Phím tắt: P mở báo, G góp ý, J thành tựu, N tin khu phố.

## Chuẩn bị cho server

Mọi thứ liên quan tới người chơi khác đi qua đối tượng `Net` trong `main.js` (hiện là `LocalNet`, chạy ngoại tuyến với hàng xóm do máy điều khiển). Khi có server, viết một đối tượng có cùng các hàm `myProfile`, `roomPlayers`, `sendChat`, `fetchStreet`, `streetAction` rồi gán cho `Net`.
