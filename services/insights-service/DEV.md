# Como testar o insights-service localmente

## Pré-requisitos

- Python 3.11 instalado (`python --version` ou `python3 --version` no Mac)
- Chave da Groq API → [console.groq.com](https://console.groq.com) (gratuita)

---

## 1. Criar o ambiente virtual (uma vez só)

**Windows CMD:**
```cmd
cd services\insights-service
python -m venv .venv
```

**Mac:**
```bash
cd services/insights-service
python3 -m venv .venv
```

---

## 2. Ativar o ambiente virtual

**Windows CMD:**
```cmd
.venv\Scripts\activate
```

**Mac:**
```bash
source .venv/bin/activate
```

Quando ativado, o terminal mostra `(.venv)` no início da linha.

---

## 3. Instalar dependências

```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

> Mesmo comando nos dois sistemas.

---

## 4. Configurar o `.env`

**Windows CMD:**
```cmd
copy .env.example .env
```

**Mac:**
```bash
cp .env.example .env
```

Abra o `.env` e preencha:

```env
SERVICE_TOKEN=meu-token-local
GROQ_API_KEY=gsk_...sua_chave_aqui...
```

> O `SERVICE_TOKEN` pode ser qualquer string em ambiente local — só precisa bater com o que você colocar no header da requisição.

---

## 5. Rodar o serviço

```bash
uvicorn main:app --reload --port 8000
```

> Mesmo comando nos dois sistemas. O `--reload` reinicia automaticamente ao salvar um arquivo.

Serviço disponível em: `http://localhost:8000`

Documentação interativa (Swagger): `http://localhost:8000/docs`

---

## 6. Rodar os testes

```bash
pytest -v
```

Rodar só um arquivo:
```bash
pytest tests/test_patterns.py -v
```

Rodar um teste específico:
```bash
pytest tests/test_risk_detector.py::TestSuicideRisk::test_negated_ideation_not_flagged -v
```

> Mesmo comando nos dois sistemas.

---

## 7. Testar os endpoints

### Opção mais fácil — Swagger UI

Acesse `http://localhost:8000/docs` no navegador.
Clique em **Authorize**, cole o valor do seu `SERVICE_TOKEN` e teste direto pela interface.

---

### Via curl

#### Health check

```bash
curl http://localhost:8000/health
```

---

#### `/process-patient-analysis` — análise de sessão única

**Mac:**
```bash
curl -s -X POST http://localhost:8000/process-patient-analysis \
  -H "Authorization: Bearer meu-token-local" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "p-001",
    "psychologistId": "psi-001",
    "patient": { "id": "p-001", "name": "Paciente Teste" },
    "sessions": [
      {
        "id": "s-001",
        "sessionDate": "2024-03-15",
        "clinicalNotes": "Paciente relata ansiedade intensa ao sair de casa. Refere ataques de panico recentes. Menciona preocupacao constante com o trabalho."
      }
    ]
  }'
```

**Windows CMD** — salve o corpo em um arquivo e referencie com `@`:

Crie o arquivo `payload_analysis.json`:
```json
{
  "patientId": "p-001",
  "psychologistId": "psi-001",
  "patient": { "id": "p-001", "name": "Paciente Teste" },
  "sessions": [
    {
      "id": "s-001",
      "sessionDate": "2024-03-15",
      "clinicalNotes": "Paciente relata ansiedade intensa ao sair de casa. Refere ataques de panico recentes. Menciona preocupacao constante com o trabalho."
    }
  ]
}
```

Depois execute:
```cmd
curl -s -X POST http://localhost:8000/process-patient-analysis ^
  -H "Authorization: Bearer meu-token-local" ^
  -H "Content-Type: application/json" ^
  -d @payload_analysis.json
```

**Resposta esperada:**
```json
{
  "summary": "...",
  "key_patterns": ["Ansiedade"],
  "risk_flags": [],
  "recommendations": ["Explorar tecnicas de regulacao emocional..."]
}
```

---

#### `/synthesize-patient` — síntese longitudinal (chama a Groq)

**Mac:**
```bash
curl -s -X POST http://localhost:8000/synthesize-patient \
  -H "Authorization: Bearer meu-token-local" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "p-001",
    "psychologistId": "psi-001",
    "patient": { "id": "p-001", "name": "Paciente Teste" },
    "sessions": [
      {
        "id": "s-001",
        "sessionDate": "2024-01-10",
        "clinicalNotes": "Paciente relata tristeza persistente e desmotivacao. Choro frequente."
      },
      {
        "id": "s-002",
        "sessionDate": "2024-02-05",
        "clinicalNotes": "Leve melhora no humor. Retomou caminhadas. Menos episodios de choro."
      },
      {
        "id": "s-003",
        "sessionDate": "2024-03-01",
        "clinicalNotes": "Relata progresso significativo. Voltou ao trabalho. Insight sobre padroes relacionais."
      }
    ]
  }'
```

**Windows CMD** — crie o arquivo `payload_synthesis.json` com o mesmo conteúdo acima e execute:
```cmd
curl -s -X POST http://localhost:8000/synthesize-patient ^
  -H "Authorization: Bearer meu-token-local" ^
  -H "Content-Type: application/json" ^
  -d @payload_synthesis.json
```

> Este endpoint faz uma chamada real à API da Groq. Requer `GROQ_API_KEY` no `.env`.

---

#### Testar rejeição de token inválido

```bash
curl -s -X POST http://localhost:8000/process-patient-analysis \
  -H "Authorization: Bearer token-errado" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"x","psychologistId":"x","patient":{},"sessions":[]}'
```

Deve retornar `401 Token inválido`.

---

## 8. Fluxo rápido do dia a dia

```bash
# 1. Ativar ambiente (Windows: .venv\Scripts\activate)
source .venv/bin/activate

# 2. Rodar testes antes de qualquer mudança
pytest -v

# 3. Subir o servidor
uvicorn main:app --reload --port 8000

# 4. Testar no Swagger: http://localhost:8000/docs
#    ou com curl (exemplos na seção 7)

# 5. Rodar testes de novo para garantir que nada quebrou
pytest -v
```
