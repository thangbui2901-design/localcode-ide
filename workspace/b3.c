/*
Định nghĩa cấu trúc khách hàng là các hộ gia đình dùng điện. Mỗi hộ khách hàng gồm các thông tin sau: số điện thoại khách hàng (kiểu xâu kí tự), họ tên khách hàng (kiểu xâu kí tự), địa  chỉ (kiểu xâu kí tự), số điện tiêu thụ (kiểu số). 
Xây dựng các hàm thực hiện các chức năng sau: 
1. Nhập vào danh sách gồm n khách hàng dùng điện vào bộ nhớ động. 
2. Hiển thị danh sách n khách hàng ra màn hình. Thông tin mỗi khách hàng trên một dòng. 
3. In ra màn hình danh sách khách hàng có địa chỉ ở CG. 
4. Nhập vào số điện thoại khách hàng, in ra màn hình thông tin của khách hàng đó. 5. Ghi vào file doanhnghiep.txt thông tin khách hàng có số điện tiêu thụ lớn hơn 500. Chương trình chính gọi thực hiện các hàm trên.
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char SDT[20];
    char hoTen[20];
    char diaChi[20];
    float soDien;
} KhachHang;

void xoaEnter(char *s) {
    s[strcspn(s, "\n")] = '\0';
}

void nhap(KhachHang ds[], int n) {
    for (int i = 0; i < n; i++) {
        printf("Nhap thong tin khach hang %d\n", i + 1);

        printf("Nhap so dien thoai: ");
        fgets(ds[i].SDT, sizeof(ds[i].SDT), stdin);
        xoaEnter(ds[i].SDT);

        printf("Nhap ho ten: ");
        fgets(ds[i].hoTen, sizeof(ds[i].hoTen), stdin);
        xoaEnter(ds[i].hoTen);

        printf("Nhap dia chi: ");
        fgets(ds[i].diaChi, sizeof(ds[i].diaChi), stdin);
        xoaEnter(ds[i].diaChi);

        printf("Nhap so dien tieu thu: ");
        scanf("%f", &ds[i].soDien);
        getchar();
    }
}

int main() {
    int n;
    printf("Nhap so khach hang: ");
    scanf("%d", &n);

    KhachHang *ds = (KhachHang *)malloc(n * sizeof(KhachHang));
    if (ds == NULL) {
        return 1;
    }

    nhap(ds, n);
    free(ds, n);
    return 0;
}