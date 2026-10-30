const STORE_KEY = 'zoro-trade-journal-v1';
const IST_ZONE = 'Asia/Kolkata';
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
});

const pageInfo = {
  dashboard: ['OVERVIEW', 'Trading dashboard'],
  trade: ['EXECUTION', 'Record a trade'],
  history: ['LEDGER', 'Trade history'],
  journal: ['REFLECTION', 'Daily journal'],
  playbook: ['DISCIPLINE', 'Setup playbook'],
  analytics: ['INSIGHTS', 'Performance analytics']
};

const journalPlaceholders = {
  premarket: 'Write your plan before the market opens...',
  plan: 'List the trades, levels, and rules for today...',
  review: 'Review your choices and the market close...',
  lessons: 'Write the lessons you want to keep...'
};

let state = loadState();
let currentJournalSection = 'premarket';
let journalSaveTimer;
let sortState = { key: 'openedAt', direction: 'desc' };
let dateFilter = { mode: 'all', from: '', to: '' };
let heatmapYear = Number(istDateKey().slice(0, 4));
let openDetailId = null;
const charts = {};

function blankState() {
  return {
    version: 2,
    trades: [],
    journal: {},
    customTags: [],
    playbooks: [],
    limits: { maxLoss: 0, profitTarget: 0, maxTrades: 0 }
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!saved || !Array.isArray(saved.trades) || typeof saved.journal !== 'object') return blankState();
    return { ...blankState(), ...saved };
  } catch {
    return blankState();
  }
}

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function money(value = 0) {
  return INR.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function tone(element, value) {
  element.classList.remove('positive', 'negative');
  if (value > 0) element.classList.add('positive');
  if (value < 0) element.classList.add('negative');
}

function escapeHtml(value = '') {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}

function istDate(value, withTime = false) {
  if (!value) return '—';
  const date = value.includes('T') && !/[zZ]|[+-]\d\d:\d\d$/.test(value)
    ? new Date(`${value}:00+05:30`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_ZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {})
  }).format(date);
}

function istDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function istInputNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function showToast(message, error = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function switchPage(name) {
  const info = pageInfo[name];
  if (!info) return;
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === name));
  document.querySelectorAll('.rail-link[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === name));
  document.getElementById('page-kicker').textContent = info[0];
  document.getElementById('page-title').textContent = info[1];
  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'journal') loadJournal();
  if (name === 'playbook') renderPlaybook();
  if (name === 'analytics') renderAnalytics();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateClock() {
  const value = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(new Date());
  document.getElementById('ist-clock').textContent = `${value} IST`;
}

function addTradeRow(kind, data = {}) {
  const template = document.getElementById('entry-row-template');
  const row = template.content.firstElementChild.cloneNode(true);
  row.dataset.kind = kind;
  row.querySelector('.row-date').value = data.date || istInputNow();
  row.querySelector('.row-price').value = data.price ?? '';
  row.querySelector('.row-qty').value = data.qty ?? '';
  row.querySelector('.row-remove').addEventListener('click', () => {
    row.remove();
    updateRowButtons();
    updateLiveCalculation();
  });
  row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateLiveCalculation));
  document.getElementById(`${kind}-rows`).appendChild(row);
  updateRowButtons();
  return row;
}

function updateRowButtons() {
  const entries = document.querySelectorAll('#entry-rows .trade-row');
  entries.forEach(row => row.querySelector('.row-remove').style.visibility = entries.length === 1 ? 'hidden' : 'visible');
}

function readRows(kind, strict = true) {
  const rows = [...document.querySelectorAll(`#${kind}-rows .trade-row`)];
  return rows.map(row => {
    const date = row.querySelector('.row-date').value;
    const price = Number(row.querySelector('.row-price').value);
    const qty = Number(row.querySelector('.row-qty').value);
    if (strict && (!date || !(price > 0) || !(qty > 0))) throw new Error(`Complete every ${kind.slice(0, -1)} row.`);
    return { date, price, qty };
  }).filter(row => row.date && row.price > 0 && row.qty > 0);
}

function calculateTrade(trade) {
  const entries = trade.entries || [];
  const exits = trade.exits || [];
  const entryQty = entries.reduce((sum, row) => sum + row.qty, 0);
  const entryValue = entries.reduce((sum, row) => sum + row.price * row.qty, 0);
  const avgEntry = entryQty ? entryValue / entryQty : 0;
  const exitQty = exits.reduce((sum, row) => sum + row.qty, 0);
  if (exitQty > entryQty + 1e-9) throw new Error('Exit quantity cannot exceed entry quantity.');

  const sign = trade.side === 'Short' ? -1 : 1;
  const multiplier = Number(trade.multiplier) || 1;
  const realisedGross = exits.reduce(
    (sum, row) => sum + (row.price - avgEntry) * row.qty * sign * multiplier, 0
  );
  const remainingQty = Math.max(0, entryQty - exitQty);
  const currentPrice = Number(trade.currentPrice) || 0;
  const unrealised = trade.status === 'Open' && currentPrice
    ? (currentPrice - avgEntry) * remainingQty * sign * multiplier
    : 0;
  const fees = Number(trade.fees) || 0;
  const risk = trade.stopLoss
    ? Math.abs(avgEntry - Number(trade.stopLoss)) * entryQty * multiplier
    : 0;
  const plannedReward = trade.target
    ? Math.abs(Number(trade.target) - avgEntry) * entryQty * multiplier
    : 0;

  return {
    avgEntry, entryQty, exitQty, remainingQty,
    realisedGross, unrealised, netPnl: realisedGross + unrealised - fees,
    risk, rr: risk && plannedReward ? plannedReward / risk : null
  };
}

function draftTrade() {
  const status = document.getElementById('status').value;
  return {
    side: document.getElementById('side').value,
    status,
    multiplier: Number(document.getElementById('multiplier').value) || 1,
    currentPrice: Number(document.getElementById('current-price').value) || null,
    stopLoss: Number(document.getElementById('stop-loss').value) || null,
    target: Number(document.getElementById('target').value) || null,
    fees: Number(document.getElementById('fees').value) || 0,
    entries: readRows('entry', false),
    exits: readRows('exit', false)
  };
}

function updateLiveCalculation() {
  try {
    const result = calculateTrade(draftTrade());
    const pnl = document.getElementById('live-pnl');
    pnl.textContent = money(result.netPnl);
    tone(pnl, result.netPnl);
    document.getElementById('risk-amount').value = money(result.risk);
    document.getElementById('live-rr').textContent = result.rr ? `${result.rr.toFixed(2)} R` : '—';
  } catch {
    document.getElementById('live-pnl').textContent = '—';
    document.getElementById('risk-amount').value = '—';
    document.getElementById('live-rr').textContent = '—';
  }
}

function syncQuickTags() {
  const selected = new Set(document.getElementById('tags').value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean));
  document.querySelectorAll('[data-quick-tag]').forEach(button => {
    button.classList.toggle('active', selected.has(button.dataset.quickTag.toLowerCase()));
  });
}

function toggleQuickTag(tag) {
  const input = document.getElementById('tags');
  const tags = input.value.split(',').map(value => value.trim()).filter(Boolean);
  const index = tags.findIndex(value => value.toLowerCase() === tag.toLowerCase());
  if (index >= 0) tags.splice(index, 1);
  else tags.push(tag);
  input.value = tags.join(', ');
  syncQuickTags();
}

function resetTradeForm() {
  document.getElementById('trade-form').reset();
  document.getElementById('trade-id').value = '';
  document.getElementById('entry-rows').innerHTML = '';
  document.getElementById('exit-rows').innerHTML = '';
  document.getElementById('multiplier').value = 1;
  document.getElementById('fees').value = 0;
  document.getElementById('confidence').value = 5;
  document.getElementById('confidence-value').textContent = 5;
  document.getElementById('save-trade').innerHTML = '<i class="fa-solid fa-check"></i> Save trade';
  syncQuickTags();
  addTradeRow('entry');
  addTradeRow('exit');
  updateLiveCalculation();
}

