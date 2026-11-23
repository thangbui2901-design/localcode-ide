import * as monaco from 'monaco-editor';
import { WorkspaceFile } from '../types/ide';

/* ============================================================================
   VS CODE-STYLE INTELLISENSE ENGINE (OFFLINE READY FOR iPAD / iPHONE / WEB)
   Hỗ trợ đầy đủ: C++, C, Python, JavaScript, HTML, CSS
   Gồm: Auto-completion, Member methods (./->), #include, Keywords, Snippets,
        Signature Help (gợi ý tham số khi gõ "("), và Hover Docs.
   ============================================================================ */

const CPP_HEADERS = [
  'bits/stdc++.h',
  'iostream',
  'vector',
  'string',
  'algorithm',
  'map',
  'unordered_map',
  'set',
  'unordered_set',
  'queue',
  'stack',
  'deque',
  'list',
  'array',
  'tuple',
  'utility',
  'numeric',
  'functional',
  'memory',
  'bitset',
  'cmath',
  'cstdio',
  'cstdlib',
  'cstring',
  'iomanip',
  'fstream',
  'sstream',
  'climits',
  'cassert',
  'chrono',
  'random',
  'stdio.h',
  'stdlib.h',
  'string.h',
  'math.h',
  'ctype.h',
  'stdbool.h',
  'stdint.h',
  'limits.h'
];

interface SymbolSpec {
  label: string;
  kind: 'fn' | 'type' | 'var' | 'kw' | 'snip' | 'method' | 'prop' | 'mod';
  detail: string;
  doc?: string;
  insert?: string;
}

const CPP_KEYWORDS_AND_SNIPPETS: SymbolSpec[] = [
  { label: 'int', kind: 'kw', detail: 'Kiểu số nguyên 32-bit' },
  { label: 'long long', kind: 'kw', detail: 'Kiểu số nguyên 64-bit', insert: 'long long ' },
  { label: 'double', kind: 'kw', detail: 'Kiểu số thực dấu phẩy động 64-bit' },
  { label: 'float', kind: 'kw', detail: 'Kiểu số thực 32-bit' },
  { label: 'bool', kind: 'kw', detail: 'Kiểu logic true / false' },
  { label: 'char', kind: 'kw', detail: 'Kiểu ký tự 8-bit' },
  { label: 'void', kind: 'kw', detail: 'Không trả về giá trị' },
  { label: 'auto', kind: 'kw', detail: 'Tự suy luận kiểu dữ liệu (C++11)' },
  { label: 'const', kind: 'kw', detail: 'Hằng số không thay đổi' },
  { label: 'constexpr', kind: 'kw', detail: 'Hằng biểu thức tại thời điểm biên dịch' },
  { label: 'static', kind: 'kw', detail: 'Biến / hàm tĩnh' },
  { label: 'nullptr', kind: 'kw', detail: 'Con trỏ rỗng chuẩn C++11' },
  { label: 'true', kind: 'kw', detail: 'Giá trị logic đúng' },
  { label: 'false', kind: 'kw', detail: 'Giá trị logic sai' },
  { label: 'break', kind: 'kw', detail: 'Thoát vòng lặp / switch' },
  { label: 'continue', kind: 'kw', detail: 'Chuyển sang lần lặp kế tiếp' },
  { label: 'return', kind: 'kw', detail: 'Trả về giá trị từ hàm', insert: 'return ${1:0};' },
  { label: 'sizeof', kind: 'kw', detail: 'Kích thước theo byte', insert: 'sizeof(${1:x})' },
  { label: 'public', kind: 'kw', detail: 'Phạm vi truy cập công khai', insert: 'public:\n    ' },
  { label: 'private', kind: 'kw', detail: 'Phạm vi truy cập riêng tư', insert: 'private:\n    ' },
  { label: 'protected', kind: 'kw', detail: 'Phạm vi truy cập kế thừa', insert: 'protected:\n    ' },
  { label: 'virtual', kind: 'kw', detail: 'Hàm ảo (đa hình OOP)' },
  { label: 'override', kind: 'kw', detail: 'Ghi đè hàm ảo lớp cha' },
  { label: 'namespace', kind: 'kw', detail: 'Khai báo không gian tên', insert: 'namespace ${1:name} {\n    ${2}\n}' },
  { label: 'using namespace std;', kind: 'snip', detail: 'Dùng chuẩn std', insert: 'using namespace std;\n' },
  { label: '#include', kind: 'snip', detail: 'Nhúng thư viện chuẩn', insert: '#include <${1:iostream}>' },
  { label: '#pragma once', kind: 'snip', detail: 'Chống include trùng header', insert: '#pragma once\n' },
  { label: '#define', kind: 'snip', detail: 'Định nghĩa macro', insert: '#define ${1:NAME} ${2:VALUE}' },
  {
    label: 'if',
    kind: 'snip',
    detail: 'Cấu trúc rẽ nhánh if (...)',
    insert: 'if (${1:condition}) {\n    ${2}\n}'
  },
  {
    label: 'ifelse',
    kind: 'snip',
    detail: 'Cấu trúc if (...) else',
    insert: 'if (${1:condition}) {\n    ${2}\n} else {\n    ${3}\n}'
  },
  {
    label: 'else if',
    kind: 'snip',
    detail: 'Nhánh else if (...)',
    insert: 'else if (${1:condition}) {\n    ${2}\n}'
  },
  {
    label: 'for',
    kind: 'snip',
    detail: 'Vòng lặp for (int i = 0; i < n; ++i)',
    insert: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3}\n}'
  },
  {
    label: 'forr',
    kind: 'snip',
    detail: 'Range-based for (auto &x : container)',
    insert: 'for (auto &${1:x} : ${2:v}) {\n    ${3}\n}'
  },
  {
    label: 'while',
    kind: 'snip',
    detail: 'Vòng lặp while (...)',
    insert: 'while (${1:condition}) {\n    ${2}\n}'
  },
  {
    label: 'switch',
    kind: 'snip',
    detail: 'Cấu trúc switch-case',
    insert: 'switch (${1:val}) {\n    case ${2:1}:\n        ${3}\n        break;\n    default:\n        break;\n}'
  },
  {
    label: 'struct',
    kind: 'snip',
    detail: 'Khai báo struct',
    insert: 'struct ${1:Name} {\n    ${2}\n};'
  },
  {
    label: 'class',
    kind: 'snip',
    detail: 'Khai báo class OOP',
    insert: 'class ${1:Name} {\nprivate:\n    ${2}\npublic:\n    ${1:Name}() {}\n};'
  },
  {
    label: 'cppmain',
    kind: 'snip',
    detail: 'Khung chương trình C++ Fast I/O',
    insert: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    ${1}\n    return 0;\n}\n'
  },
  {
    label: 'cmain',
    kind: 'snip',
    detail: 'Khung chương trình C chuẩn',
    insert: '#include <stdio.h>\n\nint main(void) {\n    ${1}\n    return 0;\n}\n'
  },
  { label: 'printf', kind: 'fn', detail: 'int printf(const char* format, ...)', insert: 'printf("${1:%d}\\n", ${2:x});' },
  { label: 'scanf', kind: 'fn', detail: 'int scanf(const char* format, ...)', insert: 'scanf("${1:%d}", &${2:x});' },
  { label: 'getline', kind: 'fn', detail: 'istream& getline(cin, string& s)', insert: 'getline(cin, ${1:s});' }
];

