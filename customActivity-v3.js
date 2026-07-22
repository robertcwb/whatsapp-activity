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

function togglePaymentFields() {
    var type = $('#paymentType').val();
    if (type === 'boleto') {
        $('#boletoFields').show();
        $('#pixFields').hide();
    } else {
        $('#boletoFields').hide();
        $('#pixFields').show();
    }
}

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
            if (args.bot_active) {
                var key = args.bot_active.replace('{{', '').replace('}}', '');
                $('#botActiveField').data('savedKey', key);
            }
            
            // Atribui dados salvos para o telefone
            if (args.to) {
                var key = args.to.replace('{{', '').replace('}}', '');
                $('#phoneField').data('savedKey', key);
            }

            // PIX Restore
            if (args.pixKey) {
                 var key = args.pixKey.replace('{{', '').replace('}}', '');
                 $('#pixKeyField').data('savedKey', key);
            }
            if (args.pixAmount) {
                 var val = args.pixAmount.replace('{{', '').replace('}}', '');
                 $('#pixAmountField').data('savedKey', val);
            }
             if (args.pixItem) {
                 var val = args.pixItem.replace('{{', '').replace('}}', '');
                 $('#pixItemField').data('savedKey', val);
            }

            // Payment Type & Boleto Restore
            if (args.paymentType) {
                $('#paymentType').val(args.paymentType).change();
            }
            if (args.boletoLine) {
                 var val = args.boletoLine.replace('{{', '').replace('}}', '');
                 $('#boletoLineField').data('savedKey', val);
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

    // 1. Renderiza Prévia do Texto e acha variáveis do Corpo
    var components = template.components || [];
    var bodyComp = components.find(function(c) { return c.type === 'BODY' || c.type === 'body'; });
    var headerComp = components.find(function(c) { return c.type === 'HEADER' || c.type === 'header'; });
    var buttonsComp = components.find(function(c) { return c.type === 'BUTTONS' || c.type === 'buttons'; });

    var bodyText = bodyComp ? (bodyComp.text || '') : '';
    if (!bodyText && (template.body || template.text)) bodyText = template.body || template.text;
    
    // Check for carousel component to update preview and generate fields
    var carouselComp = components.find(function(c) { return c.type === 'CAROUSEL' || c.type === 'carousel'; });
    if (carouselComp && carouselComp.cards) {
        var cardsText = '[CARROSSEL: ' + carouselComp.cards.length + ' Cards]';
        var cardDetails = [];
        carouselComp.cards.forEach(function(card, idx) {
            var cardComps = card.components || [];
            var header = cardComps.find(function(comp) { return comp.type === 'HEADER' || comp.type === 'header'; });
            var buttons = cardComps.find(function(comp) { return comp.type === 'BUTTONS' || comp.type === 'buttons'; });
            var detail = '   • Card ' + (idx + 1) + ':';
            if (header) {
                detail += ' [' + header.format + ']';
            }
            if (buttons && buttons.buttons) {
                var btnLabels = buttons.buttons.map(function(b) { return b.text; }).join(' | ');
                detail += ' - Botões: (' + btnLabels + ')';
            }
            cardDetails.push(detail);
        });
        bodyText = cardsText + '\n' + cardDetails.join('\n') + '\n\n' + bodyText;
    }

    $('#previewBody').text(bodyText || '(Template sem corpo de texto)');
    $preview.show();
    $fields.empty();

    var hasVars = false;

    // 2. HEADER Vars
    if (headerComp && headerComp.format === 'TEXT' && headerComp.text) {
        var hRegex = /{{(\d+)}}/g;
        var hMatch;
        var hVars = [];
        while ((hMatch = hRegex.exec(headerComp.text)) !== null) {
            if (hVars.indexOf(hMatch[1]) === -1) hVars.push(hMatch[1]);
        }
        hVars.sort().forEach(function(num) {
            hasVars = true;
            renderVarField('Variável {{' + num + '}} (Cabeçalho)', 'headerVar_' + num);
        });
    }

    // 3. BODY Vars
    var bRegex = /{{(\d+)}}/g;
    var bMatch;
    var bVars = [];
    while ((bMatch = bRegex.exec(bodyText)) !== null) {
        if (bVars.indexOf(bMatch[1]) === -1) bVars.push(bMatch[1]);
    }
    bVars.sort().forEach(function(num) {
        hasVars = true;
        renderVarField('Variável {{' + num + '}}', 'var_' + num);
    });

    // 4. BUTTON Vars
    if (buttonsComp && buttonsComp.buttons) {
        buttonsComp.buttons.forEach(function(btn, index) {
            var btnType = (btn.type || '').toUpperCase();
            
            if (btnType === 'URL' && btn.url && btn.url.indexOf('{{1}}') !== -1) {
                hasVars = true;
                renderVarField('Variável de URL (Botão ' + (index + 1) + ')', 'btnVar_' + index);
            } else if (btnType === 'COPY_CODE') {
                hasVars = true;
                renderVarField('Código do Botão (Botão ' + (index + 1) + ')', 'btnVar_' + index);
            }
        });
    }

    // 5. CAROUSEL Vars & Images
    if (carouselComp && carouselComp.cards) {
        carouselComp.cards.forEach(function(card, cardIdx) {
            var cardComps = card.components || [];
            
            // Header Image/Video/Document
            var cardHeader = cardComps.find(function(c) { return c.type === 'HEADER' || c.type === 'header'; });
            if (cardHeader && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(cardHeader.format)) {
                hasVars = true;
                
                // Get default URL from example if available
                var defaultUrl = '';
                if (cardHeader.example && cardHeader.example.header_handle && cardHeader.example.header_handle.length > 0) {
                    defaultUrl = cardHeader.example.header_handle[0];
                }
                
                renderCarouselImageField('Card ' + (cardIdx + 1) + ' - URL da Imagem', 'carouselCard' + cardIdx + 'headerUrl', defaultUrl);
            }
            
            // Body variables
            var cardBody = cardComps.find(function(c) { return c.type === 'BODY' || c.type === 'body'; });
            if (cardBody && cardBody.text) {
                var cRegex = /{{(\d+)}}/g;
                var cMatch;
                var cVars = [];
                while ((cMatch = cRegex.exec(cardBody.text)) !== null) {
                    if (cVars.indexOf(cMatch[1]) === -1) cVars.push(cMatch[1]);
                }
                cVars.sort().forEach(function(num) {
                    hasVars = true;
                    renderVarField('Card ' + (cardIdx + 1) + ' - Variável {{' + num + '}}', 'carouselCard' + cardIdx + 'var' + num);
                });
            }
        });
    }

    if (hasVars) {
        $container.show();
    } else {
        $container.hide();
    }

    function renderVarField(label, id) {
        var html = '<div class="field-row" style="margin-top: 10px;">' +
                   '<label for="' + id + '" style="font-weight: bold;">' + label + '</label>' +
                   '<select id="' + id + '" class="dynamic-var-select" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></select>' +
                   '</div>';
        $fields.append(html);
        populateFields('#' + id);
        
        // Restaura valor se houver nos dados salvos
        var savedVars = $('#templateSelect').data('savedVars') || {};
        var savedKey = savedVars[id.replace('_', '')] || savedVars[id]; // tenta var1 ou var_1
        if (savedKey) {
            var keyStr = savedKey.replace('{{', '').replace('}}', '');
            $('#' + id).val(keyStr);
        }
    }

    function renderCarouselImageField(label, id, defaultValue) {
        var html = '<div class="field-row" style="margin-top: 10px;">' +
                   '<label for="' + id + '" style="font-weight: bold;">' + label + '</label>' +
                   '<input type="text" id="' + id + '" class="dynamic-var-input" placeholder="https://..." value="' + (defaultValue || '') + '" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;" />' +
                   '</div>';
        $fields.append(html);
        
        // Restaura valor se houver nos dados salvos
        var savedVars = $('#templateSelect').data('savedVars') || {};
        var savedValue = savedVars[id] || savedVars[id.replace(/_/g, '')];
        if (savedValue) {
            $('#' + id).val(savedValue);
        }
    }
}