function tradeFromForm() {
  const status = document.getElementById('status').value;
  const entries = readRows('entry');
  const exits = readRows('exit', status === 'Closed');
  if (!entries.length) throw new Error('Add at least one entry.');
  if (status === 'Closed' && !exits.length) throw new Error('Closed trades need an exit.');

  const id = document.getElementById('trade-id').value || crypto.randomUUID();
  const existing = state.trades.find(trade => trade.id === id);
  const trade = {
    id,
    market: document.getElementById('market').value,
    symbol: document.getElementById('symbol').value.trim().toUpperCase(),
    side: document.getElementById('side').value,
    status,
    setup: document.getElementById('setup').value.trim(),
    multiplier: Number(document.getElementById('multiplier').value) || 1,
    currentPrice: Number(document.getElementById('current-price').value) || null,
    entries,
    exits,
    stopLoss: Number(document.getElementById('stop-loss').value) || null,
    target: Number(document.getElementById('target').value) || null,
    fees: Number(document.getElementById('fees').value) || 0,
    mood: document.getElementById('mood').value,
    confidence: Number(document.getElementById('confidence').value),
    followedRules: document.getElementById('rules').value,
    tags: [...new Set(document.getElementById('tags').value.split(',').map(tag => tag.trim()).filter(Boolean))],
    mistakes: document.getElementById('mistakes').value.trim(),
    notes: document.getElementById('notes').value.trim(),
    openedAt: entries[0].date,
    closedAt: exits.at(-1)?.date || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!trade.symbol) throw new Error('Enter a symbol.');
  if (!trade.setup) throw new Error('Enter a setup.');
  const result = calculateTrade(trade);
  if (status === 'Closed' && result.remainingQty > 1e-9) {
    throw new Error('A closed trade must exit the full quantity.');
  }
  Object.assign(trade, result);
  return trade;
}

function saveTrade(event) {
  event.preventDefault();
  try {
    const trade = tradeFromForm();
    const index = state.trades.findIndex(item => item.id === trade.id);
    if (index >= 0) state.trades[index] = trade;
    else state.trades.push(trade);
    trade.tags.forEach(tag => {
      if (!state.customTags.includes(tag)) state.customTags.push(tag);
    });
    persist();
    showToast(index >= 0 ? 'Trade updated.' : 'Trade saved.');
    resetTradeForm();
    switchPage('history');
  } catch (error) {
    showToast(error.message, true);
  }
}

function editTrade(id) {
  const trade = state.trades.find(item => item.id === id);
  if (!trade) return;
  resetTradeForm();
  document.getElementById('trade-id').value = trade.id;
  document.getElementById('market').value = trade.market;
  document.getElementById('symbol').value = trade.symbol;
  document.getElementById('side').value = trade.side;
  document.getElementById('status').value = trade.status;
  document.getElementById('setup').value = trade.setup;
  document.getElementById('multiplier').value = trade.multiplier || 1;
  document.getElementById('current-price').value = trade.currentPrice || '';
  document.getElementById('stop-loss').value = trade.stopLoss || '';
  document.getElementById('target').value = trade.target || '';
  document.getElementById('fees').value = trade.fees || 0;
  document.getElementById('mood').value = trade.mood || 'Calm';
  document.getElementById('confidence').value = trade.confidence || 5;
  document.getElementById('confidence-value').textContent = trade.confidence || 5;
  document.getElementById('rules').value = trade.followedRules || 'Yes';
  document.getElementById('tags').value = (trade.tags || []).join(', ');
  syncQuickTags();
  document.getElementById('mistakes').value = trade.mistakes || '';
  document.getElementById('notes').value = trade.notes || '';
  document.getElementById('entry-rows').innerHTML = '';
  document.getElementById('exit-rows').innerHTML = '';
  trade.entries.forEach(row => addTradeRow('entry', row));
  trade.exits.forEach(row => addTradeRow('exit', row));
  if (!trade.exits.length) updateRowButtons();
  document.getElementById('save-trade').innerHTML = '<i class="fa-solid fa-check"></i> Update trade';
  updateLiveCalculation();
  switchPage('trade');
}

function deleteTrade(id) {
  const trade = state.trades.find(item => item.id === id);
  if (!trade || !confirm(`Delete ${trade.symbol}? This cannot be undone.`)) return;
  state.trades = state.trades.filter(item => item.id !== id);
  persist();
  renderHistory();
  renderDashboard();
  showToast('Trade deleted.');
}

function closedTrades() {
  return state.trades.filter(trade => trade.status === 'Closed');
}

function metrics() {
  state.trades.forEach(trade => Object.assign(trade, calculateTrade(trade)));
  const closed = closedTrades();
  const open = state.trades.filter(trade => trade.status === 'Open');
  const wins = closed.filter(trade => trade.netPnl > 0);
  const losses = closed.filter(trade => trade.netPnl < 0);
  const realised = closed.reduce((sum, trade) => sum + trade.netPnl, 0);
  const openPnl = open.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossWins = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const rrValues = closed.map(trade => trade.rr).filter(Number.isFinite);
  return {
    closed, open, wins, losses, realised, openPnl,
    total: realised + openPnl,
    winRate: closed.length ? wins.length / closed.length * 100 : 0,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Infinity : null,
    avgWin: wins.length ? grossWins / wins.length : 0,
    avgLoss: losses.length ? -grossLosses / losses.length : 0,
    avgRr: rrValues.length ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : null,
    fees: state.trades.reduce((sum, trade) => sum + (trade.fees || 0), 0)
  };
}

function dailyStats() {
  const today = istDateKey();
  const trades = state.trades.filter(trade => trade.openedAt?.slice(0, 10) === today);
  trades.forEach(trade => Object.assign(trade, calculateTrade(trade)));
  return { trades: trades.length, pnl: trades.reduce((sum, trade) => sum + trade.netPnl, 0) };
}

function dailyLimitState() {
  const current = dailyStats();
  const limits = state.limits || blankState().limits;
  const lossReached = limits.maxLoss > 0 && current.pnl <= -limits.maxLoss;
  const profitReached = limits.profitTarget > 0 && current.pnl >= limits.profitTarget;
  const tradesReached = limits.maxTrades > 0 && current.trades >= limits.maxTrades;
  const configured = limits.maxLoss > 0 || limits.profitTarget > 0 || limits.maxTrades > 0;
  return { current, limits, lossReached, profitReached, tradesReached, configured };
}

function renderDailyGuard() {
  const data = dailyLimitState();
  const panel = document.getElementById('daily-guard');
  const pnl = document.getElementById('guard-pnl');
  pnl.textContent = money(data.current.pnl);
  tone(pnl, data.current.pnl);
  document.getElementById('guard-trades').textContent = data.limits.maxTrades
    ? `${data.current.trades} / ${data.limits.maxTrades}` : `${data.current.trades}`;

  const pnlLimit = data.current.pnl < 0 ? data.limits.maxLoss : data.limits.profitTarget;
  const pnlProgress = pnlLimit ? Math.min(Math.abs(data.current.pnl) / pnlLimit * 100, 100) : 0;
  const tradeProgress = data.limits.maxTrades ? Math.min(data.current.trades / data.limits.maxTrades * 100, 100) : 0;
  document.getElementById('guard-pnl-bar').style.width = `${pnlProgress}%`;
  document.getElementById('guard-trades-bar').style.width = `${tradeProgress}%`;

  const warning = data.lossReached || data.tradesReached;
  panel.classList.toggle('warning', warning);
  const message = !data.configured ? 'Set your daily limits.'
    : data.lossReached ? 'Daily loss limit reached.'
    : data.tradesReached ? 'Daily trade limit reached.'
    : data.profitReached ? 'Daily profit target reached.'
    : 'Daily limits are clear.';
  document.getElementById('guard-message').textContent = message;
}

