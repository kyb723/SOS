# SOS Version 5 — Supabase shared workspace

呢版保留 V4，新增共享資料庫同真實登入路徑。**程式已準備，但本次未取得你嘅 Supabase URL／publishable key／項目操作權限，所以未連接或修改你嘅線上資料庫。** 請先完成下面 SQL migration 同帳戶設定，再使用 `/team`。唔好停用 RLS 去解決 permission denied。

## 1. 先備份，保留 demo

- V4 原始碼保留喺 `feat/sos-v4`／commit `d15c376`，V5 用獨立 `feat/sos-v5`。
- 開啟 `/` demo，按 **Export demo backup** 下載 JSON，自己安全保存，唔需要貼上對話。
- `sos.demo.v1` localStorage key 同 schema 保持不變。V5 冇自動匯入、清除、覆寫或重設 prototype 紀錄。
- `/` 仍係 Staff Demo／Manager Demo；`/login` 同 `/team` 係另一個真實登入 workspace。共享模式唔會讀／寫 demo localStorage，亦冇 Reset 或身份模擬切換。
- 現階段只用虛構姓名同你控制嘅測試 email，唔匯入真實員工個人資料。建議用測試 Supabase project；如果已有正式資料，先用現有備份流程備份。

## 2. 執行兩個 SQL migrations（先 SQL，後連 app）

喺 Supabase Dashboard → SQL Editor → New query，依次貼入並執行：

1. `supabase/migrations/202611050001_sos.sql`
2. `supabase/migrations/202611050002_admin.sql`

每個檔案有 BEGIN／COMMIT，失敗會 rollback。只建立 `sos_*` 命名嘅 tables／functions 同 `sos_private` schema，冇 DROP 或清除現有資料。若已存在同名物件，**停止並檢查 migration history，唔好 DROP TABLE 或重跑到成功為止**。呢兩份係 version-controlled migration，唔係可以反覆重置嘅 seed。

Automatic table exposure 可以繼續關閉；automatic RLS 可以繼續開啟。確認 Data API 有啟用，而 `public` 係 exposed schema（Supabase 常見預設）；**唔好 expose `sos_private`**。Migration 會通知 PostgREST reload schema。

### 建立嘅資料表

| Table                     | 用途                                                                             |
| ------------------------- | -------------------------------------------------------------------------------- |
| sos_organisations         | 咖啡店組織                                                                       |
| sos_memberships           | 已批准帳戶、STAFF／MANAGER、active 狀態                                          |
| sos_profiles              | 可分享嘅 display name、full-time／part-time；冇 email、password 或 Auth metadata |
| sos_branches              | ST／CSW／SOHO W 及 operating hours                                               |
| sos_sh_codes              | 可擴充 SH01–SH12                                                                 |
| sos_availability          | 獨立 availability submission、時間及提交 timestamp                               |
| sos_availability_days     | 每筆提交多個日子；同員工同日不可重複                                             |
| sos_availability_branches | 每筆提交可接受分店                                                               |
| sos_shifts                | 工作更及 draft／published                                                        |
| sos_sh_items              | 獨立 SH，唔計工作時數                                                            |
| sos_publications          | 每次全月發佈嘅審計紀錄                                                           |
| sos_revisions             | organisation revision，防止舊畫面覆蓋新資料                                      |

工作日期／時間係 Hong Kong business local date/time；提交及發佈 timestamp 用 timestamptz，顯示為 HKT。跨午夜工作更仍未支援。

### GRANT 同 RLS 係兩層檢查

只有 policy 冇 GRANT，Data API 仍然會 permission denied。Migration 已先 REVOKE SOS 物件上嘅舊／自動權限，再明確加入以下最少權限：

| 角色／物件                                                                                     | SQL GRANT                                                              | RLS／額外限制                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| anon                                                                                           | 冇 SOS table 或 RPC 權限                                               | 未登入不可讀 rota                                                                       |
| authenticated：org、own membership、safe profiles、branches、SH codes、publications、revisions | SELECT                                                                 | 只限目前 active organisation；membership 只讀本人                                       |
| authenticated：availability                                                                    | SELECT；INSERT 指定欄位；UPDATE 只限 starts／finishes／all_day；DELETE | 全 team 可讀，只有 owner 可改，經理亦不可代改；submitted_at／owner／org 不可任意 UPDATE |
| authenticated：availability days／branches                                                     | SELECT、INSERT、DELETE；冇 UPDATE                                      | owner 限制加 composite FK；RPC 以 transaction 刪除再插入 child rows                     |
| authenticated：shifts／SH                                                                      | SELECT；INSERT／UPDATE 指定業務欄位；DELETE                            | Staff 只見 published，只有同組織 Manager 可修改                                         |
| authenticated：memberships／profiles／branches／codes／audit／revision                         | 冇直接寫入權限                                                         | 不可自行升 Manager、改人事資料或偽造 publication                                        |
| authenticated：sos_apply_changes／sos_publish_month                                            | EXECUTE                                                                | session membership、ownership、role、revision、scheduling validation                    |
| admin provisioning functions                                                                   | 冇 public／anon／authenticated EXECUTE                                 | 只供受信任 SQL Editor／database owner                                                   |

