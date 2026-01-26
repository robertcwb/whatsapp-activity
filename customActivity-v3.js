/* customActivity-v4.js
 * Send WhatsApp (Salesforce) - Journey Builder Custom Activity
 * Totalmente Dinâmico: Puxa templates da Base e gera Mapeamento sob demanda.
 */
'use strict';

var EXECUTE_URL = 'https://consorcioservopa.my.site.com/servopamcwebhook/services/apexrest/wa/send';
var connection = new Postmonger.Session();
var activityData = {};
var DE_SCHEMA = [];
var AVAILABLE_TEMPLATES = [];

console.log('🚀 WhatsApp Custom Activity V7 (Dynamic) carregada');

$(window).ready(function () {
    connection.trigger('ready');
    
    // Listeners da UI
    $('#phone_id').on('change', fetchTemplates);
    $('#templateSelect').on('change', onTemplateChanged);
});

connection.on('initActivity', onInit);
connection.on('requestedSchema', onRequestedSchema);
connection.on('clickedNext', onSave);

function onInit(payload) {
    activityData = payload || {};
    var args = {};
    
    try {
        if (activityData.arguments && activityData.arguments.execute && activityData.arguments.execute.inArguments && activityData.arguments.execute.inArguments.length > 0) {
            args = activityData.arguments.execute.inArguments[0];
            
            // Backup dos valores salvos para restauração posterior
            $('#imageUrl').val(args.imageUrl || '');
            $('#phone_id').val(args.phone_id || '');
            $('#langCode').val(args.languageCode || 'pt_BR');
            
            // Atribui dados salvos para o telefone
            if (args.to) {
                var key = args.to.replace('{{', '').replace('}}', '');
                $('#phoneField').data('savedKey', key);
            }

            // Salva o template selecionado para restaurar após o fetch
            if (args.templateName) {
                $('#templateSelect').data('savedTemplate', args.templateName);
                $('#templateSelect').data('savedVars', args); 
            }
        }
    } catch (e) {
        console.error('Erro no onInit:', e);
    }

    fetchTemplates();
    connection.trigger('requestSchema');
}

function fetchTemplates() {
    var phoneId = $('#phone_id').val();
    var $select = $('#templateSelect');
    $select.empty().append('<option value="">Carregando templates...</option>');

    $.ajax({
        url: EXECUTE_URL + '?phone_id=' + phoneId,
        method: 'GET',
        success: function(data) {
            console.log('✅ Templates carregados:', data);
            AVAILABLE_TEMPLATES = [];
            
            try {
                // Se o retorno do Apex for uma string JSON, a gente parseia
                var templatesRaw = (typeof data === 'string') ? JSON.parse(data) : data;
                
                // Formato Meta Grafo: business_account.message_templates.data
                if (templatesRaw.business_account) {
                    var ba = templatesRaw.business_account;
                    if (ba.message_templates) {
                        AVAILABLE_TEMPLATES = ba.message_templates.data || ba.message_templates;
                    }
                } 
                // Se o Apex retornar direto { data: [...] }
                else if (templatesRaw.data && Array.isArray(templatesRaw.data)) {
                    AVAILABLE_TEMPLATES = templatesRaw.data;
                }
                // Se for um array direto
                else if (Array.isArray(templatesRaw)) {
                    AVAILABLE_TEMPLATES = templatesRaw;
                }

                if (!AVAILABLE_TEMPLATES || AVAILABLE_TEMPLATES.length === 0) {
                     console.warn('⚠️ Nenhum template encontrado no array detectado.');
                     $select.empty().append('<option value="">Nenhum template encontrado</option>');
                     return;
                }

                $select.empty().append('<option value="">Selecione um Modelo...</option>');
                AVAILABLE_TEMPLATES.forEach(function(t) {
                    // Mostra todos, mas avisa se não estiver aprovado
                    var label = t.name;
                    if (t.status && t.status !== 'APPROVED' && t.status !== 'approved') {
                        label += ' (' + t.status + ')';
                    }
                    $select.append('<option value="' + t.name + '">' + label + '</option>');
                });

                // Restaura seleção anterior se houver
                var saved = $select.data('savedTemplate');
                if (saved) {
                    $select.val(saved);
                    onTemplateChanged();
                }
            } catch(e) {
                $select.empty().append('<option value="">Erro ao processar templates</option>');
            }
        },
        error: function() {
            $select.empty().append('<option value="">Erro ao buscar templates (CORS ou Auth)</option>');
        }
    });
}

