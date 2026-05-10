FROM python:3.11-slim

# Cria usuário não-root para reduzir superfície de ataque
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Instala dependências antes de copiar código — aproveita cache de camadas
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baixa dados NLTK no build para não precisar de rede em runtime
RUN python -c "\
import nltk; \
nltk.download('punkt', quiet=True); \
nltk.download('punkt_tab', quiet=True); \
nltk.download('stopwords', quiet=True)"

COPY . .

# Garante que o usuário não-root seja dono dos arquivos
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# --workers 2 melhora throughput sem sobrecarregar instâncias pequenas do Railway
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
