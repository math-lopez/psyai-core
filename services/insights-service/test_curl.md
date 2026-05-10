# Curls de teste — insights-service

> Antes de rodar: certifique-se de que o servidor está no ar (`uvicorn main:app --reload --port 8000`).
> Substitua `meu-token-local` pelo valor do `SERVICE_TOKEN` do seu `.env`.

---

## 1. Health check

```bash
curl http://localhost:8000/health
```

---

## 2. Análise de sessão única — `/process-patient-analysis`

Usa a **sessão 3** (a com mais conteúdo clínico).
Arquivo: `test_analysis.json`

**Mac:**
```bash
curl -s -X POST http://localhost:8000/process-patient-analysis \
  -H "Authorization: Bearer meu-token-local" \
  -H "Content-Type: application/json" \
  -d @test_analysis.json | python3 -m json.tool
```

**Windows CMD:**
```cmd
curl -s -X POST http://localhost:8000/process-patient-analysis ^
  -H "Authorization: Bearer meu-token-local" ^
  -H "Content-Type: application/json" ^
  -d @test_analysis.json
```

**O que esperar na resposta:**
- `key_patterns`: deve detectar `Autoestima e autoconceito` (autossabotagem, insegurança) e `Conflito familiar` (dinâmica familiar, limites difusos)
- `risk_flags`: deve estar vazio — nenhum risco explícito nas notas
- `recommendations`: sugestões baseadas nos padrões detectados

---

## 3. Síntese longitudinal — `/synthesize-patient`

Usa as **3 sessões** em ordem cronológica.
Arquivo: `test_synthesis.json`

**Mac:**
```bash
curl -s -X POST http://localhost:8000/synthesize-patient \
  -H "Authorization: Bearer meu-token-local" \
  -H "Content-Type: application/json" \
  -d @test_synthesis.json | python3 -m json.tool
```

**Windows CMD:**
```cmd
curl -s -X POST http://localhost:8000/synthesize-patient ^
  -H "Authorization: Bearer meu-token-local" ^
  -H "Content-Type: application/json" ^
  -d @test_synthesis.json
```

**O que esperar na resposta:**
- `summary`: trajetória geral das 3 sessões
- `evolution_analysis`: deve comparar sessão 2 (tensão no trabalho, dificuldades relacionais) com sessão 3 (autossabotagem, desejo de autonomia)
- `improvements`: engajamento terapêutico, maior consciência emocional (Sessão 2)
- `concerns`: padrão de autossabotagem, fragilidade de equilíbrio psíquico (Sessão 3)
- `risk_flags`: deve estar vazio
- `milestones`: pode citar a verbalização do desejo de autonomia (Sessão 3)
- Sessão 1 (falta justificada): **não deve** ser interpretada como deterioração

---

## 4. Testar token inválido

```bash
curl -s -X POST http://localhost:8000/process-patient-analysis \
  -H "Authorization: Bearer token-errado" \
  -H "Content-Type: application/json" \
  -d @test_analysis.json
```

Deve retornar: `{"detail":"Token inválido"}`

---

## Dica — formatar o JSON no terminal

No Mac, o `| python3 -m json.tool` no final de qualquer curl já formata a resposta.
No Windows CMD, instale o `jq` (https://jqlang.github.io/jq/) e use `| jq .` no final.
