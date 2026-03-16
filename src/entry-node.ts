export * from './index'

export { default } from './index'

// 导出 mermaid 相关函数
export { processMermaid, checkMmdcAvailable, type MermaidOptions } from './mermaid'

import { MarkdownDocx } from './MarkdownDocx'

import { downloadImage } from './adapters/nodejs'

MarkdownDocx.defaultOptions.imageAdapter = downloadImage
