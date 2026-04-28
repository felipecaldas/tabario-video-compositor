FROM node:20-slim

# Install Chromium (required for Remotion headless render) + FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Copy Remotion components (not compiled — used directly by Remotion bundler)
COPY remotion ./remotion

RUN npx tsc --project tsconfig.build.json && \
    mkdir -p dist/manifest && \
    cp src/manifest/prompt.md dist/manifest/prompt.md && \
    cp -r src/templates/library dist/templates/

EXPOSE 9312

CMD ["node", "dist/api/server.js"]
