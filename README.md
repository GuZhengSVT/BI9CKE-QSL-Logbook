# BI9CKE QSL Logbook

对外展示的业余无线电日志与独立登录管理后台。

- **GitHub Pages**：只读日志、统计图表、通联覆盖地图、QSL 卡片相册，支持中英文与手机布局。
- **Cloudflare Workers + D1**：管理通联、ADIF 导入导出、电台信息与地图位置。保存后，展示页通过公开 API 读取最新数据。
- **内置管理员登录**：Workers 验证密码，D1 保存加盐 PBKDF2 派生值与会话摘要。无需开通 Zero Trust 或绑定其付款方式。
- **图片仍在 GitHub**：卡片扫描图放入 `qsl-cards/` 并登记 `manifest.json`，无需 R2。

## 外观与管理功能

前台、后台和登录页均提供「跟随系统 / 浅色模式 / 深色模式」。默认跟随系统，手动选择按浏览器来源保存；图表、表单、表格和状态徽章随主题更新。

管理后台参考 [HamCQ Echo](https://echo.hamcq.cn/dashboard) 的功能组织，采用本项目自己的界面设计：

- **仪表盘**：总计、今年、本月、今日、连续通联、唯一呼号，最近通联、近 12 个月活动、覆盖地图及 DXCC / 网格确认进度。日历统计统一使用 UTC，连续通联从今天或昨天向前计算。
- **通联筛选**：呼号 / 国家 / 网格搜索与波段、模式、起止日期、确认状态组合筛选；可以导出当前筛选结果的完整 ADIF。
- **QSL 管理**：待寄出（已请求 / 排队）、已寄出待回卡、已收到队列；快捷标记同时保存 UTC 寄收日期。LoTW 仍通过日志字段记录确认状态。
- **录入辅助**：一键填入当前 UTC、同呼号历史通联次数、短路径距离与真北方位预览。距离必须具备本台及对方位置，不使用呼号前缀猜测坐标。

探索进度按已有日志去重统计：DXCC 编号优先、缺失时按国家字段归组；网格统一归为四位。确认表示纸卡或 LoTW 已确认；不等同于正式奖项申请资格核验。

## 卫星工具

公开页与后台均有「卫星工具」入口，支持中英文、深浅色主题：

- **实时轨迹**：当前星下点及六位网格、前后 90 分钟地面轨迹、球形地球近似覆盖边界、轨道高度、方位、仰角和斜距。跨越 ±180° 经线的轨迹会分段绘制。
- **过境预报与时钟**：未来 24 / 48 小时的 AOS、最高点、LOS、时长、最大仰角、升落方位，以及 AOS / LOS 倒计时。可以切换 UTC 和北京时间、筛选最低最大仰角，并查看每次过境的极坐标天空图。
- **多普勒辅助**：输入实际使用的上行、下行标称频率，按观测者与卫星的实时径向速度计算接收频率和上行补偿频率。采用一阶近似，不自动控制电台。
- **卫星通联录入**：后台可将选中卫星带入录入表单，自动填入 `SAT_NAME`、`PROP_MODE=SAT` 和当前 UTC。保存仍需填写对方呼号、波段和模式。卫星字段保留在 ADIF 导入导出及公开详情中。

默认观测位置读取电台设置；也可在工具内临时应用网格与海拔（默认 0 m），仅影响当前页面。位置与轨道计算都在浏览器本地进行，观测位置不传给轨道数据源。过境计算使用独立 Web Worker；离开工具页或切到后台标签时暂停实时更新与计算。

Worker 的只读 `/api/satellites` 从 [AMSAT 当前轨道目录](https://www.amsat.org/tle/current/nasabare.txt) 获取并校验 TLE，缓存一小时。界面显示获取时间与每颗卫星的轨道历元，历元距离当前超过 7 天时提示更新；源不可用时明确报错，也可手动粘贴带正确校验位的 TLE。卫星出现在目录中不表示其无线电载荷当前可用。

轨道传播使用 [satellite.js](https://github.com/shashwatak/satellite-js) 的 SGP4/SDP4 算法；依赖和许可证随网站一起构建，不从第三方 CDN 加载脚本。AOS / LOS 定义为几何地平线 0°，仰角筛选不会改变升落定义；预报不包含地形、建筑遮挡和大气折射。星历与计算结果都是预测值。

## 本地开发与验证

需要 Node.js 22.13+。

```sh
npm ci
npm test
npm run build
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist/public
```

访问 `http://127.0.0.1:8000/`。未配置后端时，只展示仓库静态日志，不读取旧版浏览器草稿，也不提供录入功能。

启动真实 Workers 本地运行时与本地 D1：

```sh
npm run db:local
npm run dev
```

`http://localhost:8787/api/public` 可查看本地公开数据。没有有效账号会话时，管理 API 返回 401；正式部署没有默认密码。

`node tests/preview-server.mjs` 启动独立 UI 测试工具：使用内存数据库，账号 `BI9CKE`、测试密码 `preview-password-only`，运行真实密码和会话校验。访问 `http://localhost:8002`；此工具仅监听本机，不包含在发布产物中。测试账号不会写入正式 D1。

## 地图位置和范围

在登录后台的「电台设置」中填写 Maidenhead 网格（4/6/8 位）或经纬度。坐标优先于网格；网格按中心位置估算。不填写位置时，地图不画虚构光点。

地图以本台为中心采用**方位等距投影**。橙色光点是本台，最外层圆的半径是最远已定位通联的大圆距离；其他两圈分别为该距离的 1/3、2/3。此投影使屏幕径向距离与真实距离成比例，最远电台落在外圈上。

对方位置来自通联的 `GRIDSQUARE` 或 `LAT`/`LON`，不从呼号或国家猜测。地图标出定位覆盖数；缺少定位的记录不参与最远排名。可在后台编辑记录补充网格或坐标。`LAT`/`LON` 支持十进制度或 ADIF 格式，例如 `N035 30.000` / `E139 30.000`。

地图几何来自公有领域的 [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)，已转换为本地 SVG 和地图点数据，无外部地图 API 或 CDN 依赖。

## 部署 Cloudflare 后台

使用 Workers Free 和 D1 Free 即可起步，无需开通 Zero Trust。当前部署地址：

- 展示页：`https://www.guzhengsvt.cn/BI9CKE-QSL-Logbook/`
- 后台：`https://bi9cke-qsl-backend.lvbowen040427.workers.dev/admin/`
- 公开接口：`https://bi9cke-qsl-backend.lvbowen040427.workers.dev/api/public`

### 1. 授权部署工具

```sh
npx wrangler login --use-keyring
```

在 Cloudflare 官方页面由账号所有者确认授权。无需创建 Global API Key；自动化部署才需要另行配置范围受限的 API Token。

### 2. 创建 D1

```sh
npx wrangler d1 create qsl-logbook
```

把返回的 `database_id` 填入 `worker/wrangler.jsonc`。再执行：

```sh
npm run db:remote
```

三份 migration 建立业务、账号与会话表，并将当前仓库的 7 条日志迁入数据库，仅执行一次；后续重新部署不会覆盖后台修改。若首次部署前修改了仓库日志，请同步检查 `0002_repository_seed.sql`。正式数据库成为后台保存的权威源；仓库 `data/log.adi` 是静态回退副本，应定期从后台导出更新。

### 3. 部署后台并绑定地址

```sh
npm run deploy:backend
```

Workers 默认提供 HTTPS 的 `workers.dev` 地址；也可另行绑定自己的子域名。公开展示仍位于 GitHub Pages。后台路由由 Worker 管理，资源配置使用 `html_handling: none`，避免内部读取 `admin/index.html` 时产生重定向循环。

设置 `worker/wrangler.jsonc` 中：

| 配置 | 内容 |
|---|---|
| `PUBLIC_SITE_ORIGIN` | 展示站来源，例如 `https://www.guzhengsvt.cn`，不带路径 |
| `PUBLIC_SITE_URL` | 展示页完整地址，包含项目路径 |
| `ADMIN_USERNAME` | 固定管理员登录账号，当前为 `BI9CKE`；电台呼号与此登录账号分别设置 |

### 4. 首次设置管理员密码

先把 Worker 基地址填入 `data/config.json` 的 `apiBaseUrl`，再生成专用设置链接：

```sh
npm run admin:prepare
node --input-type=module -e 'import {readFile} from "node:fs/promises";process.stdout.write(JSON.parse(await readFile(".wrangler/admin-setup.json","utf8")).hash)' | npx wrangler secret put ADMIN_SETUP_HASH --config worker/wrangler.jsonc
npm run deploy:backend
```

在本机打开 `.wrangler/admin-setup.json` 中的 `url`，由管理员本人设置至少 12 位密码。此私有文件权限为 0600，已被 Git 和构建产物排除；不要将文件、完整链接或密码发到仓库。首次设置需同时满足专用随机令牌和数据库尚无管理员两个条件。创建成功后，相同链接不能重设密码。

密码使用 Web Crypto PBKDF2-SHA256、随机盐和 100,000 次迭代派生，D1 不存明文密码。登录后建立 12 小时会话，浏览器仅保存 `Secure`、`HttpOnly`、`SameSite=Strict` 的 Cookie，数据库保存随机会话令牌的 SHA-256 摘要。退出登录立即删除对应服务端会话。登录与首次设置限制每个 IP 每 15 分钟最多 10 次连续尝试；成功后重置计数。

`/api/public` 始终允许匿名读取白名单内的公开通联字段；私人备注和卡片附言不返回。所有管理 API 独立验证服务端会话，修改请求还需通过同源校验。公开网页隐藏录入按钮不能替代这些服务器检查。

参考：[Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、[Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)。

### 5. 连接 GitHub Pages

在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 新增：

```text
QSL_API_BASE_URL=https://<你的后台主机>
```

再触发现有 Pages workflow。构建脚本会把后端地址写入发布配置，自动为 JS/CSS 添加内容哈希以避免缓存混用。

也可以将地址直接填入 `data/config.json` 的 `apiBaseUrl`；Actions 变量优先。该配置只允许后端的基地址，不包含 token。

公开页每次打开会读取最新数据库数据；后端不可用时显示仓库静态副本并标明回退状态，不会静默把旧数据当成最新数据。

## 目录与发布边界

```text
index.html / css/ / js/       公开展示页
admin/                       独立后台界面
worker/src/index.mjs         Workers API、账号会话校验、资源路由
worker/migrations/           D1 建表与首次迁移
worker/wrangler.jsonc        Cloudflare 资源与账号访问配置
scripts/build.mjs            生成分开的发布产物和资源哈希
assets/                      本地地图与 favicon
qsl-cards/                   GitHub Pages 卡片图集
data/                        静态配置与日志回退副本
tests/                       地理计算、认证、API 与 UI 测试工具
dist/public/                 只上传 GitHub Pages
dist/backend/                只上传 Cloudflare Workers 静态资源
```

公开产物使用白名单构建，不发布后台代码、测试登录工具、数据库、环境文件或私有备注。不要再将整个仓库根目录作为 Pages artifact 上传。

保存通联、编辑、删除、导入、电台设置均通过管理 API 写 D1；请求必须同时通过服务端会话验证与同源校验。浏览器不保存部署令牌或 GitHub PAT。

MIT
