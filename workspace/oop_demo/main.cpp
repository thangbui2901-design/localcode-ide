#include "Student.h"
#include <vector>
#include <algorithm>

int main() {
    std::vector<Student> list = {
        Student("SV01", "Bui Duc Thang", 3.85),
        Student("SV02", "Nguyen Minh Anh", 3.60),
        Student("SV03", "Tran Hoang Nam", 3.92)
    };

    std::sort(list.begin(), list.end(), [](const Student& a, const Student& b) {
        return a.getGpa() > b.getGpa();
    });

    for (const auto& sv : list) {
        sv.display();
    }
    return 0;
}
