const FlowAPI = {
  async request(payload) {
    if (!CONFIG.apiUrl) {
      throw new Error("https://script.google.com/macros/s/AKfycbzA7up-uF8XeqWmVYfgYCOARqVeG1axNkD3D33OzOBApa4F9BUEgclzSEPtfe8bAnDC/exec");
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
