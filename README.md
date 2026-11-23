# LocalCode IDE – VS Code Style Edition (Local + Netlify Cloud Hybrid)

IDE lập trình phong cách **Visual Studio Code Dark Modern**, hỗ trợ **Desktop**, **iPad** và **iPhone** với 2 chế độ hoạt động tự động:
1. **Local Backend Mode (`localhost`)**: Dùng `clangd`, `Pyright`, `GCC/G++` và `Python 3` cài trực tiếp trên Windows.
2. **Standalone Cloud Mode (Netlify / iPad mọi lúc không cần bật PC)**: Lưu trữ cây thư mục đa cấp bằng **IndexedDB** ngay trên trình duyệt, biên dịch C/C++ (cả DSA lẫn dự án OOP nhiều file `.h`/`.cpp`) và Python 3 qua **Piston API**, kèm bộ gợi ý STL/OOP tích hợp sẵn.

## Triển khai lên Netlify (không cần bật máy Windows)
1. Đẩy thư mục dự án lên GitHub (hoặc chạy `npm --prefix client run build` để lấy thư mục `client/dist`).
2. Trên **Netlify**:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Mở link Netlify trên Safari iPad -> chọn **Chia sẻ (Share) -> Thêm vào Màn hình chính (Add to Home Screen)** để sử dụng như ứng dụng độc lập.
