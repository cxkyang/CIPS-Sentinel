/* ============================================================
   CIPS Sentinel · 跨境流动性智驾舱
   Interaction / simulation layer
   ============================================================ */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad2 = (n) => String(n).padStart(2, '0');
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   Data
   ------------------------------------------------------------ */

const DATA = {
  runId: 'LQ-20261019-0427',
  date: '2026-10-19',
  scenario: {
    payments: 1284,
    amount: 21.6,
    min: 5.0,
    warning: 6.0,
    targetMax: 9.5,
    opening: 9.2,
    finalCips: 6.6,
    finalTreats: 1.2,
    gap: 2.9,
    cost: 9.24,
    baselineCost: 13.71,
    saving: 4.47,
    annualSaving: 1118,
    sla: 100,
    hitl: 1,
    decisionMinutes: 3.8
  },
  times: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
  series: {
    agent: [9.2, 8.6, 7.8, 8.8, 8.3, 7.8, 6.5, 5.0, 5.0, 6.6, 6.6],
    baseline: [9.2, 8.6, 7.8, 6.4, 5.9, 5.4, 4.1, 2.6, 4.4, 6.0, 6.0],
    costBaseline: [0, 0, 0, 0, 0, 0, 2.5, 6.0, 9.5, 12.4, 13.71],
    costAgent: [0, 0, 0, 0, 0.9, 1.4, 2.0, 3.8, 5.6, 7.4, 9.24]
  },
  steps: [
    {
      time: '09:02', title: '目标解析',
      desc: '把自然语言目标拆成 6 条硬约束、3 级优先级、2 个截止时点。',
      meta: ['goal.parse', 'policy.rag'],
      detail: {
        saw: '用户输入的今日流动性目标、清算日历、昨日头寸与授权矩阵。',
        did: '生成 Goal Contract，写入硬约束、优先级、截止时点与自主边界。',
        why: '先定义“什么不能破”，再谈优化；目标必须先变成可校验的契约。',
        guard: '目标可执行性校验通过；约束之间无冲突。',
        output: 'Goal Contract #LQ-1019-0427',
        evidence: ['1,284 笔', '¥21.6 亿', '16:30 / 17:00', 'P1 零延误']
      }
    },
    {
      time: '09:05', title: 'CIPS / CNAPS 对齐',
      desc: '对齐 CIPS / CNAPS 账户与行内头寸，识别 3 笔在途，差异归零。',
      meta: ['cips.balance', 'treats.position'],
      detail: {
        saw: 'CIPS 账户余额 9.20 亿；TREATS 可调头寸 4.60 亿；3 笔在途付款。',
        did: '建立账户快照，按指令号、金额、时间戳匹配，标记时序差异。',
        why: '数据不同源，必须先建立“同一事实”，否则预测与决策都会失真。',
        guard: '数据新鲜度 3 秒；双源交叉验证；对账差 0.00。',
        output: '账户快照 · 37 账户 / 1,284 笔 / 0 差异',
        evidence: ['37 账户', '1,284 笔', '3 笔在途', '差异 ¥0.00']
      }
    },
    {
      time: '09:12', title: '流动性预测',
      desc: '15 分钟粒度预测，15:00 缺口 2.90 亿（P72），置信度 92%。',
      meta: ['forecast.ts', 'scenario.tree'],
      detail: {
        saw: '历史 90 天流水、当日待清算指令、客户付款日历、CIPS 截止时点。',
        did: '生成 72 条情景路径，识别 P72 缺口 2.90 亿，标注峰值时点 15:00。',
        why: '不是单点预测，而是概率分布；用 P72 而不是均值，为不确定性留出缓冲。',
        guard: '预测置信度 92%，高于 85% 阈值；数据完整率 99.7%。',
        output: '缺口 2.90 亿 @ 15:00 · P72',
        evidence: ['P50 1.80 亿', 'P72 2.90 亿', 'P95 4.10 亿', '置信度 92%']
      }
    },
    {
      time: '10:42', title: '缺口确认',
      desc: '余额 6.20 亿，距预警线仅 0.20 亿；排队 23 笔 / 2.40 亿，触发决策。',
      meta: ['cips.queue', 'alert.raise'],
      detail: {
        saw: 'CIPS 余额 6.20 亿；排队 23 笔、合计 2.40 亿；P1 High 4 笔。',
        did: '触发“缺口确认”事件，将预测从背景态升级为决策态。',
        why: '预警线、排队、预测三重信号同时出现，不能再等下一个整点。',
        guard: '事件真实；非重复告警；P1 付款已标记。',
        output: '进入决策态 · 预计 15:00 余额 2.10 亿',
        evidence: ['余额 6.20 亿', '排队 23 笔', '2.40 亿', '距预警 0.20 亿']
      }
    },
    {
      time: '10:44', title: '方案生成',
      desc: '并行生成 4 套方案：内部调拨、日间回购、同业回购、排队调整。',
      meta: ['plan.generate', 'market.quote'],
      detail: {
        saw: 'TREATS 可用 4.60 亿、内部调拨额度剩余 4.00 亿；市场回购报价。',
        did: '生成 4 套可执行方案，覆盖不同成本、时延与风险组合。',
        why: '不在一个方案上“赌”，而是把可选空间先展开，再让约束筛选。',
        guard: '每套方案均带成本、时延、风险、限额四维标签。',
        output: '4 套候选方案 · 3 套可执行',
        evidence: ['内部 FTP 1.82%', '同业回购 2.42%', '日间回购 1.95%', '额度 4.00 亿']
      }
    },
    {
      time: '10:47', title: '仿真评分',
      desc: '组合方案成本 9.24 万、SLA 100%、残余风险低；优于单纯回购或排队方案。',
      meta: ['plan.simulate', 'risk.score'],
      detail: {
        saw: '4 套方案的成本、到账时延、限额占用、SLA 影响与残余风险。',
        did: '在数字孪生中回放 72 条情景，组合方案在 P95 情景下仍守住 5.00 亿底线。',
        why: '成本最低不等于最优；SLA 与流动性底线优先，成本在可行域内最小化。',
        guard: 'P95 压力情景通过；最大回撤 0.00；无超限。',
        output: '推荐组合：TREATS 2.2 亿 + 回购 0.8 亿',
        evidence: ['成本 9.24 万', 'SLA 100%', 'P95 通过', '限额内']
      }
    },
    {
      time: '10:49', title: '合规校验',
      desc: '限额、对手方、反洗钱、重复支付等 12 项检查全部通过。',
      meta: ['policy.check', 'aml.screen'],
      detail: {
        saw: '交易对手、账户、限额、反洗钱名单、重复支付指纹。',
        did: '执行 12 项前置校验，生成可审计的校验凭证。',
        why: 'Agent 可以快，但不能绕过任何一道确定性规则。',
        guard: '12/12 通过；无命中；重复支付指纹唯一。',
        output: '校验凭证 CHK-20261019-1129',
        evidence: ['限额 3.4/4.0 亿', 'AML 0 命中', '重复支付 0', '对手方 白名单']
      }
    },
    {
      time: '10:52', title: 'MKTY 交易授权',
      desc: '推送 MKTY，完成审批。',
      meta: ['HUMAN GATE', 'approval.request'],
      detail: {
        saw: '方案金额 3.00 亿，超过 2.00 亿单签阈值；MKTY 授权人林岚在线。',
        did: '生成一页式授权卡（金额、成本、到账时间、校验结果），推送企业微信。',
        why: '高风险动作必须由人按下最后一个按钮；Agent 负责把决策依据准备到“可批准”。',
        guard: '授权人身份校验通过；审批留痕；超时自动升级。',
        output: 'AP-20261019-0087 · 10:52 MKTY 批准',
        evidence: ['金额 3.00 亿', '成本 1.85%', '到账 10min', '校验 12/12']
      }
    },
    {
      time: '10:53', title: '授权后等待执行',
      desc: 'MKTY 已授权，执行请求已提交；Agent 等待执行通道回执，不把批准当成到账。',
      meta: ['SYSTEM', 'execution.request'],
      detail: {
        saw: 'MKTY 授权编号 AP-20261019-0087；执行请求已提交；执行通道尚未返回回执。',
        did: '进入 WAITING_EXECUTION，冻结余额更新，等待执行通道回执并按超时监控。',
        why: '授权是业务许可，不是资金到账；Agent 不能替执行通道宣告完成。',
        guard: '授权编号有效；执行请求幂等；30 分钟未回执则升级，不自动重试。',
        output: '已授权 · 等待执行回执',
        evidence: ['授权 10:52', '请求 10:53', '状态 等待中', '超时 30min']
      }
    },
    {
      time: '11:05', title: '执行确认',
      desc: '收到执行通道回执，校验授权编号与幂等键，按回执更新余额与头寸。',
      meta: ['SYSTEM', 'execution.confirm'],
      detail: {
        saw: '执行通道回执 2/2；授权编号匹配；CIPS 与 TREATS 状态已更新。',
        did: '核对授权编号与执行回执，写入执行确认，更新账本，不重复扣减。',
        why: '只有确认回执，才能证明动作真的发生；执行确认后才进入监控。',
        guard: '回执 2/2；幂等键唯一；账实差 0.00。',
        output: '执行确认 · 回执 2/2',
        evidence: ['回执 2/2', '授权匹配', '账实差 ¥0.00', '状态 已确认']
      }
    },
    {
      time: '14:10', title: '事件重规划',
      desc: '紧急付款 +1.20 亿、入账延迟 40 分钟；缺口重现，追加 1.20 亿内部调拨。',
      meta: ['event.replan', 'plan.patch'],
      detail: {
        saw: '新增 P1 紧急付款 1.20 亿；预计 15:30 入账延迟 40 分钟；余额预测跌至 3.80 亿。',
        did: '触发重规划，追加 1.20 亿内部调拨，保持 P1 付款优先，重新计算截止风险。',
        why: '连续执行不是“一次计划跑到底”，而是在事件发生时快速修正，不推倒重来。',
        guard: '追加后日累计调拨 3.40 亿 < 4.00 亿；授权复用；P1 零延误。',
        output: 'Plan v2 · 追加 1.20 亿 · 15:00 余额 5.00 亿',
        evidence: ['紧急 +1.20 亿', '延迟 40min', '累计 3.40 亿', '重规划 2.4s']
      }
    },
    {
      time: '17:00', title: '监控复核与日终归因',
      desc: '排队清零，SLA 100%，日终余额 6.60 亿；生成审计包。',
      meta: ['cips.queue.verify', 'report.generate'],
      detail: {
        saw: '全天资金动作、执行回执、市场价格、基准策略、SLA 与人工介入记录。',
        did: '复核队列、余额与回执，归因成本节约，生成审计包、复盘报告与下一日参数建议。',
        why: '执行确认不等于任务结束；还要确认结果、复盘与可追溯。',
        guard: 'SLA 100%；日终余额 6.60 亿；审计链完整。',
        output: '复核通过 · 审计包 + 复盘报告',
        evidence: ['排队 0', 'P1 4/4', '余额 6.60 亿', 'SLA 100%']
      }
    }
  ],
  kpis: [
    {
      key: 'cips', label: 'CIPS 实时账户余额', prefix: '¥', unit: '亿', decimals: 2,
      flag: '安全', flagClass: 'flag-safe', accent: 'var(--jade)',
      foot: '最低线 5.00 亿 · 安全垫 1.60 亿',
      spark: [9.2, 8.6, 7.8, 6.4, 6.2, 8.8, 8.3, 6.5, 5.0, 6.6]
    },
    {
      key: 'treats', label: 'CNAPS 实时账户余额', prefix: '¥', unit: '亿', decimals: 2,
      flag: '已对齐', flagClass: 'flag-safe', accent: 'var(--amber)',
      submetrics: [
        { label: 'CNAPS 实时可用头寸', value: '0.80', unit: '亿', key: 'cnapsAvail' },
        { label: '小额实时头寸', value: '0.40', unit: '亿', key: 'cnapsSmall' }
      ]
    },
    {
      key: 'gap', label: '预测峰值缺口', prefix: '¥', unit: '亿', decimals: 2,
      flag: '已抹平', flagClass: 'flag-safe', accent: 'var(--blue)',
      foot: '峰值 15:00 · P72 预测',
      spark: [0, 0, 2.9, 2.9, 2.9, 0, 0, 1.2, 0, 0]
    },
    {
      key: 'sla', label: 'SLA 达成率', prefix: '', unit: '%', decimals: 0,
      flag: '达标', flagClass: 'flag-safe', accent: 'var(--jade)',
      foot: '1,284 笔 · 0 笔超时',
      spark: [100, 100, 100, 100, 100, 100, 100, 99.8, 100, 100]
    },
    {
      key: 'hitl', label: '人工介入', prefix: '', unit: '次', decimals: 0,
      flag: '授权', flagClass: 'flag-neutral', accent: 'var(--amber)',
      foot: '决策 3.8 分钟 · 基准 45 分钟',
      spark: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    }
  ],
  stepKpi: {
    0: { cips: 9.2, treats: 4.6, gap: 0, cost: 0, sla: 100, hitl: 0 },
    3: { cips: 7.8, treats: 4.6, gap: 2.9, cost: 0, sla: 100, hitl: 0 },
    4: { cips: 6.2, treats: 4.6, gap: 2.9, cost: 0, sla: 100, hitl: 0 },
    8: { cips: 6.2, treats: 4.6, gap: 2.9, cost: 0, sla: 100, hitl: 0 },
    9: { cips: 6.2, treats: 4.6, gap: 2.9, cost: 0, sla: 100, hitl: 1 },
    10: { cips: 8.8, treats: 1.4, gap: 0, cost: 0, sla: 100, hitl: 1 },
    11: { cips: 6.5, treats: 1.4, gap: 1.2, cost: 0, sla: 99.8, hitl: 1 },
    12: { cips: 6.6, treats: 1.2, gap: 0, cost: 4.47, sla: 100, hitl: 1 }
  },
  queue: [
    { id: 'CIPS…0881', from: 'A 公司 → 新加坡', p: 'P1', amount: '0.42', due: '15:30', status: '排队中', cls: 'wait' },
    { id: 'CIPS…0882', from: 'B 公司 → 香港', p: 'P2', amount: '0.38', due: '16:00', status: '排队中', cls: 'wait' },
    { id: 'CIPS…0883', from: 'C 公司 → 卢森堡', p: 'P3', amount: '0.26', due: '16:30', status: '排队中', cls: 'wait' },
    { id: 'CIPS…0884', from: 'D 公司 → 胡志明', p: 'P2', amount: '0.51', due: '16:30', status: '排队中', cls: 'wait' },
    { id: 'CIPS…0885', from: 'E 公司 → 迪拜', p: 'P1', amount: '1.20', due: '15:30', status: '排队中', cls: 'wait' }
  ],
  options: [
    { rank: 'A', name: '组合调拨：TREATS 2.2 亿 + 回购 0.8 亿', sub: ['时延 10/40min', '风险 低', 'SLA 100%'], cost: '9.24 万', selected: true },
    { rank: 'B', name: '回购 2.0 亿 + 排队调整 1.0 亿', sub: ['回购 2.0 亿上限', '排队释放 1.0 亿', 'SLA 风险中'], cost: '10.80 万', selected: false },
    { rank: 'C', name: '全部内部调拨 3.0 亿', sub: ['时延 10min', '风险 中', '缓冲仅 1.4 亿'], cost: '8.90 万', selected: false },
    { rank: 'D', name: '排队调整 + 延后 0.8 亿', sub: ['时延 0', '风险 高', 'SLA 可能破'], cost: '2.10 万', selected: false }
  ],
  toolCalls: [
    { time: '09:02', name: 'goal.parse', out: '6 约束 / 3 优先级 / 2 截止', status: 'ok' },
    { time: '09:05', name: 'cips.balance.query', out: '9.20 亿 · 3s 新鲜度', status: 'ok' },
    { time: '09:05', name: 'treats.position.query', out: '4.60 亿 · 额度 4.00 亿', status: 'ok' },
    { time: '09:12', name: 'forecast.run', out: 'P72 缺口 2.90 亿', status: 'ok' },
    { time: '10:42', name: 'cips.queue.list', out: '23 笔 / 2.40 亿', status: 'ok' },
    { time: '10:44', name: 'plan.generate', out: '4 套候选 / 3 套可执行', status: 'ok' },
    { time: '10:47', name: 'plan.simulate', out: '9.24 万 / SLA 100%', status: 'ok' },
    { time: '10:49', name: 'policy.check', out: '12/12 通过', status: 'ok' },
    { time: '10:52', name: 'approval.request', out: '推送林岚 · AP-0087', status: 'ok' },
    { time: '10:53', name: 'execution.request', out: '已提交 · 等待回执', status: 'warn' },
    { time: '11:05', name: 'execution.confirm', out: '回执 2/2 · 已确认', status: 'ok' },
    { time: '14:10', name: 'event.replan', out: '+1.20 亿 / 延迟 40min', status: 'warn' },
    { time: '15:40', name: 'cips.queue.verify', out: '0 笔排队 / P1 4/4', status: 'ok' },
    { time: '17:00', name: 'report.generate', out: '审计包 + 复盘报告', status: 'ok' }
  ],
  guards: [
    { title: '数据可信', desc: '新鲜度 3s · 双源交叉 · 差异 0.00', icon: 'i-eye' },
    { title: '限额合规', desc: '单笔 2.20/3.00 亿 · 日累计 3.40/4.00 亿', icon: 'i-scale' },
    { title: 'MKTY 交易授权', desc: '10:52 林岚 · 企业微信 · AP-0087', icon: 'i-shield' },
    { title: '执行幂等', desc: 'TXN 去重 · 回执核验 · 冲正预案', icon: 'i-lock' }
  ],
  comparison: [
    ['系统定位', '跨境人民币清算网络（外部）', '行内资金交易与头寸管理（内部）'],
    ['账户与资金', 'CIPS 清算账户；直接参与者；<b>不得透支</b>', '行内账户 / 头寸；可内部调拨与交易'],
    ['数据时效', '报文 / 查询准实时；含排队与注资状态', '实时记账；分钟级头寸与限额'],
    ['关键约束', '最低注资限额、余额预警、排队优先级、日 / 夜场截止', '行内限额、FTP、授权矩阵、流动性指标'],
    ['可用工具', '注资 / 调增、排队查询 / 调整 / 撤销 / 救援、余额预警', '内部调拨、拆借、日间回购、同业回购'],
    ['成本口径', '外部融资、汇兑、托管成本', 'FTP、内部资金成本、机会成本'],
    ['主要风险', '排队、截止、透支禁止、对手方', '记账差错、限额超授、机会成本'],
    ['Agent 用法', '感知外部清算“水位”；执行注资与排队策略', '感知内部“水源”；执行调拨与融资'],
    ['数据粒度', '账户 / 报文 / 排队', '账户 / 交易 / 头寸 / 限额'],
    ['决策角色', '外部流动性「水位」', '内部流动性「水源」']
  ],
  recon: [
    { time: '10:03', type: '跨境付款', cips: '已清算 0.42 亿', treats: '在途', diff: '时序差异', result: '自动核销', cls: 'ok' },
    { time: '10:17', type: '手续费', cips: '扣费 1,280 元', treats: '未入账', diff: '费用差异', result: '自动核销', cls: 'ok' },
    { time: '11:05', type: '内部调拨', cips: '+2.20 亿', treats: '-2.20 亿', diff: '双边记账', result: '已匹配', cls: 'ok' },
    { time: '14:25', type: '内部调拨', cips: '+1.20 亿', treats: '-1.20 亿', diff: '双边记账', result: '已匹配', cls: 'ok' },
    { time: '16:42', type: '跨境入账', cips: '+1.60 亿', treats: '+1.60 亿', diff: '自动匹配', result: '已匹配', cls: 'ok' }
  ],
  sandboxPresets: [
    { id: 'base', name: '基准日', desc: '2.90 亿缺口 · 常规流水', peak: 0, delay: 0, rate: 0, repo: true, queue: true, replan: true },
    { id: 'surge', name: '大额付款 +3.0 亿', desc: '触发双签与回购', peak: 30, delay: 0, rate: 0, repo: true, queue: true, replan: true },
    { id: 'delay', name: 'CIPS 入账延迟 60min', desc: '峰值后移 · 缺口扩大', peak: 0, delay: 60, rate: 0, repo: true, queue: true, replan: true },
    { id: 'rate', name: '利率上行 50bp', desc: '外部融资变贵', peak: 0, delay: 0, rate: 50, repo: true, queue: true, replan: true }
  ],
  leaderboard: {
    team: [
      { name: '跨境金融一队', sub: '账户侦探 · 12 场景', score: 986 },
      { name: '资金营运部', sub: '流动性压力赛 · 9 场景', score: 942 },
      { name: '交易银行部', sub: '金剧本 · 7 场景', score: 918 },
      { name: '科技联合战队', sub: 'Agent 工程 · 6 场景', score: 887 },
      { name: '长三角分行联队', sub: '场景落地 · 5 场景', score: 861 }
    ],
    person: [
      { name: '林岚', sub: '资金营运部', score: 986 },
      { name: '周予安', sub: '跨境金融部', score: 962 },
      { name: '陈默', sub: '交易银行部', score: 941 },
      { name: '苏芮', sub: '金融科技部', score: 928 },
      { name: '顾言', sub: '长三角分行', score: 905 }
    ]
  }
};

