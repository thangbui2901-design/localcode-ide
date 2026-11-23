from bisect import bisect_left

arr = [2, 5, 8, 12, 16, 23, 38, 56]
target = 23
idx = bisect_left(arr, target)
print(f"Found {target} at index {idx}")
