# Markdown to DOCX Server

支持 Mermaid 图表转换的后端 API 服务。

## 快速开始

### 本地运行

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式（自动重启）
npm run dev
```

服务启动后访问 http://localhost:3000

### Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## API 接口

### 健康检查

```
GET /health
```

响应：
```json
{ "status": "ok", "timestamp": "2026-03-16T10:00:00.000Z" }
```

### 检查 mmdc 可用性

```
GET /api/mmdc-status
```

响应：
```json
{ "available": true }
```

### 转换 Markdown 为 DOCX

```
POST /api/convert
```

**请求体 (JSON):**

```json
{
  "markdown": "# Hello World\n\n```mermaid\ngraph TD\n  A --> B\n```",
  "options": {
    "filename": "my-document.docx",
    "document": {
      "title": "文档标题",
      "description": "文档描述"
    },
    "theme": {
      "code": "000000",
      "codeSize": 16
    },
    "mermaid": {
      "enabled": true,
      "outputDir": "/tmp/mermaid-images"
    }
  }
}
```

**响应:** DOCX 文件流

**cURL 示例:**

```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"markdown": "# Test\n\n```mermaid\ngraph TD\n  A --> B\n```", "options": {"mermaid": {"enabled": true}}}' \
  -o output.docx
```

### 批量转换

```
POST /api/convert-batch
```

**请求体 (multipart/form-data):**
- `files`: 多个 .md 文件
- `options`: JSON 格式的选项

**响应:**

```json
{
  "results": [
    {
      "filename": "document1.docx",
      "success": true,
      "size": 12345,
      "data": "base64-encoded-content"
    }
  ]
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `document.title` | string | - | 文档标题 |
| `document.description` | string | - | 文档描述 |
| `theme` | object | - | 主题配置（颜色、字号等） |
| `mermaid.enabled` | boolean | false | 启用 mermaid 处理 |
| `mermaid.outputDir` | string | `/tmp/...` | 图片输出目录 |
| `mermaid.mmdcPath` | string | `mmdc` | mmdc 可执行文件路径 |
| `ignoreImage` | boolean | false | 忽略图片 |
| `ignoreFootnote` | boolean | false | 忽略脚注 |
| `ignoreHtml` | boolean | false | 忽略 HTML |

## 前端配置

在前端项目中设置环境变量：

```env
# .env
VITE_API_URL=http://localhost:3000
```

或在 `.env.production` 中设置生产环境 API 地址。

## 前置条件

使用 mermaid 功能需要安装 mermaid-cli：

```bash
npm install -g @mermaid-js/mermaid-cli
```

Docker 镜像已内置 mermaid-cli。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务端口 |
| `NODE_ENV` | development | 运行环境 |