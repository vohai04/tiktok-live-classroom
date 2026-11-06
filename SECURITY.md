# Phạm vi bảo mật

Bản PC không đặt ADMIN_PASSWORD vẫn chỉ cho điều khiển qua loopback. Bản cloud bắt buộc ADMIN_PASSWORD từ 12 ký tự và public URL HTTPS; thiếu cấu hình thì server không khởi động.

Đăng nhập dùng cookie ngẫu nhiên HttpOnly/Secure/SameSite=Strict, hết hạn sau 12 giờ, lưu phiên trên server. Các lệnh cần cookie và token chống CSRF của phiên; kiểm tra Origin theo public URL đã cấu hình. Sai mật khẩu 8 lần trong 15 phút bị giới hạn theo IP. Đăng xuất hoặc khởi động lại server vô hiệu hóa phiên. Chạy qua reverse proxy HTTPS (Render đã cung cấp).

Nguồn `/?obs=1`, API trạng thái và WebSocket chỉ xem được công khai để OBS/LIVE Studio mở không cần mật khẩu. Chúng có tên người chơi, điểm, nhật ký sự kiện và giọng đọc; không dùng lớp này để thu thập thông tin riêng tư. WebSocket không nhận lệnh điều khiển. API đăng nhập/điều khiển không đưa cookie, mật khẩu hoặc token Redis vào trạng thái công khai.

Edge TTS gửi nội dung cần đọc (bao gồm tên hiển thị của người xem) đến dịch vụ Microsoft Edge. eSpeak NG dự phòng tổng hợp tại server. Redis tùy chọn chỉ lưu ID/lượt câu đã dùng, không lưu thông tin người chơi.

Không commit thư mục `data/`, `.env`, cookie TikTok, token GitHub hoặc browser profile. Cấu hình cá nhân và âm thanh tổng hợp đã được loại khỏi Git.

Không gửi thông tin đăng nhập hoặc cookie vào GitHub Issues. Khi báo lỗi, mô tả bước tái hiện và che thông tin cá nhân trong ảnh/log.
