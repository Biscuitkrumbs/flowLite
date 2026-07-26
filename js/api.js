const FlowAPI = {
  async parseResponse(response) {
    if (!response.ok) throw new Error(`Flow API returned ${response.status}.`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Flow API request failed.");
    return result;
  },

  async getData() {
    if (!CONFIG.apiUrl) throw new Error("Flow API URL is not configured.");
    const url = new URL(CONFIG.apiUrl);
    url.searchParams.set("action", "getData");
    url.searchParams.set("_", Date.now());

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });

    return (await this.parseResponse(response)).data;
  },

  async saveData(data) {
    if (!CONFIG.apiUrl) throw new Error("Flow API URL is not configured.");

    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "saveData", data }),
      cache: "no-store",
      redirect: "follow"
    });

    return (await this.parseResponse(response)).data;
  }
};
