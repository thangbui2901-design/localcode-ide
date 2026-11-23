import { FileNode, SupportedLanguage, WorkspaceFile } from '../types/ide';

const DB_NAME = 'LocalCodeIDE_Workspace_DB';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_FOLDERS = 'folders';
const SEED_FLAG = 'localcode_idb_seeded_v1';

interface StoredFileRecord {
  path: string;
  name: string;
  content: string;
  updatedAt: number;
}

interface StoredFolderRecord {
  path: string;
}

export function detectLanguageFromName(fileName: string): SupportedLanguage {
  if (fileName.endsWith('.py')) return 'python';
  if (fileName.endsWith('.c')) return 'c';
  if (fileName.endsWith('.md')) return 'markdown';
  return 'cpp';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        db.createObjectStore(STORE_FOLDERS, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DEFAULT_SEED_FOLDERS = ['dsa_sorting', 'oop_demo', 'searching'];

const DEFAULT_SEED_FILES: Record<string, string> = {
  'default.cpp': `// Created on LocalCode IDE (Netlify + IndexedDB + Piston).

#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        vector<int> a(n);
        for (int &x : a) cin >> x;
        sort(a.begin(), a.end());
        for (int x : a) cout << x << ' ';
        cout << '\n';
    } else {
        cout << "Hello from LocalCode IDE on iPad!\n";
    }
    return 0;
}
`,
  'dsa_sorting/two_sum.cpp': `#include <bits/stdc++.h>
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
`,
  'oop_demo/Student.h': `#pragma once
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
`,
  'oop_demo/Student.cpp': `#include "Student.h"
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
`,
  'oop_demo/main.cpp': `#include "Student.h"
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
`,
  'searching/binary_search.py': `from bisect import bisect_left

arr = [2, 5, 8, 12, 16, 23, 38, 56]
target = 23
idx = bisect_left(arr, target)
print(f"Found {target} at index {idx}")
`,
  'README.md': `# LocalCode IDE – Standalone iPad & Netlify Edition

- **Lưu trữ tự động (IndexedDB)**: Toàn bộ thư mục và bài tập của bạn được lưu trực tiếp trên bộ nhớ trình duyệt Safari iPad/Desktop.
- **Biên dịch Cloud (Piston API)**: Hỗ trợ đầy đủ \`#include <bits/stdc++.h>\`, dự án OOP nhiều tệp (\`.h\` + \`.cpp\`) và \`Python 3\`.
- **DSA Testcase**: Mở tab **INPUT** ở khung dưới để dán dữ liệu đầu vào trước khi bấm **Run**.
`
};

export async function ensureIdbSeeded(): Promise<void> {
  const db = await openDatabase();
  const existingFiles = await getAllRecords<StoredFileRecord>(db, STORE_FILES);
  if (existingFiles.length > 0 || localStorage.getItem(SEED_FLAG)) {
    return;
  }

  const tx = db.transaction([STORE_FILES, STORE_FOLDERS], 'readwrite');
  const fileStore = tx.objectStore(STORE_FILES);
  const folderStore = tx.objectStore(STORE_FOLDERS);

  for (const folder of DEFAULT_SEED_FOLDERS) {
    folderStore.put({ path: folder });
  }
  for (const [relPath, content] of Object.entries(DEFAULT_SEED_FILES)) {
    const name = relPath.split('/').pop() || relPath;
    fileStore.put({ path: relPath, name, content, updatedAt: Date.now() });
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  localStorage.setItem(SEED_FLAG, '1');
}

function getAllRecords<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function loadIdbWorkspace(): Promise<{ tree: FileNode[]; files: WorkspaceFile[] }> {
  await ensureIdbSeeded();
  const db = await openDatabase();
  const rawFiles = await getAllRecords<StoredFileRecord>(db, STORE_FILES);
  const rawFolders = await getAllRecords<StoredFolderRecord>(db, STORE_FOLDERS);

  const flatFiles: WorkspaceFile[] = rawFiles
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => ({
      name: f.name,
      path: f.path,
      uri: `file:///workspace/${f.path}`,
      content: f.content,
      language: detectLanguageFromName(f.name)
    }));

  const folderSet = new Set<string>(rawFolders.map((f) => f.path));
  for (const f of flatFiles) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      folderSet.add(parts.slice(0, i).join('/'));
    }
  }

  const rootNodes: FileNode[] = [];
  const folderNodeMap = new Map<string, FileNode>();

  const sortedFolders = [...folderSet].sort((a, b) => a.localeCompare(b));
  for (const folderPath of sortedFolders) {
    const parts = folderPath.split('/');
    const name = parts[parts.length - 1];
    const node: FileNode = { name, path: folderPath, type: 'folder', children: [] };
    folderNodeMap.set(folderPath, node);

    if (parts.length === 1) {
      rootNodes.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      folderNodeMap.get(parentPath)?.children?.push(node);
    }
  }

  for (const file of flatFiles) {
    const parts = file.path.split('/');
    const fileNode: FileNode = {
      name: file.name,
      path: file.path,
      type: 'file',
      file
    };
    if (parts.length === 1) {
      rootNodes.push(fileNode);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      folderNodeMap.get(parentPath)?.children?.push(fileNode);
    }
  }

  const sortTree = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sortTree(n.children));
  };
  sortTree(rootNodes);

  return { tree: rootNodes, files: flatFiles };
}