const STD_SYMBOLS: SymbolSpec[] = [
  { label: 'cout', kind: 'var', detail: 'std::ostream — Xuất ra màn hình', insert: 'cout << ${1} << "\\n";' },
  { label: 'cin', kind: 'var', detail: 'std::istream — Nhập từ bàn phím', insert: 'cin >> ${1};' },
  { label: 'cerr', kind: 'var', detail: 'std::ostream — Xuất lỗi stderr' },
  { label: 'endl', kind: 'fn', detail: 'Xuống dòng và flush buffer' },
  { label: 'string', kind: 'type', detail: 'std::string — Chuỗi ký tự động' },
  { label: 'to_string', kind: 'fn', detail: 'string to_string(val)', insert: 'to_string(${1:x})' },
  { label: 'stoi', kind: 'fn', detail: 'int stoi(const string& s)', insert: 'stoi(${1:s})' },
  { label: 'stoll', kind: 'fn', detail: 'long long stoll(const string& s)', insert: 'stoll(${1:s})' },
  { label: 'vector', kind: 'type', detail: 'template<class T> std::vector<T>', insert: 'vector<${1:int}>' },
  { label: 'map', kind: 'type', detail: 'std::map<K, V> — Cây cân bằng O(log N)', insert: 'map<${1:int}, ${2:int}>' },
  { label: 'unordered_map', kind: 'type', detail: 'Hash table O(1)', insert: 'unordered_map<${1:int}, ${2:int}>' },
  { label: 'set', kind: 'type', detail: 'std::set<T> — Tập có thứ tự O(log N)', insert: 'set<${1:int}>' },
  { label: 'unordered_set', kind: 'type', detail: 'Hash set O(1)', insert: 'unordered_set<${1:int}>' },
  { label: 'pair', kind: 'type', detail: 'std::pair<T1, T2>', insert: 'pair<${1:int}, ${2:int}>' },
  { label: 'make_pair', kind: 'fn', detail: 'std::make_pair(a, b)', insert: 'make_pair(${1:a}, ${2:b})' },
  { label: 'queue', kind: 'type', detail: 'Hàng đợi FIFO', insert: 'queue<${1:int}>' },
  { label: 'priority_queue', kind: 'type', detail: 'Max-Heap priority_queue', insert: 'priority_queue<${1:int}>' },
  { label: 'stack', kind: 'type', detail: 'Ngăn xếp LIFO', insert: 'stack<${1:int}>' },
  { label: 'deque', kind: 'type', detail: 'Hàng đợi 2 đầu', insert: 'deque<${1:int}>' },
  { label: 'sort', kind: 'fn', detail: 'void sort(first, last)', insert: 'sort(${1:v}.begin(), ${1:v}.end());' },
  { label: 'reverse', kind: 'fn', detail: 'void reverse(first, last)', insert: 'reverse(${1:v}.begin(), ${1:v}.end());' },
  { label: 'lower_bound', kind: 'fn', detail: 'Tìm nhị phân >= x', insert: 'lower_bound(${1:v}.begin(), ${1:v}.end(), ${2:x})' },
  { label: 'upper_bound', kind: 'fn', detail: 'Tìm nhị phân > x', insert: 'upper_bound(${1:v}.begin(), ${1:v}.end(), ${2:x})' },
  { label: 'binary_search', kind: 'fn', detail: 'bool binary_search(first, last, val)', insert: 'binary_search(${1:v}.begin(), ${1:v}.end(), ${2:x})' },
  { label: 'next_permutation', kind: 'fn', detail: 'Sinh hoán vị kế tiếp', insert: 'next_permutation(${1:v}.begin(), ${1:v}.end())' },
  { label: 'accumulate', kind: 'fn', detail: 'Tính tổng mảng/vector', insert: 'accumulate(${1:v}.begin(), ${1:v}.end(), ${2:0LL})' },
  { label: 'max', kind: 'fn', detail: 'const T& max(a, b)', insert: 'max(${1:a}, ${2:b})' },
  { label: 'min', kind: 'fn', detail: 'const T& min(a, b)', insert: 'min(${1:a}, ${2:b})' },
  { label: 'swap', kind: 'fn', detail: 'void swap(a, b)', insert: 'swap(${1:a}, ${2:b});' },
  { label: 'abs', kind: 'fn', detail: 'Giá trị tuyệt đối', insert: 'abs(${1:x})' },
  { label: 'sqrt', kind: 'fn', detail: 'Căn bậc hai', insert: 'sqrt(${1:x})' },
  { label: 'pow', kind: 'fn', detail: 'Lũy thừa pow(base, exp)', insert: 'pow(${1:a}, ${2:b})' },
  { label: 'gcd', kind: 'fn', detail: 'Ước chung lớn nhất (C++17)', insert: 'gcd(${1:a}, ${2:b})' },
  { label: 'lcm', kind: 'fn', detail: 'Bội chung nhỏ nhất (C++17)', insert: 'lcm(${1:a}, ${2:b})' },
  { label: 'fixed', kind: 'var', detail: 'std::ios_base::fixed' },
  { label: 'setprecision', kind: 'fn', detail: 'std::setprecision(int n)', insert: 'setprecision(${1:2})' },
  { label: 'move', kind: 'fn', detail: 'std::move(T&&)', insert: 'move(${1:x})' },
  { label: 'unique_ptr', kind: 'type', detail: 'Smart pointer độc quyền', insert: 'unique_ptr<${1:T}>' },
  { label: 'shared_ptr', kind: 'type', detail: 'Smart pointer chia sẻ', insert: 'shared_ptr<${1:T}>' }
];

