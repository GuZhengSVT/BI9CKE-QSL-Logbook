/* ============================================================================
 * github.js — GitHub 一键提交集成
 * 通过 GitHub Git Data API 把文件原子提交（一次 commit）写回仓库：
 *   data/log.adi（完整日志）+ qsl-cards/*.jpg（卡片图）+ qsl-cards/manifest.json
 * 安全：PAT 令牌只存于当前浏览器 localStorage，请求仅发往 api.github.com
 * 对外暴露全局对象: GitHub
 * ==========================================================================*/
'use strict';

const GitHub = (() => {
  const LS_KEY = 'qsl_log_github_v1';
  const API = 'https://api.github.com';

  const DEFAULTS = { owner: '', repo: '', branch: 'main', token: '' };

  /* ------------------------------------------------------------- 配置 */
  function loadConfig() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...DEFAULTS };
      const o = JSON.parse(raw);
      return { ...DEFAULTS, ...o };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(LS_KEY);
  }

  /* ------------------------------------------------------------- API */
  async function api(path, method = 'GET', body = null) {
    const cfg = loadConfig();
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (cfg.token) headers.Authorization = 'Bearer ' + cfg.token;
    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.message) ? data.message : ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* --------------------------------------------------------- 连接测试 */
  async function test() {
    const cfg = loadConfig();
    if (!cfg.owner || !cfg.repo) throw new Error('请先填写 GitHub 用户名和仓库名');
    const repo = await api(`/repos/${cfg.owner}/${cfg.repo}`);
    const branchOk = await api(`/repos/${cfg.owner}/${cfg.repo}/branches/${cfg.branch || 'main'}`).catch(() => null);
    let info = `连接成功：${repo.full_name}（${repo.visibility}）`;
    if (!branchOk) info += `，⚠ 找不到分支 ${cfg.branch || 'main'}`;
    return info;
  }

  /* ------------------------------------------------------- 原子提交 */
  // files: [{ path, content, encoding: 'utf-8' | 'base64' }]
  // 流程: ref → blobs → tree(base_tree) → commit → 更新 ref
  async function pushFiles(files, message) {
    const cfg = loadConfig();
    if (!cfg.owner || !cfg.repo || !cfg.token) throw new Error('请先完成 GitHub 设置（用户名/仓库名/令牌）');
    if (!files || files.length === 0) throw new Error('没有要提交的文件');
    const repo = `${cfg.owner}/${cfg.repo}`;
    const branch = cfg.branch || 'main';

    // 1. 获取当前分支 head
    const ref = await api(`/repos/${repo}/git/ref/heads/${branch}`);
    const baseSha = ref.object.sha;

    // 2. 为每个文件创建 blob
    const treeItems = [];
    for (const f of files) {
      const blob = await api(`/repos/${repo}/git/blobs`, 'POST', {
        content: f.content,
        encoding: f.encoding || 'utf-8'
      });
      treeItems.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 3. 基于当前树创建新 tree
    const tree = await api(`/repos/${repo}/git/trees`, 'POST', {
      base_tree: baseSha,
      tree: treeItems
    });

    // 4. 创建 commit
    const commit = await api(`/repos/${repo}/git/commits`, 'POST', {
      message,
      tree: tree.sha,
      parents: [baseSha]
    });

    // 5. 快进更新分支引用（非 force；若仓库被他人改动会 409 失败）
    await api(`/repos/${repo}/git/refs/heads/${branch}`, 'PATCH', {
      sha: commit.sha,
      force: false
    });

    return { commitSha: commit.sha, repo, branch };
  }

  return { loadConfig, saveConfig, clearConfig, test, pushFiles };
})();
