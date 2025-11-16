/* customActivity-v3.js
 * Send WhatsApp (Salesforce) - Journey Builder Custom Activity
 */

'use strict';

// Endpoint FINAL no Salesforce
var EXECUTE_URL = 'https://consorcioservopa.my.salesforce.com/services/apexrest/wa/send';

var connection = new Postmonger.Session();
var activityData = {};

console.log('🚀 WhatsApp Custom Activity V3 carregada');

$(window).ready(function () {
    console.log('🟢 Window ready, enviando "ready" para o Journey Builder...');
    connection.trigger('ready');
});

connection.on('initActivity', onInit);
connection.on('requestedSchema', onRequestedSchema);
connection.on('clickedNext', onSave);

function onInit(payload) {
    console.log('🔥 initActivity recebido:', payload);
    activityData = payload || {};

    if (activityData.arguments && activityData.arguments.execute) {
        console.log('🌍 execute.url atual (antes do save):', activityData.arguments.execute.url);
    }

    try {
        if (activityData.arguments &&
            activityData.arguments.execute &&
            activityData.arguments.execute.inArguments &&
            activityData.arguments.execute.inArguments.length > 0) {

            var args = activityData.arguments.execute.inArguments[0];
            console.log('🧩 inArguments atuais:', args);

            if (args.to) {
                var toVal = args.to;
                if (typeof toVal === 'string' &&
                    toVal.indexOf('{{') === 0 &&
                    toVal.lastIndexOf('}}') === toVal.length - 2) {

                    var key = toVal.substring(2, toVal.length - 2);
                    $('#phoneField').data('selectedKey', key);
                }
            }

            $('#templateName').val(args.templateName || '');
            $('#langCode').val(args.languageCode || 'en_US');
            $('#var1').val(args.var1 || '');
            $('#var2').val(args.var2 || '');
        }
    } catch (e) {
        console.error('Erro ao ler inArguments:', e);
    }

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
        var key = field.key;
        var name = field.name || key;

        phoneSelect.append(
            '<option value="' + key + '">' + name + '</option>'
        );
    });

    var selectedKey = phoneSelect.data('selectedKey');
    if (selectedKey) {
        phoneSelect.val(selectedKey);
    }
}

function onSave() {
    console.log('💾 Salvando configuração da activity...');

    var phoneKey   = $('#phoneField').val();
    var template   = $('#templateName').val();
    var langCode   = $('#langCode').val() || 'en_US';  // default inglês
    var var1       = $('#var1').val();
    var var2       = $('#var2').val();

    if (!phoneKey || !template) {
        alert('Preencha os campos obrigatórios: Telefone e Template.');
        return;
    }

    // Ex: {{Event.DEAudience-xxx.PhoneNumber}}
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

    // força sempre o endpoint do Apex
    activityData.arguments.execute.url = EXECUTE_URL;

    activityData.metaData = activityData.metaData || {};
    activityData.metaData.isConfigured = true;

    console.log('🌍 execute.url que será salva:', activityData.arguments.execute.url);
    console.log('📤 updateActivity payload:', activityData);

    connection.trigger('updateActivity', activityData);
}
