#pragma once
#include <string>

class Student {
private:
    std::string id;
    std::string name;
    double gpa;

public:
    Student(std::string id, std::string name, double gpa);
    void display() const;
    double getGpa() const;
};
