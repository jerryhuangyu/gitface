# GitFace 使用者手冊（繁體中文）

本手冊是給「第一次使用 GitFace」的人，重點是照著做就能上手。  
如果你要查完整旗標與 JSON 輸出格式，請看 [CLI Reference](./cli.md)。

## 這個工具解決什麼問題

GitFace 用來管理多組 Git 身分（`user.name`、`user.email`、`user.signingkey`）：

- 你先把身分存成 profile（例如 `work`、`personal`）。
- 之後用 `gitface use <profile>` 一鍵切換。
- 預設只改目前 repo（`local` scope），降低誤改全域設定風險。

## 安裝與基本檢查

```bash
npm install --global gitface
gitface --version
gitface doctor
```

也可以不安裝，直接用：

```bash
npx gitface --help
```

`gitface doctor` 會檢查：

- Git 是否可用
- profile 儲存區是否可讀寫
- global Git identity 是否完整

若你在 CI 想把「警告也視為失敗」，可用：

```bash
gitface doctor --strict
```

## 先理解兩個概念

### 1) Profile

Profile 是你儲存的一組身分資料，例如：

- `name`: `work`（profile 名稱）
- `gitName`: `Work User`（Git `user.name`）
- `email`: `work@example.com`（Git `user.email`）
- `signingKey`: `ABC123`（可選）

### 2) Scope（套用範圍）

- `local`（預設）：只改目前 repo 的 `.git/config`
- `global`：改 `~/.gitconfig`
- `system`：改 system 級設定（通常需要較高權限）

## 5 分鐘快速上手

### 步驟 1：建立第一個 profile

互動式建立（會開啟提示）：

```bash
gitface new work
```

非互動式建立（適合腳本）：

```bash
gitface new work --git-name "Work User" --email "work@example.com"
gitface new work --git-name "Work User" --email "work@example.com" --dry-run
```

### 步驟 2：確認已儲存

```bash
gitface list
```

### 步驟 3：套用到目前 repo

```bash
gitface use work
```

### 步驟 4：確認目前身分

```bash
gitface current
```

小提示：直接輸入 `gitface`（不帶子命令）也會顯示目前身分。

## 常見使用情境

### 情境 A：工作/私人身份切換

```bash
gitface new work --git-name "Work User" --email "work@example.com"
gitface new personal --git-name "Jerry" --email "jerry@gmail.com"

gitface use work
gitface current

gitface use personal
gitface current
```

### 情境 B：先預覽，再套用（安全）

```bash
gitface use work --dry-run
gitface use work --dry-run --json
```

`--dry-run` 只顯示會改哪些 key，不會寫入 Git 設定。

建立 profile 也支援 dry-run，可先確認最終欄位與覆蓋狀態：

```bash
gitface new work --git-name "Work User" --email "work@example.com" --dry-run
gitface new work --git-name "Work User" --email "work@example.com" --dry-run --json
```

`new --dry-run` 不會建立或覆蓋 profile 檔案。

### 情境 C：切到全域設定

```bash
gitface use work --scope global
gitface current --scope global
```

### 情境 C-1：profile 太多時，用 query 縮小候選

```bash
gitface use --query work
```

- `--query` 會做不分大小寫子字串比對。
- 若只命中 1 個 profile，會直接套用（不進互動選單）。
- 若命中多個：
  - TTY 終端：進互動選單（只顯示命中項目）。
  - 非 TTY/CI：會失敗並提示你改用明確 `gitface use <name>`。

### 情境 D：編輯既有 profile

```bash
gitface edit work --email "new-work@example.com"
gitface edit work --unset-signing-key
gitface edit work --email "new-work@example.com" --dry-run
gitface edit work --email "new-work@example.com" --dry-run --json
```

如果不帶更新旗標，`gitface edit work` 會進入互動式編輯 UI。
`edit --dry-run` 只預覽最終欄位，不會修改 profile 檔案。

### 情境 E：複製、改名、刪除 profile

```bash
gitface clone work work-copy
gitface rename work-copy work-archive --dry-run
gitface rename work-copy work-archive
gitface rm work-archive
```

