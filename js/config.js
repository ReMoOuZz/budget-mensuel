(function () {
  const API_ENDPOINTS = {
    dev: "http://localhost:4000",
    prod: "https://budgify-2026-a22ffa49cc37.herokuapp.com",
  };

  function detectEnv() {
    try {
      const stored = window.localStorage?.getItem("budgify:apiEnv");
      if (stored && API_ENDPOINTS[stored]) {
        return stored;
      }
    } catch {
      // ignore storage access errors
    }

    const host = window.location.hostname;
    if (!host || host === "localhost" || host === "127.0.0.1") {
      return "dev";
    }
    if (host.endsWith("github.io")) {
      return "prod";
    }
    return "prod";
  }

  const env = detectEnv();
  window.BUDGIFY_ENV = env;
  window.BUDGIFY_API_BASE = API_ENDPOINTS[env];
})();
