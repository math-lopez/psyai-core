# Template 04 — `psiai_reagendamento_solicitado`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ✅ Aprovado  
**Função:** `sendWhatsAppPatientRescheduleRequested()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Sua solicitação de reagendamento foi recebida. {{2}} entrará em contato para definir um novo horário.
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |

## Botões

Nenhum.

## Quando é enviado

Disparado quando o paciente clica no botão **"Reagendar"** do template `psiai_lembrete_com_acoes`.

> **Nota:** também pode ser enviado manualmente no fluxo de reagendamento direto.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_reagendamento_solicitado",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "Dra. Ana Lima" }
        ]
      }
    ]
  }
}
```
