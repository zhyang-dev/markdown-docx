import { describe, expect, it } from 'vitest'
import {
  checkMmdcAvailable,
  extractMermaidBlocks,
  processMermaid,
  renderMermaidToPNG,
  replaceMermaidWithImages,
  type MermaidOptions
} from './mermaid'

describe('extractMermaidBlocks', () => {
  it('should extract single mermaid block', () => {
    const markdown = `# Title

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

End of document.`

    const result = extractMermaidBlocks(markdown)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]).toContain('graph TD')
    expect(result.positions).toHaveLength(1)
  })

  it('should extract multiple mermaid blocks', () => {
    const markdown = `# Title

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`

End.`

    const result = extractMermaidBlocks(markdown)
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0]).toContain('graph TD')
    expect(result.blocks[1]).toContain('sequenceDiagram')
  })

  it('should ignore non-mermaid code blocks', () => {
    const markdown = `\`\`\`javascript
console.log('hello')
\`\`\`

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

\`\`\`python
print('hello')
\`\`\``

    const result = extractMermaidBlocks(markdown)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]).toContain('graph TD')
  })

  it('should return empty arrays when no mermaid blocks', () => {
    const markdown = `# Title

Some text without mermaid.`

    const result = extractMermaidBlocks(markdown)
    expect(result.blocks).toHaveLength(0)
    expect(result.positions).toHaveLength(0)
  })
})

describe('checkMmdcAvailable', () => {
  it('should detect mmdc availability', async () => {
    // 这个测试假设环境中可能安装了 mmdc
    const available = await checkMmdcAvailable()
    expect(typeof available).toBe('boolean')
  })
})

describe('renderMermaidToPNG', () => {
  it('should throw error when mmdc not available', async () => {
    // 模拟 mmdc 不可用的情况
    const mmdcPath = '/nonexistent/mmdc'
    await expect(
      renderMermaidToPNG('graph TD\nA-->B', '/tmp/test.png', mmdcPath)
    ).rejects.toThrow('mmdc not found')
  })
})

describe('replaceMermaidWithImages', () => {
  it('should replace single mermaid block with image', () => {
    const markdown = `# Title

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

End.`

    const positions = [markdown.indexOf('```mermaid')]
    const imagePaths = ['images/mermaid-0.png']

    const result = replaceMermaidWithImages(markdown, positions, imagePaths)
    expect(result).not.toContain('```mermaid')
    expect(result).toContain('![mermaid-0](images/mermaid-0.png)')
  })

  it('should replace multiple mermaid blocks', () => {
    const markdown = `\`\`\`mermaid
graph A
\`\`\`

\`\`\`mermaid
graph B
\`\`\``

    const positions = [
      markdown.indexOf('```mermaid'),
      markdown.lastIndexOf('```mermaid')
    ]
    const imagePaths = ['images/mermaid-0.png', 'images/mermaid-1.png']

    const result = replaceMermaidWithImages(markdown, positions, imagePaths)
    expect(result).toContain('![mermaid-0](images/mermaid-0.png)')
    expect(result).toContain('![mermaid-1](images/mermaid-1.png)')
    expect(result.match(/```mermaid/g)).toBeNull()
  })

  it('should preserve non-mermaid code blocks', () => {
    const markdown = `\`\`\`javascript
console.log('hello')
\`\`\`

\`\`\`mermaid
graph TD
\`\`\``

    const positions = [markdown.indexOf('```mermaid')]
    const imagePaths = ['images/mermaid-0.png']

    const result = replaceMermaidWithImages(markdown, positions, imagePaths)
    expect(result).toContain('```javascript')
    expect(result).toContain("console.log('hello')")
  })
})

describe('processMermaid', () => {
  it('should return original markdown when no mermaid blocks', async () => {
    const markdown = '# Title\n\nNo mermaid here.'
    const options: MermaidOptions = { enabled: true, outputDir: '/tmp/test-mermaid' }

    const result = await processMermaid(markdown, options)
    expect(result).toBe(markdown)
  })

  it('should skip processing when disabled', async () => {
    const markdown = `\`\`\`mermaid\ngraph TD\nA-->B\n\`\`\``
    const options: MermaidOptions = { enabled: false }

    const result = await processMermaid(markdown, options)
    expect(result).toBe(markdown)
  })
})