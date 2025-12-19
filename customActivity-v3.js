/* customActivity-v4.js
 * Send WhatsApp (Salesforce) - Journey Builder Custom Activity
 * Atualizado para Mapeamento de Campos Dinâmicos (C6)
 */
'use strict';
var EXECUTE_URL = 'https://consorcioservopa.my.site.com/servopamcwebhook/services/apexrest/wa/send';
var connection = new Postmonger.Session();
var activityData = {};
console.log('🚀 WhatsApp Custom Activity V4 (C6 Mapping) carregada');
$(window).ready(function () {
    console.log('🟢 Window ready, enviando "ready"...');
    connection.trigger('ready');
});
connection.on('initActivity', onInit);
connection.on('requestedSchema', onRequestedSchema);
connection.on('clickedNext', onSave);
function onInit(payload) {
    console.log('🔥 initActivity recebido:', payload);
    activityData = payload || {};
    try {
        if (activityData.arguments &&
            activityData.arguments.execute &&
            activityData.arguments.execute.inArguments &&
            activityData.arguments.execute.inArguments.length > 0) {
            var args = activityData.arguments.execute.inArguments[0];
            console.log('🧩 inArguments atuais:', args);
            // --- 1. Mapeamento de Telefone ---
            restoreMapping('#phoneField', args.to);
            // --- 2. Mapeamento de Campos C6 ---
            restoreMapping('#nomeClienteField', args.nome_cliente);
            restoreMapping('#nomeAtendenteField', args.nome_atendente);
            restoreMapping('#pixField', args.codigo_pix);
            restoreMapping('#vencimentoField', args.data_vencimento);
            restoreMapping('#pagamentoField', args.metodo_pagamento);
            restoreMapping('#contratoField', args.link_contrato);
            // --- 3. Campos Estáticos ---
            $('#templateName').val(args.templateName || '');
            $('#langCode').val(args.languageCode || 'en');
            if (args.imageUrl) $('#imageUrl').val(args.imageUrl);
            if (args.phone_id) $('#phone_id').val(args.phone_id);
        }
    } catch (e) {
        console.error('Erro ao ler inArguments:', e);
    }
    console.log('📬 Solicitando schema...');
    connection.trigger('requestSchema');
}
// Função auxiliar para recuperar o valor {{Key}} e setar no dropdown
function restoreMapping(selectId, value) {
    if (value && typeof value === 'string' &&
        value.indexOf('{{') === 0 &&
        value.lastIndexOf('}}') === value.length - 2) {
        
        var key = value.substring(2, value.length - 2);
        $(selectId).data('selectedKey', key);
    }
}
function onRequestedSchema(schema) {
    console.log('📦 Schema recebido:', schema);
    // Lista de todos os dropdowns que precisam ser populados com campos da DE
    var dropdowns = [
        '#phoneField', 
        '#nomeClienteField', 
        '#nomeAtendenteField', 
        '#pixField', 
        '#vencimentoField', 
        '#pagamentoField', 
        '#contratoField'
    ];
    if (!schema || !schema.schema || !schema.schema.length) {
        dropdowns.forEach(function(id) {
            $(id).empty().append('<option value="">Nenhum campo disponível</option>');
        });
        return;
    }
    // Popula todos os selects
    dropdowns.forEach(function(id) {
        var $select = $(id);
        $select.empty();
        $select.append('<option value="">Selecione um campo (ou deixe vazio)...</option>');
        schema.schema.forEach(function (field) {
            var key = field.key;
            var name = field.name || key;
            // Dica: Adicionamos o "key" como value
            $select.append('<option value="' + key + '">' + name + '</option>');
        });
        // Restaura seleção salva (se houver)
        var savedKey = $select.data('selectedKey');
        if (savedKey) {
            $select.val(savedKey);
        }
    });
}
function onSave() {
    console.log('💾 Salvando configuração...');
    var template = $('#templateName').val();
    var phoneId  = $('#phone_id').val();
    var langCode = $('#langCode').val() || 'en';
    var imageUrl = $('#imageUrl').val();
    // Validação básica
    if (!$('#phoneField').val() || !template) {
        alert('Obrigatório: Campo de Telefone e Nome do Template.');
        return;
    }
    // --- Monta objeto inArguments ---
    var inArgBase = {
        templateName: template,
        languageCode: langCode,
        apiKey: '7a8e3bd0f4514d0e8a6bb31c41a79c32', 
        phone_id: phoneId || null
    };
    // 1. Telefone (Obrigatório)
    inArgBase.to = '{{' + $('#phoneField').val() + '}}';
    // 2. Opcionais C6 (Se selecionado, adiciona {{Key}})
    addMapping(inArgBase, 'nome_cliente', '#nomeClienteField');
    addMapping(inArgBase, 'nome_atendente', '#nomeAtendenteField');
    addMapping(inArgBase, 'codigo_pix', '#pixField');
    addMapping(inArgBase, 'data_vencimento', '#vencimentoField');
    addMapping(inArgBase, 'metodo_pagamento', '#pagamentoField');
    addMapping(inArgBase, 'link_contrato', '#contratoField');
    // 3. Imagem
    if (imageUrl && imageUrl.trim() !== '') {
        inArgBase.imageUrl = imageUrl.trim();
    }
    var inArgs = [ inArgBase ];
    if (!activityData.arguments) activityData.arguments = {};
    if (!activityData.arguments.execute) activityData.arguments.execute = {};
    activityData.arguments.execute.inArguments = inArgs;
    activityData.arguments.execute.url = EXECUTE_URL;
    activityData.metaData.isConfigured = true;
    console.log('📤 Payload final:', activityData);
    connection.trigger('updateActivity', activityData);
}
// Helper para adicionar ao inArguments apenas se houver valor selecionado
function addMapping(targetObj, jsonKey, selectId) {
    var val = $(selectId).val();
    if (val && val !== '') {
        targetObj[jsonKey] = '{{' + val + '}}';
    }
}
