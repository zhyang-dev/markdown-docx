<template>
  <div class="flex flex-col h-screen max-w-full">
    <AppHeader
      @upload="handleUpload"
      @download="showExportModal = true"
      @select-template="handleSelectTemplate"
    />

    <!-- Bilingual notice -->
    <div class="text-center py-2 bg-green-50 text-sm">
      <p>
        <span class="text-green-600 font-medium">🔒 {{ t('local_processing') }}</span>
        <span v-if="apiAvailable" class="ml-2 text-blue-600">✓ API 服务可用</span>
        <span v-else class="ml-2 text-gray-500">API 服务未连接</span>
      </p>
    </div>

    <!-- Main content - split view -->
    <div class="flex flex-col md:flex-row flex-1 overflow-hidden">
      <MarkdownEditor
        v-model="markdownContent"
        @clear="clearMarkdown"
      />
      <MarkdownPreview :html-content="htmlContent" />
    </div>

    <ExportModal
      v-model="showExportModal"
      @export="handleExport"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import MarkdownEditor from './components/MarkdownEditor.vue'
import MarkdownPreview from './components/MarkdownPreview.vue'
import ExportModal from './components/ExportModal.vue'
import { useMarkdown } from './composables/useMarkdown'
import { useTheme } from './composables/useTheme'
import { useI18n } from './composables/useI18n'
import markdownDocx, { Packer } from 'markdown-docx'
import initMarkdown from './assets/templates/template.md?raw'

// API 配置 - 可通过环境变量或运行时配置
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const { markdownContent, htmlContent, setMarkdown, clearMarkdown } = useMarkdown()
const { getThemeConfig } = useTheme()
const { t } = useI18n()

const showExportModal = ref(false)
const apiAvailable = ref(false)

onMounted(async () => {
  // 初始化默认内容
  setMarkdown(initMarkdown)

  // 检查 API 可用性
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/health`)
      apiAvailable.value = res.ok
    } catch {
      apiAvailable.value = false
    }
  }
})

const handleUpload = (content) => {
  setMarkdown(content)
}

const handleSelectTemplate = (template) => {
  setMarkdown(template)
}

const handleExport = async (options) => {
  const selectedTheme = getThemeConfig(options.theme)

  const exportOptions = {
    name: options.name,
    document: {
      title: options.title,
      description: options.description,
    },
    ignoreImage: options.ignoreImage,
    ignoreFootnote: options.ignoreFootnote,
    ignoreHtml: options.ignoreHtml,
    theme: selectedTheme?.theme,
  }

  // 如果启用 mermaid 且 API 可用，使用后端处理
  if (options.enableMermaid && apiAvailable.value) {
    await handleExportViaAPI(options, exportOptions)
  } else {
    // 本地处理
    await handleExportLocal(exportOptions)
  }
}

// 本地导出（不支持 mermaid）
const handleExportLocal = async (exportOptions) => {
  try {
    const buffer = await markdownDocx(markdownContent.value, exportOptions)
    const blob = await Packer.toBlob(buffer)

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = formatFilename(exportOptions.name)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export failed:', error)
    alert('导出失败: ' + error.message)
  }
}

// 通过 API 导出（支持 mermaid）
const handleExportViaAPI = async (options, exportOptions) => {
  try {
    const requestOptions = {
      ...exportOptions,
      filename: formatFilename(exportOptions.name),
      mermaid: {
        enabled: true
      }
    }

    const res = await fetch(`${API_BASE_URL}/api/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        markdown: markdownContent.value,
        options: requestOptions
      })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'API request failed')
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = formatFilename(exportOptions.name)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('API Export failed:', error)
    alert('API 导出失败: ' + error.message)
  }
}

const formatFilename = (name) => {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const dateString = `${month}${day}${hours}${minutes}${seconds}`
  return `${name || 'markdown-docx'}-${dateString}.docx`
}
</script>