(function () {
  const DEFAULT_API_BASE = window.BUDGIFY_API_BASE || "http://localhost:4000";

  async function apiFetch(path, { method = "GET", body, headers = {}, ...rest } = {}) {
    const opts = {
      method,
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...rest,
    };

    if (body != null && !(body instanceof FormData)) {
      opts.body = typeof body === "string" ? body : JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }

    const response = await fetch(`${DEFAULT_API_BASE}${path}`, opts);
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json().catch(() => ({})) : await response.text();

    if (!response.ok) {
      const error = new Error(payload?.error || response.statusText || "Requête échouée");
      error.status = response.status;
      error.data = payload;
      throw error;
    }

    return payload;
  }

  async function login(email, password) {
    return apiFetch("/auth/login", { method: "POST", body: { email, password } });
  }

  async function register(email, password) {
    return apiFetch("/auth/register", { method: "POST", body: { email, password } });
  }

  async function logout() {
    return apiFetch("/auth/logout", { method: "POST" });
  }

  async function me() {
    return apiFetch("/auth/me");
  }

  async function fetchSettings() {
    return apiFetch("/settings");
  }

  async function fetchMonths() {
    return apiFetch("/months");
  }

  async function upsertMonth(key, payload) {
    return apiFetch(`/months/${key}`, { method: "PUT", body: payload });
  }

  async function createMonth(payload) {
    return apiFetch("/months", { method: "POST", body: payload });
  }

  async function deleteMonth(key) {
    return apiFetch(`/months/${key}`, { method: "DELETE" });
  }

  async function upsertSetting(category, payload) {
    if (payload?.id) {
      return apiFetch(`/${buildSettingsPath(category)}/${payload.id}`, {
        method: "PUT",
        body: payload,
      });
    }
    return apiFetch(`/${buildSettingsPath(category)}`, {
      method: "POST",
      body: payload,
    });
  }

  async function removeSetting(category, id) {
    return apiFetch(`/${buildSettingsPath(category)}/${id}`, { method: "DELETE" });
  }

  function buildSettingsPath(category) {
    const normalized = String(category || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    return `settings/${normalized}`;
  }

  async function fetchAppData() {
    const [settingsRes, monthsRes] = await Promise.all([fetchSettings(), fetchMonths()]);
    return {
      settings: settingsRes?.settings || {},
      months: monthsRes?.months || [],
    };
  }

  window.BudgifyAPI = {
    baseUrl: DEFAULT_API_BASE,
    apiFetch,
    login,
    register,
    logout,
    me,
    fetchSettings,
    fetchMonths,
    fetchAppData,
    upsertMonth,
    createMonth,
    deleteMonth,
    upsertSetting,
    removeSetting,
  };
})();
