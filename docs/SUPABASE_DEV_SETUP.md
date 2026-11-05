# sos-rota-dev — migration review 同 Codespaces 設定

Project：**sos-rota-dev**，region：**Singapore**。排更 business timezone 繼續係 **Asia/Hong_Kong**。

本次已喺 Codex checkout 建立 `.env.local`，填入你提供嘅 project URL 同 publishable key，檔案被 Git 忽略，權限為 owner read/write。**呢個檔案唔會隨 git push 去你嘅 Codespace**，你需要依下面步驟喺 Codespaces 自己建立。

共享模式有明確開關 `SOS_SHARED_ENABLED=false`。即使 URL／key 已填妥，預設都唔會啟用 shared routes／Supabase session refresh；V4 demo 繼續運作。呢個開關係 setup 控制，唔係安全權限替代品；啟用後仍有 server authorisation、SQL GRANT 同 RLS。

## 現時狀態與批准界線

- 冇執行任何遠端資料庫命令、migration、seed、角色審批或破壞性操作。
- 冇讀取／修改你嘅線上資料，也冇改動 browser localStorage demo data。
- Migration 已閱讀及喺隔離 PostgreSQL 測試；未代表已套用到 sos-rota-dev。
- **套用任何遠端 SQL 前需要你明確批准。** Publishable key 唔係 database admin credential，唔可以用嚟執行 migration；唔需要喺對話提供 database password 或 service-role key。

## 已 review 嘅 migration

| 檔案                                         | 變更                                                                                                    | Review 結果                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `supabase/migrations/202611050001_sos.sql`   | SOS tables、FK／constraints、最少 GRANT、RLS、schedule integrity、revision locking、monthly publish RPC | 新建 SOS namespace；RLS 明確啟用；冇 anon table／RPC 權限；角色／ownership 由 DB 驗證 |
| `supabase/migrations/202611050002_admin.sql` | 建立 org／分店／SH codes，同批准 invited member 嘅 admin helpers                                        | 冇 authenticated／anon EXECUTE；只供受信任 SQL Editor／DB owner                       |

Review 對應嘅 SHA-256：

```text
202611050001_sos.sql
66a2aec088a015eb0c2d4ba8e3bb9bfce1dc9d3c62ffdb58553ab7724974ff7f
202611050002_admin.sql
4d7d3f4c23f3678ed7db8e9402d131a832c8996fe8e8b1cf04ba139d969744fa
```

Migrations 同 V5 原本版本一致，今次冇更改 SQL 內容。如果你已經執行過，唔好再重跑；先檢查 migration history／現有 SOS objects。若有同名 schema、table 或 function，migration 會停止，**唔可以用 DROP 或停用 RLS 當作修復**。

權限重點：

- `authenticated` 有同組織資料 SELECT，RLS 再按 active membership 限制。
- Availability 只有 owner 可以寫；經理亦不可代改。`submitted_at`、owner、org 冇 UPDATE grant。
- Availability child rows 只授權 RPC 用到嘅 INSERT／DELETE，唔開多餘 UPDATE。
- 工作更／SH 只有 Manager 可以寫；Staff 只讀 published。
- Membership、profile、branch config、publication audit、revision 冇普通用戶直接寫入權限。
- Transaction／trigger 會檢查 availability、跨分店 overlap、SH，同 stale revision；唔係只靠 UI。
- `SECURITY DEFINER` 只限已 review 嘅 helpers／manager publication，有明確 auth／org／role 檢查同固定 search_path。普通 changes RPC 用 SECURITY INVOKER，仍受 RLS 約束。

另有 `supabase/review/verify_permissions.sql`，只包含 read-only catalog checks。**唔係 migration，亦未遠端執行**；獲批准套用 migrations 後，可用 SQL Editor 核對 RLS／GRANT／policy。真實三帳戶測試仍必須另外做。

## Codespaces：何時及如何設定環境變數

### 階段 A：先更新程式，保持 shared mode 關閉

1. 喺 Codespaces terminal 停止舊 server：按 **Ctrl+C**。
2. 保留自己未 commit 嘅修改，再喺 repository 根目錄執行：

```bash
git fetch origin
git switch feat/sos-v5-setup
npm install
```

3. 睇 Explorer：如果已有 `.env.local`，先保留，唔好直接覆寫。如果未有：

```bash
cp -n .env.example .env.local
```

4. 喺 VS Code Explorer 開啟根目錄 `.env.local`，填入你已提供嘅 URL 同 publishable key。**唔係改 `.env.example`**，亦唔係新增喺 `src` 入面：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
SOS_SHARED_ENABLED=false
SOS_APP_ORIGIN=https://YOUR-CODESPACE-3000.app.github.dev
```

上面只係 placeholders，請用你嘅實際值，唔好將 placeholders 當 key。`SOS_APP_ORIGIN` 係 Ports 面板 port 3000 嘅實際 private forwarded URL，移除最後 `/` 同任何路徑；唔好用 Supabase URL 代替。

5. 執行 `npm run dev`。喺 Ports 面板保持 **Private**，用 Open in Browser 開啟 `/`。此時應可試 V4 demo；`/login` 顯示 shared mode 尚未啟用。唔需要 Reset，亦唔應清除舊 localStorage。
6. 核對 `.env.local` 冇被 Git 追蹤：

```bash
git check-ignore .env.local
git status --short
```

第一行應顯示 `.env.local`；第二個結果唔應列出 `.env.local`。唔好執行 `git add -f .env.local`。URL／publishable key 今次亦唔會寫入 GitHub 文件；只有 placeholder example 被 commit。

### 階段 B：先批准／套用 SQL，再啟用 shared mode

1. 先 review 上面兩份 SQL，同意套用到 sos-rota-dev 後，再由獲授權嘅管理員執行，或另行明確批准可用嘅遠端管理流程。**本次冇代你執行。**
2. 按 [Version 5](VERSION_5.md) 步驟確認 Data API `public` schema、建立測試 org、邀請一位 Manager 同兩位 Staff、批准 membership。Automatic table exposure 可繼續關閉；automatic RLS 維持開啟。唔 expose `sos_private`。
3. Supabase Auth Site URL 設為同一個 Codespaces HTTPS origin，邀請 template 使用 `/auth/confirm`。如果 Codespace 重建而 URL 改變，要同步更新 Auth 設定同 `SOS_APP_ORIGIN`。
4. Migration、權限同帳戶 setup 完成後，先修改 `.env.local`：

```dotenv
SOS_SHARED_ENABLED=true
```

5. 再按 **Ctrl+C** 停 server，重新 `npm run dev`。環境變數唔會靠 refresh 網頁自動更新；`NEXT_PUBLIC_*` 亦可能喺 build 時寫入 bundle，production 請重新 `npm run build` 再啟動。
6. 開 `/login` 登入，再到 `/team`，以三個獨立 browser sessions 測試。完整測試清單見 Version 5 第 6 節。唔會自動將 demo 資料匯入 PostgreSQL。

## 環境與限制

- `.env.local` 係每個 Codespace／checkout 嘅 local file；換 Codespace 要重新設定。唔會因為 GitHub branch 有更新而自動帶過去。
- 本次只儲存 publishable key，唔使用 service-role／secret key。程式會拒絕特權 key。
- 冇公開部署，冇新增付費服務，冇改動你嘅 demo records。
- 隔離 SQL tests 唔會連接你嘅 Supabase。實際 remote schema、Supabase Auth、email、三帳戶跨手機同步同真實 iPhone Safari，仍未驗證。
