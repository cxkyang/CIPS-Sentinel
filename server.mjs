#!/usr/bin/env node
/**
 * LQ-Agent · Live Agent server
 * Zero-dependency Node server:
 *  - serves the static prototype
 *  - proxies OpenAI-compatible / Ollama chat completions (API key stays server-side)
 *  - runs a structured ReAct loop with deterministic mock banking tools
 *  - streams SSE events to live.html
 *
 * Usage:
 *   LLM_API_KEY=... node server.mjs
 *   LLM_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b node server.mjs
 *   node server.mjs            # no key => mock mode, UI still works
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { runForecast } from './forecast/engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local BEFORE reading PORT/HOST/config.
loadEnv(path.join(__dirname, '.env.local'));

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_STEPS = Number(process.env.MAX_AGENT_STEPS || 16);
const APPROVAL_TIMEOUT_MS = Number(process.env.APPROVAL_TIMEOUT_MS || 120000);

const CFG = {
  openai: {
    label: 'OpenAI-compatible',
    baseUrl: (process.env.LLM_BASE_URL || 'https://llm-tlndh47wd9ustbss.cn-beijing.maas.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, ''),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'qwen-plus'
  },
  ollama: {
    label: 'Ollama',
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, ''),
    apiKey: process.env.OLLAMA_API_KEY || 'ollama',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b'
  }
};

let healthCache = { openai: false, ollama: false, at: 0 };

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function safeHost(url) {
  try { return new URL(url).host; } catch { return url; }
}

async function probe(url, key) {
  try {
    const r = await fetch(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(2500)
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function getHealth() {
  const [openaiReachable, ollamaReachable] = await Promise.all([
    CFG.openai.apiKey ? probe(`${CFG.openai.baseUrl}/models`, CFG.openai.apiKey) : Promise.resolve(false),
    probe(`${CFG.ollama.baseUrl}/models`, CFG.ollama.apiKey)
  ]);
  healthCache = { openai: openaiReachable, ollama: ollamaReachable, at: Date.now() };
  const defaultProvider = openaiReachable ? 'openai' : (ollamaReachable ? 'ollama' : 'mock');
  return {
    ok: true,
    defaultProvider,
    providers: {
      openai: {
        configured: Boolean(CFG.openai.apiKey),
        reachable: openaiReachable,
        label: CFG.openai.label,
        model: CFG.openai.model,
        host: safeHost(CFG.openai.baseUrl)
      },
      ollama: {
        configured: true,
        reachable: ollamaReachable,
        label: CFG.ollama.label,
        model: CFG.ollama.model,
        host: safeHost(CFG.ollama.baseUrl)
      },
      mock: { configured: true, reachable: true, label: '确定性沙盘', model: 'scripted-v0.9', host: 'local' }
    },
    approvalTimeoutMs: APPROVAL_TIMEOUT_MS,
    maxSteps: MAX_STEPS
  };
}

/* ------------------------------------------------------------
   Deterministic banking tools (the model never invents numbers)
   ------------------------------------------------------------ */
const GOAL_CONTRACT = {
  objective: '16:30 前完成 1,284 笔跨境付款全额清算，日终 CIPS 余额 5.00–9.50 亿元，综合融资成本 ≤1.95%',
  constraints: {
    cips_min_balance_yi: 5.0,
    cips_max_balance_yi: 9.5,
    single_transfer_limit_yi: 3.0,
    daily_transfer_limit_yi: 4.0,
    approval_threshold_yi: 2.0,
    repo_limit_yi: 2.0,
    data_staleness_max_sec: 300,
    no_overdraft: true
  },
  priorities: ['P1 High 零延误', 'P2 Medium', 'P3 Low'],
  deadlines: { client_cutoff: '16:30', cips_cutoff: '17:00' }
};

