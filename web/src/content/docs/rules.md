---
title: Folder Rules
description: 把資料夾綁定 profile，底下所有 repo 的 commit 自動用對身分。
---

Folder Rules 讓 profile 跟資料夾結構綁定。把 `~/code/work` 綁定工作 profile
之後，底下所有 repo 的 commit 自動用對身分——不用逐個 repo 設定，也不用擔心
忘記切換。只有想把某個 repo 的身分固定下來時，才需要額外執行 `rules apply`。

## 建立、解析、套用、修復規則

設定一次，之後只要在對的資料夾裡工作，commit 就自動用對身分。

### 綁定資料夾

```sh
gitface rules add ~/code/work work
```

把資料夾綁到 profile。之後這個資料夾底下的每個 repo，commit 都自動用 work 身分。

### 查看所有規則

```sh
gitface rules list
```

列出目前所有資料夾與 profile 的對應；規則多的時候可加 `--query` 過濾。

### 連健康狀態一起看

```sh
gitface rules list --health
```

列表同時檢查每條規則：profile 還在嗎、資料夾還在嗎，直接看到 pass／warn／fail。

### 查路徑命中哪條規則

```sh
gitface rules resolve ~/code/work/app
```

查某個路徑會命中哪條規則、用哪個 profile——懷疑規則沒生效時先跑這個。

### 固定 repo 身分

```sh
gitface rules apply ~/code/work/app
```

把命中的 profile 直接寫進這個 repo 自己的設定，適合想把身分固定住的 repo。

### 規則體檢

```sh
gitface rules doctor
```

總體檢：找出指向已刪 profile 的規則和消失的資料夾。

### 清除失效規則

```sh
gitface rules prune
```

清掉 doctor 找到的壞規則；連資料夾已消失的規則一起清，加 `--include-missing-directory`。

## 綁定讓規則自動生效，固定把身分寫死

大多數情況綁定就夠了；只有想讓某個 repo 不受之後規則變動影響時，才需要固定。

### 綁定：讓規則自動生效

```sh
gitface rules add ~/code/work work
```

綁定之後，`~/code/work` 底下的 repo 不需要逐一設定，commit 時自動使用 work
profile。日常用這個就夠。

### 固定：寫進單一 repo

```sh
gitface rules apply ~/code/work/repo-with-git
```

把命中的 profile 直接寫進這個 repo 自己的設定。之後就算資料夾規則改了，這個
repo 的身分也不會變。

## Rules 的解析順序

1. 讀出你設定過的所有資料夾規則。規則存在 Git 內建的設定機制裡，不需要任何背景程式。
2. 找出涵蓋目標路徑的規則；macOS 和 Windows 上大小寫不同也算符合。
3. 多條規則都符合時，路徑最深、最具體的那條獲勝，並確認它指向的 profile 還存在。
4. commit 時自動套用規則對應的身分；如果 repo 自己已經設定了身分，以 repo 自己的為準。