export async function saveIdbFile(relPath: string, content: string): Promise<string> {
  const db = await openDatabase();
  const cleanPath = relPath.replace(/^\/+/, '');
  const name = cleanPath.split('/').pop() || cleanPath;

  const tx = db.transaction([STORE_FILES, STORE_FOLDERS], 'readwrite');
  const fileStore = tx.objectStore(STORE_FILES);
  const folderStore = tx.objectStore(STORE_FOLDERS);

  const parts = cleanPath.split('/');
  for (let i = 1; i < parts.length; i++) {
    folderStore.put({ path: parts.slice(0, i).join('/') });
  }

  fileStore.put({
    path: cleanPath,
    name,
    content,
    updatedAt: Date.now()
  });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return `file:///workspace/${cleanPath}`;
}

export async function createIdbFolder(relPath: string): Promise<void> {
  const db = await openDatabase();
  const cleanPath = relPath.replace(/^\/+/, '');
  const tx = db.transaction(STORE_FOLDERS, 'readwrite');
  const store = tx.objectStore(STORE_FOLDERS);

  const parts = cleanPath.split('/');
  for (let i = 1; i <= parts.length; i++) {
    store.put({ path: parts.slice(0, i).join('/') });
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteIdbEntry(relPath: string): Promise<void> {
  const db = await openDatabase();
  const allFiles = await getAllRecords<StoredFileRecord>(db, STORE_FILES);
  const allFolders = await getAllRecords<StoredFolderRecord>(db, STORE_FOLDERS);

  const tx = db.transaction([STORE_FILES, STORE_FOLDERS], 'readwrite');
  const fileStore = tx.objectStore(STORE_FILES);
  const folderStore = tx.objectStore(STORE_FOLDERS);

  for (const f of allFiles) {
    if (f.path === relPath || f.path.startsWith(`${relPath}/`)) {
      fileStore.delete(f.path);
    }
  }
  for (const d of allFolders) {
    if (d.path === relPath || d.path.startsWith(`${relPath}/`)) {
      folderStore.delete(d.path);
    }
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportIdbWorkspaceJson(): Promise<string> {
  const db = await openDatabase();
  const files = await getAllRecords<StoredFileRecord>(db, STORE_FILES);
  const folders = await getAllRecords<StoredFolderRecord>(db, STORE_FOLDERS);
  return JSON.stringify({ exportedAt: new Date().toISOString(), files, folders }, null, 2);
}

export async function importIdbWorkspaceJson(jsonText: string): Promise<void> {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed.files)) {
    throw new Error('Tệp sao lưu không hợp lệ');
  }
  const db = await openDatabase();
  const tx = db.transaction([STORE_FILES, STORE_FOLDERS], 'readwrite');
  const fileStore = tx.objectStore(STORE_FILES);
  const folderStore = tx.objectStore(STORE_FOLDERS);

  fileStore.clear();
  folderStore.clear();

  for (const d of parsed.folders || []) {
    if (d.path) folderStore.put({ path: d.path });
  }
  for (const f of parsed.files) {
    if (f.path) {
      fileStore.put({
        path: f.path,
        name: f.name || f.path.split('/').pop(),
        content: f.content ?? '',
        updatedAt: Date.now()
      });
    }
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