冇需要對 sequences 開權限（IDs 使用 UUID）。`sos_private` 只畀 authenticated USAGE 同必要 helper EXECUTE，冇授權直接呼叫 trigger validation internals。

RLS 會明確對每張 SOS table 啟用。所有 shared read/write 都用使用者 session，**唔會用 service-role key 繞過 RLS**。一般 changes RPC 係 SECURITY INVOKER；有限度 SECURITY DEFINER helpers 用於避免 policy recursion、鎖 revision、驗證隱藏 draft 同 manager-only 原子發佈，均限定 search_path、驗證 auth.uid()/organisation/role，唔提供任意 SQL 執行。

## 3. 建立測試 organisation

用 SQL Editor（受信任管理員）執行一次：

```sql
select public.sos_admin_create_organisation('SOS test cafe');
```

記低返回嘅 organisation UUID。此函式建立三間分店、revision 同 SH01–SH12。Prototype operating hours 為 ST 08:00–20:00、CSW 08:00–20:00、SOHO W 09:00–22:00，並非真實營業承諾；管理員可用 SQL Editor 更新 sos_branches，app 會讀取 DB 設定。

## 4. Supabase Auth：只接受邀請／批准

1. Authentication 設定關閉 public sign-ups（關閉「Allow new users to sign up」或相應選項）。App 冇自助註冊頁；即使有人未經批准建立 Auth account，冇 active membership 都讀唔到組織資料。
2. 設定 **Site URL** 為你嘅開發網址，例如 Codespaces private port 3000 嘅完整 HTTPS origin，或者 `http://localhost:3000`。
3. Redirect URLs 只加入你控制嘅開發 origin／auth 路徑，唔用任意網域 wildcard。
4. Invite email template 嘅連結設定成：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite"
  >Accept SOS invitation</a
>
```

Recovery template 如需要，使用相同路徑配 `type=recovery`。App 會驗證 Supabase token hash、設定 session cookie，再導去 `/account` 設置至少 12 字元 password。唔會接受任意外站 next URL。

5. Dashboard → Authentication → Users → Invite user，用你自己控制嘅 **三個測試 email／alias** 邀請一位經理、兩位 staff。唔好將 password 或 invite link 貼到 GitHub／對話。
6. 記低每個 Auth user 嘅 UUID，然後由受信任管理員喺 SQL Editor 批准 membership：

```sql
-- 將下面佔位文字換成第 3 步嘅 organisation UUID 同邀請建立嘅 Auth UUID。
select public.sos_admin_provision_member(
  'YOUR_ORGANISATION_UUID'::uuid,
  'MANAGER_AUTH_UUID'::uuid,
  'Manager Test', 'full-time', 'MANAGER'
);
select public.sos_admin_provision_member(
  'YOUR_ORGANISATION_UUID'::uuid,
  'ALEX_AUTH_UUID'::uuid,
  'Alex Test', 'full-time', 'STAFF'
);
select public.sos_admin_provision_member(
  'YOUR_ORGANISATION_UUID'::uuid,
  'JAMIE_AUTH_UUID'::uuid,
  'Jamie Test', 'part-time', 'STAFF'
);
```

只做一次，重複同一 user 會 unique constraint error。此版每個 Auth account 只屬於一個 café organisation。角色來自 membership table，唔讀可由用戶自行修改嘅 Auth metadata。

停用帳戶、修改 employment、角色審批同新增 staff，暫時由有權限嘅 Supabase project administrator 喺 Dashboard／SQL Editor 操作，唔係普通 Manager 可以自行呼叫嘅升權 API。例如停用：

```sql
update public.sos_memberships set active = false
where user_id = 'AUTH_UUID_TO_DEACTIVATE'::uuid;
```

重新啟用、升／降職都應由同一受信任流程審批。唔需要將 service-role key 加入 app，亦唔應將 Supabase Dashboard 管理權交畀所有 staff。

## 5. 設定 app（migration 完成後先做）

喺 repository 根目錄複製 `.env.example` 到 `.env.local`，填入：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
SOS_APP_ORIGIN=https://YOUR-CODESPACE-3000.app.github.dev
```

本機用 `SOS_APP_ORIGIN=http://localhost:3000`。呢個值係實際瀏覽器網址嘅 origin，冇路徑，亦用作反向代理環境下嘅同來源寫入檢查。

Publishable key／legacy anon key 係公開 client credential，唔係 service-role key。程式會拒絕 `sb_secret_` 同 service-role JWT。**唔好使用 service_role、database password、Supabase access token 或 secret key；唔好 commit `.env.local`。**

如 Codex cloud network policy 限制連線，需要喺 environment settings 只加入你實際 project hostname，例如 `YOUR_PROJECT_REF.supabase.co`，保留既有 allowlist；唔需要開放所有網域。Codespaces 一般唔使用呢個 Codex policy。

```bash
git fetch origin
git switch feat/sos-v5
npm install
npm run dev
```