別名：

- `gitface rename` 也可用 `gitface mv`
- `gitface rm` 也可用 `gitface remove`
- `gitface list` 也可用 `gitface ls`
- `gitface rename --dry-run --json` 可先預覽是否會覆蓋目標 profile，再決定是否正式執行
- `gitface rename` 正式執行時會自動把參照舊名稱的 folder rules 遷移到新名稱

### 情境 F：備份與還原 profiles

匯出：

```bash
gitface export ./profiles-backup.json
```

匯入（先模擬）：

```bash
gitface import ./profiles-backup.json --dry-run
gitface import ./profiles-backup.json
```

如果 profile 同名，要覆蓋請加 `--overwrite`。

### 情境 G：依資料夾自動套用身份（rules）

加入規則：

```bash
gitface rules add ~/code/work work
gitface rules add ~/code/work work --dry-run
gitface rules add ~/code/work work --dry-run --json
```

查看規則：

```bash
gitface rules list
gitface rules list --query work
gitface rules list --limit 10 --json
```

移除規則：

```bash
gitface rules remove ~/code/work
gitface rules remove ~/code/work --dry-run
gitface rules remove ~/code/work --dry-run --json
```

解析某個目錄最終會命中的規則：

```bash
gitface rules resolve ~/code/work/monorepo
gitface rules resolve ~/code/work/monorepo --json
gitface rules resolve ~/code/work/monorepo --strict --json
```

依規則直接套用到目前（或指定）目錄：

```bash
gitface rules apply ~/code/work/monorepo
gitface rules apply ~/code/work/monorepo --dry-run --json
gitface rules apply ~/code/work/monorepo --json-envelope
gitface rules apply ~/code/work/monorepo --scope global --json
gitface rules apply ~/code/work/monorepo --strict --json
gitface rules apply ~/code/work/monorepo --fallback-profile work --json
gitface rules doctor --json
gitface rules doctor --strict --json
gitface rules prune --dry-run --json
gitface rules prune --dry-run --strict --json
gitface rules prune --dry-run --include-missing-directory --json
gitface rules prune --json
```

說明：

- rules 透過 Git `includeIf.gitdir` 寫在 global config。
- GitFace 會把目錄正規化成絕對路徑並加上結尾 `/`。
- 規則對「該資料夾與其子目錄內的 repo」生效。
- `rules add/remove --dry-run` 可先預覽結果，不會修改 global git config。
- `rules list` 會依目錄路徑排序；可用 `--query`（目錄或 profile 子字串）
  與 `--limit`（正整數）縮小輸出範圍。
- `rules resolve [directory]` 會回傳最具體（最長路徑前綴）命中的規則；
  未命中時會回傳 `unmatched`（不視為錯誤）。
- 在 macOS / Windows 上，`rules resolve` 與 `rules apply` 的目錄比對採不分大小寫；
  Linux 維持大小寫敏感。
- `rules resolve --strict` 會把 `unmatched` 或命中不存在 profile
  （`profileExists=false`）視為失敗並回傳 exit code `1`，適合 CI gate。
- `rules apply [directory]` 會直接以命中的規則套用 profile（等同 resolve + use）。
- `rules apply --dry-run` 只輸出預計變更，不會寫入 Git config。
- `rules apply --json-envelope` 會輸出統一 Result Envelope（含 `schemaVersion/durationMs/traceId`），建議 CI/agent 優先採用。
- `rules apply --fallback-profile <name>` 在 `unmatched` 時改套用指定 profile，
  適合新目錄第一次使用或 CI/agent 防呆。
- `rules apply --strict` 會把 `unmatched` 視為失敗並回傳 exit code `1`。
- `rules doctor` 可批次檢查規則健康度（profile 是否存在、目錄是否存在）。
- `rules doctor --strict` 會把 `warn`/`fail` 都視為失敗並回傳 exit code `1`，適合 CI gate。
- `rules prune` 會清除「指向不存在 profile」的失效規則，降低後續 `rules apply` 失敗率。
- `rules prune --dry-run` 可先預覽待清理清單，不會改動 global git config。
- `rules prune --strict` 可做 CI gate：
  - `--dry-run` 時，只要有候選（`summary.prunable > 0`）就回傳 exit code `1`。
  - 實際 prune 時，若有清理失敗（`summary.skipped > 0`）才回傳 exit code `1`。
