# Templates WhatsApp — PsiAI

Todos os templates precisam ser criados e aprovados no **Meta Business Manager** antes de usar em produção.

- Conta: Meta Business Manager (WABA)
- Idioma: `pt_BR`
- Categoria padrão: **Utility**

---

## Índice de Templates

| # | Nome do Template | Situação | Função no Serviço | Descrição |
|---|---|---|---|---|
| 1 | `psiai_lembrete_com_acoes` | ✅ Aprovado | `sendWhatsAppReminder()` | Lembrete de sessão com botões de ação |
| 2 | `psiai_presenca_confirmada` | ✅ Aprovado | `sendWhatsAppPatientConfirmed()` | Confirmação de presença na sessão |
| 3 | `psiai_ausencia_registrada` | ✅ Aprovado | `sendWhatsAppPatientAbsent()` | Aviso de ausência registrada |
| 4 | `psiai_reagendamento_solicitado` | ✅ Aprovado | `sendWhatsAppPatientRescheduleRequested()` | Solicitação de reagendamento recebida |
| 5 | `psiai_reagendamento_aprovado` | ✅ Aprovado | `sendWhatsAppPatientRescheduleApproved()` | Reagendamento aprovado pelo psicólogo |
| 6 | `psiai_reagendamento_recusado` | ✅ Aprovado | `sendWhatsAppPatientRescheduleRejected()` | Reagendamento recusado pelo psicólogo |
| 7 | `psiai_sessao_iniciada` | ✅ Aprovado | `sendWhatsAppSessionStarted()` | Notificação de sessão iniciada com link |
| 8 | `psiai_sessao_cancelada` | ✅ Aprovado | `sendWhatsAppSessionCancelled()` | Aviso de sessão cancelada pelo psicólogo |

---

## Fluxo de mensagens

```
Lembrete enviado (D-1)
        │
        ├── Paciente clica "Confirmar ✓"
        │       └── psiai_presenca_confirmada
        │
        ├── Paciente clica "Informar Ausência"
        │       └── psiai_ausencia_registrada
        │
        └── Paciente clica "Reagendar"
                └── psiai_reagendamento_solicitado
                        │
                        ├── Psicólogo aprova
                        │       └── psiai_reagendamento_aprovado
                        │
                        └── Psicólogo recusa
                                └── psiai_reagendamento_recusado

No dia da sessão (quando psicólogo inicia)
        └── psiai__sessao_iniciada
```

---

## Como cadastrar um template no Meta Business Manager

1. Acesse [business.facebook.com](https://business.facebook.com) → WhatsApp → Gerenciador de modelos
2. Clique em **Criar modelo**
3. Preencha: Nome (exato como nos arquivos desta pasta), Categoria e Idioma
4. Cole o texto do Body conforme descrito em cada arquivo
5. Adicione os botões, se houver
6. Envie para aprovação — geralmente aprovado em minutos para categoria Utility
