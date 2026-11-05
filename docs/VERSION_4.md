# SOS Version 4 — rota management workflow

## 介面同操作

主頁移除 Availability Inbox 同 Room for a better rhythm，資料冇刪除。Availability → **View / edit complete availability history** 仍然可以揀員工、月份、睇所有提交、編輯或移除。Staff 只會見到目前 Preview as 員工嘅紀錄；仍然係 simulation，唔係真正身份驗證。

Manager action bar 順序係 **Availability | Add shift | + SH | Publish Rota**；手機排成兩欄。SH 圖例放最後，label 只係 SH，唔再顯示 zero hours；計算邏輯仍然排除 SH。

Desktop 點 `Av · Add shift`，會預填員工、日期、合法分店同時間。已排更嘅格仍然保留 availability 同 Review / edit submission。手機冇工作更嘅 Av 格可直接開 Add Shift；已有工作更就點格開完整 details，再按 **Add shift from availability**。Staff 可以喺自己嘅 availability 格／details 入面編輯，或者由 history 管理。

手機七日表直接顯示開始、完結時間同 ST／CSW／SW，工作更唔再重複 Live；Draft 仍有 D 同虛線。多個工作更會顯示首個同 +N，點擊見晒全部。月工時、分店顏色同 SH 都保留。

## 硬性排更規則

`validateScheduledShift` 係新增、編輯、全月發佈共同使用嘅驗證，唔只靠 dropdown 或 input min/max：

- 必須有該員工該日期嘅 availability。
- 分店必須屬於該提交。
- 整個班次必須落喺同一筆提交嘅同一段時間內；唔可以將幾筆提交嘅時間或分店拼接。
- 包括 draft、published，同跨分店嘅時間重疊均被阻止；SH 全日衝突規則保留。

All-day 使用 `src/lib/rota-config.ts` 明確設定嘅 **prototype operating hours**：ST 08:00–20:00、CSW 08:00–20:00、SOHO W 09:00–22:00。呢啲係示範設定，唔代表真實店舖營業時間，可喺檔案修改。自訂時間提交用該筆明確時間。Add Shift 嘅 Permitted availability interval 列出每組可用分店／時間，可以切換。

舊資料仍用 `sos.demo.v1`，冇 schema migration、刪更或虛構 availability。唔符合新規則嘅舊更由 Manager 見到 Invalid／! 同月份提示；保留原有 published 狀態。修正方法係補交正確 availability 或編輯／明確刪除班次。原有 sample data 亦可能因此被標示 invalid；Reset 唔係修正資料嘅替代品。

## 全月發佈

Publish Rota 顯示目前月份同所有分店 draft 總數，唔受 branch filter 影響。按下打開確認窗，列出範圍；任何該月 invalid working draft 或 invalid SH draft 都會阻止整批發佈，列出員工／日期／分店／時間及原因。唔會自動略過壞資料去發佈其餘更。

確認時重新計算驗證結果，再一次寫入完整 localStorage snapshot，寫入成功先更新 React state。儲存失敗時畫面同已存 rota 都唔會部分發佈，確認窗顯示失敗並可重試。其他月份同原有 published items 保留。

已發佈工作更／SH 嘅編輯會有額外確認，唔會一按儲存就無提示改動 Staff 所見班次。可以明確改回 draft；Prototype 冇另存一份已發佈版本或修訂審批。

呢個係同一 browser tab 嘅單 key all-or-nothing update，**唔係多人／多分頁資料庫 transaction**，唔解決多部機或多個 tab 同時寫入嘅 race condition。Availability 被修改或移除後，舊班次可能變成 invalid，仍然保留作修正；舊 published 更唔會被自動撤回。

## 驗證結果

- `npm run lint`：通過。
- `npm test`：48 tests passed，包括新增 10 tests：strict scheduling、all-day 設定、多段時間／分店不可拼接、跨分店 overlap、整月發佈、invalid block、published legacy preservation、SH 衝突。
- `npm run build`：TypeScript 同 production build 通過。
- `npm run test:browser`：包含 V3 regression 同 V4 workflow 兩套 Chromium scenarios。驗證點 Av 預填、branch options、時間限制、手動 Add Shift、DOM 篡改選項後仍拒絕非法分店、重疊、availability 保留、invalid draft block、ST filter 下仍發佈全月全分店、localStorage 儲存失敗／重試、保留其他月份、published edit confirmation、Staff visibility、history editing、SH 圖例最後、375／390px 七欄同直接顯示時間。
- 已目視 desktop 同手機 screenshots。冇真實 iPhone Safari／WhatsApp browser 測試，亦冇取得截圖紅色 Next.js issue badge 嘅詳細 stack；badge 數量本身唔足以判斷錯誤來源。Production browser tests 冇 uncaught page errors。

Browser tests 使用獨立瀏覽器 context，唔改你平時使用嘅 localStorage。需要 Playwright Chromium（已有 `/usr/bin/chromium` 會自動使用）。

```bash
npm install
npx playwright install chromium
npm run build
npm start -- --port 3002
```

另一 terminal：

```bash
npm run test:browser
```

可用 BASE_URL 指定其他本機 port，或 CHROMIUM_PATH 指定 browser executable。

## iPhone 試用

喺現有 checkout 切換到 `feat/sos-v4`（先保留自己未 commit 嘅改動）：

```bash
git fetch origin
git switch feat/sos-v4
npm install
npm run dev
```

Codespaces 用 Ports 面板嘅 private forwarded URL，iPhone 登入同一個 GitHub 帳戶後開啟；URL 相同時 localStorage 會保留。唔需要先 Reset。

如用自己電腦，iPhone 同電腦連同一 Wi-Fi，再開 `http://電腦區域網絡IP:3000`。只係本機網絡預覽，唔需要公開部署。

可以先切換到一個冇舊 draft 嘅月份，提交 availability，再從 Av 建立工作更／SH，測試整月發佈。現有月份如有 invalid drafts，先按提示修正；呢個係新規則預期行為。

仍然冇 Supabase、真實登入、paid services、跨午夜工作更或 break deductions。SH 只作記錄，唔計法定權益／假期薪酬。
