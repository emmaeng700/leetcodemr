export interface TutorialCard {
  id: string
  title: string
  description: string
  complexity?: string
  snippets: { lang: string; code: string }[]
}

export interface TutorialCategory {
  name: string
  cards: TutorialCard[]
}

export const TUTORIAL_SECTIONS: { section: string; categories: TutorialCategory[] }[] = [
  {
    section: 'Basic Topics',
    categories: [
      {
        name: 'Arrays',
        cards: [
          {
            id: 'arrays-ops',
            title: 'Array Operations & Complexity',
            description: 'Arrays store collections in contiguous memory. Support O(1) access by index but O(n) insertion/deletion at arbitrary positions.',
            complexity: 'Access O(1) · Insert/Delete middle O(n) · Append O(1) amortized',
            snippets: [
              { lang: 'C++', code: `// Sort ascending
sort(v.begin(), v.end());
// Sort descending
sort(v.begin(), v.end(), greater<int>());
// Custom comparator
sort(v.begin(), v.end(), [](const auto& a, const auto& b) {
    return a[0] != b[0] ? a[0] < b[0] : a[1] < b[1];
});
// Max / min / sum
int mx = *max_element(v.begin(), v.end());
int mn = *min_element(v.begin(), v.end());
int s  = accumulate(v.begin(), v.end(), 0);` },
              { lang: 'Python', code: `# Sort ascending / descending
arr.sort()
arr.sort(reverse=True)
arr.sort(key=lambda x: x[1])  # by second element

# Max / min / sum
mx = max(arr)
mn = min(arr)
s  = sum(arr)` },
            ],
          },
        ],
      },
      {
        name: 'Backtracking',
        cards: [
          {
            id: 'backtrack-template',
            title: 'Backtracking Template',
            description: 'Explores all possible solutions by building candidates incrementally and abandoning ("backtracking") invalid paths. Uses DFS recursion.',
            complexity: 'Time O(n!) worst case · Space O(n) recursion depth',
            snippets: [
              { lang: 'C++', code: `vector<vector<int>> ans;
vector<int> tmp;

void backtrack(vector<int>& nums, vector<bool>& used) {
    // Base case: solution complete
    if (tmp.size() == nums.size()) {
        ans.push_back(tmp);
        return;
    }
    for (int i = 0; i < nums.size(); i++) {
        if (used[i]) continue;
        // Choose
        used[i] = true;
        tmp.push_back(nums[i]);
        // Explore
        backtrack(nums, used);
        // Un-choose (backtrack)
        tmp.pop_back();
        used[i] = false;
    }
}

// LC 46: Permutations
vector<vector<int>> permute(vector<int>& nums) {
    vector<bool> used(nums.size(), false);
    backtrack(nums, used);
    return ans;
}` },
              { lang: 'Python', code: `def permute(nums):
    ans, tmp = [], []
    used = [False] * len(nums)

    def backtrack():
        if len(tmp) == len(nums):
            ans.append(tmp[:])
            return
        for i in range(len(nums)):
            if used[i]: continue
            used[i] = True
            tmp.append(nums[i])
            backtrack()
            tmp.pop()
            used[i] = False

    backtrack()
    return ans` },
            ],
          },
        ],
      },
      {
        name: 'Binary Search',
        cards: [
          {
            id: 'binsearch-standard',
            title: 'Standard Binary Search',
            description: 'Efficiently locates elements in a sorted array by halving the search space each iteration. Requires sorted input.',
            complexity: 'Time O(log n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `int binarySearch(vector<int>& nums, int target) {
    int lp = 0, rp = nums.size() - 1;
    while (lp <= rp) {
        int mid = lp + (rp - lp) / 2; // avoids overflow
        if (nums[mid] == target) return mid;
        else if (nums[mid] < target) lp = mid + 1;
        else rp = mid - 1;
    }
    return -1;
}` },
              { lang: 'Python', code: `def binarySearch(nums, target):
    lp, rp = 0, len(nums) - 1
    while lp <= rp:
        mid = (lp + rp) // 2
        if nums[mid] == target: return mid
        elif nums[mid] < target: lp = mid + 1
        else: rp = mid - 1
    return -1` },
              { lang: 'Java', code: `int binarySearch(int[] nums, int target) {
    int lp = 0, rp = nums.length - 1;
    while (lp <= rp) {
        int mid = lp + (rp - lp) / 2;
        if (nums[mid] == target) return mid;
        else if (nums[mid] < target) lp = mid + 1;
        else rp = mid - 1;
    }
    return -1;
}` },
            ],
          },
        ],
      },
      {
        name: 'Brute Force',
        cards: [
          {
            id: 'brute-force-template',
            title: 'Brute Force — Nested Loops',
            description: 'Try every possible combination without optimization. Use as a baseline before optimizing. O(n²) or worse.',
            complexity: 'Time O(n²) typical · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// Count pairs with difference == k
int countPairs(vector<int>& nums, int k) {
    int count = 0;
    for (int i = 0; i < nums.size(); i++)
        for (int j = i + 1; j < nums.size(); j++)
            if (abs(nums[i] - nums[j]) == k)
                count++;
    return count;
}

// Running sum (brute force O(n²) — optimize with prefix sum)
vector<int> runningSum(vector<int>& nums) {
    int n = nums.size();
    vector<int> ans(n);
    for (int i = 0; i < n; i++) {
        int sum = 0;
        for (int j = 0; j <= i; j++) sum += nums[j];
        ans[i] = sum;
    }
    return ans;
}` },
            ],
          },
        ],
      },
      {
        name: 'Greedy',
        cards: [
          {
            id: 'greedy-template',
            title: 'Greedy — Locally Optimal Choices',
            description: 'Makes the best immediate choice at each step hoping to reach the global optimum. Simple but not always optimal.',
            complexity: 'Usually O(n log n) with sorting · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// LC 455: Assign Cookies
// Strategy: match smallest sufficient cookie to least greedy child
int findContentChildren(vector<int>& g, vector<int>& s) {
    sort(s.begin(), s.end());
    sort(g.begin(), g.end());
    int ans = 0;
    for (int j = 0; j < s.size() && ans < g.size(); j++)
        if (g[ans] <= s[j]) ans++;
    return ans;
}

// LC 605: Can Place Flowers
bool canPlaceFlowers(vector<int>& bed, int n) {
    int count = 0, sz = bed.size();
    for (int i = 0; i < sz && count < n; i++) {
        if (bed[i] == 0 &&
            (i == 0 || bed[i-1] == 0) &&
            (i == sz-1 || bed[i+1] == 0)) {
            bed[i] = 1;
            count++;
        }
    }
    return count >= n;
}` },
            ],
          },
        ],
      },
      {
        name: 'Hash Map',
        cards: [
          {
            id: 'hashmap-template',
            title: 'Hash Map — O(1) Lookup',
            description: 'Maps keys to values using a hash function. Enables O(1) average insert/lookup vs O(n) linear search.',
            complexity: 'Time O(1) avg · Space O(n)',
            snippets: [
              { lang: 'C++', code: `// LC 1: Two Sum — O(n) with hash map
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> mp; // value -> index
    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (mp.count(complement))
            return {mp[complement], i};
        mp[nums[i]] = i;
    }
    return {};
}

// Frequency count
unordered_map<int, int> freq;
for (int x : nums) freq[x]++;
// Check if exists
if (freq.count(key)) { /* exists */ }
// Iterate
for (auto& [k, v] : freq) { /* use k, v */ }` },
              { lang: 'Python', code: `# Two Sum
def twoSum(nums, target):
    seen = {}  # value -> index
    for i, num in enumerate(nums):
        if target - num in seen:
            return [seen[target - num], i]
        seen[num] = i
    return []

# Frequency count
from collections import Counter
freq = Counter(nums)
freq['a']  # 0 if not present (defaultdict behavior)` },
            ],
          },
        ],
      },
      {
        name: 'Heap / Priority Queue',
        cards: [
          {
            id: 'heap-template',
            title: 'Min/Max Heap Operations',
            description: 'Efficiently retrieves minimum (or maximum) element in O(log n). Python heapq is min-heap; negate for max-heap. C++ priority_queue is max-heap by default.',
            complexity: 'Push/Pop O(log n) · Peek O(1)',
            snippets: [
              { lang: 'Python', code: `import heapq

# Min-heap
heap = []
heapq.heappush(heap, 3)
heapq.heappush(heap, 1)
smallest = heapq.heappop(heap)  # 1

# Max-heap (negate values)
max_heap = []
heapq.heappush(max_heap, -10)
heapq.heappush(max_heap, -7)
largest = -heapq.heappop(max_heap)  # 10

# Heapify in-place O(n)
heapq.heapify(arr)` },
              { lang: 'C++', code: `// Max-heap (default)
priority_queue<int> max_pq;
max_pq.push(3);
int top = max_pq.top(); // 3
max_pq.pop();

// Min-heap
priority_queue<int, vector<int>, greater<int>> min_pq;

// Min-heap of pairs {cost, node}
priority_queue<pair<int,int>,
               vector<pair<int,int>>,
               greater<>> pq;
pq.push({cost, node});
auto [c, n] = pq.top(); pq.pop();` },
            ],
          },
        ],
      },
      {
        name: "Kadane's Algorithm",
        cards: [
          {
            id: 'kadane-template',
            title: 'Maximum Subarray Sum',
            description: "Finds the maximum sum of a contiguous subarray in O(n). Resets the running sum to 0 whenever it goes negative.",
            complexity: 'Time O(n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// LC 53: Maximum Subarray
int maxSubArray(vector<int>& nums) {
    int globalSum = INT_MIN, localSum = 0;
    for (int x : nums) {
        localSum += x;
        globalSum = max(globalSum, localSum);
        if (localSum < 0) localSum = 0;
    }
    return globalSum;
}` },
              { lang: 'Python', code: `def maxSubArray(nums):
    global_sum = float('-inf')
    local_sum = 0
    for x in nums:
        local_sum += x
        global_sum = max(global_sum, local_sum)
        if local_sum < 0:
            local_sum = 0
    return global_sum` },
            ],
          },
        ],
      },
      {
        name: 'Linear Search',
        cards: [
          {
            id: 'linear-search-template',
            title: 'Linear Search',
            description: 'Traverses every element checking against the target. Simplest search — no sorting required. O(n) worst case.',
            complexity: 'Best O(1) · Average/Worst O(n)',
            snippets: [
              { lang: 'C++', code: `// Generic linear search
int linearSearch(vector<int>& nums, int target) {
    for (int i = 0; i < nums.size(); i++)
        if (nums[i] == target) return i;
    return -1;
}

// LC 1295: Find Numbers with Even Digits
int findNumbers(vector<int>& nums) {
    int ans = 0;
    for (int x : nums) {
        int len = log10(x) + 1;
        if (len % 2 == 0) ans++;
    }
    return ans;
}` },
            ],
          },
        ],
      },
      {
        name: 'Linked List',
        cards: [
          {
            id: 'linkedlist-ops',
            title: 'Linked List — Insert / Delete / Search',
            description: 'Nodes connected by next pointers. O(1) insert/delete at head but O(n) to access arbitrary elements.',
            complexity: 'Lookup O(n) · Insert/Delete head O(1) · Insert/Delete tail O(n)',
            snippets: [
              { lang: 'C++', code: `struct ListNode {
    int val; ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

// Insert at head
ListNode* insertHead(ListNode* head, int val) {
    ListNode* node = new ListNode(val);
    node->next = head;
    return node;
}

// Delete head
ListNode* deleteHead(ListNode* head) {
    if (!head) return nullptr;
    ListNode* tmp = head;
    head = head->next;
    delete tmp;
    return head;
}

// Floyd's cycle detection / find mid
ListNode* findMid(ListNode* head) {
    ListNode* slow = head, *fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
    }
    return slow;
}` },
            ],
          },
        ],
      },
      {
        name: 'MOD (1e9 + 7)',
        cards: [
          {
            id: 'mod-template',
            title: 'Modular Arithmetic',
            description: 'Apply % at each step to prevent overflow. 1e9+7 is prime, enabling modular inverse via Fermat\'s Little Theorem.',
            complexity: 'O(1) per operation · O(log n) for modular inverse',
            snippets: [
              { lang: 'C++', code: `const int MOD = 1e9 + 7;

// Correct: apply mod each step
long long factorial(int n) {
    long long fact = 1;
    for (int i = 2; i <= n; i++)
        fact = (fact * i) % MOD;
    return fact;
}

// Modular properties:
// (a + b) % m = (a%m + b%m) % m
// (a * b) % m = (a%m * b%m) % m
// (a - b) % m = (a%m - b%m + m) % m  ← +m to avoid negatives

// Modular inverse (m must be prime): a^(m-2) mod m
long long power(long long base, long long exp, long long mod) {
    long long res = 1;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) res = res * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return res;
}
long long modInverse(long long a) { return power(a, MOD - 2, MOD); }` },
            ],
          },
        ],
      },
      {
        name: 'Prefix Sum',
        cards: [
          {
            id: 'prefix-sum-template',
            title: 'Prefix Sum — O(1) Range Queries',
            description: 'Pre-computes cumulative sums to answer range sum queries in O(1) after O(n) build.',
            complexity: 'Build O(n) · Query O(1) · Space O(n)',
            snippets: [
              { lang: 'C++', code: `// Build prefix sum (0-indexed, padded)
vector<int> buildPrefix(vector<int>& a) {
    int n = a.size();
    vector<int> pref(n + 1, 0);
    for (int i = 0; i < n; i++)
        pref[i + 1] = pref[i] + a[i];
    return pref;
}
// Range sum [l, r] (0-indexed):
// pref[r + 1] - pref[l]

// LC 303: Range Sum Query
class NumArray {
    vector<int> pref;
public:
    NumArray(vector<int>& nums) {
        pref.resize(nums.size() + 1, 0);
        for (int i = 0; i < nums.size(); i++)
            pref[i+1] = pref[i] + nums[i];
    }
    int sumRange(int l, int r) { return pref[r+1] - pref[l]; }
};` },
            ],
          },
        ],
      },
      {
        name: 'Queue & Stack',
        cards: [
          {
            id: 'stack-template',
            title: 'Stack — LIFO',
            description: 'Last In First Out. Use for matching brackets, monotonic problems, undo operations.',
            complexity: 'Push/Pop O(1)',
            snippets: [
              { lang: 'Python', code: `# LC 20: Valid Parentheses
def isValid(s: str) -> bool:
    stack = []
    pairs = {')':'(', ']':'[', '}':'{'}
    for c in s:
        if c in "([{":
            stack.append(c)
        elif not stack or stack[-1] != pairs[c]:
            return False
        else:
            stack.pop()
    return len(stack) == 0` },
              { lang: 'C++', code: `// Stack operations
stack<int> st;
st.push(1); st.push(2);
int top = st.top(); st.pop();
bool empty = st.empty();` },
            ],
          },
          {
            id: 'queue-template',
            title: 'Queue — FIFO',
            description: 'First In First Out. Use for BFS, level-order traversal, sliding window problems.',
            complexity: 'Push/Pop O(1)',
            snippets: [
              { lang: 'Python', code: `from collections import deque
queue = deque()
queue.appendleft(1)  # enqueue front
queue.appendleft(2)
val = queue.pop()    # dequeue back` },
              { lang: 'C++', code: `// Queue operations
queue<int> q;
q.push(1); q.push(2);
int front = q.front(); q.pop();
bool empty = q.empty();

// Deque (double-ended)
deque<int> dq;
dq.push_front(1); dq.push_back(2);
dq.pop_front(); dq.pop_back();` },
            ],
          },
        ],
      },
      {
        name: 'Sliding Window',
        cards: [
          {
            id: 'sliding-fixed',
            title: 'Sliding Window — Fixed Size',
            description: 'Maintains a window of fixed size k, sliding one element at a time. Avoids recomputing from scratch each step.',
            complexity: 'Time O(n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// Maximum sum of subarray of size k
int maxSumSubarray(vector<int>& nums, int k) {
    int windowSum = 0, maxSum = 0;
    for (int i = 0; i < k; i++) windowSum += nums[i];
    maxSum = windowSum;
    for (int i = k; i < nums.size(); i++) {
        windowSum += nums[i] - nums[i - k];
        maxSum = max(maxSum, windowSum);
    }
    return maxSum;
}` },
            ],
          },
          {
            id: 'sliding-variable',
            title: 'Sliding Window — Variable Size',
            description: 'Expands right pointer and shrinks left pointer based on a condition. Common for longest/shortest subarray problems.',
            complexity: 'Time O(n) · Space O(k) with hash map',
            snippets: [
              { lang: 'C++', code: `// Longest substring without repeating characters
int lengthOfLongestSubstring(string s) {
    unordered_map<char, int> last;
    int ans = 0, l = 0;
    for (int r = 0; r < s.size(); r++) {
        if (last.count(s[r]) && last[s[r]] >= l)
            l = last[s[r]] + 1;
        last[s[r]] = r;
        ans = max(ans, r - l + 1);
    }
    return ans;
}` },
              { lang: 'Python', code: `def lengthOfLongestSubstring(s: str) -> int:
    last = {}
    ans = l = 0
    for r, c in enumerate(s):
        if c in last and last[c] >= l:
            l = last[c] + 1
        last[c] = r
        ans = max(ans, r - l + 1)
    return ans` },
            ],
          },
        ],
      },
      {
        name: 'Sorting',
        cards: [
          {
            id: 'sort-builtin',
            title: 'Built-in Sort — Usage & Comparators',
            description: 'C++ std::sort is introsort (O(n log n)). Python sort is Timsort (stable). Custom comparators allow multi-key sorting.',
            complexity: 'Time O(n log n) · Space O(log n)',
            snippets: [
              { lang: 'C++', code: `// Sort ascending
sort(v.begin(), v.end());
// Descending
sort(v.begin(), v.end(), greater<int>());
// Custom: multi-key
sort(v.begin(), v.end(), [](const array<int,3>& x, const array<int,3>& y){
    return x[0] != y[0] ? x[0] < y[0] :
           x[1] != y[1] ? x[1] < y[1] : x[2] < y[2];
});` },
            ],
          },
          {
            id: 'bubble-sort',
            title: 'Bubble Sort',
            description: 'Repeatedly swaps adjacent out-of-order elements. Early termination with a flag. Simple but O(n²).',
            complexity: 'Time O(n²) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `void bubbleSort(vector<int>& arr) {
    int n = arr.size();
    bool swapped = true;
    for (int i = 0; i < n - 1 && swapped; i++) {
        swapped = false;
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j+1]) {
                swap(arr[j], arr[j+1]);
                swapped = true;
            }
        }
    }
}` },
            ],
          },
          {
            id: 'merge-sort',
            title: 'Merge Sort',
            description: 'Divide array in half, recursively sort each half, merge. Stable, O(n log n) all cases.',
            complexity: 'Time O(n log n) all cases · Space O(n)',
            snippets: [
              { lang: 'C++', code: `void merge(vector<int>& a, int l, int m, int r) {
    vector<int> L(a.begin()+l, a.begin()+m+1);
    vector<int> R(a.begin()+m+1, a.begin()+r+1);
    int i=0, j=0, k=l;
    while (i<L.size() && j<R.size())
        a[k++] = (L[i]<=R[j]) ? L[i++] : R[j++];
    while (i<L.size()) a[k++]=L[i++];
    while (j<R.size()) a[k++]=R[j++];
}
void mergeSort(vector<int>& a, int l, int r) {
    if (l >= r) return;
    int m = l + (r-l)/2;
    mergeSort(a, l, m);
    mergeSort(a, m+1, r);
    merge(a, l, m, r);
}` },
            ],
          },
          {
            id: 'timsort',
            title: 'Tim Sort',
            description: 'Hybrid of insertion sort + merge sort. Used in Python sort() and Java Arrays.sort(). Splits into runs of size 32, sorts each with insertion sort, then merges.',
            complexity: 'Time O(n log n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `const int RUN = 32;

