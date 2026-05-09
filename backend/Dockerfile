FROM python:3.12-slim
WORKDIR /app

ENV PDM_VENV_IN_PROJECT=1

RUN pip install --no-cache-dir pdm

# Install deps first (layer-cached until pyproject.toml / lockfile change)
COPY pyproject.toml pdm.lock* ./
RUN pdm install --no-self

COPY . .

ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
