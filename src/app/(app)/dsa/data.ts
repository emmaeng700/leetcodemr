export interface DSACard {
  id: string
  title: string
  description?: string
  snippets: { lang: string; code: string }[]
}

export interface DSACategory {
  name: string
  cards: DSACard[]
}

export const DSA_CATEGORIES: DSACategory[] = [
  {
    name: 'Binary Search',
    cards: [
      {
        id: 'bs-upper',
        title: 'Upper Middle (even → take upper)',
        description: 'For even-length arrays, takes the upper middle element.',
        snippets: [
          { lang: 'C++', code: `int search(vector<int>& nums, int target) {
    int n = nums.size(), l = 0, r = n - 1;
    while (l < r) {
        // for even number of elements, take the upper one
        int m = l + (r - l + 1) / 2;
        if (target < nums[m]) r = m - 1;
        else l = m;
    }
    return nums[l] == target ? l : -1;
}` },
          { lang: 'Java', code: `int search(int[] nums, int target) {
    int n = nums.length, l = 0, r = n - 1;
    while (l < r) {
        // for even number of elements, take the upper one
        int m = l + (r - l + 1) / 2;
        if (target < nums[m]) r = m - 1;
        else l = m;
    }
    return nums[l] == target ? l : -1;
}` },
        ],
      },
      {
        id: 'bs-lower',
        title: 'Lower Middle (even → take lower)',
        description: 'For even-length arrays, takes the lower middle element.',
        snippets: [
          { lang: 'C++', code: `int search(vector<int>& nums, int target) {
    int n = nums.size(), l = 0, r = n - 1;
    while (l < r) {
        // for even number of elements, take the lower one
        int m = l + (r - l) / 2;
        if (target > nums[m]) l = m + 1;
        else r = m;
    }
    return nums[l] == target ? l : -1;
}` },
          { lang: 'Java', code: `int search(int[] nums, int target) {
    int n = nums.length, l = 0, r = n - 1;
    while (l < r) {
        // for even number of elements, take the lower one
        int m = l + (r - l) / 2;
        if (target > nums[m]) l = m + 1;
        else r = m;
    }
    return nums[l] == target ? l : -1;
}` },
        ],
      },
    ],
  },
  {
    name: 'Bit Manipulation',
    cards: [
      {
        id: 'bit-submask',
        title: 'Sum of Submasks (SOS DP)',
        snippets: [
          { lang: 'C++', code: `template<typename T_out, typename T_in>
vector<T_out> submask_sums(int n, const vector<T_in> &values) {
    assert(int(values.size()) == 1 << n);
    vector<T_out> dp(values.begin(), values.end());
    for (int i = 0; i < n; i++)
        for (int base = 0; base < 1 << n; base += 1 << (i + 1))
            for (int mask = base; mask < base + (1 << i); mask++)
                dp[mask + (1 << i)] += dp[mask];
    return dp;
}` },
        ],
      },
      {
        id: 'bit-supermask',
        title: 'Sum of Supermasks',
        snippets: [
          { lang: 'C++', code: `template<typename T_out, typename T_in>
vector<T_out> supermask_sums(int n, vector<T_in> values) {
    reverse(values.begin(), values.end());
    vector<T_out> result = submask_sums<T_out>(n, values);
    reverse(result.begin(), result.end());
    return result;
}` },
        ],
      },
      {
        id: 'bit-largest',
        title: 'Largest Bit Set',
        snippets: [
          { lang: 'C++', code: `int largest_bit(int x) {
    return x == 0 ? -1 : 31 - __builtin_clz(x);
}` },
        ],
      },
      {
        id: 'bit-lowest',
        title: 'Lowest Bit Set',
        snippets: [
          { lang: 'C++', code: `int lowest_bit(int x) {
    return x & (-x);
}

// Index of lowest bit (1-based)
int lowest_bit_index(int x) {
    return __builtin_ffs(x);
}` },
        ],
      },
      {
        id: 'bit-enumerate',
        title: 'Enumerate All Submasks of a Mask',
        snippets: [
          { lang: 'C++', code: `for (int s = m; s; s = (s - 1) & m) {
    // use s
}` },
        ],
      },
    ],
  },
  {
    name: 'Euler Path',
    cards: [
      {
        id: 'euler-hierholzer',
        title: "Hierholzer's Algorithm",
        description: 'Finds Euler path/circuit in a directed graph. Used in Reconstruct Itinerary (LC 332).',
        snippets: [
          { lang: 'C++', code: `void euler(unordered_map<string, queue<string>>& g,
           string src, vector<string>& ans) {
    while (!g[src].empty()) {
        string nxt = g[src].front();
        g[src].pop();
        euler(g, nxt, ans);
    }
    ans.push_back(src);
}

// Usage (LC 332 - Reconstruct Itinerary)
vector<string> findItinerary(vector<vector<string>>& tickets) {
    vector<string> ans;
    sort(tickets.begin(), tickets.end(),
         [](const vector<string>& x, const vector<string>& y) {
             return x[1] < y[1];
         });
    unordered_map<string, queue<string>> g;
    for (auto x : tickets) g[x[0]].push(x[1]);
    euler(g, "JFK", ans);
    reverse(ans.begin(), ans.end());
    return ans;
}` },
        ],
      },
    ],
  },
  {
    name: 'Fenwick Tree (BIT)',
    cards: [
      {
        id: 'fenwick-bit',
        title: 'Binary Indexed Tree — 1-indexed',
        description: 'Supports point update and range sum query in O(log n). Also supports range update via difference array trick.',
        snippets: [
          { lang: 'C++', code: `template <class T>
struct BIT { // 1-indexed
    int n;
    vector<T> t;

    BIT() {}
    BIT(int _n) { n = _n; t.assign(n + 1, 0); }

    T query(int i) {
        T ans = 0;
        for (; i >= 1; i -= (i & -i)) ans += t[i];
        return ans;
    }

    void upd(int i, T val) {
        if (i <= 0) return;
        for (; i <= n; i += (i & -i)) t[i] += val;
    }

    // Range update [l, r]
    void upd(int l, int r, T val) {
        upd(l, val);
        upd(r + 1, -val);
    }

    // Range query [l, r]
    T query(int l, int r) {
        return query(r) - query(l - 1);
    }
};
// BIT<int> bit(n);` },
        ],
      },
    ],
  },
  {
    name: 'Graph Theory',
    cards: [
      {
        id: 'graph-preorder',
        title: 'Preorder Traversal',
        description: 'Visit root → left → right.',
        snippets: [
          { lang: 'C++', code: `void preorder(TreeNode* node) {
    if (node == NULL) return;
    // process node->val here
    preorder(node->left);
    preorder(node->right);
}` },
          { lang: 'Python', code: `def preorder(node):
    if node is None: return
    # process node.val here
    preorder(node.left)
    preorder(node.right)` },
        ],
      },
      {
        id: 'graph-inorder',
        title: 'Inorder Traversal',
        description: 'Visit left → root → right. Gives sorted order for BSTs.',
        snippets: [
          { lang: 'C++', code: `void inorder(TreeNode* node) {
    if (node == NULL) return;
    inorder(node->left);
    // process node->val here
    inorder(node->right);
}` },
          { lang: 'Python', code: `def inorder(node):
    if node is None: return
    inorder(node.left)
    # process node.val here
    inorder(node.right)` },
        ],
      },
      {
        id: 'graph-postorder',
        title: 'Postorder Traversal',
        description: 'Visit left → right → root.',
        snippets: [
          { lang: 'C++', code: `void postorder(TreeNode* node) {
    if (node == NULL) return;
    postorder(node->left);
    postorder(node->right);
    // process node->val here
}` },
          { lang: 'Python', code: `def postorder(node):
    if node is None: return
    postorder(node.left)
    postorder(node.right)
    # process node.val here` },
        ],
      },
      {
        id: 'graph-bfs',
        title: 'BFS (Breadth First Search)',
        description: 'Explore all closest nodes first before going deeper.',
        snippets: [
          { lang: 'Python', code: `def bfs(root, targetValue):
    if root is None: return None
    currentLevel = [root]
    while len(currentLevel) > 0:
        nextLevel = []
        for node in currentLevel:
            if node is None: continue
            if node.val == targetValue: return node
            nextLevel.append(node.left)
            nextLevel.append(node.right)
        currentLevel = nextLevel
    return None` },
        ],
      },
      {
        id: 'graph-bellman',
        title: 'Bellman-Ford Algorithm',
        description: 'Shortest paths from single source. Handles negative weights.',
        snippets: [
          { lang: 'C++', code: `template<typename T_a3, typename T_vector>
void bellman_ford(T_a3 &g, T_vector &dist, int src, int mx_edges) {
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
        ],
      },
      {
        id: 'graph-dijkstra',
        title: "Dijkstra's Algorithm",
        description: 'Shortest paths from single source. Non-negative weights only.',
        snippets: [
          { lang: 'C++', code: `template<typename T_pair, typename T_vector>
void dijkstra(T_pair &g, T_vector &dist, int start) {
    priority_queue<pair<int,int>, vector<pair<int,int>>,
                   greater<pair<int,int>>> pq;
    dist[start] = 0;
    pq.push({start, 0});
    while (!pq.empty()) {
        auto [u_node, u_cost] = pq.top(); pq.pop();
        if (u_cost > dist[u_node]) continue;
        for (auto [v_node, v_cost] : g[u_node]) {
            if (dist[v_node] > dist[u_node] + v_cost) {
                dist[v_node] = dist[u_node] + v_cost;
                pq.push({v_node, dist[v_node]});
            }
        }
    }
}` },
        ],
      },
      {
        id: 'graph-topo',
        title: 'Topological Sort (BFS)',
        description: 'Linear ordering of vertices in a DAG.',
        snippets: [
          { lang: 'C++', code: `struct TopologicalSort {
    int n, steps = 0, nodes = 0;
    vector<int> indegree, orders;
    vector<vector<int>> G;
    bool isTopologicalSorted = false;

    TopologicalSort(vector<vector<int>>& g, vector<int>& in) {
        G = g; n = G.size(); indegree = in;
        queue<int> q;
        for (int i = 0; i < n; i++)
            if (indegree[i] == 0) q.push(i);
        while (!q.empty()) {
            int sz = q.size();
            steps++; nodes += sz;
            for (int i = 0; i < sz; i++) {
                auto u = q.front(); q.pop();
                orders.push_back(u);
                for (auto v : G[u])
                    if (--indegree[v] == 0) q.push(v);
            }
        }
        isTopologicalSorted = nodes == n;
    }
};` },
        ],
      },
      {
        id: 'graph-kahn',
        title: "Kahn's Algorithm",
        description: 'Alternative topological sort. Returns empty if cycle detected.',
        snippets: [
          { lang: 'C++', code: `template<typename T_vector, typename T_vector_vector>
T_vector kahn(int n, T_vector_vector &edges) {
    vector<int> ordering, indegree(n, 0);
    vector<vector<int>> g(n);
    for (auto e : edges) {
        --e[0]; --e[1];
        indegree[e[1]]++;
        g[e[0]].push_back(e[1]);
    }
    queue<int> q;
    for (int i = 0; i < n; i++)
        if (indegree[i] == 0) q.push(i);
    int visited = 0;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        ordering.push_back(u);
        visited++;
        for (auto v : g[u])
            if (--indegree[v] == 0) q.push(v);
    }
    if (visited != n) return T_vector{};
    reverse(ordering.begin(), ordering.end());
    return ordering;
}` },
        ],
      },
      {
        id: 'graph-dsu',
        title: 'Disjoint Set Union (DSU / Union-Find)',
        description: 'Combines sets and checks connectivity in near O(1) per operation.',
        snippets: [
          { lang: 'C++', code: `class dsu {
public:
    vector<int> root, rank;
    int n, cnt;

    dsu(int _n) : n(_n) {
        root.resize(n); rank.resize(n);
        for (int i = 0; i < n; i++) { root[i] = i; rank[i] = 1; }
        cnt = n;
    }

    int getCount() { return cnt; }

    int get(int x) {
        return x == root[x] ? x : (root[x] = get(root[x]));
    }

    bool unite(int x, int y) {
        x = get(x); y = get(y);
        if (x == y) return false;
        if (rank[x] > rank[y]) root[y] = x;
        else if (rank[x] < rank[y]) root[x] = y;
        else { root[y] = x; rank[x]++; }
        cnt--;
        return true;
    }
};` },
        ],
      },
    ],
  },
  {
    name: 'Linked List',
    cards: [
      {
        id: 'll-floyd',
        title: "Floyd's Fast & Slow Pointer",
        description: 'Detects cycles and finds midpoints in linked lists.',
        snippets: [
          { lang: 'C++', code: `ListNode* slow = head;
ListNode* fast = head;
while (fast != nullptr && fast->next != nullptr) {
    // do something here
    slow = slow->next;
    fast = fast->next->next;
}` },
          { lang: 'Java', code: `ListNode slow = head, fast = head;
while (fast != null && fast.next != null) {
    // do something here
    slow = slow.next;
    fast = fast.next.next;
}` },
        ],
      },
    ],
  },
  {
    name: "Manacher's Algorithm",
    cards: [
      {
        id: 'manacher-main',
        title: 'Palindromic Substrings — All Centers',
        description: 'Finds all palindromic substrings in O(n). Converts even/odd cases by inserting # separators.',
        snippets: [
          { lang: 'Python', code: `def palindromicSubstrings(s: str) -> list[str]:
    if not s: return []
    # Insert # to handle even-length palindromes
    string = "#".join(s)
    pLengths = [0] * len(string)
    c = R = 0
    for i in range(len(string)):
        if i < R:
            pLengths[i] = min(R - i, pLengths[2 * c - i])
        while (i - pLengths[i] - 1 >= 0 and
               i + pLengths[i] + 1 < len(string) and
               string[i + pLengths[i] + 1] == string[i - pLengths[i] - 1]):
            pLengths[i] += 1
        if pLengths[i] + i > R:
            c, R = i, i + pLengths[i]
    result = []
    for i, p in enumerate(pLengths):
        s = string[i - p:i + p + 1].replace("#", "")
        if s: result.append(s)
    return result` },
          { lang: 'C++', code: `vector<string> palindromicSubstrings(string s) {
    if (s.empty()) return {};
    string str = "";
    for (int i = 0; i < (int)s.length() - 1; i++) {
        str += s[i]; str += "#";
    }
    str += s.back();
    int len = str.length();
    vector<int> pL(len, 0);
    int c = 0, R = 0;
    for (int i = 0; i < len; i++) {
        if (i < R) pL[i] = min(R - i, pL[2 * c - i]);
        while (i - pL[i] - 1 >= 0 && i + pL[i] + 1 < len &&
               str[i + pL[i] + 1] == str[i - pL[i] - 1])
            pL[i]++;
        if (pL[i] + i > R) { c = i; R = i + pL[i]; }
    }
    vector<string> res;
    for (int i = 0; i < len; i++) {
        string p = str.substr(i - pL[i], 2 * pL[i] + 1);
        string r = "";
        for (char ch : p) if (ch != '#') r += ch;
        res.push_back(r);
    }
    return res;
}` },
        ],
      },
    ],
  },
  {
    name: 'Ordered Set (PBDS)',
    cards: [
      {
        id: 'pbds-ordered',
        title: 'GNU C++ Policy-Based Ordered Set',
        description: 'O(log n) rank queries: order_of_key(k) = # elements < k, find_by_order(k) = k-th element.',
        snippets: [
          { lang: 'C++', code: `#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>
using namespace __gnu_pbds;

// less<int>  → ascending order set
// greater<int> → descending order set
// less_equal<int> → allows duplicates (multiset)
tree<int, null_type, less<int>, rb_tree_tag,
     tree_order_statistics_node_update> oset;

void usage() {
    oset.insert(5);
    // # elements strictly less than k
    int rank = oset.order_of_key(5);
    // k-th element (0-indexed)
    auto it = oset.find_by_order(0);
}` },
        ],
      },
    ],
  },
  {
    name: 'Prefix & Suffix Sum',
    cards: [
      {
        id: 'prefix-from-first',
        title: 'Prefix Sum (starts at index 0)',
        description: 'pref[i] = sum of a[0..i]',
        snippets: [
          { lang: 'C++', code: `vector<int> pref(n);
pref[0] = a[0];
for (int i = 1; i < n; i++)
    pref[i] = pref[i - 1] + a[i];

// Query sum [l, r]:
// l == 0 ? pref[r] : pref[r] - pref[l - 1]` },
        ],
      },
      {
        id: 'prefix-from-zero',
        title: 'Prefix Sum (1-indexed, starts at 0)',
        description: 'pref[i+1] = sum of a[0..i]. Clean range queries.',
        snippets: [
          { lang: 'C++', code: `vector<int> pref(n + 1, 0);
for (int i = 0; i < n; i++)
    pref[i + 1] = pref[i] + a[i];

// Query sum [l, r] (0-indexed):
// pref[r + 1] - pref[l]` },
        ],
      },
      {
        id: 'suffix-from-last',
        title: 'Suffix Sum (starts at last index)',
        description: 'suff[i] = sum of a[i..n-1]',
        snippets: [
          { lang: 'C++', code: `vector<int> suff(n);
suff[n - 1] = a[n - 1];
for (int i = n - 2; i >= 0; i--)
    suff[i] = suff[i + 1] + a[i];` },
        ],
      },
      {
        id: 'suffix-from-zero',
        title: 'Suffix Sum (1-indexed, starts at 0)',
        description: 'suff[i] = sum of a[i..n-1] with extra 0 at end.',
        snippets: [
          { lang: 'C++', code: `vector<int> suff(n + 1, 0);
for (int i = n - 1; i >= 0; i--)
    suff[i] = suff[i + 1] + a[i];

// Query sum [l, r] (0-indexed):
// suff[l] - suff[r + 1]` },
        ],
      },
    ],
  },
  {
    name: 'Segment Tree',
    cards: [
      {
        id: 'segtree-basic',
        title: 'Segment Tree — Range Sum + Point Update',
        description: 'O(log n) point update and range sum query.',
        snippets: [
          { lang: 'C++', code: `struct segtree {
    vector<long long> sums;
    int size;

    void init(int n) {
        size = 1;
        while (size < n) size *= 2;
        sums.assign(size * 2, 0LL);
    }

    void set(int i, int v, int x, int lx, int rx) {
        if (rx - lx == 1) { sums[x] = v; return; }
        int m = (lx + rx) / 2;
        if (i < m) set(i, v, 2*x+1, lx, m);
        else       set(i, v, 2*x+2, m, rx);
        sums[x] = sums[2*x+1] + sums[2*x+2];
    }
    void set(int i, int v) { set(i, v, 0, 0, size); }

    long long sum(int l, int r, int x, int lx, int rx) {
        if (lx >= r || l >= rx) return 0;
        if (lx >= l && rx <= r) return sums[x];
        int m = (lx + rx) / 2;
        return sum(l, r, 2*x+1, lx, m) + sum(l, r, 2*x+2, m, rx);
    }
    long long sum(int l, int r) { return sum(l, r, 0, 0, size); }
} st;

// Usage:
// st.init(n);
// st.set(i, val);          // point update
// st.sum(l, r + 1);        // range sum [l, r] (exclusive r)` },
        ],
      },
    ],
  },
  {
    name: 'Sparse Table',
    cards: [
      {
        id: 'sparse-table',
        title: 'Sparse Table — O(1) Range Queries',
        description: 'Static arrays only (no updates). Ideal for range min/max/gcd in O(1) after O(n log n) build.',
        snippets: [
          { lang: 'C++', code: `template<typename it, typename bin_op>
struct sparse_table {
    using T = typename remove_reference<decltype(*declval<it>())>::type;
    vector<vector<T>> t;
    bin_op f;

    sparse_table(it first, it last, bin_op op) : t(1), f(op) {
        int n = distance(first, last);
        t.assign(32 - __builtin_clz(n), vector<T>(n));
        t[0].assign(first, last);
        for (int i = 1; i < (int)t.size(); i++)
            for (int j = 0; j < n - (1 << i) + 1; j++)
                t[i][j] = f(t[i-1][j], t[i-1][j + (1 << (i-1))]);
    }

    // O(1) range query f(a[l..r])
    T query(int l, int r) {
        int h = floor(log2(r - l + 1));
        return f(t[h][l], t[h][r - (1 << h) + 1]);
    }
};

// Usage — range GCD:
// sparse_table g(a.begin(), a.end(), [](int x, int y){ return gcd(x, y); });
// g.query(l, r);` },
        ],
      },
    ],
  },
  {
    name: 'Two Pointers',
    cards: [
      {
        id: 'tp-converging',
        title: 'Two Pointers — Converging',
        description: 'l and r start at opposite ends and move toward each other.',
        snippets: [
          { lang: 'C++', code: `int f(vector<int>& v) {
    int ans = 0;
    int l = 0, r = (int)v.size() - 1;
    while (l < r) {
        // logic here
        if (/* condition */) l++;
        else r--;
    }
    return ans;
}` },
          { lang: 'Java', code: `int f(int[] v) {
    int ans = 0;
    int l = 0, r = v.length - 1;
    while (l < r) {
        // logic here
        if (/* condition */) l++;
        else r--;
    }
    return ans;
}` },
        ],
      },
    ],
  },
]
