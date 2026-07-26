const FlowAPI = {
  async request(payload) {
    if (!CONFIG.apiUrl) {
      throw new Error("Flow API URL is not configured.");
    }

    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`Flow API returned ${response.status}.`);
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || "Flow API request failed.");
    }

    return result;
  },

  async getData() {
    const result = await this.request({ action: "getData" });
    return result.data;
  },

  async saveData(data) {
    const result = await this.request({ action: "saveData", data });
    return result.data;
  }
};