function lineItems(text = '') {
  return text.split(/\n+/).map(item => item.trim()).filter(Boolean);
}

function resetPlaybookForm() {
  document.getElementById('playbook-form').reset();
  document.getElementById('playbook-id').value = '';
  document.getElementById('playbook-form-title').textContent = 'Create a playbook';
}

function renderLimitSummary() {
  const data = dailyLimitState();
  const cards = [
    ['Daily P&L', money(data.current.pnl), data.lossReached ? 'reached' : ''],
    ['Trades taken', data.limits.maxTrades ? `${data.current.trades} / ${data.limits.maxTrades}` : `${data.current.trades}`, data.tradesReached ? 'reached' : ''],
    ['Profit target', data.limits.profitTarget ? money(data.limits.profitTarget) : 'Not set', data.profitReached ? 'success' : '']
  ];
  document.getElementById('limit-summary').innerHTML = cards.map(([label, value, status]) => `
    <div class="limit-card ${status}"><span>${label}</span><strong>${value}</strong></div>
  `).join('');
}

function renderPlaybook() {
  const limits = state.limits || blankState().limits;
  document.getElementById('limit-loss').value = limits.maxLoss || '';
  document.getElementById('limit-profit').value = limits.profitTarget || '';
  document.getElementById('limit-trades').value = limits.maxTrades || '';
  renderLimitSummary();

  const playbooks = state.playbooks || [];
  document.getElementById('playbook-count').textContent = `${playbooks.length} setup${playbooks.length === 1 ? '' : 's'}`;
  document.getElementById('setup-options').innerHTML = playbooks.map(item => `<option value="${escapeHtml(item.name)}"></option>`).join('');
  const container = document.getElementById('playbook-list');
  if (!playbooks.length) {
    container.innerHTML = '<div class="playbook-empty">Create your first setup playbook.</div>';
    return;
  }
  container.innerHTML = playbooks.map(item => {
    const rules = lineItems(item.rules);
    const checklist = lineItems(item.checklist);
    return `<article class="playbook-card">
      <div class="playbook-card-head">
        <div><h3>${escapeHtml(item.name)}</h3><span class="market-label">${escapeHtml(item.market)}</span></div>
        <div class="playbook-card-actions">
          <button class="action-button" data-playbook-edit="${item.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-button danger" data-playbook-delete="${item.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="playbook-block"><span>RULES</span>${rules.length ? `<ul>${rules.slice(0, 5).map(rule => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>` : '<p class="hero-note">No rules yet.</p>'}</div>
      <div class="playbook-block"><span>CHECKLIST</span>${checklist.length ? `<ul>${checklist.slice(0, 5).map(check => `<li>${escapeHtml(check)}</li>`).join('')}</ul>` : '<p class="hero-note">No checks yet.</p>'}</div>
    </article>`;
  }).join('');
}

function saveLimits(event) {
  event.preventDefault();
  state.limits = {
    maxLoss: Math.max(0, Number(document.getElementById('limit-loss').value) || 0),
    profitTarget: Math.max(0, Number(document.getElementById('limit-profit').value) || 0),
    maxTrades: Math.max(0, Math.floor(Number(document.getElementById('limit-trades').value) || 0))
  };
  persist();
  renderLimitSummary();
  renderDailyGuard();
  showToast('Daily limits saved.');
}

function savePlaybook(event) {
  event.preventDefault();
  const name = document.getElementById('playbook-name').value.trim();
  if (!name) return showToast('Enter a setup name.', true);
  const id = document.getElementById('playbook-id').value || crypto.randomUUID();
  const item = {
    id, name,
    market: document.getElementById('playbook-market').value,
    rules: document.getElementById('playbook-rules').value.trim(),
    checklist: document.getElementById('playbook-checklist').value.trim(),
    notes: document.getElementById('playbook-notes').value.trim(),
    updatedAt: new Date().toISOString()
  };
  const index = state.playbooks.findIndex(playbook => playbook.id === id);
  if (index >= 0) state.playbooks[index] = item;
  else state.playbooks.push(item);
  persist();
  resetPlaybookForm();
  renderPlaybook();
  showToast(index >= 0 ? 'Playbook updated.' : 'Playbook saved.');
}

function editPlaybook(id) {
  const item = state.playbooks.find(playbook => playbook.id === id);
  if (!item) return;
  document.getElementById('playbook-id').value = item.id;
  document.getElementById('playbook-name').value = item.name;
  document.getElementById('playbook-market').value = item.market;
  document.getElementById('playbook-rules').value = item.rules;
  document.getElementById('playbook-checklist').value = item.checklist;
  document.getElementById('playbook-notes').value = item.notes || '';
  document.getElementById('playbook-form-title').textContent = 'Edit playbook';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deletePlaybook(id) {
  const item = state.playbooks.find(playbook => playbook.id === id);
  if (!item || !confirm(`Delete the ${item.name} playbook?`)) return;
  state.playbooks = state.playbooks.filter(playbook => playbook.id !== id);
  persist();
  renderPlaybook();
  showToast('Playbook deleted.');
}

function renderDashboard() {
  const data = metrics();
  renderDailyGuard();
  document.getElementById('first-run-guide').hidden = state.trades.length > 0;
  const hero = document.getElementById('hero-pnl');
  hero.textContent = money(data.total);
  tone(hero, data.total);
  document.getElementById('hero-note').textContent = state.trades.length
    ? `${data.closed.length} closed · ${data.open.length} open`
    : 'Add your first trade to begin.';

  const realised = document.getElementById('metric-realised');
  realised.textContent = money(data.realised); tone(realised, data.realised);
  const open = document.getElementById('metric-open');
  open.textContent = money(data.openPnl); tone(open, data.openPnl);
  document.getElementById('metric-win-rate').textContent = `${data.winRate.toFixed(1)}%`;
  document.getElementById('metric-win-detail').textContent = `${data.wins.length} wins from ${data.closed.length} trades`;
  document.getElementById('metric-profit-factor').textContent = data.profitFactor === Infinity ? '∞' : data.profitFactor?.toFixed(2) || '—';
  document.getElementById('snapshot-rr').textContent = data.avgRr ? `${data.avgRr.toFixed(2)} R` : '—';
  document.getElementById('snapshot-win').textContent = money(data.avgWin);
  document.getElementById('snapshot-loss').textContent = money(data.avgLoss);
  document.getElementById('snapshot-fees').textContent = money(data.fees);
  document.getElementById('snapshot-closed').textContent = data.closed.length;

  const recent = [...state.trades].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 6);
  document.getElementById('recent-trades').innerHTML = recent.map(trade => `
    <tr><td><strong>${escapeHtml(trade.symbol)}</strong></td><td>${escapeHtml(trade.market)}</td>
    <td><span class="side ${trade.side.toLowerCase()}">${escapeHtml(trade.side)}</span></td>
    <td><span class="status-pill ${trade.status.toLowerCase()}">${escapeHtml(trade.status)}</span></td>
    <td>${istDate(trade.openedAt)}</td><td class="money ${trade.netPnl > 0 ? 'positive' : trade.netPnl < 0 ? 'negative' : ''}">${money(trade.netPnl)}</td></tr>
  `).join('');
  document.getElementById('recent-empty').classList.toggle('show', recent.length === 0);
  renderEquityChart('equity-chart', 'equity-empty');
}

function historyDateBounds() {
  const today = istDateKey();
  if (dateFilter.mode === 'all') return [null, null];
  if (dateFilter.mode === 'today') return [today, today];
  if (dateFilter.mode === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (dateFilter.mode === 'custom') return [dateFilter.from || null, dateFilter.to || null];

  const noon = new Date(`${today}T12:00:00+05:30`);
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: IST_ZONE, weekday: 'short' }).format(noon);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  noon.setUTCDate(noon.getUTCDate() - mondayOffset);
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: IST_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(noon);
  return [from, today];
}

function tradeMatchesDate(trade) {
  const [from, to] = historyDateBounds();
  const day = trade.openedAt?.slice(0, 10) || '';
  return (!from || day >= from) && (!to || day <= to);
}

function setDateFilter(mode) {
  dateFilter.mode = mode;
  document.querySelectorAll('[data-date-range]').forEach(button => button.classList.toggle('active', button.dataset.dateRange === mode));
  document.getElementById('custom-dates').hidden = mode !== 'custom';
  renderHistory();
}

function filteredTrades() {
  const query = document.getElementById('history-search').value.trim().toLowerCase();
  const market = document.getElementById('history-market').value;
  const status = document.getElementById('history-status').value;
  const result = document.getElementById('history-result').value;
  const list = state.trades.filter(trade => {
    const text = [trade.symbol, trade.setup, ...(trade.tags || [])].join(' ').toLowerCase();
    const resultMatch = !result || (result === 'win' && trade.netPnl > 0) || (result === 'loss' && trade.netPnl < 0) || (result === 'flat' && trade.netPnl === 0);
    return (!query || text.includes(query)) && (!market || trade.market === market) && (!status || trade.status === status) && resultMatch && tradeMatchesDate(trade);
  });
  const direction = sortState.direction === 'asc' ? 1 : -1;
  return list.sort((a, b) => {
    const av = a[sortState.key] ?? '';
    const bv = b[sortState.key] ?? '';
    return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * direction;
  });
}

function renderHistory() {
  metrics();
  const trades = filteredTrades();
  document.getElementById('date-result-count').textContent = `${trades.length} trade${trades.length === 1 ? '' : 's'}`;
  document.getElementById('history-body').innerHTML = trades.map(trade => `
    <tr>
      <td><strong>${escapeHtml(trade.symbol)}</strong></td><td>${escapeHtml(trade.market)}</td>
      <td><span class="side ${trade.side.toLowerCase()}">${escapeHtml(trade.side)}</span></td>
      <td><span class="status-pill ${trade.status.toLowerCase()}">${escapeHtml(trade.status)}</span></td>
      <td>${istDate(trade.openedAt)}</td><td>${escapeHtml(trade.setup)}</td>
      <td class="money ${trade.netPnl > 0 ? 'positive' : trade.netPnl < 0 ? 'negative' : ''}">${money(trade.netPnl)}</td>
      <td class="money">${trade.rr ? `${trade.rr.toFixed(2)} R` : '—'}</td>
      <td><div class="action-menu">
        <button class="action-button" data-view="${trade.id}" title="View details"><i class="fa-solid fa-eye"></i></button>
        <button class="action-button" data-edit="${trade.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="action-button danger" data-delete="${trade.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
  document.getElementById('history-empty').classList.toggle('show', trades.length === 0);
}

function detailRows(rows, label) {
  if (!rows?.length) return `<p class="detail-copy">No ${label.toLowerCase()} recorded.</p>`;
  return `<div class="detail-table"><table><thead><tr><th>Date and time</th><th>Price</th><th>Quantity</th></tr></thead><tbody>${rows.map(row => `
    <tr><td>${istDate(row.date, true)}</td><td class="money">${money(row.price)}</td><td class="money">${row.qty}</td></tr>
  `).join('')}</tbody></table></div>`;
}

function detailField(label, value, className = '') {
  return `<div class="detail-field"><span>${label}</span><strong class="${className}">${value ?? '—'}</strong></div>`;
}

function openTradeDetails(id) {
  const trade = state.trades.find(item => item.id === id);
  if (!trade) return;
  Object.assign(trade, calculateTrade(trade));
  openDetailId = id;
  document.getElementById('detail-edit').hidden = false;
  document.getElementById('detail-title').textContent = `${trade.symbol} · ${trade.side}`;
  const pnlClass = trade.netPnl > 0 ? 'positive' : trade.netPnl < 0 ? 'negative' : '';
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-hero">
      <div><div class="detail-symbol"><strong>${escapeHtml(trade.symbol)}</strong><span class="side ${trade.side.toLowerCase()}">${escapeHtml(trade.side)}</span><span class="status-pill ${trade.status.toLowerCase()}">${escapeHtml(trade.status)}</span></div><p class="hero-note">${escapeHtml(trade.market)} · ${escapeHtml(trade.setup)}</p></div>
      <div class="detail-pnl"><span class="section-label">NET P&amp;L</span><strong class="${pnlClass}">${money(trade.netPnl)}</strong></div>
    </div>
    <section class="detail-section"><h3>POSITION</h3><div class="detail-grid">
      ${detailField('Average entry', money(trade.avgEntry))}
      ${detailField('Entry quantity', trade.entryQty)}
      ${detailField('Remaining', trade.remainingQty)}
      ${detailField('Current price', trade.currentPrice ? money(trade.currentPrice) : '—')}
      ${detailField('Multiplier', trade.multiplier || 1)}
      ${detailField('Fees', money(trade.fees))}
    </div></section>
    <section class="detail-section"><h3>RISK</h3><div class="detail-grid">
      ${detailField('Stop loss', trade.stopLoss ? money(trade.stopLoss) : '—')}
      ${detailField('Target', trade.target ? money(trade.target) : '—')}
      ${detailField('Risk amount', money(trade.risk))}
      ${detailField('Planned R:R', trade.rr ? `${trade.rr.toFixed(2)} R` : '—')}
      ${detailField('Realised gross', money(trade.realisedGross), trade.realisedGross > 0 ? 'positive' : trade.realisedGross < 0 ? 'negative' : '')}
      ${detailField('Open P&L', money(trade.unrealised), trade.unrealised > 0 ? 'positive' : trade.unrealised < 0 ? 'negative' : '')}
    </div></section>
    <section class="detail-section"><h3>ENTRIES</h3>${detailRows(trade.entries, 'Entries')}</section>
    <section class="detail-section"><h3>EXITS</h3>${detailRows(trade.exits, 'Exits')}</section>
    <section class="detail-section"><h3>MINDSET</h3><div class="detail-grid">
      ${detailField('Mood', escapeHtml(trade.mood || '—'))}
      ${detailField('Confidence', `${trade.confidence || 0}/10`)}
      ${detailField('Followed rules', escapeHtml(trade.followedRules || '—'))}
    </div></section>
    <section class="detail-section"><h3>TAGS</h3><div class="detail-tags">${trade.tags?.length ? trade.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('') : '<span class="hero-note">No tags</span>'}</div></section>
    <section class="detail-section"><h3>MISTAKES</h3><p class="detail-copy">${escapeHtml(trade.mistakes || 'No mistakes recorded.')}</p></section>
    <section class="detail-section"><h3>NOTES</h3><p class="detail-copy">${escapeHtml(trade.notes || 'No notes recorded.')}</p></section>
  `;
  document.getElementById('trade-drawer').hidden = false;
  document.body.style.overflow = 'hidden';
}

function openCalendarDay(day) {
  const trades = state.trades.filter(trade => (trade.closedAt || trade.openedAt)?.slice(0, 10) === day);
  const total = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const pnlClass = total > 0 ? 'positive' : total < 0 ? 'negative' : '';
  openDetailId = null;
  document.getElementById('detail-edit').hidden = true;
  document.getElementById('detail-title').textContent = istDate(`${day}T12:00`);
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-hero"><div><p class="section-label">DAY REVIEW</p><div class="detail-symbol"><strong>${trades.length} trade${trades.length === 1 ? '' : 's'}</strong></div></div><div class="detail-pnl"><span class="section-label">NET P&amp;L</span><strong class="${pnlClass}">${money(total)}</strong></div></div>
    <section class="detail-section"><h3>TRADES</h3>${trades.length ? `<div class="day-trades">${trades.map(trade => `
      <button type="button" class="day-trade" data-day-trade="${trade.id}"><span><strong>${escapeHtml(trade.symbol)}</strong><small>${escapeHtml(trade.market)} · ${escapeHtml(trade.setup)}</small></span><b class="${trade.netPnl > 0 ? 'positive' : trade.netPnl < 0 ? 'negative' : ''}">${money(trade.netPnl)}</b><i class="fa-solid fa-chevron-right"></i></button>
    `).join('')}</div>` : '<div class="report-empty">No trades on this day.</div>'}</section>`;
  document.getElementById('trade-drawer').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeTradeDetails() {
  document.getElementById('trade-drawer').hidden = true;
  document.body.style.overflow = '';
  openDetailId = null;
}

function journalEntry() {
  const date = document.getElementById('journal-date').value;
  state.journal[date] ||= { premarket: '', plan: '', review: '', lessons: '', updatedAt: null };
  return state.journal[date];
}

function loadJournal() {
  const dateInput = document.getElementById('journal-date');
  if (!dateInput.value) dateInput.value = istDateKey();
  const entry = state.journal[dateInput.value] || {};
  document.getElementById('journal-text').value = entry[currentJournalSection] || '';
  document.getElementById('journal-text').placeholder = journalPlaceholders[currentJournalSection];
  document.getElementById('journal-heading').textContent = istDate(`${dateInput.value}T12:00`);
  document.getElementById('journal-status').textContent = entry.updatedAt ? `Saved ${istDate(entry.updatedAt, true)}` : 'Not saved yet';
  renderJournalList();
}

function saveJournal(notify = true) {
  clearTimeout(journalSaveTimer);
  const date = document.getElementById('journal-date').value;
  const entry = journalEntry();
  entry[currentJournalSection] = document.getElementById('journal-text').value;
  entry.updatedAt = new Date().toISOString();
  const hasText = ['premarket', 'plan', 'review', 'lessons'].some(key => entry[key]?.trim());
  if (!hasText) delete state.journal[date];
  persist();
  document.getElementById('journal-status').textContent = hasText ? 'Saved now' : 'Empty note removed';
  renderJournalList();
  if (notify) showToast('Journal saved.');
}

function renderJournalList() {
  const current = document.getElementById('journal-date').value;
  const dates = Object.keys(state.journal).sort().reverse().slice(0, 40);
  const list = document.getElementById('journal-list');
  if (!dates.length) {
    list.innerHTML = '<div class="journal-empty">No journal days yet.</div>';
    return;
  }
  list.innerHTML = dates.map(date => {
    const entry = state.journal[date];
    const text = [entry.premarket, entry.plan, entry.review, entry.lessons].find(value => value?.trim()) || '';
    return `<button class="journal-day ${date === current ? 'active' : ''}" data-journal-date="${date}">
      <strong>${istDate(`${date}T12:00`)}</strong><small>${escapeHtml(text.slice(0, 65)) || 'Journal note'}</small>
    </button>`;
  }).join('');
}

function chartColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue('--muted').trim(), line: css.getPropertyValue('--line').trim(),
    gold: css.getPropertyValue('--gold-bright').trim(), green: css.getPropertyValue('--green').trim(),
    red: css.getPropertyValue('--red').trim(), surface2: css.getPropertyValue('--surface-2').trim()
  };
}

function baseChartOptions() {
  const colors = chartColors();
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { labels: { color: colors.text, usePointStyle: true, boxWidth: 7, font: { family: 'DM Sans', size: 11 } } }, tooltip: { padding: 11 } },
    scales: {
      x: { ticks: { color: colors.text, font: { family: 'Roboto Mono', size: 10 } }, grid: { display: false } },
      y: { ticks: { color: colors.text, callback: value => money(value), font: { family: 'Roboto Mono', size: 10 } }, grid: { color: colors.line } }
    }
  };
}

function replaceChart(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function equitySeries() {
  let total = 0;
  return [...closedTrades()].sort((a, b) => (a.closedAt || '').localeCompare(b.closedAt || '')).map(trade => {
    total += trade.netPnl;
    return { label: istDate(trade.closedAt || trade.openedAt), value: total, pnl: trade.netPnl };
  });
}

function showChartEmpty(canvasId, emptyId, empty) {
  document.getElementById(canvasId).style.visibility = empty ? 'hidden' : 'visible';
  document.getElementById(emptyId).classList.toggle('show', empty);
}

function renderEquityChart(canvasId, emptyId, includeDrawdown = false) {
  const series = equitySeries();
  showChartEmpty(canvasId, emptyId, !series.length);
  const colors = chartColors();
  let peak = 0;
  const drawdowns = series.map(point => {
    peak = Math.max(peak, point.value);
    return point.value - peak;
  });
  const datasets = [{
    label: 'Net P&L', data: series.map(point => point.value), borderColor: colors.gold,
    backgroundColor: `${colors.gold}18`, fill: true, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, tension: .3
  }];
  if (includeDrawdown) datasets.push({
    label: 'Drawdown', data: drawdowns, borderColor: colors.red,
    backgroundColor: `${colors.red}12`, fill: true, borderWidth: 1.5, pointRadius: 1, tension: .25
  });
  replaceChart(canvasId, {
    type: 'line',
    data: { labels: series.map(point => point.label), datasets },
    options: baseChartOptions()
  });
}

function renderHeatmap() {
  const totals = {};
  closedTrades().forEach(trade => {
    const day = (trade.closedAt || trade.openedAt).slice(0, 10);
    if (day.startsWith(`${heatmapYear}-`)) totals[day] = (totals[day] || 0) + trade.netPnl;
  });
  const max = Math.max(0, ...Object.values(totals).map(Math.abs));
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = istDateKey();
  const months = Array.from({ length: 12 }, (_, month) => {
    const monthName = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(heatmapYear, month, 1)));
    const firstOffset = (new Date(Date.UTC(heatmapYear, month, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(heatmapYear, month + 1, 0)).getUTCDate();
    const blanks = '<span></span>'.repeat(firstOffset);
    const cells = Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const key = `${heatmapYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const pnl = totals[key] || 0;
      const level = pnl && max ? Math.max(1, Math.ceil(Math.abs(pnl) / max * 4)) : 0;
      const kind = pnl > 0 ? 'gain' : pnl < 0 ? 'loss' : '';
      const title = pnl ? `${istDate(`${key}T12:00`)} · ${money(pnl)}` : istDate(`${key}T12:00`);
      return `<button type="button" class="heatmap-day ${kind} ${level ? `l${level}` : ''} ${key === today ? 'today' : ''}" data-calendar-day="${key}" title="${title}">${day}</button>`;
    }).join('');
    return `<section class="heatmap-month"><h3>${monthName}</h3><div class="month-grid">${dayNames.map(name => `<span class="month-day-name">${name}</span>`).join('')}${blanks}${cells}</div></section>`;
  }).join('');
  document.getElementById('heatmap-year').textContent = heatmapYear;
  document.getElementById('calendar-heatmap').innerHTML = months;
}

