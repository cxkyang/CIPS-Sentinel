/* Agent Console · real model run via local SSE server */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const API_BASE = location.protocol === 'file:' ? 'http://127.0.0.1:8787' : '';
const EMPTY_HTML = $('#traceList')?.innerHTML || '';

const state = {
  health: null,
  provider: 'auto',
  running: false,
  runId: null,
  approval: null,
  controller: null,
  startedAt: 0,
  timer: null
};

function setHealthPill(text, cls = '') {
  const pill = $('#healthPill');
  if (!pill) return;
  pill.className = `live-pill ${cls}`;
  pill.innerHTML = `<span class="live-dot"></span>${text}`;
}

function setHealthBox(text, cls = '') {
  const box = $('#healthBox');
  if (!box) return;
  box.className = `health-box ${cls}`;
  box.textContent = text;
}

function showError(message) {
  const box = $('#errorBox');
  if (!box) return;
  box.hidden = false;
  box.textContent = message;
}

function clearError() {
  const box = $('#errorBox');
  if (box) { box.hidden = true; box.textContent = ''; }
}

function providerLabel(name) {
  return ({ auto: '自动', openai: 'OpenAI 兼容', ollama: 'Ollama', mock: 'Mock 沙盘' })[name] || name;
}

function updateProviderInfo() {
  const el = $('#providerInfo');
  if (!el) return;
  if (!state.health) {
    el.textContent = '服务端未连接。请先运行 node server.mjs，再刷新本页。';
    return;
  }
  const p = state.health.providers || {};
  if (state.provider === 'openai') {
    const x = p.openai;
    el.innerHTML = `<b>${x?.model || '—'}</b> · ${x?.host || '—'}<br>${x?.configured ? (x.reachable ? '已配置 · 连通正常' : '已配置 · 但 /models 探测失败') : '未配置 LLM_API_KEY'}`;
  } else if (state.provider === 'ollama') {
    const x = p.ollama;
    el.innerHTML = `<b>${x?.model || '—'}</b> · ${x?.host || '—'}<br>${x?.reachable ? '本地 Ollama 已连接' : '未检测到 Ollama，请先 ollama serve'}`;
  } else if (state.provider === 'mock') {
    el.innerHTML = `<b>scripted-v0.9</b> · 确定性沙盘<br>不调用模型，用于离线保底演示。`;
  } else {
    const d = state.health.defaultProvider;
    const x = p[d];
    el.innerHTML = `<b>自动 → ${providerLabel(d)}</b> · ${x?.model || '—'}<br>${d === 'mock' ? '当前无可用模型，将使用沙盘。' : '优先使用已配置且可达的模型。'}`;
  }
}

function applyHealth(h) {
  state.health = h;
  const p = h.providers || {};
  const openai = p.openai?.reachable;
  const ollama = p.ollama?.reachable;
  if (openai) {
    setHealthPill('OpenAI 已连接', 'ok');
    setHealthBox(`服务已连接 · 默认 ${providerLabel(h.defaultProvider)} · ${p.openai.model}${ollama ? ' · Ollama 也可用' : ''}`, 'ok');
  } else if (ollama) {
    setHealthPill('Ollama 已连接', 'ok');
    setHealthBox(`服务已连接 · 默认 Ollama · ${p.ollama.model}${p.openai?.configured ? ' · OpenAI 已配置但不可达' : ''}`, 'ok');
  } else {
    setHealthPill('Mock 兜底', 'warn');
    setHealthBox(`服务已连接 · 当前无可用模型，自动模式使用 Mock。${p.openai?.configured ? ' OpenAI 已配置但不可达。' : ' 未配置 LLM_API_KEY。'}`, 'warn');
  }
  updateProviderInfo();
}

async function loadHealth() {
  try {
    const r = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const h = await r.json();
    applyHealth(h);
    return h;
  } catch (error) {
    state.health = null;
    setHealthPill('服务未启动', 'bad');
    setHealthBox('无法连接 /api/health。请在项目目录运行：node server.mjs，然后打开 http://127.0.0.1:8787/live.html', 'bad');
    updateProviderInfo();
    return null;
  }
}

