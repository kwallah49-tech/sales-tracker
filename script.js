const STORAGE_KEY = "transactions";
const BUDGET_STORAGE_KEY = "budgets";
const CATEGORIES = ["Stock", "Transport", "Airtime", "Rent", "Other"];

let transactions = [];
let budgets = {};
let activeFilter = "all";
let activeScreen = "dashboard";

const form = document.querySelector("#transaction-form");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const typeInput = document.querySelector("#type");
const categoryInput = document.querySelector("#category");
const formMessage = document.querySelector("#form-message");
const transactionList = document.querySelector("#transaction-list");
const recentList = document.querySelector("#recent-list");
const transactionSearch = document.querySelector("#transaction-search");
const transactionCount = document.querySelector("#transaction-count");
const totalSales = document.querySelector("#total-sales");
const totalExpenses = document.querySelector("#total-expenses");
const balanceValue = document.querySelector("#balance");
const balanceCard = document.querySelector("#balance-card");
const balanceNote = document.querySelector("#balance-note");
const budgetForm = document.querySelector("#budget-form");
const budgetMessage = document.querySelector("#budget-message");
const budgetSummary = document.querySelector("#budget-summary");
const screenPanels = document.querySelectorAll("[data-screen-panel]");
const screenTabs = document.querySelectorAll("[data-screen]");

