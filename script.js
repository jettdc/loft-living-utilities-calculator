// ============================================================
// CONFIGURATION — edit this to customize behavior
// ============================================================
const CONFIG = {
  containerSelector: '.accountHistoryMobileView',
  skipFirstN: 2,
  roommates: ['Me', 'Roommate 1'],

  exclusionRules: [
    {
      label: 'rent',
      match: (desc, amount) => /rent|recurring/i.test(desc),
    },
    {
      label: 'parking',
      match: (desc, amount) => /\b(307|180)\b/.test(desc),
    },
    {
      label: 'payment',
      match: (desc, amount) => amount < 0,
    },
  ],
};


// ============================================================
// PARSING
// ============================================================
function getEntries() {
  const container = document.querySelector(CONFIG.containerSelector);
  if (!container) throw new Error(`Container not found: ${CONFIG.containerSelector}`);
  return [...container.querySelectorAll('.statement-list')].slice(CONFIG.skipFirstN);
}

function parseAmount(text) {
  const isNegative = text.includes('(');
  const value = parseFloat(text.replace(/[^0-9.]/g, ''));
  return isNegative ? -value : value;
}

function parseEntry(el) {
  const dateText = el.querySelector('[data-testid="Date"]')?.textContent.trim();
  const desc     = el.querySelector('[data-testid="Description"]')?.textContent.trim();
  const actText  = el.querySelector('[data-testid="Activity"]')?.textContent.trim();

  if (!dateText || !desc || !actText) return null;

  const amount = parseAmount(actText);
  const [month, , year] = dateText.split('/');
  const monthKey = `${year}-${month.padStart(2, '0')}`;
  const monthLabel = new Date(dateText).toLocaleString('default', { month: 'long', year: 'numeric' });

  return { dateText, desc, amount, monthKey, monthLabel };
}


// ============================================================
// EXCLUSION
// ============================================================
function getExclusionLabel(desc, amount) {
  for (const rule of CONFIG.exclusionRules) {
    if (rule.match(desc, amount)) return rule.label;
  }
  return null;
}


// ============================================================
// SPLITTING
// ============================================================
function splitTotal(total) {
  const n = CONFIG.roommates.length;
  const share = Math.floor((total / n) * 100) / 100;
  const remainder = parseFloat((total - share * n).toFixed(2));

  return CONFIG.roommates.map((name, i) => ({
    name,
    share: i === 0 ? parseFloat((share + remainder).toFixed(2)) : share,
  }));
}


// ============================================================
// GROUPING
// ============================================================
function groupByMonth(entries) {
  const months = {};

  for (const el of entries) {
    const entry = parseEntry(el);
    if (!entry) continue;

    const { desc, amount, monthKey, monthLabel } = entry;
    const excludeLabel = getExclusionLabel(desc, amount);

    if (!months[monthKey]) {
      months[monthKey] = { label: monthLabel, items: [], total: 0 };
    }

    months[monthKey].items.push({ desc, amount, excludeLabel });

    if (!excludeLabel) {
      months[monthKey].total += amount;
    }
  }

  for (const m of Object.values(months)) {
    m.total = parseFloat(m.total.toFixed(2));
  }

  return months;
}


// ============================================================
// OUTPUT
// ============================================================
function formatRow(desc, amount, tag) {
  const tagStr = tag ? `  [${tag}]` : '';
  return `  ${desc.padEnd(50)} $${amount.toFixed(2)}${tagStr}`;
}

function printMonth(monthKey, { label, items, total }) {
  console.group(`📅 ${label}`);
  for (const { desc, amount, excludeLabel } of items) {
    console.log(formatRow(desc, amount, excludeLabel ? `excluded - ${excludeLabel}` : null));
  }
  console.log('');
  console.log(`${'TOTAL'.padEnd(52)} $${total.toFixed(2)}`);
  console.groupEnd();
}

function printSummaryTable(months) {
  const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));

  const rows = sorted.map(([, { label, total }]) => {
    const splits = splitTotal(total);
    const row = { Month: label, Total: `$${total.toFixed(2)}` };
    for (const { name, share } of splits) {
      row[name] = `$${share.toFixed(2)}`;
    }
    return row;
  });

  console.log('\n📊 Summary');
  console.table(rows);
}

function printResults(months) {
  const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));

  if (sorted.length === 0) {
    console.log('No entries found.');
    return;
  }

  for (const [key, data] of sorted) {
    printMonth(key, data);
  }

  printSummaryTable(months);
}


// ============================================================
// MAIN
// ============================================================
function run() {
  const entries = getEntries();
  const months  = groupByMonth(entries);
  printResults(months);
}

run();
