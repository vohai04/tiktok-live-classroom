# Deploy Render Free

Bản Docker chứa Node.js, Python, `edge-tts` và giọng Việt eSpeak NG dự phòng. Không cần Windows hay PowerShell trên Render. Server có đăng nhập điều khiển và nguồn game HTTPS/WSS riêng.

## Tạo dịch vụ

1. Vào <https://dashboard.render.com/> → **New → Web Service**.
2. Chọn GitHub repo **vohai04/tiktok-live-classroom**, nhánh **main**.
3. Chọn **Language/Runtime: Docker**, gói **Free**. Không chọn Static Site.
4. Dockerfile path: `./Dockerfile`. Để trống Docker Command để dùng `npm start` đã có trong image. Không nhập build command `npm ci` của runtime Node.
5. Thêm **ADMIN_PASSWORD** với mật khẩu riêng dài ít nhất 12 ký tự. Không dùng mật khẩu ví dụ và không commit vào Git.
6. Health Check Path: `/healthz`, rồi Deploy.

Có thể dùng **New → Blueprint** với repo này để Render đọc `render.yaml`; chọn Free và nhập ADMIN_PASSWORD khi được hỏi.

Nếu đã tạo dịch vụ Node trước đó: **Settings → Build → Source → Edit**, chọn lại repo, nhánh `main`, đổi Runtime sang **Docker**, rồi Deploy. Hướng dẫn nền tảng: <https://render.com/docs/native-runtimes#changing-a-services-runtime>.

## Biến môi trường

| Biến | Cần điền? | Giá trị |
| --- | --- | --- |
| `ADMIN_PASSWORD` | **Có** | Mật khẩu riêng từ 12 ký tự để đăng nhập điều khiển |
| `CLASSROOM_CLOUD` | Docker đã đặt | `1` |
| `CLASSROOM_TTS` | Docker đã đặt | `edge` |
| `CLASSROOM_VOICE` | Tùy chọn | `vi-VN-HoaiMyNeural` (mặc định); có thể dùng `vi-VN-NamMinhNeural` |
| `CLASSROOM_PUBLIC_URL` | Chỉ khi dùng tên miền riêng / host khác | URL HTTPS của game, ví dụ `https://lop-hoc.example.com`; không có `/?obs=1` |
| `PORT` | Không | Render tự cấp |
| `CLASSROOM_PREVIEW` | Tùy chọn | `1` để khóa TikTok, chỉ chạy giả lập; bỏ biến này hoặc đặt `0` để kết nối LIVE |

Render tự cung cấp `RENDER_EXTERNAL_URL`; code dùng URL này để xác thực Origin cho HTTPS/WebSocket. Nếu dùng domain riêng, đặt `CLASSROOM_PUBLIC_URL` theo đúng domain sẽ mở trên trình duyệt.

## Giữ lịch sử câu hỏi qua deploy

Ổ đĩa Render Free là tạm thời: file mất khi instance được thay. Muốn không lặp câu sau restart, tạo **Upstash Redis Free** của bạn tại <https://console.upstash.com/>, rồi thêm cả hai biến sau vào Render:

| Biến | Nguồn |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST URL của database, dạng `https://….upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | REST token có quyền đọc/ghi của database, không dùng Read Only token |

Không commit token. Dùng một instance game cho một key lịch sử. Có thể đổi `CLASSROOM_HISTORY_KEY` để tách hai lớp độc lập.

Khi đã cấu hình Redis, game chờ ghi lịch sử thành công trước khi gửi câu mới đến màn hình. Redis lỗi thì ngừng công bố câu mới và thử lưu lại, không tự mở kho trống. Chỉ ghi khi có câu mới/nhập lịch sử, không ghi Redis mỗi giây.

Nếu chưa dùng Redis, bảng điều khiển có **Xuất bản sao / Nhập bản sao**. Xuất trên PC hoặc trước khi redeploy, nhập lại khi mở server mới. Nhập chỉ gộp câu đã dùng; không xóa lịch sử. Nếu không cấu hình Redis và không nhập bản sao, không thể giữ lịch sử qua việc Render thay instance.

Điểm, học sinh và chức danh hiện vẫn giữ trong RAM theo phiên. Redis ở đây chỉ lưu lịch sử câu hỏi, không lưu điểm hoặc thông tin người xem.

## Dùng sau deploy

- Điều khiển: mở `https://TEN-DICH-VU.onrender.com/admin`, đăng nhập bằng ADMIN_PASSWORD.
- Nguồn OBS/LIVE Studio: `https://TEN-DICH-VU.onrender.com/?obs=1`, kích thước **1080 × 1920**. Nguồn chỉ xem này không cần mật khẩu.
- Khi chưa kết nối TikTok, giữ bảng điều khiển đã đăng nhập mở để tiết học tự chạy. Người lạ chỉ xem nguồn sẽ không tự làm server chạy hết kho câu hỏi. Khi TikTok đã kết nối, tiết học chạy ngay cả khi đóng bảng điều khiển.
- Đăng nhập có hiệu lực 12 giờ, cookie HttpOnly/Secure/SameSite=Strict. Đổi mật khẩu/restart sẽ yêu cầu đăng nhập lại.
- Thử điểm danh, quà giả lập và âm thanh trước. Sau đó mới kết nối tài khoản TikTok đang LIVE trong bảng điều khiển.
- Giọng Edge cần Internet và dùng thư viện cộng đồng, có thể không kết nối được từ một số mạng. Khi lỗi, worker chuyển sang eSpeak NG tiếng Việt; giọng dự phòng kém tự nhiên hơn. Không có phí API TTS trong cấu hình này.
- Trình duyệt/ứng dụng phát vẫn có chính sách autoplay riêng. OBS Browser Source cần bật âm thanh; bảng điều khiển mặc định không phát để tránh trùng tiếng. Cần ghi thử trong ứng dụng phát để xác nhận âm thanh đầu ra.

Render Free có giới hạn giờ, băng thông và có thể khởi động lại. Các kết nối game có heartbeat và tự nối lại; không giữ server thức bằng bot khi không sử dụng. Tài liệu: <https://render.com/docs/free>.

## Tự kiểm tra image

```sh
docker build -t classroom-cloud .
docker run --rm classroom-cloud npm test
docker run --rm classroom-cloud npm run test:cloud
```

`test:cloud` tạo server Linux tạm, kiểm tra đăng nhập/quyền điều khiển, WebSocket, nhập/xuất lịch sử và file WAV tiếng Việt dự phòng thật. Bài này cố ý ép giọng offline để tái hiện ổn định, không xác nhận kết nối TikTok hoặc Edge trên Render.