function renderSetupScorecards() {
  const setupMap = {};
  closedTrades().forEach(trade => {
    const name = trade.setup || 'No setup';
    const group = setupMap[name] ||= { trades: 0, wins: 0, pnl: 0, ruleScore: 0, results: [] };
    group.trades += 1;
    group.wins += trade.netPnl > 0 ? 1 : 0;
    group.pnl += trade.netPnl;
    group.ruleScore += trade.followedRules === 'Yes' ? 1 : trade.followedRules === 'Partly' ? .5 : 0;
    group.results.push(trade.netPnl);
  });
  const setups = Object.entries(setupMap).map(([name, data]) => {
    const mean = data.pnl / data.trades;
    const averageSize = data.results.reduce((sum, value) => sum + Math.abs(value), 0) / data.trades;
    const variance = data.results.reduce((sum, value) => sum + (value - mean) ** 2, 0) / data.trades;
    const consistency = data.trades > 1 && averageSize ? 100 / (1 + Math.sqrt(variance) / averageSize) : null;
    return [name, { ...data, consistency }];
  }).sort((a, b) => b[1].pnl - a[1].pnl || (b[1].consistency || 0) - (a[1].consistency || 0));
  const container = document.getElementById('setup-scorecards');
  if (!setups.length) {
    container.innerHTML = '<div class="setup-empty">Closed trades will rank your best setups.</div>';
    return;
  }
  container.innerHTML = setups.map(([name, data], index) => {
    const winRate = data.wins / data.trades * 100;
    const compliance = data.ruleScore / data.trades * 100;
    const pnlClass = data.pnl > 0 ? 'positive' : data.pnl < 0 ? 'negative' : '';
    return `<article class="setup-card">
      <div class="setup-card-head"><div class="setup-title"><span class="setup-rank">#${index + 1}</span><h3>${escapeHtml(name)}</h3></div><strong class="setup-pnl ${pnlClass}">${money(data.pnl)}</strong></div>
      <div class="setup-card-stats four-stats">
        <div class="setup-stat"><span>Trades</span><strong>${data.trades}</strong></div>
        <div class="setup-stat"><span>Win rate</span><strong>${winRate.toFixed(0)}%</strong></div>
        <div class="setup-stat"><span>Rules</span><strong>${compliance.toFixed(0)}%</strong></div>
        <div class="setup-stat"><span>Steady</span><strong>${data.consistency === null ? '—' : `${data.consistency.toFixed(0)}%`}</strong></div>
      </div>
      <div class="setup-meter" title="Rule-following score"><i style="width:${compliance.toFixed(0)}%"></i></div>
    </article>`;
  }).join('');
}

