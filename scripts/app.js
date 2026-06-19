const TYPE_LABELS = {
  income: "Receita",
  expense: "Gasto",
  saving: "Economia"
};

const STATUS_LABELS = {
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída"
};

const VIEW_TITLES = {
  dashboard: "Dashboard financeiro",
  transactions: "Transações",
  income: "Receitas",
  expenses: "Gastos",
  goals: "Metas financeiras",
  reports: "Relatórios",
  profile: "Perfil",
  settings: "Configurações"
};

const RESERVE_CATEGORY = window.VelyxStore.RESERVE_CATEGORY;

const state = {
  user: null,
  month: getCurrentMonthKey(),
  allTransactions: [],
  transactions: [],
  goals: [],
  categories: [],
  report: null,
  activeView: "dashboard"
};

const toast = document.querySelector("[data-toast]");
const monthFilter = document.querySelector("[data-month-filter]");
const navButtons = document.querySelectorAll("[data-view-button]");
const views = document.querySelectorAll("[data-view]");
const viewTitle = document.querySelector("[data-view-title]");
const transactionForm = document.querySelector("[data-transaction-form]");
const transactionSubmit = document.querySelector("[data-transaction-submit]");
const cancelTransactionButton = document.querySelector("[data-cancel-transaction]");
const goalForm = document.querySelector("[data-goal-form]");
const goalSubmit = document.querySelector("[data-goal-submit]");
const cancelGoalButton = document.querySelector("[data-cancel-goal]");
const profileForm = document.querySelector("[data-profile-form]");
const categoryForm = document.querySelector("[data-category-form]");
const exportPeriodSelect = document.querySelector("[data-export-period]");
const monthlyExportAlert = document.querySelector("[data-monthly-export-alert]");

window.addEventListener("error", (event) => {
  showRuntimeError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  showRuntimeError(event.reason || event);
});

function roundMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(Math.abs(value) * 100) / 100;
  }

  const normalized = String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(Math.abs(parsed) * 100) / 100 : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) {
    return "Sem data";
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function formatMonthLabel(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  if (!toast) {
    console.warn(message);
    return;
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function showRuntimeError(error) {
  console.error(error);
  const message = error?.message || "Erro inesperado.";
  showToast(message.includes("localStorage") || message.includes("armazenamento")
    ? message
    : "Nao foi possivel concluir a acao. Recarregue a pagina e tente novamente.");
}

function getCurrentMonthKey(date = new Date()) {
  return monthKeyFromParts(date.getFullYear(), date.getMonth() + 1);
}

function monthKeyFromParts(year, month) {
  return `${Number(year)}-${String(Number(month)).padStart(2, "0")}`;
}

function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey || getCurrentMonthKey()).split("-").map(Number);
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month : new Date().getMonth() + 1
  };
}

function shiftMonth(monthKey, offset) {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1 + offset, 1);
  return getCurrentMonthKey(date);
}

function getPreviousMonthKey(monthKey) {
  return shiftMonth(monthKey, -1);
}

