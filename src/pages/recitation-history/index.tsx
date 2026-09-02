import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { recitationApi, type RecitationAttempt, type RecitationMaterial } from '@/api/recitation'
import { NavBar } from '@/components/NavBar'
import { PageState } from '@/components/ui/PageState'
import { t } from '@/i18n'
import { formatDateTime } from '@/utils/format'
import './index.scss'

function statusText(attempt: RecitationAttempt) {
  if (attempt.status === 'SUCCEEDED') return t('recitation.statusSucceeded')
  if (attempt.status === 'FAILED') return t('recitation.statusFailed')
  return t('recitation.statusProcessing')
}

export default function RecitationHistoryPage() {
  const [materialId, setMaterialId] = useState(0)
  const [material, setMaterial] = useState<RecitationMaterial | null>(null)
  const [attempts, setAttempts] = useState<RecitationAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useLoad(options => setMaterialId(Number(options.id)))

  useEffect(() => {
    if (!materialId) return
    const load = async () => {
      try {
        setLoading(true)
        const [currentMaterial, currentAttempts] = await Promise.all([
          recitationApi.getMaterial(materialId),
          recitationApi.listAttempts(materialId),
        ])
        setMaterial(currentMaterial)
        setAttempts(currentAttempts)
      } catch (error) {
        Taro.showToast({
          title: error instanceof Error ? error.message : t('recitation.loadFailed'),
          icon: 'none',
        })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [materialId])

  const openReport = (attempt: RecitationAttempt) => {
    Taro.navigateTo({ url: `/pages/recitation-report/index?id=${attempt.id}` })
  }

  return (
    <View className="page recitation-history-page">
      <NavBar title={t('recitation.history')} showBack />
      <View className="recitation-history-content">
        {material ? (
          <View className="recitation-history-summary">
            <Text className="recitation-history-title">{material.title}</Text>
            <Text className="recitation-history-meta">
              {t('recitation.characterCount', { count: material.characterCount })}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <PageState kind="loading" title={t('common.loading')} />
        ) : attempts.length === 0 ? (
          <PageState kind="empty" title={t('recitation.noHistory')} />
        ) : (
          <View className="recitation-history-list">
            {attempts.map(attempt => (
              <View
                key={attempt.id}
                className="recitation-history-row"
                hoverClass="recitation-history-row--pressed"
                onClick={() => openReport(attempt)}
              >
                <View className="recitation-history-main">
                  <Text className="recitation-history-time">
                    {formatDateTime(attempt.createdAt)}
                  </Text>
                  <Text
                    className={`recitation-history-status recitation-history-status--${attempt.status.toLowerCase()}`}
                  >
                    {statusText(attempt)}
                  </Text>
                </View>
                <Text className="recitation-history-score">
                  {attempt.status === 'SUCCEEDED' && attempt.score != null
                    ? Number(attempt.score).toFixed(1)
                    : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
