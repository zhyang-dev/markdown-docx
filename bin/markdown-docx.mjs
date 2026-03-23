#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { Command } from 'commander'
import markdownToDocx, { Packer, processMermaid } from '../dist/index.node.mjs'

const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf-8'))

const { name, description, version } = pkg

/**
 * 预处理markdown中的公式，确保格式正确
 * - inline公式 $...$ 前后添加空格（包括处理 markdown 格式标记）
 * - display公式 $$...$$ 前后添加空行
 */
function preprocessMathFormulas(content) {
  // 先处理 display 公式 $$...$$（多行模式）
  // 确保前后有空行
  content = content.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula, offset, string) => {
    let result = match
    const prefix = string.slice(0, offset)
    const suffix = string.slice(offset + match.length)

    // 检查前面是否需要添加空行
    const needsLeadingBlankLine = !(/(\n\n|^)$/.test(prefix))
    if (needsLeadingBlankLine) {
      result = '\n\n' + result
    }

    // 检查后面是否需要添加空行
    const needsTrailingBlankLine = !(/^(\n\n|$)/.test(suffix))
    if (needsTrailingBlankLine) {
      result = result + '\n\n'
    }

    return result
  })

  // 处理 inline 公式 $...$
  // 根据 latex.ts 的规则：
  // - $ 前面必须是空格或行首
  // - 公式后的 $ 后面必须是空格或特定标点 ?!\.,:？！。，： 或换行或字符串结尾
  //
  // 特殊情况：markdown 格式标记（如 **、*、`）紧邻 $ 时也需要添加空格
  // 例如：**$x$** → ** $x$ **

  // 允许的后缀字符（latex.ts 规则）
  const allowedSuffixChars = [' ', '\n', '?', '!', '.', ',', ':', '？', '！', '。', '，', '：', '|']

  content = content.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, formula, offset, string) => {
    let prefix = ''
    let suffix = ''

    // 检查 $ 前面的字符
    if (offset > 0) {
      const charBefore = string[offset - 1]
      // 如果前面不是空格或换行，添加空格
      // 这包括 markdown 格式字符（*、`）和普通字符
      if (charBefore !== ' ' && charBefore !== '\n') {
        prefix = ' '
      }
    }

    // 检查公式后的 $ 后面的字符
    const afterIndex = offset + match.length
    if (afterIndex < string.length) {
      const charAfter = string[afterIndex]
      // 如果后面不是允许的字符，添加空格
      if (!allowedSuffixChars.includes(charAfter)) {
        suffix = ' '
      }
    }

    // 只有在需要添加空格时才修改
    if (prefix || suffix) {
      return prefix + match + suffix
    }
    return match
  })

  // 清理可能产生的多余空格
  content = content.replace(/  +/g, ' ')

  return content
}

const program = new Command()

program
  .name(name)
  .description(description)
  .version(version, '-v, --version', 'output the version number')
  .option('-i, --input <file>', 'input markdown file')
  .option('-o, --output <file>', 'output docx file')
  .option('--mermaid-output <dir>', 'output directory for mermaid images', 'images')
  .option('--mmdc-path <path>', 'path to mmdc executable', 'mmdc')
  .option('--mermaid-scale <scale>', 'puppeteer scale factor for higher resolution (default: 1)', parseFloat)
  .option('--mermaid-width <width>', 'page width in pixels (default: 800)', parseInt)
  // 主题配置选项
  .option('--code-color <color>', 'code block text color (hex, e.g. 000000)', 'default')
  .option('--code-size <size>', 'code block font size in points (e.g. 8)', 'default')
  .option('--codespan-color <color>', 'inline code text color (hex)', 'default')
  .option('--link-color <color>', 'link color (hex)', 'default')
  .option('--link-underline', 'enable link underline', false)
  .action(doCommand)
  .parse(process.argv)

async function doCommand(options) {
  if (!options.input) {
    throw new Error('Input file is required')
  }
  if (!options.output) {
    options.output = options.input.replace(/\.mdx?$/, '.docx')
  }

  const ext = path.extname(options.output)

  if (!ext) {
    options.output += '.docx'
  } else if (ext.toLowerCase() !== '.docx') {
    throw new Error(`[${name}] Output file must be a .docx file, but got ${ext}`)
  }

  let content = await fs.readFile(options.input, 'utf-8')
  if (!content) {
    throw new Error(`[${name}] File ${options.input} is empty`)
  }

  // 预处理公式（默认启用）
  content = preprocessMathFormulas(content)

  // 处理 mermaid 图表（默认启用）
  const inputDir = path.dirname(path.resolve(options.input))
  const outputDir = path.resolve(inputDir, options.mermaidOutput || 'images')

  console.log(`[${name}] Processing mermaid diagrams...`)
  try {
    content = await processMermaid(content, {
      enabled: true,
      outputDir,
      mmdcPath: options.mmdcPath || 'mmdc',
      scale: options.mermaidScale,
      width: options.mermaidWidth
    })
  } catch (e) {
    console.warn(`[${name}] Mermaid processing failed, skipping: ${e.message}`)
  }

  // 构建主题配置
  const theme = {}
  if (options.codeColor !== 'default') {
    theme.code = options.codeColor
    theme.codespan = options.codespanColor !== 'default' ? options.codespanColor : options.codeColor
  }
  if (options.codespanColor !== 'default' && options.codeColor === 'default') {
    theme.codespan = options.codespanColor
  }
  if (options.codeSize !== 'default') {
    // 字号转半点：8pt -> 16
    theme.codeSize = parseInt(options.codeSize) * 2
  }
  if (options.linkColor !== 'default') {
    theme.link = options.linkColor
  }
  if (options.linkUnderline) {
    theme.linkUnderline = true
  }

  const docx = await markdownToDocx(content, Object.keys(theme).length > 0 ? { theme } : {})
  const buffer = await Packer.toBuffer(docx)

  await fs.writeFile(options.output, buffer)

  console.log(`[${name}] File ${options.output} created successfully`)
}
