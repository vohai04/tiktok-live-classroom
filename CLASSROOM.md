# Lớp học làng — bản thử TikTok LIVE

## Chạy

Cần Node.js 22.12 trở lên (máy hiện tại có Node.js 24). Tại thư mục dự án:

```powershell
npm install
npm start
```

- Điều khiển + xem thử: http://localhost:3000
- OBS Browser Source: http://localhost:3000/?obs=1 — kích thước 1080 × 1920.
- Nếu cổng đã được dùng: `$env:PORT=3001; npm start` (đổi URL theo cổng).
- Bản PC Windows dùng Windows Speech qua PowerShell 7 (Microsoft An trên máy hiện tại), không cần Python/Bun hay API key. Bản Docker Linux đã cài Python, Edge TTS và eSpeak NG tiếng Việt dự phòng. Có thể đặt đường dẫn PowerShell 7 bằng `CLASSROOM_POWERSHELL` khi chạy Windows. Màn hình LIVE tự phát giọng theo chính sách autoplay của ứng dụng phát; nút nghe thử trên bảng điều khiển thường để tắt nhằm tránh trùng tiếng.
- Deploy miễn phí trên Render: xem [DEPLOY.md](DEPLOY.md). Chọn Docker, đặt ADMIN_PASSWORD riêng từ 12 ký tự, rồi đăng nhập tại `/admin`. Nguồn game là `/?obs=1` trên cùng tên miền HTTPS.
- `open-game-window.cmd` mở cửa sổ xem thử. Để phát rõ nét, ưu tiên OBS Browser Source render trực tiếp ở 1080 × 1920; không cắt rồi phóng cửa sổ xem thử nhỏ. Xem [TESTING.md](TESTING.md) về luồng phát và bước ghi thử trước LIVE.
- iPhone: mở trang game bằng Safari rồi Thêm vào Màn hình chính. Mở từ biểu tượng đó để dùng chế độ standalone, không có thanh địa chỉ. Không thể giấu thanh địa chỉ chỉ bằng JavaScript trong một tab Safari thông thường.
- Giọng đọc tự đọc câu hỏi và lựa chọn, chào người mới (có giới hạn tần suất), gọi lên bảng, công bố đáp án/người đúng, cảm ơn quà. Hàng đợi tối đa 4 đoạn ở trình phát; bỏ đoạn của câu trước khi sang câu mới. Không đọc nguyên văn mọi bình luận.

## Thử không cần livestream

Trong **Thử làm học sinh**, nhập tên rồi bấm Điểm danh, Đăng ký lên bảng, A/B/C/D hoặc các nút quà giả lập. Đổi tên để thử nhiều người; nút thêm 8 bạn chỉ điểm danh, không chạy bot tự tặng quà.

## Bình luận

- `vào lớp`, `điểm danh`: vào lớp, có tên và tổ.
- Bình luận `lên bảng`: vào hàng chờ; lên bảng 18 giây/lượt. Đây là lệnh chat của game, không phải nút có sẵn trong TikTok. Lệnh `giơ tay` cũ vẫn được nhận để tương thích.
- `A`, `B`, `C`, `D` hoặc nội dung đáp án đầy đủ (không phân biệt hoa thường): mỗi người một đáp án mỗi câu. Chốt đáp án hoặc hết giờ mới công bố điểm và thời gian trả lời. Đúng +10, sai +0; không có điểm mua bằng quà.
- Với các lựa chọn chỉ khác dấu (ví dụ “trăn” / “trân”), game ưu tiên nội dung có dấu chính xác. Nếu nhập không dấu còn trùng nhiều lựa chọn, dùng A/B/C/D; game chưa ghi nhận đáp án mơ hồ đó.
- `vỗ tay`, `cổ vũ`: hiện biểu tượng vỗ tay tại ghế 3 giây, mỗi người cách nhau ít nhất 8 giây.
- `thành tích`, `điểm của tôi`: thầy giáo đọc số câu đúng, điểm và kỷ lục chuỗi đúng của người bình luận; mỗi người tối đa một lần đọc trong 15 giây.

## Hoạt động trong tiết học