const state = {
  step: 12,
  running: false,
  paused: false,
  approved: true,
  runId: 0,
  chartMetric: 'balance',
  leaderboard: 'team',
  sandboxPreset: 'base',
  sandboxToken: 0,
  approvalResolve: null,
  chartPoints: []
};

/* ------------------------------------------------------------
   Utilities
   ------------------------------------------------------------ */

function icon(name, cls = 'icon') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#${name}"/></svg>`;
}

function formatNumber(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

function animateNumber(el, to, { decimals = 2, duration = 700 } = {}) {
  if (!el) return;
  const from = parseFloat(el.textContent.replace(/,/g, '')) || 0;
  if (reducedMotion || duration <= 0) {
    el.textContent = formatNumber(to, decimals);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const p = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatNumber(from + (to - from) * eased, decimals);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function sparkline(points, color) {
  if (!points || points.length < 2) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * 120;
    const y = 31 - ((v - min) / span) * 25;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="kpi-spark" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".72" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function toast(title, message, type = 'ok') {
  const stack = $('#toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast${type === 'warn' ? ' warn' : ''}`;
  el.innerHTML = `${icon(type === 'warn' ? 'i-alert' : 'i-check', 'icon sm')}
    <div><b>${title}</b>${message ? `<br>${message}` : ''}</div>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, 4200);
}

/* ------------------------------------------------------------
   Rendering · KPI
   ------------------------------------------------------------ */

function renderKpis() {
  const grid = $('#kpiGrid');
  if (!grid) return;
  grid.innerHTML = DATA.kpis.map((k) => `
    <div class="kpi">
      <div class="kpi-top">
        <div class="kpi-label">${k.label}</div>
        <span class="kpi-flag ${k.flagClass}">${k.flag}</span>
      </div>
      <div class="kpi-value">
        ${k.prefix ? `<span class="cur">${k.prefix}</span>` : ''}
        <span class="v" data-kpi="${k.key}">${formatNumber(k.key === 'cost' ? 0 : k.key === 'sla' ? 100 : k.key === 'hitl' ? 0 : 0, k.decimals)}</span>
        <span class="u">${k.unit}</span>
      </div>
      ${k.submetrics ? `<div class="kpi-submetrics">${k.submetrics.map((s) => `<div class="kpi-submetric"><span>${s.label}</span><b><span data-subkpi="${s.key || ''}">${s.value}</span><small>${s.unit || '亿'}</small></b></div>`).join('')}</div>` : ''}
      ${k.foot ? `<div class="kpi-foot">${k.foot}</div>` : ''}
      ${k.spark ? sparkline(k.spark, k.accent) : ''}
    </div>
  `).join('');
}

function kpiValuesForStep(step) {
  const keys = Object.keys(DATA.stepKpi).map(Number).filter((k) => k <= step);
  const nearest = keys.length ? keys[keys.length - 1] : 0;
  return DATA.stepKpi[nearest];
}

function applyKpiValues(step, animate = true) {
  const values = kpiValuesForStep(step);
  DATA.kpis.forEach((k) => {
    const el = $(`[data-kpi="${k.key}"]`);
    if (!el) return;
    const value = values[k.key];
    if (animate && !reducedMotion) animateNumber(el, value, { decimals: k.decimals, duration: 620 });
    else el.textContent = formatNumber(value, k.decimals);
  });
  const t = values.treats;
  if (t != null) {
    const avail = $('[data-subkpi="cnapsAvail"]');
    const small = $('[data-subkpi="cnapsSmall"]');
    if (avail) avail.textContent = formatNumber(t * 2 / 3, 2);
    if (small) small.textContent = formatNumber(t / 3, 2);
  }
}

/* ------------------------------------------------------------
   Rendering · ledger
   ------------------------------------------------------------ */

function renderLedger(step) {
  const values = kpiValuesForStep(step);
  const cips = values.cips;
  const treats = values.treats;
  const cipsEl = $('#cipsBalance');
  const treatsEl = $('#treatsBalance');
  if (cipsEl) cipsEl.textContent = formatNumber(cips, 2);
  if (treatsEl) treatsEl.textContent = formatNumber(treats, 2);
  const cipsBar = $('#cipsBar');
  const treatsBar = $('#treatsBar');
  if (cipsBar) cipsBar.style.width = `${clamp((cips / 10) * 100, 2, 100)}%`;
  if (treatsBar) treatsBar.style.width = `${clamp((treats / 4) * 100, 2, 100)}%`;
  const sync = $('#syncMeta');
  if (sync) sync.textContent = step >= 12 ? '最近同步 3s 前 · 对账差 ¥0.00' : '最近同步 1s 前 · 对账差 ¥0.00';
}

/* ------------------------------------------------------------
   Rendering · steps
   ------------------------------------------------------------ */

function renderSteps(container, current, complete = false) {
  if (!container) return;
  container.innerHTML = DATA.steps.map((s, index) => {
    const n = index + 1;
    let cls = 'future';
    if (complete || n < current) cls = 'done';
    else if (n === current) cls = 'current';
    const dot = cls === 'done'
      ? icon('i-check', 'icon')
      : cls === 'current'
        ? '<span style="width:5px;height:5px;border-radius:50%;background:currentColor;display:block"></span>'
        : `<span style="font-size:7.5px;color:var(--text-3);font-family:var(--mono)">${pad2(n)}</span>`;
    return `<li class="step ${cls}" data-step="${n}" tabindex="0" aria-label="第 ${n} 步：${s.title}">
      <span class="step-dot">${dot}</span>
      <div class="step-title"><span>${s.title}</span><span class="step-time">${s.time}</span></div>
      <p class="step-desc">${s.desc}</p>
      <div class="step-meta">${s.meta.map((m) => `<span>${m}</span>`).join('')}</div>
    </li>`;
  }).join('');
}

function renderAllSteps(current = state.step, complete = !state.running && current === 12) {
  renderSteps($('#agentSteps'), current, complete);
  renderSteps($('#traceSteps'), current, complete);
}

function openStep(n) {
  const s = DATA.steps[n - 1];
  if (!s) return;
  $('#stepModalKicker').textContent = `STEP ${pad2(n)} · ${s.time}`;
  $('#stepModalTitle').textContent = s.title;
  const d = s.detail;
  $('#stepModalBody').innerHTML = `
    <div class="modal-section">
      <h4>${icon('i-eye', 'icon sm')}Agent 看到</h4>
      <p>${d.saw}</p>
    </div>
    <div class="modal-section">
      <h4>${icon('i-bolt', 'icon sm')}Agent 做了什么</h4>
      <p>${d.did}</p>
    </div>
    <div class="modal-section">
      <h4>${icon('i-target', 'icon sm')}为什么这样做</h4>
      <p>${d.why}</p>
    </div>
    <div class="modal-section">
      <h4>${icon('i-shield', 'icon sm')}闸门结果</h4>
      <p>${d.guard}</p>
    </div>
    <div class="modal-section">
      <h4>${icon('i-check', 'icon sm')}证据</h4>
      <div class="evidence">${d.evidence.map((e) => `<span>${e}</span>`).join('')}</div>
    </div>
    <div class="modal-section">
      <h4>${icon('i-git', 'icon sm')}输出 / 工具</h4>
      <dl class="kv">
        <dt>输出</dt><dd><b>${d.output}</b></dd>
        <dt>工具</dt><dd>${s.meta.join(' · ')}</dd>
      </dl>
    </div>
  `;
  openModal('stepModal');
}

/* ------------------------------------------------------------
   Rendering · queue / options / trace extras
   ------------------------------------------------------------ */

function renderQueue() {
  const tbody = $('#queueRows');
  if (!tbody) return;
  tbody.innerHTML = DATA.queue.map((q, i) => `
    <tr class="${q.jumped ? 'queue-jumped' : ''}">
      <td class="mono queue-id">${q.id}${q.jumped ? ' <span class="queue-jump-mark">已插队</span>' : ''}</td>
      <td class="name">${q.from}</td>
      <td><span class="pill ${q.p === 'P1' ? 'p1' : q.p === 'P2' ? 'p2' : 'p3'}">${q.p}</span></td>
      <td class="num">¥${q.amount} 亿</td>
      <td class="mono">${q.due}</td>
      <td><span class="pill ${q.cls}">${q.status}</span></td>
      <td>${q.jumped
        ? '<span class="queue-jumped-label">插队优先</span>'
        : `<button class="queue-jump" data-jump="${escAttr(q.id)}" aria-label="将 ${escAttr(q.id)} 插入队首">插队</button>`}</td>
    </tr>
  `).join('');
  $$('[data-jump]', tbody).forEach((btn) => {
    btn.addEventListener('click', () => jumpQueue(btn.dataset.jump));
  });
}

function escAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function jumpQueue(id) {
  const idx = DATA.queue.findIndex((q) => q.id === id);
  if (idx < 0) return;
  const [item] = DATA.queue.splice(idx, 1);
  DATA.queue.forEach((q) => { q.jumped = false; });
  item.jumped = true;
  DATA.queue.unshift(item);
  renderQueue();
  const note = $('#queueNote');
  if (note) note.textContent = `${id} 已插入队首 · 仅调整 CIPS 排队顺序，最终仍需 GPE 放行`;
  toast('已插队', `${id} 已调整到排队队首；排队顺序不等于支付放行，仍需 GPE 校验。`);
}

function renderOptions() {
  const list = $('#optionList');
  if (!list) return;
  list.innerHTML = DATA.options.map((o) => `
    <div class="option${o.selected ? ' selected' : ''}" tabindex="0" role="button" aria-pressed="${o.selected}">
      <div class="option-rank">${o.rank}</div>
      <div>
        <div class="option-name">${o.name}</div>
        <div class="option-sub">${o.sub.map((s) => `<span>${s}</span>`).join('')}</div>
      </div>
      <div class="option-cost">${o.cost}<span>单日成本</span></div>
    </div>
  `).join('');
  $$('.option', list).forEach((el) => {
    el.addEventListener('click', () => {
      $$('.option', list).forEach((x) => {
        x.classList.remove('selected');
        x.setAttribute('aria-pressed', 'false');
      });
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
      toast('方案已切换', '演示模式下仅更新选择状态，不改变已执行审计记录。');
    });
  });
}

function renderToolLog() {
  const log = $('#toolLog');
  if (!log) return;
  log.innerHTML = DATA.toolCalls.slice(-12).map((t) => `
    <div class="tool-item">
      <div class="tool-time">${t.time}</div>
      <div><div class="tool-name">${t.name}</div><div class="tool-out">${t.out}</div></div>
      <span class="tool-status ${t.status}">${t.status === 'ok' ? 'OK' : 'WARN'}</span>
    </div>
  `).join('');
}

function renderGuards() {
  const grid = $('#guardGrid');
  if (!grid) return;
  grid.innerHTML = DATA.guards.map((g) => `
    <div class="guard">
      ${icon(g.icon, 'icon')}
      <div><b>${g.title}</b><span>${g.desc}</span></div>
    </div>
  `).join('');
}

function renderComparison() {
  const tbody = $('#compareTable tbody');
  if (!tbody) return;
  tbody.innerHTML = DATA.comparison.map((row, i) => `
    <tr class="${i % 2 ? 'dim-row' : ''}">
      <td>${row[0]}</td>
      <td class="cips-cell">${row[1]}</td>
      <td class="treats-cell">${row[2]}</td>
    </tr>
  `).join('');
}

function renderRecon() {
  const tbody = $('#reconRows');
  if (!tbody) return;
  tbody.innerHTML = DATA.recon.map((r) => `
    <tr>
      <td class="mono" style="font-size:10px">${r.time}</td>
      <td class="name">${r.type}</td>
      <td>${r.cips}</td>
      <td>${r.treats}</td>
      <td><span class="pill info" style="font-size:8px">${r.diff}</span></td>
      <td><span class="pill ${r.cls}">${r.result}</span></td>
    </tr>
  `).join('');
}

/* ------------------------------------------------------------
   Rendering · charts
   ------------------------------------------------------------ */

const CHART = { w: 1180, h: 330, l: 48, r: 26, t: 22, b: 38 };

function chartGeometry() {
  return {
    plotW: CHART.w - CHART.l - CHART.r,
    plotH: CHART.h - CHART.t - CHART.b
  };
}

function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function interp(series, pos) {
  const i = Math.floor(pos);
  const f = pos - i;
  if (i >= series.length - 1) return series[series.length - 1];
  return series[i] + (series[i + 1] - series[i]) * f;
}

function renderLegend(metric) {
  const el = $('.chart-legend');
  if (!el) return;
  if (metric === 'gap') {
    el.innerHTML = `
      <span class="legend-item"><span class="legend-line dash"></span>无干预缺口</span>
      <span class="legend-item"><span class="legend-line"></span>Agent 剩余缺口</span>
      <span class="legend-item"><span class="legend-line threshold" style="background:repeating-linear-gradient(90deg,rgba(255,107,120,.75) 0 2px,transparent 2px 5px)"></span>最低注资线</span>
      <span class="legend-item"><span class="legend-dot"></span>Agent 动作</span>`;
  } else if (metric === 'cost') {
    el.innerHTML = `
      <span class="legend-item"><span class="legend-line dash"></span>基准累计成本</span>
      <span class="legend-item"><span class="legend-line"></span>Agent 累计成本</span>
      <span class="legend-item"><span class="legend-dot"></span>Agent 动作</span>`;
  } else {
    el.innerHTML = `
      <span class="legend-item"><span class="legend-line"></span>Agent 执行后余额</span>
      <span class="legend-item"><span class="legend-line dash"></span>无干预预测</span>
      <span class="legend-item"><span class="legend-line threshold"></span>预警线 6.00</span>
      <span class="legend-item"><span class="legend-line threshold" style="background:repeating-linear-gradient(90deg,rgba(255,107,120,.75) 0 2px,transparent 2px 5px)"></span>最低注资线 5.00</span>
      <span class="legend-item"><span class="legend-dot"></span>Agent 动作</span>`;
  }
}

function renderChart(metric = state.chartMetric, nowHour = null) {
  const svg = $('#liquidityChart');
  if (!svg) return;
  state.chartMetric = metric;
  renderLegend(metric);

  const { plotW, plotH } = chartGeometry();
  const times = DATA.times;
  const n = times.length;
  const xFor = (i) => CHART.l + (i / (n - 1)) * plotW;
  const xHour = (h) => CHART.l + ((h - 8) / 10) * plotW;

  const configs = {
    balance: {
      yMax: 10, unit: '亿元', step: 2,
      agent: DATA.series.agent, baseline: DATA.series.baseline,
      threshold: [{ v: 6, label: '预警 6.00', color: 'rgba(240,179,92,.72)' }, { v: 5, label: '最低 5.00', color: 'rgba(255,107,120,.62)' }],
      tip: (i) => [
        { label: 'Agent', value: `${DATA.series.agent[i].toFixed(2)} 亿`, color: 'var(--jade)' },
        { label: '无干预', value: `${DATA.series.baseline[i].toFixed(2)} 亿`, color: 'var(--red)' }
      ]
    },
    gap: {
      yMax: 3, unit: '亿元', step: 1,
      agent: DATA.series.agent.map((v) => Math.max(0, 5 - v)),
      baseline: DATA.series.baseline.map((v) => Math.max(0, 5 - v)),
      threshold: [{ v: 0, label: '底线缺口 0', color: 'rgba(62,224,176,.45)' }],
      tip: (i) => [
        { label: 'Agent 剩余', value: `${Math.max(0, 5 - DATA.series.agent[i]).toFixed(2)} 亿`, color: 'var(--jade)' },
        { label: '无干预缺口', value: `${Math.max(0, 5 - DATA.series.baseline[i]).toFixed(2)} 亿`, color: 'var(--red)' }
      ]
    },
    cost: {
      yMax: 16, unit: '万元', step: 4,
      agent: DATA.series.costAgent,
      baseline: DATA.series.costBaseline,
      threshold: [],
      tip: (i) => [
        { label: 'Agent 累计', value: `${DATA.series.costAgent[i].toFixed(2)} 万`, color: 'var(--jade)' },
        { label: '基准累计', value: `${DATA.series.costBaseline[i].toFixed(2)} 万`, color: 'var(--red)' }
      ]
    }
  };

  const cfg = configs[metric] || configs.balance;
  const yFor = (v) => CHART.t + (1 - clamp(v, 0, cfg.yMax) / cfg.yMax) * plotH;
  const pointsAgent = cfg.agent.map((v, i) => ({ x: xFor(i), y: yFor(v), v }));
  const pointsBase = cfg.baseline.map((v, i) => ({ x: xFor(i), y: yFor(v), v }));
  const agentPath = smoothPath(pointsAgent);
  const basePath = smoothPath(pointsBase);
  const areaPath = `${agentPath} L ${pointsAgent[pointsAgent.length - 1].x.toFixed(2)} ${(CHART.t + plotH).toFixed(2)} L ${pointsAgent[0].x.toFixed(2)} ${(CHART.t + plotH).toFixed(2)} Z`;

  const gridLines = [];
  for (let v = 0; v <= cfg.yMax; v += cfg.step) {
    const y = yFor(v);
    gridLines.push(`<line x1="${CHART.l}" y1="${y.toFixed(1)}" x2="${CHART.w - CHART.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.055)" stroke-width="1"/>`);
    gridLines.push(`<text x="${CHART.l - 9}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#617089" font-size="9" font-family="var(--mono)">${v}</text>`);
  }

  const xLabels = times.map((t, i) => {
    if (i % 2 !== 0) return '';
    return `<text x="${xFor(i).toFixed(1)}" y="${CHART.h - 12}" text-anchor="middle" fill="#617089" font-size="9" font-family="var(--mono)">${t}</text>`;
  }).join('');

  const thresholds = cfg.threshold.map((th) => {
    const y = yFor(th.v);
    return `<line x1="${CHART.l}" y1="${y.toFixed(1)}" x2="${CHART.w - CHART.r}" y2="${y.toFixed(1)}" stroke="${th.color}" stroke-width="1" stroke-dasharray="3 5" opacity=".8"/>
      <text x="${CHART.w - CHART.r - 2}" y="${(y - 5).toFixed(1)}" text-anchor="end" fill="${th.color}" font-size="8.5" font-family="var(--mono)">${th.label}</text>`;
  }).join('');

  const actionDefs = metric === 'balance' ? [
    { h: 10.7, label: '10:42 识别缺口', pos: 'above' },
    { h: 11.08, label: '11:05 执行调拨', pos: 'below' },
    { h: 14.42, label: '14:25 重规划', pos: 'above' }
  ] : [];
  const actions = actionDefs.map((a) => {
    const idx = ((a.h - 8) / 10) * (n - 1);
    const x = xHour(a.h);
    const y = yFor(interp(cfg.agent, idx));
    const labelY = a.pos === 'above' ? y - 16 : y + 22;
    return `<line x1="${x.toFixed(1)}" y1="${(y + 4).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(CHART.t + plotH).toFixed(1)}" stroke="rgba(125,168,255,.28)" stroke-width="1" stroke-dasharray="2 4"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#05080f" stroke="#7da8ff" stroke-width="1.6"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="none" stroke="rgba(125,168,255,.25)" stroke-width="1"/>
      <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" fill="#9db9ee" font-size="8.5" font-family="var(--sans)">${a.label}</text>`;
  }).join('');

  let nowMarkup = '';
  if (nowHour !== null && state.running) {
    const x = xHour(nowHour);
    nowMarkup = `<line x1="${x.toFixed(1)}" y1="${CHART.t}" x2="${x.toFixed(1)}" y2="${(CHART.t + plotH).toFixed(1)}" stroke="rgba(240,179,92,.55)" stroke-width="1" stroke-dasharray="2 4"/>
      <rect x="${(x - 17).toFixed(1)}" y="${CHART.t - 2}" width="34" height="14" rx="4" fill="rgba(240,179,92,.14)" stroke="rgba(240,179,92,.28)"/>
      <text x="${x.toFixed(1)}" y="${CHART.t + 8}" text-anchor="middle" fill="#f0b35c" font-size="7.5" font-family="var(--mono)">NOW</text>`;
  }

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaAgent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3ee0b0" stop-opacity=".24"/>
        <stop offset="65%" stop-color="#3ee0b0" stop-opacity=".06"/>
        <stop offset="100%" stop-color="#3ee0b0" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="areaBase" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ff6b78" stop-opacity=".10"/>
        <stop offset="100%" stop-color="#ff6b78" stop-opacity="0"/>
      </linearGradient>
      <filter id="glowJade" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    ${gridLines.join('')}
    ${thresholds}
    <path d="${areaPath}" fill="url(#areaAgent)"/>
    <path d="${basePath}" fill="none" stroke="#ff6b78" stroke-width="1.4" stroke-dasharray="4 5" opacity=".7"/>
    <path d="${agentPath}" fill="none" stroke="#3ee0b0" stroke-width="2.2" stroke-linecap="round" filter="url(#glowJade)"/>
    ${actions}
    ${nowMarkup}
    ${xLabels}
    <text x="${CHART.l}" y="13" fill="#617089" font-size="8.5" font-family="var(--sans)" letter-spacing="1">${cfg.unit}</text>
    <line x1="${CHART.l}" y1="${CHART.t + plotH}" x2="${CHART.w - CHART.r}" y2="${CHART.t + plotH}" stroke="rgba(255,255,255,.10)" stroke-width="1"/>
  `;

  state.chartPoints = times.map((t, i) => ({
    i, x: xFor(i), y: pointsAgent[i].y, time: t, tip: cfg.tip(i)
  }));
}

function initChartHover() {
  const wrap = $('#chartWrap');
  const svg = $('#liquidityChart');
  const tip = $('#chartTip');
  if (!wrap || !svg || !tip) return;
  const move = (event) => {
    const rect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (!rect.width) return;
    const vx = ((event.clientX - rect.left) / rect.width) * CHART.w;
    if (!state.chartPoints.length) return;
    let nearest = state.chartPoints[0];
    let min = Infinity;
    state.chartPoints.forEach((p) => {
      const d = Math.abs(p.x - vx);
      if (d < min) { min = d; nearest = p; }
    });
    if (min > 55) { tip.classList.remove('on'); return; }
    const left = (nearest.x / CHART.w) * rect.width;
    const top = (nearest.y / CHART.h) * rect.height;
    tip.innerHTML = `<div class="tip-time">${nearest.time}</div>` + nearest.tip.map((row) => `
      <div class="tip-row"><span class="lab"><span class="swatch" style="background:${row.color}"></span>${row.label}</span><b>${row.value}</b></div>
    `).join('');
    tip.style.left = `${clamp(left + 12, 8, wrapRect.width - 170)}px`;
    tip.style.top = `${clamp(top - 18, 4, rect.height - 70)}px`;
    tip.classList.add('on');
  };
  wrap.addEventListener('pointermove', move);
  wrap.addEventListener('pointerleave', () => tip.classList.remove('on'));
}

/* ------------------------------------------------------------
   Rendering · radar
   ------------------------------------------------------------ */

function renderRadar() {
  const svg = $('#radarChart');
  if (!svg) return;
  const cx = 180, cy = 148, R = 98;
  const axes = ['时效', '成本', '可控', '合规', '灵活', '数据'];
  const cips = [4, 3, 3, 5, 2, 4];
  const treats = [5, 4, 5, 4, 5, 5];
  const angle = (i) => (-90 + i * 60) * Math.PI / 180;
  const point = (i, v) => {
    const r = R * v / 5;
    return [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  };
  const poly = (arr) => arr.map((v, i) => point(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1].map((f) => {
    const pts = axes.map((_, i) => point(i, 5 * f).map((n) => n.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,${f === 1 ? '.10' : '.055'})" stroke-width="1"/>`;
  }).join('');
  const spokes = axes.map((_, i) => {
    const [x, y] = point(i, 5);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.055)" stroke-width="1"/>`;
  }).join('');
  const labels = axes.map((label, i) => {
    const [x, y] = point(i, 5.55);
    const cos = Math.cos(angle(i));
    const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" fill="#8b9ab0" font-size="9.5" font-family="var(--sans)">${label}</text>`;
  }).join('');
  const dots = (arr, color) => arr.map((v, i) => {
    const [x, y] = point(i, v);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#070c16" stroke="${color}" stroke-width="1.3"/>`;
  }).join('');

  svg.innerHTML = `
    ${rings}${spokes}
    <polygon points="${poly(cips)}" fill="rgba(62,224,176,.10)" stroke="#3ee0b0" stroke-width="1.6"/>
    <polygon points="${poly(treats)}" fill="rgba(240,179,92,.08)" stroke="#f0b35c" stroke-width="1.4" stroke-dasharray="3 3"/>
    ${dots(cips, '#3ee0b0')}
    ${dots(treats, '#f0b35c')}
    ${labels}
  `;
}

