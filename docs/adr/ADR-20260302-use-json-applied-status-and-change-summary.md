# ADR-20260302: `gitface use --json` 成功輸出加入 `status` 與變更摘要

## Context

`gitface use` 是 GitFace 最核心的切換流程，且 automation/CI 常以 `--json` 解析結果。

目前 `use --json` 的輸出存在契約不對稱：

- 成功套用時回傳 `{ name, gitName, email, signingKey, scope }`（沒有 `status`）。
- no-op 時回傳 `{ status: "unchanged", ... }`。
- 失敗時回傳 `{ status: "error", reason }`。
- dry-run 時回傳 `{ status: "dry-run", hasChanges, changes, ... }`。

這使 automation 端需要額外分支判斷「成功但沒有 `status`」的特例，也無法直接取得「實際寫入了哪些 key」的可觀測資訊。

本輪 baseline（2026-03-02，本機）：

- `pnpm run typecheck` 通過，`real 0.75s`
- `pnpm run lint` 通過，`real 0.25s`
- `pnpm run test` 通過，`19 files / 145 tests`，`real 13.97s`
- `pnpm run build` 通過，`real 0.91s`
- Coverage：Statements `73.98%` / Branches `60.13%` / Functions `79.53%` / Lines `74.14%`
- Build 產物：`dist/index.mjs 145.16 kB (gzip 28.49 kB)`

## Decision

在不破壞既有欄位的前提下，擴充 `gitface use --json` 的成功輸出為：

- `status: "applied"`（與 `error` / `unchanged` / `dry-run` 對齊）
- `hasChanges: true`
- `changes: UseChangeStep[]`（包含 `key/action/before/after`）

保留既有欄位 `name/gitName/email/signingKey/scope`，以維持向後相容。

MVP 僅調整 `use --json` 成功 payload、相關測試與文件，不引入新 flag。

## Alternatives Considered

1. 維持現狀（成功不含 `status`）

- 優點：零改動成本。
- 缺點：JSON 契約不一致，automation 解析成本持續累積。

2. 僅新增 `status: "applied"`，不提供 `changes`

- 優點：改動最小。
- 缺點：仍缺乏「實際寫入差異」觀測資訊，腳本若要記錄變更仍需額外自行比對。

3. 另開新 flag（例如 `--json-v2`）

- 優點：可完全避免任何現有解析器影響。
- 缺點：命令複雜度上升、文件與維護成本增加，且延後一致化價值兌現。

## Consequences

正面：

- `use --json` 各狀態都有 `status`，machine-readable 契約一致。
- 成功結果直接附帶 `changes`，便於 audit log 與自動化觀測。
- 保留原欄位，既有消費端通常可無痛升級。

負面與風險：

- 極少數若使用「嚴格等值比對完整 JSON」的舊腳本，可能因新增欄位而失敗。
- 需同步更新 README/CLI 文件，避免範例與實際輸出不一致。

遷移與回滾：

- 遷移：建議消費端改以 `status` 驅動流程，並容忍附加欄位。
- 回滾：revert 本次 commit 即可回復舊 payload。

## Rollout Plan

1. 更新 `use` 輸出函式，成功 payload 增加 `status/hasChanges/changes`。
2. 調整 `use` action 將既有變更計畫傳給成功 JSON 輸出。
3. 補齊單元與 e2e 測試斷言（成功 JSON 契約）。
4. 更新 README、`docs/cli.md`、`docs/user-manual.zh-TW.md`。
5. 執行 `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build`。

## Test Plan

- 單元/動作測試：
  - `runUseAction` 在 `--json` 成功路徑回傳 `status: "applied"`。
- E2E：
  - `gitface use <profile> --json` 回傳 `status/hasChanges/changes`，且 Git 設定確實變更。
  - 既有 `unchanged`、`dry-run`、`error` JSON 契約不回歸。
- 回歸：
  - 非 JSON 模式輸出維持不變。
  - `--query` / `--scope` / rollback 路徑維持既有行為。

## Observability

利用 JSON 輸出可直接觀測：

- `use_json_status_applied_count`
- `use_json_change_count`（`changes.length`）
- `use_json_applied_key_distribution`（`user.name/email/signingkey`）

目前專案未內建 telemetry；先透過 CLI JSON 與測試驗證作為觀測來源。

## Security/Privacy

- 不新增權限與外部網路存取。
- 僅輸出原本已可由 dry-run 取得的 Git identity 差異資訊，未擴增敏感資料範圍。

## Open Questions

- 是否要在下一輪為所有 JSON 輸出加入統一 `schemaVersion` 欄位，提升跨版本可演進性？
