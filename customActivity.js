/* customActivity.js
 * Send WhatsApp (Salesforce) - Journey Builder Custom Activity
 */

'use strict';

var connection = new Postmonger.Session();
var activityData = {};

console.log('🚀 WhatsApp Custom Activity carregada');

// ========== EVENTS REGISTRADOS ==========

// Quando a activity é inicializada
connection.on('initActivity', onInit);

// Quando o Journey Builder envia o schema dos campos
connection.on('requestedSchema', onRequestedSchema);

// Quando o usuário clica em Next/Done no modal
connection.on('clickedNext', onSave);

// Quando estiver pronto
connection.on('ready', function () {
    console.log('✅ Postmonger ready, solicitando schema...');
    connection.trigger('requestSchema');
});

// ========== HANDLERS ==========

function onInit(payload) {
    console.log('🔥 initActivity recebido:', payload);
    activityData = payload || {};

    // Recupera valores se a activity já estiver configurada
    try {
        if (activityData.arguments &&
            activityData.arguments.execute &&
            activityData.arguments.execute.inArguments &&
            activityData.arguments.execute.inArguments.length > 0) {

            var args = activityData.arguments.execute.inArguments[0];
            console.log('🧩 inArguments atuais:', args);

            // to: "{{Contact.Attribute.DE.PhoneNumber}}"
            if (args.to) {
                var toVal = args.to;
                if (typeof toVal === 'string' &&
                    toVal.indexOf('{{') === 0 &&
                    toVal.lastIndexOf('}}') === toVal.length - 2) {
                    // remove {{ }}
                    var key = toVal.substring(2, toVal.length - 2);
                    $('#phoneField').data('selectedKey', key); // guarda até o schema chegar
                }
            }

            $('#templateName').val(args.templateName || '');
            $('#langCode').val(args.languageCode || 'pt_BR');
            $('#var1').val(args.var1 || '');
            $('#var2').val(args.var2 || '');
        }
    } catch (e) {
        console.error('Erro ao ler inArguments:', e);
    }
}

function onRequestedSchema(schema) {
    console.log('📦 Schema recebido:', schema);

    var phoneSelect = $('#phoneField');
    phoneSelect.empty();

    if (!schema || !schema.schema || !schema.schema.length) {
        phoneSelect.append('<option value="">Nenhum campo disponível</option>');
        return;
    }

    phoneSelect.append('<option value="">Selecione...</option>');

    schema.schema.forEach(function (field) {
        // field.key vem no formato Contact.Attribute.DE.Campo
        var key = field.key;
        var name = field.name || key;

        phoneSelect.append(
            '<option value="' + key + '">' + name + '</option>'
        );
    });

    // Se já tínhamos um key salvo (quando reabre a activity), seleciona ele
    var selectedKey = phoneSelect.data('selectedKey');
    if (selectedKey) {
        phoneSelect.val(selectedKey);
    }
}

function onSave() {
    console.log('💾 Salvando configuração da activity...');

    var phoneKey   = $('#phoneField').val();   // ex: Contact.Attribute.DE.PhoneNumber
    var template   = $('#templateName').val();
    var langCode   = $('#langCode').val();
    var var1       = $('#var1').val();
    var var2       = $('#var2').val();

    if (!phoneKey || !template) {
        alert('Preencha os campos obrigatórios: Telefone e Template.');
        return;
    }

    // Monta o token MC: {{Contact.Attribute.DE.PhoneNumber}}
    var toToken = '{{' + phoneKey + '}}';

    var inArgs = [{
        to: toToken,
        templateName: template,
        languageCode: langCode,
        var1: var1,
        var2: var2
    }];

    // Garante estrutura
    if (!activityData.arguments) {
        activityData.arguments = {};
    }
    if (!activityData.arguments.execute) {
        activityData.arguments.execute = {};
    }

    activityData.arguments.execute.inArguments = inArgs;
    activityData.metaData = activityData.metaData || {};
    activityData.metaData.isConfigured = true;

    console.log('📤 updateActivity payload:', activityData);

    connection.trigger('updateActivity', activityData);
}
