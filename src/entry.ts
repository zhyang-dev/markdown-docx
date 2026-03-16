export * from './index'

export { default } from './index'

// 浏览器环境不支持 mermaid 处理（需要 Node.js child_process）
// 但导出类型定义供 TypeScript 用户使用
export type { MermaidOptions } from './mermaid'

import { downloadImage } from './adapters/browser'
import { MarkdownDocx } from './MarkdownDocx'

MarkdownDocx.defaultOptions.imageAdapter = downloadImage