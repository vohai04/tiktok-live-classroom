# Kiểm tra trước khi đưa lên LIVE

Không dùng phiên LIVE công khai làm bước kiểm thử đầu tiên.

## Phòng thử riêng trên PC

Chạy `start-preview.cmd`, mở http://localhost:3002. Chỉ dùng các nút comment/quà giả lập; server phòng thử từ chối kết nối TikTok. Học sinh và điểm nằm trong phiên thử riêng; thiết lập và lịch sử câu hỏi dùng `data/preview/`, không dùng kho lịch sử của bản LIVE. Màn hình sạch để ghi thử: http://localhost:3002/?obs=1.

## Logic

`npm test` kiểm tra chấm điểm, lượt trả lời, tổ, lớp trưởng, hàng ưu tiên, combo quà và lịch sử chống lặp câu hỏi. Các kiểm tra giả lập không chứng minh thư viện kết nối TikTok đang hoạt động ổn định.

## Hình và tiếng tại nguồn

- Nguồn phải render trực tiếp ở 1080 × 1920, khung dọc, 30 FPS.
- Kiểm tra mọi câu hỏi trong kho, tên dài, 30 học sinh, bảng vinh danh đủ 5 người và trạng thái hết kho. Không có chữ tràn, chồng khung hay bị cắt mất.
- Giọng Việt phải tự phát; không có nút kích hoạt nằm trên màn hình LIVE. Kiểm tra file âm thanh không rỗng và trình phát thực sự chạy.
- Không lấy cửa sổ xem thử 570 × 1000, cắt một vùng nhỏ rồi phóng lên 1080 × 1920. Kích thước bản ghi phải được kiểm tra, không suy ra từ kích thước canvas.

## Luồng phát nên dùng cho bản web

OBS Browser Source → cảnh 1080 × 1920 → đường phát TikTok được tài khoản cấp, hoặc OBS Virtual Camera → Camera của LIVE Studio nếu khả dụng. Browser Source dùng URL `http://localhost:3000/?obs=1`, Width 1080, Height 1920. Base Canvas và Output cùng 1080 × 1920, 30 FPS.

Camera ảo chỉ chuyển hình. Âm thanh cần cấu hình riêng trong OBS/LIVE Studio và kiểm tra bằng bản ghi có tiếng. Không mặc định rằng thấy hình nghĩa là đã có tiếng.

Trước khi phát, ghi thử từ chính ứng dụng phát 30–60 giây, xem lại ở kích thước thật và nghe bằng tai nghe: chữ rõ, khung đủ, tiếng không vọng/nhân đôi, không lộ tab/địa chỉ/cửa sổ riêng tư. Bản ghi tạo từ trình duyệt không thay cho bước này.

## TikTok thực tế

Sau kiểm tra cục bộ, dùng chế độ thử nếu tài khoản có. Kiểm tra người xem từ tài khoản khác: bình luận, đáp án, quà, combo và mất/kết nối lại; so hình người xem nhận được với nguồn. Không thông báo “sẵn sàng LIVE” chỉ dựa trên unit test hay trạng thái WebSocket vừa connected.

## Kết quả hiện tại

- 36 kiểm tra luật chơi, lịch sử, đăng nhập/cookie/CSRF/Origin và Redis (mock REST): qua trên Windows và Docker Linux.
- `npm run test:cloud` trong Docker Linux: qua; kiểm tra server thật, đăng nhập/đăng xuất, chặn API chưa đăng nhập, WebSocket Origin, xuất/nhập lịch sử và file WAV tiếng Việt eSpeak NG thật. Bài này ép offline để kiểm tra fallback ổn định.
- Bài chạy thử cloud cũng qua khi giới hạn container ở 512 MB RAM / 0.5 CPU. Đây không phải benchmark tải cao hoặc xác nhận độ ổn định phiên dài.
- Trình duyệt qua HTTPS reverse proxy cục bộ đến container: đăng nhập, cookie Secure, điều khiển, nguồn chỉ xem không có cookie, WSS, tự phát âm thanh, tải/nhập lịch sử và đăng xuất: qua, không ghi nhận lỗi JavaScript.
- Đã liệt kê được hai giọng vi-VN của Edge từ container; trong lần thử phát âm thanh qua trình duyệt, worker dùng eSpeak NG dự phòng. Chưa xác nhận giọng Edge tự nhiên hoạt động trên mạng Render.
- Chưa có tài khoản/URL Render của người dùng để xác nhận service đã deploy. Kiểm tra Docker/HTTPS cục bộ không thay cho kiểm tra trên Render và TikTok.
- Playwright qua giao diện thật của phòng thử: 30 học sinh, quà lớp trưởng, vỗ tay, tổ trưởng, 10 câu, bảng tốc độ, rung chuông, tổng kết, sang tiết mới giữ thành tích, hỏi điểm cá nhân. Không ghi nhận lỗi JavaScript.
- Kiểm tra vùng bố cục ở 390 × 844 và 1080 × 1920: bảng tổng kết và thanh tiến trình không tràn, các vùng chính không chồng nhau. Đã xem ảnh màn hình lúc rung chuông và tổng kết.
- Đã kiểm tra sự kiện giọng đọc tổng kết tiết và file WAV được trả về hợp lệ.
- Render 120 câu ở 1080 × 1920: không phát hiện tràn bảng.
- Giọng Việt tự phát trong trình duyệt có chính sách autoplay: qua.
- Có clip mẫu nguồn 1080 × 1920 / 30 FPS, âm thanh ghép từ đúng file TTS đã kiểm tra. Đây không phải bản ghi từ TikTok/LIVE Studio.
- Chưa kiểm chứng toàn bộ luồng OBS → LIVE Studio → TikTok trên tài khoản người dùng. Kết nối TikTok từng tự ngắt; chưa được xác nhận ổn định cho phiên dài.

Tham khảo: https://obsproject.com/kb/browser-source và https://obsproject.com/kb/virtual-camera-guide
