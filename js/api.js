const FlowAPI = {

    async post(data) {

        const response = await fetch(CONFIG.apiUrl, {
            method: "POST",
            body: JSON.stringify(data)
        });

        return await response.json();
    },

    async openCage(request) {
        return await this.post({
            action: "openCage",
            ...request
        });
    }

};