/* ------------------------------------------------------------
   Rendering · sandbox
   ------------------------------------------------------------ */

function renderSandboxPresets() {
  const list = $('#presetList');
  if (!list) return;
  list.innerHTML = DATA.sandboxPresets.map((p) => `
    <button class="preset${p.id === state.sandboxPreset ? ' active' : ''}" data-preset="${p.id}">
      <span><b>${p.name}</b><span>${p.desc}</span></span>
      <span class="p-arrow">→</span>
    </button>
  `).join('');
  $$('.preset', list).forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });
}

function currentSandboxInput() {
  const peak = Number($('#peakRange')?.value || 0);
  const delay = Number($('#delayRange')?.value || 0);
  const rate = Number($('#rateRange')?.value || 0);
  const repo = $('#repoToggle')?.classList.contains('on') ?? true;
  const queue = $('#queueToggle')?.classList.contains('on') ?? true;
  const replan = $('#replanToggle')?.classList.contains('on') ?? true;
  return { peak, delay, rate, repo, queue, replan };
}

function applyPreset(id) {
  const preset = DATA.sandboxPresets.find((p) => p.id === id);
  if (!preset) return;
  state.sandboxPreset = id;
  $('#peakRange').value = preset.peak;
  $('#delayRange').value = preset.delay;
  $('#rateRange').value = preset.rate;
  setToggle('repoToggle', preset.repo);
  setToggle('queueToggle', preset.queue);
  setToggle('replanToggle', preset.replan);
  updateSliderLabels();
  renderSandboxPresets();
  runSandbox();
}

