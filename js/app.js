(function () {
  const BudgifyApp = {
    ready: () => ensureBootstrap(),
    logout: () => logoutAndPrompt(),
    updateSyncedSavings: (list) =>
      window.BudgifySync?.updateSyncedSavings?.(list),
  };
  let bootstrapPromise = null;
  let authMode = "login";

  function ensureBootstrap() {
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap();
    }
    return bootstrapPromise;
  }

  async function bootstrap() {
    if (!window.BudgifyAPI || !window.BudgifyStore) {
      console.warn("BudgifyAPI ou Store indisponible, fallback hors ligne.");
      return window.BudgifyStore?.getAppData?.();
    }

    const defaults = window.BudgifyStore.cloneDefaults();
    window.BudgifyStore.replaceAppData(defaults, { persist: false });

    try {
      const session = await tryRestoreSession();
      if (!session) {
        await promptAuth("login");
      } else {
        await hydrateFromRemote();
      }
    } catch (error) {
      handleNetworkError(error);
    }
    return window.BudgifyStore.getAppData();
  }

  async function tryRestoreSession() {
    try {
      const result = await window.BudgifyAPI.me();
      BudgifyApp.currentUser = result?.user || null;
      emitAuthChange(BudgifyApp.currentUser);
      return BudgifyApp.currentUser;
    } catch (error) {
      if (error?.status === 401) return null;
      throw error;
    }
  }

  async function promptAuth(initialMode = "login") {
    authMode = initialMode;
    await waitDomReady();
    const overlay = getAuthOverlay();
    overlay.classList.remove("is-hidden");
    setOverlayMode(overlay, authMode);
    const form = overlay.querySelector("form");
    const errorBox = overlay.querySelector(".auth-error");
    const submitBtn = overlay.querySelector("button[type=submit]");
    const switchBtn = overlay.querySelector("[data-auth-toggle]");

    if (switchBtn) {
      switchBtn.onclick = () => {
        authMode = authMode === "login" ? "register" : "login";
        setOverlayMode(overlay, authMode);
      };
    }

    return new Promise((resolve) => {
      const onSubmit = async (event) => {
        event.preventDefault();
        if (submitBtn) submitBtn.disabled = true;
        errorBox.textContent = "";
        const email = form.email.value.trim();
        const password = form.password.value;
        if (!email || !password) {
          errorBox.textContent = "Email et mot de passe requis.";
          submitBtn.disabled = false;
          return;
        }
        try {
          const apiCall =
            authMode === "register"
              ? window.BudgifyAPI.register
              : window.BudgifyAPI.login;
          const result = await apiCall(email, password);
          BudgifyApp.currentUser = result?.user || null;
          emitAuthChange(BudgifyApp.currentUser);
          overlay.classList.add("is-hidden");
          form.reset();
          form.removeEventListener("submit", onSubmit);
          await hydrateFromRemote();
          resolve(BudgifyApp.currentUser);
        } catch (error) {
          const message =
            error?.data?.error?.message || error?.data?.error || error.message;
          errorBox.textContent =
            message ||
            (authMode === "register"
              ? "Inscription impossible."
              : "Connexion impossible.");
          handleNetworkError(error);
        } finally {
          submitBtn.disabled = false;
        }
      };
      form.addEventListener("submit", onSubmit);
    });
  }

  async function hydrateFromRemote() {
    const remote = await window.BudgifyAPI.fetchAppData();
    const normalized = normalizeRemoteData(remote);
    window.BudgifyStore.replaceAppData(normalized, { persist: true });
    document.dispatchEvent(new Event("budgify:data:hydrated"));
  }

  function normalizeRemoteData(remote) {
    const defaults = window.BudgifyStore.cloneDefaults();
    const settings = remote?.settings || defaults.settings;
    const monthsArray = Array.isArray(remote?.months) ? remote.months : [];
    const months = {};
    monthsArray.forEach((month) => {
      if (!month?.key) return;
      months[month.key] = normalizeMonth(month);
    });
    const data = {
      settings,
      months: Object.keys(months).length ? months : defaults.months,
    };
    window.BudgifyStore.ensureSettingsShape(data);
    window.BudgifySync?.updateSyncedSavings?.(settings?.savings);
    return data;
  }

  function normalizeMonth(month) {
    const safe = structuredClone ? structuredClone(month) : JSON.parse(JSON.stringify(month));
    safe.incomes = Array.isArray(safe.incomes) ? safe.incomes : [];
    safe.variableCharges = Array.isArray(safe.variableCharges)
      ? safe.variableCharges
      : [];
    safe.expenses = Array.isArray(safe.expenses) ? safe.expenses : [];
    safe.paidFixedCharges = Array.isArray(safe.paidFixedCharges)
      ? safe.paidFixedCharges
      : [];
    safe.paidSubscriptions = Array.isArray(safe.paidSubscriptions)
      ? safe.paidSubscriptions
      : [];
    safe.paidCredits = Array.isArray(safe.paidCredits) ? safe.paidCredits : [];
    safe.savingsEntries = Array.isArray(safe.savingsEntries)
      ? safe.savingsEntries
      : [];
    safe.carryOver = Number(safe.carryOver) || 0;
    return safe;
  }

  let overlayEl = null;

  function getAuthOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.id = "authOverlay";
    overlayEl.className = "auth-overlay is-hidden";
    overlayEl.innerHTML = `
      <div class="auth-card">
        <div class="auth-card-head">
          <img src="images/icon.png" alt="" class="auth-logo" />
          <div>
            <h2 class="auth-title">Connexion requise</h2>
            <p class="auth-subtitle">Connectez-vous pour synchroniser vos budgets.</p>
          </div>
        </div>
        <form class="auth-form">
          <label>
            Email
            <input type="email" name="email" placeholder="vous@example.com" autocomplete="email" required />
          </label>
          <label>
            Mot de passe
            <input type="password" name="password" placeholder="Mot de passe" autocomplete="current-password" required />
          </label>
          <button type="submit" class="primary">Se connecter</button>
          <p class="auth-error" role="alert"></p>
        </form>
        <p class="auth-switch">
          <span class="auth-switch-text">Pas encore de compte ?</span>
          <button type="button" class="auth-switch-btn" data-auth-toggle>Créer un compte</button>
        </p>
      </div>
    `;
    document.body.appendChild(overlayEl);
    requestAnimationFrame(() => overlayEl.classList.add("is-visible"));
    return overlayEl;
  }

  function waitDomReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }

  function setOverlayMode(overlay, mode) {
    overlay.dataset.authMode = mode;
    const title = overlay.querySelector(".auth-title");
    const subtitle = overlay.querySelector(".auth-subtitle");
    const submitBtn = overlay.querySelector("button[type=submit]");
    const switchText = overlay.querySelector(".auth-switch-text");
    const switchBtn = overlay.querySelector(".auth-switch-btn");
    if (!title || !subtitle || !submitBtn || !switchText || !switchBtn) return;
    if (mode === "register") {
      title.textContent = "Créer un compte";
      subtitle.textContent = "Inscrivez-vous pour sauvegarder vos budgets.";
      submitBtn.textContent = "S'inscrire";
      switchText.textContent = "Déjà inscrit ?";
      switchBtn.textContent = "Se connecter";
    } else {
      title.textContent = "Connexion requise";
      subtitle.textContent = "Connectez-vous pour synchroniser vos budgets.";
      submitBtn.textContent = "Se connecter";
      switchText.textContent = "Pas encore de compte ?";
      switchBtn.textContent = "Créer un compte";
    }
  }

  async function logoutAndPrompt() {
    try {
      await window.BudgifyAPI.logout();
    } catch {
      // ignore
    }
    BudgifyApp.currentUser = null;
    emitAuthChange(null);
    window.BudgifyStore.replaceAppData(
      window.BudgifyStore.cloneDefaults(),
      { persist: false },
    );
    promptAuth("login");
  }

  function emitAuthChange(user) {
    document.dispatchEvent(
      new CustomEvent("budgify:auth", { detail: { user } }),
    );
  }

  function handleNetworkError(error) {
    if (!error || error?.status === 401) return;
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Aucune réponse du serveur.";
    showNetworkToast(message, error?.status);
  }

  function showNetworkToast(message, status) {
    const toast = document.createElement("div");
    toast.className = "toast toast-error";
    toast.textContent = `Pas de connexion (${status ?? "réseau"}). ${message}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  window.BudgifyApp = BudgifyApp;
})();
