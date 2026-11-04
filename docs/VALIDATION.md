# Prototype validation

本次喺 Codex cloud environment 驗證，使用 Node.js 24、npm 11 同本機 Chromium，冇公開部署。

## 通過

- `npm install`：完成並產生 `package-lock.json`。
- `npm run lint`：冇 error 或 warning。
- `npm test`：12 tests passed。
- `npm run build`：TypeScript 同 production build 通過。
- `npm run dev`：成功啟動，瀏覽器收到正常頁面。
- Chromium 1440px desktop／390px iPhone-width rendering：六位員工，月曆獨立橫向捲動，整頁冇水平溢出。
- 真實 browser interaction：Staff Demo published-only；Manager create/edit/delete；跨分店重疊 validation；draft publish；refresh 後 localStorage 保留；多日、全日、多分店 availability；branch filter；previous/next month；Escape 關閉 dialog；reset；冇 uncaught page errors。
- 已目視 desktop、mobile 同 mobile availability dialog 截圖。

## 環境相關

Codex command sandbox 預設唔容許開 local port，直接 build／dev 最初遇到 `EPERM`。用獲准嘅執行方式後通過，唔係 app build error。GitHub Codespaces 正常唔需要呢個額外步驟。

Skill 主文件可讀，Taste app-screen reference 可讀；cloud skill 附屬 scripts 同 Impeccable 部分 reference 無法讀取，冇執行佢哋專用 inspector／launcher。

## 未驗證

真實 iPhone Safari、真正多人使用、雲端同步、fresh Codespace restoration 同 Supabase integration 未驗證。以上測試唔代表正式權限驗證或 production security review。
