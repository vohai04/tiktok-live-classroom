# Phạm vi bảo mật

Bản hiện tại dành cho máy tính chạy game. Các lệnh điều khiển và token phiên chỉ được cấp cho truy cập loopback; máy cùng mạng chỉ xem nguồn game. Đây chưa phải hệ thống đăng nhập dành cho một website công khai.

Không mở cổng server trực tiếp ra Internet hoặc bỏ kiểm tra loopback để triển khai cloud. Cần bổ sung xác thực điều khiển từ xa và cấu hình HTTPS/WebSocket trước khi deploy.

Không commit thư mục `data/`, `.env`, cookie TikTok, token GitHub hoặc browser profile. Cấu hình cá nhân và âm thanh tổng hợp đã được loại khỏi Git.

Không gửi thông tin đăng nhập hoặc cookie vào GitHub Issues. Khi báo lỗi, mô tả bước tái hiện và che thông tin cá nhân trong ảnh/log.
