// ============================================================
//  GitHub REST API: read the repository, write one commit with
//  all changes (Git Data API), follow the deploy workflow.
// ============================================================
import { GITHUB_API, GITHUB_API_VERSION, REPO_OWNER, REPO_NAME, BRANCH } from './config.js';

let token = '';
export const setToken = (t) => (token = t || '');
const repoPath = `/repos/${REPO_OWNER}/${encodeURIComponent(REPO_NAME)}`;

export class GitHubError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function gh(path, { method = 'GET', body, accept, as = 'json', signal } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${GITHUB_API}${path}`, {
    method,
    signal,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not json */
    }
    throw new GitHubError(res.status, data?.message || res.statusText, data);
  }
  if (res.status === 204) return null;
  if (as === 'text') return res.text();
  if (as === 'blob') return res.blob();
  return res.json();
}

// ---------- identity and access ----------
export const getUser = () => gh('/user');
export const getRepo = () => gh(repoPath);

// ---------- reading ----------
export async function getHead() {
  const ref = await gh(`${repoPath}/git/ref/heads/${BRANCH}`);
  const commit = await gh(`${repoPath}/git/commits/${ref.object.sha}`);
  return { sha: ref.object.sha, tree: commit.tree.sha, date: commit.committer?.date, message: commit.message };
}

/** All files of a commit's tree: Map path -> { sha, size } */
export async function getTree(treeSha) {
  const t = await gh(`${repoPath}/git/trees/${treeSha}?recursive=1`);
  const map = new Map();
  for (const e of t.tree) if (e.type === 'blob') map.set(e.path, { sha: e.sha, size: e.size });
  return { files: map, truncated: !!t.truncated };
}

export const getBlobText = (sha) => gh(`${repoPath}/git/blobs/${sha}`, { accept: 'application/vnd.github.raw+json', as: 'text' });
export const getBlobRaw = (sha) => gh(`${repoPath}/git/blobs/${sha}`, { accept: 'application/vnd.github.raw+json', as: 'blob' });

/** Paths changed between two commits. */
export async function changedSince(baseSha, headSha) {
  const cmp = await gh(`${repoPath}/compare/${baseSha}...${headSha}`);
  return new Set((cmp.files || []).flatMap((f) => [f.filename, f.previous_filename].filter(Boolean)));
}

// ---------- writing ----------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * One commit on top of `parentSha`.
 * changes: [{ path, text } | { path, file } | { path, sha } | { path, remove: true }]
 * onProgress(done, total) is called while blobs upload.
 */
export async function commitChanges({ parentSha, parentTree, message, changes, onProgress }) {
  const entries = [];
  let done = 0;
  for (const ch of changes) {
    let sha;
    if (ch.remove) sha = null;
    else if (ch.sha) sha = ch.sha;
    else if (ch.file) sha = (await gh(`${repoPath}/git/blobs`, { method: 'POST', body: { content: await fileToBase64(ch.file), encoding: 'base64' } })).sha;
    else sha = (await gh(`${repoPath}/git/blobs`, { method: 'POST', body: { content: ch.text, encoding: 'utf-8' } })).sha;
    entries.push({ path: ch.path, mode: '100644', type: 'blob', sha });
    onProgress?.(++done, changes.length);
  }
  const tree = await gh(`${repoPath}/git/trees`, { method: 'POST', body: { base_tree: parentTree, tree: entries } });
  const commit = await gh(`${repoPath}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [parentSha] } });
  await gh(`${repoPath}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
  return { sha: commit.sha, tree: tree.sha };
}

// ---------- deploy workflow ----------
export async function runForCommit(sha) {
  const r = await gh(`${repoPath}/actions/runs?head_sha=${sha}&per_page=5`);
  return r.workflow_runs?.[0] || null;
}
export async function latestRun() {
  const r = await gh(`${repoPath}/actions/runs?branch=${BRANCH}&per_page=1`);
  return r.workflow_runs?.[0] || null;
}

export const repoWebUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
