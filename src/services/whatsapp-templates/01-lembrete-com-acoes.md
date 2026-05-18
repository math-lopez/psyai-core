# Template 01 — `psiai_lembrete_com_acoes`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ✅ Aprovado  
**Função:** `sendWhatsAppReminder()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Sua sessão com {{2}} está agendada para {{3}} às {{4}}. Como deseja proceder?
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |
| `{{3}}` | Data formatada | `segunda-feira, 15 de maio` |
| `{{4}}` | Horário | `14:00` |

## Botões (Quick Reply)

| Índice | Rótulo | Payload enviado |
|---|---|---|
| 0 | `Confirmar ✓` | `confirm_<sessionId>` |
| 1 | `Informar Ausência` | `absent_<sessionId>` |
| 2 | `Reagendar` | `reschedule_<sessionId>` |

## Quando é enviado

Enviado automaticamente pelo `reminderService.ts` com antecedência configurável (padrão: 24h antes da sessão).

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_lembrete_com_acoes",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "Dra. Ana Lima" },
          { "type": "text", "text": "segunda-feira, 15 de maio" },
          { "type": "text", "text": "14:00" }
        ]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": "0",
        "parameters": [{ "type": "payload", "payload": "confirm_<sessionId>" }]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": "1",
        "parameters": [{ "type": "payload", "payload": "absent_<sessionId>" }]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": "2",
        "parameters": [{ "type": "payload", "payload": "reschedule_<sessionId>" }]
      }
    ]
  }
}
```
