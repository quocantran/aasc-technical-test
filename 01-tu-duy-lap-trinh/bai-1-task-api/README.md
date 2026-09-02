# Bài 1: Nghiên cứu và Triển khai Task API với NestJS

RESTful API quản lý công việc (Task Management) được xây dựng với **NestJS**, **MongoDB (Mongoose)**, **Docker Compose**, **Swagger (OpenAPI)** và kiểm thử tự động với **Jest**.

---

## 1. Kiến trúc NestJS và Vai trò các Thành phần

### Modules (Mô-đun)
Đóng vai trò là các khối xây dựng (building blocks) tổ chức mã nguồn thành các cụm tính năng độc lập, quản lý việc đóng gói (encapsulation), chia sẻ tài nguyên và thiết lập cơ chế Dependency Injection (DI) trong toàn bộ ứng dụng.

### Controllers (Bộ điều khiển)
Chịu trách nhiệm tiếp nhận, định tuyến các yêu cầu HTTP (HTTP requests) từ client và chuyển tiếp xử lý tới Service tương ứng. Quá trình kiểm tra tính hợp lệ (Validation) và chuyển đổi kiểu dữ liệu đầu vào (Transformation) được thực hiện thông qua Pipes kết hợp với DTOs.

### Services / Providers (Dịch vụ xử lý nghiệp vụ)
Chứa toàn bộ logic nghiệp vụ (business logic) và các thao tác tương tác với cơ sở dữ liệu. Services được tách biệt hoàn toàn khỏi tầng giao tiếp HTTP, giúp mã nguồn dễ bảo trì, tái sử dụng và viết Unit Test độc lập.

### Vai trò và cách NestJS sử dụng TypeScript
- **Decorators (`@Prop()`, `@Get()`, `@InjectModel()`...)**: Cung cấp cú pháp khai báo metadata trực quan, giảm thiểu mã mẫu (boilerplate code).
- **Kiểm soát kiểu dữ liệu tĩnh (Type Safety)**: Đảm bảo an toàn kiểu dữ liệu xuyên suốt từ DTO, Mongoose Schema tới Service/Controller ngay từ thời điểm biên dịch (Compile-time), giảm thiểu lỗi runtime.
- **Tiêm phụ thuộc tự động (Dependency Injection)**: Tự động nhận diện và inject dependencies thông qua TypeScript reflection metadata (`reflect-metadata`).

---

## 2. Mô hình Dữ liệu Task (Mongoose Schema)

| Trường (Field) | Kiểu dữ liệu (Type) | Ràng buộc (Constraints) | Mô tả (Description) |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID v4) | Duy nhất (Unique), Đánh chỉ mục (Indexed), Bắt buộc | Mã định danh duy nhất của task |
| `title` | `String` | Bắt buộc (Required), Cắt khoảng trắng (Trimmed) | Tiêu đề công việc |
| `description` | `String` | Tùy chọn, Mặc định: `""`, Cắt khoảng trắng | Mô tả chi tiết công việc |
| `status` | `Enum` | `"To Do"`, `"In Progress"`, `"Done"` | Trạng thái công việc (Mặc định: `"To Do"`) |
| `createdAt` | `Date` | Tự động sinh bởi Mongoose (`timestamps: true`) | Thời gian tạo bản ghi |
| `updatedAt` | `Date` | Tự động cập nhật bởi Mongoose (`timestamps: true`) | Thời gian cập nhật gần nhất |

---

## 3. Danh sách Endpoints RESTful API

- **Tiền tố API toàn cục (Global Prefix)**: `/api/v1`  
- **Tài liệu giao diện Swagger (OpenAPI)**: `http://localhost:3000/docs`
- **Validation**:
  - Tầng DTO: `ValidationPipe` với `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
  - Tầng Route Param: `ParseUUIDPipe({ version: '4' })` chặn các ID không hợp lệ ngay tại Gateway với mã `400 Bad Request`.

| Phương thức | Đường dẫn (Endpoint) | Tham số Query / Param | Mô tả chức năng | Mã phản hồi |
| :---: | :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/tasks` | Body: `CreateTaskDto` | Tạo mới một công việc | `201 Created` / `400` |
| `GET` | `/api/v1/tasks` | Query: `?page=1&limit=20` | Lấy danh sách công việc có phân trang (sắp xếp giảm dần theo `createdAt`) | `200 OK` |
| `GET` | `/api/v1/tasks/:id` | Param: `:id` (UUID v4) | Lấy chi tiết công việc theo ID (UUID) | `200 OK` / `400` / `404` |
| `PATCH` | `/api/v1/tasks/:id` | Param: `:id`, Body: `UpdateTaskDto` | Cập nhật thông tin công việc theo ID (UUID) | `200 OK` / `400` / `404` |
| `DELETE` | `/api/v1/tasks/:id` | Param: `:id` (UUID v4) | Xóa công việc theo ID (UUID) | `200 OK` / `400` / `404` |

### Giao diện Tài liệu Swagger OpenAPI:
![Giao diện Swagger API](./assets/swagger.png)

---

## 4. Hướng dẫn Cài đặt và Khởi chạy

### Bước 1: Chuẩn bị tệp cấu hình môi trường
```bash
cp .env.example .env
```

### Bước 2: Khởi động cơ sở dữ liệu MongoDB bằng Docker Compose
```bash
docker compose up -d
```

### Bước 3: Cài đặt các gói phụ thuộc và chạy ứng dụng
```bash
npm install
npm run start:dev
```
- Địa chỉ máy chủ API: `http://localhost:3000/api/v1`
- Giao diện Swagger UI: `http://localhost:3000/docs`

---

## 5. Dữ liệu Mẫu (Seeder) & Kiểm thử Hiệu năng (Benchmark)

### 5.1. Khởi tạo 100 Task mẫu (Database Seeder)
Chạy script tự động nạp 100 tasks mẫu có đánh chỉ mục UUID vào cơ sở dữ liệu MongoDB:
```bash
npm run seed
```

### 5.2. Đo lường Hiệu năng API (Latency Benchmark)
Kịch bản kiểm thử gửi 100 yêu cầu GET liên tiếp tới endpoint `/api/v1/tasks` với cơ sở dữ liệu chứa sẵn 100 bản ghi:
```bash
npm run benchmark
```

| Chỉ số đo lường | Kết quả thực tế |
| :--- | :---: |
| Số lượng bản ghi trong CSDL | 100 bản ghi |
| Số lượng yêu cầu HTTP gửi đi | 100 yêu cầu |
| Độ trễ thấp nhất (Min latency) | 3.80 ms |
| Độ trễ trung bình (Average latency) | 5.13 ms |
| Độ trễ phân vị 95 (P95 latency) | 9.90 ms |
| Độ trễ cao nhất (Max latency) | 15.45 ms |
| **Yêu cầu đề bài** | **< 200 ms** |
| **Đánh giá kết quả** | **ĐẠT (PASS)** |

### Kết quả đo lường thực tế trên Terminal:
![Kết quả Benchmark](./assets/benchmark.png)

---

## 6. Kiểm thử Tự động (Unit Tests)

Bộ kiểm thử Jest bao phủ đầy đủ **11/11 kịch bản kiểm thử** cho `TaskService` (bao gồm kiểm thử phân trang mặc định và tùy biến limit/page):

```bash
npm test
```
### Kết quả chạy Unit Test thực tế:
![Kết quả Unit Test](./assets/test.png)

