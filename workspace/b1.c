#include <stdio.h>
#include <stdlib.h>
#include <string.h>


typedef struct {
    char maMay[20];
    char tenMay[20];
    int namSX;
    char hangSX[20];
    float giaNhap;
} MayTinh;

void xoaEnter(char *s) {
    s[strcspn(s, "\n")] = '\0';
}

void nhap(MayTinh ds[], int n) {
    for (int i = 0; i < n; i++) {
        printf("Nhap thong tin may tinh thu %d\n", i + 1);
        printf("Nhap ma may: ");
        fgets(ds[i].maMay, sizeof(ds[i].maMay), stdin);
        xoaEnter(ds[i].maMay);

        printf("Nhap ten may: ");
        fgets(ds[i].tenMay, sizeof(ds[i].tenMay), stdin);
        xoaEnter(ds[i].tenMay);

        printf("Nhap nam san xuat: ");
        scanf("%d", &ds[i].namSX);
        getchar();

        printf("Nhap hang san xuat: ");
        fgets(ds[i].hangSX, sizeof(ds[i].hangSX), stdin);
        xoaEnter(ds[i].hangSX);

        printf("Nhap gia nhap: ");
        scanf("%f", &ds[i].giaNhap);
        getchar();
    }
}


void tieude() {
    printf("%-20s %-15s %-20s %-20s %-12s\n", "Ma May", "Ten May", "Nam SX", "Hang SX", "Gia");
}

void in1SP(MayTinh ds) {
    printf("%-20s %-15s %-20d %-10s %-12.2f\n", ds.maMay, ds.tenMay, ds.namSX, ds.hangSX, ds.giaNhap);
}

void Xuat(MayTinh ds[], int n) {
    printf("\n=============Danh sach may tinh==============\n");
    tieude();
    for (int i = 0; i < n; i++) {
        in1SP(ds[i]);
    }
}

void inSamSung(MayTinh ds[], int n) {
    tieude();
    int check = 0;
    for (int i = 0; i < n; i++) {
        if (strcmp(ds[i].hangSX, "SAMSUNG") == 0) {
            in1SP(ds[i]);
            check = 1;
        }
    }
    if (check == 0) {
        printf("Khong co san pham nao cua SamSung!\n");
    }
}


int main() {
    int n;
    printf("Nhap so luong may tinh: ");
    scanf("%d", &n);
    getchar();

    MayTinh *ds = (MayTinh *)malloc(n * sizeof(MayTinh));
    if (ds == NULL) {
        return 1;
    }

    nhap(ds, n);
    Xuat(ds, n);
    inSamSung(ds, n);
    free(ds);
    return 0;
}