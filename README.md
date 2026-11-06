# Lớp học làng · TikTok LIVE

Lớp học không gắn tên thầy cố định, khung dọc 9:16, người xem tham gia bằng bình luận và quà tặng TikTok LIVE. Nhân vật thầy giáo khớp với giọng nam Microsoft An trên PC; đường giọng Edge dùng Nam Minh mặc định. Có phòng giả lập để kiểm tra trước khi phát.

## Chức năng

- Bình luận `vào lớp` để điểm danh, tự chia 3 tổ và hiện nhân vật tại ghế.
- Trả lời A/B/C/D hoặc nội dung đáp án; chốt mới công bố kết quả, đúng +10 điểm.
- Kho 120 câu hỏi chung và 120 bài toán trả riêng, xáo trộn lựa chọn và lưu lịch sử chống lặp qua các lần khởi động.
- Bình luận `lên bảng` để đăng ký trả bài riêng sau câu chung. Tối đa một lượt giữa hai câu chung; bạn được gọi có 25 giây, chỉ bình luận của chính bạn được tính. Cả lớp dùng `vỗ tay` để cổ vũ.
- Trả bài đúng nhận 1 sao riêng, đủ 3 sao có danh hiệu **Học sinh bản lĩnh** và viền bàn vàng. Sai/hết giờ không trừ điểm. Kết quả hiện 10 giây rồi học sinh về chỗ; điểm và bảng vinh danh câu chung giữ riêng. Sao, danh hiệu, học sinh và điểm giữ trong phiên chạy; xóa lớp hoặc khởi động lại sẽ xóa thành tích, còn lịch sử câu hỏi vẫn được giữ.
- Mỗi tiết 10 câu, tổng kết top 3 và tổ dẫn đầu, tự sang tiết mới sau 15 giây.
- Tổ trưởng theo thành tích, chuỗi đúng, bảng người trả lời nhanh và rung chuông tập thể.
- Người dẫn đầu **tổng xu quà tặng trong phiên** trở thành **Thầy danh dự**, ghi tên bên nhân vật thầy giáo. Chưa có quà thì không hiện tên; bằng xu giữ người đang đứng lớp, chỉ đổi khi có người vượt lên. Combo chỉ cộng giá trị của các quà mới, không cộng lại tổng combo. Danh hiệu không cộng điểm học tập. Xóa lớp hoặc khởi động lại xóa tổng xu và tên danh dự của phiên.
- Tặng quà tự đăng ký một lượt trả bài ưu tiên, không cần bình luận thêm. Nếu đang xếp hàng thì nâng ưu tiên, không tạo lượt trùng. Nếu đang trả bài thì quà giữ quyền ưu tiên cho lần đăng ký sau; đủ mốc được làm lớp trưởng 2 phút, ngồi bàn danh dự có vương miện. Quà không cộng điểm học tập.
- Bình luận `vỗ tay` để cổ vũ, `thành tích` để nghe điểm cá nhân.
- Giọng đọc tiếng Việt tự đọc câu hỏi, kết quả và sự kiện; ưu tiên giọng Microsoft An trên PC Windows khi mở bản cloud.

### Điều khiển lượt trả bài

Đăng ký không ngắt câu chung. Sau 8 giây công bố đáp án câu chung, thầy tự gọi người đang chờ (hai lượt ưu tiên xen một lượt thường). Hàng chờ giữ tối đa 10 phút. Khi hết câu chung nhưng còn bài riêng, thầy vẫn nhận đăng ký và gọi trả bài riêng mà không lặp lại câu chung cũ. Khi hết bài riêng mới, game báo hết kho và tiếp tục câu chung, không phát lại bài cũ.

Trong điều khiển, **Mời trả bài sau câu chung** cho phép gọi sớm sau khi đã chốt đáp án. Khi đang trả bài, **Đổi bạn (bỏ lượt này)** bỏ lượt chưa làm xong, không tặng sao; **Chốt đáp án** kết thúc lượt, **Câu tiếp theo** quay về câu chung. Nếu học sinh đã trả lời đúng, đổi lượt không thu hồi sao. Tạm dừng hoặc chờ mở lớp sẽ đóng băng cả đồng hồ trả bài. Sổ trả bài trên bảng điều khiển theo dõi sao và số lượt từng người.

## Chạy trên PC

