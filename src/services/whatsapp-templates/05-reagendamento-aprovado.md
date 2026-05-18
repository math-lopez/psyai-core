# Template 05 — `psiai_reagendamento_aprovado`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ✅ Aprovado  
**Função:** `sendWhatsAppPatientRescheduleApproved()` em `whatsappService.ts`

---

## Texto do Body

```
Olá, {{1}}! Temos uma boa notícia. {{2}} confirmou sua nova sessão para {{3}} no horário das {{4}}. Até lá! 📅
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |
| `{{3}}` | Nova data formatada | `quarta-feira, 18 de maio` |
| `{{4}}` | Novo horário | `15:30` |

## Botões

Nenhum.

## Quando é enviado

Disparado quando o psicólogo aprova uma solicitação de reagendamento do paciente.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_reagendamento_aprovado",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "Dra. Ana Lima" },
          { "type": "text", "text": "quarta-feira, 18 de maio" },
          { "type": "text", "text": "15:30" }
        ]
      }
    ]
  }
}
```