function transactionTimestamp(transaction) {
  const timestamp = Date.parse(`${transaction.date || ""}T00:00:00`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function transactionMonth(transaction) {
  return String(transaction.date || "").slice(0, 7);
}

function hasValidTransactionDate(transaction) {
  return Boolean(transaction.date && Number.isFinite(transactionTimestamp(transaction)));
}

function isAmountMatch(transaction, amount) {
  return Math.abs((Number(transaction.amount) || 0) - amount) < 0.005;
}

function sumAmounts(items) {
  return roundMoney(items.reduce((total, item) => total + (Number(item.amount) || 0), 0));
}

function getTransactions() {
  return window.VelyxStore.getTransactions().sort((a, b) => {
    return transactionTimestamp(b) - transactionTimestamp(a);
  });
}

function calculateGoalCurrentAmount(linkedCategory) {
  const category = String(linkedCategory || "").trim();
  if (!category) {
    return 0;
  }

  return sumAmounts(
    getTransactions().filter((transaction) => {
      return transaction.type === "saving" && transaction.category === category;
    })
  );
}

function enrichGoal(goal) {
  const targetAmount = Number(goal.targetAmount) || 0;
  const currentAmount = calculateGoalCurrentAmount(goal.linkedCategory);
  const progress = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

  return {
    ...goal,
    targetAmount,
    currentAmount,
    progress,
    status: targetAmount > 0 && currentAmount >= targetAmount ? "completed" : goal.status
  };
}

function getFinancialGoals() {
  return window.VelyxStore.getGoals().map(enrichGoal);
}

function getMonthlyTransactions(year, month) {
  const monthKey = monthKeyFromParts(year, month);
  return getTransactions().filter((transaction) => {
    return transactionMonth(transaction) === monthKey;
  });
}

function calculateMonthlySummary(year, month) {
  const monthKey = monthKeyFromParts(year, month);
  const monthlyTransactions = getMonthlyTransactions(year, month);
  const totalReceitas = sumAmounts(monthlyTransactions.filter((transaction) => transaction.type === "income"));
  const totalGastos = sumAmounts(monthlyTransactions.filter((transaction) => transaction.type === "expense"));
  const totalEconomias = sumAmounts(monthlyTransactions.filter((transaction) => transaction.type === "saving"));
  const saldoFinal = roundMoney(totalReceitas - totalGastos - totalEconomias);
  const reserveCurrent = calculateGoalCurrentAmount(RESERVE_CATEGORY);
  const reserveGoal = getFinancialGoals().find((goal) => goal.linkedCategory === RESERVE_CATEGORY);
  const reserveTarget = reserveGoal?.targetAmount || 0;
  const reserveProgress = reserveTarget > 0 ? Math.min(100, Math.round((reserveCurrent / reserveTarget) * 100)) : 0;

  return {
    month: monthKey,
    totalReceitas,
    totalGastos,
    totalEconomias,
    saldoFinal,
    emergencyReserveCurrent: reserveCurrent,
    emergencyReserveTarget: reserveTarget,
    emergencyReserveProgress: reserveProgress
  };
}

function calculateCategoryExpenses(transactions) {
  const totals = new Map();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const category = transaction.category || "Outros";
      totals.set(category, roundMoney((totals.get(category) || 0) + Number(transaction.amount || 0)));
    });

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function getMonthlySeries(baseMonthKey) {
  return Array.from({ length: 6 }, (_, index) => {
    const monthKey = shiftMonth(baseMonthKey, index - 5);
    const { year, month } = parseMonthKey(monthKey);
    const summary = calculateMonthlySummary(year, month);

    return {
      month: monthKey,
      income: summary.totalReceitas,
      expenses: summary.totalGastos,
      savings: summary.totalEconomias,
      balance: summary.saldoFinal
    };
  });
}

function buildMonthlyReport(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const transactions = getMonthlyTransactions(year, month);

  return {
    summary: calculateMonthlySummary(year, month),
    transactions,
    categoryExpenses: calculateCategoryExpenses(transactions),
    goals: getFinancialGoals(),
    monthlySeries: getMonthlySeries(monthKey)
  };
}

function syncState() {
  state.user = window.VelyxStore.getCurrentUser();
  if (!state.user) {
    window.location.replace("login.html");
    return;
  }

  state.categories = window.VelyxStore.getCategories();
  const { year, month } = parseMonthKey(state.month);
  state.allTransactions = getTransactions();
  state.transactions = state.allTransactions.filter((transaction) => transactionMonth(transaction) === monthKeyFromParts(year, month));
  state.goals = getFinancialGoals();
  state.report = buildMonthlyReport(state.month);
}

function renderUser() {
  document.querySelector("[data-user-name]").textContent = state.user?.name || "Conta";
  document.querySelector("[data-user-plan]").textContent = "Dados locais";
  if (profileForm && state.user) {
    profileForm.name.value = state.user.name || "";
    profileForm.email.value = state.user.email || "";
  }
}

function renderCategories() {
  document.querySelectorAll("[data-category-select]").forEach((select) => {
    select.innerHTML = state.categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");
  });

  const goalCategories = [
    RESERVE_CATEGORY,
    ...state.categories.filter((category) => category !== RESERVE_CATEGORY)
  ];

  document.querySelectorAll("[data-goal-category-select]").forEach((select) => {
    select.innerHTML = goalCategories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");
  });

  const list = document.querySelector("[data-category-list]");
  list.innerHTML = state.categories.map((category) => `<span class="tag">${escapeHtml(category)}</span>`).join("");
}

function renderExportOptions() {
  const currentMonth = getCurrentMonthKey();
  const previousMonth = getPreviousMonthKey(currentMonth);

  exportPeriodSelect.querySelector('option[value="current"]').textContent = `Mês atual (${formatMonthLabel(currentMonth)})`;
  exportPeriodSelect.querySelector('option[value="previous"]').textContent = `Mês anterior (${formatMonthLabel(previousMonth)})`;
}

function switchView(viewName) {
  state.activeView = viewName;
  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewButton === viewName);
  });
  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === viewName);
  });
  viewTitle.textContent = VIEW_TITLES[viewName] || "Velyx";
}

