---
title: JSON 與自動化
description: 結構化輸出、副作用控制、備份遷移與 completion，適合 dotfiles、CI jobs 和 agent。
---

所有機器介面，集中在這一頁。其他頁面以互動使用為主；要把 GitFace 放進 CI、
dotfiles、腳本或 agent 的話，這裡是完整介面：`--json` 與 `--json-envelope`
拿結構化輸出，`--dry-run`、`--strict`、`--atomic` 控制副作用。

## 腳本、備份、completion

這一組命令適合放進 dotfiles、CI jobs、developer bootstrap 和 shell startup。

### Result Envelope

```sh
gitface use work --dry-run --json-envelope
```

回傳 `status`、`code`、`message`、`data`、`errors`、`meta` 的統一格式。

### Export backup

```sh
gitface export ./profiles-backup.json
```

把所有 profile snapshot 輸出成 prettified JSON array，方便版本備份或跨機器搬移。

### Import dry-run

```sh
gitface import ./profiles-backup.json --dry-run --strict --json-envelope
```

先驗證匯入檔與重複 profile；strict 會讓任何失敗以 exit code 1 呈現。

### Atomic import

```sh
gitface import ./profiles-backup.json --atomic --overwrite --json
```

正式匯入前做全檔 precheck；任一 entry 失敗時不寫入任何 profile。

### Zsh completion

```sh
eval "$(gitface completion snippet --shell zsh)"
```

產生與目前版本同步的 completion snippet，可放進 `~/.zshrc`。

### Completion data

```sh
gitface completion profiles --prefix wo --limit 5 --json
```

從 profile filename index 取得建議，避免壞掉的 profile JSON 阻塞 completion。

### CI identity gate

```sh
gitface current --json-envelope
```

在 build 前紀錄有效 Git identity，讓 log 中有 schemaVersion、durationMs 和 traceId。

### Rule gate

```sh
gitface rules resolve . --strict --json-envelope
```

確保目前資料夾有匹配 rule 且 profile 存在；不符合就讓 CI fail fast。

### Environment gate

```sh
gitface doctor --strict --json-envelope
```

把 warning 視為失敗，以統一 envelope 回傳 code、message、errors 和 meta。

### Bootstrap fallback

```sh
gitface rules apply . --fallback-profile personal --json
```

沒有 matching rule 時改用指定 profile，適合 bootstrap 腳本的保底行為。

## 何時用 JSON 或 Result Envelope

| 旗標 | 適合情境 |
| --- | --- |
| `--json` | 簡短腳本，只需要 command-specific payload，例如 list rows、dry-run changes 或 import summary。 |
| `--json-envelope` | CI、agent、observability。格式固定，包含錯誤陣列、traceId、durationMs 和 schemaVersion。 |
