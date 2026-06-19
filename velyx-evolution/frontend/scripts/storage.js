(function () {
  "use strict";

  const ROOT_KEYS = {
    users: "velyx.users.v1",
    sessionUserId: "velyx.sessionUserId.v1"
  };

  const RESERVE_CATEGORY = "Reserva de emergência";

  const DEFAULT_CATEGORIES = [
    "Alimentação",
    "Transporte",
    "Estudos",
    "Lazer",
    "Contas",
    "Saúde",
    "Trabalho",
    "Moradia",
    RESERVE_CATEGORY,
    "Outros"
  ];

  let storageAvailable = true;

  try {
    const probeKey = "velyx.storage.probe";
    localStorage.setItem(probeKey, "ok");
    localStorage.removeItem(probeKey);
  } catch (error) {
    storageAvailable = false;
  }

  function cloneFallback(fallback) {
    if (Array.isArray(fallback)) {
      return [...fallback];
    }
    if (fallback && typeof fallback === "object") {
      return { ...fallback };
    }
    return fallback;
  }

  function assertStorageAvailable() {
    if (!storageAvailable) {
      throw new Error("O armazenamento local do navegador esta bloqueado. Ative o localStorage para usar a Velyx.");
    }
  }

  function readJson(key, fallback) {
    assertStorageAvailable();
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : cloneFallback(fallback);
    } catch (error) {
      try {
        const brokenValue = localStorage.getItem(key);
        if (brokenValue) {
          localStorage.setItem(`${key}.corrupt.${Date.now()}`, brokenValue);
        }
        localStorage.removeItem(key);
      } catch (storageError) {
        storageAvailable = false;
      }
      return cloneFallback(fallback);
    }
  }

  function writeJson(key, value) {
    assertStorageAvailable();
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new Error("Nao foi possivel salvar os dados no navegador. Libere espaco ou verifique as permissoes do site.");
    }
  }

  function createId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function parseMoney(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(Math.abs(value) * 100) / 100;
    }

    const text = String(value ?? "").trim();
    if (!text) {
      return 0;
    }

    const normalized = text
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? Math.round(Math.abs(parsed) * 100) / 100 : 0;
  }

  function normalizeType(type) {
    const value = String(type || "").trim().toLowerCase();
    if (["income", "receita", "receitas"].includes(value)) {
      return "income";
    }
    if (["expense", "gasto", "gastos", "despesa", "despesas"].includes(value)) {
      return "expense";
    }
    if (["saving", "economia", "economias", "reserva"].includes(value)) {
      return "saving";
    }
    return "expense";
  }

  function normalizeDate(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      return `${monthMatch[1]}-${monthMatch[2]}-01`;
    }

    const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }

    const timestamp = Date.parse(text);
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString().slice(0, 10);
    }

    return "";
  }

  function normalizeTransaction(transaction, index) {
    const safeTransaction = transaction && typeof transaction === "object" ? transaction : {};
    const fallbackId = safeTransaction.id || safeTransaction._id || safeTransaction.uuid || `transaction_recovered_${index}_${Date.now()}`;
    const category = String(safeTransaction.category || safeTransaction.categoria || "Outros").trim() || "Outros";
    const description = String(safeTransaction.description || safeTransaction.descricao || safeTransaction.title || "").trim();
    const date = normalizeDate(safeTransaction.date || safeTransaction.data || safeTransaction.createdAt || safeTransaction.created_at);

    return {
      id: String(fallbackId),
      type: normalizeType(safeTransaction.type || safeTransaction.tipo),
      category,
      description,
      amount: parseMoney(safeTransaction.amount ?? safeTransaction.valor ?? safeTransaction.value),
      date,
      createdAt: safeTransaction.createdAt || safeTransaction.created_at || nowIso(),
      updatedAt: safeTransaction.updatedAt || safeTransaction.updated_at || null
    };
  }

  function getUsers() {
    const users = readJson(ROOT_KEYS.users, []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    writeJson(ROOT_KEYS.users, Array.isArray(users) ? users : []);
  }

  function userDataKey(userId, entity) {
    return `velyx.${userId}.${entity}.v1`;
  }

  function ensureUserData(userId) {
    if (!localStorage.getItem(userDataKey(userId, "transactions"))) {
      writeJson(userDataKey(userId, "transactions"), []);
    }
    if (!localStorage.getItem(userDataKey(userId, "goals"))) {
      writeJson(userDataKey(userId, "goals"), []);
    }
    if (!localStorage.getItem(userDataKey(userId, "categories"))) {
      writeJson(userDataKey(userId, "categories"), DEFAULT_CATEGORIES);
    }
  }

  function setSession(userId) {
    localStorage.setItem(ROOT_KEYS.sessionUserId, userId);
    ensureUserData(userId);
  }

  function getCurrentUserId() {
    return localStorage.getItem(ROOT_KEYS.sessionUserId);
  }

  function getCurrentUser() {
    const userId = getCurrentUserId();
    if (!userId) {
      return null;
    }
    const user = getUsers().find((item) => item.id === userId) || null;
    if (!user) {
      localStorage.removeItem(ROOT_KEYS.sessionUserId);
      return null;
    }
    if (user) {
      ensureUserData(user.id);
    }
    return user;
  }

  function requireCurrentUser() {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("Faça login para acessar a Velyx.");
    }
    return user;
  }

  function createUser({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const cleanName = String(name || "").trim();
    const cleanPassword = String(password || "");

    if (!cleanName || !normalizedEmail || cleanPassword.length < 6) {
      throw new Error("Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.");
    }

    const users = getUsers();
    if (users.some((user) => user.email === normalizedEmail)) {
      throw new Error("Já existe uma conta com esse e-mail.");
    }

    const user = {
      id: createId("user"),
      name: cleanName,
      email: normalizedEmail,
      password: cleanPassword,
      createdAt: nowIso()
    };

    saveUsers([...users, user]);
    setSession(user.id);
    return user;
  }

  function loginUser(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const user = getUsers().find((item) => item.email === normalizedEmail && item.password === String(password || ""));

    if (!user) {
      throw new Error("E-mail ou senha inválidos.");
    }

    setSession(user.id);
    return user;
  }

  function logoutUser() {
    localStorage.removeItem(ROOT_KEYS.sessionUserId);
  }

  function updateCurrentUser(updates) {
    const currentUser = requireCurrentUser();
    const users = getUsers();
    const nextEmail = normalizeEmail(updates.email);
    const nextName = String(updates.name || "").trim();

    if (!nextName || !nextEmail) {
      throw new Error("Nome e e-mail são obrigatórios.");
    }

    if (users.some((user) => user.id !== currentUser.id && user.email === nextEmail)) {
      throw new Error("Esse e-mail já está em uso.");
    }

    const updatedUsers = users.map((user) => {
      if (user.id !== currentUser.id) {
        return user;
      }
      return {
        ...user,
        name: nextName,
        email: nextEmail
      };
    });

    saveUsers(updatedUsers);
    return updatedUsers.find((user) => user.id === currentUser.id);
  }

  function getCategories() {
    const user = requireCurrentUser();
    const stored = readJson(userDataKey(user.id, "categories"), DEFAULT_CATEGORIES);
    const storedCategories = Array.isArray(stored) ? stored : [];
    const merged = [...DEFAULT_CATEGORIES, ...storedCategories].filter((category, index, list) => {
      return list.findIndex((item) => item.toLowerCase() === category.toLowerCase()) === index;
    });
    writeJson(userDataKey(user.id, "categories"), merged);
    return merged;
  }

  function saveCategories(categories) {
    const user = requireCurrentUser();
    const cleanCategories = categories
      .map((category) => String(category || "").trim())
      .filter(Boolean)
      .filter((category, index, list) => list.findIndex((item) => item.toLowerCase() === category.toLowerCase()) === index);
    writeJson(userDataKey(user.id, "categories"), cleanCategories);
    return cleanCategories;
  }

  function addCategory(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      throw new Error("Informe o nome da categoria.");
    }

    const categories = getCategories();
    if (categories.some((category) => category.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error("Essa categoria já existe.");
    }

    return saveCategories([...categories, cleanName]);
  }

  function getTransactions() {
    const user = requireCurrentUser();
    const key = userDataKey(user.id, "transactions");
    const transactions = readJson(key, []);
    const normalizedTransactions = (Array.isArray(transactions) ? transactions : []).map(normalizeTransaction);
    if (JSON.stringify(transactions) !== JSON.stringify(normalizedTransactions)) {
      writeJson(key, normalizedTransactions);
    }
    return normalizedTransactions;
  }

  function saveTransactions(transactions) {
    const user = requireCurrentUser();
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    writeJson(userDataKey(user.id, "transactions"), safeTransactions);
    return safeTransactions;
  }

  function getGoals() {
    const user = requireCurrentUser();
    const goals = readJson(userDataKey(user.id, "goals"), []);
    return (Array.isArray(goals) ? goals : []).map((goal) => ({
      id: goal.id,
      title: goal.title,
      linkedCategory: goal.linkedCategory || RESERVE_CATEGORY,
      targetAmount: Number(goal.targetAmount) || 0,
      deadline: goal.deadline || "",
      status: goal.status || "active",
      createdAt: goal.createdAt || nowIso(),
      updatedAt: goal.updatedAt || null
    }));
  }

  function saveGoals(goals) {
    const user = requireCurrentUser();
    const safeGoals = Array.isArray(goals) ? goals : [];
    writeJson(userDataKey(user.id, "goals"), safeGoals);
    return safeGoals;
  }

  function getLastAccessMonth() {
    const user = requireCurrentUser();
    return localStorage.getItem(userDataKey(user.id, "lastAccessMonth"));
  }

  function setLastAccessMonth(monthKey) {
    const user = requireCurrentUser();
    localStorage.setItem(userDataKey(user.id, "lastAccessMonth"), monthKey);
  }

  function getLastExportedMonth() {
    const user = requireCurrentUser();
    return localStorage.getItem(userDataKey(user.id, "lastExportedMonth"));
  }

  function setLastExportedMonth(monthKey) {
    const user = requireCurrentUser();
    localStorage.setItem(userDataKey(user.id, "lastExportedMonth"), monthKey);
  }

  function getReminderDismissKey(monthKey) {
    const user = requireCurrentUser();
    return `velyx.${user.id}.exportReminderDismissed.${monthKey}.session`;
  }

  window.VelyxStore = {
    DEFAULT_CATEGORIES,
    RESERVE_CATEGORY,
    createId,
    nowIso,
    createUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateCurrentUser,
    getCategories,
    addCategory,
    getTransactions,
    saveTransactions,
    getGoals,
    saveGoals,
    getLastAccessMonth,
    setLastAccessMonth,
    getLastExportedMonth,
    setLastExportedMonth,
    getReminderDismissKey
  };
})();