function renderDashboard() {
  const { year, month } = parseMonthKey(state.month);
  const summary = calculateMonthlySummary(year, month);

  document.querySelector("[data-current-balance]").textContent = formatCurrency(summary.saldoFinal);
  document.querySelector("[data-monthly-income]").textContent = formatCurrency(summary.totalReceitas);
  document.querySelector("[data-monthly-expenses]").textContent = formatCurrency(summary.totalGastos);
  document.querySelector("[data-monthly-savings]").textContent = formatCurrency(summary.totalEconomias);

  const reserveGoal = state.goals.find((goal) => goal.linkedCategory === RESERVE_CATEGORY);
  document.querySelector("[data-main-goal-progress]").textContent = `${summary.emergencyReserveProgress}%`;
  document.querySelector("[data-main-goal-fill]").style.width = `${summary.emergencyReserveProgress}%`;
  document.querySelector("[data-main-goal-title]").textContent = reserveGoal
    ? reserveGoal.title
    : `Reserva acumulada: ${formatCurrency(summary.emergencyReserveCurrent)}`;
  document.querySelector("[data-main-goal-values]").textContent = reserveGoal
    ? `${formatCurrency(summary.emergencyReserveCurrent)} de ${formatCurrency(summary.emergencyReserveTarget)}`
    : "Crie uma meta vinculada à categoria Reserva de emergência.";

  const topCategory = calculateCategoryExpenses(state.transactions)[0];
  document.querySelector("[data-top-category-name]").textContent = topCategory?.category || "Nenhum gasto registrado neste mês.";
  document.querySelector("[data-top-category-value]").textContent = formatCurrency(topCategory?.amount || 0);
  renderTransactionList(document.querySelector("[data-latest-transactions]"), state.transactions.slice(0, 5));
}

function transactionAmountClass(type) {
  return {
    income: "amount-income",
    expense: "amount-expense",
    saving: "amount-saving"
  }[type] || "";
}

function renderTransactionList(container, transactions, actions = false) {
  if (!transactions.length) {
    container.innerHTML = '<article class="item-card"><div><h3>Nenhuma transação encontrada</h3><p>Registre uma movimentação para começar.</p></div></article>';
    return;
  }

  container.innerHTML = transactions.map((transaction) => `
    <article class="item-card ${isAmountMatch(transaction, 67) || !hasValidTransactionDate(transaction) ? "is-highlighted" : ""}">
      <div>
        <h3>${escapeHtml(transaction.description || transaction.category)}</h3>
        <div class="item-meta">
          <span>${escapeHtml(TYPE_LABELS[transaction.type] || transaction.type)}</span>
          <span>${escapeHtml(transaction.category)}</span>
          <span>${formatDate(transaction.date)}</span>
        </div>
      </div>
      <div class="item-actions">
        <strong class="${transactionAmountClass(transaction.type)}">${formatCurrency(transaction.amount)}</strong>
        ${actions ? `
          <button class="item-action" type="button" data-edit-transaction="${transaction.id}">Editar</button>
          <button class="item-action" type="button" data-delete-transaction="${transaction.id}">Excluir</button>
        ` : ""}
      </div>
    </article>
  `).join("");
}

function renderRecoveryPanel() {
  const panel = document.querySelector("[data-recovery-panel]");
  const count = document.querySelector("[data-recovery-count]");
  const list = document.querySelector("[data-recovery-transactions]");

  if (!panel || !count || !list) {
    return;
  }

  const recovered = state.allTransactions.filter((transaction) => {
    return isAmountMatch(transaction, 67) || !hasValidTransactionDate(transaction);
  });

  panel.hidden = recovered.length === 0;
  count.textContent = `${recovered.length} item${recovered.length === 1 ? "" : "s"}`;

  if (recovered.length) {
    renderTransactionList(list, recovered, true);
  } else {
    list.innerHTML = "";
  }
}

