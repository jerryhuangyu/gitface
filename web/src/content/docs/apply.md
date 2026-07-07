---
title: 套用與檢查
description: gitface use 預設只改目前 repo；搭配 current 確認生效身分、doctor 排查環境問題。
---

套用 profile 時，GitFace 預設只改目前 repo。`gitface use` 預設只寫進目前
repo 的設定，不會不小心改到全域身分。搭配 `current` 隨時確認生效身分、
`doctor` 排查環境問題。

## 切換、確認、排錯

日常會做的三件事都在這一頁：套用 profile、看目前生效的身分、環境有問題時排查。

### 套用到目前 repo

```sh
gitface use work
```

把 `work` 的名稱和 email 寫進目前這個 repo 的設定，其他專案不受影響。

### 套用到整台機器

```sh
gitface use work --scope global
```

讓整台機器預設都用這組身分，適合平常只用一個身分的人。

### 用關鍵字找再套用

```sh
gitface use --query work
```

記不得完整名稱時用關鍵字找：只有一個符合就直接套用，多個符合會列出來讓你選。

### 看目前生效身分

```sh
gitface current
```

顯示在目前位置 commit 會用的身分；直接輸入 `gitface` 不帶子命令也是同樣效果。

### 指定範圍檢查

```sh
gitface current --scope global
```

只看指定 scope 的設定，方便分辨身分是 repo 自己設的、還是從全域繼承來的。

### 環境體檢

```sh
gitface doctor
```

覺得哪裡不對勁時先跑這個：檢查 Git 能不能用、profile 存放區正不正常、全域身分設定完不完整。

## 套用時的安全邏輯

1. 先讀取 profile 內容和目前實際生效的身分設定。
2. 比對出真正需要改的項目，沒有差異的設定不會被碰。
3. 寫入中途出錯時，會還原成套用前的設定，不會停在改一半的狀態。