const TOOL_CATALOG = [
  { name: 'cips.balance.query', args: {}, description: '查询 CIPS 账户可用余额、最低注资线、预警线' },
  { name: 'cips.queue.list', args: {}, description: '查询 CIPS 排队笔数、金额、P1 笔数' },
  { name: 'treats.position.query', args: {}, description: '查询 TREATS 可调头寸、调拨额度、FTP' },
  { name: 'forecast.run', args: {}, description: '运行 15 分钟粒度流动性预测，返回 P72 缺口' },
  { name: 'plan.generate', args: {}, description: '生成内部调拨 / 日间回购 / 同业回购 / 排队调整候选方案' },
  { name: 'policy.check', args: { action: 'string' }, description: '执行限额、授权、AML、重复支付等 12 项校验' },
  { name: 'treats.transfer.execute', args: { amount: 'number（亿元）', from: 'TREATS', to: 'CIPS' }, description: '执行内部调拨；单笔 ≥2.0 亿元触发 MKTY 交易授权，执行通道处理' },
  { name: 'repo.execute', args: { amount: 'number（亿元）' }, description: '执行日间回购' },
  { name: 'cips.queue.reprioritize', args: { p1First: 'boolean' }, description: '将 P1 High 付款前置' },
  { name: 'report.generate', args: {}, description: '生成日终归因与审计包' }
];

const TOOLS = {
  'cips.balance.query': {
    run: async () => ({
      ok: true, account: 'CIPS-DIRECT-001', balance_yi: 6.2, min_injection_yi: 5.0,
      warning_yi: 6.0, as_of: '10:42', source: 'CIPS adapter (sandbox)'
    })
  },
  'cips.queue.list': {
    run: async () => ({
      ok: true, queue_count: 23, queue_amount_yi: 2.4, p1_count: 4,
      as_of: '10:42', source: 'CIPS queue (sandbox)'
    })
  },
  'treats.position.query': {
    run: async () => ({
      ok: true, available_yi: 4.6, transfer_limit_yi: 4.0, used_yi: 0,
      ftp_pct: 1.82, as_of: '10:42', source: 'TREATS adapter (sandbox)'
    })
  },
  'forecast.run': {
    run: async () => {
      const f = runForecast();
      return {
        ok: true,
        gap_yi: f.gap_yi,
        at: f.at,
        p50_yi: f.p50_yi,
        p72_yi: f.p72_yi,
        p95_yi: f.p95_yi,
        confidence: f.coverage_p72,
        coverage_p72: f.coverage_p72,
        backtest_mae_yi: f.backtest_mae_yi,
        model_version: f.model_version,
        paths: f.paths,
        source: f.source,
        as_of: f.as_of,
        horizon: f.horizon
      };
    }
  },
  'plan.generate': {
    run: async () => ({
      ok: true,
      options: [
        { id: 'A', name: 'TREATS 2.2 亿 + 日间回购 0.8 亿', cost_wan: 9.24, latency_min: 10, risk: '低' },
        { id: 'B', name: '回购 2.0 亿 + 排队调整 1.0 亿', cost_wan: 10.8, latency_min: 25, risk: '中' },
        { id: 'C', name: '全部内部调拨 3.0 亿', cost_wan: 8.9, latency_min: 10, risk: '中' },
        { id: 'D', name: '排队调整 + 延后 0.8 亿', cost_wan: 2.1, latency_min: 0, risk: '高' }
      ],
      recommended: 'A', reason: '满足 SLA 与流动性底线，保留 1.2 亿缓冲，成本低于基准'
    })
  },
  'policy.check': {
    run: async (args) => ({
      ok: true, passed: 12, total: 12, action: args.action || 'treats.transfer.execute',
      checks: ['限额', '授权', 'AML', '制裁', '重复支付', '对手方', '账户状态', '数据新鲜度', '流动性底线', 'P1优先级', '截止时点', '幂等键'],
      source: 'Policy engine (sandbox)'
    })
  },
  'treats.transfer.execute': {
    approval: true,
    approvalReason: (args) => `单笔 ${normalizeAmount(args.amount)} 亿元，超过 2.0 亿元单签阈值`,
    run: async (args) => {
      const amount = normalizeAmount(args.amount);
      if (amount > 3.0) {
        return { ok: false, error: '超过单笔 3.00 亿元限额，未执行；请降低金额或拆分。', amount_yi: amount };
      }
      return {
        ok: true, txn: 'TXN-8842', amount_yi: amount, from: args.from || 'TREATS', to: args.to || 'CIPS',
        status: 'executed', cips_balance_after_yi: 8.8, settlement: 'T+0', source: 'TREATS adapter (sandbox)'
      };
    }
  },
  'repo.execute': {
    run: async (args) => {
      const amount = normalizeAmount(args.amount);
      if (amount > 2.0) {
        return { ok: false, error: '超过日间回购额度 2.00 亿元，未执行；请降低金额。', amount_yi: amount };
      }
      return {
        ok: true, repo_id: 'REPO-2210', amount_yi: amount, rate_pct: 1.95,
        status: 'executed', source: 'Money market adapter (sandbox)'
      };
    }
  },
  'cips.queue.reprioritize': {
    run: async (args) => ({
      ok: true, p1_first: args.p1First !== false, queue_count: 0, p1_cleared: 4,
      status: 'cleared', source: 'CIPS queue adapter (sandbox)'
    })
  },
  'report.generate': {
    run: async () => ({
      ok: true, cost_wan: 9.24, baseline_wan: 13.71, saving_wan: 4.47,
      annual_saving_wan: 1118, sla: '100%', hitl: 1,
      audit_id: 'LQ-AUDIT-20261019-0427', source: 'Audit service (sandbox)'
    })
  }
};

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n > 10000 ? Number((n / 1e8).toFixed(2)) : Number(n.toFixed(2));
}

