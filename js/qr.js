const FlowQR = {
    parse(payload) {
        const value = String(payload || "").trim();

        const pattern = /^FLOW\|CAGE\|(\d{3})\|V1$/;
        const match = value.match(pattern);

        if (!match) {
            return {
                valid: false,
                error: "This is not a recognised Flow cage."
            };
        }

        return {
            valid: true,
            type: "CAGE",
            cageId: match[1],
            version: 1,
            payload: value
        };
    }
};