function onTemplateChanged() {
    var tName = $('#templateSelect').val();
    $('#templateName').val(tName);
    
    var template = AVAILABLE_TEMPLATES.find(function(t) { return t.name === tName; });
    var $preview = $('#templatePreview');
    var $container = $('#variablesContainer');
    var $fields = $('#dynamicFields');

    if (!template) {
        $preview.hide();
        $container.hide();
        return;
    }

    // 1. Acha o Corpo (BODY) do template
    var bodyText = '';
    console.log('🔍 Analisando template:', template);

    if (template.components && Array.isArray(template.components)) {
        var bodyComp = template.components.find(function(c) { 
            return c.type === 'BODY' || c.type === 'body'; 
        });
        if (bodyComp) bodyText = bodyComp.text || '';
    } 
    
    if (!bodyText && (template.body || template.text)) {
         bodyText = template.body || template.text;
    }
    
    console.log('📝 Texto detectado:', bodyText);
    $('#previewBody').text(bodyText || '(Template sem corpo de texto)');
    $preview.show();

    // 2. Detecta variáveis {{n}}
    var regex = /{{(\d+)}}/g;
    var matches = [];
    var m;
    while ((m = regex.exec(bodyText)) !== null) {
        if (matches.indexOf(m[1]) === -1) matches.push(m[1]);
    }
    matches.sort(); // Garante ordem 1, 2, 3...

    // 3. Renderiza selects para cada variável
    $fields.empty();
    if (matches.length > 0) {
        matches.forEach(function(num) {
            var label = 'Variável {{' + num + '}}';
            var id = 'var_' + num;
            
            var html = '<div class="field-row">' +
                       '<label for="' + id + '">' + label + '</label>' +
                       '<select id="' + id + '" class="dynamic-var-select"></select>' +
                       '</div>';
            
            $fields.append(html);
            populateFields('#' + id);
            
            // Restaura valor se houver nos dados salvos
            var savedVars = $('#templateSelect').data('savedVars');
            if (savedVars && savedVars['var' + num]) {
                var key = savedVars['var' + num].replace('{{', '').replace('}}', '');
                $('#' + id).val(key);
            }
        });
        $container.show();
    } else {
        $container.hide();
    }
}

function onRequestedSchema(schema) {
    console.log('📦 Schema recebido:', schema);
    DE_SCHEMA = schema.schema || [];
    populateFields('#phoneField');
}

function populateFields(selectId) {
    var $select = $(selectId);
    $select.empty().append('<option value="">Selecione um campo da Base...</option>');
    
    DE_SCHEMA.forEach(function (field) {
        $select.append('<option value="' + field.key + '">' + (field.name || field.key) + '</option>');
    });

    var saved = $select.data('savedKey');
    if (saved) $select.val(saved);
}

function onSave() {
    var template = $('#templateSelect').val();
    var phoneField = $('#phoneField').val();
    
    if (!template || !phoneField) {
        alert('Obrigatório: Selecionar Telefone e Template.');
        return;
    }

    var inArguments = {
        templateName: template,
        phone_id: $('#phone_id').val() || null,
        languageCode: $('#langCode').val() || 'pt_BR',
        imageUrl: $('#imageUrl').val(),
        apiKey: '7a8e3bd0f4514d0e8a6bb31c41a79c32',
        to: '{{' + phoneField + '}}'
    };

    // Coleta variáveis dinâmicas
    $('.dynamic-var-select').each(function() {
        var id = $(this).attr('id'); // var_1
        var num = id.split('_')[1];  // 1
        var val = $(this).val();
        if (val) {
            inArguments['var' + num] = '{{' + val + '}}';
        }
    });

    if (!activityData.arguments) activityData.arguments = {};
    if (!activityData.arguments.execute) activityData.arguments.execute = {};
    
    activityData.arguments.execute.inArguments = [inArguments];
    activityData.arguments.execute.url = EXECUTE_URL;
    activityData.metaData = activityData.metaData || {};
    activityData.metaData.isConfigured = true;

    connection.trigger('updateActivity', activityData);
}