Cần **Node.js 22.12+**. Trên Windows, mặc định giọng đọc dùng **Windows Speech qua PowerShell 7**, cần cài giọng tiếng Việt (máy phát triển dùng Microsoft An). Có thể đặt biến `CLASSROOM_POWERSHELL` đến file `pwsh.exe`. Bản Linux/Docker dùng `edge-tts` và eSpeak NG dự phòng.

```sh
npm ci
npm start
```

- Điều khiển và giả lập: <http://localhost:3000>
- Nguồn game sạch: <http://localhost:3000/?obs=1>
- Đặt nguồn OBS/LIVE Studio ở **1080 × 1920**, không quay cả thanh địa chỉ trình duyệt.

Trên Windows có thể mở `start-classroom.cmd`. `open-game-window.cmd` mở cửa sổ game riêng bằng Edge.

## Thử trước khi LIVE

Mở `start-preview.cmd`, truy cập <http://localhost:3002>. Phòng này chỉ nhận comment/quà giả lập, có dữ liệu và lịch sử câu hỏi riêng, không kết nối TikTok. Có thể thêm 8 học sinh và thử từng hoạt động qua bảng điều khiển.

| Trong tiết | Tổng kết tiết |
| --- | --- |
| ![Lớp học, tổ trưởng và rung chuông](docs/demo/classroom-live.png) | ![Tuyên dương cuối tiết](docs/demo/classroom-summary.png) |

Ảnh minh họa dùng học sinh và sự kiện giả lập.

```sh
npm test
```

42 kiểm tra luật chơi, lịch sử, đăng nhập, lưu Redis, lời đọc và đồng hồ chờ/tiếp tục. Đã kiểm tra Docker Linux, HTTPS/WSS qua proxy, giọng Microsoft An cục bộ tự phát trên Chromium Windows, chống đọc trùng, tạm dừng/tiếp tục và chuyển câu. Các hoạt động lớp học đã được thử với 30 học sinh ở 390 px / 1080 px. Xem [TESTING.md](TESTING.md) về phạm vi kiểm chứng và đường phát thực tế.

## Kết nối và triển khai

Chạy LIVE trên TikTok rồi nhập username đang LIVE trong bảng điều khiển. Dự án dùng `tiktok-live-connector`, một thư viện không chính thức. Kết nối TikTok trong phiên dài và quà thật vẫn cần kiểm chứng trên tài khoản phát.

**Đã có cấu hình Render Free bằng Docker.** Đăng nhập điều khiển từ xa bằng `ADMIN_PASSWORD`, nguồn game HTTPS/WSS chỉ xem không cần đăng nhập. Giọng cloud dùng Edge TTS, tự chuyển sang eSpeak NG tiếng Việt khi dịch vụ trực tuyến lỗi. Xem **[DEPLOY.md](DEPLOY.md)** để tạo service, điền biến và đổi runtime Node sang Docker nếu đã tạo service trước đó.

**Biến bắt buộc khi deploy:** `ADMIN_PASSWORD` với mật khẩu riêng ít nhất 12 ký tự. Render cung cấp URL và PORT; Docker đã cấu hình cloud mode và TTS. Không đưa mật khẩu vào Git.

Lịch sử có thể lưu tự động qua **Upstash Redis Free** (thêm REST URL/token), hoặc xuất/nhập bản sao bằng giao diện. Không cấu hình Redis thì lịch sử file trên Render Free sẽ mất khi instance bị thay; cần nhập bản sao để tránh hỏi lại.

Dữ liệu cá nhân, browser profile và âm thanh sinh ra nằm trong `data/`, không đưa lên Git. Điểm và học sinh giữ trong RAM của server, mất khi khởi động lại server.

## Tài liệu và nguồn

- [CLASSROOM.md](CLASSROOM.md): luật chơi, lệnh bình luận và cấu trúc mã.
- [TESTING.md](TESTING.md): phạm vi đã test và giới hạn hiện tại.
- [DEPLOY.md](DEPLOY.md): Render Free, biến môi trường và lưu lịch sử.
- [SECURITY.md](SECURITY.md): đăng nhập, phiên và phạm vi dữ liệu công khai.

Phần lớp học phát triển từ một dự án game chùa; mã và tài nguyên cũ vẫn được giữ để tham khảo. Tài liệu gốc ở [docs/legacy-temple-readme.md](docs/legacy-temple-readme.md), ghi nhận nguồn 3D ở [public/assets/models/README.md](public/assets/models/README.md). Công khai repository không thay đổi quyền của tài nguyên bên thứ ba.
