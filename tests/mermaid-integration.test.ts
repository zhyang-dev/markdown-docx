import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { checkMmdcAvailable, processMermaid } from '../src/mermaid'

describe('Mermaid Integration Tests', () => {
  const testDir = path.join(__dirname, 'temp-mermaid-test')
  let mmdcAvailable = false

  beforeAll(async () => {
    // 检查 mmdc 是否可用
    mmdcAvailable = await checkMmdcAvailable()
    if (!mmdcAvailable) {
      console.warn('mmdc not available, skipping integration tests')
    }
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    // 清理测试文件
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('should process flowchart diagram', async () => {
    if (!mmdcAvailable) return

    const markdown = `
# Test

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`

    const result = await processMermaid(markdown, {
      enabled: true,
      outputDir: testDir
    })

    expect(result).not.toContain('```mermaid')
    expect(result).toContain('![mermaid-0]')

    // 验证图片文件存在
    const imagePath = path.join(testDir, 'mermaid-0.png')
    const exists = await fs.access(imagePath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  it('should handle invalid mermaid syntax gracefully', async () => {
    if (!mmdcAvailable) return

    const markdown = `
\`\`\`mermaid
this is invalid mermaid syntax !!!
\`\`\`
`

    const result = await processMermaid(markdown, {
      enabled: true,
      outputDir: testDir
    })

    // 应该返回原始 markdown（转换失败时跳过）
    expect(result).toContain('```mermaid')
  })
})