- `rules prune --include-missing-directory` 可額外把「目錄已不存在」規則納入清理；建議先搭配 `--dry-run` 進行審核。

### 情境 H：啟用 Shell 補全（bash/zsh）

```bash
gitface completion snippet --shell zsh
gitface completion profiles --prefix wo --limit 5
gitface completion profiles --prefix wo --limit 5 --json
gitface completion profiles --prefix wo --limit 5 --json-envelope
```

說明：

- `completion profiles --prefix` 採不分大小寫前綴比對（例如 `wo` 可命中 `WorkAdmin`）。
- 預設 snippet 會帶 `--limit 50`，避免 profile 很多時補全輸出過大。
- `completion profiles --json` 會輸出結構化結果，方便 CI/agent 腳本：
  `{ "topic": "profiles", "prefix": "wo", "limit": 5, "count": 1, "names": ["work-admin"] }`。
- `completion profiles --json-envelope` 會輸出統一 Result Envelope（含 `schemaVersion/durationMs/traceId`），便於可觀測與回放：
  `{ "status": "success", "code": "COMPLETION_PROFILES_OK", "message": "Completion profiles resolved.", "data": { "topic": "profiles", "prefix": "wo", "limit": 5, "count": 1, "names": ["work-admin"] }, "errors": [], "meta": { "schemaVersion": "1.0.0", "durationMs": 2, "traceId": "..." } }`。

## JSON 模式（給自動化/CI）

以下命令支援 `--json`：

- `new`, `edit`, `list`, `use`, `current`, `doctor`
- `clone`, `rename`, `rm/remove`
- `export`, `import`
- `rules list/add/remove/resolve/apply/doctor`
- `rules prune`
- `completion profiles`

注意兩個常見限制：