function needsApproval(name, args) {
  return name === 'treats.transfer.execute' && normalizeAmount(args.amount) >= 2.0;
}

/* ------------------------------------------------------------
   Prompt + model call
   ------------------------------------------------------------ */
const SYSTEM_PROMPT = `你是 LQ-Agent，一名银行跨境流动性执行 Agent。你在 Goal Contract 约束下，通过逐步调用工具完成日内流动性管理。

你只能输出一个 JSON 对象，不能输出 Markdown、不能输出 JSON 之外的任何文字。

每一步的格式：
{"thought":"一句中文说明为什么做这一步","action":"工具名","args":{},"final":false}

任务结束时的格式：
{"thought":"一句中文说明","final":true,"answer":"给资金主管的最终摘要，必须包含缺口、方案、成本、SLA、MKTY 交易授权次数"}

可用工具：
${TOOL_CATALOG.map(t => `- ${t.name}: ${t.description} args=${JSON.stringify(t.args)}`).join('\n')}

强制规则：
1. 先调用 cips.balance.query、treats.position.query、forecast.run，再调用 plan.generate；不要重复调用已成功的工具。
2. 所有金额单位统一为“亿元”，只填数字，例如 2.2 表示 2.2 亿元。
3. treats.transfer.execute 单笔 ≥2.0 亿元会触发 MKTY 交易授权，工具会暂停；MKTY 批准后提交执行请求，等待执行通道回执，授权结果会以 observation 返回。
4. 不得编造任何数字。余额、排队、缺口、成本、SLA 只能使用工具 observation 中的值。
5. 最多 16 步；如果工具返回 rejected 或 error，必须重新规划，不得重复同一动作。
6. 高风险动作永远需要 MKTY 交易授权；你不能绕过。
7. 如果信息足够，调用 report.generate 后输出 final。
8. final answer 必须分别写清单日成本（万元）、综合融资成本率（%）、年化节约（万元）、SLA、MKTY 交易授权次数；不要把成本金额说成年化利率。`;

async function callModel(providerName, messages) {
  const cfg = CFG[providerName];
  if (!cfg) throw new Error(`未知 provider: ${providerName}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.LLM_TIMEOUT_MS || 60000));
  const started = Date.now();
  try {
    const body = {
      model: cfg.model,
      messages,
      temperature: 0.2,
      max_tokens: 700
    };
    if (providerName === 'openai') body.response_format = { type: 'json_object' };
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 400)}`);
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || '';
    return { content, model: data.model || cfg.model, usage: data.usage || null, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function parseModelJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

/* ------------------------------------------------------------
   SSE run orchestration
   ------------------------------------------------------------ */
const runs = new Map();

function sse(ctx, event, data) {
  if (ctx.aborted || ctx.res.writableEnded) return;
  ctx.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForApproval(ctx, approvalId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ctx.approval?.approvalId === approvalId) ctx.approval = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish({ approved: false, reason: 'timeout' }), timeoutMs);
    ctx.approval = { approvalId, resolve: finish };
  });
}

