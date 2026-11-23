#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, target;
    if (!(cin >> n >> target)) return 0;
    unordered_map<int, int> seen;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        if (seen.count(target - x)) {
            cout << seen[target - x] << ' ' << i << '\n';
            return 0;
        }
        seen[x] = i;
    }
    cout << "-1\n";
    return 0;
}