- Mỗi tiết gồm 10 câu. Sau câu thứ 10, game tổng kết 15 giây: tuyên dương 3 người đúng nhiều nhất và tổ dẫn đầu. Có thể bấm “Bắt đầu tiết mới” để chuyển sớm. Nếu bằng điểm, các tổ cùng được tuyên dương; người chơi bằng số câu đúng giữ thứ tự vào lớp.
- Điểm tổ và chức tổ trưởng tính lại theo tiết mới. Tổng điểm, tổng số câu đúng, kỷ lục chuỗi đúng, số lần nhanh nhất và lịch sử câu hỏi vẫn giữ trong buổi. Hết kho câu hỏi thì dừng theo luật chống lặp.
- Mỗi tổ có một tổ trưởng: người có nhiều câu đúng nhất trong tổ ở tiết hiện tại. Khi hòa, ưu tiên thứ tự vào lớp. Tên tổ trưởng hiện ở đầu dãy và có huy hiệu tại ghế; quà không mua được chức này.
- Trả lời đúng liên tiếp từ 3 câu có biểu tượng lửa và độ dài chuỗi ở ghế. Sai hoặc bỏ lỡ một câu sẽ ngắt chuỗi. Kỷ lục chuỗi tốt nhất vẫn được lưu trong sổ đầu bài của phiên.
- Khi chốt đáp án, bảng vinh danh tạm hiện 3 người đúng nhanh nhất cùng thời gian; sang câu mới quay lại vinh danh thành tích cả buổi. Thời gian tạm dừng không tính vào tốc độ trả lời.
- Câu 5 và câu 10 có “Rung chuông”: cả lớp cùng đạt mục tiêu số người trả lời đúng. Mục tiêu chốt lúc mở câu, bằng nửa sĩ số làm tròn lên, tối thiểu 1 và tối đa 10. Kết quả chỉ công bố khi chốt đáp án; không có điểm thưởng riêng.
- Nút “Câu tiếp theo” chốt và tính điểm câu đang học trước khi chuyển, tránh mất đáp án đã nhận.

## Quyền từ quà

- Mọi quà: thêm lượt ưu tiên theo số lượng, giữ tối đa 3 lượt trong 10 phút. Quà khi đang chờ sẽ nâng chính lượt đang chờ thành ưu tiên. Tặng quà không tự đăng ký lên bảng; người xem bình luận `lên bảng` để dùng lượt ưu tiên.
- Quà/combo từ 10 xu: lớp trưởng 2 phút, được chuyển lên bàn danh dự riêng phía trước lớp, có vương miện và bảng tên. Khi nhận chức, màn hình có hiệu ứng chúc mừng và thầy giáo xướng tên. Người tặng sau đủ mốc có thể thay thế lớp trưởng. Hết nhiệm kỳ, nhân vật trở về ghế thường. Đây là danh hiệu, không phải quyền quản trị chat.
- Mốc lớp trưởng và thời gian câu hỏi đổi ở Luật quà & thiết lập. Mốc dùng giá trị xu từ dữ liệu quà TikTok, không phải số tiền người phát nhận được. Nếu sự kiện thiếu giá trị, chỉ cấp ưu tiên cơ bản.
- Hai lượt ưu tiên xen một lượt thường khi có cả hai hàng; hàng thường hết hạn sau 5 phút. Mỗi người chỉ có một lượt chờ.
- Combo dùng phần tăng thêm và ID sự kiện để hạn chế tính trùng.

## Kết nối thật

Mở LIVE bằng tài khoản đủ quyền, phát nguồn game qua OBS/LIVE Studio, nhập `@username` đang LIVE rồi Kết nối. Không tự phát livestream. Kết nối thành công sẽ xóa lớp giả lập để tránh trộn điểm thử; kiểm tra với một tài khoản khác bằng bình luận trước. Nút giả lập bị khóa khi đang kết nối thật. Nếu mất kết nối, kết nối lại thủ công sẽ bắt đầu lớp mới.

Thư viện `tiktok-live-connector` là thư viện không chính thức. Khả năng kết nối phụ thuộc TikTok, phòng LIVE, mạng và dịch vụ ký của thư viện; chưa kiểm chứng quà thật khi không có phiên LIVE để thử. Không tự kết nối bất kỳ tài khoản nào khi mở server.

Server mặc định lắng nghe 0.0.0.0 để điện thoại cùng Wi-Fi mở `http://<IP Wi-Fi của PC>:3000/?obs=1`. Trên điện thoại, bật TikTok LIVE Trò chơi di động/chia sẻ màn hình rồi chuyển sang trình duyệt đang hiển thị game. PC vẫn chạy backend và điều khiển tại localhost. Mở LIVE không tự mở màn hình game. Trang điện thoại chỉ nhận trạng thái qua WebSocket; token và lệnh điều khiển chỉ được cấp cho truy cập loopback trên PC. Nếu chỉ dùng PC, đặt biến `HOST=127.0.0.1`. Không chuyển tiếp cổng ra Internet.

## Dữ liệu và mã

Điểm, học sinh (tối đa 200/phiên), danh hiệu và hàng chờ nằm trong RAM, mất khi khởi động lại. Thiết lập lưu ở `data/classroom-settings.json`. Danh sách ghế hiển thị 30 người, tự chuyển dãy mỗi 15 giây nếu đông hơn. Âm thanh tổng hợp lưu trong `data/classroom-voice`. Nền lớp học mới ở `public/assets/classroom-room-male-v3.png` là tài nguyên tạo riêng, không lấy từ ảnh mẫu của trò chơi khác.