async function forceFinalAnswer(ctx, providerName, messages, trace) {
  // Hard stop for the live loop: never surface a raw "超过 N 步" error.
  // Ask the model one last time for a final-only response, then fall back
  // to a deterministic handover message.
  const nudge = `工具调用预算已用完（${MAX_STEPS} 步）。不要再调用任何工具。请只输出一个 JSON：
{"thought":"一句中文说明","final":true,"answer":"基于已有 observation 的最终摘要；必须写明缺口、方案、成本、SLA、MKTY 交易授权次数。若关键信息缺失，如实说明需要人工接管。"}`;
  messages.push({ role: 'user', content: nudge });
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (ctx.aborted) throw new Error('客户端已断开');
    sse(ctx, 'status', { message: `步数预算用尽，正在收口 final（${attempt}/2）…` });
    try {
      const modelResult = await callModel(providerName, messages);
      sse(ctx, 'model', { step: MAX_STEPS, model: modelResult.model, latencyMs: modelResult.latencyMs, usage: modelResult.usage });
      const parsed = parseModelJson(modelResult.content);
      if (parsed && (parsed.final === true || parsed.final === 'true')) {
        const answer = String(parsed.answer || '').trim();
        if (answer) {
          trace.push({ step: MAX_STEPS, type: 'final', text: answer });
          sse(ctx, 'final', { step: MAX_STEPS, answer, trace });
          return;
        }
      }
      messages.push({ role: 'assistant', content: modelResult.content || '' });
      messages.push({ role: 'user', content: '上一条没有给出 final。请只输出 final JSON，不要调用工具。' });
    } catch (err) {
      if (ctx.aborted) throw err;
      sse(ctx, 'error', { step: MAX_STEPS, message: `收口 final 失败：${String(err.message || err)}` });
    }
  }
  const toolCount = trace.filter((t) => t.type === 'tool').length;
  const answer = `模型在 ${MAX_STEPS} 步内未完成 final，已停止自动执行并转人工接管。已保留 ${toolCount} 个工具结果；没有执行未经授权的资金动作。请在 Agent Console 查看完整轨迹后重试，或由 MKTY / 执行通道人工处理。`;
  trace.push({ step: MAX_STEPS, type: 'final', text: answer });
  sse(ctx, 'final', { step: MAX_STEPS, answer, trace });
}

