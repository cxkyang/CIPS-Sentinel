/* ============================================================
   CIPS 分行头寸 · TOPS · mock data + interaction
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n2 = (n) => Number(n || 0).toFixed(2);

  const CIPS_FLOOR = 2.0;
  const DATE = '2026-08-11';

  const branches = [
    { no: '001', name: '北京分行', reported: 0.42, large: 0.180, small: 0.035, settled: 0.140, net: 0.025, available: 0.28 },
    { no: '002', name: '上海分行', reported: 0.36, large: 0.210, small: 0.042, settled: 0.190, net: -0.030, available: 0.17 },
    { no: '003', name: '深圳分行', reported: 0.31, large: 0.150, small: 0.028, settled: 0.120, net: 0.018, available: 0.19 },
    { no: '004', name: '广州分行', reported: 0.28, large: 0.090, small: 0.020, settled: 0.075, net: 0.005, available: 0.205 },
    { no: '005', name: '杭州分行', reported: 0.22, large: 0.070, small: 0.015, settled: 0.060, net: -0.012, available: 0.16 },
    { no: '006', name: '总行营业部', reported: 0.18, large: 0.040, small: 0.006, settled: 0.030, net: 0.002, available: 0.15 }
  ];

  const addRequests = [
    { id: 'ADD-001', branchNo: '003', branchName: '深圳分行', date: DATE, amount: 0.05, reason: '下午跨境付款集中，预计 CIPS 清算量增加', status: 'pending' }
  ];

  const pendingPayments = [
    { id: 'PAY-20260811-001', branchNo: '001', branch: '北京分行', amount: 0.18, group: 'NORMAL CLIENT', status: 'PENDING' },
    { id: 'PAY-20260811-002', branchNo: '002', branch: '上海分行', amount: 0.12, group: 'GM', status: 'PENDING' },
    { id: 'PAY-20260811-003', branchNo: '003', branch: '深圳分行', amount: 0.12, group: 'TIME CRITICAL', status: 'PENDING' }
  ];

  const state = {
    role: 'MKTY',
    balance: 1.82,
    simulated: false,
    filters: { branch: '', type: 'all', from: '2026-08-01', to: '2026-08-11' },
    requests: addRequests.map((x) => ({ ...x })),
    pays: pendingPayments.map((x) => ({ ...x }))
  };

  const STATUS = {
    normal: { label: '正常', cls: 'normal' },
    wait: { label: '加报待审', cls: 'wait' },
    pending: { label: '待审批', cls: 'review' },
    approved: { label: '已批准', cls: 'approved' },
    executed: { label: '已执行', cls: 'approved' },
    rejected: { label: '已拒绝', cls: 'rejected' },
    PENDING: { label: 'PENDING', cls: 'pending-pay' },
    retry: { label: '可重试', cls: 'approved' }
  };

  const pill = (key) => {
    const s = STATUS[key] || STATUS.normal;
    return `<span class="status-pill ${s.cls}">${s.label}</span>`;
  };

  const amount = (n, cls = '') => `<span class="num ${cls}">${n2(n)}</span>`;
  const branchByNo = (no) => branches.find((b) => b.no === no);
  const pendingForBranch = (no) => state.requests.some((r) => r.branchNo === no && r.status === 'pending');

  function setRole(role) {
    state.role = role;
    $$('.role-btn').forEach((b) => b.classList.toggle('active', b.dataset.role === role));
    $('#roleHint').textContent = role === 'OPS'
      ? 'OPS 可发起加报；提交后由 MKTY 审批'
      : 'MKTY 只负责批准/拒绝，不执行资金调拨；执行由资金运营在行内系统完成';
    $('#addBtn').disabled = role !== 'OPS';
    $('#addBtn').style.display = role === 'OPS' ? '' : 'none';
    render();
  }

  function applyFilter(rows) {
    const f = state.filters;
    return rows.filter((r) => {
      const branchText = `${r.branchNo || ''} ${r.branchName || r.branch || ''}`;
      const branchOk = !f.branch || branchText.toLowerCase().includes(f.branch.toLowerCase()) || branchText.replace(/^0+/, '').includes(f.branch.replace(/^0+/, ''));
      const typeOk = f.type === 'all' || r.type === f.type;
      const fromOk = !f.from || r.date >= f.from;
      const toOk = !f.to || r.date <= f.to;
      return branchOk && typeOk && fromOk && toOk;
    });
  }

  function baseRows() {
    return branches.map((b) => ({
      kind: 'base', type: '报送头寸', branchNo: b.no, branchName: b.name, date: DATE,
      reported: b.reported, large: b.large, small: b.small, settled: b.settled, net: b.net, available: b.available,
      status: pendingForBranch(b.no) ? 'wait' : 'normal'
    }));
  }

  function requestRows() {
    return state.requests.map((r) => ({
      kind: 'add', type: '加报头寸', branchNo: r.branchNo, branchName: r.branchName, date: r.date,
      reported: r.amount, large: null, small: null, settled: null, net: null, available: null,
      status: r.status, id: r.id, reason: r.reason, staffId: r.staffId, executionStatus: r.executionStatus
    }));
  }

  function execCell(r) {
    if (r.kind !== 'add' || r.status === 'pending' || r.status === 'rejected') return '<span class="disabled">—</span>';
    if (r.executionStatus === 'executed') return '<span class="status-pill approved">资金运营已执行</span>';
    return '<span class="status-pill wait">待资金运营执行</span>';
  }

  function actionCell(r) {
    if (r.kind !== 'add') return '<span class="disabled">—</span>';
    if (r.status === 'pending') {
      if (state.role !== 'MKTY') return '<span class="disabled">待 MKTY 审批</span>';
      return `<div class="row-actions"><button class="ok" data-approve="${esc(r.id)}">批准</button><button class="no" data-reject="${esc(r.id)}">拒绝</button></div>`;
    }
    if (r.status === 'rejected') return `<div class="staff-line"><span>MKTY · STAFF ID</span><b>${esc(r.staffId || '—')}</b></div>`;
    if (r.executionStatus === 'executed') return `<div class="staff-line"><span>MKTY · STAFF ID</span><b>${esc(r.staffId || '—')}</b></div><div class="exec-line">资金运营已执行</div>`;
    return `<div class="staff-line"><span>MKTY · STAFF ID</span><b>${esc(r.staffId || '—')}</b></div><div class="exec-line">待资金运营执行</div>`;
  }

  function rowHtml(r) {
    const isAdd = r.kind === 'add';
    return `<tr class="${isAdd ? 'add-row' : ''}" data-kind="${r.kind}" data-type="${r.type}" data-branch="${esc(r.branchNo)}" data-date="${r.date}">
      <td><div class="branch-cell"><b>${esc(r.branchNo)}</b><span>${esc(r.branchName)}</span><span class="type-tag ${isAdd ? 'add' : ''}">${esc(r.type)}</span></div></td>
      <td class="branch-date">${esc(r.date)}</td>
      <td class="ta-r">${amount(r.reported, 'key')}</td>
      <td class="ta-r">${r.large == null ? '<span class="num muted">—</span>' : amount(r.large)}</td>
      <td class="ta-r">${r.small == null ? '<span class="num muted">—</span>' : amount(r.small)}</td>
      <td class="ta-r">${r.settled == null ? '<span class="num muted">—</span>' : amount(r.settled)}</td>
      <td class="ta-r">${r.net == null ? '<span class="num muted">—</span>' : amount(r.net, r.net < 0 ? 'negative' : '')}</td>
      <td class="ta-r">${r.available == null ? '<span class="num muted">—</span>' : amount(r.available, 'key')}</td>
      <td>${pill(r.status)}</td>
      <td>${execCell(r)}</td>
      <td>${actionCell(r)}</td>
    </tr>`;
  }

  function renderTable() {
    const rows = applyFilter([...baseRows(), ...requestRows()]);
    $('#branchRows').innerHTML = rows.map(rowHtml).join('');
    $('#tableCount').textContent = `${branches.length} 个分行 · ${state.requests.length} 笔加报`;
  }

  function renderAddRequests() {
    const pending = state.requests.filter((r) => r.status === 'pending');
    $('#addCount').textContent = `${pending.length} 待审批`;
    $('#addCount').className = `status-pill ${pending.length ? 'review' : 'approved'}`;
    const decided = state.requests.filter((r) => r.status !== 'pending').slice(-2);
    const decidedHtml = decided.length ? `<div class="approval-log"><div class="approval-log-head">最近批复</div>${decided.map((r) => `<div class="approval-log-row"><b>${esc(r.id)}</b><span>${esc(r.branchName)} · ${r.status === 'approved' ? (r.executionStatus === 'executed' ? '资金运营已执行' : 'MKTY 已批准 · 待资金运营执行') : 'MKTY 已拒绝'}</span><em>STAFF ID ${esc(r.staffId || '—')}</em></div>`).join('')}</div>` : '';
    if (!pending.length) {
      $('#addRequests').innerHTML = '<div class="add-empty">暂无待审批加报。<br>切换 OPS 视角可发起新的加报。</div>' + decidedHtml;
      return;
    }
    $('#addRequests').innerHTML = pending.map((r) => `<div class="add-item">
      <div class="add-item-head"><b>${esc(r.branchNo)} · ${esc(r.branchName)}</b><span>${esc(r.id)}</span></div>
      <div class="add-amount">+${n2(r.amount)}<small>亿</small></div>
      <div class="add-reason">${esc(r.reason)}</div>
      ${state.role === 'MKTY' ? `<div class="add-actions"><button class="btn primary" data-approve="${esc(r.id)}">批准</button><button class="btn ghost" data-reject="${esc(r.id)}">拒绝</button></div>` : '<div class="add-reason">等待 MKTY 审批。</div>'}
    </div>`).join('') + decidedHtml;
  }

  function renderPending() {
    const active = state.pays.filter((p) => p.status === 'PENDING' || p.status === 'retry');
    const pendingCount = active.filter((p) => p.status === 'PENDING').length;
    const retryCount = active.filter((p) => p.status === 'retry').length;
    $('#pendingPaysCount').textContent = pendingCount ? `${pendingCount} 笔` : `${retryCount} 可重试`;
    $('#pendingPaysCount').className = `status-pill ${pendingCount ? 'unmatched' : 'approved'}`;
    $('#pendingPayments').innerHTML = active.map((p) => `<div class="pending-item">
      <i class="pending-dot" style="${p.status === 'retry' ? 'background:var(--jade)' : ''}"></i>
      <div class="pending-main"><b>${esc(p.id)}</b><span>${esc(p.group)} · ${esc(p.branch)} · ${p.status === 'retry' ? '余额恢复，等待 GPE 重试' : 'CIPS_FLOOR_BREACH'}</span></div>
      <div class="pending-amt ${p.status === 'retry' ? 'ok' : ''}">${n2(p.amount)} 亿</div>
    </div>`).join('');
  }

  function renderGate() {
    const global = state.balance - CIPS_FLOOR;
    const below = state.balance < CIPS_FLOOR;
    const card = $('#gateCard');
    card.classList.toggle('gate-critical', below);
    card.classList.toggle('gate-ok', !below);
    $('#gateBalance').textContent = n2(state.balance);
    $('#globalAvailable').textContent = `${global < 0 ? '−' : ''}${n2(Math.abs(global))} 亿`;
    $('#globalAvailable').classList.toggle('negative', below);
    $('#gateBadge').innerHTML = below
      ? '<svg class="icon xs"><use href="#i-alert"/></svg>PENDING'
      : '<svg class="icon xs"><use href="#i-check"/></svg>正常';
    $('#gateExplain').innerHTML = below
      ? '<svg class="icon xs"><use href="#i-alert"/></svg><span>余额低于 2 亿，新增支付进入 GPE PENDING；MKTY 批复不能突破该底线。</span>'
      : '<svg class="icon xs"><use href="#i-check"/></svg><span>余额已恢复至 2 亿以上；PENDING 支付可由 GPE 重新校验后释放。</span>';
    $('#statCips').textContent = n2(state.balance);
    $('#simulateInflow').disabled = state.simulated;
  }

  function renderStats() {
    const reported = branches.reduce((s, b) => s + b.reported, 0);
    const available = branches.reduce((s, b) => s + b.available, 0);
    const pendingAdds = state.requests.filter((r) => r.status === 'pending');
    const pendingPays = state.pays.filter((p) => p.status === 'PENDING');
    $('#statReported').textContent = n2(reported);
    $('#statAvailable').textContent = n2(available);
    $('#statPendingAdds').textContent = pendingAdds.length;
    $('#statPendingAddsSub').textContent = `笔 · ${n2(pendingAdds.reduce((s, r) => s + r.amount, 0))} 亿`;
    $('#statPendingPays').textContent = pendingPays.length;
    $('#statPendingPaysSub').textContent = `笔 · ${n2(pendingPays.reduce((s, p) => s + p.amount, 0))} 亿`;
  }

  function render() {
    renderTable();
    renderAddRequests();
    renderPending();
    renderGate();
    renderStats();
  }

  function showToast(message, warn = false) {
    const t = $('#toast');
    t.className = `toast show${warn ? ' warn' : ''}`;
    t.innerHTML = `<svg class="icon sm"><use href="#${warn ? 'i-alert' : 'i-check'}"/></svg><div>${message}</div>`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { t.classList.remove('show'); }, 4200);
  }

  function handleRequest(id, approved) {
    const r = state.requests.find((x) => x.id === id);
    if (!r || r.status !== 'pending') return;
    r.status = approved ? 'approved' : 'rejected';
    r.staffId = '12345678';
    r.executionStatus = approved ? 'pending' : null;
    r.executor = '资金运营';
    if (approved) {
      showToast(`MKTY 已批准 <b>${esc(r.branchName)}</b> 加报 ${n2(r.amount)} 亿 · STAFF ID <b>12345678</b>；待资金运营执行。`, true);
    } else {
      showToast(`MKTY 已拒绝 <b>${esc(r.branchName)}</b> 加报 ${n2(r.amount)} 亿 · STAFF ID <b>12345678</b>。`);
    }
    render();
  }

  function simulateInflow() {
    if (state.simulated) return;
    state.balance += 0.70;
    state.simulated = true;
    state.pays.forEach((p) => { if (p.status === 'PENDING') p.status = 'retry'; });
    render();
    showToast(`已模拟 CIPS 入账 0.70 亿，余额 ${n2(state.balance)} 亿；PENDING 支付可重试。`);
  }

  function openAddModal() {
    if (state.role !== 'OPS') {
      showToast('请切换到 OPS 视角后发起加报。', true);
      return;
    }
    const sel = $('#addBranch');
    sel.innerHTML = branches.map((b) => `<option value="${b.no}">${b.no} · ${b.name}</option>`).join('');
    $('#addAmount').value = '';
    $('#addReason').value = '';
    $('#addModal').classList.add('open');
    $('#addModal').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#addAmount').focus(), 80);
  }

  function closeAddModal() {
    $('#addModal').classList.remove('open');
    $('#addModal').setAttribute('aria-hidden', 'true');
  }

  function submitAdd(e) {
    e.preventDefault();
    const no = $('#addBranch').value;
    const amount = Number($('#addAmount').value);
    const reason = $('#addReason').value.trim();
    if (!no || !Number.isFinite(amount) || amount <= 0 || !reason) {
      showToast('请填写分行、加报金额和原因。', true);
      return;
    }
    const b = branchByNo(no);
    const id = `ADD-${String(state.requests.length + 1).padStart(3, '0')}`;
    state.requests.push({ id, branchNo: no, branchName: b.name, date: DATE, amount, reason, status: 'pending' });
    closeAddModal();
    setRole('MKTY');
    showToast(`加报已提交：${esc(b.name)} +${n2(amount)} 亿，等待 MKTY 审批。`);
  }

  function applyFilters() {
    state.filters = {
      branch: $('#branchFilter').value.trim(),
      type: $('#typeFilter').value,
      from: $('#dateFrom').value,
      to: $('#dateTo').value
    };
    renderTable();
  }

  function resetFilters() {
    $('#branchFilter').value = '';
    $('#typeFilter').value = 'all';
    $('#dateFrom').value = '2026-08-01';
    $('#dateTo').value = '2026-08-11';
    state.filters = { branch: '', type: 'all', from: '2026-08-01', to: '2026-08-11' };
    renderTable();
  }

  function bind() {
    $$('.role-btn').forEach((btn) => btn.addEventListener('click', () => setRole(btn.dataset.role)));
    $('#addBtn').addEventListener('click', openAddModal);
    $('#addClose').addEventListener('click', closeAddModal);
    $('#addCancel').addEventListener('click', closeAddModal);
    $('#addModal').addEventListener('click', (e) => { if (e.target === $('#addModal')) closeAddModal(); });
    $('#addForm').addEventListener('submit', submitAdd);
    $('#simulateInflow').addEventListener('click', simulateInflow);
    $('#resetDemo').addEventListener('click', () => location.reload());
    $('#queryBtn').addEventListener('click', applyFilters);
    $('#resetFilters').addEventListener('click', resetFilters);
    $('#branchRows').addEventListener('click', (e) => {
      const a = e.target.closest('[data-approve]');
      const r = e.target.closest('[data-reject]');
      if (a) handleRequest(a.dataset.approve, true);
      if (r) handleRequest(r.dataset.reject, false);
    });
    $('#addRequests').addEventListener('click', (e) => {
      const a = e.target.closest('[data-approve]');
      const r = e.target.closest('[data-reject]');
      if (a) handleRequest(a.dataset.approve, true);
      if (r) handleRequest(r.dataset.reject, false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAddModal(); });
  }

  function init() { bind(); setRole('MKTY'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
