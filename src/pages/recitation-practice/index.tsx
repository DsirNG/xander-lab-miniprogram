import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { recitationApi, type RecitationMaterial } from '@/api/recitation'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { PageState } from '@/components/ui/PageState'
import { t } from '@/i18n'
import './index.scss'

type PracticeMode = 'full' | 'cloze'

function createCloze(content: string) {
  let group = 0
  return content.replace(/[\u3400-\u9fff]{2,5}/g, value => {
    group += 1
    return group % 2 === 0 ? '＿'.repeat(value.length) : value
  })
}

export default function RecitationPracticePage() {
  const [materialId, setMaterialId] = useState(0)
  const [material, setMaterial] = useState<RecitationMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [mode, setMode] = useState<PracticeMode>('full')
  const recorderRef = useRef<ReturnType<typeof Taro.getRecorderManager> | null>(null)
  const materialIdRef = useRef(0)

  useLoad(options => {
    const id = Number(options.id)
    setMaterialId(id)
    materialIdRef.current = id
  })

  useEffect(() => {
    if (!materialId) return
    let active = true
    recitationApi
      .getMaterial(materialId)
      .then(result => {
        if (active) setMaterial(result)
      })
      .catch(error => {
        Taro.showToast({
          title: error instanceof Error ? error.message : t('recitation.loadFailed'),
          icon: 'none',
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [materialId])

  useEffect(() => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return
    const manager = Taro.getRecorderManager()
    recorderRef.current = manager
    const onStart = () => {
      setRecording(true)
      setSeconds(0)
    }
    const onStop = async (result: { tempFilePath: string }) => {
      setRecording(false)
      if (!result.tempFilePath || !materialIdRef.current) return
      try {
        setUploading(true)
        const attempt = await recitationApi.createAttempt(
          materialIdRef.current,
          result.tempFilePath,
        )
        Taro.redirectTo({ url: `/pages/recitation-report/index?id=${attempt.id}` })
      } catch (error) {
        Taro.showToast({
          title: error instanceof Error ? error.message : t('recitation.uploadFailed'),
          icon: 'none',
        })
      } finally {
        setUploading(false)
      }
    }
    const onError = () => {
      setRecording(false)
      setUploading(false)
      Taro.showToast({ title: t('recitation.recordFailed'), icon: 'none' })
    }
    manager.onStart(onStart)
    manager.onStop(onStop)
    manager.onError(onError)
    return () => {
      const removableManager = manager as typeof manager & {
        offStart?: (callback: typeof onStart) => void
        offStop?: (callback: typeof onStop) => void
        offError?: (callback: typeof onError) => void
      }
      removableManager.offStart?.(onStart)
      removableManager.offStop?.(onStop)
      removableManager.offError?.(onError)
      recorderRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  const displayContent = useMemo(
    () => (material ? (mode === 'cloze' ? createCloze(material.content) : material.content) : ''),
    [material, mode],
  )

  const startRecording = async () => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
      Taro.showToast({ title: t('recitation.wechatOnly'), icon: 'none' })
      return
    }
    const beginRecording = () => {
      recorderRef.current?.start({
        duration: 600000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      })
    }
    try {
      const settings = await Taro.getSetting()
      const recordPermission = settings.authSetting['scope.record']
      if (recordPermission === true) {
        beginRecording()
        return
      }
      if (recordPermission === false) {
        const result = await Taro.showModal({
          title: t('recitation.permissionTitle'),
          content: t('recitation.permissionBlockedHint'),
          confirmText: t('recitation.openSettings'),
        })
        if (result.confirm) await Taro.openSetting()
        return
      }
      const consent = await Taro.showModal({
        title: t('recitation.permissionTitle'),
        content: t('recitation.permissionHint'),
        confirmText: t('recitation.allowRecording'),
      })
      if (!consent.confirm) return
      await Taro.authorize({ scope: 'scope.record' })
      beginRecording()
    } catch {
      Taro.showToast({ title: t('recitation.permissionDenied'), icon: 'none' })
    }
  }

  const stopRecording = () => recorderRef.current?.stop()

  if (loading) {
    return (
      <View className="page">
        <NavBar title={t('recitation.practice')} showBack />
        <PageState kind="loading" title={t('common.loading')} />
      </View>
    )
  }
  if (!material) {
    return (
      <View className="page">
        <NavBar title={t('recitation.practice')} showBack />
        <PageState kind="error" title={t('recitation.materialMissing')} />
      </View>
    )
  }

  return (
    <View className="page recitation-practice-page">
      <NavBar title={material.title} showBack />
      <View className="recitation-practice-content">
        <View className="recitation-mode-row">
          <Button
            size="sm"
            variant={mode === 'full' ? 'primary' : 'secondary'}
            onClick={() => setMode('full')}
          >
            {t('recitation.fullMode')}
          </Button>
          <Button
            size="sm"
            variant={mode === 'cloze' ? 'primary' : 'secondary'}
            onClick={() => setMode('cloze')}
          >
            {t('recitation.clozeMode')}
          </Button>
        </View>

        <View
          className={`recitation-source-card${recording ? ' recitation-source-card--hidden' : ''}`}
        >
          {recording ? (
            <Text className="recitation-hidden-text">{t('recitation.sourceHidden')}</Text>
          ) : (
            <Text className="recitation-source-text">{displayContent}</Text>
          )}
        </View>

        <View className="recitation-recorder-card">
          <Text className="recitation-record-status">
            {uploading
              ? t('recitation.uploading')
              : recording
                ? t('recitation.recording', { seconds })
                : t('recitation.ready')}
          </Text>
          {recording ? (
            <Button block variant="danger" onClick={stopRecording}>
              {t('recitation.finish')}
            </Button>
          ) : (
            <Button block disabled={uploading} onClick={startRecording}>
              {uploading ? t('recitation.uploading') : t('recitation.start')}
            </Button>
          )}
          <Text className="recitation-record-hint">{t('recitation.recordHint')}</Text>
        </View>
      </View>
    </View>
  )
}