async function runLive(ctx, providerName, goal) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        goal,
        goal_contract: GOAL_CONTRACT,
        scenario: {
          date: '2026-10-19',
          payments: 1284,
          amount_yi: 21.6,
          expected_inflow_yi: 11.2,
          as_of: '10:42'
        },
        tools: TOOL_CATALOG
      })
    }
  ];
  const trace = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    if (ctx.aborted) throw new Error('客户端已断开');
    sse(ctx, 'status', { step, message: `第 ${step} 步：模型推理中…` });
    const modelResult = await callModel(providerName, messages);
    sse(ctx, 'model', {
      step,
      model: modelResult.model,
      latencyMs: modelResult.latencyMs,
      usage: modelResult.usage
    });

    const parsed = parseModelJson(modelResult.content);
    if (!parsed) {
      sse(ctx, 'error', { step, message: '模型输出不是合法 JSON，正在要求纠正…' });
      messages.push({ role: 'assistant', content: modelResult.content });
      messages.push({ role: 'user', content: '上一条不是合法 JSON。请只输出一个 JSON 对象，不要 Markdown，不要解释。' });
      continue;
    }

    const thought = String(parsed.thought || '').trim();
    if (thought) sse(ctx, 'thought', { step, text: thought });

    const isFinal = parsed.final === true || parsed.final === 'true';
    if (isFinal) {
      const answer = String(parsed.answer || '').trim();
      trace.push({ step, type: 'final', text: answer });
      sse(ctx, 'final', { step, answer, trace });
      return;
    }

    const action = String(parsed.action || '').trim();
    const args = parsed.args && typeof parsed.args === 'object' ? parsed.args : {};

    // A human rejection is sticky: never re-submit the same action for approval.
    if (ctx.rejected?.has(action)) {
      const blocked = { ok: false, blocked: true, message: `人工已拒绝 ${action}，不能重复提交；请改用其他工具，或直接 final 说明转人工接管。` };
      sse(ctx, 'tool_result', { step, name: action, result: blocked, latencyMs: 0 });
      messages.push({ role: 'assistant', content: modelResult.content });
      messages.push({ role: 'user', content: `Observation from ${action}: ${JSON.stringify(blocked)}\n不要再调用 ${action}。请选择其他工具或输出 final。` });
      continue;
    }

    const tool = TOOLS[action];
    if (!tool) {
      sse(ctx, 'error', { step, message: `模型调用了未知工具：${action || '(空)'}` });
      messages.push({ role: 'assistant', content: modelResult.content });
      messages.push({ role: 'user', content: `未知工具 ${action || '(空)'}。可用工具：${Object.keys(TOOLS).join(', ')}。请重新输出 JSON。` });
      continue;
    }

    sse(ctx, 'tool_call', { step, name: action, args });
    let result;

    if (tool.approval && needsApproval(action, args)) {
      const approvalId = crypto.randomUUID();
      const amount = normalizeAmount(args.amount);
      sse(ctx, 'approval_required', {
        step,
        approvalId,
        name: action,
        args,
        amount_yi: amount,
        reason: tool.approvalReason(args),
        expiresIn: APPROVAL_TIMEOUT_MS
      });
      const decision = await waitForApproval(ctx, approvalId, APPROVAL_TIMEOUT_MS);
      if (ctx.aborted) throw new Error('客户端已断开');
      sse(ctx, 'approval_result', {
        step,
        approvalId,
        approved: Boolean(decision.approved),
        approver: decision.approver || 'demo-authorizer',
        reason: decision.reason || null
      });
      if (!decision.approved) {
        ctx.humanRejected = true;
        if (!ctx.rejected) ctx.rejected = new Set();
        ctx.rejected.add(action);
        result = { ok: false, rejected: true, message: 'MKTY 拒绝或授权超时；请重新规划，不得重复同一动作。' };
        sse(ctx, 'tool_result', { step, name: action, result });
        messages.push({ role: 'assistant', content: modelResult.content });
        messages.push({ role: 'user', content: `Observation from ${action}: ${JSON.stringify(result)}\nMKTY 已拒绝该动作。不要再调用 ${action}。请使用 repo.execute、cips.queue.reprioritize 等替代方案，或输出 final 说明转人工接管。只输出 JSON。` });
        continue;
      }
      sse(ctx, 'execution', {
        step,
        executor: '执行通道',
        name: action,
        amount_yi: normalizeAmount(args.amount),
        message: 'MKTY 已授权，执行请求已提交，等待回执'
      });
    }

    const t0 = Date.now();
    result = await tool.run(args, ctx);
    const latencyMs = Date.now() - t0;
    sse(ctx, 'tool_result', { step, name: action, result, latencyMs });
    sse(ctx, 'execution_confirmed', {
      step,
      executor: '执行通道',
      name: action,
      result,
      message: '已收到执行通道回执'
    });
    trace.push({ step, type: 'tool', name: action, args, result });
    messages.push({ role: 'assistant', content: modelResult.content });
    messages.push({
      role: 'user',
      content: `Observation from ${action}: ${JSON.stringify(result)}\n继续下一步。只输出 JSON。`
    });
  }

  await forceFinalAnswer(ctx, providerName, messages, trace);
}