void insertionSort(vector<int>& nums, int l, int r) {
    for (int i = l+1; i <= r; i++) {
        int tmp = nums[i], j = i-1;
        while (j >= l && nums[j] > tmp) { nums[j+1]=nums[j]; j--; }
        nums[j+1] = tmp;
    }
}

void timMerge(vector<int>& nums, int l, int m, int r) {
    vector<int> L(nums.begin()+l, nums.begin()+m+1);
    vector<int> R(nums.begin()+m+1, nums.begin()+r+1);
    int i=0, j=0, k=l;
    while (i<L.size()&&j<R.size()) nums[k++]=(L[i]<=R[j])?L[i++]:R[j++];
    while (i<L.size()) nums[k++]=L[i++];
    while (j<R.size()) nums[k++]=R[j++];
}

void timSort(vector<int>& nums) {
    int n = nums.size();
    for (int i=0; i<n; i+=RUN)
        insertionSort(nums, i, min(i+RUN-1, n-1));
    for (int sz=RUN; sz<n; sz*=2)
        for (int l=0; l<n; l+=2*sz) {
            int m=l+sz-1, r=min(l+2*sz-1,n-1);
            if (m<r) timMerge(nums, l, m, r);
        }
}` },
            ],
          },
        ],
      },
      {
        name: 'Time Complexity',
        cards: [
          {
            id: 'time-complexity-guide',
            title: 'Input Size → Required Complexity',
            description: 'Use input size n to determine which algorithm complexity is fast enough. LeetCode typical time limit is ~10^8 operations/sec.',
            snippets: [
              { lang: 'Reference', code: `n ≤ 10        →  O(n!), O(n^7), O(n^6)
