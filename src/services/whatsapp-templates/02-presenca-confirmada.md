# Template 02 — `psiai_presenca_confirmada`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ✅ Aprovado  
**Função:** `sendWhatsAppPatientConfirmed()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Sua presença na sessão com {{2}} em {{3}} às {{4}} foi confirmada. Até breve! 🗓️
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |
| `{{3}}` | Data formatada | `segunda-feira, 15 de maio` |
| `{{4}}` | Horário | `14:00` |

## Botões

Nenhum.

## Quando é enviado

Disparado quando o paciente clica no botão **"Confirmar ✓"** do template `psiai_lembrete_com_acoes`.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_presenca_confirmada",
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
      }
    ]
  }
}
```