const STL_MEMBER_METHODS: SymbolSpec[] = [
  { label: 'push_back', kind: 'method', detail: 'void push_back(val)', insert: 'push_back(${1:x})' },
  { label: 'emplace_back', kind: 'method', detail: 'void emplace_back(args...)', insert: 'emplace_back(${1:x})' },
  { label: 'pop_back', kind: 'method', detail: 'void pop_back()', insert: 'pop_back()' },
  { label: 'size', kind: 'method', detail: 'size_t size() const', insert: 'size()' },
  { label: 'empty', kind: 'method', detail: 'bool empty() const', insert: 'empty()' },
  { label: 'clear', kind: 'method', detail: 'void clear()', insert: 'clear()' },
  { label: 'resize', kind: 'method', detail: 'void resize(n, val)', insert: 'resize(${1:n})' },
  { label: 'reserve', kind: 'method', detail: 'void reserve(n)', insert: 'reserve(${1:n})' },
  { label: 'begin', kind: 'method', detail: 'iterator begin()', insert: 'begin()' },
  { label: 'end', kind: 'method', detail: 'iterator end()', insert: 'end()' },
  { label: 'rbegin', kind: 'method', detail: 'reverse_iterator rbegin()', insert: 'rbegin()' },
  { label: 'rend', kind: 'method', detail: 'reverse_iterator rend()', insert: 'rend()' },
  { label: 'front', kind: 'method', detail: 'reference front()', insert: 'front()' },
  { label: 'back', kind: 'method', detail: 'reference back()', insert: 'back()' },
  { label: 'top', kind: 'method', detail: 'const_reference top()', insert: 'top()' },
  { label: 'push', kind: 'method', detail: 'void push(val)', insert: 'push(${1:x})' },
  { label: 'pop', kind: 'method', detail: 'void pop()', insert: 'pop()' },
  { label: 'insert', kind: 'method', detail: 'insert(val)', insert: 'insert(${1:x})' },
  { label: 'erase', kind: 'method', detail: 'erase(it / key)', insert: 'erase(${1:x})' },
  { label: 'find', kind: 'method', detail: 'iterator find(key)', insert: 'find(${1:x})' },
  { label: 'count', kind: 'method', detail: 'size_t count(key)', insert: 'count(${1:x})' },
  { label: 'substr', kind: 'method', detail: 'string substr(pos, len)', insert: 'substr(${1:0}, ${2:len})' },
  { label: 'length', kind: 'method', detail: 'size_t length() const', insert: 'length()' },
  { label: 'c_str', kind: 'method', detail: 'const char* c_str()', insert: 'c_str()' },
  { label: 'first', kind: 'prop', detail: 'pair::first' },
  { label: 'second', kind: 'prop', detail: 'pair::second' }
];