function setToggle(id, on) {
  const el = $('#' + id);
  if (!el) return;
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', String(on));
}

function updateSliderLabels() {
  const peak = Number($('#peakRange')?.value || 0);
  const delay = Number($('#delayRange')?.value || 0);
  const rate = Number($('#rateRange')?.value || 0);
  $('#peakVal').textContent = `+${(peak / 10).toFixed(1)} 亿`;
  $('#delayVal').textContent = `${delay} 分钟`;
  $('#rateVal').textContent = `+${rate} bp`;
}

function computeSandbox() {
  const { peak, delay, rate, repo, queue, replan } = currentSandboxInput();
  let gap = 2.9 + (peak / 10) * 1.0 + (delay / 120) * 2.0;
  if (!repo) gap += 0.45;
  if (!queue) gap += 0.3;
  gap = Math.max(0.4, gap);
  if (!replan) gap += 0.55;
  let cost = 9.24 + Math.max(0, gap - 2.9) * 1.32 + rate * 0.022;
  if (!repo) cost += 0.8;
  if (!queue) cost += 0.4;
  let sla = 100 - Math.max(0, gap - 2.9) * 0.42 - (queue ? 0 : 0.8) - (repo ? 0 : 0.5) - (replan ? 0 : 0.4);
  sla = clamp(sla, 94.5, 100);
  const hitl = gap > 5 ? 2 : 1;
  let plan, tag, note;
  if (!replan && gap > 3.2) {
    plan = '人工接管：静态计划无法覆盖新缺口';
    tag = '需人工复核 · 自动重规划关闭';
    note = '关闭自动重规划后，Agent 在事件发生时只能告警，无法追加调拨。这展示了“连续执行”开关的业务含义：不是能力炫技，而是授权边界。';
  } else if (gap > 5) {
    plan = '内部调拨 3.4 亿 + 回购 2.5 亿';
    tag = '超单签 · 双签授权';
    note = '大额付款叠加后，缺口升至 5.90 亿，触发双签与更高回购额度。Agent 仍优先使用行内头寸，避免外部融资的时延与价差。';
  } else if (gap > 3.8) {
    plan = '内部调拨 2.8 亿 + 回购 1.6 亿';
    tag = '超单签 · 单签授权';
    note = '入账延迟使峰值后移，Agent 追加回购覆盖短端缺口；同时将 P1 付款前置，避免截止时点风险。';
  } else if (gap > 2.5) {
    plan = '组合调拨：TREATS 2.2 亿 + 日间回购 0.8 亿';
    tag = '限额内 · 单签授权';
    note = '当前场景下，Agent 在 10:42 提前识别缺口，优先使用行内头寸，较基准策略节约 4.47 万元，SLA 100%。';
  } else {
    plan = '内部调拨 1.6 亿 + 留存缓冲';
    tag = '限额内 · 低风险';
    note = '缺口可控，Agent 选择最小必要调拨，保留更多 TREATS 缓冲以应对尾部风险。';
  }
  return { gap, cost, sla, hitl, plan, tag, note, input: { peak, delay, rate, repo, queue, replan } };
}

