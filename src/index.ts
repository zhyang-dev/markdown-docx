import { Packer } from 'docx'

import { MarkdownDocx } from './MarkdownDocx'
import { processMermaid } from './mermaid'
import { styles } from './styles'
import { MarkdownDocxOptions } from './types'

export * from "./types"

export default async function markdownDocx (
  markdown: string,
  options: MarkdownDocxOptions = {}
) {
  // 处理 mermaid 图表
  if (options.mermaid?.enabled) {
    markdown = await processMermaid(markdown, {
      enabled: true,
      outputDir: options.mermaid.outputDir,
      mmdcPath: options.mermaid.mmdcPath
    })
  }

  return MarkdownDocx.covert(markdown, options)
}

export {
  // main
  markdownDocx,
  MarkdownDocx,
  Packer,

  // style
  styles,
}