async function runMock(ctx, goal, { fallback = false } = {}) {
  const emit = async (event, data, delay = 380) => {
    if (ctx.aborted) throw new Error('客户端已断开');
    await sleep(delay);
    sse(ctx, event, data);
  };
  sse(ctx, 'status', { message: fallback ? '模型不可用，切换到确定性沙盘…' : 'Mock 模式：确定性沙盘推演' });
  await emit('thought', { step: 1, text: '先读取 CIPS 余额与 TREATS 头寸，建立同一事实。' });
  await emit('tool_call', { step: 1, name: 'cips.balance.query', args: {} });
  await emit('tool_result', { step: 1, name: 'cips.balance.query', result: await TOOLS['cips.balance.query'].run({}) });
  await emit('tool_call', { step: 2, name: 'treats.position.query', args: {} });
  await emit('tool_result', { step: 2, name: 'treats.position.query', result: await TOOLS['treats.position.query'].run({}) });
  await emit('tool_call', { step: 3, name: 'forecast.run', args: {} });
  const forecast = await TOOLS['forecast.run'].run({});
  await emit('tool_result', { step: 3, name: 'forecast.run', result: forecast });
  await emit('thought', { step: 4, text: `缺口 ${forecast.gap_yi.toFixed(2)} 亿（P72 @ ${forecast.at}），生成内部调拨 + 回购组合方案。` });
  await emit('tool_call', { step: 4, name: 'plan.generate', args: {} });
  await emit('tool_result', { step: 4, name: 'plan.generate', result: await TOOLS['plan.generate'].run({}) });
  await emit('tool_call', { step: 5, name: 'policy.check', args: { action: 'treats.transfer.execute' } });
  await emit('tool_result', { step: 5, name: 'policy.check', result: await TOOLS['policy.check'].run({ action: 'treats.transfer.execute' }) });

  const approvalId = crypto.randomUUID();
  sse(ctx, 'approval_required', {
    step: 6,
    approvalId,
    name: 'treats.transfer.execute',
    args: { amount: 2.2, from: 'TREATS', to: 'CIPS' },
    amount_yi: 2.2,
    reason: '单笔 2.20 亿元，超过 2.0 亿元单签阈值',
    expiresIn: APPROVAL_TIMEOUT_MS
  });
  const decision = await waitForApproval(ctx, approvalId, APPROVAL_TIMEOUT_MS);
  if (ctx.aborted) throw new Error('客户端已断开');
  sse(ctx, 'approval_result', {
    step: 6, approvalId, approved: Boolean(decision.approved),
    approver: decision.approver || 'demo-authorizer', reason: decision.reason || null
  });
  if (!decision.approved) {
    sse(ctx, 'tool_result', { step: 6, name: 'treats.transfer.execute', result: { ok: false, rejected: true } });
    sse(ctx, 'final', { step: 6, answer: 'MKTY 未批准，Agent 已停止执行并转人工接管。', trace: [] });
    return;
  }
  sse(ctx, 'execution', {
    step: 6,
    executor: '执行通道',
    name: 'treats.transfer.execute',
    amount_yi: 2.2,
    message: 'MKTY 已授权，执行请求已提交，等待回执'
  });
  await emit('tool_result', {
    step: 6, name: 'treats.transfer.execute',
    result: await TOOLS['treats.transfer.execute'].run({ amount: 2.2, from: 'TREATS', to: 'CIPS' })
  });
  sse(ctx, 'execution_confirmed', {
    step: 6,
    executor: '执行通道',
    name: 'treats.transfer.execute',
    message: '已收到执行通道回执'
  });
  await emit('tool_call', { step: 7, name: 'repo.execute', args: { amount: 0.8 } });
  await emit('tool_result', { step: 7, name: 'repo.execute', result: await TOOLS['repo.execute'].run({ amount: 0.8 }) });
  await emit('tool_call', { step: 8, name: 'report.generate', args: {} });
  await emit('tool_result', { step: 8, name: 'report.generate', result: await TOOLS['report.generate'].run({}) });
  await emit('final', {
    step: 9,
    answer: `目标达成：预测缺口 ${forecast.gap_yi.toFixed(2)} 亿元已抹平；采用 TREATS 2.20 亿元 + 回购 0.80 亿元；单日成本 9.24 万元，较基准 13.71 万元节约 4.47 万元；SLA 100%；MKTY 交易授权 1 次、执行通道确认 1 次。`,
    trace: []
  }, 200);
}

/* ------------------------------------------------------------
   HTTP
   ------------------------------------------------------------ */
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

