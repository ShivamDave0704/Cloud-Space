import fs from "fs";
import path from "path";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getCoinsLedgerPath(supportDir) {
  const coinsDir = path.join(supportDir, "coins");
  ensureDir(coinsDir);
  return path.join(coinsDir, "coins.json");
}

export function ensureCoinsLedgerFile(supportDir) {
  const ledgerPath = getCoinsLedgerPath(supportDir);
  if (!fs.existsSync(ledgerPath)) {
    fs.writeFileSync(ledgerPath, "[]", "utf8");
  }
  return ledgerPath;
}

export function syncCoinsLedgerFromWallets(supportDir, wallets) {
  const ledgerPath = ensureCoinsLedgerFile(supportDir);

  const rows = [];
  for (const wallet of Array.isArray(wallets) ? wallets : []) {
    const userUID = wallet?.userUID || null;
    const email = wallet?.email || null;
    const username = wallet?.username || null;
    const transactions = Array.isArray(wallet?.transactions)
      ? wallet.transactions
      : [];

    for (const tx of transactions) {
      rows.push({
        userUID,
        email,
        username,
        ...tx,
      });
    }
  }

  rows.sort((a, b) => {
    const at = new Date(a?.timestamp || a?.createdAt || 0).getTime() || 0;
    const bt = new Date(b?.timestamp || b?.createdAt || 0).getTime() || 0;
    return at - bt;
  });

  fs.writeFileSync(ledgerPath, JSON.stringify(rows, null, 2), "utf8");
  return ledgerPath;
}
