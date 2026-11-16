# Robot 2027 - App V2.1 Hoàn Chỉnh (Hybrid Online/Offline + 18 Vai Trò + Bộ Nhớ Gia Đình)

## Các tính năng cốt lõi trong bản V2.1:
1. **Hộp thoại thông báo tải Bộ não AI ngay lần mở đầu tiên:**
   - Hỏi người dùng tải trực tiếp model nhẹ **SmolLM2-135M (95 MB)** từ Internet về máy (hoặc bấm **Để sau** để dùng chế độ Online trước).
2. **Tự động chuyển đổi Online / Offline & 2 Chế độ hoạt động:**
   - **Khi có mạng (Online):** Chọn được **Chế độ 1 (Trả lời thẳng từ API)** hoặc **Chế độ 2 (API Backend + Model Local xử lý diễn đạt lại)**.
   - **Khi mất mạng (Offline):** Tự động kiểm tra Bộ não AI trên máy — nếu có thì trả lời trực tiếp bằng AI cục bộ, nếu chưa tải thì báo nhắc cập nhật/tải bộ não AI.
3. **18 Vai trò (Personas) đa dạng:**
   - Giáo viên tiếng Anh, Bạn thân, Mẹ hiền, Bố hài hước, Ông/Bà, Anh/Chị lớn, Điều dưỡng, Nhà khoa học, Người kể chuyện, Quản trò, Bạn học Toán, Nghệ sĩ âm nhạc, Siêu anh hùng, Kiểm lâm động vật, Phi hành gia, Đầu bếp, Người lắng nghe tâm sự, Quản gia thông thái.
4. **Chủ động hỏi tên & Ghi nhớ thành viên gia đình:**
   - Khi gặp người mới, Bot chủ động chào *"Hello! I am Robot 2027. What is your name?"*, tự nhận diện tên/tuổi/vai trò từ câu trả lời, lưu vào bộ nhớ gia đình trên máy và sẵn sàng xuất JSON đồng bộ về Server.
5. **Tối ưu phần cứng CPU NEON + GPU Render:**
   - Biên dịch C++ `-O3 -ffast-math`, tự cân chỉnh số nhân hiệu năng cao của chip điện thoại và bật `hardwareAccelerated` cho giao diện khuôn mặt mượt mà.