// Formats a number as whole Kenyan shillings with thousands separators.
function formatKES(amount) {
  return `KES ${new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

// Loads saved transactions and keeps only records with the expected fields.
function loadFromStorage() {
  try {
    const savedTransactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(savedTransactions)) {
      return [];
    }

    const validTransactions = [];

    for (const transaction of savedTransactions) {
      const isValid = transaction
        && typeof transaction.id === "number"
        && typeof transaction.description === "string"
        && Number.isFinite(transaction.amount)
        && transaction.amount > 0
        && (transaction.type === "sale" || transaction.type === "expense")
        && CATEGORIES.includes(transaction.category)
        && typeof transaction.date === "string"
        && !Number.isNaN(Date.parse(transaction.date));

      if (isValid) {
        validTransactions.push(transaction);
      }
    }

    return validTransactions;
  } catch (error) {
    return [];
  }
}

// Loads saved category limits and fills the matching budget form fields.
function loadBudgets() {
  try {
    const savedBudgets = JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY) || "{}");

    if (!savedBudgets || typeof savedBudgets !== "object" || Array.isArray(savedBudgets)) {
      return {};
    }

    const validBudgets = {};

    for (const category of CATEGORIES) {
      const amount = savedBudgets[category];

      if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) {
        validBudgets[category] = amount;
        budgetForm.elements.namedItem(category).value = String(amount);
      }
    }

    return validBudgets;
  } catch (error) {
    return {};
  }
}

// Saves the current transaction list in this browser.
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    formMessage.textContent = "Could not save data in this browser.";
    return false;
  }
}

// Saves the current category budget limits in this browser.
function saveBudgetsToStorage() {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
    return true;
  } catch (error) {
    budgetMessage.textContent = "Could not save budgets in this browser.";
    return false;
  }
}

// Updates the three totals using every transaction, not just the filtered list.
function updateSummary() {
  let sales = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (transaction.type === "sale") {
      sales += transaction.amount;
    } else {
      expenses += transaction.amount;
    }
  }

  const balance = sales - expenses;
  totalSales.textContent = formatKES(sales);
  totalExpenses.textContent = formatKES(expenses);
  balanceValue.textContent = formatKES(balance);
  balanceCard.classList.toggle("is-positive", balance > 0);
  balanceCard.classList.toggle("is-negative", balance < 0);
  balanceNote.textContent = balance > 0 ? "Profit so far" : balance < 0 ? "Loss so far" : "Even so far";
}

// Adds every transaction to its matching category and transaction type.
function getCategoryTotals() {
  const totals = {
    sale: {},
    expense: {},
  };

  for (const category of CATEGORIES) {
    totals.sale[category] = 0;
    totals.expense[category] = 0;
  }

  for (const transaction of transactions) {
    totals[transaction.type][transaction.category] += transaction.amount;
  }

  return totals;
}

// Totals expense transactions for each category in the current calendar month.
function getMonthlySpending() {
  const spending = {};
  const today = new Date();

  for (const category of CATEGORIES) {
    spending[category] = 0;
  }

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const transactionDate = new Date(transaction.date);
    const isCurrentMonth = transactionDate.getFullYear() === today.getFullYear()
      && transactionDate.getMonth() === today.getMonth();

    if (isCurrentMonth) {
      spending[transaction.category] += transaction.amount;
    }
  }

  return spending;
}

// Sorts two transactions so the newer date appears first.
function compareNewestFirst(first, second) {
  return Date.parse(second.date) - Date.parse(first.date) || second.id - first.id;
}

// Makes a delete button for one transaction without inserting its text as HTML.
function makeDeleteButton(transaction) {
  const button = document.createElement("button");
  button.className = "delete-button";
  button.type = "button";
  button.dataset.id = String(transaction.id);
  button.setAttribute("aria-label", `Delete ${transaction.description}`);
  button.title = "Delete transaction";
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>';
  return button;
}

// Builds one transaction row that can be shown in either list.
function makeTransactionRow(transaction) {
  const row = document.createElement("article");
  const main = document.createElement("div");
  const description = document.createElement("span");
  const meta = document.createElement("div");
  const date = document.createElement("span");
  const category = document.createElement("span");
  const side = document.createElement("div");
  const amount = document.createElement("span");

  row.className = "transaction-row";
  main.className = "transaction-main";
  description.className = "transaction-description";
  description.textContent = transaction.description;
  meta.className = "transaction-meta";
  date.textContent = new Date(transaction.date).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  category.textContent = transaction.category;
  meta.append(date, category);
  main.append(description, meta);
  side.className = "transaction-side";
  amount.className = `transaction-amount ${transaction.type}`;
  amount.textContent = `${transaction.type === "sale" ? "+" : "−"}${formatKES(transaction.amount)}`;
  side.append(amount, makeDeleteButton(transaction));
  row.append(main, side);
  return row;
}

// Draws the full transaction list using the selected type and search text.
function renderList() {
  const searchText = transactionSearch.value.trim().toLocaleLowerCase();
  const visibleTransactions = [];

  for (const transaction of transactions) {
    const matchesType = activeFilter === "all" || transaction.type === activeFilter;
    const matchesSearch = transaction.description.toLocaleLowerCase().includes(searchText);

    if (matchesType && matchesSearch) {
      visibleTransactions.push(transaction);
    }
  }

  visibleTransactions.sort(compareNewestFirst);
  transactionList.replaceChildren();
  transactionCount.textContent = `${visibleTransactions.length} ${visibleTransactions.length === 1 ? "entry" : "entries"}`;

  if (visibleTransactions.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = transactions.length === 0
      ? "No transactions yet"
      : "No transactions match your search and filter.";
    transactionList.append(emptyMessage);
    return;
  }

  for (const transaction of visibleTransactions) {
    transactionList.append(makeTransactionRow(transaction));
  }
}

// Draws at most the five newest transactions on the dashboard.
function renderRecentTransactions() {
  const newestTransactions = transactions.slice().sort(compareNewestFirst).slice(0, 5);
  recentList.replaceChildren();

  if (newestTransactions.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "No transactions yet";
    recentList.append(emptyMessage);
    return;
  }

  for (const transaction of newestTransactions) {
    recentList.append(makeTransactionRow(transaction));
  }
}

// Draws category amount rows and proportional bars for one transaction type.
function renderReportGroup(container, categoryTotals, type) {
  let total = 0;

  for (const category of CATEGORIES) {
    total += categoryTotals[category];
  }

  container.replaceChildren();

  for (const category of CATEGORIES) {
    const amount = categoryTotals[category];
    const percentage = total > 0 ? (amount / total) * 100 : 0;
    const row = document.createElement("div");
    const label = document.createElement("span");
    const track = document.createElement("div");
    const bar = document.createElement("div");
    const value = document.createElement("span");

    row.className = "report-row";
    label.className = "report-category";
    label.textContent = category;
    track.className = "report-track";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${category}: ${percentage.toFixed(1)}% of ${type === "sale" ? "sales" : "expenses"}`);
    bar.className = `report-bar ${type}`;
    bar.style.width = `${percentage}%`;
    track.append(bar);
    value.className = "report-amount";
    value.textContent = formatKES(amount);
    row.append(label, track, value);
    container.append(row);
  }
}

