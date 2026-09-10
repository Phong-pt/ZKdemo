FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libgmp-dev libmpfr-dev libmpc-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY common.py demo.py api.py ./
COPY issuer ./issuer
COPY wallet ./wallet
COPY verifier ./verifier

CMD ["python", "demo.py"]