const PYTHON_KEYWORDS_AND_BUILTINS: SymbolSpec[] = [
  { label: 'def', kind: 'snip', detail: 'Định nghĩa hàm Python', insert: 'def ${1:func_name}(${2:args}):\n    ${3:pass}' },
  { label: 'class', kind: 'snip', detail: 'Định nghĩa lớp Python', insert: 'class ${1:ClassName}:\n    def __init__(self${2:, args}):\n        ${3:pass}' },
  { label: 'if', kind: 'snip', detail: 'Câu lệnh điều kiện if', insert: 'if ${1:condition}:\n    ${2:pass}' },
  { label: 'elif', kind: 'snip', detail: 'Nhánh elif', insert: 'elif ${1:condition}:\n    ${2:pass}' },
  { label: 'else', kind: 'snip', detail: 'Nhánh else', insert: 'else:\n    ${1:pass}' },
  { label: 'for', kind: 'snip', detail: 'Vòng lặp for item in iterable', insert: 'for ${1:i} in range(${2:n}):\n    ${3:pass}' },
  { label: 'while', kind: 'snip', detail: 'Vòng lặp while', insert: 'while ${1:condition}:\n    ${2:pass}' },
  { label: 'try', kind: 'snip', detail: 'Bắt ngoại lệ try / except', insert: 'try:\n    ${1:pass}\nexcept Exception as e:\n    print(e)' },
  { label: 'with', kind: 'snip', detail: 'Context manager with ... as ...', insert: 'with ${1:open("file.txt")} as ${2:f}:\n    ${3:pass}' },
  { label: 'ifmain', kind: 'snip', detail: 'Điểm vào chương trình Python', insert: 'if __name__ == "__main__":\n    ${1:main()}' },
  { label: 'return', kind: 'kw', detail: 'Trả về giá trị' },
  { label: 'import', kind: 'kw', detail: 'Nhập module' },
  { label: 'from', kind: 'kw', detail: 'Nhập thành phần từ module', insert: 'from ${1:module} import ${2:name}' },
  { label: 'lambda', kind: 'kw', detail: 'Hàm ẩn danh', insert: 'lambda ${1:x}: ${2:x}' },
  { label: 'True', kind: 'kw', detail: 'Boolean đúng' },
  { label: 'False', kind: 'kw', detail: 'Boolean sai' },
  { label: 'None', kind: 'kw', detail: 'Giá trị rỗng None' },
  { label: 'pass', kind: 'kw', detail: 'Lệnh rỗng' },
  { label: 'break', kind: 'kw', detail: 'Thoát vòng lặp' },
  { label: 'continue', kind: 'kw', detail: 'Tiếp tục lần lặp mới' },
  { label: 'print', kind: 'fn', detail: 'print(*values, sep=" ", end="\\n")', insert: 'print(${1})' },
  { label: 'input', kind: 'fn', detail: 'input(prompt="") -> str', insert: 'input(${1})' },
  { label: 'len', kind: 'fn', detail: 'len(obj) -> int', insert: 'len(${1:x})' },
  { label: 'range', kind: 'fn', detail: 'range(start, stop[, step])', insert: 'range(${1:n})' },
  { label: 'enumerate', kind: 'fn', detail: 'enumerate(iterable, start=0)', insert: 'enumerate(${1:arr})' },
  { label: 'zip', kind: 'fn', detail: 'zip(*iterables)', insert: 'zip(${1:a}, ${2:b})' },
  { label: 'map', kind: 'fn', detail: 'map(func, iterable)', insert: 'map(${1:int}, ${2:input().split()})' },
  { label: 'filter', kind: 'fn', detail: 'filter(func, iterable)', insert: 'filter(${1:fn}, ${2:arr})' },
  { label: 'sorted', kind: 'fn', detail: 'sorted(iterable, key=None, reverse=False)', insert: 'sorted(${1:arr})' },
  { label: 'reversed', kind: 'fn', detail: 'reversed(seq)', insert: 'reversed(${1:arr})' },
  { label: 'sum', kind: 'fn', detail: 'sum(iterable, start=0)', insert: 'sum(${1:arr})' },
  { label: 'min', kind: 'fn', detail: 'min(iterable / a, b)', insert: 'min(${1:a}, ${2:b})' },
  { label: 'max', kind: 'fn', detail: 'max(iterable / a, b)', insert: 'max(${1:a}, ${2:b})' },
  { label: 'abs', kind: 'fn', detail: 'abs(x)', insert: 'abs(${1:x})' },
  { label: 'pow', kind: 'fn', detail: 'pow(base, exp[, mod])', insert: 'pow(${1:a}, ${2:b})' },
  { label: 'round', kind: 'fn', detail: 'round(number, ndigits)', insert: 'round(${1:x}, ${2:2})' },
  { label: 'int', kind: 'type', detail: 'int(x)', insert: 'int(${1})' },
  { label: 'float', kind: 'type', detail: 'float(x)', insert: 'float(${1})' },
  { label: 'str', kind: 'type', detail: 'str(x)', insert: 'str(${1})' },
  { label: 'list', kind: 'type', detail: 'list(iterable)', insert: 'list(${1})' },
  { label: 'dict', kind: 'type', detail: 'dict(**kwargs)', insert: 'dict(${1})' },
  { label: 'set', kind: 'type', detail: 'set(iterable)', insert: 'set(${1})' },
  { label: 'tuple', kind: 'type', detail: 'tuple(iterable)', insert: 'tuple(${1})' },
  { label: 'bool', kind: 'type', detail: 'bool(x)', insert: 'bool(${1})' },
  { label: 'isinstance', kind: 'fn', detail: 'isinstance(obj, classinfo)', insert: 'isinstance(${1:x}, ${2:int})' }
];

const PYTHON_MODULES = [
  'math', 'sys', 'os', 'collections', 'itertools', 'heapq', 'bisect',
  'functools', 'random', 'json', 're', 'datetime', 'time', 'typing', 'string'
];

const PYTHON_MEMBER_METHODS: SymbolSpec[] = [
  { label: 'append', kind: 'method', detail: 'list.append(x)', insert: 'append(${1:x})' },
  { label: 'extend', kind: 'method', detail: 'list.extend(iterable)', insert: 'extend(${1:items})' },
  { label: 'pop', kind: 'method', detail: 'list.pop([index])', insert: 'pop()' },
  { label: 'sort', kind: 'method', detail: 'list.sort(key=None, reverse=False)', insert: 'sort()' },
  { label: 'reverse', kind: 'method', detail: 'list.reverse()', insert: 'reverse()' },
  { label: 'count', kind: 'method', detail: 'count(x)', insert: 'count(${1:x})' },
  { label: 'index', kind: 'method', detail: 'index(x)', insert: 'index(${1:x})' },
  { label: 'split', kind: 'method', detail: 'str.split(sep=None)', insert: 'split(${1})' },
  { label: 'join', kind: 'method', detail: 'str.join(iterable)', insert: 'join(${1:items})' },
  { label: 'strip', kind: 'method', detail: 'str.strip([chars])', insert: 'strip()' },
  { label: 'replace', kind: 'method', detail: 'str.replace(old, new)', insert: 'replace(${1:old}, ${2:new})' },
  { label: 'lower', kind: 'method', detail: 'str.lower()', insert: 'lower()' },
  { label: 'upper', kind: 'method', detail: 'str.upper()', insert: 'upper()' },
  { label: 'startswith', kind: 'method', detail: 'str.startswith(prefix)', insert: 'startswith(${1:prefix})' },
  { label: 'endswith', kind: 'method', detail: 'str.endswith(suffix)', insert: 'endswith(${1:suffix})' },
  { label: 'items', kind: 'method', detail: 'dict.items()', insert: 'items()' },
  { label: 'keys', kind: 'method', detail: 'dict.keys()', insert: 'keys()' },
  { label: 'values', kind: 'method', detail: 'dict.values()', insert: 'values()' },
  { label: 'get', kind: 'method', detail: 'dict.get(key, default=None)', insert: 'get(${1:key}, ${2:0})' },
  { label: 'add', kind: 'method', detail: 'set.add(elem)', insert: 'add(${1:x})' },
  { label: 'discard', kind: 'method', detail: 'set.discard(elem)', insert: 'discard(${1:x})' }
];