環境變數改完要重啟 server。正式 workspace 開 `/login`，接受邀請並設定 password 後登入，再進 `/team`。原本 `/` demo 可照用。未設定 Supabase 時，login 會顯示 setup 提示，team 會導去 login，唔會偽裝成連線成功或自動 fallback 成共享 demo。

## 6. 同一經理 + 兩位 staff 點樣測

用三個不同 browser profile／private session，避免共用登入 cookie：

1. Alex 登入，揀 11 月 10 日，09:00–18:00，ST／CSW，提交。
2. Jamie 登入，按 **Synchronise**（或 refresh），應喺 Alex 日格見到 availability；可以點擊睇日期、時間、分店，唔可以編輯或移除 Alex 提交。
3. Manager 登入並 synchronise，點 Alex Av 建立 ST 11:00–17:00 draft；Jamie synchronise 後仍然睇唔到 draft，但 availability 繼續可見。
4. Manager 按 Publish Rota 確認全月；Alex／Jamie synchronise 後見到 published shift，原 availability 保留。
5. Alex 嘗試刪除／縮窄已被班次使用嘅 availability：DB 會阻止，先由 Manager 移除／修改相關班次，再改 submission。
6. Manager 嘗試改 Jamie availability：冇編輯控制，直接 API／DB 操作亦被阻止。Manager 可安排班次，唔可代填 staff 意願。
7. 試超出時間、SOHO W 非允許分店、跨分店 overlap、同日 SH／work 衝突：都應儲存失敗。
8. 試 Manager 建立／編輯／刪除／發佈 full-time staff SH；工時唔包含 SH。
9. 同時開兩個 Manager tab，A 儲存後 B 嘗試用舊 revision 儲存：B 會提示 synchronise，而唔會覆蓋 A。
10. 用未經批准 membership 嘅 account／登出狀態試 team：應被拒；Staff 永遠冇 demo role 切換，改 client profile ID 亦唔會變 Manager。

資料從共享 PostgreSQL 保存；重新整理／Synchronise 會載入目前授權 records。此版未加 Realtime。若網絡喺成功寫 DB 後中斷，app 可能未收到確認，請先 Synchronise 再重試，唔好假設失敗提示代表 DB 一定冇改動。

## 7. 已驗證同未驗證

- `npm run lint` 同 production build 通過；`npm test` 60 tests passed。
- `npm run test:db` 42 checks passed，使用 **PGlite PostgreSQL** 真正執行兩份 migration、roles、GRANT、RLS、PL/pgSQL triggers／RPC。以一個 Manager、兩個 Staff、第二個 org、匿名及未批准身份檢查；唔係只比較 SQL 文字。
- Auth user UUID／auth.uid() 喺隔離 DB 係測試 stub；**唔等同 Supabase JWT、email delivery、真實 Auth service 或跨連線 concurrency 測試**。
- SQL tests 包括 team read、own-only availability（經理也不可代改）、role escalation denied、draft visibility、跨 org 隔離、no-GRANT permission denied／補回最小 grant 後成功、submitted_at 不可偽造、child UPDATE 不需要亦唔授權、DB overlap／SH、availability integrity、revision conflict、整批 rollback、原子發佈。
- `npm run test:browser` 保留 V3／V4 demo mobile workflows，新增匿名 route guards、同來源保護同 invitation redirect 檢查。 如用 port 3002 測試，請以 `SOS_APP_ORIGIN=http://localhost:3002 npm start -- --port 3002` 啟動 server，另一 terminal 執行 `npm run test:browser`，確保測試 origin 同允許 origin 一致。測試唔會登入或修改你嘅線上資料庫。
- Component tests 證明 shared staff rota 會渲染同事未排更 availability，同已有 shift 嘅 availability；真實 shared UI save 流程仍需按以上三帳戶手動測試。

目前未有你項目嘅設定，所以 **未執行線上 migration、真實登入／邀請、三帳戶多手機同步、Supabase Data API schema-cache 行為或真實 iPhone Safari 測試**。設定好之後先做第 6 節驗收，唔好直接用真實員工資料。

## 8. 排查 permission denied

依序查：登入 session → active membership → migration 是否兩份完成 → `public` Data API schema → table／column GRANT → RLS policy → deferred scheduling integrity。Migration 用同一 transaction 加權限，唔需要關 automatic RLS 或開放 anon。

以下只作管理員 SQL 檢查（唔會關 RLS）：

```sql
select relname, relrowsecurity
from pg_class where relname like 'sos_%' and relkind='r';
select has_table_privilege('authenticated','public.sos_availability','SELECT');
select has_column_privilege('authenticated','public.sos_availability','starts','UPDATE');
select has_table_privilege('authenticated','public.sos_memberships','UPDATE'); -- 應為 false
select has_function_privilege('authenticated','public.sos_apply_changes(bigint,jsonb)','EXECUTE');
select has_function_privilege('anon','public.sos_apply_changes(bigint,jsonb)','EXECUTE'); -- false
```

唔好用 service-role key 測「Staff 權限」：service role 係特權身份，會掩蓋 RLS 問題。實際 Data API 測試應使用該 staff 自己嘅 Supabase session。
