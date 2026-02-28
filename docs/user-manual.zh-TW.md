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

### 情境 C：切到全域設定

```bash
gitface use work --scope global
gitface current --scope global
```

### 情境 D：編輯既有 profile

```bash
gitface edit work --email "new-work@example.com"
gitface edit work --unset-signing-key
```

如果不帶更新旗標，`gitface edit work` 會進入互動式編輯 UI。

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

說明：

- rules 透過 Git `includeIf.gitdir` 寫在 global config。
- GitFace 會把目錄正規化成絕對路徑並加上結尾 `/`。
- 規則對「該資料夾與其子目錄內的 repo」生效。
- `rules add/remove --dry-run` 可先預覽結果，不會修改 global git config。
- `rules list` 會依目錄路徑排序；可用 `--query`（目錄或 profile 子字串）
  與 `--limit`（正整數）縮小輸出範圍。

## JSON 模式（給自動化/CI）

以下命令支援 `--json`：

- `new`, `edit`, `list`, `use`, `current`, `doctor`
- `clone`, `rename`, `rm/remove`
- `export`, `import`
- `rules list/add/remove`

注意兩個常見限制：

1. `gitface new --json` 與 `gitface edit --json` 必須同時提供非互動更新旗標  
例如 `--git-name`、`--email`、`--signing-key`、`--unset-signing-key`。
2. `gitface use --json` 必須提供 profile 名稱  
例如 `gitface use work --json`。`gitface use --json` 會失敗。
3. `gitface doctor --strict --json` 會在有 `warn` 或 `fail` 時回傳 exit code `1`，
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
