/* ============================================================================
 * adif.js — ADIF (Amateur Data Interchange Format) 解析器 / 序列化器
 * 规范参考: http://www.adif.org.uk/314/ADIF_314.htm
 * 纯原生 JS，无任何依赖。字段长度按 UTF-8 字节计算（符合 ADIF 3.x 规范）。
 * 对外暴露全局对象: ADIF
 * ==========================================================================*/
'use strict';

const ADIF = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // 按字节数截取子串，并返回被消费的 JS 字符串长度（UTF-16 code units）
  function sliceByBytes(text, start, byteLen) {
    const sub = text.slice(start);
    const bytes = encoder.encode(sub);
    const valueBytes = bytes.subarray(0, byteLen);
    return decoder.decode(valueBytes);
  }

  // 序列化时字段推荐顺序（ADIF 惯例顺序）
  const FIELD_ORDER = [
    'CALL', 'QSO_DATE', 'TIME_ON', 'TIME_OFF', 'BAND', 'MODE', 'SUBMODE',
    'FREQ', 'RST_SENT', 'RST_RCVD', 'GRIDSQUARE', 'IOTA', 'DXCC', 'COUNTRY',
    'QSL_SENT', 'QSL_RCVD', 'QSL_SENT_DATE', 'QSL_RCVD_DATE', 'QSL_VIA',
    'QSLMSG', 'LOTW_QSL_SENT', 'LOTW_QSL_RCVD', 'EQSL_QSL_SENT', 'EQSL_QSL_RCVD',
    'APP_QSL_NOTE', 'COMMENT'
  ];

  // QSL 状态枚举 → i18n key（文案由 I18N.t 渲染，见 i18n.js）
  const QSL_STATUS = {
    N: { labelKey: 'qslN', labelRcvdKey: 'qslNRcvd', color: 'gray' },
    Y: { labelKey: 'qslY', labelRcvdKey: 'qslYRcvd', color: 'green' },
    R: { labelKey: 'qslR', labelRcvdKey: 'qslRRcvd', color: 'orange' },
    Q: { labelKey: 'qslQ', labelRcvdKey: 'qslQRcvd', color: 'blue' },
    I: { labelKey: 'qslI', labelRcvdKey: 'qslIRcvd', color: 'gray' },
    S: { labelKey: 'qslS', labelRcvdKey: 'qslSRcvd', color: 'blue' },
    M: { labelKey: 'qslM', labelRcvdKey: 'qslMRcvd', color: 'teal' }
  };

  /* ------------------------------------------------------------------ 解析 */
  // text: ADIF 字符串 → { header: {TAG:value,...}, records: [{TAG:value,...}] }
  function parse(text) {
    const header = {};
    const records = [];
    let current = null;
    // 无 <EOH> 的文件（只有记录）也合法，此时所有字段都属于记录
    let inHeader = /<EOH(?::\d+)?\s*>/i.test(text);

    let i = 0;
    const n = text.length;
    while (i < n) {
      const lt = text.indexOf('<', i);
      if (lt === -1) break;
      const gt = text.indexOf('>', lt + 1);
      if (gt === -1) break;

      // 支持 <TAG:len>、<TAG:len:type>、以及无长度的 <EOH>/<EOR>
      const inner = text.slice(lt + 1, gt);
      const colon = inner.indexOf(':');
      let tag, fieldLen = null;
      if (colon === -1) {
        tag = inner.trim().toUpperCase();
      } else {
        tag = inner.slice(0, colon).trim().toUpperCase();
        const numMatch = inner.slice(colon + 1).trim().match(/^(\d+)/);
        if (!numMatch) { i = gt + 1; continue; }
        fieldLen = parseInt(numMatch[1], 10);
      }

      if (tag === 'EOH') { inHeader = false; i = gt + 1; continue; }
      if (tag === 'EOR') {
        if (current) { records.push(current); current = null; }
        i = gt + 1;
        continue;
      }
      if (fieldLen === null) { i = gt + 1; continue; }

      const valueStart = gt + 1;
      if (valueStart > n) break;
      const value = sliceByBytes(text, valueStart, fieldLen);
      i = valueStart + value.length; // 已消费的 code units

      if (inHeader) {
        header[tag] = value;
      } else {
        if (!current) current = {};
        current[tag] = value;
      }
    }
    if (current) records.push(current); // 容错：文件末尾没有 <EOR>
    return { header, records };
  }

  /* --------------------------------------------------------------- 序列化 */
  function encodeField(tag, value) {
    if (value === undefined || value === null || value === '') return '';
    const v = String(value);
    const bytes = encoder.encode(v).length;
    return `<${tag}:${bytes}>${v}`;
  }

  // records: [{TAG:value,...}] → ADIF 字符串（字段间以空格分隔，可读性好）
  function serialize(records, options = {}) {
    const { header } = options;
    const lines = [];
    if (header) {
      const h = [];
      for (const [k, v] of Object.entries(header)) h.push(encodeField(k, v));
      lines.push(h.join(' ') + ' <EOH>');
    }
    for (const rec of records) {
      const fields = [];
      const keys = FIELD_ORDER.filter(k => rec[k] !== undefined && rec[k] !== null && rec[k] !== '');
      const extraKeys = Object.keys(rec).filter(k => !FIELD_ORDER.includes(k));
      for (const k of keys.concat(extraKeys)) fields.push(encodeField(k, rec[k]));
      fields.push('<EOR>');
      lines.push(fields.join(' '));
    }
    return lines.join('\r\n') + '\r\n';
  }

  /* --------------------------------------------------------------- 工具 */
  // 生成稳定记录 ID（用于去重 / 覆盖层合并）
  function recordId(rec) {
    return [rec.CALL, rec.QSO_DATE, rec.TIME_ON, rec.BAND, rec.MODE]
      .map(s => (s || '').toUpperCase())
      .join('|');
  }

  // 字段名大写、值去除首尾空白
  function normalize(rec) {
    const out = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v === undefined || v === null) continue;
      out[k.toUpperCase()] = String(v).trim();
    }
    return out;
  }

  // 合并记录：b 覆盖 a 的同名字段（去空白字段）
  function mergeFields(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined || v === null || v === '') delete out[k];
      else out[k] = String(v).trim();
    }
    return out;
  }

  function qslStatusInfo(code, isRcvd) {
    const info = QSL_STATUS[String(code || '').toUpperCase()] || { labelKey: 'qslDash', color: 'gray' };
    return {
      code: String(code || '').toUpperCase() || 'N',
      labelKey: isRcvd ? (info.labelRcvdKey || info.labelKey) : info.labelKey,
      color: info.color
    };
  }

  // 展示用：通联详情行
  function prettyDate(adifDate) {
    if (!adifDate || adifDate.length !== 8) return adifDate || '—';
    return `${adifDate.slice(0, 4)}-${adifDate.slice(4, 6)}-${adifDate.slice(6, 8)}`;
  }

  function prettyTime(adifTime) {
    if (!adifTime) return '—';
    const t = String(adifTime).padEnd(6, '0');
    return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
  }

  return { parse, serialize, recordId, normalize, mergeFields, qslStatusInfo, prettyDate, prettyTime, QSL_STATUS };
})();
