import { ThemeView } from '@/components/ThemeView'
import { Skeleton } from '@/components/Skeleton'
import { t, useLocale } from '@/i18n'
import { Button, Input, Picker, Switch, Text, Textarea, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { planApi, type Plan } from '@/api/plans'
import { NavBar } from '@/components/NavBar'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

type Mode = 'custom' | 'ai'

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
]

export default function PlanCreate() {
  useLocale()
  const { params } = useRouter()
  const editId = params.id ? Number(params.id) : null
  const [mode, setMode] = useState<Mode>('custom')
  const [loading, setLoading] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(Boolean(editId))
  const [topic, setTopic] = useState('')
  const [triggerTimes, setTriggerTimes] = useState('09:00')
  const [timezone, setTimezone] = useState('Asia/Shanghai')
  const [syncCsdn, setSyncCsdn] = useState(false)
  const [syncJuejin, setSyncJuejin] = useState(false)
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('')
  const [topicsQueue, setTopicsQueue] = useState('')
  const [days, setDays] = useState('7')
  const [aiTime, setAiTime] = useState('09:00')
  const [generatedPlans, setGeneratedPlans] = useState<Plan[]>([])

  useEffect(() => {
    if (!editId) return
    let active = true
    planApi
      .get(editId)
      .then(plan => {
        if (!active) return
        setTopic(plan.topic)
        setTriggerTimes(
          (plan.triggerTimes?.length ? plan.triggerTimes : [plan.triggerTime || '09:00']).join(
            ', ',
          ),
        )
        setTimezone(plan.timezone || 'Asia/Shanghai')
        setSyncCsdn(plan.syncCsdn)
        setSyncJuejin(plan.syncJuejin)
        setAudience(plan.audience || '')
        setTone(plan.tone || '')
        setTopicsQueue((plan.topics || []).join('\n'))
      })
      .catch(error => showToast(error instanceof Error ? error.message : t('ui.unableToLoadPlan')))
      .finally(() => {
        if (active) setLoadingPlan(false)
      })
    return () => {
      active = false
    }
  }, [editId])

  const handleCustomCreate = async () => {
    const trimmedTopic = topic.trim()
    if (!trimmedTopic) {
      showToast(t('ui.enterAPlanTopic'))
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const times = triggerTimes
        .split(/[,，]/)
        .map(item => item.trim())
        .filter(Boolean)
      if (times.length === 0 || times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
        showToast(t('ui.enterAValidScheduledTime'))
        return
      }
      const payload = {
        topic: trimmedTopic,
        triggerTimes: times,
        timezone,
        syncCsdn,
        syncJuejin,
        audience: audience.trim() || undefined,
        tone: tone.trim() || undefined,
        topics: topicsQueue
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean),
      }
      if (editId) await planApi.update(editId, payload)
      else await planApi.create(payload)
      showToast(editId ? t('ui.planUpdated') : t('ui.planCreated'))
      setTimeout(() => Taro.navigateBack(), 700)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.unableToCreatePlan'))
    } finally {
      setLoading(false)
    }
  }

  const handleAiGenerate = async () => {
    const trimmedTopic = topic.trim()
    if (!trimmedTopic) {
      showToast(t('ui.enterATopic'))
      return
    }
    const dayCount = Number(days)
    if (!dayCount || dayCount < 1 || dayCount > 30) {
      showToast(t('ui.chooseBetween1And30Days'))
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const result = await planApi.aiGenerate({
        topic: trimmedTopic,
        days: dayCount,
        time: aiTime.trim() || '09:00',
        timezone,
        syncCsdn,
        syncJuejin,
        audience: audience.trim() || undefined,
        tone: tone.trim() || undefined,
      })
      showToast(t('preferences.generatedPlans', { count: result.length }))
      setGeneratedPlans(result)
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('ui.generationFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ThemeView className="detail-page plan-create-page">
      <NavBar title={editId ? t('ui.editPlan') : t('ui.newPlan')} showBack />

      {!editId ? (
        <View className="segmented">
          <Text
            className={`segment ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            {t('ui.customPlan')}
          </Text>
          <Text
            className={`segment ${mode === 'ai' ? 'active' : ''}`}
            onClick={() => setMode('ai')}
          >
            {t('ui.generateWithAi')}
          </Text>
        </View>
      ) : null}

      {loadingPlan ? <Skeleton layout="planForm" /> : null}
      {!loadingPlan ? (
        <View className="plan-form-card">
          <View className="form-item">
            <Text className="form-label">
              {mode === 'custom' ? t('ui.planTopic') : t('ui.topic')}
            </Text>
            <Textarea
              className="form-textarea form-textarea-short"
              placeholder={t('ui.forExampleJavaConcurrencySeries')}
              value={topic}
              maxlength={500}
              onInput={e => setTopic(e.detail.value)}
            />
          </View>

          {mode === 'custom' ? (
            <>
              <View className="form-item">
                <Text className="form-label">{t('ui.scheduledTimesHhMmCommaSeparated')}</Text>
                <View className="time-field-row">
                  <Input
                    className="form-input"
                    placeholder="09:00"
                    value={triggerTimes}
                    onInput={e => setTriggerTimes(e.detail.value)}
                  />
                  <Picker
                    mode="time"
                    value={triggerTimes.split(/[,，]/)[0]?.trim() || '09:00'}
                    onChange={event => setTriggerTimes(String(event.detail.value))}
                  >
                    <Text className="field-picker-action">{t('ui.choose')}</Text>
                  </Picker>
                </View>
              </View>
              <View className="form-item">
                <Text className="form-label">{t('ui.topicQueueOnePerLineLeaveBlank')}</Text>
                <Textarea
                  className="form-textarea form-textarea-queue"
                  placeholder={t('preferences.topicQueuePlaceholder')}
                  value={topicsQueue}
                  onInput={e => setTopicsQueue(e.detail.value)}
                />
              </View>
            </>
          ) : (
            <View className="ai-row">
              <View className="form-item ai-col">
                <Text className="form-label">{t('ui.days130')}</Text>
                <Input
                  className="form-input"
                  placeholder="7"
                  type="number"
                  value={days}
                  onInput={e => setDays(e.detail.value)}
                />
              </View>
              <View className="form-item ai-col">
                <Text className="form-label">{t('ui.dailyPublishingTime')}</Text>
                <Picker
                  mode="time"
                  value={aiTime}
                  onChange={event => setAiTime(String(event.detail.value))}
                >
                  <View className="form-input picker-value">
                    <Text>{aiTime}</Text>
                    <Text className="picker-arrow">›</Text>
                  </View>
                </Picker>
              </View>
            </View>
          )}

          <View className="form-item">
            <Text className="form-label">{t('ui.audienceOptional')}</Text>
            <Input
              className="form-input"
              placeholder={t('ui.forExampleJavaDevelopersWith35')}
              value={audience}
              maxlength={120}
              onInput={e => setAudience(e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.toneOptional')}</Text>
            <Input
              className="form-input"
              placeholder={t('ui.forExampleProfessionalAndApproachable')}
              value={tone}
              maxlength={60}
              onInput={e => setTone(e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.crossPosting')}</Text>
            <View className="switch-row">
              <Text className="switch-label">{t('ui.crossPostToCsdn')}</Text>
              <Switch
                checked={syncCsdn}
                onChange={e => setSyncCsdn(e.detail.value)}
                color="#1677ff"
              />
            </View>
            <View className="switch-row">
              <Text className="switch-label">{t('ui.crossPostToJuejin')}</Text>
              <Switch
                checked={syncJuejin}
                onChange={e => setSyncJuejin(e.detail.value)}
                color="#1677ff"
              />
            </View>
          </View>
          <View className="form-item">
            <Text className="form-label">{t('ui.timeZone')}</Text>
            <Picker
              mode="selector"
              range={TIMEZONES}
              value={Math.max(0, TIMEZONES.indexOf(timezone))}
              onChange={event => setTimezone(TIMEZONES[Number(event.detail.value)] || timezone)}
            >
              <View className="form-input picker-value">
                <Text>{timezone}</Text>
                <Text className="picker-arrow">›</Text>
              </View>
            </Picker>
          </View>
        </View>
      ) : null}

      {!loadingPlan ? (
        <Button
          className="btn btn-primary publish-submit"
          loading={loading}
          disabled={loading}
          onClick={mode === 'custom' ? handleCustomCreate : handleAiGenerate}
        >
          {mode === 'custom'
            ? editId
              ? t('ui.saveChanges')
              : t('ui.createPlan')
            : t('ui.generatePlansWithAi')}
        </Button>
      ) : null}
      {mode === 'ai' ? (
        <Text className="form-tip ai-tip">{t('ui.aiCreatesDailyOneTimePlansStarting')}</Text>
      ) : null}
      {generatedPlans.length > 0 ? (
        <View className="generated-plans">
          <View className="section-title">
            <Text>{t('ui.generatedPlans')}</Text>
            <Text className="more-link" onClick={() => Taro.navigateBack()}>
              {t('ui.done')}
            </Text>
          </View>
          {generatedPlans.map(plan => (
            <View className="generated-plan-row" key={plan.id}>
              <Text className="generated-plan-topic">{plan.topic}</Text>
              <Text className="generated-plan-time">
                {(plan.triggerTimes?.length ? plan.triggerTimes : [plan.triggerTime]).join(' / ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ThemeView>
  )
}