function mistakeItems(trade) {
  return (trade.mistakes || '').split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
}

function renderMistakeReport() {
  const groups = {};
  closedTrades().forEach(trade => mistakeItems(trade).forEach(label => {
    const key = label.toLowerCase();
    const item = groups[key] ||= { label, count: 0, cost: 0 };
    item.count += 1;
    item.cost += trade.netPnl < 0 ? Math.abs(trade.netPnl) : 0;
  }));
  const items = Object.values(groups).sort((a, b) => b.count - a.count || b.cost - a.cost).slice(0, 10);
  const container = document.getElementById('mistake-report');
  if (!items.length) {
    container.innerHTML = '<div class="report-empty">Add mistakes to closed trades to find patterns.</div>';
    return;
  }
  container.innerHTML = `<div class="report-table"><table><thead><tr><th>Mistake</th><th>Times</th><th>Total cost</th></tr></thead><tbody>${items.map(item => `
    <tr><td>${escapeHtml(item.label)}${item.count > 1 ? '<span class="repeat-badge">REPEATED</span>' : ''}</td><td class="money">${item.count}</td><td class="money negative">${money(-item.cost)}</td></tr>
  `).join('')}</tbody></table></div>`;
}

function renderMoodReport() {
  const groups = {};
  closedTrades().forEach(trade => {
    const mood = trade.mood || 'Not recorded';
    const item = groups[mood] ||= { trades: 0, wins: 0, pnl: 0, confidence: 0 };
    item.trades += 1;
    item.wins += trade.netPnl > 0 ? 1 : 0;
    item.pnl += trade.netPnl;
    item.confidence += Number(trade.confidence) || 0;
  });
  const moods = Object.entries(groups).sort((a, b) => b[1].pnl - a[1].pnl);
  const container = document.getElementById('mood-report');
  if (!moods.length) {
    container.innerHTML = '<div class="report-empty">Closed trades will show mood results here.</div>';
    return;
  }
  container.innerHTML = `<div class="mood-grid">${moods.map(([mood, data]) => {
    const pnlClass = data.pnl > 0 ? 'positive' : data.pnl < 0 ? 'negative' : '';
    return `<article class="mood-card"><h3>${escapeHtml(mood)}</h3><strong class="${pnlClass}">${money(data.pnl)}</strong><div class="mood-stats"><span>Win <b>${(data.wins / data.trades * 100).toFixed(0)}%</b></span><span>Trust <b>${(data.confidence / data.trades).toFixed(1)}</b></span><span>Trades <b>${data.trades}</b></span></div></article>`;
  }).join('')}</div>`;
}

