define([], function () {
    return {
        workflowApiVersion: "1.1",
        metaData: {
            icon: "images/icon.png",
            category: "message"
        },
        type: "REST",
        userInterfaces: {
            configModal: {
                height: 800,
                width: 1000,
                fullscreen: false
            }
        },
        lang: {
            "en": {
                name: "Send WhatsApp (Salesforce)"
            },
            "pt-BR": {
                name: "Enviar WhatsApp (Salesforce)"
            }
        }
    };
});
