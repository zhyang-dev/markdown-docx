import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface MermaidExtractResult {
  blocks: string[]      // mermaid 代码块内容
  positions: number[]   // 每个代码块在原文中的起始位置
}

/**
 * 提取 markdown 中所有 mermaid 代码块
 */
export function extractMermaidBlocks(markdown: string): MermaidExtractResult {
  const blocks: string[] = []
  const positions: number[] = []

  // 匹配 ```mermaid...``` 代码块
  const regex = /```mermaid\s*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1].trim())
    positions.push(match.index)
  }

  return { blocks, positions }
}

/**
 * 检查 mmdc 是否可用
 */
export async function checkMmdcAvailable(mmdcPath: string = 'mmdc'): Promise<boolean> {
  try {
    await execAsync(`${mmdcPath} --version`)
    return true
  } catch {
    return false
  }
}

/**
 * 将 mermaid 代码渲染为 PNG 图片
 */
export async function renderMermaidToPNG(
  code: string,
  outputPath: string,
  mmdcPath: string = 'mmdc'
): Promise<void> {
  // 检查 mmdc 是否可用
  const available = await checkMmdcAvailable(mmdcPath)
  if (!available) {
    throw new Error(
      'mmdc not found. Please install mermaid-cli:\n' +
      '  npm install -g @mermaid-js/mermaid-cli\n' +
      'Or specify custom path with --mmdc-path option.'
    )
  }

  // 创建临时 .mmd 文件
  const tempDir = os.tmpdir()
  const tempFile = path.join(tempDir, `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}.mmd`)

  try {
    await fs.writeFile(tempFile, code, 'utf-8')

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath)
    await fs.mkdir(outputDir, { recursive: true })

    // 调用 mmdc 转换，添加超时处理
    const { stderr } = await execAsync(
      `${mmdcPath} -i ${tempFile} -o ${outputPath} -b transparent`,
      { timeout: 30000 } // 30秒超时
    )

    if (stderr && !stderr.includes('WARN')) {
      console.warn(`[Mermaid] Warning: ${stderr}`)
    }
  } catch (error: any) {
    // 清理可能生成的不完整文件
    try {
      await fs.unlink(outputPath)
    } catch {}

    throw new Error(
      `Failed to render mermaid diagram:\n` +
      `  Error: ${error.message}\n` +
      `  Diagram code:\n${code.split('\n').slice(0, 5).join('\n')}...`
    )
  } finally {
    // 清理临时文件
    try {
      await fs.unlink(tempFile)
    } catch {}
  }
}

/**
 * 将 markdown 中的 mermaid 代码块替换为图片引用
 */
export function replaceMermaidWithImages(
  markdown: string,
  positions: number[],
  imagePaths: string[]
): string {
  if (positions.length === 0 || positions.length !== imagePaths.length) {
    return markdown
  }

  let result = markdown
  const regex = /```mermaid\s*\n[\s\S]*?```/g

  // 从后往前替换，避免位置偏移
  const matches: Array<{ index: number; length: number }> = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(markdown)) !== null) {
    matches.push({ index: match.index, length: match[0].length })
  }

  // 从后往前替换
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, length } = matches[i]
    const imagePath = imagePaths[i]
    // 如果图片路径为空（渲染失败），跳过替换，保留原始 mermaid 块
    if (!imagePath) {
      continue
    }
    const imageRef = `![mermaid-${i}](${imagePath})`
    result = result.slice(0, index) + imageRef + result.slice(index + length)
  }

  return result
}

export interface MermaidOptions {
  /** 是否启用 mermaid 处理 */
  enabled: boolean
  /** 图片输出目录，默认 images/ */
  outputDir?: string
  /** mmdc 可执行文件路径，默认 'mmdc' */
  mmdcPath?: string
}

/**
 * 处理 markdown 中的 mermaid 图表
 */
export async function processMermaid(
  markdown: string,
  options: MermaidOptions
): Promise<string> {
  if (!options.enabled) {
    return markdown
  }

  const { blocks, positions } = extractMermaidBlocks(markdown)

  if (blocks.length === 0) {
    return markdown
  }

  console.log(`[Mermaid] Found ${blocks.length} diagram(s) to process`)

  const outputDir = options.outputDir || 'images'
  const mmdcPath = options.mmdcPath || 'mmdc'
  const imagePaths: string[] = []
  let successCount = 0
  let failCount = 0

  // 渲染每个 mermaid 块为 PNG
  for (let i = 0; i < blocks.length; i++) {
    const imagePath = path.join(outputDir, `mermaid-${i}.png`)
    try {
      await renderMermaidToPNG(blocks[i], imagePath, mmdcPath)
      imagePaths.push(imagePath)
      successCount++
      console.log(`[Mermaid] ✓ Generated: ${imagePath}`)
    } catch (error: any) {
      failCount++
      console.error(`[Mermaid] ✗ Failed to render diagram ${i + 1}: ${error.message}`)
      // 跳过失败的块
      imagePaths.push('')
    }
  }

  console.log(`[Mermaid] Completed: ${successCount} succeeded, ${failCount} failed`)

  // 替换 mermaid 块为图片引用
  return replaceMermaidWithImages(markdown, positions, imagePaths)
}