function renderRuleReport() {
  const closed = closedTrades();
  const groups = { Yes: { count: 0, pnl: 0 }, Partly: { count: 0, pnl: 0 }, No: { count: 0, pnl: 0 } };
  closed.forEach(trade => {
    const key = groups[trade.followedRules] ? trade.followedRules : 'No';
    groups[key].count += 1;
    groups[key].pnl += trade.netPnl;
  });
  const weighted = groups.Yes.count + groups.Partly.count * .5;
  const score = closed.length ? weighted / closed.length * 100 : 0;
  const container = document.getElementById('rule-report');
  if (!closed.length) {
    container.innerHTML = '<div class="report-empty">Closed trades will create your rule score.</div>';
    return;
  }
  container.innerHTML = `<div class="rule-score-ring" style="--score:${score.toFixed(0)}%"><strong>${score.toFixed(0)}%</strong></div><div class="rule-breakdown">
    ${Object.entries(groups).map(([label, data]) => `<div class="rule-row"><span>${label} · ${data.count}</span><strong class="${data.pnl > 0 ? 'positive' : data.pnl < 0 ? 'negative' : ''}">${money(data.pnl)}</strong></div>`).join('')}
  </div>`;
}

function currentWeekBounds() {
  const today = istDateKey();
  const noon = new Date(`${today}T12:00:00+05:30`);
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: IST_ZONE, weekday: 'short' }).format(noon);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
  noon.setUTCDate(noon.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IST_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(noon);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return [`${map.year}-${map.month}-${map.day}`, today];
}

function renderWeeklyReview() {
  const [from, to] = currentWeekBounds();
  const trades = closedTrades().filter(trade => {
    const day = (trade.closedAt || trade.openedAt).slice(0, 10);
    return day >= from && day <= to;
  });
  const wins = trades.filter(trade => trade.netPnl > 0);
  const losses = trades.filter(trade => trade.netPnl < 0);
  const pnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const mistakes = {};
  trades.forEach(trade => mistakeItems(trade).forEach(label => mistakes[label.toLowerCase()] = (mistakes[label.toLowerCase()] || 0) + 1));
  const topMistakes = Object.entries(mistakes).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const lessons = Object.entries(state.journal)
    .filter(([date, entry]) => date >= from && date <= to && entry.lessons?.trim())
    .map(([date, entry]) => `${istDate(`${date}T12:00`)}: ${entry.lessons.trim()}`);
  document.getElementById('weekly-range').textContent = `${istDate(`${from}T12:00`)} – ${istDate(`${to}T12:00`)}`;
  document.getElementById('weekly-review').innerHTML = `
    <div class="weekly-summary">
      <div class="weekly-stat"><span>Net P&amp;L</span><strong class="${pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : ''}">${money(pnl)}</strong></div>
      <div class="weekly-stat"><span>Closed trades</span><strong>${trades.length}</strong></div>
      <div class="weekly-stat"><span>Wins</span><strong class="positive">${wins.length}</strong></div>
      <div class="weekly-stat"><span>Losses</span><strong class="negative">${losses.length}</strong></div>
    </div>
    <div class="weekly-columns">
      <section class="weekly-block"><h3>TOP MISTAKES</h3>${topMistakes.length ? `<ul>${topMistakes.map(([label, count]) => `<li>${escapeHtml(label)} · ${count} time${count === 1 ? '' : 's'}</li>`).join('')}</ul>` : '<p class="hero-note">No mistakes recorded this week.</p>'}</section>
      <section class="weekly-block"><h3>LESSONS</h3>${lessons.length ? `<ul>${lessons.map(lesson => `<li>${escapeHtml(lesson)}</li>`).join('')}</ul>` : '<p class="hero-note">No journal lessons this week.</p>'}</section>
    </div>`;
}