function renderSandboxChart(gap) {
  const svg = $('#sandboxChart');
  if (!svg) return;
  const W = 900, H = 220, l = 38, r = 18, t = 16, b = 28;
  const pw = W - l - r, ph = H - t - b;
  const times = DATA.times;
  const n = times.length;
  const yMax = 10;
  const xFor = (i) => l + (i / (n - 1)) * pw;
  const yFor = (v) => t + (1 - clamp(v, 0, yMax) / yMax) * ph;
  const agent = DATA.series.agent.map((v, i) => {
    if (i >= 3 && i <= 7) return Math.max(4.2, v - Math.max(0, gap - 2.9) * 0.2);
    return v;
  });
  const base = DATA.series.baseline;
  const pa = agent.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const pb = base.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const pathA = smoothPath(pa);
  const pathB = smoothPath(pb);
  const area = `${pathA} L ${pa[pa.length - 1].x} ${t + ph} L ${pa[0].x} ${t + ph} Z`;
  const grid = [0, 2, 4, 6, 8, 10].map((v) => `<line x1="${l}" y1="${yFor(v)}" x2="${W - r}" y2="${yFor(v)}" stroke="rgba(255,255,255,.055)"/><text x="${l - 7}" y="${yFor(v) + 3}" text-anchor="end" fill="#617089" font-size="8" font-family="var(--mono)">${v}</text>`).join('');
  const minLine = `<line x1="${l}" y1="${yFor(5)}" x2="${W - r}" y2="${yFor(5)}" stroke="rgba(255,107,120,.6)" stroke-dasharray="3 5"/><text x="${W - r - 2}" y="${yFor(5) - 4}" text-anchor="end" fill="rgba(255,107,120,.8)" font-size="8" font-family="var(--mono)">最低 5.00</text>`;
  const xLabels = [0, 4, 6, 8, 10].map((i) => `<text x="${xFor(i)}" y="${H - 8}" text-anchor="middle" fill="#617089" font-size="8" font-family="var(--mono)">${times[i]}</text>`).join('');
  svg.innerHTML = `
    <defs><linearGradient id="sandArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ee0b0" stop-opacity=".2"/><stop offset="100%" stop-color="#3ee0b0" stop-opacity="0"/></linearGradient></defs>
    ${grid}${minLine}
    <path d="${area}" fill="url(#sandArea)"/>
    <path d="${pathB}" fill="none" stroke="#ff6b78" stroke-width="1.2" stroke-dasharray="4 4" opacity=".6"/>
    <path d="${pathA}" fill="none" stroke="#3ee0b0" stroke-width="2" stroke-linecap="round"/>
    ${xLabels}
    <text x="${l}" y="10" fill="#617089" font-size="8" font-family="var(--sans)" letter-spacing="1">CIPS 余额 · 亿元</text>
  `;
}