const JS_SNIPPETS: SymbolSpec[] = [
  { label: 'clg', kind: 'snip', detail: 'console.log(...)', insert: 'console.log(${1});' },
  { label: 'console.log', kind: 'fn', detail: 'In ra Console', insert: 'console.log(${1});' },
  { label: 'const', kind: 'kw', detail: 'Khai báo hằng số', insert: 'const ${1:name} = ${2:value};' },
  { label: 'let', kind: 'kw', detail: 'Khai báo biến', insert: 'let ${1:name} = ${2:value};' },
  { label: 'function', kind: 'snip', detail: 'Khai báo hàm JS', insert: 'function ${1:name}(${2:params}) {\n  ${3}\n}' },
  { label: 'afn', kind: 'snip', detail: 'Arrow Function', insert: 'const ${1:name} = (${2:params}) => {\n  ${3}\n};' },
  { label: 'async', kind: 'snip', detail: 'Async Function', insert: 'async function ${1:name}(${2:params}) {\n  ${3}\n}' },
  { label: 'for', kind: 'snip', detail: 'Vòng lặp for (let i = 0; i < n; i++)', insert: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3}\n}' },
  { label: 'forof', kind: 'snip', detail: 'for (const item of list)', insert: 'for (const ${1:item} of ${2:list}) {\n  ${3}\n}' },
  { label: 'if', kind: 'snip', detail: 'Câu lệnh if', insert: 'if (${1:condition}) {\n  ${2}\n}' },
  { label: 'try', kind: 'snip', detail: 'try / catch', insert: 'try {\n  ${1}\n} catch (err) {\n  console.error(err);\n}' },
  { label: 'qs', kind: 'snip', detail: 'document.querySelector(...)', insert: 'document.querySelector("${1:#id}")' },
  { label: 'qsa', kind: 'snip', detail: 'document.querySelectorAll(...)', insert: 'document.querySelectorAll("${1:.item}")' },
  { label: 'ael', kind: 'snip', detail: 'addEventListener("click", ...)', insert: 'addEventListener("${1:click}", (${2:e}) => {\n  ${3}\n});' },
  { label: 'fetch', kind: 'fn', detail: 'Gọi HTTP API với fetch()', insert: 'const res = await fetch("${1:https://api.example.com}");\nconst data = await res.json();' },
  { label: 'setTimeout', kind: 'fn', detail: 'Hẹn giờ chạy sau ms', insert: 'setTimeout(() => {\n  ${1}\n}, ${2:1000});' }
];

const JS_MEMBER_METHODS: SymbolSpec[] = [
  { label: 'forEach', kind: 'method', detail: 'arr.forEach((item, idx) => ...)', insert: 'forEach((${1:item}) => {\n  ${2}\n})' },
  { label: 'map', kind: 'method', detail: 'arr.map((item) => ...)', insert: 'map((${1:item}) => ${2:item})' },
  { label: 'filter', kind: 'method', detail: 'arr.filter((item) => ...)', insert: 'filter((${1:item}) => ${2:true})' },
  { label: 'reduce', kind: 'method', detail: 'arr.reduce((acc, cur) => ..., init)', insert: 'reduce((${1:acc}, ${2:cur}) => ${3:acc + cur}, ${4:0})' },
  { label: 'find', kind: 'method', detail: 'arr.find((item) => ...)', insert: 'find((${1:item}) => ${2})' },
  { label: 'includes', kind: 'method', detail: 'includes(value) -> boolean', insert: 'includes(${1:val})' },
  { label: 'push', kind: 'method', detail: 'arr.push(item)', insert: 'push(${1:item})' },
  { label: 'join', kind: 'method', detail: 'arr.join(sep)', insert: 'join("${1:, }")' },
  { label: 'split', kind: 'method', detail: 'str.split(sep)', insert: 'split("${1: }")' },
  { label: 'trim', kind: 'method', detail: 'str.trim()', insert: 'trim()' },
  { label: 'addEventListener', kind: 'method', detail: 'el.addEventListener(type, fn)', insert: 'addEventListener("${1:click}", (${2:e}) => {\n  ${3}\n})' },
  { label: 'querySelector', kind: 'method', detail: 'el.querySelector(selector)', insert: 'querySelector("${1}")' },
  { label: 'classList', kind: 'prop', detail: 'DOMTokenList (add/remove/toggle)' },
  { label: 'textContent', kind: 'prop', detail: 'Nội dung chữ của phần tử' },
  { label: 'innerHTML', kind: 'prop', detail: 'Nội dung HTML bên trong' },
  { label: 'length', kind: 'prop', detail: 'Độ dài mảng / chuỗi' }
];

