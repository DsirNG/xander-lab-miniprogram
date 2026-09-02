import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { blogApi, type Category } from '@/api/blog'
import { ApiError } from '@/api/http'
import { Markdown } from '@/components/Markdown'
import { NavBar } from '@/components/NavBar'
import { ensureLogin } from '@/store/user'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

type EditorMode = 'edit' | 'preview'

type LocalDraft = {
  title: string
  summary: string
  categoryId?: number
  tags: string
  content: string
  savedAt: number
}

const DRAFT_KEY = 'dinqorai:miniprogram:publish-draft'
const PUBLISH_REQUEST_KEY = 'dinqorai:miniprogram:publish-request'

const createRequestId = () => `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export default function Publish() {
  const { params } = useRouter()
  const editId = params.id ? Number(params.id) : null

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [draftReady, setDraftReady] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    blogApi
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!editId) {
      const draft = Taro.getStorageSync<LocalDraft>(DRAFT_KEY)
      if (draft && typeof draft === 'object') {
        setTitle(draft.title || '')
        setSummary(draft.summary || '')
        setCategoryId(draft.categoryId)
        setTags(draft.tags || '')
        setContent(draft.content || '')
        setDraftSavedAt(draft.savedAt || null)
        showToast('已恢复本地草稿')
      }
      setDraftReady(true)
      return
    }
    let active = true
    blogApi
      .getMyArticle(editId)
      .then(article => {
        if (!active) return
        setTitle(article.title)
        setSummary(article.summary || '')
        setCategoryId(article.category ? Number(article.category) : undefined)
        setTags((article.tags || []).join(', '))
        setContent(article.content || '')
        setDirty(false)
      })
      .catch(e => showToast(e instanceof Error ? e.message : '文章加载失败'))
      .finally(() => {
        if (active) setDraftReady(true)
      })
    return () => {
      active = false
    }
  }, [editId])

  useEffect(() => {
    if (!draftReady || editId || saving) return
    const hasContent = Boolean(title || summary || tags || content)
    if (!hasContent) return
    const timer = setTimeout(() => {
      const savedAt = Date.now()
      const draft: LocalDraft = { title, summary, categoryId, tags, content, savedAt }
      Taro.setStorageSync(DRAFT_KEY, draft)
      setDraftSavedAt(savedAt)
    }, 1200)
    return () => clearTimeout(timer)
  }, [categoryId, content, draftReady, editId, saving, summary, tags, title])

  useEffect(() => {
    if (!dirty) return
    try {
      Taro.enableAlertBeforeUnload({ message: '文章还有未保存的修改，确定离开吗？' })
    } catch {
      // H5 或不支持该能力的平台由页面返回按钮二次确认兜底。
    }
    return () => {
      try {
        Taro.disableAlertBeforeUnload()
      } catch {
        // 忽略不支持平台。
      }
    }
  }, [dirty])

  const clearLocalDraft = () => {
    Taro.removeStorageSync(DRAFT_KEY)
    Taro.removeStorageSync(PUBLISH_REQUEST_KEY)
    setDraftSavedAt(null)
    setDirty(false)
  }

  const confirmPublishResult = async (requestId: string) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        const result = await blogApi.getPublishStatus(requestId)
        if (result.status === 'published') return true
        if (result.status === 'failed') return false
      } catch {
        // 在确认窗口内继续尝试。
      }
    }
    return false
  }

  const submit = async (publish: boolean) => {
    if (!ensureLogin()) return
    if (!title.trim()) {
      showToast('请输入标题')
      return
    }
    if (publish && !content.trim()) {
      showToast('正文不能为空')
      return
    }
    if (publish && !categoryId) {
      showToast('请选择分类')
      return
    }
    if (saving) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      summary: summary.trim() || undefined,
      content,
      categoryId,
      coverImage: undefined,
      tags: tags
        .split(/[,，]/)
        .map(item => item.trim())
        .filter(Boolean),
      publish,
    }
    try {
      if (editId) {
        await blogApi.updateArticle(editId, payload)
      } else {
        let requestId: string | undefined
        if (publish) {
          requestId = Taro.getStorageSync<string>(PUBLISH_REQUEST_KEY) || createRequestId()
          Taro.setStorageSync(PUBLISH_REQUEST_KEY, requestId)
        }
        await blogApi.createArticle(payload, requestId)
      }
      clearLocalDraft()
      showToast(publish ? '发布成功' : '草稿已保存')
      setTimeout(() => Taro.navigateBack(), 700)
    } catch (e) {
      if (publish && !editId && !(e instanceof ApiError)) {
        const requestId = Taro.getStorageSync<string>(PUBLISH_REQUEST_KEY)
        if (requestId && (await confirmPublishResult(requestId))) {
          clearLocalDraft()
          showToast('发布成功')
          setTimeout(() => Taro.navigateBack(), 700)
          return
        }
        showToast('发布结果暂未确认，请稍后在我的博客中查看')
        return
      }
      showToast(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const categoryIndex = categoryId
    ? Math.max(
        0,
        categories.findIndex(item => Number(item.id) === Number(categoryId)),
      )
    : -1

  const markDirty = () => setDirty(true)

  const handleBack = async () => {
    if (!dirty) {
      Taro.navigateBack()
      return
    }
    const result = await Taro.showModal({
      title: '离开编辑',
      content: editId ? '修改尚未保存，确定离开吗？' : '本地草稿已自动保存，确定离开吗？',
      confirmText: '离开',
      confirmColor: '#d14343',
    })
    if (result.confirm) {
      setDirty(false)
      Taro.navigateBack()
    }
  }

  return (
    <View className="publish-page">
      <NavBar title={editId ? '编辑文章' : '发布文章'} showBack onBack={handleBack} />

      <View className="publish-status-row">
        <Text className="publish-save-state">
          {!editId && draftSavedAt ? '已自动保存' : dirty ? '未保存' : ''}
        </Text>
      </View>

      <View className="segmented publish-mode">
        <Text
          className={`segment ${editorMode === 'edit' ? 'active' : ''}`}
          onClick={() => setEditorMode('edit')}
        >
          编辑
        </Text>
        <Text
          className={`segment ${editorMode === 'preview' ? 'active' : ''}`}
          onClick={() => setEditorMode('preview')}
        >
          预览
        </Text>
      </View>

      {editorMode === 'edit' ? (
        <>
          <View className="form-item">
            <Text className="form-label">标题 *</Text>
            <Input
              className="form-input"
              placeholder="请输入文章标题"
              value={title}
              maxlength={120}
              onInput={e => {
                setTitle(e.detail.value)
                markDirty()
              }}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">分类 *</Text>
            <Picker
              mode="selector"
              range={categories.map(item => item.name)}
              value={categoryIndex < 0 ? 0 : categoryIndex}
              onChange={e => {
                const index = Number(e.detail.value)
                const item = categories[index]
                if (item) {
                  setCategoryId(Number(item.id))
                  markDirty()
                }
              }}
            >
              <View className="form-input picker-value">
                <Text>
                  {categories[categoryIndex]?.name ||
                    (categories.length ? '请选择分类' : '暂无分类')}
                </Text>
                <Text className="picker-arrow">›</Text>
              </View>
            </Picker>
          </View>
          <View className="form-item">
            <Text className="form-label">标签（逗号分隔）</Text>
            <Input
              className="form-input"
              placeholder="JavaScript, 前端"
              value={tags}
              onInput={e => {
                setTags(e.detail.value)
                markDirty()
              }}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">摘要（可选）</Text>
            <Textarea
              className="form-textarea form-textarea-summary"
              placeholder="一句话概括文章内容"
              value={summary}
              maxlength={300}
              onInput={e => {
                setSummary(e.detail.value)
                markDirty()
              }}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">正文（Markdown）*</Text>
            <Textarea
              className="form-textarea form-textarea-content"
              placeholder={'# 标题\n\n正文内容，支持 Markdown 语法...'}
              value={content}
              onInput={e => {
                setContent(e.detail.value)
                markDirty()
              }}
            />
          </View>
        </>
      ) : (
        <View className="publish-preview">
          <Text className="publish-preview-title">{title || '未命名文章'}</Text>
          {summary ? <Text className="publish-preview-summary">{summary}</Text> : null}
          {content ? (
            <View className="markdown-body">
              <Markdown content={content} />
            </View>
          ) : (
            <View className="empty-state publish-preview-empty">
              <Text className="empty-title">还没有正文内容</Text>
              <Text className="empty-desc">切回编辑模式开始写作</Text>
            </View>
          )}
        </View>
      )}

      <View className="publish-actions">
        <Button
          className="btn btn-ghost action-btn"
          loading={saving}
          disabled={saving}
          onClick={() => submit(false)}
        >
          存草稿
        </Button>
        <Button
          className="btn btn-primary action-btn"
          loading={saving}
          disabled={saving}
          onClick={() => submit(true)}
        >
          {editId ? '更新发布' : '发布'}
        </Button>
      </View>
    </View>
  )
}
