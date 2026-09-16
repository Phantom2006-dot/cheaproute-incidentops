FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MUJOCO_GL=egl

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    libgl1 \
    libegl1 \
    libx11-6 \
    libosmesa6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY robotics-requirements.txt ./
RUN python3 -m venv /app/.robotics-venv \
    && /app/.robotics-venv/bin/pip install --no-cache-dir -r robotics-requirements.txt

COPY . .
RUN pnpm build

EXPOSE 10000
CMD ["pnpm", "start"]