// Updates both report groups with the latest amounts and percentages.
function renderReports() {
  const totals = getCategoryTotals();
  renderReportGroup(document.querySelector("#sales-report"), totals.sale, "sale");
  renderReportGroup(document.querySelector("#expenses-report"), totals.expense, "expense");
}

// Shows each category's monthly spending, budget limit, progress bar, and status.
function renderBudget() {
  const spending = getMonthlySpending();
  budgetSummary.replaceChildren();

  for (const category of CATEGORIES) {
    const spent = spending[category];
    const hasBudget = Object.prototype.hasOwnProperty.call(budgets, category);
    const limit = hasBudget ? budgets[category] : 0;
    const percentage = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 101 : 0;
    const row = document.createElement("article");
    const heading = document.createElement("div");
    const name = document.createElement("h3");
    const spentLabel = document.createElement("span");
    const limitLine = document.createElement("div");
    const limitLabel = document.createElement("span");
    const limitValue = document.createElement("strong");
    const track = document.createElement("div");
    const bar = document.createElement("div");
    const status = document.createElement("p");

    row.className = "budget-category-row";
    heading.className = "budget-row-heading";
    name.textContent = category;
    spentLabel.className = "budget-spent";
    spentLabel.textContent = `${formatKES(spent)} spent`;
    heading.append(name, spentLabel);
    limitLine.className = "budget-limit-line";
    limitLabel.textContent = "Monthly limit";
    limitValue.textContent = hasBudget ? formatKES(limit) : "No budget set";
    limitLine.append(limitLabel, limitValue);
    track.className = "budget-progress-track";
    bar.className = "budget-progress-bar";
    status.className = "budget-status";

    if (!hasBudget) {
      status.textContent = "Set a limit above to track this category.";
    } else {
      const barState = percentage > 100 ? "is-over" : percentage >= 70 ? "is-warning" : "is-under";
      bar.classList.add(barState);
      bar.style.width = `${Math.min(percentage, 100)}%`;
      status.classList.add(barState);
      status.textContent = spent > limit
        ? `Over by ${formatKES(spent - limit)}`
        : `${formatKES(limit - spent)} left`;
    }

    track.setAttribute("role", "img");
    track.setAttribute("aria-label", hasBudget
      ? `${category}: ${formatKES(spent)} spent of ${formatKES(limit)}`
      : `${category}: no budget set`);
    track.append(bar);
    row.append(heading, limitLine, track, status);
    budgetSummary.append(row);
  }
}

// Refreshes the summary, recent activity, full list, and reports together.
function renderApp() {
  updateSummary();
  renderRecentTransactions();
  renderList();
  renderReports();
  renderBudget();
}

// Shows one screen and highlights its matching navigation tab.
function showScreen(name) {
  const screenExists = ["dashboard", "transactions", "reports", "budget", "about"].includes(name);

  if (!screenExists) {
    return;
  }

  activeScreen = name;

  for (const panel of screenPanels) {
    panel.hidden = panel.dataset.screenPanel !== activeScreen;
  }

  for (const tab of screenTabs) {
    const isActive = tab.dataset.screen === activeScreen;
    tab.classList.toggle("is-active", isActive);

    if (isActive) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  }

  renderApp();
}

// Saves the entered category limits, with blank fields meaning no limit.
function saveBudgetForm(event) {
  event.preventDefault();
  budgetMessage.textContent = "";
  const updatedBudgets = {};

  for (const category of CATEGORIES) {
    const input = budgetForm.elements.namedItem(category);
    const value = input.value.trim();

    if (value === "") {
      continue;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
      budgetMessage.textContent = "Enter a valid amount of zero or more, or leave it blank.";
      input.focus();
      return;
    }

    updatedBudgets[category] = amount;
  }

  budgets = updatedBudgets;

  if (saveBudgetsToStorage()) {
    renderApp();
    budgetMessage.textContent = "Budgets saved.";
  }
}

