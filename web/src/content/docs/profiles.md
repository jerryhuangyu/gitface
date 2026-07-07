---
title: Profiles 生命週期
description: 一個 profile，就是一組可重複使用的 Git 身分。建立、查詢、修改、複製、改名、刪除。
---

一個 profile，就是一組可重複使用的 Git 身分：包含顯示名稱、email 和可選的
signing key，存在你的電腦裡。建立一次，之後在任何 repo 都能用 `gitface use`
套用。這一頁涵蓋 profile 的完整生命週期：建立、查詢、修改、複製、改名、刪除。

## 建立、維護、清理 profiles

日常維護都在這裡：想逐步確認就用互動介面，已經知道要改什麼就一行帶旗標。

### 互動建立

```sh
gitface new work
```

一步步問你名稱和 email，用目前的 Git 設定預填，照著確認就好。

### 一行建立

```sh
gitface new oss --git-name "Open Source" --email "oss@example.com"
```

已經知道欄位值時，一行建立、不開精靈；缺的欄位會從目前 Git 設定補上。

### 列出所有 profiles

```sh
gitface list
```

列出所有 profiles，依最近更新排序。profiles 多的時候可加 `--query` 過濾名稱。

### 編輯 profile

```sh
gitface edit work
```

開啟互動編輯逐欄修改。只改單一欄位也可以直接帶旗標，例如 `--email`。

### 移除 signing key

```sh
gitface edit work --unset-signing-key
```

移除 profile 裡的 signing key；下次套用時，repo 設定的 signing key 也會一併清掉。

### 複製 profile

```sh
gitface clone work work-copy
```

以現有 profile 為底建立副本，名稱、email、signing key 全部帶過去，適合先複製再微調。

### 改名

```sh
gitface rename work-copy work-archive
```

改名時會一併把引用這個 profile 的 folder rules 遷移到新名稱，不會留下斷掉的規則。

### 刪除 profile

```sh
gitface rm work-archive
```

刪掉存放的 profile 檔；已經套用到各 repo 的 Git 設定不會被動到。

## Profile 儲存位置

- **存放位置**：每個 profile 一個檔案：`~/.config/gitface/profiles/<profile>.json`，可以直接打開看。
- **自訂位置**：想換地方存，設定 `$XDG_CONFIG_HOME` 即可，profiles 會跟著搬到對應目錄。
- **寫入保證**：更新不會寫到一半壞掉；就算中途中斷，原本的內容也會完整保留。
