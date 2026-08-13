# 📻 业余无线电 QSL Logbook — 通联日志与 QSL 卡片交换记录

一个**纯静态**的业余无线电通联日志网站：记录通联（QSO）、管理 QSL 卡片收发状态、展示统计图表与卡片相册。数据采用业余无线电行业标准 **ADIF** 格式，可无缝对接 LoTW / Clublog / QRZ / eQSL / WSJT-X / N1MM / Log4OM 等。

- ✅ 托管在 **GitHub Pages**，完全免费、**无需备案**（GitHub 服务器在境外，不涉及中国大陆 ICP 备案）
- ✅ 无需自己维护服务器，零运维成本
- ✅ 无 CDN 依赖（ECharts 等已本地化），国内访问速度快
- ✅ 支持自定义域名绑定

---

## ✨ 功能

| 页面 | 功能 |
|---|---|
| 📖 通联日志 | 表格展示、按呼号/波段/模式/年份/国家筛选、分页、点击行展开详情、QSL 状态快捷标记 |
| 📊 统计 | 总 QSO / DXCC / 已确认数、波段分布、模式分布、每月与逐年通联曲线 |
| 💌 QSL 管理 | 待发出 / 待收到 / 已确认三个看板，寄出超时（默认 90 天）提醒，一键标记状态 |
| ✍️ 录入 / 导入 | 表单录入、ADIF 批量导入（文件或粘贴）、ADIF 导出（下载/复制）、本机草稿管理 |
| 🖼 QSL 卡片 | 卡片扫描图相册（lightbox 放大），图片放 `qsl-cards/` 目录并登记 manifest |
| 🌐 多语言 | 右上角切换 简体中文 / English，选择持久化保存 |

## 📁 目录结构

```
ham-qsl-log/
├── index.html              # 站点入口（单页应用）
├── css/style.css           # 样式
├── js/
│   ├── adif.js             # ADIF 解析器/序列化器（纯原生 JS）
│   ├── store.js            # 数据层：仓库 ADIF + 浏览器草稿合并
│   ├── app.js              # 应用外壳 + 日志表格
│   ├── stats.js            # 统计图表（ECharts）
│   ├── qsl.js              # QSL 管理看板
│   ├── entry.js            # 录入 / 导入 / 导出
│   └── cards.js            # 卡片相册
├── vendor/echarts.min.js   # 图表库（本地化，无 CDN）
├── data/
│   ├── log.adi             # ⭐ 权威数据源：你的通联日志（ADIF 格式）
│   └── config.json         # 站点配置（呼号、常用波段/模式）
├── qsl-cards/
│   └── manifest.json       # 卡片图片清单
└── .github/workflows/deploy.yml  # push 后自动部署到 GitHub Pages
```

## 🚀 快速开始

### 1. 本地预览

```bash
cd ham-qsl-log
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

> ⚠️ 不要直接双击 `index.html` 打开（浏览器会因 CORS 阻止加载 `data/log.adi`），必须通过 HTTP 服务访问。

### 2. 部署到 GitHub Pages（免费、免备案）

本项目已部署在公开仓库 **`GuZhengSVT/BI9CKE-QSL-Logbook`**，站点地址：
`https://GuZhengSVT.github.io/BI9CKE-QSL-Logbook/`

若需自行搭建（或迁移到新仓库），步骤如下：

1. 在 GitHub 新建**公开仓库**，把本项目所有文件推上去：
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 仓库页面 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. push 后 Actions 自动构建部署，站点地址为：
   `https://<你的用户名>.github.io/<仓库名>/`
4. 以后每次 push 自动更新。也可以在 Actions 页面手动 **Run workflow** 重新部署。

### 3. 绑定自定义域名（可选）

1. 仓库 **Settings → Pages → Custom domain** 填入你的域名（如 `log.myham.site`），勾选 Enforce HTTPS。
2. 在域名 DNS 处（推荐用 Cloudflare 免费 DNS）添加：
   - **CNAME 记录**：`log` → `<你的用户名>.github.io`
   - （或 A 记录指向 GitHub Pages 的 4 个 IP：`185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153`）
3. 等待 HTTPS 证书签发（通常几分钟到几小时）。

> 📌 备案说明：GitHub Pages 服务器在境外，**不需要**中国大陆 ICP 备案。你的域名只需完成注册时的实名认证即可正常解析。若担心国内访问 GitHub Pages 不稳定，见下方「国内访问优化」。

### 4. 国内访问优化（可选）

同一仓库双部署到 **Cloudflare Pages**（免费、免备案、国内访问相对稳定）：

