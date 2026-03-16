#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { Command } from 'commander'
import markdownToDocx, { Packer, processMermaid } from '../dist/index.node.mjs'

const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf-8'))

const { name, description, version } = pkg

const program = new Command()

program
  .name(name)
  .description(description)
  .version(version, '-v, --version', 'output the version number')
  .option('-i, --input <file>', 'input markdown file')
  .option('-o, --output <file>', 'output docx file')
  .option('--mermaid', 'enable mermaid diagram processing (requires mmdc)', false)
  .option('--mermaid-output <dir>', 'output directory for mermaid images', 'images')
  .option('--mmdc-path <path>', 'path to mmdc executable', 'mmdc')
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

  // 处理 mermaid 图表
  if (options.mermaid) {
    const inputDir = path.dirname(path.resolve(options.input))
    const outputDir = path.resolve(inputDir, options.mermaidOutput)

    console.log(`[${name}] Processing mermaid diagrams...`)
    content = await processMermaid(content, {
      enabled: true,
      outputDir,
      mmdcPath: options.mmdcPath
    })
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