function renderTransactions() {
  renderTransactionList(document.querySelector("[data-transaction-list]"), state.allTransactions, true);
  renderRecoveryPanel();
  renderTransactionList(
    document.querySelector("[data-income-list]"),
    state.allTransactions.filter((transaction) => transaction.type === "income")
  );
  renderTransactionList(
    document.querySelector("[data-expense-list]"),
    state.allTransactions.filter((transaction) => transaction.type === "expense")
  );
}

function renderGoals() {
  const list = document.querySelector("[data-goal-list]");
  if (!state.goals.length) {
    list.innerHTML = '<article class="item-card"><div><h3>Nenhuma meta cadastrada</h3><p>Crie sua primeira meta financeira.</p></div></article>';
    return;
  }

  list.innerHTML = state.goals.map((goal) => `
    <article class="item-card">
      <div>
        <h3>${escapeHtml(goal.title)}</h3>
        <p>${formatCurrency(goal.currentAmount)} de ${formatCurrency(goal.targetAmount)} · ${goal.progress}%</p>
        <div class="progress-track"><span style="width: ${goal.progress}%"></span></div>
        <div class="item-meta">
          <span>Categoria: ${escapeHtml(goal.linkedCategory)}</span>
          <span>${goal.deadline ? `Prazo: ${formatDate(goal.deadline)}` : "Sem prazo"}</span>
          <span>Status: ${escapeHtml(STATUS_LABELS[goal.status] || goal.status)}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="item-action" type="button" data-edit-goal="${goal.id}">Editar</button>
        <button class="item-action" type="button" data-delete-goal="${goal.id}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function renderReports() {
  const report = state.report || {};
  const categories = report.categoryExpenses || [];
  const maxCategory = Math.max(...categories.map((item) => item.amount), 1);
  const categoryReport = document.querySelector("[data-category-report]");
  categoryReport.innerHTML = categories.length ? categories.map((item) => `
    <div>
      <div class="bar-row">
        <span>${escapeHtml(item.category)}</span>
        <strong>${formatCurrency(item.amount)}</strong>
      </div>
      <div class="bar"><span style="width: ${(item.amount / maxCategory) * 100}%"></span></div>
    </div>
  `).join("") : "<p>Nenhum gasto registrado neste mês.</p>";

  const series = report.monthlySeries || [];
  const maxSeries = Math.max(...series.map((item) => Math.max(item.income, item.expenses, item.savings)), 1);
  document.querySelector("[data-monthly-series]").innerHTML = series.map((item) => `
    <div class="series-column">
      <div class="series-bar" title="${formatCurrency(item.expenses)}" style="height: ${Math.max(8, (item.expenses / maxSeries) * 190)}px"></div>
      <span>${item.month.slice(5)}</span>
    </div>
  `).join("");

  document.querySelector("[data-report-count]").textContent = `${(report.transactions || []).length} transações`;
  renderTransactionList(document.querySelector("[data-report-transactions]"), report.transactions || []);
}

function renderAll() {
  renderUser();
  renderCategories();
  renderExportOptions();
  renderDashboard();
  renderTransactions();
  renderGoals();
  renderReports();
}

function resetTransactionForm() {
  transactionForm.reset();
  transactionForm.elements.transactionId.value = "";
  transactionForm.elements.date.value = new Date().toISOString().slice(0, 10);
  transactionSubmit.textContent = "Salvar transação";
  cancelTransactionButton.hidden = true;
}

function resetGoalForm() {
  goalForm.reset();
  goalForm.elements.goalId.value = "";
  goalForm.elements.linkedCategory.value = RESERVE_CATEGORY;
  goalSubmit.textContent = "Salvar meta";
  cancelGoalButton.hidden = true;
}

function refreshData() {
  syncState();
  renderAll();
  switchView(state.activeView);
}

function transactionPayloadFromForm() {
  const data = new FormData(transactionForm);
  const amount = roundMoney(data.get("amount"));

  if (!data.get("date") || !data.get("category") || amount <= 0) {
    throw new Error("Preencha tipo, categoria, valor e data.");
  }

  return {
    type: data.get("type"),
    category: data.get("category"),
    description: String(data.get("description") || "").trim(),
    amount,
    date: data.get("date")
  };
}

function goalPayloadFromForm(existingGoal = null) {
  const data = new FormData(goalForm);
  const title = String(data.get("title") || "").trim();
  const linkedCategory = String(data.get("linkedCategory") || "").trim();
  const targetAmount = roundMoney(data.get("targetAmount"));

  if (!title || !linkedCategory || targetAmount <= 0) {
    throw new Error("Preencha título, categoria vinculada e valor alvo.");
  }

  return {
    id: existingGoal?.id || window.VelyxStore.createId("goal"),
    title,
    linkedCategory,
    targetAmount,
    deadline: data.get("deadline") || "",
    status: data.get("status") || "active",
    createdAt: existingGoal?.createdAt || window.VelyxStore.nowIso(),
    updatedAt: existingGoal ? window.VelyxStore.nowIso() : null
  };
}

function buildWorksheet(rows, columnWidths) {
  const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = columnWidths.map((width) => ({ wch: width }));
  return worksheet;
}

function setCellFormat(worksheet, refs, format) {
  refs.forEach((ref) => {
    if (worksheet[ref]) {
      worksheet[ref].z = format;
    }
  });
}

function setCellStyle(worksheet, ref, style) {
  if (!worksheet[ref]) {
    return;
  }
  worksheet[ref].s = {
    ...(worksheet[ref].s || {}),
    ...style
  };
}

function styleRange(worksheet, rangeRef, style) {
  const range = window.XLSX.utils.decode_range(rangeRef);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      setCellStyle(worksheet, window.XLSX.utils.encode_cell({ r: row, c: column }), style);
    }
  }
}

function styleHeaderRow(worksheet, rowIndex, columnCount) {
  for (let column = 0; column < columnCount; column += 1) {
    setCellStyle(worksheet, window.XLSX.utils.encode_cell({ r: rowIndex, c: column }), {
      fill: { fgColor: { rgb: "2563EB" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" }
    });
  }
}

function decorateSheet(worksheet, rangeRef, headerRowIndex = 0) {
  const range = window.XLSX.utils.decode_range(rangeRef);
  worksheet["!autofilter"] = { ref: rangeRef };
  worksheet["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };
  worksheet["!rows"] = worksheet["!rows"] || [];
  worksheet["!rows"][headerRowIndex] = { hpt: 24 };
  styleHeaderRow(worksheet, headerRowIndex, range.e.c + 1);
  styleRange(worksheet, rangeRef, {
    border: {
      top: { style: "thin", color: { rgb: "D9E2EC" } },
      bottom: { style: "thin", color: { rgb: "D9E2EC" } },
      left: { style: "thin", color: { rgb: "D9E2EC" } },
      right: { style: "thin", color: { rgb: "D9E2EC" } }
    }
  });
}

function makeProgressBar(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const filled = Math.round(safePercent / 5);
  return `${"█".repeat(filled)}${"░".repeat(20 - filled)} ${safePercent}%`;
}

function exportMonthlyExcel(year, month) {
  if (!window.XLSX) {
    throw new Error("Não foi possível carregar a biblioteca SheetJS. Verifique a conexão e tente novamente.");
  }

  const monthKey = monthKeyFromParts(year, month);
  const report = buildMonthlyReport(monthKey);
  const summary = report.summary;
  const workbook = window.XLSX.utils.book_new();

  workbook.Props = {
    Title: `Velyx - Relatorio mensal ${monthKey}`,
    Subject: "Controle financeiro pessoal",
    Author: "Velyx",
    CreatedDate: new Date()
  };

  const resumoRows = [
    ["Velyx - Relatório mensal"],
    [],
    ["Mês do relatório", formatMonthLabel(monthKey)],
    ["Total de receitas", summary.totalReceitas],
    ["Total de gastos", summary.totalGastos],
    ["Total de economias", summary.totalEconomias],
    ["Saldo final", summary.saldoFinal],
    ["Reserva de emergência acumulada", summary.emergencyReserveCurrent],
    ["Alvo da reserva de emergência", summary.emergencyReserveTarget],
    ["Progresso da reserva de emergência", summary.emergencyReserveProgress / 100]
  ];
  const resumoSheet = buildWorksheet(resumoRows, [36, 24]);
  resumoSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  setCellFormat(resumoSheet, ["B4", "B5", "B6", "B7", "B8", "B9"], '"R$" #,##0.00');
  setCellFormat(resumoSheet, ["B10"], "0%");
  resumoSheet["!rows"] = [{ hpt: 30 }, { hpt: 8 }];
  styleRange(resumoSheet, "A1:B1", {
    fill: { fgColor: { rgb: "0F172A" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" }
  });
  styleRange(resumoSheet, "A3:B10", {
    border: {
      top: { style: "thin", color: { rgb: "D9E2EC" } },
      bottom: { style: "thin", color: { rgb: "D9E2EC" } },
      left: { style: "thin", color: { rgb: "D9E2EC" } },
      right: { style: "thin", color: { rgb: "D9E2EC" } }
    }
  });
  styleRange(resumoSheet, "A3:A10", {
    fill: { fgColor: { rgb: "EEF2F7" } },
    font: { bold: true, color: { rgb: "0F172A" } }
  });
  window.XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo");

  const transactionRows = [
    ["Data", "Tipo", "Categoria", "Descrição", "Valor"],
    ...report.transactions.map((transaction) => [
      transaction.date,
      TYPE_LABELS[transaction.type] || transaction.type,
      transaction.category,
      transaction.description || "",
      Number(transaction.amount) || 0
    ])
  ];
  const transactionSheet = buildWorksheet(transactionRows, [14, 14, 24, 38, 16]);
  setCellFormat(transactionSheet, transactionRows.slice(1).map((_, index) => `E${index + 2}`), '"R$" #,##0.00');
  decorateSheet(transactionSheet, `A1:E${Math.max(transactionRows.length, 1)}`);
  window.XLSX.utils.book_append_sheet(workbook, transactionSheet, "Transações");

  const categoryTotal = sumAmounts(report.categoryExpenses);
  const categoryRows = [
    ["Categoria", "Total gasto", "Participacao", "Visual"],
    ...report.categoryExpenses.map((item) => {
      const participation = categoryTotal > 0 ? item.amount / categoryTotal : 0;
      return [item.category, item.amount, participation, makeProgressBar(participation * 100)];
    })
  ];
  const categorySheet = buildWorksheet(categoryRows, [28, 18, 16, 30]);
  setCellFormat(categorySheet, categoryRows.slice(1).map((_, index) => `B${index + 2}`), '"R$" #,##0.00');
  setCellFormat(categorySheet, categoryRows.slice(1).map((_, index) => `C${index + 2}`), "0%");
  decorateSheet(categorySheet, `A1:D${Math.max(categoryRows.length, 1)}`);
  window.XLSX.utils.book_append_sheet(workbook, categorySheet, "Gastos por categoria");

  const goalRows = [
    ["Titulo", "Categoria vinculada", "Valor alvo", "Valor atual calculado", "Progresso em porcentagem", "Visual"],
    ...report.goals.map((goal) => [
      goal.title,
      goal.linkedCategory,
      goal.targetAmount,
      goal.currentAmount,
      goal.progress / 100,
      makeProgressBar(goal.progress)
    ])
  ];
  const goalSheet = buildWorksheet(goalRows, [32, 28, 18, 24, 24, 30]);
  setCellFormat(goalSheet, goalRows.slice(1).map((_, index) => `C${index + 2}`), '"R$" #,##0.00');
  setCellFormat(goalSheet, goalRows.slice(1).map((_, index) => `D${index + 2}`), '"R$" #,##0.00');
  setCellFormat(goalSheet, goalRows.slice(1).map((_, index) => `E${index + 2}`), "0%");
  decorateSheet(goalSheet, `A1:F${Math.max(goalRows.length, 1)}`);
  window.XLSX.utils.book_append_sheet(workbook, goalSheet, "Metas financeiras");

  const comparisonRows = [
    ["Mes", "Receitas", "Gastos", "Economias", "Saldo final", "Gastos visual"],
    ...report.monthlySeries.map((item) => [
      item.month,
      item.income,
      item.expenses,
      item.savings,
      item.balance,
      makeProgressBar(Math.min(100, item.income > 0 ? (item.expenses / item.income) * 100 : 0))
    ])
  ];
  const comparisonSheet = buildWorksheet(comparisonRows, [14, 16, 16, 16, 16, 30]);
  setCellFormat(
    comparisonSheet,
    comparisonRows.slice(1).flatMap((_, index) => [`B${index + 2}`, `C${index + 2}`, `D${index + 2}`, `E${index + 2}`]),
    '"R$" #,##0.00'
  );
  decorateSheet(comparisonSheet, `A1:F${Math.max(comparisonRows.length, 1)}`);
  window.XLSX.utils.book_append_sheet(workbook, comparisonSheet, "Comparativo");

  const fileName = `velyx-relatorio-${monthKey}.xlsx`;
  window.XLSX.writeFile(workbook, fileName, { compression: true });
  window.VelyxStore.setLastExportedMonth(monthKey);

  if (monthlyExportAlert?.dataset.exportMonth === monthKey) {
    monthlyExportAlert.hidden = true;
  }

  showToast(`Relatório ${formatMonthLabel(monthKey)} exportado.`);
  return fileName;
}

function getSelectedExportMonthKey() {
  const currentMonth = getCurrentMonthKey();
  return exportPeriodSelect.value === "previous" ? getPreviousMonthKey(currentMonth) : currentMonth;
}

function checkPendingMonthlyExport() {
  const currentMonth = getCurrentMonthKey();
  const previousMonth = getPreviousMonthKey(currentMonth);
  const lastAccessMonth = window.VelyxStore.getLastAccessMonth();
  const lastExportedMonth = window.VelyxStore.getLastExportedMonth();
  const dismissKey = window.VelyxStore.getReminderDismissKey(previousMonth);
  const wasDismissedThisSession = sessionStorage.getItem(dismissKey) === "true";
  const shouldShow = Boolean(
    lastAccessMonth &&
    lastAccessMonth !== currentMonth &&
    lastExportedMonth !== previousMonth &&
    !wasDismissedThisSession
  );

  if (monthlyExportAlert) {
    monthlyExportAlert.hidden = !shouldShow;
    monthlyExportAlert.dataset.exportMonth = previousMonth;
    document.querySelector("[data-pending-export-month]").textContent = shouldShow
      ? `Período: ${formatMonthLabel(previousMonth)}.`
      : "";
  }

  window.VelyxStore.setLastAccessMonth(currentMonth);
  return shouldShow;
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.viewButton));
});

document.querySelectorAll("[data-shortcut-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.shortcutView));
});

monthFilter.addEventListener("change", () => {
  state.month = monthFilter.value || getCurrentMonthKey();
  refreshData();
});

document.querySelector("[data-logout]").addEventListener("click", () => {
  window.VelyxStore.logoutUser();
  window.location.href = "login.html";
});

transactionForm.elements.type.addEventListener("change", () => {
  if (transactionForm.elements.type.value === "saving" && state.categories.includes(RESERVE_CATEGORY)) {
    transactionForm.elements.category.value = RESERVE_CATEGORY;
  }
});

transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    const id = transactionForm.elements.transactionId.value;
    const payload = transactionPayloadFromForm();
    const transactions = getTransactions();

    if (id && !transactions.some((transaction) => String(transaction.id) === id)) {
      throw new Error("Transacao nao encontrada para edicao.");
    }

    const nextTransactions = id
      ? transactions.map((transaction) => {
        if (String(transaction.id) !== id) {
          return transaction;
        }
        return {
          ...transaction,
          ...payload,
          updatedAt: window.VelyxStore.nowIso()
        };
      })
      : [
        ...transactions,
        {
          id: window.VelyxStore.createId("transaction"),
          ...payload,
          createdAt: window.VelyxStore.nowIso(),
          updatedAt: null
        }
      ];

    window.VelyxStore.saveTransactions(nextTransactions);
    resetTransactionForm();
    refreshData();
    showToast("Transação salva.");
  } catch (error) {
    showToast(error.message);
  }
});

cancelTransactionButton.addEventListener("click", resetTransactionForm);

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    const id = goalForm.elements.goalId.value;
    const goals = window.VelyxStore.getGoals();
    const existingGoal = goals.find((goal) => String(goal.id) === id) || null;

    if (id && !existingGoal) {
      throw new Error("Meta nao encontrada para edicao.");
    }

    const payload = goalPayloadFromForm(existingGoal);
    const nextGoals = existingGoal
      ? goals.map((goal) => (goal.id === existingGoal.id ? payload : goal))
      : [...goals, payload];

    window.VelyxStore.saveGoals(nextGoals);
    resetGoalForm();
    refreshData();
    showToast("Meta financeira salva.");
  } catch (error) {
    showToast(error.message);
  }
});

cancelGoalButton.addEventListener("click", resetGoalForm);

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    state.user = window.VelyxStore.updateCurrentUser({
      name: profileForm.name.value,
      email: profileForm.email.value
    });
    renderUser();
    showToast("Perfil atualizado.");
  } catch (error) {
    showToast(error.message);
  }
});

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    state.categories = window.VelyxStore.addCategory(categoryForm.name.value);
    categoryForm.reset();
    renderCategories();
    showToast("Categoria adicionada.");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("[data-refresh-report]").addEventListener("click", () => {
  refreshData();
  showToast("Relatório atualizado.");
});

document.querySelector("[data-export-excel]").addEventListener("click", () => {
  try {
    const monthKey = getSelectedExportMonthKey();
    const { year, month } = parseMonthKey(monthKey);
    exportMonthlyExcel(year, month);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("[data-export-pending-now]").addEventListener("click", () => {
  try {
    const monthKey = monthlyExportAlert.dataset.exportMonth || getPreviousMonthKey(getCurrentMonthKey());
    const { year, month } = parseMonthKey(monthKey);
    exportMonthlyExcel(year, month);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("[data-export-pending-later]").addEventListener("click", () => {
  const monthKey = monthlyExportAlert.dataset.exportMonth || getPreviousMonthKey(getCurrentMonthKey());
  sessionStorage.setItem(window.VelyxStore.getReminderDismissKey(monthKey), "true");
  monthlyExportAlert.hidden = true;
});

document.addEventListener("click", (event) => {
  const editTransaction = event.target.closest("[data-edit-transaction]");
  const deleteTransaction = event.target.closest("[data-delete-transaction]");
  const editGoal = event.target.closest("[data-edit-goal]");
  const deleteGoal = event.target.closest("[data-delete-goal]");

  if (editTransaction) {
    const transaction = getTransactions().find((item) => String(item.id) === editTransaction.dataset.editTransaction);
    if (transaction) {
      transactionForm.elements.transactionId.value = transaction.id;
      transactionForm.elements.type.value = transaction.type;
      transactionForm.elements.category.value = transaction.category;
      transactionForm.elements.description.value = transaction.description;
      transactionForm.elements.amount.value = transaction.amount;
      transactionForm.elements.date.value = transaction.date;
      transactionSubmit.textContent = "Salvar edição";
      cancelTransactionButton.hidden = false;
      switchView("transactions");
    }
  }

  if (deleteTransaction) {
    const transactionId = deleteTransaction.dataset.deleteTransaction;
    const transactions = getTransactions();
    const nextTransactions = transactions.filter((transaction) => String(transaction.id) !== transactionId);
    if (nextTransactions.length === transactions.length) {
      showToast("Transacao nao encontrada.");
      return;
    }
    window.VelyxStore.saveTransactions(nextTransactions);
    refreshData();
    showToast("Transação excluída.");
  }

  if (editGoal) {
    const goal = window.VelyxStore.getGoals().find((item) => String(item.id) === editGoal.dataset.editGoal);
    if (goal) {
      goalForm.elements.goalId.value = goal.id;
      goalForm.elements.title.value = goal.title;
      goalForm.elements.linkedCategory.value = goal.linkedCategory;
      goalForm.elements.targetAmount.value = goal.targetAmount;
      goalForm.elements.deadline.value = goal.deadline || "";
      goalForm.elements.status.value = goal.status;
      goalSubmit.textContent = "Salvar edição";
      cancelGoalButton.hidden = false;
      switchView("goals");
    }
  }

  if (deleteGoal) {
    const goalId = deleteGoal.dataset.deleteGoal;
    const goals = window.VelyxStore.getGoals();
    const nextGoals = goals.filter((goal) => String(goal.id) !== goalId);
    if (nextGoals.length === goals.length) {
      showToast("Meta nao encontrada.");
      return;
    }
    window.VelyxStore.saveGoals(nextGoals);
    refreshData();
    showToast("Meta excluída.");
  }
});

function boot() {
  state.user = window.VelyxStore.getCurrentUser();
  if (!state.user) {
    window.location.replace("login.html");
    return;
  }

  monthFilter.value = state.month;
  syncState();
  renderCategories();
  resetTransactionForm();
  resetGoalForm();
  renderAll();
  checkPendingMonthlyExport();
}

Object.assign(window, {
  getTransactions,
  getFinancialGoals,
  getMonthlyTransactions,
  calculateMonthlySummary,
  calculateCategoryExpenses,
  calculateGoalCurrentAmount,
  exportMonthlyExcel,
  checkPendingMonthlyExport
});

try {
  boot();
} catch (error) {
  showRuntimeError(error);
}
