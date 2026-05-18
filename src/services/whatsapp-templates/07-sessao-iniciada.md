# Template 07 — `psiai_sessao_iniciada`

**Categoria:** Utility  
**Idioma:** pt_BR  
**Status:** ⏳ Pendente aprovação  
**Função:** `sendWhatsAppSessionStarted()` em `whatsappService.ts`

---

## Texto do Body

> **Atenção:** o texto abaixo é uma sugestão — o template ainda não foi registrado/aprovado no Meta.  
> Defina o texto final antes de submeter.

```
Olá, {{1}}! Sua sessão com {{2}} está prestes a começar. Acesse pelo link abaixo para entrar na sala.
```

## Variáveis

| Variável | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Nome do paciente | `João` |
| `{{2}}` | Nome do psicólogo | `Dra. Ana Lima` |

## Botões (sugestão)

| Tipo | Rótulo | URL |
|---|---|---|
| URL | `Entrar na sessão` | `{{1}}` (URL dinâmica) |

> **Nota:** botões de URL com variáveis dinâmicas requerem aprovação específica do Meta. Avalie se é melhor incluir a URL diretamente no corpo do texto ou usar um botão estático com URL base.

## Quando é enviado

Disparado quando o psicólogo inicia a sessão na plataforma.

## Aviso importante — nome do template

O nome atual no código é `psiai_sessao_iniciada` (duplo underscore). Verifique se esse é o nome exato cadastrado no Meta Business Manager, ou corrija para `psiai_sessao_iniciada` (underscore único) antes de aprovar.

## Exemplo de payload para a API Meta

```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "template",
  "template": {
    "name": "psiai_sessao_iniciada",
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