n ≤ 20        →  O(2^n)
n ≤ 80        →  O(n^4)
n ≤ 400       →  O(n^3)
n ≤ 7,500     →  O(n^2)
n ≤ 10^6      →  O(n log n), O(n)
n > 10^6      →  O(log n), O(1)

// Loop complexities:
O(n)      — single loop
O(n*m)    — nested loops
O(√n)     — loop: i*i <= n
O(log n)  — halving each step (binary search)
O(n log n)— sort + single loop` },
            ],
          },
        ],
      },
      {
        name: 'Trie',
        cards: [
          {
            id: 'trie-template',
            title: 'Trie — Insert / Search / StartsWith',
            description: 'Prefix tree for string storage and retrieval. Each node has 26 children (a-z) and an end-of-word flag. O(m) per operation where m = word length.',
            complexity: 'Time O(m) per op · Space O(26 × n × m)',
            snippets: [
              { lang: 'C++', code: `struct TrieNode {
    TrieNode* children[26];
    bool isEnd;
    TrieNode() : isEnd(false) {
        fill(children, children+26, nullptr);
    }
};

class Trie {
    TrieNode* root;
public:
    Trie() { root = new TrieNode(); }

    void insert(string word) {
        TrieNode* cur = root;
        for (char c : word) {
            int i = c - 'a';
            if (!cur->children[i])
                cur->children[i] = new TrieNode();
            cur = cur->children[i];
        }
        cur->isEnd = true;
    }

