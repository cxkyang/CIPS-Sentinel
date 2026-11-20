/* ============================================================
   Agent 对账工作台 · mock data + deterministic match visualisation
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));

  const fmt = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => `¥${fmt.format(n)}`;
  const rawMoney = (n) => fmt.format(n);

  const inRaw = (o) => ({
    '报文标识号': o.ref,
    '发报日期': '20260811',
    '接收清算行号': o.receiveBank || '5011 **** 0011',
    '发起清算行号': o.sendBank || '7611 **** 0012',
    '报文种类': o.msgType || 'hvps.111:客户发起汇兑业务报文(二代)',
    '支付交易序号': o.txn || '2026081101679124',
    '金额': rawMoney(o.amount),
    '收款人账号': o.payeeAccount || '6262 **** 5011',
    '付款人账号': o.payerAccount || '2292 **** 0002',
    '付款人名称': o.payer || '某公司 A'
  });

  const outRaw = (o) => ({
    '支付交易序号': o.txn || '5011 **** 0015',
    '发报日期': '20260811',
    '发起清算行号': o.sendBank || '5011 **** 0015',
    '报文种类': o.msgType || 'hvps.111:客户发起汇兑业务报文(二代)',
    '报文标识号': o.ref,
    '金额': rawMoney(o.amount),
    '付款人账号': o.payerAccount || '6250 **** 9011',
    '收款人账号': o.payeeAccount || '2307 **** 5322',
    '收款人名称': o.payee || '某公司 B'
  });

  const instantRaw = (o) => ({
    '工作日期': '20260811',
    '报文标识号': o.ref,
    '付款人开户行号': o.payerBank || '5016 **** 0380',
    '付款人账号': o.payerAccount || '****',
    '付款人名称': o.payer || '某公司 F',
    '收款人开户行号': o.payeeBank || '1033 **** 3501',
    '收款人账号': o.payeeAccount || '1203 **** 7771',
    '收款人名称': o.payee || '某公司 C',
    '金额': rawMoney(o.amount),
    '业务类型': o.bizType || '[G105]电子商业汇票资金清算',
    '借贷标识': o.dc || '借记'
  });

  const cashRaw = (o) => ({
    'Acbrno': o.acbrno || '62',
    'Accycd': 'CNY',
    'Acvdat': '20260811',
    'Acnoac': o.acnoac || 'PB62 ****',
    'Acdlno': o.acdlno || 'GSB2 **** 9994',
    'Accpac': o.accpac || 'CMSB ****',
    'Amount': rawMoney(o.amount),
    'Acnarr': o.acnarr || 'CNY 某央行',
    'Acnogp': o.acnogp || 'A',
    'Aceain': o.aceain || 'RRP',
    'Acapty': o.acapty || 'RRP',
    'Compare': o.compare || 'MATCHED'
  });

  const cipsRaw = (o) => ({
    'CIPS 报文号': o.ref,
    '起息日': '20260811',
    '付款人': o.payer,
    '收款人': o.payee,
    '金额': rawMoney(o.amount),
    '币种': 'CNY',
    '业务类型': o.type,
    '清算状态': o.settleStatus,
    'CIPS 账户': 'CIPS-001'
  });

  const records = [
    {
      id: 'R001',
      kind: 'cnaps',
      source: 'CNAPS 来账',
      ref: '2026081119336598',
      date: '2026-08-11',
      amount: 8600000,
      payer: '某公司 A',
      payee: '本行客户',
      type: 'hvps.111 客户汇兑',
      status: 'matched',
      confidence: 0.99,
      counterpart: 'CF-20260811-001',
      raw: inRaw({ ref: '2026081119336598', amount: 8600000 }),
      cash: cashRaw({ amount: 8600000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS' }),
      evidence: ['金额 8,600,000.00 = 8,600,000.00', '起息日 2026-08-11 = 2026-08-11', '付款账号 2292 **** 0002 = 2292 **** 0002'],
      reason: '金额、日期、付款账号和收款账号一致，按确定性规则自动匹配。'
    },
    {
      id: 'R002',
      kind: 'cnaps',
      source: 'CNAPS 往账',
      ref: '20260811186065324',
      date: '2026-08-11',
      amount: 1250000,
      payer: '本行客户',
      payee: '某公司 B',
      type: 'hvps.111 客户汇兑',
      status: 'matched',
      confidence: 0.98,
      counterpart: 'CF-20260811-002',
      raw: outRaw({ ref: '20260811186065324', amount: 1250000 }),
      cash: cashRaw({ amount: -1250000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'MATCHED' }),
      evidence: ['金额 1,250,000.00 = 1,250,000.00', '起息日 2026-08-11 = 2026-08-11', '收款账号 2307 **** 5322 = 2307 **** 5322'],
      reason: '往账报文与行内付款流水金额、日期、收款账号一致，自动匹配。'
    },
    {
      id: 'R003',
      kind: 'cnaps',
      source: '大额即时转账',
      ref: '20260811124615936',
      date: '2026-08-11',
      amount: 36.18,
      payer: '某公司 F',
      payee: '某公司 C',
      type: '[G105]电子商业汇票资金清算',
      status: 'matched',
      confidence: 0.95,
      counterpart: 'CF-20260811-003',
      raw: instantRaw({ ref: '20260811124615936', amount: 36.18 }),
      cash: cashRaw({ amount: 36.18, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS' }),
      evidence: ['金额 36.18 = 36.18', '报文标识号 20260811124615936 = 20260811124615936', '业务类型 G105 = G105'],
      reason: '即时转账报文与行内清算流水按报文标识号和金额匹配。'
    },
    {
      id: 'R004',
      kind: 'cash',
      source: '行内现金流',
      ref: 'NET262229970',
      date: '2026-08-11',
      amount: -5999915000,
      payer: '某央行',
      payee: '本行',
      type: 'RRP / CNY 某央行',
      status: 'unmatched',
      unmatchedType: 'cash',
      confidence: 0,
      raw: cashRaw({ amount: -5999915000, compare: 'UNMATCHED' }),
      cash: cashRaw({ amount: -5999915000, compare: 'UNMATCHED' }),
      candidates: ['2026081119336598', '2026081186068231', '20260811124615936'],
      evidence: ['未找到金额、日期、方向同时匹配的 CNAPS 报文', '候选报文金额差异过大：-59.99 亿 vs 笔级金额', '疑似某央行 RRP 资金往来 / 时序差异'],
      reason: 'Agent 不把该笔计入可用头寸。建议先核对某央行 RRP 资金往来、总账记账时点和 CNAPS 报文状态，再决定是否人工匹配。'
    },
    {
      id: 'R005',
      kind: 'cash',
      source: '行内现金流',
      ref: 'CF-20260811-005',
      date: '2026-08-11',
      amount: 1250000,
      payer: '本行',
      payee: '客户甲',
      type: '客户汇款',
      status: 'matched',
      confidence: 0.97,
      counterpart: '20260811186065324',
      cnaps: outRaw({ ref: '20260811186065324', amount: 1250000 }),
      raw: cashRaw({ amount: 1250000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'MATCHED' }),
      cash: cashRaw({ amount: 1250000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'MATCHED' }),
      evidence: ['金额 1,250,000.00 = 1,250,000.00', '起息日 2026-08-11 = 2026-08-11', '往来方向：付款 = 借记'],
      reason: '行内付款流水与 CNAPS 往账报文金额、日期、方向一致，自动匹配。'
    },
    {
      id: 'R006',
      kind: 'cnaps',
      source: 'CNAPS 来账',
      ref: '20260811124615937',
      date: '2026-08-11',
      amount: 27500000,
      payer: '某公司 D',
      payee: '本行',
      type: 'hvps.111 客户汇兑',
      status: 'review',
      confidence: 0.72,
      counterpart: null,
      raw: inRaw({ ref: '20260811124615937', amount: 27500000, payer: '某公司 D' }),
      cash: cashRaw({ amount: 27500000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'REVIEW' }),
      candidates: [
        {
          id: 'CF-20260811-006A', date: '2026-08-11', amount: 27500000, payer: '某公司 D', payee: '本行',
          type: '客户汇款', account: '6262 **** 5011', confidence: 0.72,
          cash: cashRaw({ amount: 27500000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'REVIEW', acdlno: 'GSB2 **** 9994' })
        },
        {
          id: 'CF-20260811-006B', date: '2026-08-11', amount: 27500000, payer: '某公司 D', payee: '本行',
          type: '客户汇款', account: '2292 **** 0002', confidence: 0.68,
          cash: cashRaw({ amount: 27500000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'REVIEW', acdlno: 'GSB2 **** 9958' })
        },
        {
          id: 'CF-20260811-006C', date: '2026-08-11', amount: 27500000, payer: '某公司 H', payee: '本行',
          type: '客户汇款', account: '1203 **** 7772', confidence: 0.61,
          cash: cashRaw({ amount: 27500000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS', compare: 'REVIEW', acdlno: 'GSB2 **** 9972' })
        }
      ],
      evidence: ['金额 27,500,000.00 = 27,500,000.00', '起息日 2026-08-11 = 2026-08-11', '付款人户名/账号与行内流水不一致'],
      reason: '金额和日期一致，但存在多笔同金额候选，付款人户名/账号不完全一致；Agent 不自动选择，转人工复核。'
    },
    {
      id: 'R007',
      kind: 'cnaps',
      source: '大额即时转账',
      ref: '20260811124615938',
      date: '2026-08-11',
      amount: 1868895.18,
      payer: '某公司 E',
      payee: '本行',
      type: '即时转账',
      status: 'matched',
      confidence: 0.96,
      counterpart: 'CF-20260811-007',
      raw: instantRaw({ ref: '20260811124615938', amount: 1868895.18, payer: '某公司 E', payee: '本行', payerAccount: '6262 **** 5011', payeeAccount: '1203 **** 7772', bizType: '即时转账' }),
      cash: cashRaw({ amount: 1868895.18, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS' }),
      evidence: ['金额 1,868,895.18 = 1,868,895.18', '报文标识号 20260811124615938 = 20260811124615938', '付款账号 6262 **** 5011 = 6262 **** 5011'],
      reason: '即时转账来账与行内清算流水按报文标识号、金额、账号匹配。'
    },
    {
      id: 'R008',
      kind: 'cash',
      source: '行内现金流',
      ref: 'CF-20260811-008',
      date: '2026-08-11',
      amount: -1200000,
      payer: '本行',
      payee: '客户乙',
      type: '客户汇款',
      status: 'matched',
      confidence: 0.94,
      counterpart: '20260811186065325',
      cnaps: outRaw({ ref: '20260811186065325', amount: -1200000, payee: '客户乙' }),
      raw: cashRaw({ amount: -1200000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS' }),
      cash: cashRaw({ amount: -1200000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS' }),
      evidence: ['金额 1,200,000.00 = 1,200,000.00', '起息日 2026-08-11 = 2026-08-11', '收款账号 2307 **** 5323 = 2307 **** 5323'],
      reason: '行内付款流水与 CNAPS 往账报文按金额、日期、收款账号匹配。'
    },
    {
      id: 'R009',
      kind: 'cnaps',
      source: 'CNAPS 来账',
      ref: '20260811124615939',
      date: '2026-08-11',
      amount: 5000000,
      payer: '客户丙',
      payee: '本行',
      type: 'hvps.111 客户汇兑',
      status: 'matched',
      confidence: 0.97,
      counterpart: 'CF-20260811-009',
      raw: inRaw({ ref: '20260811124615939', amount: 5000000, payer: '客户丙' }),
      cash: cashRaw({ amount: 5000000, acnarr: 'CNY CNAPS', aceain: 'CNAPS', acapty: 'CNAPS' }),
      evidence: ['金额 5,000,000.00 = 5,000,000.00', '起息日 2026-08-11 = 2026-08-11', '付款账号 2292 **** 0009 = 2292 **** 0009'],
      reason: '来账报文与行内收款流水金额、日期、付款账号一致，自动匹配。'
    },
    {
      id: 'R010',
      kind: 'cnaps',
      source: 'CNAPS 来账',
      ref: '20260811124615940',
      date: '2026-08-11',
      amount: 6400000,
      payer: '某公司 G',
      payee: '本行',
      type: 'hvps.111 客户汇兑',
      status: 'unmatched',
      unmatchedType: 'transaction',
      confidence: 0,
      counterpart: null,
      raw: inRaw({ ref: '20260811124615940', amount: 6400000, payer: '某公司 G' }),
      cash: null,
      evidence: ['存在 CNAPS 来账报文，但行内现金流无对应收款记录', '报文标识号 20260811124615940 未找到行内匹配', '未匹配交易不计入可用流入'],
      reason: '有交易、无对应账：CNAPS 已收到来账报文，但行内现金流没有匹配记录。先查总账记账时点与收款账号，再决定人工补账或退回。'
    }
  ];

  const cipsRecords = [
    {
      id: 'C001', kind: 'cips', source: 'CIPS 汇入', ref: 'CIPS202608110001', date: '2026-08-11',
      amount: 42000000, payer: '某公司 A', payee: '本行', type: '跨境人民币汇入',
      status: 'matched', settleStatus: '已清算', confidence: 0.99, counterpart: 'CF-CIPS-001',
      raw: cipsRaw({ ref: 'CIPS202608110001', amount: 42000000, payer: '某公司 A', payee: '本行', type: '跨境人民币汇入', settleStatus: '已清算' }),
      cash: cashRaw({ amount: 42000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS' }),
      evidence: ['金额 42,000,000.00 = 42,000,000.00', '起息日 2026-08-11 = 2026-08-11', 'CIPS 报文号与行内流水一致'],
      reason: 'CIPS 汇入报文与行内 CIPS 清算流水金额、日期、报文号一致，自动匹配。'
    },
    {
      id: 'C002', kind: 'cips', source: 'CIPS 汇出', ref: 'CIPS202608110002', date: '2026-08-11',
      amount: -38000000, payer: '本行', payee: '某公司 B', type: '跨境人民币汇出',
      status: 'matched', settleStatus: '已清算', confidence: 0.98, counterpart: 'CF-CIPS-002',
      raw: cipsRaw({ ref: 'CIPS202608110002', amount: -38000000, payer: '本行', payee: '某公司 B', type: '跨境人民币汇出', settleStatus: '已清算' }),
      cash: cashRaw({ amount: -38000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS' }),
      evidence: ['金额 38,000,000.00 = 38,000,000.00', '起息日 2026-08-11 = 2026-08-11', '收付款方向一致'],
      reason: 'CIPS 汇出报文与行内付款流水金额、日期、方向一致，自动匹配。'
    },
    {
      id: 'C003', kind: 'cips', source: 'CIPS 汇入', ref: 'CIPS202608110003', date: '2026-08-11',
      amount: 26000000, payer: '某公司 C', payee: '本行', type: '跨境人民币汇入',
      status: 'matched', settleStatus: '处理中', confidence: 0.97, counterpart: 'CF-CIPS-003',
      raw: cipsRaw({ ref: 'CIPS202608110003', amount: 26000000, payer: '某公司 C', payee: '本行', type: '跨境人民币汇入', settleStatus: '处理中' }),
      cash: cashRaw({ amount: 26000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS' }),
      evidence: ['金额 26,000,000.00 = 26,000,000.00', '起息日 2026-08-11 = 2026-08-11', '报文号匹配'],
      reason: '已匹配；清算状态为处理中，等待 CIPS 回执。'
    },
    {
      id: 'C004', kind: 'cips', source: 'CIPS 汇出', ref: 'CIPS202608110004', date: '2026-08-11',
      amount: -51000000, payer: '本行', payee: '某公司 D', type: '跨境人民币汇出',
      status: 'unmatched', settleStatus: '失败', confidence: 0, counterpart: null,
      raw: cipsRaw({ ref: 'CIPS202608110004', amount: -51000000, payer: '本行', payee: '某公司 D', type: '跨境人民币汇出', settleStatus: '失败' }),
      cash: cashRaw({ amount: -51000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS', compare: 'UNMATCHED' }),
      evidence: ['未找到金额、日期、方向同时匹配的 CIPS 报文', '清算状态为失败，需确认是否退回', '该笔不计入可用头寸'],
      reason: 'CIPS 汇出失败且未匹配，进入异常队列；需人工确认失败原因、是否重发或退回。'
    },
    {
      id: 'C005', kind: 'cips', source: 'CIPS 汇入', ref: 'CIPS202608110005', date: '2026-08-11',
      amount: 18000000, payer: '某公司 E', payee: '本行', type: '跨境人民币汇入',
      status: 'unmatched', settleStatus: '已清算', confidence: 0, counterpart: null,
      raw: cipsRaw({ ref: 'CIPS202608110005', amount: 18000000, payer: '某公司 E', payee: '本行', type: '跨境人民币汇入', settleStatus: '已清算' }),
      cash: cashRaw({ amount: 18000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS', compare: 'UNMATCHED' }),
      evidence: ['未找到对应行内 CIPS 流水', '该笔为未匹配汇入', '未匹配汇入不计入可用头寸'],
      reason: 'CIPS 汇入已清算但行内无对应流水；需核查 CIPS 账户与行内记账时点。'
    },
    {
      id: 'C006', kind: 'cips', source: 'CIPS 汇出', ref: 'CIPS202608110006', date: '2026-08-11',
      amount: -24000000, payer: '本行', payee: '某公司 F', type: '跨境人民币汇出',
      status: 'review', settleStatus: '处理中', confidence: 0.74, counterpart: null,
      raw: cipsRaw({ ref: 'CIPS202608110006', amount: -24000000, payer: '本行', payee: '某公司 F', type: '跨境人民币汇出', settleStatus: '处理中' }),
      cash: cashRaw({ amount: -24000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS', compare: 'REVIEW' }),
      candidates: [
        { id: 'CF-CIPS-006A', date: '2026-08-11', amount: -24000000, payer: '本行', payee: '某公司 F', type: '跨境人民币汇出', account: '6262 **** 5011', confidence: 0.74, cash: cashRaw({ amount: -24000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS', compare: 'REVIEW', acdlno: 'GSB2 **** 9994' }) },
        { id: 'CF-CIPS-006B', date: '2026-08-11', amount: -24000000, payer: '本行', payee: '某公司 F', type: '跨境人民币汇出', account: '2292 **** 0002', confidence: 0.67, cash: cashRaw({ amount: -24000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS', compare: 'REVIEW', acdlno: 'GSB2 **** 9958' }) }
      ],
      evidence: ['金额 24,000,000.00 = 24,000,000.00', '起息日 2026-08-11 = 2026-08-11', '存在 2 笔同金额候选，账号不一致'],
      reason: '金额一致但有多笔同金额候选；Agent 不自动选择，转人工复核。'
    },
    {
      id: 'C007', kind: 'cips', source: 'CIPS 汇入', ref: 'CIPS202608110007', date: '2026-08-11',
      amount: 9000000, payer: '某公司 G', payee: '本行', type: '跨境人民币汇入',
      status: 'review', settleStatus: '已清算', confidence: 0.71, counterpart: null,
      raw: cipsRaw({ ref: 'CIPS202608110007', amount: 9000000, payer: '某公司 G', payee: '本行', type: '跨境人民币汇入', settleStatus: '已清算' }),
      cash: cashRaw({ amount: 9000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS', compare: 'REVIEW' }),
      evidence: ['金额 9,000,000.00 = 9,000,000.00', '起息日 2026-08-11 = 2026-08-11', '付款人户名存在差异'],
      reason: '金额、日期一致，但付款人户名不一致；置信度 0.71，转人工复核。'
    },
    {
      id: 'C008', kind: 'cips', source: 'CIPS 汇出', ref: 'CIPS202608110008', date: '2026-08-11',
      amount: -12000000, payer: '本行', payee: '某公司 H', type: '跨境人民币汇出',
      status: 'matched', settleStatus: '已清算', confidence: 0.96, counterpart: 'CF-CIPS-008',
      raw: cipsRaw({ ref: 'CIPS202608110008', amount: -12000000, payer: '本行', payee: '某公司 H', type: '跨境人民币汇出', settleStatus: '已清算' }),
      cash: cashRaw({ amount: -12000000, acnarr: 'CNY CIPS', aceain: 'CIPS', acapty: 'CIPS' }),
      evidence: ['金额 12,000,000.00 = 12,000,000.00', '起息日 2026-08-11 = 2026-08-11', '收付款方向一致'],
      reason: 'CIPS 汇出报文与行内流水金额、日期、方向一致，自动匹配。'
    }
  ];

  const state = {
    channel: 'CNAPS',
    filter: 'all',
    running: false,
    current: Object.fromEntries([...records, ...cipsRecords].map((r) => [r.id, 'pending'])),
    finishedAt: null
  };

  const activeRecords = () => state.channel === 'CIPS' ? cipsRecords : records;

  let drawerRecord = null;
  let selectedCandidateId = null;
  let toastTimer = null;

  function showReconToast(message) {
    const t = $('#reconToast');
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
  }

  function renderCashList(cash, emptyText = '请选择候选交易') {
    $('#cashList').innerHTML = cash
      ? Object.entries(cash).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')
      : `<div><dt>—</dt><dd>${esc(emptyText)}</dd></div>`;
  }

  const STATUS = {
    pending: { label: '待比对', cls: 'pending', icon: 'i-clock' },
    matched: { label: '已匹配', cls: 'matched', icon: 'i-check' },
    review: { label: '待复核', cls: 'review', icon: 'i-alert' },
    unmatched: { label: '未匹配', cls: 'unmatched', icon: 'i-alert' }
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function statusLabel(status, r) {
    if (status === 'unmatched' && r?.unmatchedType === 'transaction') return '未匹配交易';
    if (status === 'unmatched' && r?.unmatchedType === 'cash') return 'CNAPS单边账';
    return (STATUS[status] || STATUS.pending).label;
  }

  function statusPill(status, r) {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="status-pill ${s.cls}"><svg class="icon xs"><use href="#${s.icon}"/></svg>${statusLabel(status, r)}</span>`;
  }

  const SETTLE_CLASS = { '已清算': 'matched', '处理中': 'review', '失败': 'unmatched', '退回': 'unmatched' };
  function settlePill(status) {
    const cls = SETTLE_CLASS[status] || 'pending';
    return `<span class="status-pill ${cls}">${esc(status)}</span>`;
  }

  function renderRows() {
    const tbody = $('#reconRows');
    tbody.innerHTML = activeRecords().map((r) => {
      const status = state.current[r.id] || 'pending';
      const hidden = state.filter !== 'all' && status !== state.filter;
      const conf = Number(r.confidence || 0);
      const confCls = status === 'pending' ? '' : conf === 0 ? 'zero' : conf < 0.8 ? 'low' : '';
      return `<tr data-id="${r.id}" data-status="${status}" tabindex="0"${hidden ? ' hidden' : ''}>
        <td><span class="source-tag" data-source="${esc(r.source)}"><i></i>${esc(r.source)}</span></td>
        <td class="ref-cell">${esc(r.ref)}</td>
        <td class="mono">${esc(r.date)}</td>
        <td><div class="party"><b>${esc(r.payer)}</b><span>→ ${esc(r.payee)}</span></div></td>
        <td class="ta-r"><span class="amount ${r.amount < 0 ? 'negative' : 'positive'}">${money(r.amount)}</span></td>
        <td class="type-cell" title="${esc(r.type)}">${esc(r.type)}</td>
        <td>${statusPill(status, r)}</td>
        <td>${settlePill(r.settleStatus || '已清算')}</td>
        <td><span class="conf ${confCls}">${status === 'pending' ? '—' : conf.toFixed(2)}</span></td>
      </tr>`;
    }).join('');
  }

  function counts() {
    const c = { matched: 0, review: 0, unmatched: 0, pending: 0 };
    activeRecords().forEach((r) => { c[state.current[r.id]] = (c[state.current[r.id]] || 0) + 1; });
    return c;
  }

  function updateStats() {
    const c = counts();
    $('#statMatched').textContent = c.matched || '—';
    $('#statReview').textContent = c.review || '—';
    $('#statUnmatched').textContent = c.unmatched || '—';
    const unmatchedTx = activeRecords().filter((r) => (state.current[r.id] || 'pending') === 'unmatched' && r.unmatchedType === 'transaction').length;
    const unmatchedCash = activeRecords().filter((r) => (state.current[r.id] || 'pending') === 'unmatched' && r.unmatchedType === 'cash').length;
    $('#statUnmatchedTx').textContent = unmatchedTx;
    $('#statUnmatchedCash').textContent = unmatchedCash;
    const handled = c.matched + c.review;
    $('#statRate').textContent = c.pending === activeRecords().length ? '—' : `${((handled / activeRecords().length) * 100).toFixed(1)}%`;
    $('#statTime').textContent = state.finishedAt ? `${state.finishedAt.toFixed(1)}s` : '—';
    $('#countAll').textContent = activeRecords().length;
    $('#countMatched').textContent = c.matched;
    $('#countReview').textContent = c.review;
    $('#countUnmatched').textContent = c.unmatched;
    renderCipsNet();
  }

  function setStep(n, mode) {
    const el = $(`.agent-step[data-step="${n}"]`);
    if (!el) return;
    el.classList.toggle('active', mode === 'active');
    el.classList.toggle('done', mode === 'done');
    const em = $('em', el);
    if (em) em.textContent = mode === 'done' ? '完成' : mode === 'active' ? '进行' : '待';
  }

  function setRunUI(mode, text, sub) {
    const stateEl = $('#runState');
    stateEl.classList.remove('running', 'done');
    if (mode) stateEl.classList.add(mode);
    $('b', stateEl).textContent = text;
    if (typeof sub === 'string') $('span:last-child', stateEl).textContent = sub;
    $('#agentState').textContent = text;
    if (sub) $('#agentSub').textContent = sub;
  }

  async function runAgent() {
    if (state.running) return;
    state.running = true;
    state.finishedAt = null;
    activeRecords().forEach((r) => { state.current[r.id] = 'pending'; });
    renderRows();
    updateStats();
    $$('.agent-step').forEach((el) => { el.classList.remove('active', 'done'); $('em', el).textContent = '待'; });
    $('#progressBar').style.width = '0%';
    $('#agentTime').textContent = '—';
    $('#tableFootState').textContent = 'Agent 比对中…';
    const btn = $('#runBtn');
    btn.disabled = true;
    btn.innerHTML = '<svg class="icon sm"><use href="#i-refresh"/></svg>Agent 对账中…';
    setRunUI('running', '运行中', '读取源数据');
    const started = performance.now();
    const steps = [
      { n: 1, text: state.channel === 'CIPS' ? '读取 CIPS 报文' : '读取 4 类源数据', sub: state.channel === 'CIPS' ? 'CIPS 汇入 · CIPS 汇出 · 行内 CIPS 现金流' : '大额来账 23.60 亿 · 即时转账 0.40 亿 · 往账 · 行内现金流' },
      { n: 2, text: '标准化 14 个字段', sub: '金额、日期、账号、户名、方向、报文号' },
      { n: 3, text: '规则匹配', sub: '金额 + 日期 + 账号 + 报文号；一对多净额单独标记' },
      { n: 4, text: '标记匹配状态', sub: 'MATCHED / REVIEW / 交易无账 / 单边账' },
      { n: 5, text: '生成差异解释', sub: '输出匹配证据与人工复核建议' }
    ];

    for (const step of steps) {
      setRunUI('running', step.text, step.sub);
      setStep(step.n, 'active');
      $('#agentSub').textContent = step.sub;
      await sleep(step.n === 3 ? 520 : 300);
      setStep(step.n, 'done');
      $('#progressBar').style.width = `${step.n * 20}%`;

      if (step.n === 4) {
        const ordered = [
          ...activeRecords().filter((r) => r.status === 'matched'),
          ...activeRecords().filter((r) => r.status === 'review'),
          ...activeRecords().filter((r) => r.status === 'unmatched')
        ];
        for (const r of ordered) {
          state.current[r.id] = r.status;
          renderRows();
          updateStats();
          await sleep(70);
        }
      }
    }

    const elapsed = (performance.now() - started) / 1000;
    state.finishedAt = Math.max(elapsed, 1.2);
    state.running = false;
    updateStats();
    setRunUI('done', '对账完成', `${activeRecords().length} 笔样本已标记`);
    $('#agentTime').textContent = `${state.finishedAt.toFixed(1)}s`;
    const finalCounts = counts();
    $('#tableFootState').textContent = `已完成 · ${finalCounts.matched} 匹配 / ${finalCounts.review} 待复核 / ${finalCounts.unmatched} 未匹配`;
    state.channel === 'CIPS' ? $('#agentNote').textContent = 'CIPS 已匹配项可进入流动性判断；待复核单独列示；未匹配净额不进入可用头寸。' : $('#agentNote').textContent = '已匹配项可进入流动性预测；待复核项需人工确认；未匹配交易（有交易无账）与 CNAPS 单边账（有账无交易）分别处理，均不得直接计入可用头寸。';
    btn.disabled = false;
    btn.innerHTML = '<svg class="icon sm"><use href="#i-refresh"/></svg>重新运行 Agent 对账';
    $('#runState span:last-child').textContent = `· ${activeRecords().length} 笔样本`;
  }

  function openDrawer(id) {
    const r = activeRecords().find((x) => x.id === id);
    if (!r) return;
    const status = state.current[r.id] || 'pending';
    drawerRecord = r;
    selectedCandidateId = null;
    const hasCandidates = status === 'review' && Array.isArray(r.candidates) && r.candidates.length > 0;
    $('#drawerKicker').textContent = `MATCH DETAIL · ${status.toUpperCase()}`;
    $('#drawerTitle').textContent = `${r.source} · ${r.ref}`;
    $('#drawerSummary').innerHTML = `
      <div class="sum-card"><span class="k">金额 / AMOUNT</span><div class="v amount ${r.amount < 0 ? 'negative' : 'positive'}">${money(r.amount)}</div></div>
      <div class="sum-card"><span class="k">交易对手 / COUNTERPARTY</span><div class="v">${esc(r.payer)} → ${esc(r.payee)}</div></div>
      <div class="sum-card"><span class="k">业务类型 / TYPE</span><div class="v">${esc(r.type)}</div></div>
      <div class="sum-card"><span class="k">匹配对象 / MATCHED WITH</span><div class="v">${esc(hasCandidates ? `待选择（${r.candidates.length} 笔同金额候选）` : (r.counterpart || '—'))}</div></div>`;

    const cnapsRaw = r.kind === 'cash' ? r.cnaps : r.raw;
    $('#rawTitle').textContent = r.kind === 'cash' ? 'CNAPS 对应报文' : r.kind === 'cips' ? 'CIPS 原始字段' : 'CNAPS 原始字段';
    $('#rawSource').textContent = r.kind === 'cips' ? 'CIPS' : r.kind === 'cash' ? (cnapsRaw ? 'FOUND' : 'NOT FOUND') : 'HVPS';
    $('#rawList').innerHTML = cnapsRaw ? Object.entries(cnapsRaw).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') : '<div><dt>—</dt><dd>未找到对应 CNAPS 报文</dd></div>';
    renderCashList(hasCandidates ? null : r.cash, r.unmatchedType === 'transaction' ? '行内现金流无对应记录' : '请选择候选交易');
    $('#drawerStatus').className = `status-pill ${STATUS[status].cls}`;
    $('#drawerStatus').innerHTML = `<svg class="icon xs"><use href="#${STATUS[status].icon}"/></svg>${statusLabel(status, r)}`;
    $('#evidenceList').innerHTML = (r.evidence || []).map((e, i) => `<div class="evidence-item ${status === 'matched' ? '' : i === 0 ? 'bad' : ''}"><svg class="icon xs"><use href="#${status === 'matched' || i > 0 ? 'i-check' : 'i-alert'}"/></svg><span>${esc(e)}</span></div>`).join('') || '<div class="evidence-item"><span>等待 Agent 比对。</span></div>';
    $('#evidenceReason').textContent = r.reason || '等待 Agent 生成差异解释。';

    const panel = $('#candidatePanel');
    if (hasCandidates) {
      panel.hidden = false;
      $('#candidateCount').textContent = `${r.candidates.length} 笔 · 金额均为 ${money(r.amount)}`;
      $('#candidateList').innerHTML = r.candidates.map((c) => `<label class="candidate-item">
        <input type="radio" name="reviewCandidate" value="${esc(c.id)}">
        <div class="candidate-main"><b>${esc(c.id)}</b><span>${esc(c.payer)} · ${esc(c.account)}</span><span>${esc(c.type)} · ${esc(c.date)}</span></div>
        <div class="candidate-side"><b>${money(c.amount)}</b><span>置信度 ${(c.confidence * 100).toFixed(0)}%</span></div>
      </label>`).join('');
      $('#confirmMatch').disabled = true;
    } else {
      panel.hidden = true;
      $('#candidateList').innerHTML = '';
      $('#confirmMatch').disabled = true;
    }
    $('#drawerBackdrop').classList.add('open');
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawerBackdrop').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawerRecord = null;
    selectedCandidateId = null;
    $('#candidatePanel').hidden = true;
    $('#drawerBackdrop').classList.remove('open');
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawerBackdrop').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function confirmCandidate() {
    if (!drawerRecord || !selectedCandidateId) return;
    const r = drawerRecord;
    const c = r.candidates?.find((x) => x.id === selectedCandidateId);
    if (!c) return;
    r.status = 'matched';
    r.counterpart = c.id;
    r.confidence = c.confidence;
    r.cash = c.cash;
    r.evidence = [
      `金额 ${money(c.amount)} = ${money(c.amount)}`,
      `起息日 ${c.date} = ${c.date}`,
      `人工选择：${c.id} · ${c.payer} · ${c.account}`
    ];
    r.reason = `人工复核确认：在 ${r.candidates.length} 笔同金额候选中选择 ${c.id} 作为匹配对象。`;
    state.current[r.id] = 'matched';
    closeDrawer();
    renderRows();
    updateStats();
    const cCount = counts();
    $('#tableFootState').textContent = `已完成 · ${cCount.matched} 匹配 / ${cCount.review} 待复核 / ${cCount.unmatched} 未匹配`;
    showReconToast(`已确认匹配：${r.id} ↔ ${c.id}`);
  }

  function renderCipsNet() {
    if (!$('#cipsNetTotal')) return;
    const unmatched = cipsRecords.filter((r) => r.status === 'unmatched');
    const review = cipsRecords.filter((r) => r.status === 'review');
    const inTotal = unmatched.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const outTotal = Math.abs(unmatched.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0));
    const net = inTotal - outTotal;
    const reviewTotal = review.reduce((s, r) => s + Math.abs(r.amount), 0);
    const yi = (n) => (n / 100000000).toFixed(2);
    const signed = (n) => `${n < 0 ? '−' : '+'}${yi(Math.abs(n))}`;
    $('#cipsNetTotal').textContent = signed(net);
    $('#cipsNetIn').textContent = `${yi(inTotal)} 亿`;
    $('#cipsNetOut').textContent = `${yi(outTotal)} 亿`;
    $('#cipsBridgeIn').textContent = `+${yi(inTotal)} 亿`;
    $('#cipsBridgeOut').textContent = `−${yi(outTotal)} 亿`;
    $('#cipsBridgeNet').textContent = `${signed(net)} 亿`;
    $('#cipsReviewTotal').textContent = `${yi(reviewTotal)} 亿`;
    $('#cipsTabCount').textContent = cipsRecords.length;
    $('#cnapsTabCount').textContent = records.length;
    $('#cipsNetTotal').className = net < 0 ? 'negative' : '';
  }

  function setChannel(channel) {
    if (channel !== 'CNAPS' && channel !== 'CIPS') return;
    state.channel = channel;
    state.filter = 'all';
    state.finishedAt = null;
    $$('.channel-btn').forEach((b) => b.classList.toggle('active', b.dataset.channel === channel));
    $$('.filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === 'all'));
    $('#channelKicker').innerHTML = `GMO · ${channel} × CASH FLOW <span class="mock-tag">MOCK DATA</span>`;
    $('#cnapsHeroCards').hidden = channel === 'CIPS';
    $('#cipsNetCard').hidden = channel !== 'CIPS';
    $('#cnapsCoverageCard').hidden = channel === 'CIPS';
    $('#runState b').textContent = '等待运行';
    $('#runState span:last-child').textContent = `· ${activeRecords().length} 笔样本`;
    $('#tableFootState').textContent = `${channel} · 待运行`;
    $('#tableKicker').textContent = `MATCH LEDGER · ${activeRecords().length} RECORDS`;
    $('#agentState').textContent = '等待运行';
    $('#agentSub').textContent = channel === 'CIPS' ? '读取 CIPS 报文' : '读取 4 类源数据';
    renderRows();
    updateStats();
    renderCipsNet();
    setTimeout(() => { if (!state.running) runAgent(); }, 260);
  }

  function bind() {
    $$('.channel-btn').forEach((btn) => btn.addEventListener('click', () => setChannel(btn.dataset.channel)));
    $('#candidateList').addEventListener('change', (e) => {
      if (e.target.name !== 'reviewCandidate') return;
      selectedCandidateId = e.target.value;
      const c = drawerRecord?.candidates?.find((x) => x.id === selectedCandidateId);
      if (c) {
        renderCashList(c.cash);
        $('#confirmMatch').disabled = false;
      }
    });
    $('#confirmMatch').addEventListener('click', confirmCandidate);
    $('#runBtn').addEventListener('click', runAgent);
    $$('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        $$('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
        renderRows();
      });
    });
    $('#reconRows').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) openDrawer(tr.dataset.id);
    });
    $('#reconRows').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr[data-id]');
      if (tr) { e.preventDefault(); openDrawer(tr.dataset.id); }
    });
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#drawerBackdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  }


/* ------------------------------------------------------------
   CNAPS inflow trend / forecast drawer
   ------------------------------------------------------------ */