// Adds a checked transaction, saves it, and refreshes the page totals and list.
function addTransaction(event) {
  event.preventDefault();
  formMessage.textContent = "";

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const type = typeInput.value;
  const category = categoryInput.value;

  if (!description) {
    formMessage.textContent = "Enter a description.";
    descriptionInput.focus();
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    formMessage.textContent = "Enter an amount greater than zero.";
    amountInput.focus();
    return;
  }

  if ((type !== "sale" && type !== "expense") || !CATEGORIES.includes(category)) {
    formMessage.textContent = "Choose a valid type and category.";
    return;
  }

  let id = Date.now();

  while (idIsAlreadyUsed(id)) {
    id += 1;
  }

  transactions.push({
    id,
    description,
    amount,
    type,
    category,
    date: new Date().toISOString(),
  });

  const saved = saveToStorage();
  renderApp();
  form.reset();
  if (saved) {
    formMessage.textContent = "Transaction added.";
  }
  descriptionInput.focus();
}

// Checks whether the current transaction list already contains an ID.
function idIsAlreadyUsed(id) {
  for (const transaction of transactions) {
    if (transaction.id === id) {
      return true;
    }
  }

  return false;
}

// Removes the transaction whose delete button was pressed, then updates storage.
function deleteTransaction(event) {
  const deleteButton = event.target.closest("button[data-id]");

  if (!deleteButton || (!transactionList.contains(deleteButton) && !recentList.contains(deleteButton))) {
    return;
  }

  const id = Number(deleteButton.dataset.id);
  const remainingTransactions = [];

  for (const transaction of transactions) {
    if (transaction.id !== id) {
      remainingTransactions.push(transaction);
    }
  }

  transactions = remainingTransactions;
  saveToStorage();
  renderApp();
  formMessage.textContent = "Transaction deleted.";
}

// Changes the active list filter while keeping the overall totals unchanged.
function changeFilter(event) {
  const filterButton = event.target.closest("button[data-filter]");

  if (!filterButton) {
    return;
  }

  activeFilter = filterButton.dataset.filter;

  for (const button of document.querySelectorAll("button[data-filter]")) {
    const isActive = button === filterButton;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  renderList();
}

// Shows the screen selected by one of the navigation tabs.
function handleNavigation(event) {
  const tab = event.target.closest("button[data-screen]");

  if (tab) {
    showScreen(tab.dataset.screen);
  }
}

// Refreshes the transaction list whenever the search text changes.
function handleSearchInput() {
  renderList();
}

// Confirms before removing every saved transaction.
function clearAllTransactions() {
  if (transactions.length === 0) {
    return;
  }

  if (!window.confirm("Clear all transactions? This cannot be undone.")) {
    return;
  }

  transactions = [];
  saveToStorage();
  renderApp();
  formMessage.textContent = "All transactions cleared.";
}

// Confirms before clearing both transactions and saved category budgets.
function clearAllData() {
  const hasData = transactions.length > 0 || Object.keys(budgets).length > 0;

  if (!hasData || !window.confirm("Clear all transactions and budgets? This cannot be undone.")) {
    return;
  }

  transactions = [];
  budgets = {};
  saveToStorage();
  saveBudgetsToStorage();

  for (const category of CATEGORIES) {
    budgetForm.elements.namedItem(category).value = "";
  }

  renderApp();
  formMessage.textContent = "All data cleared.";
}

// Loads saved data and connects the page controls when the script starts.
function startTracker() {
  transactions = loadFromStorage();
  budgets = loadBudgets();
  saveToStorage();
  form.addEventListener("submit", addTransaction);
  budgetForm.addEventListener("submit", saveBudgetForm);
  transactionList.addEventListener("click", deleteTransaction);
  recentList.addEventListener("click", deleteTransaction);
  document.querySelector(".filter-group").addEventListener("click", changeFilter);
  document.querySelector("#clear-all").addEventListener("click", clearAllTransactions);
  document.querySelector("#clear-all-data").addEventListener("click", clearAllData);
  document.querySelector(".top-nav").addEventListener("click", handleNavigation);
  transactionSearch.addEventListener("input", handleSearchInput);
  showScreen("dashboard");
}

startTracker();

// Register the service worker after the page loads so the app can work offline.
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }
});