function renderSandboxResult(result, animate = true) {
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  set('#sandboxPlan', result.plan);
  const tag = $('#sandboxTag');
  if (tag) tag.innerHTML = `${icon('i-shield', 'icon sm')}${result.tag}`;
  const note = $('#sandboxNote');
  if (note) note.innerHTML = `${icon('i-alert', 'icon sm')}<span>${result.note}</span>`;
  const metrics = [
    { label: '预测缺口', value: result.gap.toFixed(2), unit: '亿', cls: result.gap > 3.5 ? 'red' : 'amber' },
    { label: '单日成本', value: result.cost.toFixed(2), unit: '万', cls: '' },
    { label: 'SLA', value: result.sla.toFixed(1), unit: '%', cls: result.sla >= 99.9 ? 'jade' : 'amber' },
    { label: 'MKTY 授权', value: String(result.hitl), unit: '次', cls: '' }
  ];
  const box = $('#sandboxMetrics');
  if (box) {
    box.innerHTML = metrics.map((m) => `
      <div class="result-metric"><span>${m.label}</span><b class="${m.cls}">${m.value}<span style="font-size:10px;color:var(--text-3);font-family:var(--sans);letter-spacing:0"> ${m.unit}</span></b></div>
    `).join('');
  }
  const costBar = $('#costBar');
  if (costBar) costBar.style.width = `${clamp(result.cost / 20 * 100, 18, 100)}%`;
  const costVal = $('#costBarVal');
  if (costVal) costVal.textContent = `${result.cost.toFixed(2)} 万`;
  const meta = $('#sandboxRunMeta');
  if (meta) meta.textContent = `最近推演 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })} · 用时 2.4s`;
  renderSandboxChart(result.gap);
}