    bool search(string word) {
        TrieNode* cur = root;
        for (char c : word) {
            int i = c - 'a';
            if (!cur->children[i]) return false;
            cur = cur->children[i];
        }
        return cur->isEnd;
    }

    bool startsWith(string prefix) {
        TrieNode* cur = root;
        for (char c : prefix) {
            int i = c - 'a';
            if (!cur->children[i]) return false;
            cur = cur->children[i];
        }
        return true;
    }
};` },
            ],
          },
        ],
      },
      {
        name: 'Two Pointers',
        cards: [
          {
            id: 'two-ptr-converging',
            title: 'Two Pointers — Converging',
            description: 'Start one pointer at each end, move inward based on condition. Common for sorted arrays.',
            complexity: 'Time O(n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// LC 977: Squares of Sorted Array
vector<int> sortedSquares(vector<int>& nums) {
    int l = 0, r = nums.size() - 1;
    vector<int> res;
    while (l <= r) {
        if (abs(nums[l]) > abs(nums[r])) {
            res.push_back(nums[l]*nums[l]); l++;
        } else {
            res.push_back(nums[r]*nums[r]); r--;
        }
    }
    reverse(res.begin(), res.end());
    return res;
}` },
              { lang: 'Python', code: `def sortedSquares(nums):
    l, r = 0, len(nums) - 1
    res = []
    while l <= r:
        if abs(nums[l]) > abs(nums[r]):
            res.append(nums[l]**2); l += 1
        else:
            res.append(nums[r]**2); r -= 1
    return res[::-1]` },
            ],
          },
        ],
      },
    ],
  },
  {
    section: 'Graph Theory',
    categories: [
      {
        name: 'Tree Traversals',
        cards: [
          {
            id: 'gt-preorder',
            title: 'Preorder / Inorder / Postorder',
            description: 'Three DFS traversal orders. Preorder: Root→L→R. Inorder: L→Root→R (sorted for BST). Postorder: L→R→Root.',
            snippets: [
              { lang: 'C++', code: `void preorder(TreeNode* node) {
    if (!node) return;
    // process node->val
    preorder(node->left);
    preorder(node->right);
}

void inorder(TreeNode* node) {
    if (!node) return;
    inorder(node->left);
    // process node->val
    inorder(node->right);
}

void postorder(TreeNode* node) {
    if (!node) return;
    postorder(node->left);
    postorder(node->right);
    // process node->val
}` },
              { lang: 'Python', code: `def preorder(node):
    if not node: return
    # process node.val
    preorder(node.left); preorder(node.right)

def inorder(node):
    if not node: return
    inorder(node.left)
    # process node.val
    inorder(node.right)

def postorder(node):
    if not node: return
    postorder(node.left); postorder(node.right)
    # process node.val` },
            ],
          },
        ],
      },
      {
        name: 'BFS',
        cards: [
          {
            id: 'gt-bfs',
            title: 'Breadth-First Search',
            description: 'Explores all nodes at current depth before going deeper. Uses a queue. Guarantees shortest path in unweighted graphs.',
            complexity: 'Time O(V+E) · Space O(V)',
            snippets: [
              { lang: 'Python', code: `def bfs(root, target):
    if not root: return None
    level = [root]
    while level:
        next_level = []
        for node in level:
            if not node: continue
            if node.val == target: return node
            next_level.append(node.left)
            next_level.append(node.right)
        level = next_level
    return None` },
              { lang: 'C++', code: `// BFS on graph
vector<int> bfs(vector<vector<int>>& adj, int src, int n) {
    vector<int> dist(n, -1);
    queue<int> q;
    dist[src] = 0; q.push(src);
    while (!q.empty()) {
        int u = q.front(); q.pop();
        for (int v : adj[u]) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                q.push(v);
            }
        }
    }
    return dist;
}` },
            ],
          },
        ],
      },
      {
        name: 'DFS',
        cards: [
          {
            id: 'gt-dfs',
            title: 'Depth-First Search',
            description: 'Explores one branch completely before backtracking. Uses recursion (implicit stack). Great for path finding, cycle detection, connected components.',
            complexity: 'Time O(V+E) · Space O(V)',
            snippets: [
              { lang: 'Python', code: `def dfs(node):
    if not node: return 0
    left = dfs(node.left)
    right = dfs(node.right)
    return max(left, right) + 1  # max depth example` },
              { lang: 'C++', code: `// DFS on graph with visited set
void dfs(vector<vector<int>>& adj, vector<bool>& vis, int u) {
    vis[u] = true;
    // process u
    for (int v : adj[u])
        if (!vis[v]) dfs(adj, vis, v);
}` },
            ],
          },
        ],
      },
      {
        name: 'Bellman-Ford',
        cards: [
          {
            id: 'gt-bellman',
            title: 'Bellman-Ford Algorithm',
            description: 'Shortest paths from single source. Handles negative weights. Runs |V|-1 relaxation passes over all edges.',
            complexity: 'Time O(V×E) · Space O(V)',
            snippets: [
              { lang: 'C++', code: `template<typename T_a3, typename T_vector>
void bellman_ford(T_a3& g, T_vector& dist, int src, int mx_edges) {
    dist[src] = 0;
    for (int i = 0; i <= mx_edges; i++) {
        T_vector ndist = dist;
        for (auto x : g) {
            auto [from, to, cost] = x;
            ndist[to] = min(ndist[to], dist[from] + cost);
        }
        dist = ndist;
    }
}` },
              { lang: 'Python', code: `def bellman_ford(g, dist, src, mx_edges):
    dist[src] = 0
    for _ in range(mx_edges + 1):
        ndist = dist[:]
        for frm, to, cost in g:
            ndist[to] = min(ndist[to], dist[frm] + cost)
        dist = ndist
    return dist` },
            ],
          },
        ],
      },
      {
        name: "Dijkstra's",
        cards: [
          {
            id: 'gt-dijkstra',
            title: "Dijkstra's Algorithm",
            description: 'Shortest paths from single source. Non-negative weights only. Uses min-heap priority queue.',
            complexity: 'Time O((V+E) log V) · Space O(V)',
            snippets: [
              { lang: 'C++', code: `template<typename T_pair, typename T_vector>
void dijkstra(T_pair& g, T_vector& dist, int start) {
    priority_queue<pair<int,int>,vector<pair<int,int>>,greater<>> pq;
    dist[start] = 0;
    pq.push({0, start});
    while (!pq.empty()) {
        auto [u_cost, u] = pq.top(); pq.pop();
        if (u_cost > dist[u]) continue;
        for (auto [v, w] : g[u]) {
            if (dist[v] > dist[u] + w) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
}` },
            ],
          },
        ],
      },
      {
        name: 'DSU',
        cards: [
          {
            id: 'gt-dsu',
            title: 'Disjoint Set Union (Union-Find)',
            description: 'Tracks connected components. Two operations: Find (get root) and Union (merge sets). Path compression + union by rank gives near O(1) per op.',
            complexity: 'O(α(n)) ≈ O(1) per op with optimizations',
            snippets: [
              { lang: 'C++', code: `class DSU {
public:
    vector<int> root, rank_;
    int cnt;
    DSU(int n) : root(n), rank_(n, 1), cnt(n) {
        iota(root.begin(), root.end(), 0);
    }
    int find(int x) {
        return x == root[x] ? x : root[x] = find(root[x]);
    }
    bool unite(int x, int y) {
        x = find(x); y = find(y);
        if (x == y) return false;
        if (rank_[x] < rank_[y]) swap(x, y);
        root[y] = x;
        if (rank_[x] == rank_[y]) rank_[x]++;
        cnt--;
        return true;
    }
    bool connected(int x, int y) { return find(x) == find(y); }
};` },
            ],
          },
        ],
      },
      {
        name: 'Topological Sort',
        cards: [
          {
            id: 'gt-topo',
            title: 'Topological Sort (Kahn\'s BFS)',
            description: 'Linear ordering of a DAG where u comes before v for every edge (u,v). Detects cycles if not all nodes are processed.',
            complexity: 'Time O(V+E) · Space O(V)',
            snippets: [
              { lang: 'C++', code: `struct TopologicalSort {
    vector<int> orders;
    bool isSorted = false;
    int steps = 0;

    TopologicalSort(vector<vector<int>>& g, vector<int>& indegree) {
        int n = g.size(), nodes = 0;
        queue<int> q;
        for (int i = 0; i < n; i++)
            if (indegree[i] == 0) q.push(i);
        while (!q.empty()) {
            int sz = q.size(); steps++;
            nodes += sz;
            for (int i = 0; i < sz; i++) {
                int u = q.front(); q.pop();
                orders.push_back(u);
                for (int v : g[u])
                    if (--indegree[v] == 0) q.push(v);
            }
        }
        isSorted = nodes == n;
    }
};

// LC 207: Course Schedule
bool canFinish(int n, vector<vector<int>>& pre) {
    vector<vector<int>> g(n); vector<int> ind(n);
    for (auto& p : pre) { g[p[1]].push_back(p[0]); ind[p[0]]++; }
    TopologicalSort ts(g, ind);
    return ts.isSorted;
}` },
            ],
          },
        ],
      },
      {
        name: 'Binary Search Tree',
        cards: [
          {
            id: 'gt-bst',
            title: 'BST — Insert / Delete / Search',
            description: 'Left subtree < node < right subtree. All ops O(n) worst case (unbalanced), O(log n) average.',
            complexity: 'Time O(n) worst · O(log n) balanced',
            snippets: [
              { lang: 'C++', code: `TreeNode* insert(TreeNode* root, int key) {
    if (!root) return new TreeNode(key);
    if (key < root->val) root->left = insert(root->left, key);
    else root->right = insert(root->right, key);
    return root;
}

TreeNode* search(TreeNode* root, int key) {
    if (!root || root->val == key) return root;
    return key < root->val ? search(root->left, key)
                           : search(root->right, key);
}

TreeNode* deleteNode(TreeNode* root, int key) {
    if (!root) return nullptr;
    if (key < root->val) root->left = deleteNode(root->left, key);
    else if (key > root->val) root->right = deleteNode(root->right, key);
    else {
        if (!root->left) return root->right;
        if (!root->right) return root->left;
        TreeNode* succ = root->right;
        while (succ->left) succ = succ->left;
        root->val = succ->val;
        root->right = deleteNode(root->right, succ->val);
    }
    return root;
}` },
            ],
          },
        ],
      },
      {
        name: "Kruskal's MST",
        cards: [
          {
            id: 'gt-kruskal',
            title: "Kruskal's Algorithm — Minimum Spanning Tree",
            description: 'Greedy MST: sort edges by weight, add edge if it doesn\'t form a cycle (using DSU). O(E log E).',
            complexity: 'Time O(E log E) · Space O(V)',
            snippets: [
              { lang: 'C++', code: `int kruskalMST(int n, vector<array<int,3>>& edges) {
    // edges: {weight, u, v}
    sort(edges.begin(), edges.end());
    DSU dsu(n);
    int total = 0;
    for (auto& [w, u, v] : edges)
        if (dsu.unite(u, v)) total += w;
    return total;
}` },
            ],
          },
        ],
      },
      {
        name: 'Tarjan\'s Algorithm',
        cards: [
          {
            id: 'gt-tarjan',
            title: 'Tarjan\'s — SCCs & Bridges',
            description: 'Finds Strongly Connected Components in O(V+E). Also used to find bridges (low[v] > tin[u]) and articulation points.',
            complexity: 'Time O(V+E) · Space O(V)',
            snippets: [
              { lang: 'C++', code: `struct Tarjan {
    int timer = 0;
    vector<int> tin, low;
    vector<bool> onStack;
    stack<int> stk;
    vector<vector<int>> sccs;

    void dfs(int u, vector<vector<int>>& g) {
        tin[u] = low[u] = timer++;
        stk.push(u); onStack[u] = true;
        for (int v : g[u]) {
            if (tin[v] == -1) { dfs(v, g); low[u] = min(low[u], low[v]); }
            else if (onStack[v]) low[u] = min(low[u], tin[v]);
        }
        if (low[u] == tin[u]) {  // root of SCC
            vector<int> scc;
            while (stk.top() != u) {
                int v = stk.top(); stk.pop();
                onStack[v] = false; scc.push_back(v);
            }
            stk.pop(); onStack[u] = false; scc.push_back(u);
            sccs.push_back(scc);
        }
    }

    vector<vector<int>> run(int n, vector<vector<int>>& g) {
        tin.assign(n,-1); low.assign(n,-1); onStack.assign(n,false);
        for (int u = 0; u < n; u++) if (tin[u] == -1) dfs(u, g);
        return sccs;
    }
};` },
            ],
          },
        ],
      },
      {
        name: 'LCA',
        cards: [
          {
            id: 'gt-lca',
            title: 'Lowest Common Ancestor',
            description: 'Deepest node that has both x and y as descendants. dist(x,y) = depth(x) + depth(y) - 2*depth(LCA).',
            complexity: 'Time O(n) · Space O(n)',
            snippets: [
              { lang: 'C++', code: `// LC 236: LCA of Binary Tree
TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
    if (!root || root == p || root == q) return root;
    TreeNode* left  = lowestCommonAncestor(root->left, p, q);
    TreeNode* right = lowestCommonAncestor(root->right, p, q);
    if (left && right) return root; // p and q on opposite sides
    return left ? left : right;
}` },
            ],
          },
        ],
      },
    ],
  },
  {
    section: 'Math',
    categories: [
      {
        name: 'Bit Manipulation',
        cards: [
          {
            id: 'math-bit-ops',
            title: 'Bit Operations Cheat Sheet',
            description: 'Direct binary manipulation. All operations O(1). Essential for subset enumeration and optimization.',
            snippets: [
              { lang: 'C++', code: `// Common bit tricks
n & (n-1)       // remove lowest set bit (isPowerOfTwo: n>0 && !(n&(n-1)))
n & (-n)        // isolate lowest set bit
n | (1<<i)      // set bit i
n & ~(1<<i)     // clear bit i
(n >> i) & 1    // get bit i
n ^ n = 0       // XOR with self cancels
n ^ 0 = n       // XOR with 0 unchanged
__builtin_popcount(n)  // count set bits
__builtin_ctz(n)       // count trailing zeros
31 - __builtin_clz(n)  // index of highest set bit

// Enumerate all submasks of mask m:
for (int s = m; s; s = (s-1) & m) { /* use s */ }

// Subsets (bit masking):
for (int mask = 0; mask < (1<<n); mask++)
    for (int j = 0; j < n; j++)
        if ((mask>>j)&1) { /* j is in subset */ }` },
            ],
          },
          {
            id: 'math-bit-examples',
            title: 'Bit Manipulation — Common Problems',
            description: 'XOR to find single number, Hamming weight, missing number, subsets.',
            snippets: [
              { lang: 'C++', code: `// Single Number (LC 136) — XOR cancels pairs
int singleNumber(vector<int>& nums) {
    int ans = 0;
    for (int x : nums) ans ^= x;
    return ans;
}

// Hamming Weight (LC 191)
int hammingWeight(uint32_t n) {
    int ans = 0;
    for (; n; n &= n-1) ans++; // remove lowest set bit each time
    return ans;
}

// Missing Number (LC 268)
int missingNumber(vector<int>& nums) {
    int n = nums.size(), ans = n;
    for (int i = 0; i < n; i++) ans ^= i ^ nums[i];
    return ans;
}` },
            ],
          },
        ],
      },
      {
        name: 'Combinatorics',
        cards: [
          {
            id: 'math-comb',
            title: 'Combinatorics — nCr with Modular Inverse',
            description: 'C(n,r) = n! / (r!(n-r)!). Use modular inverse for large values. Pascal\'s Triangle gives C(n,r) = C(n-1,r) + C(n-1,r-1).',
            complexity: 'Precompute O(n) · Query O(1)',
            snippets: [
              { lang: 'C++', code: `struct Comb {
    int mod;
    vector<long long> fact, inv_fact;

    Comb(int N, int mod = 1e9+7) : mod(mod), fact(N+1), inv_fact(N+1) {
        fact[0] = 1;
        for (int i = 1; i <= N; i++) fact[i] = fact[i-1] * i % mod;
        inv_fact[N] = power(fact[N], mod-2);
        for (int i = N-1; i >= 0; i--) inv_fact[i] = inv_fact[i+1] * (i+1) % mod;
    }

    long long power(long long a, long long b) {
        long long res = 1; a %= mod;
        for (; b > 0; b >>= 1, a = a*a%mod)
            if (b&1) res = res*a%mod;
        return res;
    }

    long long nCr(int n, int r) {
        if (r < 0 || r > n) return 0;
        return fact[n] % mod * inv_fact[r] % mod * inv_fact[n-r] % mod;
    }
};
// Comb c(1000000); c.nCr(100, 5);` },
            ],
          },
        ],
      },
      {
        name: 'Matrix Exponentiation',
        cards: [
          {
            id: 'math-matexp',
            title: 'Matrix Exponentiation — O(log n) Recurrences',
            description: 'Compute linear recurrences (e.g., Fibonacci) in O(k³ log n) by using binary exponentiation on the transformation matrix.',
            complexity: 'Time O(k³ log n) · Space O(k²)',
            snippets: [
              { lang: 'C++', code: `const int MOD = 1e9+7;
using Mat = vector<vector<long long>>;

Mat multiply(const Mat& A, const Mat& B) {
    int n = A.size();
    Mat C(n, vector<long long>(n, 0));
    for (int i = 0; i < n; i++)
        for (int k = 0; k < n; k++) if (A[i][k])
            for (int j = 0; j < n; j++)
                C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % MOD;
    return C;
}

Mat matpow(Mat A, long long p) {
    int n = A.size();
    Mat res(n, vector<long long>(n, 0));
    for (int i = 0; i < n; i++) res[i][i] = 1; // identity
    for (; p > 0; p >>= 1, A = multiply(A, A))
        if (p & 1) res = multiply(res, A);
    return res;
}

// Fibonacci in O(log n)
long long fib(int n) {
    Mat T = {{1,1},{1,0}};
    Mat A = {{1},{0}};
    return multiply(matpow(T, n), A)[1][0];
}` },
            ],
          },
        ],
      },
      {
        name: 'Number Theory',
        cards: [
          {
            id: 'math-binexp',
            title: 'Binary Exponentiation — O(log n) Powers',
            description: 'Efficiently computes a^n in O(log n) using the binary representation of the exponent. Each step squares the base and halves the exponent.',
            complexity: 'Time O(log n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// Basic — computes base^exp
long long fastpow(long long base, long long exp) {
  long long res = 1;
  while (exp > 0) {
    if (exp & 1) res *= base;
    base *= base;
    exp >>= 1;
  }
  return res;
}

// With modulo — prevents overflow in modular arithmetic
long long modpow(long long base, long long exp, long long mod) {
  base %= mod;
  long long res = 1;
  while (exp > 0) {
    if (exp & 1) res = (res * base) % mod;
    base = (base * base) % mod;
    exp >>= 1;
  }
  return res;
}

// e.g., 3^13 mod 1e9+7
// modpow(3, 13, 1e9+7)` },
            ],
          },
          {
            id: 'math-sieve-era',
            title: 'Sieve of Eratosthenes — All Primes ≤ N',
            description: 'Finds all prime numbers up to N. Iteratively marks multiples of each prime as composite. Outer loop runs only to √N — composites already marked by smaller primes.',
            complexity: 'Time O(n log log n) · Space O(n)',
            snippets: [
              { lang: 'C++', code: `vector<bool> sieveOfEratosthenes(const int n) {
  vector<bool> isPrime(n + 1, true);
  isPrime[0] = isPrime[1] = false;
  for (int i = 2; i * i <= n; i++) {
    if (isPrime[i]) {
      for (int j = i * i; j <= n; j += i) {
        isPrime[j] = false;
      }
    }
  }
  return isPrime;
}

// Usage: count primes up to 10^6
// auto p = sieveOfEratosthenes(1e6);
// count(p.begin(), p.end(), true)  → 78498` },
            ],
          },
        ],
      },
      {
        name: 'Prime Factors',
        cards: [
          {
            id: 'math-prime',
            title: 'Prime Factorization — Trial Division',
            description: 'A number has at most log(n) prime factors since 2^log(n)≥n. Trial division up to √n finds all factors.',
            complexity: 'Time O(√n) · Space O(log n)',
            snippets: [
              { lang: 'C++', code: `vector<int> primeFactors(int n) {
    vector<int> factors;
    for (int i = 2; i * i <= n; i++) {
        while (n % i == 0) {
            factors.push_back(i);
            n /= i;
        }
    }
    if (n > 1) factors.push_back(n);
    return factors;
}` },
            ],
          },
          {
            id: 'math-sieve',
            title: 'Sieve — O(log n) Factorization per Query',
            description: 'Precompute minimum prime factor for every number ≤ MAX. Then factor any n in O(log n).',
            complexity: 'Sieve O(MAX) · Factorize O(log n) · Space O(MAX)',
            snippets: [
              { lang: 'C++', code: `vector<int> buildSieve(int MAX) {
    vector<int> minP(MAX+1);
    iota(minP.begin(), minP.end(), 0);
    for (int i = 2; i*i <= MAX; i++)
        if (minP[i] == i)  // i is prime
            for (int j = i*i; j <= MAX; j += i)
                minP[j] = min(minP[j], i);
    return minP;
}

vector<int> factorize(int n, vector<int>& minP) {
    vector<int> factors;
    while (n > 1) {
        factors.push_back(minP[n]);
        n /= minP[n];
    }
    return factors;
}` },
            ],
          },
        ],
      },
    ],
  },
  {
    section: 'Strings',
    categories: [
      {
        name: "Manacher's Algorithm",
        cards: [
          {
            id: 'str-manacher',
            title: "Manacher's — O(n) Palindrome Detection",
            description: 'Finds all palindromic substrings in O(n) by inserting # separators and reusing previously computed palindrome lengths via mirroring.',
            complexity: 'Time O(n) · Space O(n)',
            snippets: [
              { lang: 'Python', code: `def manachers(s: str) -> list[int]:
    # Insert # to unify odd/even cases
    t = '#'.join(s)
    n = len(t)
    p = [0] * n  # palindrome radii
    c = r = 0
    for i in range(n):
        if i < r:
            p[i] = min(r - i, p[2*c - i])
        while i-p[i]-1 >= 0 and i+p[i]+1 < n and t[i-p[i]-1] == t[i+p[i]+1]:
            p[i] += 1
        if i + p[i] > r:
            c, r = i, i + p[i]
    return p  # p[i] = radius of palindrome centered at t[i]` },
              { lang: 'C++', code: `string longestPalindrome(string s) {
    string t = "#";
    for (char c : s) { t += c; t += '#'; }
    int n = t.size();
    vector<int> p(n, 0);
    int c = 0, r = 0;
    for (int i = 0; i < n; i++) {
        if (i < r) p[i] = min(r-i, p[2*c-i]);
        while (i-p[i]-1>=0 && i+p[i]+1<n && t[i-p[i]-1]==t[i+p[i]+1]) p[i]++;
        if (i+p[i] > r) { c=i; r=i+p[i]; }
    }
    int best = max_element(p.begin(),p.end()) - p.begin();
    return s.substr((best - p[best])/2, p[best]);
}` },
            ],
          },
        ],
      },
      {
        name: 'Palindrome',
        cards: [
          {
            id: 'str-palindrome',
            title: 'Palindrome Check — Multiple Methods',
            description: 'A string reads the same forwards and backwards. Check by comparing from both ends inward.',
            complexity: 'Time O(n) · Space O(1)',
            snippets: [
              { lang: 'C++', code: `// Method 1: Two pointers
bool isPalindrome(string s) {
    int l = 0, r = s.size() - 1;
    while (l < r) {
        if (s[l] != s[r]) return false;
        l++; r--;
    }
    return true;
}

// Method 2: Reverse compare
bool isPalindrome2(string s) {
    string rev = s;
    reverse(rev.begin(), rev.end());
    return s == rev;
}

// Method 3: STL equal with reverse iterators
bool isPalindrome3(string s) {
    return equal(s.begin(), s.begin() + s.size()/2, s.rbegin());
}` },
              { lang: 'Python', code: `# All in one line
def isPalindrome(s: str) -> bool:
    return s == s[::-1]

# Two pointers
def isPalindrome2(s: str) -> bool:
    l, r = 0, len(s) - 1
    while l < r:
        if s[l] != s[r]: return False
        l += 1; r -= 1
    return True` },
            ],
          },
        ],
      },
      {
        name: 'Z Algorithm',
        cards: [
          {
            id: 'str-z',
            title: 'Z Algorithm — O(n) Pattern Matching',
            description: 'Builds Z-array where Z[i] = length of longest substring starting at i matching a prefix. Z[0] = 0 by convention.',
            complexity: 'Time O(n) · Space O(n)',
            snippets: [
              { lang: 'C++', code: `vector<int> zFunction(string s) {
    int n = s.size();
    vector<int> z(n, 0);
    int l = 0, r = 0;
    for (int i = 1; i < n; i++) {
        if (i < r) z[i] = min(r-i, z[i-l]);
        while (i+z[i] < n && s[z[i]] == s[i+z[i]]) z[i]++;
        if (i+z[i] > r) { l=i; r=i+z[i]; }
    }
    return z;
}

// Pattern matching: find all occurrences of pattern in text
// Concat: pattern + '$' + text, check z[i] == pattern.size()
vector<int> findPattern(string pat, string txt) {
    string s = pat + '$' + txt;
    auto z = zFunction(s);
    vector<int> matches;
    int m = pat.size();
    for (int i = m+1; i < s.size(); i++)
        if (z[i] == m) matches.push_back(i - m - 1);
    return matches;
}` },
              { lang: 'Python', code: `def z_function(s: str) -> list[int]:
    n = len(s)
    z = [0] * n
    l = r = 0
    for i in range(1, n):
        if i < r:
            z[i] = min(r - i, z[i - l])
        while i + z[i] < n and s[z[i]] == s[i + z[i]]:
            z[i] += 1
        if i + z[i] > r:
            l, r = i, i + z[i]
    return z` },
            ],
          },
        ],
      },
    ],
  },
]