const HTML_SNIPPETS: SymbolSpec[] = [
  {
    label: 'html5',
    kind: 'snip',
    detail: 'Khung trang HTML5 chuẩn',
    insert: '<!DOCTYPE html>\n<html lang="vi">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${1:Document}</title>\n</head>\n<body>\n  ${2}\n</body>\n</html>'
  },
  { label: 'div', kind: 'snip', detail: '<div class="..."></div>', insert: '<div class="${1:container}">\n  ${2}\n</div>' },
  { label: 'section', kind: 'snip', detail: '<section></section>', insert: '<section class="${1}">\n  ${2}\n</section>' },
  { label: 'button', kind: 'snip', detail: '<button type="button"></button>', insert: '<button type="button" class="${1:btn}">${2:Click}</button>' },
  { label: 'a', kind: 'snip', detail: '<a href="..."></a>', insert: '<a href="${1:#}">${2:Link}</a>' },
  { label: 'img', kind: 'snip', detail: '<img src="..." alt="..." />', insert: '<img src="${1:./image.png}" alt="${2:image}" />' },
  { label: 'input', kind: 'snip', detail: '<input type="text" />', insert: '<input type="${1:text}" placeholder="${2}" />' },
  { label: 'link:css', kind: 'snip', detail: 'Nhúng tệp CSS', insert: '<link rel="stylesheet" href="${1:./style.css}" />' },
  { label: 'script:src', kind: 'snip', detail: 'Nhúng tệp JavaScript', insert: '<script src="${1:./script.js}"></script>' }
];

const CSS_SNIPPETS: SymbolSpec[] = [
  { label: 'df', kind: 'snip', detail: 'display: flex + căn giữa', insert: 'display: flex;\nalign-items: center;\njustify-content: center;' },
  { label: 'dg', kind: 'snip', detail: 'display: grid (2 cột)', insert: 'display: grid;\ngrid-template-columns: repeat(${1:2}, 1fr);\ngap: ${2:16px};' },
  { label: 'glass', kind: 'snip', detail: 'Hiệu ứng kính mờ Glassmorphism', insert: 'background: rgba(255, 255, 255, 0.08);\nbackdrop-filter: blur(16px);\nborder: 1px solid rgba(255, 255, 255, 0.14);\nborder-radius: 16px;' },
  { label: 'transition', kind: 'prop', detail: 'Chuyển cảnh mượt CSS', insert: 'transition: all ${1:0.25s} ease;' },
  { label: 'box-shadow', kind: 'prop', detail: 'Đổ bóng mềm', insert: 'box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.45);' },
  { label: 'border-radius', kind: 'prop', detail: 'Bo góc phần tử', insert: 'border-radius: ${1:12px};' }
];

/* ==================== SIGNATURE HELP & HOVER DICTIONARY ==================== */

export const SIGNATURE_DB: Record<
  string,
  { label: string; doc: string; params: Array<{ label: string; doc: string }> }
> = {
  printf: {
    label: 'int printf(const char* format, ...args)',
    doc: 'In dữ liệu theo định dạng chuẩn C ra stdout',
    params: [
      { label: 'const char* format', doc: 'Chuỗi định dạng (%d, %lld, %f, %s, ...)' },
      { label: '...args', doc: 'Danh sách biến tương ứng với format' }
    ]
  },
  scanf: {
    label: 'int scanf(const char* format, ...ptrs)',
    doc: 'Đọc dữ liệu từ stdin vào địa chỉ biến (&x)',
    params: [
      { label: 'const char* format', doc: 'Chuỗi định dạng (%d, %lld, %lf, %s)' },
      { label: '...ptrs', doc: 'Địa chỉ biến (&a, &b...)' }
    ]
  },
  sort: {
    label: 'void std::sort(RandomIt first, RandomIt last, Compare comp?)',
    doc: 'Sắp xếp đoạn [first, last) trong O(N log N)',
    params: [
      { label: 'RandomIt first', doc: 'Iterator đầu (vd: v.begin())' },
      { label: 'RandomIt last', doc: 'Iterator cuối (vd: v.end())' },
      { label: 'Compare comp?', doc: 'Hàm so sánh tùy chọn (vd: greater<int>())' }
    ]
  },
  lower_bound: {
    label: 'ForwardIt lower_bound(ForwardIt first, ForwardIt last, const T& value)',
    doc: 'Trả về iterator phần tử đầu tiên >= value trong mảng đã sắp xếp',
    params: [
      { label: 'ForwardIt first', doc: 'Iterator bắt đầu' },
      { label: 'ForwardIt last', doc: 'Iterator kết thúc' },
      { label: 'const T& value', doc: 'Giá trị cần tìm' }
    ]
  },
  substr: {
    label: 'string substr(size_t pos = 0, size_t count = npos)',
    doc: 'Cắt chuỗi con bắt đầu từ vị trí pos với độ dài count',
    params: [
      { label: 'size_t pos', doc: 'Chỉ số bắt đầu (0-based)' },
      { label: 'size_t count', doc: 'Số ký tự cần lấy' }
    ]
  },
  range: {
    label: 'range(start, stop, step=1)',
    doc: 'Tạo dãy số nguyên từ start đến stop - 1',
    params: [
      { label: 'start', doc: 'Giá trị bắt đầu (mặc định 0)' },
      { label: 'stop', doc: 'Giá trị dừng (không bao gồm)' },
      { label: 'step=1', doc: 'Bước nhảy' }
    ]
  },
  print: {
    label: 'print(*objects, sep=" ", end="\\n")',
    doc: 'In giá trị ra màn hình Console',
    params: [
      { label: '*objects', doc: 'Các giá trị cần in' },
      { label: 'sep=" "', doc: 'Ký tự ngăn cách giữa các giá trị' },
      { label: 'end="\\n"', doc: 'Ký tự kết thúc dòng' }
    ]
  },
  fetch: {
    label: 'fetch(input: string, init?: RequestInit): Promise<Response>',
    doc: 'Gửi yêu cầu HTTP bất đồng bộ',
    params: [
      { label: 'input: string', doc: 'Địa chỉ URL API' },
      { label: 'init?: RequestInit', doc: 'Tuỳ chọn method, headers, body' }
    ]
  }
};