function setRunning(on) {
  state.running = on;
  const run = $('#runBtn');
  const stop = $('#stopBtn');
  if (run) {
    run.disabled = on;
    run.innerHTML = on ? '<svg class="icon sm"><use href="#i-refresh"/></svg>运行中…' : '<svg class="icon sm"><use href="#i-play"/></svg>运行真实推演';
  }
  if (stop) stop.disabled = !on;
  $$('.provider-tab').forEach((b) => { b.disabled = on; });
  if (on) {
    state.startedAt = Date.now();
    clearInterval(state.timer);
    state.timer = setInterval(updateElapsed, 500);
  } else {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function updateElapsed() {
  if (!state.running || !state.startedAt) return;
  const s = Math.floor((Date.now() - state.startedAt) / 1000);
  const meta = $('#runMeta');
  if (meta && state.runId) meta.textContent = `${state.runId.slice(0, 8)} · ${providerLabel(state.provider)} · ${s}s`;
}

function resetTrace() {
  const list = $('#traceList');
  if (list) list.innerHTML = EMPTY_HTML;
  if ($('#finalBox')) $('#finalBox').hidden = true;
  if ($('#approvalBox')) $('#approvalBox').hidden = true;
  clearError();
  state.approval = null;
  const meta = $('#runMeta');
  if (meta) meta.textContent = '尚未开始 · 等待运行';
}

function addTrace({ tag, tagClass = '', step = '', name = '', text = '', json = null, cls = '' }) {
  const list = $('#traceList');
  if (!list) return;
  const empty = list.querySelector('.empty-state');
  if (empty) list.innerHTML = '';
  const item = document.createElement('div');
  item.className = `trace-item ${cls}`;
  const head = document.createElement('div');
  head.className = 'trace-head';
  if (tag) {
    const t = document.createElement('span');
    t.className = `trace-tag ${tagClass}`;
    t.textContent = tag;
    head.appendChild(t);
  }
  if (step !== '' && step !== null && step !== undefined) {
    const s = document.createElement('span');
    s.className = 'trace-step';
    s.textContent = `STEP ${String(step).padStart(2, '0')}`;
    head.appendChild(s);
  }
  if (name) {
    const n = document.createElement('span');
    n.className = 'trace-name';
    n.textContent = name;
    head.appendChild(n);
  }
  const time = document.createElement('span');
  time.className = 'trace-time';
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  head.appendChild(time);
  item.appendChild(head);
  if (text) {
    const p = document.createElement('div');
    p.className = 'trace-text';
    p.textContent = text;
    item.appendChild(p);
  }
  if (json !== null) {
    const pre = document.createElement('pre');
    pre.className = 'trace-json';
    pre.textContent = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    item.appendChild(pre);
  }
  list.appendChild(item);
  list.scrollTop = list.scrollHeight;
}

function handleEvent(event, data) {
  switch (event) {
    case 'meta':
      state.runId = data.runId;
      $('#runMeta').textContent = `${data.runId.slice(0, 8)} · ${providerLabel(data.provider)} · ${data.model}`;
      addTrace({ tag: 'META', tagClass: '', step: '', name: data.model, text: `运行 ${data.runId.slice(0, 8)} · ${providerLabel(data.provider)} · ${data.mode}`, cls: 'status' });
      break;
    case 'status':
      addTrace({ tag: 'STATUS', tagClass: '', step: data.step || '', text: data.message || '', cls: 'status' });
      break;
    case 'model':
      addTrace({ tag: 'MODEL', tagClass: '', step: data.step, name: data.model, text: `延迟 ${data.latencyMs}ms${data.usage ? ` · tokens ${data.usage.total_tokens || '—'}` : ''}`, cls: 'model' });
      break;
    case 'thought':
      addTrace({ tag: 'THOUGHT', tagClass: 'thought', step: data.step, text: data.text || '', cls: 'thought' });
      break;
    case 'tool_call':
      addTrace({ tag: 'TOOL CALL', tagClass: 'tool', step: data.step, name: data.name, json: data.args || {}, cls: 'tool_call' });
      break;
    case 'tool_result':
      addTrace({
        tag: data.result?.ok === false ? 'TOOL ERROR' : 'TOOL RESULT',
        tagClass: data.result?.ok === false ? 'err' : 'result',
        step: data.step,
        name: data.name,
        text: data.latencyMs ? `耗时 ${data.latencyMs}ms` : '',
        json: data.result,
        cls: 'tool_result'
      });
      break;
    case 'approval_required':
      state.approval = { ...data, runId: state.runId };
      showApproval(data);
      addTrace({
        tag: 'HUMAN GATE', tagClass: 'result', step: data.step, name: data.name,
        text: `${data.reason}。执行已暂停，等待 MKTY 交易授权。`,
        cls: 'approval'
      });
      break;
    case 'execution':
      addTrace({
        tag: 'EXECUTION', tagClass: 'result', step: data.step, name: data.executor,
        text: `${data.message || '执行请求已提交'} · ${data.name || ''}${data.amount_yi ? ` · ${Number(data.amount_yi).toFixed(2)} 亿` : ''}`,
        cls: 'execution'
      });
      break;
    case 'execution_confirmed':
      addTrace({
        tag: 'CONFIRMED', tagClass: 'result', step: data.step, name: data.executor,
        text: `${data.message || '已收到执行通道回执'} · ${data.name || ''}`,
        cls: 'execution'
      });
      break;
    case 'approval_result':
      hideApproval();
      addTrace({
        tag: data.approved ? 'APPROVED' : 'REJECTED', tagClass: data.approved ? 'thought' : 'err', step: data.step,
        text: `${data.approved ? 'MKTY 已批准' : 'MKTY 已拒绝'} · ${data.approver || '—'}${data.reason ? ` · ${data.reason}` : ''}`,
        cls: data.approved ? 'thought' : 'error'
      });
      break;
    case 'final':
      showFinal(data.answer, data.step);
      break;
    case 'error':
      showError(data.message || '运行错误');
      addTrace({ tag: 'ERROR', tagClass: 'err', step: data.step || '', text: data.message || '运行错误', cls: 'error' });
      break;
    case 'fallback':
      addTrace({ tag: 'FALLBACK', tagClass: 'result', text: data.reason || '切换到沙盘', cls: 'fallback' });
      break;
    case 'done':
      setRunning(false);
      hideApproval();
      if ($('#runMeta')) $('#runMeta').textContent = `${String(state.runId || '').slice(0, 8)} · ${providerLabel(data.provider || state.provider)} · 完成 · ${((data.durationMs || 0) / 1000).toFixed(1)}s`;
      break;
    case 'cancelled':
      setRunning(false);
      hideApproval();
      addTrace({ tag: 'STOPPED', tagClass: '', text: '运行已停止。', cls: 'status' });
      break;
    case 'ping':
      break;
    default:
      break;
  }
}

function showApproval(data) {
  const box = $('#approvalBox');
  if (!box) return;
  box.hidden = false;
  $('#approvalAmount').innerHTML = `¥${Number(data.amount_yi || 0).toFixed(2)}<small> 亿</small>`;
  $('#approvalReason').textContent = `${data.name || ''} · ${data.reason || ''}。批准后提交执行请求；拒绝则停止自动执行，转人工接管。`;
  $('#approveBtn').disabled = false;
  $('#rejectBtn').disabled = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideApproval() {
  const box = $('#approvalBox');
  if (box) box.hidden = true;
  state.approval = null;
}

function showFinal(answer, step) {
  hideApproval();
  const box = $('#finalBox');
  if (!box) return;
  box.hidden = false;
  $('#finalText').textContent = answer || '（模型未返回 final answer）';
  $('#finalMeta').textContent = `STEP ${String(step || '').padStart(2, '0')} · ${providerLabel(state.provider)} · ${state.runId ? state.runId.slice(0, 8) : ''}`;
  const list = $('#traceList');
  if (list) list.scrollTop = list.scrollHeight;
}

async function approve(approved) {
  if (!state.approval) return;
  const a = state.approval;
  $('#approveBtn').disabled = true;
  $('#rejectBtn').disabled = true;
  try {
    const r = await fetch(`${API_BASE}/api/agent/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: a.runId, approvalId: a.approvalId, approved, approver: '林岚 · MKTY' })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    addTrace({ tag: approved ? 'APPROVE' : 'REJECT', tagClass: approved ? 'thought' : 'err', step: a.step, text: approved ? 'MKTY 已授权，执行请求已提交，等待回执…' : 'MKTY 已拒绝，停止自动执行并转人工接管…', cls: approved ? 'thought' : 'error' });
  } catch (error) {
    showError(`授权提交失败：${error.message}`);
    $('#approveBtn').disabled = false;
    $('#rejectBtn').disabled = false;
  }
}

async function run() {
  clearError();
  hideApproval();
  resetTrace();
  if (!state.health) await loadHealth();
  if (!state.health) {
    showError('本地 Agent 服务未启动。请在项目目录运行 node server.mjs，然后打开 http://127.0.0.1:8787/live.html');
    return;
  }
  if (state.provider === 'openai' && !state.health.providers.openai?.configured) {
    showError('服务端未配置 LLM_API_KEY。请在 .env.local 中填入，或切换到 Ollama / Mock。');
    return;
  }
  const goal = $('#goalInput')?.value.trim() || '';
  if (!goal) {
    showError('请先填写目标契约。');
    return;
  }

  setRunning(true);
  state.runId = null;
  state.controller = new AbortController();
  addTrace({ tag: 'START', tagClass: 'thought', text: `目标已提交：${goal.slice(0, 120)}${goal.length > 120 ? '…' : ''}`, cls: 'thought' });

  try {
    const res = await fetch(`${API_BASE}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, provider: state.provider }),
      signal: state.controller.signal
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (!res.body) throw new Error('浏览器不支持流式响应');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        parseChunk(chunk);
      }
    }
    if (buffer.trim()) parseChunk(buffer);
  } catch (error) {
    if (error.name === 'AbortError') {
      addTrace({ tag: 'STOPPED', tagClass: '', text: '客户端已停止运行。', cls: 'status' });
    } else {
      showError(`运行失败：${error.message}。请确认 node server.mjs 已启动，且模型配置有效。`);
      addTrace({ tag: 'ERROR', tagClass: 'err', text: error.message, cls: 'error' });
    }
  } finally {
    setRunning(false);
    hideApproval();
  }
}

function parseChunk(chunk) {
  let event = 'message';
  const data = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (!data.length) return;
  try {
    handleEvent(event, JSON.parse(data.join('\n')));
  } catch (error) {
    console.warn('SSE parse error', error, chunk);
  }
}

async function stop() {
  if (!state.running) return;
  try {
    await fetch(`${API_BASE}/api/agent/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: state.runId })
    });
  } catch {}
  state.controller?.abort();
  setRunning(false);
  hideApproval();
}

function bindEvents() {
  $('#runBtn')?.addEventListener('click', run);
  $('#stopBtn')?.addEventListener('click', stop);
  $('#approveBtn')?.addEventListener('click', () => approve(true));
  $('#rejectBtn')?.addEventListener('click', () => approve(false));
  $('#clearBtn')?.addEventListener('click', () => {
    if (state.running) return;
    resetTrace();
    clearError();
  });
  $$('.provider-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (state.running) return;
      state.provider = tab.dataset.provider;
      $$('.provider-tab').forEach((x) => x.classList.toggle('active', x === tab));
      updateProviderInfo();
    });
  });
}

async function init() {
  bindEvents();
  await loadHealth();
}

init();
