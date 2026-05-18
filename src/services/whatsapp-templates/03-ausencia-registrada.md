# Template 03 — `psiai_ausencia_registrada`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ✅ Aprovado  
**Função:** `sendWhatsAppPatientAbsent()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Sua ausência foi registrada e {{2}} foi notificado(a). Entre em contato para reagendar quando quiser.
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |

## Botões

Nenhum.

## Quando é enviado

Disparado quando o paciente clica no botão **"Informar Ausência"** do template `psiai_lembrete_com_acoes`.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_ausencia_registrada",
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