function mapKind(kind: SymbolSpec['kind']): monaco.languages.CompletionItemKind {
  const K = monaco.languages.CompletionItemKind;
  switch (kind) {
    case 'fn':
      return K.Function;
    case 'method':
      return K.Method;
    case 'type':
      return K.Class;
    case 'var':
      return K.Variable;
    case 'prop':
      return K.Property;
    case 'kw':
      return K.Keyword;
    case 'mod':
      return K.Module;
    default:
      return K.Snippet;
  }
}

function toCompletionItem(
  spec: SymbolSpec,
  range: monaco.IRange,
  sortPrefix: string
): monaco.languages.CompletionItem {
  const R = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  return {
    label: {
      label: spec.label,
      detail: spec.detail ? `  ${spec.detail}` : undefined
    },
    kind: mapKind(spec.kind),
    detail: spec.detail,
    documentation: spec.doc || spec.detail,
    insertText: spec.insert || spec.label,
    insertTextRules: spec.insert ? R : undefined,
    sortText: `${sortPrefix}_${spec.label}`,
    filterText: spec.label,
    range
  };
}

function extractCodeSymbols(codeSources: string[]) {
  const combined = codeSources.join('\n');
  const types = new Set<string>();
  const functions = new Set<string>();
  const members = new Set<string>();
  const variables = new Set<string>();

  for (const m of combined.matchAll(/\b(?:class|struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) {
    types.add(m[1]);
  }

  for (const m of combined.matchAll(
    /\b(?:void|int|long|double|float|bool|char|string|auto|size_t|std::string)\s+(?:[A-Za-z_][A-Za-z0-9_]*::)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
  )) {
    if (!['main', 'if', 'while', 'for', 'switch', 'return'].includes(m[1])) {
      functions.add(m[1]);
      members.add(m[1]);
    }
  }

  for (const m of combined.matchAll(
    /\b(?:int|long|long\s+long|double|float|bool|char|string|auto|std::string|const\s+\w+)\s+[&*]*([A-Za-z_][A-Za-z0-9_]*)\s*[;=,\[)]/g
  )) {
    if (!['main', 'return'].includes(m[1])) {
      variables.add(m[1]);
      members.add(m[1]);
    }
  }

  return {
    types: [...types],
    functions: [...functions],
    members: [...members],
    variables: [...variables]
  };
}

function dedupeSuggestions(items: monaco.languages.CompletionItem[]): monaco.languages.CompletionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = typeof item.label === 'string' ? item.label : item.label.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getStandaloneCompletions(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  langId: string,
  allFiles: WorkspaceFile[]
): monaco.languages.CompletionList {
  const fullLine = model.getLineContent(position.lineNumber);
  const linePrefix = fullLine.slice(0, position.column - 1);
  const lineSuffix = fullLine.slice(position.column - 1);
  const word = model.getWordUntilPosition(position);
  const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  const K = monaco.languages.CompletionItemKind;

  /* ======================== C / C++ ======================== */
  if (langId === 'cpp' || langId === 'c') {
    const angleIncludeMatch = linePrefix.match(/#include\s*<([^>]*)$/);
    if (angleIncludeMatch) {
      const startCol = position.column - angleIncludeMatch[1].length;
      const includeRange = new monaco.Range(position.lineNumber, startCol, position.lineNumber, position.column);
      const needsClose = !lineSuffix.startsWith('>');
      return {
        incomplete: true,
        suggestions: CPP_HEADERS.map((h) => ({
          label: h,
          kind: K.File,
          detail: 'Standard Library Header',
          insertText: needsClose ? `${h}>` : h,
          range: includeRange
        }))
      };
    }

    const quoteIncludeMatch = linePrefix.match(/#include\s*"([^"]*)$/);
    if (quoteIncludeMatch) {
      const startCol = position.column - quoteIncludeMatch[1].length;
      const includeRange = new monaco.Range(position.lineNumber, startCol, position.lineNumber, position.column);
      const needsClose = !lineSuffix.startsWith('"');
      const headers = allFiles.filter((f) => f.name.endsWith('.h') || f.name.endsWith('.hpp'));
      return {
        suggestions: headers.map((h) => ({
          label: h.name,
          kind: K.File,
          detail: h.path,
          insertText: needsClose ? `${h.name}"` : h.name,
          range: includeRange
        }))
      };
    }

    if (/std::[A-Za-z0-9_]*$/.test(linePrefix)) {
      return {
        suggestions: STD_SYMBOLS.map((s) => toCompletionItem(s, range, '0'))
      };
    }

    const projectTexts = allFiles
      .filter((f) => f.language === 'cpp' || f.language === 'c')
      .map((f) => f.content);
    const extracted = extractCodeSymbols([model.getValue(), ...projectTexts]);

    // SỬA LỖI: Trước đây thiếu câu lệnh return ở nhánh thành viên (./->)!
    if (/(?:\.|->)[A-Za-z0-9_]*$/.test(linePrefix)) {
      const customMembers: monaco.languages.CompletionItem[] = extracted.members.map((m) => ({
        label: { label: m, detail: '  Class / Struct Member' },
        kind: K.Method,
        detail: 'Class / Struct Member',
        insertText: m,
        sortText: `0_${m}`,
        filterText: m,
        range
      }));
      const stlMembers = STL_MEMBER_METHODS.map((m) => toCompletionItem(m, range, '1'));
      return { suggestions: dedupeSuggestions([...customMembers, ...stlMembers]) };
    }

    const suggestions: monaco.languages.CompletionItem[] = [
      ...extracted.variables.map((v) => ({
        label: { label: v, detail: '  Biến cục bộ' },
        kind: K.Variable,
        detail: 'Local / Member Variable',
        insertText: v,
        sortText: `0_${v}`,
        filterText: v,
        range
      })),
      ...extracted.functions.map((fn) => ({
        label: { label: fn, detail: '  Hàm trong dự án' },
        kind: K.Function,
        detail: 'User Function',
        insertText: `${fn}($0)`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: `1_${fn}`,
        filterText: fn,
        range
      })),
      ...extracted.types.map((t) => ({
        label: { label: t, detail: '  Class / Struct' },
        kind: K.Class,
        detail: 'User Class / Struct',
        insertText: t,
        sortText: `1_${t}`,
        filterText: t,
        range
      })),
      ...CPP_KEYWORDS_AND_SNIPPETS.map((k) => toCompletionItem(k, range, '2')),
      ...STD_SYMBOLS.map((s) => toCompletionItem(s, range, '3'))
    ];

    return { suggestions: dedupeSuggestions(suggestions) };
  }

  /* ======================== PYTHON ======================== */
  if (langId === 'python') {
    if (/^\s*(?:import|from)\s+[A-Za-z0-9_]*$/.test(linePrefix)) {
      return {
        suggestions: PYTHON_MODULES.map((mod) => ({
          label: mod,
          kind: K.Module,
          detail: 'Python Standard Library',
          insertText: mod,
          range
        }))
      };
    }

    if (/\.[A-Za-z0-9_]*$/.test(linePrefix)) {
      return {
        suggestions: PYTHON_MEMBER_METHODS.map((m) => toCompletionItem(m, range, '0'))
      };
    }

    const pyCode = model.getValue();
    const pyDefs = [...new Set([...pyCode.matchAll(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))];
    const pyClasses = [...new Set([...pyCode.matchAll(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))];
    const pyVars = [...new Set([...pyCode.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((m) => m[1]))];

    return {
      suggestions: dedupeSuggestions([
        ...pyVars.map((v) => ({
          label: { label: v, detail: '  Biến' },
          kind: K.Variable,
          detail: 'Variable',
          insertText: v,
          sortText: `0_${v}`,
          filterText: v,
          range
        })),
        ...pyDefs.map((fn) => ({
          label: { label: fn, detail: '  Hàm' },
          kind: K.Function,
          detail: 'User Function',
          insertText: `${fn}($0)`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: `1_${fn}`,
          filterText: fn,
          range
        })),
        ...pyClasses.map((cls) => ({
          label: { label: cls, detail: '  Class' },
          kind: K.Class,
          detail: 'User Class',
          insertText: cls,
          sortText: `1_${cls}`,
          filterText: cls,
          range
        })),
        ...PYTHON_KEYWORDS_AND_BUILTINS.map((item) => toCompletionItem(item, range, '2'))
      ])
    };
  }

  /* ======================== JAVASCRIPT ======================== */
  if (langId === 'javascript') {
    if (/\.[A-Za-z0-9_]*$/.test(linePrefix)) {
      return {
        suggestions: JS_MEMBER_METHODS.map((m) => toCompletionItem(m, range, '0'))
      };
    }

    const jsCode = model.getValue();
    const jsVars = [
      ...new Set(
        [...jsCode.matchAll(/\b(?:const|let|var|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)].map(
          (m) => m[1]
        )
      )
    ];

    return {
      suggestions: dedupeSuggestions([
        ...jsVars.map((v) => ({
          label: { label: v, detail: '  Biến / Hàm cục bộ' },
          kind: K.Variable,
          detail: 'Local Symbol',
          insertText: v,
          sortText: `0_${v}`,
          filterText: v,
          range
        })),
        ...JS_SNIPPETS.map((s) => toCompletionItem(s, range, '1'))
      ])
    };
  }

  /* ======================== HTML ======================== */
  if (langId === 'html') {
    return {
      suggestions: HTML_SNIPPETS.map((s) => toCompletionItem(s, range, '1'))
    };
  }

  /* ======================== CSS ======================== */
  if (langId === 'css') {
    return {
      suggestions: CSS_SNIPPETS.map((s) => toCompletionItem(s, range, '1'))
    };
  }

  return { suggestions: [] };
}

export function getStandaloneHover(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): monaco.languages.Hover | null {
  const word = model.getWordAtPosition(position);
  if (!word) return null;
  const sig = SIGNATURE_DB[word.word];
  if (sig) {
    return {
      contents: [
        { value: `\`\`\`\n${sig.label}\n\`\`\`` },
        { value: sig.doc }
      ]
    };
  }
  const allSpecs = [
    ...CPP_KEYWORDS_AND_SNIPPETS,
    ...STD_SYMBOLS,
    ...STL_MEMBER_METHODS,
    ...PYTHON_KEYWORDS_AND_BUILTINS,
    ...PYTHON_MEMBER_METHODS,
    ...JS_SNIPPETS,
    ...JS_MEMBER_METHODS
  ];
  const found = allSpecs.find((s) => s.label === word.word);
  if (!found) return null;
  return {
    contents: [
      { value: `**${found.label}**` },
      { value: found.doc || found.detail }
    ]
  };
}

export function getStandaloneSignatureHelp(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): monaco.languages.SignatureHelpResult | null {
  const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  // Tìm tên hàm gần nhất trước dấu '(' chưa đóng
  let depth = 0;
  let commaCount = 0;
  let openParenIdx = -1;
  for (let i = linePrefix.length - 1; i >= 0; i--) {
    const ch = linePrefix[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) {
        openParenIdx = i;
        break;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      commaCount++;
    }
  }
  if (openParenIdx < 0) return null;

  const beforeParen = linePrefix.slice(0, openParenIdx).trimEnd();
  const fnMatch = beforeParen.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!fnMatch) return null;

  const sig = SIGNATURE_DB[fnMatch[1]];
  if (!sig) return null;

  return {
    dispose: () => {},
    value: {
      signatures: [
        {
          label: sig.label,
          documentation: sig.doc,
          parameters: sig.params.map((p) => ({
            label: p.label,
            documentation: p.doc
          }))
        }
      ],
      activeSignature: 0,
      activeParameter: Math.min(commaCount, Math.max(0, sig.params.length - 1))
    }
  };
}
