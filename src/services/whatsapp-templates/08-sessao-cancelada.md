# Template 08 — `psiai_sessao_cancelada`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ⏳ Pendente aprovação  
**Função:** `sendWhatsAppSessionCancelled()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Sua sessão com {{2}} em {{3}} às {{4}} foi cancelada. Entre em contato para reagendar.
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |
| `{{3}}` | Data da sessão cancelada | `segunda-feira, 20 de maio` |
| `{{4}}` | Hora da sessão cancelada | `14:00` |

## Quando é enviado

Disparado quando o psicólogo cancela uma sessão pela plataforma.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_sessao_cancelada",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "Dra. Ana Lima" },
          { "type": "text", "text": "segunda-feira, 20 de maio" },
          { "type": "text", "text": "14:00" }
        ]
      }
    ]
  }
}
```