1. [Cloudflare Pages](https://pages.cloudflare.com) → Create project → 连接你的 GitHub 仓库，构建命令留空，输出目录填 `.`。
2. 域名解析交给 Cloudflare（DNS 面板中添加记录），享受 Cloudflare CDN 加速。
3. GitHub Pages 与 Cloudflare Pages 可同时在线，互相备份。

---

## 📝 日常使用（无服务器下的数据录入流程）

数据模型：**`data/log.adi` 是唯一权威数据源**（git 版本控制），浏览器里的修改先落在 localStorage 草稿，导出后提交回仓库即正式入库。

1. **录入**：网页「录入/导入」页填表保存 → 记录进入本机草稿（仅当前浏览器）。
2. **导入**：从 WSJT-X / N1MM / Log4OM / LoTW / Clublog 导出的 `.adi` 文件，粘贴或选择文件批量导入；相同记录默认跳过，可勾选合并更新。
3. **导出提交**：点「下载完整日志」得到 `qsl-log-full.adi`，把它**提交回仓库**（git commit 或直接在 GitHub 网页上传替换 `data/log.adi`）→ 部署自动更新。
4. **清除草稿**：提交成功后点「清除本机草稿」，保持本地与仓库一致。

> 💡 更顺滑的替代流程：日常在本地日志软件（WSJT-X、Log4OM 等）记 QSO，定期导出 ADIF 上传到网页导入，QSL 收发状态在网页上管理即可。

## 🚀 网页一键提交到 GitHub（免手动 git）

录入页右侧有「一键提交到 GitHub」卡片：点一次按钮，把**本机草稿数据 + 卡片图片**原子写入仓库（一次 commit），GitHub Actions 自动重新部署。无需安装 git、无需本地环境。

### 第一步：创建 PAT 令牌（只需一次）

1. GitHub → 右上角头像 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access**：选 *Only select repositories* → 勾选你的日志仓库
3. **Permissions → Contents**：选 **Read and write**（其余权限保持 None）
4. 有效期自选，点 Generate token，**立即复制**（只显示一次）

> 🔒 安全说明：令牌只保存在**当前浏览器**的 localStorage 中，请求仅直连 `api.github.com`，不经过任何第三方；建议用 fine-grained token 限定到这一个仓库。不放心可随时点「清除令牌」。

### 第二步：在网页填写并测试

1. 打开录入页 → 「一键提交到 GitHub」卡片
2. 填写：GitHub 用户名、仓库名、分支（默认 main）、PAT 令牌
3. 点「保存设置」→「测试连接」，显示 `连接成功：xxx/xxx` 即 OK

### 第三步：日常提交

1. 网页上录入/导入/标记 QSL 状态后（此时在本机草稿）
2. （可选）在图片选择框选要上传的卡片图，支持多选；文件名建议 `呼号_日期.jpg`，会自动登记到 manifest
3. 点 **「⬆ 一键提交」** → 等待数秒 → 显示提交成功
4. GitHub Actions 自动重新部署，1-2 分钟后网站更新；草稿自动清除

> 提交内容：`data/log.adi`（完整日志，始终包含）+ 新选的卡片图片 + 自动更新的 `qsl-cards/manifest.json`。全部合并在**一次提交**里，只触发一次部署。

## 🖼 添加 QSL 卡片图片

1. 把卡片扫描图放进 `qsl-cards/` 目录（建议命名 `呼号_日期.jpg`）。
2. 在 `qsl-cards/manifest.json` 登记：
   ```json
   {
     "cards": [
       { "file": "JA1XYZ_20240315.jpg", "call": "JA1XYZ", "date": "20240315", "note": "直寄收到" }
     ]
   }
   ```

## ⚙️ 配置

编辑 `data/config.json`：

```json
{
  "call": "BI9CKE",              // 你的呼号，显示在站点标题
  "name": "BI9CKE 的业余无线电日志",
  "commonBands": ["160M", "80M", "40M", "20M", "15M", "10M", "6M", "2M", "70CM"],
  "commonModes": ["SSB", "CW", "FT8", "FM", "AM", "RTTY", "PSK31"]
}
```

## 🧩 ADIF 字段说明

每个通联记录支持的字段（全部为标准 ADIF 3.1.4 字段）：

| 字段 | 说明 | 字段 | 说明 |
|---|---|---|---|
| `CALL` | 对方呼号 | `QSL_SENT` | 卡片发出状态 N/Y/Q/R/S/M/I |
| `QSO_DATE` | 通联日期 YYYYMMDD | `QSL_RCVD` | 卡片收到状态 N/Y/R/I |
| `TIME_ON` | 开始时间 HHMMSS (UTC) | `QSL_SENT_DATE` / `QSL_RCVD_DATE` | 寄出/收到日期 |
| `BAND` / `MODE` | 波段 / 模式 | `QSL_VIA` | DIRECT / BURO |
| `FREQ` | 频率 MHz | `QSLMSG` | 卡片附言 |
| `RST_SENT` / `RST_RCVD` | 信号报告 | `LOTW_QSL_SENT/RECEIVED` | LoTW 电子确认 |
| `GRIDSQUARE` | 梅登海德网格 | `EQSL_QSL_*` | eQSL 电子确认 |
| `IOTA` / `DXCC` / `COUNTRY` | 岛屿 / 实体 / 国家 | `COMMENT` | 备注 |

## ❓ 常见问题

**Q: 为什么双击 index.html 打不开？**
A: 浏览器安全策略禁止 `file://` 下 fetch 本地文件。用 `python3 -m http.server` 启动本地服务访问。

**Q: 需要备案吗？**
A: 不需要。GitHub Pages / Cloudflare Pages 服务器均在境外，不涉及中国大陆 ICP 备案。唯一要求是域名完成注册实名认证。

**Q: 私有仓库能开 Pages 吗？**
A: 私有仓库的 Pages 需要 GitHub 付费套餐（Pro 等）。用**公开仓库**则完全免费；火腿日志通常本身也愿意公开分享。

**Q: 数据安全吗？**
A: 数据文件在 git 仓库里有完整版本历史，删除/误改可随时回滚。本机草稿记得定期导出提交。

**Q: 想在多台设备/手机上录入？**
A: 当前为"一台电脑录入"设计。如需多设备同步，可后续加 Cloudflare Workers + D1 后端（仍然免费免备案），本项目架构已预留该升级空间。

## 📄 许可证

MIT