async function handleApi(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return json(res, 200, await getHealth());
  }

  if (url.pathname === '/api/agent/run' && req.method === 'POST') {
    let body;
    try { body = await readJson(req); } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
    const requested = String(body.provider || process.env.LLM_PROVIDER || 'auto');
    const goal = String(body.goal || '').trim() || GOAL_CONTRACT.objective;
    let providerName;
    if (requested === 'mock') providerName = 'mock';
    else if (requested === 'openai') {
      if (!CFG.openai.apiKey) return json(res, 400, { ok: false, error: '未配置 LLM_API_KEY，无法使用 OpenAI-compatible。' });
      providerName = 'openai';
    } else if (requested === 'ollama') providerName = 'ollama';
    else {
      const h = await getHealth();
      providerName = h.defaultProvider;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.flushHeaders?.();

    const runId = crypto.randomUUID();
    const ctx = { runId, res, aborted: false, approval: null, providerName };
    runs.set(runId, ctx);
    const started = Date.now();
    const ping = setInterval(() => sse(ctx, 'ping', { t: Date.now() }), 15000);
    res.on('close', () => {
      ctx.aborted = true;
      if (ctx.approval) ctx.approval.resolve({ approved: false, reason: 'client_closed' });
      clearInterval(ping);
      runs.delete(runId);
    });

    sse(ctx, 'meta', {
      runId,
      mode: providerName === 'mock' ? 'mock' : 'live',
      provider: providerName,
      model: providerName === 'mock' ? 'scripted-v0.9' : CFG[providerName].model,
      goal,
      startedAt: new Date().toISOString()
    });

    try {
      if (providerName === 'mock') {
        await runMock(ctx, goal);
      } else {
        await runLive(ctx, providerName, goal);
      }
      sse(ctx, 'done', { runId, durationMs: Date.now() - started, provider: providerName });
    } catch (error) {
      const message = error?.name === 'AbortError' ? '模型请求超时' : (error?.message || '运行失败');
      if (ctx.humanRejected) {
        sse(ctx, 'final', { step: 0, answer: '人工已拒绝关键动作，Agent 已停止自动执行并转人工接管；未执行任何被拒绝的资金动作。', trace: [] });
        sse(ctx, 'done', { runId, durationMs: Date.now() - started, provider: providerName, humanRejected: true });
      } else if (providerName !== 'mock') {
        sse(ctx, 'error', { message });
        sse(ctx, 'fallback', { reason: '模型调用失败，自动切换到确定性沙盘。' });
        try {
          await runMock(ctx, goal, { fallback: true });
          sse(ctx, 'done', { runId, durationMs: Date.now() - started, provider: 'mock', fallback: true });
        } catch (fallbackError) {
          sse(ctx, 'error', { message: fallbackError.message || 'fallback 失败' });
        }
      } else {
        sse(ctx, 'error', { message });
      }
    } finally {
      clearInterval(ping);
      setTimeout(() => { if (!res.writableEnded) res.end(); }, 50);
      setTimeout(() => runs.delete(runId), 5000);
    }
    return;
  }

  if (url.pathname === '/api/agent/approve' && req.method === 'POST') {
    let body;
    try { body = await readJson(req); } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
    const ctx = runs.get(String(body.runId || ''));
    if (!ctx || !ctx.approval || ctx.approval.approvalId !== body.approvalId) {
      return json(res, 404, { ok: false, error: '授权请求不存在或已过期' });
    }
    const approve = Boolean(body.approved);
    const approver = String(body.approver || 'MKTY · 林岚');
    ctx.approval.resolve({ approved: approve, approver, reason: approve ? null : 'human_rejected' });
    return json(res, 200, { ok: true, approved: approve, approver });
  }

  if (url.pathname === '/api/agent/cancel' && req.method === 'POST') {
    let body = {};
    try { body = await readJson(req); } catch {}
    const ctx = runs.get(String(body.runId || ''));
    if (ctx) {
      ctx.aborted = true;
      if (ctx.approval) ctx.approval.resolve({ approved: false, reason: 'cancelled' });
      sse(ctx, 'cancelled', {});
    }
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { ok: false, error: 'Not found' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8'
};

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method not allowed'); return; }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/live') pathname = '/live.html';
  if (pathname.includes('..') || /(^|\/)\.env/.test(pathname) || pathname.includes('/.git')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const file = path.join(__dirname, pathname);
  if (!file.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('not file');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': stat.size
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) { await handleApi(req, res, url); return; }
    await serveStatic(req, res, url);
  } catch (error) {
    if (!res.headersSent) json(res, 500, { ok: false, error: error.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  const openai = CFG.openai.apiKey ? 'configured' : 'no key';
  const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`LQ-Agent server: http://${displayHost}:${PORT} (bind ${HOST})`);
  console.log(`  OpenAI-compatible: ${openai} · ${CFG.openai.model}`);
  console.log(`  Ollama: ${CFG.ollama.model} @ ${CFG.ollama.baseUrl}`);
  console.log(`  Mock: always available`);
});