function renderTimeReport() {
  const buckets = {
    'Morning · 05–12': { pnl: 0, trades: 0 },
    'Afternoon · 12–17': { pnl: 0, trades: 0 },
    'Evening · 17–23': { pnl: 0, trades: 0 },
    'Overnight · 23–05': { pnl: 0, trades: 0 }
  };
  closedTrades().forEach(trade => {
    const hour = Number(trade.openedAt?.slice(11, 13));
    const name = hour >= 5 && hour < 12 ? 'Morning · 05–12'
      : hour >= 12 && hour < 17 ? 'Afternoon · 12–17'
      : hour >= 17 && hour < 23 ? 'Evening · 17–23'
      : 'Overnight · 23–05';
    buckets[name].pnl += trade.netPnl;
    buckets[name].trades += 1;
  });
  const entries = Object.entries(buckets);
  const hasData = entries.some(([, data]) => data.trades);
  showChartEmpty('time-chart', 'time-empty', !hasData);
  const colors = chartColors();
  replaceChart('time-chart', {
    type: 'bar',
    data: { labels: entries.map(([name]) => name.split(' · ')[0]), datasets: [{ label: 'Net P&L', data: entries.map(([, data]) => data.pnl), backgroundColor: entries.map(([, data]) => data.pnl >= 0 ? colors.gold : colors.red), borderRadius: 6 }] },
    options: baseChartOptions()
  });
}

function renderTagReport() {
  const groups = {};
  state.trades.forEach(trade => (trade.tags || []).forEach(label => {
    const key = label.toLowerCase();
    const group = groups[key] ||= { label, trades: 0, closed: 0, wins: 0, pnl: 0 };
    group.trades += 1;
    group.pnl += trade.netPnl;
    if (trade.status === 'Closed') {
      group.closed += 1;
      group.wins += trade.netPnl > 0 ? 1 : 0;
    }
  }));
  const tags = Object.values(groups).sort((a, b) => b.pnl - a.pnl).slice(0, 12);
  const container = document.getElementById('tag-report');
  if (!tags.length) {
    container.innerHTML = '<div class="report-empty">Add tags to compare their results.</div>';
    return;
  }
  container.innerHTML = `<div class="report-table"><table><thead><tr><th>Tag</th><th>Trades</th><th>Win rate</th><th>Net P&amp;L</th></tr></thead><tbody>${tags.map(tag => `
    <tr><td><span class="tag-pill">${escapeHtml(tag.label)}</span></td><td class="money">${tag.trades}</td><td class="money">${tag.closed ? `${(tag.wins / tag.closed * 100).toFixed(0)}%` : '—'}</td><td class="money ${tag.pnl > 0 ? 'positive' : tag.pnl < 0 ? 'negative' : ''}">${money(tag.pnl)}</td></tr>
  `).join('')}</tbody></table></div>`;
}

function renderMonthlyReport() {
  const month = document.getElementById('report-month').value || istDateKey().slice(0, 7);
  const trades = closedTrades().filter(trade => (trade.closedAt || trade.openedAt).startsWith(month));
  const wins = trades.filter(trade => trade.netPnl > 0);
  const losses = trades.filter(trade => trade.netPnl < 0);
  const pnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossWins = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const setupTotals = {};
  trades.forEach(trade => setupTotals[trade.setup] = (setupTotals[trade.setup] || 0) + trade.netPnl);
  const bestSetup = Object.entries(setupTotals).sort((a, b) => b[1] - a[1])[0];
  const mistakes = {};
  trades.forEach(trade => mistakeItems(trade).forEach(label => mistakes[label.toLowerCase()] = (mistakes[label.toLowerCase()] || 0) + 1));
  const topMistake = Object.entries(mistakes).sort((a, b) => b[1] - a[1])[0];
  const lessons = Object.entries(state.journal).filter(([date, entry]) => date.startsWith(month) && entry.lessons?.trim()).map(([, entry]) => entry.lessons.trim());
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const profitFactor = grossLosses ? (grossWins / grossLosses).toFixed(2) : grossWins ? '∞' : '—';
  document.getElementById('monthly-title').textContent = `${monthLabel} performance`;
  document.getElementById('monthly-report-body').innerHTML = `
    <div class="monthly-heading"><p>ZORO TRADE JOURNAL</p><h1>${monthLabel} performance report</h1><p>Printed ${istDate(new Date().toISOString(), true)}</p></div>
    <div class="monthly-summary">
      <div class="monthly-stat"><span>Net P&amp;L</span><strong class="${pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : ''}">${money(pnl)}</strong></div>
      <div class="monthly-stat"><span>Closed trades</span><strong>${trades.length}</strong></div>
      <div class="monthly-stat"><span>Win rate</span><strong>${trades.length ? `${(wins.length / trades.length * 100).toFixed(1)}%` : '—'}</strong></div>
      <div class="monthly-stat"><span>Profit factor</span><strong>${profitFactor}</strong></div>
      <div class="monthly-stat"><span>Average trade</span><strong>${money(trades.length ? pnl / trades.length : 0)}</strong></div>
    </div>
    <div class="monthly-notes">
      <section class="monthly-note"><h3>BEST SETUP</h3><p>${bestSetup ? `${escapeHtml(bestSetup[0])} · ${money(bestSetup[1])}` : 'No closed trades this month.'}</p></section>
      <section class="monthly-note"><h3>TOP MISTAKE</h3><p>${topMistake ? `${escapeHtml(topMistake[0])} · ${topMistake[1]} time${topMistake[1] === 1 ? '' : 's'}` : 'No mistakes recorded.'}</p></section>
      <section class="monthly-note"><h3>WINS AND LOSSES</h3><p>${wins.length} wins · ${losses.length} losses · ${trades.length - wins.length - losses.length} flat</p></section>
      <section class="monthly-note"><h3>JOURNAL LESSONS</h3><p>${lessons.length ? escapeHtml(lessons.join(' · ')) : 'No lessons recorded this month.'}</p></section>
    </div>`;
}

function printMonthlyReport() {
  renderMonthlyReport();
  document.body.classList.add('print-monthly');
  window.addEventListener('afterprint', () => document.body.classList.remove('print-monthly'), { once: true });
  window.print();
}

