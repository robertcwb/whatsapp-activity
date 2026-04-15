define([], function () {
    return {
        workflowApiVersion: "1.1",
        metaData: {
            icon: "https://www.flaticon.com/free-icon/apple_16566057?term=message&page=1&position=11&origin=search&related_id=16566057",
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
