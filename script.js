// ============================================================
// CONFIGURATION — edit this to customize behavior
// ============================================================
const CONFIG = {
  // CSS selector for the container holding all entries
  containerSelector: '.accountHistoryMobileView',

  // Number of entries to skip at the top of the list
  skipFirstN: 2,

  // Names of people splitting shared utilities (including yourself)
  roommates: ['Me', 'Roommate 1'],

  // Entries matching these patterns will be shown but excluded from totals
  // Each rule has a label (shown in output) and a match(desc, amount) function
  exclusionRules: [
    {
      label: 'rent',
      match: (desc, amount) => /rent|recurring/i.test(desc),
    },
    {
      label: 'parking',
      match: (desc, amount) => /\b(307|180)\b/.test(desc) && amount === 175.00,
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
function splitAmount(amount) {
  const n = CONFIG.roommates.length;
  const share = Math.floor((amount / n) * 100) / 100;  // floor to cent
  const remainder = parseFloat((amount - share * n).toFixed(2));

  // First person (you) absorbs any rounding remainder
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
      months[monthKey] = {
        label: monthLabel,
        items: [],
        total: 0,
        splits: Object.fromEntries(CONFIG.roommates.map(n => [n, 0])),
      };
    }

    const splits = excludeLabel ? null : splitAmount(amount);

    months[monthKey].items.push({ desc, amount, excludeLabel, splits });

    if (!excludeLabel) {
      months[monthKey].total += amount;
      for (const { name, share } of splits) {
        months[monthKey].splits[name] = parseFloat(
          (months[monthKey].splits[name] + share).toFixed(2)
        );
      }
    }
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

function printMonth(monthKey, { label, items, total, splits }) {
  console.group(`📅 ${label}`);

  for (const { desc, amount, excludeLabel, splits: itemSplits } of items) {
    console.log(formatRow(desc, amount, excludeLabel ? `excluded - ${excludeLabel}` : null));
    if (itemSplits) {
      for (const { name, share } of itemSplits) {
        console.log(`    ↳ ${name.padEnd(20)} $${share.toFixed(2)}`);
      }
    }
  }

  console.log('');
  console.log(`${'TOTAL'.padEnd(52)} $${total.toFixed(2)}`);
  console.group('Split summary');
  for (const [name, share] of Object.entries(splits)) {
    console.log(`  ${name.padEnd(50)} $${share.toFixed(2)}`);
  }
  console.groupEnd();
  console.groupEnd();
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