function renderAnalytics() {
  const data = metrics();
  const results = data.closed.map(trade => trade.netPnl);
  const expectancy = results.length ? results.reduce((a, b) => a + b, 0) / results.length : 0;
  let peak = 0, running = 0, maxDrawdown = 0;
  equitySeries().forEach(point => { running = point.value; peak = Math.max(peak, running); maxDrawdown = Math.min(maxDrawdown, running - peak); });
  const best = results.length ? Math.max(...results) : 0;
  const worst = results.length ? Math.min(...results) : 0;
  const fields = [['analytics-expectancy', expectancy], ['analytics-drawdown', maxDrawdown], ['analytics-best', best], ['analytics-worst', worst]];
  fields.forEach(([id, value]) => { const el = document.getElementById(id); el.textContent = money(value); tone(el, value); });

  renderEquityChart('analytics-equity-chart', 'analytics-equity-empty', true);
  const colors = chartColors();
  showChartEmpty('result-chart', 'result-empty', !data.closed.length);
  replaceChart('result-chart', {
    type: 'doughnut',
    data: { labels: ['Wins', 'Losses', 'Flat'], datasets: [{ data: [data.wins.length, data.losses.length, data.closed.length - data.wins.length - data.losses.length], backgroundColor: [colors.green, colors.red, colors.surface2], borderWidth: 0, hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: baseChartOptions().plugins }
  });

  const marketMap = {};
  data.closed.forEach(trade => marketMap[trade.market] = (marketMap[trade.market] || 0) + trade.netPnl);
  const markets = Object.keys(marketMap);
  showChartEmpty('market-chart', 'market-empty', !markets.length);
  replaceChart('market-chart', {
    type: 'bar',
    data: { labels: markets, datasets: [{ label: 'Net P&L', data: markets.map(name => marketMap[name]), backgroundColor: markets.map(name => marketMap[name] >= 0 ? colors.green : colors.red), borderRadius: 6 }] },
    options: baseChartOptions()
  });

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayMap = Object.fromEntries(weekdayNames.map(name => [name, 0]));
  data.closed.forEach(trade => {
    const date = new Date(`${trade.openedAt}:00+05:30`);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: IST_ZONE, weekday: 'short' }).format(date);
    weekdayMap[weekday] += trade.netPnl;
  });
  showChartEmpty('weekday-chart', 'weekday-empty', !data.closed.length);
  replaceChart('weekday-chart', {
    type: 'bar',
    data: { labels: weekdayNames, datasets: [{ label: 'Net P&L', data: weekdayNames.map(name => weekdayMap[name]), backgroundColor: weekdayNames.map(name => weekdayMap[name] >= 0 ? colors.gold : colors.red), borderRadius: 6 }] },
    options: baseChartOptions()
  });
  renderHeatmap();
  renderSetupScorecards();
  renderTimeReport();
  renderTagReport();
  renderMonthlyReport();
  renderMistakeReport();
  renderMoodReport();
  renderRuleReport();
  renderWeeklyReview();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `zoro-backup-${istDateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported.');
}

async function importData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.trades) || typeof data.journal !== 'object') throw new Error('This is not a Zoro backup.');
    if (!confirm('Import this backup? Current data will be replaced.')) return;
    const fresh = blankState();
    state = { ...fresh, ...data, version: 2, limits: { ...fresh.limits, ...(data.limits || {}) } };
    persist();
    renderDashboard();
    renderHistory();
    loadJournal();
    resetPlaybookForm();
    renderPlaybook();
    if (document.getElementById('analytics').classList.contains('active')) renderAnalytics();
    showToast('Backup imported.');
  } catch (error) {
    showToast(error.message || 'Import failed.', true);
  } finally {
    document.getElementById('import-file').value = '';
  }
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.page === 'trade') resetTradeForm();
    switchPage(button.dataset.page);
  }));
  document.getElementById('trade-form').addEventListener('submit', saveTrade);
  document.getElementById('reset-form').addEventListener('click', resetTradeForm);
  document.getElementById('add-entry').addEventListener('click', () => addTradeRow('entry'));
  document.getElementById('add-exit').addEventListener('click', () => addTradeRow('exit'));
  document.getElementById('confidence').addEventListener('input', event => document.getElementById('confidence-value').textContent = event.target.value);
  document.getElementById('tags').addEventListener('input', syncQuickTags);
  document.querySelectorAll('[data-quick-tag]').forEach(button => button.addEventListener('click', () => toggleQuickTag(button.dataset.quickTag)));
  ['status', 'side', 'multiplier', 'current-price', 'stop-loss', 'target', 'fees'].forEach(id => document.getElementById(id).addEventListener('input', updateLiveCalculation));

  document.getElementById('limits-form').addEventListener('submit', saveLimits);
  document.getElementById('playbook-form').addEventListener('submit', savePlaybook);
  document.getElementById('clear-playbook').addEventListener('click', resetPlaybookForm);
  document.getElementById('playbook-list').addEventListener('click', event => {
    const edit = event.target.closest('[data-playbook-edit]');
    const remove = event.target.closest('[data-playbook-delete]');
    if (edit) editPlaybook(edit.dataset.playbookEdit);
    if (remove) deletePlaybook(remove.dataset.playbookDelete);
  });

  ['history-search', 'history-market', 'history-status', 'history-result'].forEach(id => {
    document.getElementById(id).addEventListener(id === 'history-search' ? 'input' : 'change', renderHistory);
  });
  document.querySelectorAll('[data-date-range]').forEach(button => button.addEventListener('click', () => setDateFilter(button.dataset.dateRange)));
  ['history-date-from', 'history-date-to'].forEach(id => document.getElementById(id).addEventListener('change', () => {
    dateFilter.from = document.getElementById('history-date-from').value;
    dateFilter.to = document.getElementById('history-date-to').value;
    dateFilter.mode = 'custom';
    renderHistory();
  }));
  document.querySelectorAll('#history-table th[data-sort]').forEach(header => header.addEventListener('click', () => {
    const key = header.dataset.sort;
    sortState = sortState.key === key
      ? { key, direction: sortState.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' };
    renderHistory();
  }));
  document.getElementById('history-body').addEventListener('click', event => {
    const view = event.target.closest('[data-view]');
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');
    if (view) openTradeDetails(view.dataset.view);
    if (edit) editTrade(edit.dataset.edit);
    if (remove) deleteTrade(remove.dataset.delete);
  });
  document.getElementById('detail-close').addEventListener('click', closeTradeDetails);
  document.getElementById('detail-edit').addEventListener('click', () => {
    const id = openDetailId;
    closeTradeDetails();
    if (id) editTrade(id);
  });
  document.getElementById('trade-drawer').addEventListener('click', event => {
    if (event.target.id === 'trade-drawer') closeTradeDetails();
  });
  document.getElementById('detail-body').addEventListener('click', event => {
    const trade = event.target.closest('[data-day-trade]');
    if (trade) openTradeDetails(trade.dataset.dayTrade);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('trade-drawer').hidden) closeTradeDetails();
  });

  document.getElementById('journal-date').addEventListener('change', loadJournal);
  document.querySelectorAll('.journal-tab').forEach(tab => tab.addEventListener('click', () => {
    saveJournal(false);
    currentJournalSection = tab.dataset.section;
    document.querySelectorAll('.journal-tab').forEach(item => item.classList.toggle('active', item === tab));
    loadJournal();
  }));
  document.getElementById('journal-text').addEventListener('input', () => {
    document.getElementById('journal-status').textContent = 'Saving…';
    clearTimeout(journalSaveTimer);
    journalSaveTimer = setTimeout(() => saveJournal(false), 700);
  });
  document.getElementById('save-journal').addEventListener('click', () => saveJournal(true));
  document.getElementById('journal-list').addEventListener('click', event => {
    const day = event.target.closest('[data-journal-date]');
    if (!day) return;
    document.getElementById('journal-date').value = day.dataset.journalDate;
    loadJournal();
  });

  document.getElementById('heatmap-prev').addEventListener('click', () => { heatmapYear -= 1; renderHeatmap(); });
  document.getElementById('heatmap-next').addEventListener('click', () => { heatmapYear += 1; renderHeatmap(); });
  document.getElementById('calendar-heatmap').addEventListener('click', event => {
    const day = event.target.closest('[data-calendar-day]');
    if (day) openCalendarDay(day.dataset.calendarDay);
  });
  document.getElementById('report-month').addEventListener('change', renderMonthlyReport);
  document.getElementById('print-report').addEventListener('click', printMonthlyReport);

  document.getElementById('export-button').addEventListener('click', exportData);
  document.getElementById('import-button').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', event => importData(event.target.files[0]));

  const theme = matchMedia('(prefers-color-scheme: dark)');
  theme.addEventListener('change', () => {
    if (document.getElementById('dashboard').classList.contains('active')) renderDashboard();
    if (document.getElementById('analytics').classList.contains('active')) renderAnalytics();
  });
}

function init() {
  document.getElementById('journal-date').value = istDateKey();
  document.getElementById('report-month').value = istDateKey().slice(0, 7);
  bindEvents();
  resetTradeForm();
  resetPlaybookForm();
  renderPlaybook();
  updateClock();
  setInterval(updateClock, 1000);
  renderDashboard();
}

init();