function runSandbox() {
  const token = ++state.sandboxToken;
  const btn = $('#runSandboxBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `${icon('i-refresh', 'icon sm spin')}推演中…`;
  }
  const delay = reducedMotion ? 80 : 620;
  setTimeout(() => {
    if (token !== state.sandboxToken) return;
    const result = computeSandbox();
    renderSandboxResult(result);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${icon('i-bolt', 'icon sm')}运行沙盘推演`;
    }
    toast('沙盘推演完成', `缺口 ${result.gap.toFixed(2)} 亿 · 成本 ${result.cost.toFixed(2)} 万 · SLA ${result.sla.toFixed(1)}%`);
  }, delay);
}

/* ------------------------------------------------------------
   Rendering · leaderboard
   ------------------------------------------------------------ */

function renderLeaderboard(kind = state.leaderboard) {
  state.leaderboard = kind;
  $$('.lb-tab').forEach((b) => b.classList.toggle('active', b.dataset.lb === kind));
  const list = $('#leaderboard');
  if (!list) return;
  list.innerHTML = DATA.leaderboard[kind].map((row, i) => `
    <div class="lb-row">
      <div class="lb-rank">${pad2(i + 1)}</div>
      <div><div class="lb-name">${row.name}</div><div class="lb-sub">${row.sub}</div></div>
      <div class="lb-score">${row.score}<span>POINTS</span></div>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   Navigation / modals
   ------------------------------------------------------------ */

const VIEWS = ['demo', 'cockpit', 'trace', 'campaign'];

function setView(name, push = true) {
  if (!VIEWS.includes(name)) name = 'demo';

  // 演示模式与指挥舱共用同一套驾驶舱视图，避免复制 DOM 造成重复 ID。
  // 两者内容完全一致，仅「重播 90 秒推演」在演示模式显示。
  const viewName = name === 'demo' ? 'cockpit' : name;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${viewName}`));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));

  const replay = $('#replayBtn');
  if (replay) replay.style.display = name === 'demo' ? '' : 'none';

  if (push) history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const box = modal.querySelector('.modal');
  if (box) setTimeout(() => box.focus({ preventScroll: true }), 30);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-backdrop.open')) document.body.style.overflow = '';
}

function closeAllModals() {
  $$('.modal-backdrop.open').forEach((m) => {
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  });
  document.body.style.overflow = '';
}

/* ------------------------------------------------------------
   Run simulation
   ------------------------------------------------------------ */

const STEP_HOUR = [9.03, 9.08, 9.2, 10.7, 10.73, 10.78, 10.82, 10.87, 10.88, 11.08, 14.17, 17.0];

function setRunState(text) {
  const el = $('#runStateText');
  if (el) el.textContent = text;
}

function setScenarioClock(time) {
  const el = $('#scenarioClock');
  if (el) el.innerHTML = `T日 <b>${time}:00</b>`;
}

function setStepCounter(step) {
  const el = $('#stepCounter');
  if (el) el.textContent = `${pad2(step)}/12`;
}

function setReplayButton() {
  const btn = $('#replayBtn');
  if (!btn) return;
  if (state.running) {
    btn.innerHTML = state.paused
      ? `${icon('i-play', 'icon sm')}继续推演`
      : `${icon('i-pause', 'icon sm')}暂停推演`;
  } else {
    btn.innerHTML = `${icon('i-play', 'icon sm')}重播 90 秒推演`;
  }
}

function setStep(n) {
  state.step = n;
  setStepCounter(n);
  const labels = {
    0: '启动中', 1: '感知中', 2: '对齐中', 3: '预测中', 4: '决策中',
    5: '生成方案', 6: '仿真中', 7: '校验中', 8: '等待授权',
    9: '等待执行', 10: '执行确认', 11: '重规划中', 12: '运行完成'
  };
  setRunState(labels[n] || '执行中');
  if (DATA.steps[n - 1]) setScenarioClock(DATA.steps[n - 1].time);
  renderAllSteps(n, false);
  applyKpiValues(n, true);
  renderLedger(n);
  renderChart(state.chartMetric, STEP_HOUR[n - 1] || 17);
}

async function waitStep(ms, runId) {
  const duration = reducedMotion ? Math.min(ms, 240) : ms;
  const start = performance.now();
  while (performance.now() - start < duration) {
    if (state.runId !== runId) return false;
    if (state.paused) { await wait(100); continue; }
    await wait(50);
  }
  return state.runId === runId;
}

function waitForApproval(runId, timeout = 10000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      state.approvalResolve = null;
      closeModal('approvalModal');
      resolve(ok);
    };
    state.approvalResolve = finish;
    setTimeout(() => {
      if (!settled && state.runId === runId) {
        toast('演示模式', '10 秒未操作，自动授权通过。');
        finish(true);
      }
    }, timeout);
  });
}

function resetRunUI() {
  state.step = 0;
  state.approved = false;
  setStepCounter(0);
  setRunState('启动中');
  setScenarioClock('09:00');
  renderAllSteps(0, false);
  applyKpiValues(0, false);
  renderLedger(0);
  renderChart('balance', 8.2);
  const card = $('.decision-card');
  if (card) card.style.opacity = '.55';
}

async function startReplay() {
  if (state.running) {
    state.paused = !state.paused;
    setRunState(state.paused ? '已暂停' : '执行中');
    setReplayButton();
    if (state.paused) toast('推演已暂停', '点击「继续推演」恢复执行。');
    return;
  }

  const runId = ++state.runId;
  state.running = true;
  state.paused = false;
  state.approved = false;
  resetRunUI();
  setReplayButton();
  toast('推演开始', 'Agent 已接管目标，开始多步连续执行。');
  const card = $('.decision-card');
  if (card) card.style.opacity = '.55';

  for (let i = 1; i <= 12; i++) {
    if (!await waitStep(i === 8 ? 700 : 1450, runId)) return;
    if (i === 8) {
      setStep(8);
      const card = $('.decision-card');
      if (card) card.style.opacity = '1';
      openModal('approvalModal');
      const ok = await waitForApproval(runId, 10000);
      if (state.runId !== runId) return;
      if (!ok) {
        state.running = false;
        state.paused = false;
        setRunState('人工接管');
        setReplayButton();
        toast('已转人工接管', '推演结束。真实场景中，人工可修改方案后重新交给 Agent 执行。', 'warn');
        return;
      }
      state.approved = true;
      setRunState('已授权 · 待执行确认');
      toast('MKTY 已授权', 'AP-20261019-0087 · 等待执行通道回执。');
      await waitStep(900, runId);
      continue;
    }
    setStep(i);
    if (i === 9) {
      setRunState('等待执行');
      toast('授权 ≠ 到账', '执行请求已提交，等待执行通道回执；不更新余额。', 'warn');
      if (!await waitStep(1100, runId)) return;
    }
    if (i === 10) {
      setRunState('执行已确认');
      toast('执行确认', '收到执行通道回执，按回执更新余额与头寸。');
    }
    if (i === 11) {
      toast('事件触发', '紧急付款 +1.20 亿、入账延迟 40 分钟；Agent 正在重规划…', 'warn');
      if (!await waitStep(1100, runId)) return;
    }
    if (i === 12) {
      completeRun();
      return;
    }
  }
}

function completeRun() {
  state.running = false;
  state.paused = false;
  state.step = 12;
  state.approved = true;
  setRunState('运行完成');
  setScenarioClock('17:00');
  setStepCounter(12);
  renderAllSteps(12, true);
  applyKpiValues(12, true);
  renderLedger(12);
  renderChart(state.chartMetric, null);
  setReplayButton();
  const card = $('.decision-card');
  if (card) card.style.opacity = '1';
  toast('推演完成', '0 笔超时 · 节约 4.47 万元 · MKTY 授权 1 次 · 执行确认。');
}

/* ------------------------------------------------------------
   Export audit
   ------------------------------------------------------------ */

function exportAudit() {
  const audit = {
    runId: DATA.runId,
    date: DATA.date,
    scenario: DATA.scenario,
    goalContract: {
      payments: 1284,
      amount: '21.6 亿',
      cipsMin: '5.00 亿',
      cipsMax: '9.50 亿',
      priorities: ['P1 High 零延误', 'P2 Medium', 'P3 Low'],
      approval: { single: '2.00 亿', dual: '3.00 亿' }
    },
    steps: DATA.steps.map((s, i) => ({
      step: i + 1, time: s.time, title: s.title, output: s.detail.output, guard: s.detail.guard, evidence: s.detail.evidence
    })),
    decisions: DATA.options,
    toolCalls: DATA.toolCalls,
    approvals: [{ id: 'AP-20261019-0087', time: '10:52', approver: '林岚', channel: '企业微信', status: 'approved' }],
    result: { saving: '4.47 万元', sla: '100%', hitl: 1, auditTrail: 'complete' }
  };
  const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CIPS-Sentinel-audit-20261019.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('审计包已导出', '包含 12 步执行证据、工具调用与授权记录。');
}

/* ------------------------------------------------------------
   Events / init
   ------------------------------------------------------------ */

function bindEvents() {
  // Nav and data-view buttons
  document.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-view]');
    if (viewBtn) {
      event.preventDefault();
      setView(viewBtn.dataset.view);
      if (viewBtn.hasAttribute('data-close')) closeAllModals();
      return;
    }
    const stepEl = event.target.closest('.step');
    if (stepEl) {
      openStep(Number(stepEl.dataset.step));
      return;
    }
    const modalBtn = event.target.closest('[data-modal]');
    if (modalBtn) {
      event.preventDefault();
      openModal(modalBtn.dataset.modal);
      return;
    }
    if (event.target.closest('[data-close]')) {
      const modal = event.target.closest('.modal-backdrop');
      if (modal) closeModal(modal.id);
      return;
    }
    if (event.target.classList.contains('modal-backdrop')) {
      closeModal(event.target.id);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllModals();
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('step')) {
      event.preventDefault();
      openStep(Number(event.target.dataset.step));
    }
  });

  $('#replayBtn')?.addEventListener('click', startReplay);
  $('#replayBtn2')?.addEventListener('click', startReplay);
  $('#contractReplay')?.addEventListener('click', () => { closeAllModals(); startReplay(); });
  $('#exportBtn')?.addEventListener('click', exportAudit);

  $('#approveBtn')?.addEventListener('click', () => state.approvalResolve?.(true));
  $('#rejectBtn')?.addEventListener('click', () => state.approvalResolve?.(false));

  $$('.seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.seg button').forEach((b) => b.classList.toggle('active', b === btn));
      renderChart(btn.dataset.chart, state.running ? STEP_HOUR[state.step - 1] : null);
    });
  });

  // Sandbox sliders & toggles
  ['peakRange', 'delayRange', 'rateRange'].forEach((id) => {
    $('#' + id)?.addEventListener('input', () => {
      state.sandboxPreset = 'custom';
      renderSandboxPresets();
      updateSliderLabels();
    });
  });
  ['repoToggle', 'queueToggle', 'replanToggle'].forEach((id) => {
    $('#' + id)?.addEventListener('click', (event) => {
      const el = event.currentTarget;
      setToggle(id, !el.classList.contains('on'));
      state.sandboxPreset = 'custom';
      renderSandboxPresets();
    });
  });
  $('#runSandboxBtn')?.addEventListener('click', runSandbox);

  $$('.lb-tab').forEach((tab) => {
    tab.addEventListener('click', () => renderLeaderboard(tab.dataset.lb));
  });

  $('#licenseBtn')?.addEventListener('click', () => {
    $('#licenseBtn').innerHTML = `${icon('i-shield', 'icon sm')}已领取 · L2 副驾`;
    toast('Agent 驾照 · L2 副驾', '完成 3 个沙盘场景并通过压力测试，可升级 L3 指挥官。');
  });
}

function applyForecastSnapshot() {
  const f = window.CIPS_FORECAST;
  if (!f) return;
  const p50 = Number(f.p50_yi || 0).toFixed(2);
  const p72 = Number(f.p72_yi || 0).toFixed(2);
  const p95 = Number(f.p95_yi || 0).toFixed(2);
  const at = f.at || '16:30';
  const coverage = Math.round(Number(f.coverage_p72 || f.confidence || 0) * 100);
  const mae = Number(f.backtest_mae_yi || 0).toFixed(3);
  const step = DATA.steps[2];
  if (step) {
    step.desc = `15 分钟粒度预测，${at} 缺口 ${p72} 亿（P72），回测覆盖率 ${coverage}%。`;
    step.meta = ['forecast.run', 'bootstrap'];
    step.detail.did = `用 90 天 15 分钟历史拟合季节性基线，生成 ${f.paths || 1200} 条残差路径，得到 P50/P72/P95。`;
    step.detail.guard = `回测 P72 覆盖率 ${coverage}%；MAE ${mae} 亿；数据新鲜度 3s。`;
    step.detail.output = `缺口 ${p72} 亿 @ ${at} · P72`;
    step.detail.evidence = [`P50 ${p50} 亿`, `P72 ${p72} 亿`, `P95 ${p95} 亿`, `覆盖率 ${coverage}%`];
  }
  const gapStep = DATA.steps[3];
  if (gapStep) {
    const minBalance = (Number(f.floor_yi || 5) - Number(f.p72_yi || 0)).toFixed(2);
    gapStep.detail.output = `进入决策态 · 预计 ${at} 余额 ${minBalance} 亿`;
    gapStep.evidence = ['余额 6.20 亿', '排队 23 笔', '2.40 亿', `预计低点 ${at}`];
  }
  const forecastTool = DATA.toolCalls.find((t) => t.name === 'forecast.run');
  if (forecastTool) forecastTool.out = `P72 缺口 ${p72} 亿 @ ${at}`;
  const gapKpi = DATA.kpis.find((k) => k.key === 'gap');
  if (gapKpi) gapKpi.foot = `${at} · P72 ${p72} 亿`;
}

function init() {
  applyForecastSnapshot();
  renderKpis();
  applyKpiValues(12, false);
  renderLedger(12);
  renderAllSteps(12, true);
  renderQueue();
  renderOptions();
  renderToolLog();
  renderGuards();
  renderComparison();
  renderRecon();
  renderRadar();
  renderLegend('balance');
  renderChart('balance', null);
  renderSandboxPresets();
  updateSliderLabels();
  renderLeaderboard('team');
  renderSandboxResult(computeSandbox(), false);
  initChartHover();
  bindEvents();
  setScenarioClock('17:00');
  const hash = location.hash.replace('#', '');
  setView(VIEWS.includes(hash) ? hash : 'demo', false);
}

init();
