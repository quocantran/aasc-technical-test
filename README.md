# AASC Technical Assessment Suite

> Hướng dẫn điều hướng các bài kiểm tra đánh giá năng lực lập trình Backend & Tích hợp hệ thống tại **AASC**. Chi tiết hướng dẫn cài đặt, cấu hình và kết quả kiểm thử vui lòng xem trực tiếp tại file `README.md` bên trong từng thư mục tương ứng.

---

## 📑 Danh Sách & Ánh Xạ Bài Test (Project Mapping)

### 1. [Đề bài: Lập trình ứng dụng API tích hợp Jotform và Bitrix24](./01-api-jotform-bitrix24)
* **Thư mục dự án:** [`01-api-jotform-bitrix24/`](./01-api-jotform-bitrix24)
* **File đề bài gốc:** `V1 - Bai Kiem tra Co ban ve Tich hop - Version 2.pdf`
* **Mô tả:** Ứng dụng Middleware (Node.js/TypeScript/Express) tiếp nhận Webhook từ Jotform, xác thực dữ liệu (Zod) và tự động tạo mới bản ghi Contact trên Bitrix24 CRM theo thời gian thực.
* **Chi tiết & Hướng dẫn chạy:** Xem tại [01-api-jotform-bitrix24/README.md](./01-api-jotform-bitrix24/README.md).

---

### 2. [Bài Kiểm Tra Đánh Giá Kỹ Năng Lập Trình API với NestJS](./01-api-nestjs)
* **Thư mục dự án:** [`01-api-nestjs/`](./01-api-nestjs)
* **File đề bài gốc:** `V1 - Bai Kiem tra Danh gia API co ban.pdf`
* **Mô tả:**
  * **Bài 1:** Triển khai OAuth 2.0 Local App với Bitrix24 (`/install`, quản lý token SQLite, cơ chế Auto-Refresh & Retry, hàm gọi API chung, ngrok).
  * **Bài 2:** RESTful API quản lý Contact & Requisites (Thông tin ngân hàng 3 tầng), tối ưu Bitrix24 Batch API (`/rest/batch.json`), Swagger UI (`/docs`), x-api-key Guard, 61 Unit Tests (100% Lines Coverage).
* **Chi tiết & Hướng dẫn chạy:** Xem tại [01-api-nestjs/README.md](./01-api-nestjs/README.md).

---

### 3. [Bài Kiểm tra về tư duy lập trình](./01-tu-duy-lap-trinh)
* **Thư mục dự án:** [`01-tu-duy-lap-trinh/`](./01-tu-duy-lap-trinh)
* **File đề bài gốc:** `V1 - Bai Kiem tra ve Tu duy lap trinh.pdf`
* **Bao gồm 3 phần bài làm:**
  * **Bài 1: Nghiên cứu và Triển khai API với NestJS** $\rightarrow$ [`01-tu-duy-lap-trinh/bai-1-task-api/`](./01-tu-duy-lap-trinh/bai-1-task-api) (Task CRUD MVC, MongoDB / Mongoose, Swagger OpenAPI, Jest Unit Tests).
  * **Bài 2: Tính Số Fibonacci Thứ 50** $\rightarrow$ [`01-tu-duy-lap-trinh/bai-2-fibonacci/`](./01-tu-duy-lap-trinh/bai-2-fibonacci) (Thuật toán Dynamic Programming, BigInt, Benchmark $< 1\text{ms}$).
  * **Bài 3: Phát triển Server Game Đơn Giản với NestJS** $\rightarrow$ [`01-tu-duy-lap-trinh/bai-3-game-server/`](./01-tu-duy-lap-trinh/bai-3-game-server) (Game Server WebSocket / Socket.IO, MongoDB, Auth JWT/Bcrypt, Game Line 98 & Cờ Caro X O 15x15 Canvas).

---

## 👨‍💻 Thông Tin Tác Giả & Nộp Bài

* **Ứng viên:** Trần Quốc An
* **GitHub Repository:** [https://github.com/quocantran/aasc-technical-test.git](https://github.com/quocantran/aasc-technical-test)
