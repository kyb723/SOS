# SOS Version 2 — refinement notes

保留原本 Next.js、TypeScript、Tailwind、localStorage adapter 同 SOS 視覺語言，冇加入新服務。

## 實作

`src/lib/scheduling.ts` 提供 reusable filtering、hours、availability coverage/status/warnings 同 duplicate validation。`src/app/availability-inbox.tsx` 將獨立 inbox 嘅歷史、員工同月份篩選集中處理。分店 palette 喺 CSS variables 宣告，`branchTone` 將英文分店代碼對應到 token scope。

原版已經將 availability 同 shifts 分開保存，冇排更後自動刪除嘅程式。今次保持呢個行為，另外將 inbox 同 rota filters 分開，確保歷史紀錄唔會因為睇緊另一間分店而消失。

新提交可選 `submittedAt`，舊紀錄繼續可讀，編輯唔會替舊紀錄虛構 timestamp。Storage key 仍係 `sos.demo.v1`。

## 驗證

- `npm run lint` 通過。
- `npm test`：25 tests passed，包括原本 12 tests 同新增 13 tests。
- `npm run build` 通過（含 TypeScript）。
- Production server Chromium browser checks：三分店顏色各異、staff 隱藏 draft、published/draft 工時分開、歷史不受 rota branch filter 影響、manager 員工／月份篩選、取消月份篩選、編輯多日提交、summary、防重複提交、shift overlap、outside-availability warning、班次新增／修改／刪除／發佈、刪更後提交仍保留、reload persistence、Staff 只管理本人。
- Desktop 1440px，同 375px／390px 手機寬度檢查；頁面冇橫向 overflow，rota 可獨立滑動。目視 screenshots。

## 限制與預覽

冇真實身份驗證，角色同員工切換仍係 simulation。Status 喺 Staff 模式只用 published shifts，避免洩漏 draft；Manager 模式包含 draft，唔係正式認可／批核狀態。

Scheduled hours 係完整班次時長，冇 break deduction。仍然唔支援跨午夜班次。冇多人同步。未於真實 iPhone Safari 或成功建立嘅 GitHub Codespace 驗證。

新 branch 為 `feat/sos-v2`；可以同 `feat/sos-prototype` 比較變更。GitHub Codespaces 如果仍然 Failed，需要該 Codespace creation log 去診斷，呢次修改唔代表已修復 GitHub provisioning。

本機先切換 branch，再 `npm install` 同 `npm run dev`，瀏覽器開啟 `http://localhost:3000`。Codespaces 使用 private forwarded port 3000。冇公開部署。
