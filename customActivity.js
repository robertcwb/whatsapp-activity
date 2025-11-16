// customActivity.js
;(function (window) {
    'use strict';

    console.log('📦 customActivity.js carregado');

    var connection = new Postmonger.Session();
    var payload = {};
    var eventDefinitionKey = null;

    // Expor para debug no console
    window._whatsappActivity = {
        connection: connection,
        getPayload: function () { return payload; }
    };

    // ==== Eventos básicos do Journey Builder ====
    connection.on('initActivity', initialize);
    connection.on('requestedTokens', onTokens);
    connection.on('requestedEndpoints', onEndpoints);
    connection.on('requestedSchema', onSchema);
    connection.on('clickedNext', save);
    connection.on('clickedDone', save);

    // ==== Quando DOM estiver pronto, dispara READY ====
    document.addEventListener('DOMContentLoaded', function () {
        console.log('🌐 DOM pronto, disparando ready/request*');

        connection.trigger('ready');              // tira overlay / spinner principal
        connection.trigger('requestTokens');      // opcional, mas bom ter
        connection.trigger('requestEndpoints');   // opcional
        connection.trigger('requestSchema');      // necessário p/ popular campos DE
    });

    // ===================== INIT =====================
    function initialize(data) {
        console.log('🟢 initActivity recebido:', JSON.stringify(data || {}, null, 2));

        if (data) {
            payload = data;
        }

        // EventDefinitionKey (às vezes vem em data)
        try {
            var hasConfig = payload && payload.arguments && payload.arguments.execute;
            if (hasConfig && payload.arguments.execute) {
                eventDefinitionKey = payload.arguments.execute.eventDefinitionKey;
            } else if (payload.metaData && payload.metaData.eventDefinitionKey) {
                eventDefinitionKey = payload.metaData.eventDefinitionKey;
            }
        } catch (e) {
            console.warn('Não foi possível ler eventDefinitionKey:', e);
        }

        console.log('📌 eventDefinitionKey:', eventDefinitionKey);

        // Se já estava configurada, recuperar inArguments para preencher a tela
        try {
            var inArgs = (payload.arguments &&
                          payload.arguments.execute &&
                          payload.arguments.execute.inArguments) || [];

            var config = inArgs[0] || {};
            console.log('🔁 inArguments atuais:', JSON.stringify(config, null, 2));

            if (config.phoneField) {
                document.getElementById('phoneField').value = config.phoneField;
            }
            if (config.templateName) {
                document.getElementById('templateName').value = config.templateName;
            }
            if (config.languageCode) {
                document.getElementById('languageCode').value = config.languageCode;
            }
            if (config.var1Field) {
                document.getElementById('var1Field').value = config.var1Field;
            }
        } catch (e) {
            console.warn('Erro ao restaurar config da activity:', e);
        }
    }

    // ===================== TOKENS / ENDPOINTS =====================
    function onTokens(tokens) {
        console.log('🔑 Tokens recebidos:', tokens);
    }

    function onEndpoints(endpoints) {
        console.log('🌍 Endpoints recebidos:', endpoints);
    }

    // ===================== SCHEMA (campos da DE) =====================
    function onSchema(schema) {
        console.log('📄 Schema recebido:', JSON.stringify(schema || {}, null, 2));

        // Aqui você popula os selects com os campos da DE
        // Vou assumir que você tem selects com esses IDs:
        //   phoneField, var1Field
        var phoneSelect = document.getElementById('phoneField');
        var var1Select = document.getElementById('var1Field');

        if (!schema || !schema.schema) {
            console.warn('Schema vazio, não há campos para popular');
            return;
        }

        // Limpa e adiciona opção padrão
        function resetSelect(select, placeholder) {
            if (!select) return;
            while (select.firstChild) {
                select.removeChild(select.firstChild);
            }
            var opt = document.createElement('option');
            opt.value = '';
            opt.textContent = placeholder;
            select.appendChild(opt);
        }

        resetSelect(phoneSelect, 'Selecione o campo de telefone');
        resetSelect(var1Select, 'Selecione o campo da variável 1');

        schema.schema.forEach(function (entry) {
            var key = entry.key;   // normalmente: "Event.DEName.FieldName"

            if (phoneSelect) {
                var o1 = document.createElement('option');
                o1.value = key;
                o1.textContent = key;
                phoneSelect.appendChild(o1);
            }

            if (var1Select) {
                var o2 = document.createElement('option');
                o2.value = key;
                o2.textContent = key;
                var1Select.appendChild(o2);
            }
        });

        console.log('✅ Selects populados com campos da DE');
    }

    // ===================== SALVAR (Done/Next) =====================
    function save() {
        console.log('💾 Salvando configuração da activity...');

        // Garante estrutura mínima
        payload.arguments = payload.arguments || {};
        payload.arguments.execute = payload.arguments.execute || {};
        payload.arguments.execute.inArguments = payload.arguments.execute.inArguments || [{}];
        payload.metaData = payload.metaData || {};

        var inArgs = payload.arguments.execute.inArguments[0];

        // Lê valores da tela
        var phoneField    = (document.getElementById('phoneField')    || {}).value || '';
        var templateName  = (document.getElementById('templateName')  || {}).value || '';
        var languageCode  = (document.getElementById('languageCode')  || {}).value || '';
        var var1Field     = (document.getElementById('var1Field')     || {}).value || '';

        // Valida minimamente
        if (!phoneField || !templateName || !languageCode) {
            alert('Preencha: Campo de Telefone, Nome do Template e Código do Idioma.');
            console.warn('❌ Campos obrigatórios faltando');
            return;
        }

        // Monta inArguments
        inArgs.phoneField   = phoneField;
        inArgs.templateName = templateName;
        inArgs.languageCode = languageCode;
        inArgs.var1Field    = var1Field;

        // Flag dizendo que a activity está configurada
        payload.metaData.isConfigured = true;

        console.log('📤 Enviando updateActivity com payload:', JSON.stringify(payload, null, 2));
        connection.trigger('updateActivity', payload);
    }

})(window);
