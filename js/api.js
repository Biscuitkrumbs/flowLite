const FlowAPI = {
  async request(operation) {
    if (!CONFIG.apiUrl) throw new Error("Flow API URL is not configured.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
    const url = new URL(CONFIG.apiUrl);
    url.searchParams.set("action", "getData");
    url.searchParams.set("_", Date.now());

    const response = await fetch(operation ? CONFIG.apiUrl : url.toString(), operation ? {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "applyAction", operation }), signal: controller.signal,
      cache: "no-store", redirect: "follow"
    } : {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
      , signal: controller.signal
    });
    if (!response.ok) throw new Error(`Flow API returned ${response.status}.`);
    const result = await response.json();
    if (!result.ok || result.apiVersion !== 2) {
      const error = new Error(result.ok ? "Shared saving needs the Flow backend update. No device changes have been uploaded." : result.error || "This action could not be saved.");
      error.code = result.ok ? "UPGRADE_REQUIRED" : result.code;
      throw error;
    }
    return result;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Connection timed out. Pending changes are kept on this phone.");
      throw error;
    } finally { clearTimeout(timeout); }
  },
  getData() { return this.request(); },
  applyAction(operation) { return this.request(operation); }
};