- `classroom-server.cjs`: server HTTP/WebSocket, TikTok và giả lập.
- `lib/classroom-engine.cjs`: luật chơi, điểm, hàng ưu tiên và quyền quà.
- `lib/classroom-questions.cjs`: 120 câu thuộc 3 nhóm: Toán, Tiếng Việt và kiến thức tổng hợp.
- `public/classroom.html`, `public/css/classroom.css`, `public/js/classroom.js`: giao diện lớp học.
- `npm test`: kiểm tra luật chơi và combo.

Bản chùa cũ còn trong `server.js` và các tài nguyên cũ để tham khảo; `npm run legacy` cần Bun. Trang chính và `npm start` hiện dùng lớp học. Không còn remote GitHub.

## Bố cục LIVE

- Không hiển thị lời thoại hoặc phụ đề TTS. Giọng đọc tự phát như trước.
- Khi vào lớp, chia luân phiên tổ 1 → 2 → 3, giữ nguyên tổ trong phiên. Tổ 1 đỏ, tổ 2 xanh dương, tổ 3 xanh lá; tên học sinh kèm số tổ. Hai cột bàn thuộc cùng một tổ, tối đa 10 người/tổ mỗi dãy hiển thị.
- Bảng vinh danh luôn hiện 5 người trả lời đúng nhiều nhất trong phiên, kèm số câu đúng và điểm. Người chưa có câu đúng chưa vào bảng vinh danh. Quà không tăng số câu đúng.
- Bàn lớp trưởng nằm bên phải bảng vinh danh, có nhân vật quay mặt về người xem và bảng tên riêng. Ghế thường chỉ đánh dấu đã chuyển lên bàn danh dự, không hiện trùng nhân vật. Dòng thông tin bên dưới ghi tên và thời gian còn lại; khi chưa có người giữ, bàn danh dự để trống.

## Kho câu hỏi và chống lặp

- Kho mới gồm 120 câu (40 Toán, 40 Tiếng Việt, 40 kiến thức tổng hợp), mỗi câu có đáp án và giải thích. Những câu đố mẹo mơ hồ của bản thử cũ đã được thay.
- Chọn ngẫu nhiên trong các câu chưa hỏi; vị trí đáp án A/B/C/D cũng được xáo trộn, đáp án đúng đi cùng nội dung.
- Trên PC, lịch sử ghi vào `data/classroom-question-history.json` trước khi câu xuất hiện; tải lại trang, xóa lớp, kết nối lại LIVE hoặc khởi động server không xóa file này. Trên Render Free, cần cấu hình Redis hoặc nhập bản sao để giữ lịch sử khi ổ đĩa tạm bị thay. Bảng điều khiển có xuất/nhập bản sao và hiển thị nơi đang lưu.
- Hết câu chưa dùng trong một môn thì lấy câu mới từ nhóm khác. Hết toàn bộ kho thì hiển thị “Đã hết câu hỏi mới” và dừng, không tự quay vòng.
- Bổ sung câu mới trong `lib/classroom-questions.cjs` rồi khởi động lại server. Mã câu dựa trên nội dung đề; sửa thứ tự lựa chọn không làm câu cũ thành câu mới.
- Không tự xóa lịch sử khi file lỗi; server báo lỗi để tránh lặp câu âm thầm. Đừng xóa file lịch sử trừ khi bạn chủ động muốn cho phép hỏi lại từ đầu.
- Khi không có màn hình game kết nối và không có TikTok LIVE đang kết nối, server không tự chuyển câu liên tục.
- Biến `CLASSROOM_HISTORY_FILE` dành cho môi trường kiểm thử; tránh dùng nhiều server ghi chung một lịch sử.

Một số nguồn đối chiếu cho nhóm kiến thức:
- NASA về Sao Thủy: https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-the-planet-mercury-grades-5-8/
- Bảo tàng Lịch sử quốc gia về Bạch Đằng 938: https://baotanglichsu.vn/vi/Articles/3098/13934/ngo-quyen-va-chien-thang-bach-djang-nam-938.html
- Bảo tàng Lịch sử quốc gia về Bạch Đằng 1288: https://baotanglichsuquocgia.vn/vi/Articles/3096/18594/tim-hieu-ve-nhung-chiec-coc-bach-djang-nam-1288-hien-djang-trung-bay-o-bao-tang-lich-su-quoc-gia.html
- Bảo tàng Lịch sử quốc gia về dời đô năm 1010: https://baotanglichsu.vn/vi/Articles/3096/6831/ai-la-nguoi-hien-ke-doi-djo-ve-thang-long.html
