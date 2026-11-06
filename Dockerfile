FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv espeak-ng ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY requirements-cloud.txt ./
RUN python3 -m venv /opt/classroom-venv \
    && /opt/classroom-venv/bin/pip install --no-cache-dir -r requirements-cloud.txt
COPY . .
RUN mkdir -p /app/data /app/work && chown -R node:node /app/data /app/work
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 CLASSROOM_CLOUD=1 CLASSROOM_TTS=edge CLASSROOM_PYTHON=/opt/classroom-venv/bin/python3
USER node
EXPOSE 10000
CMD ["npm", "start"]