let trendRange = '3M';

function trendNum(v) { return Number(v || 0).toFixed(2); }
function trendDateLabel(d) { return d.slice(5).replace('-', '/'); }

function openTrend() {
  const d = window.CNAPS_INFLOW_TREND;
  if (!d) { showReconToast('趋势数据未加载，请先生成 forecast/cnaps-inflow-snapshot.js。'); return; }
  $('#trendBackdrop').classList.add('open');
  $('#trendDrawer').classList.add('open');
  $('#trendDrawer').setAttribute('aria-hidden', 'false');
  $('#trendBackdrop').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  renderTrend(trendRange);
}
function closeTrend() {
  $('#trendBackdrop').classList.remove('open');
  $('#trendDrawer').classList.remove('open');
  $('#trendDrawer').setAttribute('aria-hidden', 'true');
  $('#trendBackdrop').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function trendKpi(label, value, sub) {
  return `<div class="trend-kpi"><span>${label}</span><b>${value}</b><small>${sub || ''}</small></div>`;
}

function renderTrend(range) {
  const d = window.CNAPS_INFLOW_TREND;
  if (!d) return;
  trendRange = range;
  $$('.trend-tab').forEach((b) => b.classList.toggle('active', b.dataset.trendRange === range));
  const isForecast = range === 'forecast';
  const isCustomers = range === 'customers';
  const r = isForecast || isCustomers ? null : d.ranges[range];
  const k = $('#trendKpis');
  const legend = $('#trendLegend');
  const forecastBox = $('#trendForecast');
  const segments = $('#trendSegments');
  const customerBox = $('#trendCustomers');
  const chartBox = $('#trendChart').closest('.trend-chart');
  chartBox.hidden = isCustomers;
  legend.hidden = isCustomers;
  segments.hidden = isCustomers;
  forecastBox.hidden = isCustomers;
  customerBox.hidden = !isCustomers;

  if (isCustomers) {
    const c = d.customers;
    k.innerHTML = [
      trendKpi('样本客户', `${c.summary.sample_customers} 户`, '编号已脱敏'),
      trendKpi('可跟进机会', `${c.summary.followups} 个`, `低渗透 ${c.summary.low_penetration} 户`),
      trendKpi('资金配置潜力', `${trendNum(c.summary.aum_potential_yi)} 亿`, 'AUM / 存款沉淀')
    ].join('');
    renderCustomerOpportunities(c);
    $('#trendNote').textContent = '客户编号已脱敏；机会为沙盘假设，需客户经理按实际 KYC、产品使用与授权范围验证。';
    return;
  }

  if (isForecast) {
    k.innerHTML = [
      trendKpi('5 日合计 · P72', `${trendNum(d.forecast.total.p72)} 亿`, `P50 ${trendNum(d.forecast.total.p50)} · P95 ${trendNum(d.forecast.total.p95)}`),
      trendKpi('日均 · P72', `${trendNum(d.forecast.total.p72 / d.forecast.days)} 亿`, `${d.forecast.days} 个工作日`),
      trendKpi('预测区间', `${trendNum(d.forecast.total.p50)}–${trendNum(d.forecast.total.p95)} 亿`, 'P50–P95 · 沙盘回测')
    ].join('');
    legend.innerHTML = '<span><i style="background:#1D4ED8"></i>P50 预测</span><span><i style="background:#FCA5A5;height:7px"></i>P72–P95 区间</span>';
    renderTrendChartForecast(d.forecast.daily);
    forecastBox.innerHTML = d.forecast.daily.map((x) => `<div class="trend-day"><span>${x.date.slice(5).replace('-', '/')} · ${x.weekday}</span><b>${trendNum(x.p50)}</b><small>P72 ${trendNum(x.p72)} · P95 ${trendNum(x.p95)}</small></div>`).join('');
  } else {
    const today = d.today.inflow;
    const delta = today - r.avg_total;
    k.innerHTML = [
      trendKpi('今日来账', `${trendNum(today)} 亿`, '当前口径 · 全量'),
      trendKpi(`${range} 日均`, `${trendNum(r.avg_total)} 亿`, `${r.days} 个工作日`),
      trendKpi('较区间均值', `${delta >= 0 ? '+' : '−'}${trendNum(Math.abs(delta))} 亿`, delta >= 0 ? '高于历史均值' : '低于历史均值')
    ].join('');
    legend.innerHTML = '<span><i style="background:#0B7A63"></i>全量来账</span><span><i style="background:#1D4ED8"></i>已确认可用流入</span>';
    renderTrendChartHistory(r.series);
    forecastBox.innerHTML = d.forecast.daily.slice(0, 5).map((x) => `<div class="trend-day"><span>${x.date.slice(5).replace('-', '/')} · ${x.weekday}</span><b>${trendNum(x.p72)}</b><small>P72 · 预测</small></div>`).join('');
  }

  const seg = (d.ranges[range] || d.ranges['3M']);
  const total = seg.avg_recurring + seg.avg_large + seg.avg_instant;
  const items = [
    ['经常性客户', seg.avg_recurring, total],
    ['大额客户', seg.avg_large, total],
    ['即时转账', seg.avg_instant, total]
  ];
  segments.innerHTML = items.map(([label, val, all]) => `<div class="trend-segment"><div class="trend-segment-head"><span>${label}</span><b>${(val / all * 100).toFixed(1)}%</b></div><div class="trend-segment-bar"><span style="width:${Math.min(100, val / all * 100)}%"></span></div></div>`).join('');
  $('#trendNote').textContent = isForecast
    ? '预测：基于 6 个月沙盘历史、星期效应与残差 bootstrap；P50/P72/P95 为沙盘回测，不是生产预测。'
    : `历史：${range} 区间共 ${seg.days} 个工作日；当前为沙盘历史，用于验证趋势与客户结构。`;
}

function renderCustomerOpportunities(c) {
  const list = (c.customers || []).map((x) => `<article class="opp-card">
    <div class="opp-top"><b>${esc(x.id)}</b><span class="opp-type">${esc(x.segment)}</span><em class="opp-score">${esc(x.score)}</em></div>
    <div class="opp-metrics"><span>3M 来账 <b>${trendNum(x.inflow3m)} 亿</b></span><span>平均余额 <b>${trendNum(x.avgBalance)} 亿</b></span></div>
    <div class="opp-products">当前产品：${(x.products || []).map(esc).join(' / ') || '—'}</div>
    <div class="opp-opportunity"><span>${esc(x.opportunity)}</span><small>${esc(x.type)}</small></div>
    <p>${esc(x.rationale)}</p>
  </article>`).join('');
  $('#trendCustomers').innerHTML = `<div class="opp-summary"><span>机会类型</span><b>存款/AUM · 现金管理 · 贸易融资 · 获客</b></div><div class="opp-grid">${list}</div>`;
}

function renderTrendChartHistory(series) {
  const W = 820, H = 240, L = 48, R = 18, T = 18, B = 30;
  const max = Math.max(...series.map((x) => x.total), ...series.map((x) => x.confirmed), 1) * 1.08;
  const n = series.length;
  const x = (i) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = (v) => H - B - (v / max) * (H - T - B);
  const path = (key) => series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = `${path('total')} L${x(n - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = y(v);
    grid += `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" stroke="#E2E8F0" stroke-width="1"/>`;
    grid += `<text x="${L - 8}" y="${yy + 3}" text-anchor="end" fill="#6B7A90" font-size="9">${v.toFixed(0)}</text>`;
  }
  const ticks = [0, Math.floor(n / 3), Math.floor(n * 2 / 3), n - 1];
  const labels = ticks.map((i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" fill="#6B7A90" font-size="9">${trendDateLabel(series[i].date)}</text>`).join('');
  $('#trendChart').innerHTML = `${grid}<path d="${area}" fill="rgba(11,122,99,.08)"/><path d="${path('total')}" fill="none" stroke="#0B7A63" stroke-width="2"/><path d="${path('confirmed')}" fill="none" stroke="#1D4ED8" stroke-width="1.6" stroke-dasharray="4 4"/>${labels}`;
}

function renderTrendChartForecast(days) {
  const W = 820, H = 240, L = 48, R = 18, T = 18, B = 30;
  const max = Math.max(...days.map((x) => x.p95), 1) * 1.1;
  const n = days.length;
  const x = (i) => L + ((i + 0.5) / n) * (W - L - R);
  const y = (v) => H - B - (v / max) * (H - T - B);
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = y(v);
    grid += `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" stroke="#E2E8F0" stroke-width="1"/>`;
    grid += `<text x="${L - 8}" y="${yy + 3}" text-anchor="end" fill="#6B7A90" font-size="9">${v.toFixed(0)}</text>`;
  }
  let bars = '';
  days.forEach((d, i) => {
    const w = 36, cx = x(i);
    bars += `<rect x="${cx - w / 2}" y="${y(d.p95)}" width="${w}" height="${Math.max(1, y(d.p72) - y(d.p95))}" fill="#FCA5A5" opacity=".45" rx="3"/>`;
    bars += `<rect x="${cx - w / 2}" y="${y(d.p72)}" width="${w}" height="${Math.max(1, y(d.p50) - y(d.p72))}" fill="#60A5FA" opacity=".35" rx="3"/>`;
    bars += `<rect x="${cx - w / 2}" y="${y(d.p50)}" width="${w}" height="${Math.max(2, H - B - y(d.p50))}" fill="#1D4ED8" opacity=".85" rx="3"/>`;
    bars += `<text x="${cx}" y="${H - 10}" text-anchor="middle" fill="#6B7A90" font-size="9">${d.date.slice(5).replace('-', '/')} ${d.weekday}</text>`;
  });
  $('#trendChart').innerHTML = `${grid}${bars}`;
}

function bindTrend() {
  const btn = $('#inflowTrendBtn');
  if (!btn) return;
  btn.addEventListener('click', openTrend);
  $('#trendClose').addEventListener('click', closeTrend);
  $('#trendBackdrop').addEventListener('click', closeTrend);
  $$('.trend-tab').forEach((b) => b.addEventListener('click', () => renderTrend(b.dataset.trendRange)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTrend(); });
}
  function init() {
    renderRows();
    updateStats();
    renderCipsNet();
    bind();
    bindTrend();
    setTimeout(runAgent, 550);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
