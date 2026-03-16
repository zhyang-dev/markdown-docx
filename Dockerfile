# 构建前端
FROM node:20-alpine AS web-builder
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN npm install -g pnpm && cd web && pnpm install
COPY web/ ./web/
RUN cd web && pnpm build

# 构建后端依赖
FROM node:20-alpine AS server-builder
WORKDIR /app
RUN apk add --no-cache msttcorefonts-installer fontconfig && \
    update-ms-fonts && \
    fc-cache -f
COPY package.json pnpm-lock.yaml tsconfig.json tsdown.config.ts ./
COPY src/ ./src/
RUN npm install -g pnpm && pnpm install && pnpm build

# 安装 mermaid-cli
RUN npm install -g @mermaid-js/mermaid-cli

# 最终镜像
FROM node:20-alpine
WORKDIR /app

# 安装字体（mermaid 渲染需要）
RUN apk add --no-cache msttcorefonts-installer fontconfig && \
    update-ms-fonts && \
    fc-cache -f

# 安装 mermaid-cli
RUN npm install -g @mermaid-js/mermaid-cli

# 复制构建产物
COPY --from=server-builder /app/dist ./dist
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./
COPY --from=web-builder /app/web/dist ./web/dist
COPY server/server.js ./server/

# 创建临时目录
RUN mkdir -p /tmp/markdown-docx-mermaid

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server/server.js"]