#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

typedef struct {
    char maTS[20];
    char tenTS[50]; // Tăng lên 50 để không bị cắt cụt họ tên
    float Toan;
    float Anh;
    float Van;
} ThiSinh;

void xoaEnter(char *s) {
    s[strcspn(s, "\n")] = '\0';
}

void nhap(ThiSinh ds[], int n) {
    for (int i = 0; i < n; i++) {
        printf("\nNhap thong tin thi sinh %d\n", i + 1);

        printf("Nhap ma thi sinh: ");
        fgets(ds[i].maTS, sizeof(ds[i].maTS), stdin);
        xoaEnter(ds[i].maTS);

        printf("Nhap ten thi sinh: ");
        fgets(ds[i].tenTS, sizeof(ds[i].tenTS), stdin);
        xoaEnter(ds[i].tenTS); // Sửa maTS -> tenTS

        printf("Nhap diem toan: ");
        scanf("%f", &ds[i].Toan);
        getchar();

        printf("Nhap diem Anh: ");
        scanf("%f", &ds[i].Anh);
        getchar();

        printf("Nhap diem Van: ");
        scanf("%f", &ds[i].Van);
        getchar();
    }
}

void tieude() {
    printf("\n%-15s %-25s %-10s %-10s %-10s %-12s\n",
           "Ma TS", "Ten", "Toan", "Anh", "Van", "Tong Diem");
}

void in1TS(ThiSinh ts) {
    float tong = ts.Toan + ts.Anh + ts.Van;
    printf("%-15s %-25s %-10.2f %-10.2f %-10.2f %-12.2f\n",
           ts.maTS, ts.tenTS, ts.Toan, ts.Anh, ts.Van, tong);
}

void xuat(ThiSinh ds[], int n) {
    tieude();
    for (int i = 0; i < n; i++) {
        in1TS(ds[i]);
    }
}

void ts8(ThiSinh ds[], int n) {
    int check = 0;
    for (int i = 0; i < n; i++) {
        if (ds[i].Toan >= 8) {
            if (check == 0) {
                tieude();
            }
            in1TS(ds[i]);
            check = 1;
        }
    }
    if (check == 0) {
        printf("\nKhong co thi sinh nao co diem Toan >= 8!\n");
    }
}

void dtk(ThiSinh ds[], int n) {
    float x;
    printf("\nNhap diem tong ket: ");
    scanf("%f", &x);
    int check = 0;

    for (int i = 0; i < n; i++) {
        float diemTK = ds[i].Toan + ds[i].Anh + ds[i].Van; // Tổng 3 môn theo đề bài
        if (fabs(diemTK - x) < 0.01) {
            if (check == 0) {
                tieude();
            }
            in1TS(ds[i]);
            check = 1;
        }
    }
    if (check == 0) {
        printf("Khong co thi sinh nao!\n");
    }
}

void ghiFile(ThiSinh ds[], int n) {
    FILE *f = fopen("thisinh.txt", "w");
    if (f == NULL) {
        printf("\nKhong mo duoc file D:/thisinh.txt!\n");
        return;
    }

    for (int i = 0; i < n; i++) {
        fprintf(f, "%s\t%s\t%.2f\t%.2f\t%.2f\n",
                ds[i].maTS,
                ds[i].tenTS,
                ds[i].Toan,
                ds[i].Anh,
                ds[i].Van);
    }

    fclose(f);
    printf("\nDa ghi danh sach vao file D:/thisinh.txt thanh cong!\n");
}

int main() {
    int n;
    printf("Nhap so luong thi sinh: ");
    scanf("%d", &n);
    getchar(); // Xóa ký tự '\n' sau khi nhập n để tránh trôi lệnh ở nhap()

    ThiSinh *ds = (ThiSinh *)malloc(n * sizeof(ThiSinh));
    if (ds == NULL) {
        return 1;
    }

    nhap(ds, n);
    xuat(ds, n);
    ts8(ds, n);
    dtk(ds, n);
    ghiFile(ds, n);
    free(ds);
    return 0;
}