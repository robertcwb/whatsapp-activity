/* customActivity.js
 * Send WhatsApp (Salesforce) - Journey Builder Custom Activity
 */

'use strict';

var connection = new Postmonger.Session();
var activityData = {};

console.log('🚀 WhatsApp Custom Activity carregada');

// ==== AVISA O JOURNEY BUILDER QUE A ACTIVITY ESTÁ PRONTA ====
$(window).ready(function () {
    console.log('🟢 Window ready, enviando "ready" para o Journey Builder...');
    connection.trigger('ready');
});

// ==== EVENTOS REGISTRADOS ====
connection.on('initActivity', onInit);
connection.on('requestedSchema', onRequestedSchema);
connection.on('clickedNext', onSave);

// ==== HANDLERS ====

function onInit(payload) {
    console.log('🔥 initActivity recebido:', payload);
    activityData = payload || {};

    // Log da URL de execute pra garantir que é n8n ou Salesforce
    if (activityData.arguments && activityData.arguments.execute) {
        console.log('🌍 execute.url atual:', activityData.arguments.execute.url);
    }

    // Recupera inArguments se já existirem
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
                    $('#phoneField').data('selectedKey', key);
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

    // Depois do init, pede o schema dos campos
    console.log('📬 Solicitando schema ao Journey Builder...');
    connection.trigger('requestSchema');
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

    // Se tinha um campo salvo anteriormente, seleciona
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

    // Monta token: {{Contact.Attribute.DE.PhoneNumber}}
    var toToken = '{{' + phoneKey + '}}';

    var inArgs = [{
        to: toToken,
        templateName: template,
        languageCode: langCode,
        var1: var1,
        var2: var2
    }];

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