1. `gitface new --json` 與 `gitface edit --json` 必須同時提供非互動更新旗標  
例如 `--git-name`、`--email`、`--signing-key`、`--unset-signing-key`。
2. `gitface use --json` 若未提供 profile，會先做候選解析（可搭配 `--query`）  
若唯一命中會直接套用；若 0 筆或多筆命中，會回傳 JSON 錯誤與 exit code `1`。  
`use --json` 成功結構為 `{ "status": "applied", "name": "...", "scope": "local", "hasChanges": true, "changes": [...] }`。  
`use --json` 的錯誤結構為 `{ "status": "error", "reason": "..." }`。
3. `gitface use --json-envelope` 會輸出統一 Result Envelope（含 `schemaVersion/durationMs/traceId`）  
成功範例：`{ "status": "success", "code": "USE_PROFILE_APPLIED", "message": "Profile applied to Git config.", "data": { "result": "applied", "scope": "local", "profile": { "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null }, "hasChanges": true, "changes": [...] }, "errors": [], "meta": { "schemaVersion": "1.0.0", "durationMs": 2, "traceId": "..." } }`。  
錯誤範例：`{ "status": "error", "code": "USE_PROFILE_SELECTION_FAILED", "message": "...", "data": null, "errors": [{ "code": "USE_PROFILE_SELECTION_FAILED", "message": "..." }], "meta": { "schemaVersion": "1.0.0", "durationMs": 1, "traceId": "..." } }`。
4. `gitface current --json-envelope` 會輸出統一 Result Envelope（含 `schemaVersion/durationMs/traceId`）  
成功範例：`{ "status": "success", "code": "CURRENT_IDENTITY_RESOLVED", "message": "Current Git identity resolved.", "data": { "gitName": "Work User", "email": "work@example.com", "signingKey": "ABC123", "scope": "global" }, "errors": [], "meta": { "schemaVersion": "1.0.0", "durationMs": 1, "traceId": "..." } }`。  
錯誤範例：`{ "status": "error", "code": "CURRENT_SCOPE_INVALID", "message": "Scope must be one of: local, global, system.", "data": null, "errors": [{ "code": "CURRENT_SCOPE_INVALID", "message": "Scope must be one of: local, global, system." }], "meta": { "schemaVersion": "1.0.0", "durationMs": 1, "traceId": "..." } }`。
5. `gitface list --json-envelope` 會輸出統一 Result Envelope（含 `schemaVersion/durationMs/traceId`）  
成功範例：`{ "status": "success", "code": "LIST_PROFILES_OK", "message": "Profiles listed successfully.", "data": { "profiles": [{ "name": "work", "gitName": "Work User", "email": "work@example.com", "signingKey": null, "createdAt": "...", "updatedAt": "..." }], "query": "wo", "sort": "updated", "limit": 10, "count": 1 }, "errors": [], "meta": { "schemaVersion": "1.0.0", "durationMs": 2, "traceId": "..." } }`。  
錯誤範例：`{ "status": "error", "code": "LIST_LIMIT_INVALID", "message": "Limit must be a positive integer.", "data": null, "errors": [{ "code": "LIST_LIMIT_INVALID", "message": "Limit must be a positive integer." }], "meta": { "schemaVersion": "1.0.0", "durationMs": 1, "traceId": "..." } }`。
6. `gitface rules apply --json-envelope` 會輸出統一 Result Envelope，並提供 `RULE_APPLY_APPLIED/RULE_APPLY_DRY_RUN/RULE_APPLY_UNCHANGED/RULE_APPLY_UNMATCHED` 成功碼與 `RULE_APPLY_SCOPE_INVALID/RULE_APPLY_FAILED` 錯誤碼，便於工作流分流與告警。
7. `gitface doctor --strict --json` 會在有 `warn` 或 `fail` 時回傳 exit code `1`，
   並在 JSON 內提供 `hasWarnings`/`hasFailures` 方便流程判斷。

## 資料存放位置

預設在系統 config 目錄下（macOS/Linux 通常是 `~/.config/gitface`）：

- profiles：`~/.config/gitface/profiles/<name>.json`
- identity include files：`~/.config/gitface/identities/<name>.gitconfig`

若有設定 `XDG_CONFIG_HOME`，會改用 `$XDG_CONFIG_HOME/gitface`。

## 常見錯誤與排除

### `Scope must be one of: local, global, system.`

`--scope` 只能是 `local`、`global`、`system` 其中之一。

### `'<name>' does not exist.`

該 profile 不存在。先用 `gitface list` 確認名稱，或先建立：

```bash
gitface new <name>
```

### `No profiles found. Run \`gitface new <name>\` to create one first.`

你執行了互動選單模式 `gitface use`，但目前沒有任何 profile。

### `Multiple profiles matched query \"<text>\". Re-run with an explicit profile name ...`

你在 `gitface use --query <text>` 命中多個 profile，且當前是非互動環境（例如 CI）。
請改成明確指定名稱，例如：

```bash
gitface use work-main
```

### `Non-interactive flags are required when using --json output mode.`

你在 `new --json` 或 `edit --json` 但沒有傳非互動旗標。  
請改成：

```bash
gitface new work --git-name "Work User" --email "work@example.com" --json
```

### `Invalid format: expected an array of profiles.`

`import` 檔案內容必須是 JSON 陣列，且每筆是 profile snapshot。

### `not a git repository`

你在非 Git repo 使用 `local` scope（例如 `gitface use work`）。  
可改成：

- 先在目錄執行 `git init`
- 或改用 `--scope global`

## 建議日常流程

1. 建立並維護 `work` / `personal` 兩組 profile。  
2. 每次進 repo 後先 `gitface current` 檢查。  
3. 切換前先 `gitface use <name> --dry-run`，確認再套用。  
4. 每週或每月做一次 `gitface export` 備份。  
5. 用 `gitface rules` 讓常用資料夾自動帶入對應身份。
