#include "Student.h"
#include <iostream>
#include <iomanip>

Student::Student(std::string id, std::string name, double gpa)
    : id(std::move(id)), name(std::move(name)), gpa(gpa) {}

void Student::display() const {
    std::cout << "[" << id << "] " << name
              << " - GPA: " << std::fixed << std::setprecision(2) << gpa << '\n';
}

double Student::getGpa() const {
    return gpa;
}