function onRequestedSchema(schema) {
    console.log('📦 Schema recebido:', schema);
    DE_SCHEMA = schema.schema || [];
    DE_SCHEMA = schema.schema || [];
    populateFields('#phoneField');
    populateFields('#pixKeyField');
    populateFields('#pixAmountField');
    populateFields('#pixItemField');
    populateFields('#boletoLineField');
    populateFields('#botActiveField');
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

    // Função auxiliar para evitar a quebra do Journey Builder ao usar Data Extension com espaços.
    // Transforma `Event.DEAudience-xxxx.Link do contrato` em `Event.DEAudience-xxxx."Link do contrato"`
    function sanitizeMCKey(key) {
        if (!key) return key;
        if (key.indexOf(' ') !== -1 && key.indexOf('"') === -1) {
            var parts = key.split('.');
            if (parts.length >= 2) {
                var prefix = parts[0];
                var fieldName = parts.slice(1).join('.');
                return prefix + '."' + fieldName + '"';
            }
        }
        return key;
    }

    var inArguments = {
        templateName: template,
        phone_id: $('#phone_id').val() || null,
        languageCode: $('#langCode').val() || 'pt_BR',
        imageUrl: $('#imageUrl').val(),
        apiKey: '7a8e3bd0f4514d0e8a6bb31c41a79c32',
        to: '{{' + sanitizeMCKey(phoneField) + '}}'
    };

    var botActiveField = $('#botActiveField').val();
    if (botActiveField) {
        inArguments.bot_active = '{{' + sanitizeMCKey(botActiveField) + '}}';
    }

    // PIX
    var pixKeyField = $('#pixKeyField').val();
    if (pixKeyField) {
        inArguments.pixKey = '{{' + sanitizeMCKey(pixKeyField) + '}}';
    }
    
    var pixAmountField = $('#pixAmountField').val();
    if (pixAmountField) {
        inArguments.pixAmount = '{{' + sanitizeMCKey(pixAmountField) + '}}';
    }
    
    var pixItemField = $('#pixItemField').val();
    if (pixItemField) {
        inArguments.pixItem = '{{' + sanitizeMCKey(pixItemField) + '}}';
    }

    // Payment Type
    var paymentType = $('#paymentType').val();
    inArguments.paymentType = paymentType;

    if (paymentType === 'boleto') {
        var boletoLineField = $('#boletoLineField').val();
        if (boletoLineField) {
            inArguments.boletoLine = '{{' + sanitizeMCKey(boletoLineField) + '}}';
        }
    }
    


    // Coleta variáveis dinâmicas
    $('.dynamic-var-select').each(function() {
        var id = $(this).attr('id'); // e.g., var_1, headerVar_1, btnVar_0
        var val = $(this).val();
        if (val) {
            // Remove o underscore para enviar ao Apex (e.g., var1, headerVar1)
            var cleanId = id.replace('_', '');
            inArguments[cleanId] = '{{' + sanitizeMCKey(val) + '}}';
        }
    });

    // Coleta inputs estáticos / URLs do carrossel
    $('.dynamic-var-input').each(function() {
        var id = $(this).attr('id');
        var val = $(this).val();
        if (val) {
            inArguments[id] = val;
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
