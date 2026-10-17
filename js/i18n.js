/* ============================================================================
 * i18n.js — 国际化：简体中文 / English
 * t(key, params) 按当前语言取文案；语言选择持久化于 localStorage。
 * 对外暴露全局对象: I18N
 * ==========================================================================*/
'use strict';

const I18N = (() => {
  const LS_KEY = 'qsl_log_lang';
  const SUPPORTED = ['zh-CN', 'en'];

  const messages = {
    /* ============================================================ 中文 */
    'zh-CN': {
      navSatellites:'卫星工具',satellitesDescription:'追踪轨道，等待下一次来自太空的回应。',satelliteName:'卫星名称',propagationMode:'传播方式',
    themeSystem:'跟随系统',themeLight:'浅色模式',themeDark:'深色模式',
      mapLoadFailed: '地图暂时无法加载。', adminLogin: '电台管理', liveUnavailable: '实时日志暂不可用，当前展示仓库中的静态副本。',
      mapNeedsStation: '电台位置暂未公开。',
      mapNoContacts: '电台位置已设置；为通联记录填写网格或经纬度后，将显示覆盖范围。',
      mapCoverage: '最远已定位通联 {call} · 约 {km} km · 已定位 {located}/{total} 条，按网格或坐标估算',
      collectionPublicHint: '这里将收藏来自世界各地的 QSL 卡片，期待下一份远方的问候。',

      workspace: '电台足迹', myStation: '电台日志', stationLabel: '业余无线电台',
      radioQuote: '让电波跨越山海。', skipContent: '跳转到主内容',
      exportAction: '导出 ADIF', addContact: '新增通联',
      heroTitle: '电波所至，皆是相遇。', heroDescription: '从一个呼号出发，与整个世界对话。',
      exploreStats: '探索通联足迹', recentContacts: '通联记录', rowHint: '点击记录，查看通联详情',
      logDescription: '记录每一次相遇，收藏来自世界的回响。',
      statsDescription: '从波段到远方，看看你的电波走过了哪里。',
      qslDescription: '一张卡片，一份跨越距离的通联确认。',
      entryDescription: '留住这一次通联，让每一个呼号都有迹可循。',
      cardsDescription: '来自世界各地的问候，值得一张张珍藏。',
      overviewTotal: '累计通联', overviewDxcc: 'DXCC 实体', overviewConfirmed: '已确认通联', overviewBands: '活跃波段',
      totalFoot: '每一个呼号，都是一次相遇', dxccFoot: '探索更广阔的无线电世界',
      confirmedFoot: '确认率 {n}%', bandsFoot: '覆盖 {n} 种通联模式',
      localPrivacy: '你的每一次通联，都值得被珍藏。', resetFilters: '清除筛选',
      pagerRange: '显示 {from}–{to} 条，共 {n} 条记录', noResults: '没有找到匹配的通联记录，试试其他筛选条件。',
      collectionEmpty: '等待第一张远方的问候', collectionHint: '扫描收到的 QSL 卡片，在「录入 / 导入」中上传，为这次通联留下一份纪念。',
      addCard: '添加卡片', openRecord: '查看 {call} 的通联详情', closePreview: '关闭卡片预览',

      title: '业余无线电通联日志 · QSL Logbook',
      titleWithCall: '{call} 的通联日志 · QSL Logbook',
      appName: '业余无线电 QSL Logbook',
      siteName: '{call} · QSL Logbook',
      appSub: '通联日志 · QSL 卡片交换记录',
      navLog: '通联日志',
      navStats: '数据统计',
      navQsl: 'QSL 管理',
      navEntry: '录入 / 导入',
      navCards: '卡片收藏',
      localBadge: '本机草稿 {n} 条未提交',
      footer: '以电波相识，以卡片为念。',

      filterSearch: '搜索呼号 / 国家 / 网格 / 卫星…',
      allBands: '全部波段', allModes: '全部模式', allYears: '全部年份', allCountries: '全部国家',
      filterCount: '共 {n} 条',

      thDate: '日期', thCall: '呼号', thBand: '波段', thMode: '模式',
      thRst: 'RST 发/收', thGrid: '网格', thQslSent: 'QSL 发出', thQslRcvd: 'QSL 收到',
      logEmpty: '暂时还没有公开的通联记录。',

      pagerPrev: '上一页', pagerNext: '下一页',
      pagerInfo: '第 {page} / {pages} 页', perPage: '{n} 条/页',

      fldCall: '呼号', fldDate: '日期 (UTC)', fldTime: '时间 (UTC)', fldBand: '波段',
      fldMode: '模式', fldFreq: '频率 (MHz)', fldRstS: 'RST 发送', fldRstR: 'RST 接收',
      fldGrid: '网格', fldIota: 'IOTA', fldDxcc: 'DXCC', fldCountry: '国家/地区',
      fldQslS: 'QSL 发出状态', fldQslSDate: '寄出日期', fldQslR: 'QSL 收到状态', fldQslRDate: '收到日期',
      fldQslVia: 'QSL 途径', fldQslMsg: 'QSL 附言', fldComment: '备注',

      qslNone: '未标记',
      qslN: '未发', qslNRcvd: '未收', qslQ: '排队中', qslQRcvd: '排队中',
      qslR: '已请求', qslRRcvd: '已请求', qslY: '已发', qslYRcvd: '已收',
      qslS: '已提交第三方', qslSRcvd: '已提交', qslM: '卡片局', qslMRcvd: '卡片局',
      qslI: '忽略', qslIRcvd: '忽略', qslDash: '—',

      btnMarkSent: '标记 QSL 已寄出', btnMarkQueue: '标记待寄出',
      btnMarkRcvd: '标记 QSL 已收到', btnRequestCard: '标记请求补卡',
      btnEdit: '编辑', btnDelete: '删除',
      detailHint: '操作保存在本机草稿，提交到仓库后正式生效',
      deleteConfirm: '确认删除 {call} {date} 这条记录？\n（删除会写入本地草稿，提交仓库后生效）',

      statTotal: '总通联 QSO', statDxcc: 'DXCC 实体', statCountries: '国家/地区',
      statConfirmed: '已确认（QSL/LoTW）', statSent: 'QSL 已寄出', statRcvd: 'QSL 已收到',
      chartBand: '按波段分布', chartMode: '按模式分布',
      chartMonth: '每月通联数', chartYear: '按年份通联数',
      chartLoadFail: '图表库未加载',

      qslSummaryConfirmed: '已确认', qslSummaryToSend: '待发出', qslSummaryToRcvd: '待收到',
      qslSummaryOverdue: '寄出超时(>{n}天未收到)',
      qslOverdueTitle: '寄出超时提醒（已寄出 {n}+ 天未收到）',
      qslToSendTitle: '待发出 / 未发出',
      qslToRcvdTitle: '待收到',
      qslConfirmedTitle: '已确认',
      qslEmpty: '（空）',
      btnMarkSentShort: '标记已寄出', btnMarkQueueShort: '标记待寄出',
      btnMarkRcvdShort: '标记已收到', btnRequestShort: '请求补卡',
      btnUndoRcvd: '撤销已收', btnUndoSent: '撤销已发',

      entryTitle: '新增通联记录',
      entryEditTitle: '编辑：{call} {date}',
      btnSave: '保存记录', btnReset: '清空',
      entryHint: '保存到本机草稿；「一键提交」或「导出 ADIF」后写回仓库即正式入库',
      entrySaved: '已保存：{call} {date} — 记录在「本机草稿」，可一键提交或导出',
      entryRequired: '呼号、日期、波段、模式为必填项',

      importTitle: '导入 ADIF',
      importHint: '从 WSJT-X / N1MM / Log4OM / LoTW / Clublog 等导出的 .adi 文件或文本，粘贴或选择文件导入。相同记录默认跳过，可勾选合并更新。',
      importMerge: '已存在记录用新值合并更新',
      importPlaceholder: '在此粘贴 ADIF 文本…',
      btnImport: '导入',
      importResult: '导入完成：新增 {added} 条，更新 {updated} 条，跳过重复 {skipped} 条',
      importNone: '未解析到任何 QSO 记录，请检查格式',
      importEmpty: '请先粘贴 ADIF 文本或选择文件',
      importError: '解析失败：{msg}',

      exportTitle: '导出 ADIF',
      exportHint: '导出后提交到仓库（git commit 或 GitHub 网页上传）即完成正式入库。推荐提交后点「清除本机草稿」。',
      btnExportAll: '下载完整日志', btnExportLocal: '下载本机草稿', btnCopy: '复制 ADIF',
      copied: 'ADIF 已复制到剪贴板', copyFail: '复制失败，请使用「下载」',

      draftTitle: '本机草稿',
      draftHint: '尚未提交到仓库的本地修改（只存在于当前浏览器）。',
      draftEmpty: '暂无未提交修改 ✓',
      draftAdded: '新增 {n} 条', draftUpdated: '修改 {n} 条', draftDeleted: '删除 {n} 条',
      btnClearDraft: '清除本机草稿',
      clearDraftConfirm: '确认清除本机所有草稿？仓库数据不受影响，但未提交的修改会丢失。',

      ghTitle: '一键提交到 GitHub',
      ghHint: '把本机草稿和卡片图片直接写回仓库，一次提交、自动重新部署，无需手动 git。',
      ghOwner: 'GitHub 用户名', ghRepo: '仓库名（如 ham-qsl-log）',
      ghBranch: '分支（默认 main）', ghToken: 'PAT 令牌（仅存于本浏览器）',
      btnGhSave: '保存设置', btnGhTest: '测试连接', btnGhClear: '清除令牌',
      ghSaved: '设置已保存到本浏览器',
      ghErrOwner: '用户名和仓库名必填', ghErrToken: '请填写 PAT 令牌',
      ghTesting: '正在测试连接…', ghTestOk: '{info}', ghTestFail: '连接失败：{msg}',
      ghCleared: '已清除令牌与设置',
      ghClearConfirm: '确认清除本机保存的 GitHub 令牌与设置？',
      ghImagesHint: '选择要一并上传的 QSL 卡片图片（可多选）；数据文件 data/log.adi 会自动包含全部日志，图片文件名建议 呼号_日期.jpg 以便自动登记。',
      ghImageItem: '{name}（{size} KB）',
      btnPush: '一键提交（{n} 个文件）',
      btnPushing: '正在提交…',
      ghPushing: '正在写入仓库（需 5-15 秒）…',
      ghPushOk: '提交成功（{sha}）。GitHub Actions 正在重新部署，1-2 分钟后生效。',
      ghPushFail: '提交失败：{msg}',
      ghNothing: '没有要提交的内容（无草稿、无图片）',

      cardsLoading: '正在加载卡片列表…',
      cardsEmpty: '还没有 QSL 卡片图片。将扫描图放入 qsl-cards/，并在 qsl-cards/manifest.json 登记（file / call / date 字段）。',
      cardsLoadFail: '无法加载 qsl-cards/manifest.json（{msg}）。\n把卡片扫描图放入 qsl-cards/ 目录，并在 manifest.json 中登记后即可在此展示。',
      cardsSearch: '按呼号筛选…', cardsCount: '共 {n} 张', cardsNoMatch: '无匹配卡片',

      initFail: '初始化失败：{msg}。请通过本地 HTTP 服务访问（如 python3 -m http.server），不要直接双击打开文件。'
    },

    /* ============================================================ English */
    'en': {
      navSatellites:'Satellite tools',satellitesDescription:'Follow the orbit. Plan your next contact through space.',satelliteName:'Satellite',propagationMode:'Propagation mode',
      themeSystem:'System theme',themeLight:'Light mode',themeDark:'Dark mode',
      mapLoadFailed: 'Map temporarily unavailable.', adminLogin: 'Station admin', liveUnavailable: 'Live data is unavailable. Showing the repository snapshot.',
      mapNeedsStation: 'Station location has not been published.',
      mapNoContacts: 'Station configured. Add contact grids or coordinates to see the coverage range.',
      mapCoverage: 'Farthest located contact {call} · approx. {km} km · {located}/{total} located, estimated from grids or coordinates',
      collectionPublicHint: 'A collection of QSL cards from around the world. The next greeting awaits.',

      workspace: 'ON THE AIR', myStation: 'My station', stationLabel: 'Amateur radio station',
      radioQuote: 'A world within reach.', skipContent: 'Skip to content',
      exportAction: 'Export ADIF', addContact: 'New contact',
      heroTitle: 'Every signal, a connection.', heroDescription: 'One callsign. A whole world to discover.',
      exploreStats: 'Explore your contacts', recentContacts: 'Contact log', rowHint: 'Select a contact to view details',
      logDescription: 'Keep every connection. Collect echoes from around the world.',
      statsDescription: 'Explore the bands, modes, and places your signal has reached.',
      qslDescription: 'A little card. A connection confirmed across the miles.',
      entryDescription: 'Capture a new connection and give every callsign a place.',
      cardsDescription: 'Greetings from around the world, collected one card at a time.',
      overviewTotal: 'Total contacts', overviewDxcc: 'DXCC entities', overviewConfirmed: 'Confirmed contacts', overviewBands: 'Active bands',
      totalFoot: 'Every callsign tells a story', dxccFoot: 'A world of radio to explore',
      confirmedFoot: '{n}% confirmed', bandsFoot: 'Across {n} operating modes',
      localPrivacy: 'Every connection deserves to be remembered.', resetFilters: 'Clear filters',
      pagerRange: 'Showing {from}–{to} of {n} contacts', noResults: 'No matching contacts. Try changing your filters.',
      collectionEmpty: 'Your first greeting awaits', collectionHint: 'Scan a QSL card and upload it in Entry / Import to keep a little piece of that connection.',
      addCard: 'Add a card', openRecord: 'View contact with {call}', closePreview: 'Close card preview',

      title: 'Amateur Radio QSL Logbook',
      titleWithCall: '{call} QSO Log · QSL Logbook',
      appName: 'Amateur Radio QSL Logbook',
      siteName: '{call} · QSL Logbook',
      appSub: 'QSO Log · QSL Card Exchange',
      navLog: 'QSO Log',
      navStats: 'Stats',
      navQsl: 'QSL Manager',
      navEntry: 'Entry / Import',
      navCards: 'QSL Cards',
      localBadge: '{n} local change(s) pending',
      footer: 'Connected by radio. Remembered in cards.',

      filterSearch: 'Search callsign / country / grid / satellite…',
      allBands: 'All Bands', allModes: 'All Modes', allYears: 'All Years', allCountries: 'All Countries',
      filterCount: '{n} records',

      thDate: 'Date', thCall: 'Callsign', thBand: 'Band', thMode: 'Mode',
      thRst: 'RST S/R', thGrid: 'Grid', thQslSent: 'QSL Sent', thQslRcvd: 'QSL Rcvd',
      logEmpty: 'No contacts have been published yet.',

      pagerPrev: 'Prev', pagerNext: 'Next',
      pagerInfo: 'Page {page} / {pages}', perPage: '{n}/page',

      fldCall: 'Callsign', fldDate: 'Date (UTC)', fldTime: 'Time (UTC)', fldBand: 'Band',
      fldMode: 'Mode', fldFreq: 'Freq (MHz)', fldRstS: 'RST Sent', fldRstR: 'RST Rcvd',
      fldGrid: 'Grid', fldIota: 'IOTA', fldDxcc: 'DXCC', fldCountry: 'Country',
      fldQslS: 'QSL Sent Status', fldQslSDate: 'Sent Date', fldQslR: 'QSL Rcvd Status', fldQslRDate: 'Rcvd Date',
      fldQslVia: 'QSL Via', fldQslMsg: 'QSL Message', fldComment: 'Comment',

      qslNone: 'Not marked',
      qslN: 'Not Sent', qslNRcvd: 'Not Rcvd', qslQ: 'Queued', qslQRcvd: 'Queued',
      qslR: 'Requested', qslRRcvd: 'Requested', qslY: 'Sent', qslYRcvd: 'Received',
      qslS: 'Submitted (3rd party)', qslSRcvd: 'Submitted', qslM: 'Bureau', qslMRcvd: 'Bureau',
      qslI: 'Ignored', qslIRcvd: 'Ignored', qslDash: '—',

      btnMarkSent: 'Mark QSL Sent', btnMarkQueue: 'Mark Queued',
      btnMarkRcvd: 'Mark QSL Rcvd', btnRequestCard: 'Request Card',
      btnEdit: 'Edit', btnDelete: 'Delete',
      detailHint: 'Changes are saved locally; they take effect after committing',
      deleteConfirm: 'Delete record {call} {date}?\n(Removal is staged locally, effective after commit)',

      statTotal: 'Total QSOs', statDxcc: 'DXCC Entities', statCountries: 'Countries',
      statConfirmed: 'Confirmed (QSL/LoTW)', statSent: 'QSL Cards Sent', statRcvd: 'QSL Cards Rcvd',
      chartBand: 'QSOs by Band', chartMode: 'QSOs by Mode',
      chartMonth: 'QSOs per Month', chartYear: 'QSOs per Year',
      chartLoadFail: 'Chart library not loaded',

      qslSummaryConfirmed: 'Confirmed', qslSummaryToSend: 'To Send', qslSummaryToRcvd: 'To Receive',
      qslSummaryOverdue: 'Overdue (>{n}d no reply)',
      qslOverdueTitle: 'Overdue — sent {n}+ days, no reply',
      qslToSendTitle: 'To Send / Not Sent',
      qslToRcvdTitle: 'To Receive',
      qslConfirmedTitle: 'Confirmed',
      qslEmpty: '(empty)',
      btnMarkSentShort: 'Mark Sent', btnMarkQueueShort: 'Mark Queued',
      btnMarkRcvdShort: 'Mark Rcvd', btnRequestShort: 'Request Card',
      btnUndoRcvd: 'Clear Rcvd', btnUndoSent: 'Clear Sent',

      entryTitle: 'New QSO Record',
      entryEditTitle: 'Edit: {call} {date}',
      btnSave: 'Save Record', btnReset: 'Clear',
      entryHint: 'Saved to local draft; commit via "Push" or "Export ADIF" to finalize',
      entrySaved: 'Saved: {call} {date} — now in local draft; push or export to commit',
      entryRequired: 'Callsign, date, band and mode are required',

      importTitle: 'Import ADIF',
      importHint: 'Paste or pick .adi files/text exported from WSJT-X / N1MM / Log4OM / LoTW / Clublog etc. Duplicates are skipped; tick "merge" to update existing records.',
      importMerge: 'Merge existing records with new values',
      importPlaceholder: 'Paste ADIF text here…',
      btnImport: 'Import',
      importResult: 'Imported: {added} added, {updated} updated, {skipped} skipped',
      importNone: 'No QSO records found, please check the format',
      importEmpty: 'Paste ADIF text or choose a file first',
      importError: 'Parse failed: {msg}',

      exportTitle: 'Export ADIF',
      exportHint: 'Export and commit to the repository (git or GitHub web upload) to finalize. Clear local drafts after committing.',
      btnExportAll: 'Download Full Log', btnExportLocal: 'Download Local Draft', btnCopy: 'Copy ADIF',
      copied: 'ADIF copied to clipboard', copyFail: 'Copy failed, use "Download" instead',

      draftTitle: 'Local Draft',
      draftHint: 'Local changes not yet committed (this browser only).',
      draftEmpty: 'No pending changes ✓',
      draftAdded: '{n} added', draftUpdated: '{n} updated', draftDeleted: '{n} deleted',
      btnClearDraft: 'Clear Local Draft',
      clearDraftConfirm: 'Clear all local drafts? Repository data is safe, but uncommitted changes will be lost.',

      ghTitle: 'Push to GitHub',
      ghHint: 'Write local drafts and card images back to the repository in one commit with auto redeploy — no git needed.',
      ghOwner: 'GitHub username', ghRepo: 'Repository name (e.g. ham-qsl-log)',
      ghBranch: 'Branch (default main)', ghToken: 'PAT token (stored locally only)',
      btnGhSave: 'Save Settings', btnGhTest: 'Test Connection', btnGhClear: 'Clear Token',
      ghSaved: 'Settings saved to this browser',
      ghErrOwner: 'Username and repository are required', ghErrToken: 'Please enter the PAT token',
      ghTesting: 'Testing connection…', ghTestOk: '{info}', ghTestFail: 'Connection failed: {msg}',
      ghCleared: 'Token and settings cleared',
      ghClearConfirm: 'Clear the saved GitHub token and settings?',
      ghImagesHint: 'Pick QSL card images to upload (multi-select). data/log.adi is always included. Name files like callsign_date.jpg for auto-registration.',
      ghImageItem: '{name} ({size} KB)',
      btnPush: 'Push ({n} files)',
      btnPushing: 'Pushing…',
      ghPushing: 'Writing to repository (5–15s)…',
      ghPushOk: 'Pushed ({sha}). GitHub Actions is redeploying; live in 1–2 min.',
      ghPushFail: 'Push failed: {msg}',
      ghNothing: 'Nothing to push (no drafts or images)',

      cardsLoading: 'Loading card list…',
      cardsEmpty: 'No QSL card images yet. Put scans into qsl-cards/ and register them in qsl-cards/manifest.json (file / call / date fields).',
      cardsLoadFail: 'Failed to load qsl-cards/manifest.json ({msg}).\nPut card scans into the qsl-cards/ folder and register them in manifest.json to display them here.',
      cardsSearch: 'Filter by callsign…', cardsCount: '{n} cards', cardsNoMatch: 'No matching cards',

      initFail: 'Init failed: {msg}. Serve via a local HTTP server (e.g. python3 -m http.server); do not open the file directly.'
    }
  };

  let lang = 'zh-CN';
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (SUPPORTED.includes(saved)) lang = saved;
  } catch (e) { /* ignore */ }

  /* 取文案，支持 {param} 插值 */
  function t(key, params) {
    let s = (messages[lang] && messages[lang][key]) ?? messages['zh-CN'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split('{' + k + '}').join(String(v));
      }
    }
    return s;
  }

  /* 应用 [data-i18n] 静态文本 */
  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
  }

  function setLang(l) {
    if (!SUPPORTED.includes(l)) l = 'zh-CN';
    lang = l;
    try { localStorage.setItem(LS_KEY, l); } catch (e) { /* ignore */ }
    document.documentElement.lang = l;
    applyStatic();
    if (window.App) {
      App.updateSiteHeader();
      App.updatePageHeading();
      App.renderAllTabs();

    }
  }

  function getLang() { return lang; }

  return { t, setLang, getLang, applyStatic, messages };
})();
