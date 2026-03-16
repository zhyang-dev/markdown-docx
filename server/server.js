import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import markdownDocx, { Packer, processMermaid, checkMmdcAvailable } from 'markdown-docx'

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 检查 mmdc 可用性
app.get('/api/mmdc-status', async (req, res) => {
  try {
    const available = await checkMmdcAvailable()
    res.json({ available })
  } catch (error) {
    res.json({ available: false, error: error.message })
  }
})

// 转换接口
app.post('/api/convert', upload.single('file'), async (req, res) => {
  try {
    // 获取 markdown 内容
    let markdown = ''
    if (req.file) {
      // 从上传的文件读取
      markdown = req.file.buffer.toString('utf-8')
    } else if (req.body.markdown) {
      // 从请求体读取
      markdown = req.body.markdown
    } else {
      return res.status(400).json({ error: 'No markdown content provided' })
    }

    // 解析选项
    let options = {}
    try {
      options = JSON.parse(req.body.options || '{}')
    } catch {
      options = {}
    }

    // 处理 mermaid
    if (options.mermaid?.enabled) {
      const tempDir = path.join(os.tmpdir(), 'markdown-docx-mermaid', Date.now().toString())

      markdown = await processMermaid(markdown, {
        enabled: true,
        outputDir: options.mermaid.outputDir || tempDir,
        mmdcPath: options.mermaid.mmdcPath || 'mmdc'
      })

      // 清理临时图片目录（可选，这里保留供 docx 引用）
      // 如果图片嵌入到 docx 中，可以清理
    }

    // 构建 markdown-docx 选项
    const docOptions = {
      document: options.document,
      theme: options.theme,
      math: options.math,
      ignoreImage: options.ignoreImage,
      ignoreFootnote: options.ignoreFootnote,
      ignoreHtml: options.ignoreHtml,
    }

    // 转换为 docx
    const doc = await markdownDocx(markdown, docOptions)
    const buffer = await Packer.toBuffer(doc)

    // 设置响应头
    const filename = options.filename || `document-${Date.now()}.docx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Content-Length', buffer.length)

    res.send(buffer)
  } catch (error) {
    console.error('Conversion error:', error)
    res.status(500).json({
      error: 'Conversion failed',
      message: error.message
    })
  }
})

// 批量转换接口
app.post('/api/convert-batch', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' })
    }

    const options = JSON.parse(req.body.options || '{}')
    const results = []

    for (const file of req.files) {
      try {
        let markdown = file.buffer.toString('utf-8')
        const filename = file.originalname.replace(/\.mdx?$/, '.docx')

        // 处理 mermaid
        if (options.mermaid?.enabled) {
          const tempDir = path.join(os.tmpdir(), 'markdown-docx-mermaid', `${Date.now()}-${filename}`)
          markdown = await processMermaid(markdown, {
            enabled: true,
            outputDir: tempDir,
            mmdcPath: options.mermaid.mmdcPath || 'mmdc'
          })
        }

        const doc = await markdownDocx(markdown, options)
        const buffer = await Packer.toBuffer(doc)

        results.push({
          filename,
          success: true,
          size: buffer.length,
          // 返回 base64 以便 JSON 响应
          data: buffer.toString('base64')
        })
      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message
        })
      }
    }

    res.json({ results })
  } catch (error) {
    console.error('Batch conversion error:', error)
    res.status(500).json({ error: 'Batch conversion failed', message: error.message })
  }
})

// 静态文件服务（可选，用于托管前端）
app.use(express.static(path.join(import.meta.dirname, '../web/dist')))

// SPA fallback
app.get('*', (req, res, next) => {
  // 如果是 API 请求，跳过
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return next()
  }
  res.sendFile(path.join(import.meta.dirname, '../web/dist/index.html'))
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// 启动服务器
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Markdown to DOCX server running on http://localhost:${PORT}`)
  console.log(`📝 API endpoint: http://localhost:${PORT}/api/convert`)
  console.log(`💚 Health check: http://localhost:${PORT}/health`)
})