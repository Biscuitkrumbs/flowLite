const FlowAPI = {

    async post(data) {

        const response = await fetch(CONFIG.apiUrl, {
            method: "POST",
            body: JSON.stringify(data)
        });

        return await response.json();
    },

    async createCage(cage) {

        return await this.post({
            action: "createCage",
            ...cage
        });

    }

};