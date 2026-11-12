import { ThemeView } from '@/components/ThemeView'
import { Skeleton } from '@/components/Skeleton'
import { getSessionVersion, privateCacheKeys, readPrivateCache, useSessionVersion, writePrivateCache } from '@/utils/privateCache'
import { t, useLocale } from '@/i18n'
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

const DRAFT_KEY = privateCacheKeys.publishDraft
const PUBLISH_REQUEST_KEY = privateCacheKeys.publishRequest

const createRequestId = () => `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export default function Publish() {
  const session = useSessionVersion()
  return <PublishContent key={session} />
}

function PublishContent() {
  useLocale()
  const { params } = useRouter()
  const editId = params.id ? Number(params.id) : null

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [loadingCategories, setLoadingCategories] = useState(true)
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
      .finally(() => setLoadingCategories(false))
  }, [])

  useEffect(() => {
    if (!editId) {
      const draft = readPrivateCache<LocalDraft>(DRAFT_KEY)
      if (draft && typeof draft === 'object') {
        setTitle(draft.title || '')
        setSummary(draft.summary || '')
        setCategoryId(draft.categoryId)
        setTags(draft.tags || '')
        setContent(draft.content || '')
        setDraftSavedAt(draft.savedAt || null)
        showToast(t('ui.localDraftRestored'))
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
      .catch(e => showToast(e instanceof Error ? e.message : t('ui.unableToLoadArticle')))
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
    const session = getSessionVersion()
    const timer = setTimeout(() => {
      if (session !== getSessionVersion()) return
      const savedAt = Date.now()
      const draft: LocalDraft = { title, summary, categoryId, tags, content, savedAt }
      writePrivateCache(DRAFT_KEY, draft, session)
      setDraftSavedAt(savedAt)
    }, 1200)
    return () => clearTimeout(timer)
  }, [categoryId, content, draftReady, editId, saving, summary, tags, title])

  useEffect(() => {
    if (!dirty) return
    try {
      Taro.enableAlertBeforeUnload({ message: t('ui.youHaveUnsavedChangesLeaveThisArticle') })
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
      showToast(t('ui.enterATitle'))
      return
    }
    if (publish && !content.trim()) {
      showToast(t('ui.enterArticleContent'))
      return
    }
    if (publish && !categoryId) {
      showToast(t('ui.chooseACategory'))
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
      showToast(publish ? t('ui.publishedSuccessfully') : t('ui.draftSaved'))
      setTimeout(() => Taro.navigateBack(), 700)
    } catch (e) {
      if (publish && !editId && !(e instanceof ApiError)) {
        const requestId = Taro.getStorageSync<string>(PUBLISH_REQUEST_KEY)
        if (requestId && (await confirmPublishResult(requestId))) {
          clearLocalDraft()
          showToast(t('ui.publishedSuccessfully'))
          setTimeout(() => Taro.navigateBack(), 700)
          return
        }
        showToast(t('ui.publicationIsNotConfirmedYetCheckMy'))
        return
      }
      showToast(e instanceof Error ? e.message : t('ui.unableToSave'))
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
      title: t('ui.leaveEditor'),
      content: editId
        ? t('ui.yourChangesAreNotSavedLeaveAnyway')
        : t('ui.yourDraftIsSavedLocallyLeaveThe'),
      confirmText: t('ui.leave'),
      confirmColor: '#d14343',
    })
    if (result.confirm) {
      setDirty(false)
      Taro.navigateBack()
    }
  }

  if (!draftReady || loadingCategories) return (
    <ThemeView className="publish-page">
      <NavBar title={editId ? t('ui.editArticle') : t('ui.publishArticle')} showBack />
      <Skeleton layout="publishForm" />
    </ThemeView>
  )

  return (
    <ThemeView className="publish-page">
      <NavBar
        title={editId ? t('ui.editArticle') : t('ui.publishArticle')}
        showBack
        onBack={handleBack}
      />

      <View className="publish-status-row">
        <Text className="publish-save-state">
          {!editId && draftSavedAt ? t('ui.savedAutomatically') : dirty ? t('ui.notSaved') : ''}
        </Text>
      </View>

      <View className="segmented publish-mode">
        <Text
          className={`segment ${editorMode === 'edit' ? 'active' : ''}`}
          onClick={() => setEditorMode('edit')}
        >
          {t('ui.edit')}
        </Text>
        <Text
          className={`segment ${editorMode === 'preview' ? 'active' : ''}`}
          onClick={() => setEditorMode('preview')}
        >
          {t('ui.preview')}
        </Text>
      </View>

      {editorMode === 'edit' ? (
        <>
          <View className="form-item">
            <Text className="form-label">{t('ui.title')}</Text>
            <Input
              className="form-input"
              placeholder={t('ui.enterTheArticleTitle')}
              value={title}
              maxlength={120}
              onInput={e => {
                setTitle(e.detail.value)
                markDirty()
              }}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.category')}</Text>
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
                    (categories.length ? t('ui.chooseACategory') : t('ui.noCategories'))}
                </Text>
                <Text className="picker-arrow">›</Text>
              </View>
            </Picker>
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.tagsCommaSeparated')}</Text>
            <Input
              className="form-input"
              placeholder={t('ui.javascriptFrontend')}
              value={tags}
              onInput={e => {
                setTags(e.detail.value)
                markDirty()
              }}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.summaryOptional')}</Text>
            <Textarea
              className="form-textarea form-textarea-summary"
              placeholder={t('ui.summarizeTheArticleInOneSentence')}
              value={summary}
              maxlength={300}
              onInput={e => {
                setSummary(e.detail.value)
                markDirty()
              }}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.contentMarkdown')}</Text>
            <Textarea
              className="form-textarea form-textarea-content"
              placeholder={t('preferences.markdownPlaceholder')}
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
          <Text className="publish-preview-title">{title || t('ui.untitledArticle')}</Text>
          {summary ? <Text className="publish-preview-summary">{summary}</Text> : null}
          {content ? (
            <View className="markdown-body">
              <Markdown content={content} />
            </View>
          ) : (
            <View className="empty-state publish-preview-empty">
              <Text className="empty-title">{t('ui.noContentYet')}</Text>
              <Text className="empty-desc">{t('ui.switchToEditToStartWriting')}</Text>
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
          {t('ui.saveDraft')}
        </Button>
        <Button
          className="btn btn-primary action-btn"
          loading={saving}
          disabled={saving}
          onClick={() => submit(true)}
        >
          {editId ? t('ui.updatePublishedArticle') : t('ui.publish')}
        </Button>
      </View>
    </ThemeView>
  )
}
