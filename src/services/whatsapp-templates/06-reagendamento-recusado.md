# Template 06 — `psiai_reagendamento_recusado`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ✅ Aprovado  
**Função:** `sendWhatsAppPatientRescheduleRejected()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Infelizmente {{2}} não pôde aprovar o reagendamento. Entre em contato diretamente para verificar outro horário.
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |

## Botões

Nenhum.

## Quando é enviado

Disparado quando o psicólogo recusa uma solicitação de reagendamento do paciente.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_reagendamento_recusado",
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
