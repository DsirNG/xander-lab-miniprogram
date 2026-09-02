import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { recitationApi, type RecitationAttempt, type RecitationDifference } from '@/api/recitation'
import { NavBar } from '@/components/NavBar'
import { Button } from '@/components/ui/Button'
import { PageState } from '@/components/ui/PageState'
import { t } from '@/i18n'
import './index.scss'

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED'])

function differenceText(difference: RecitationDifference) {
  if (difference.type === 'MISSING')
    return t('recitation.missingDetail', { expected: difference.expected })
  if (difference.type === 'EXTRA') return t('recitation.extraDetail', { actual: difference.actual })
  return t('recitation.wrongDetail', { expected: difference.expected, actual: difference.actual })
}

function differenceLabel(difference: RecitationDifference) {
  if (difference.type === 'MISSING') return t('recitation.missing')
  if (difference.type === 'EXTRA') return t('recitation.extra')
  return t('recitation.wrong')
}

function groupReportDifferences(
  source: RecitationDifference[],
  normalizedExpected: string,
): RecitationDifference[] {
  const grouped: RecitationDifference[] = []
  source.forEach(current => {
    const previous = grouped[grouped.length - 1]
    const previousLength = previous ? Array.from(previous.expected).length : 0
    const adjacent =
      previous?.type === current.type &&
      (current.type === 'EXTRA'
        ? previous.expectedIndex === current.expectedIndex
        : previous.expectedIndex + previousLength === current.expectedIndex)
    if (previous && adjacent) {
      previous.expected += current.expected
      previous.actual += current.actual
      return
    }
    grouped.push({ ...current })
  })

  const expectedCharacters = Array.from(normalizedExpected)
  return grouped.map(difference => {
    const expectedLength = Array.from(difference.expected).length
    const endIndex = Math.min(expectedCharacters.length, difference.expectedIndex + expectedLength)
    return {
      ...difference,
      contextBefore:
        difference.contextBefore ??
        expectedCharacters
          .slice(Math.max(0, difference.expectedIndex - 8), difference.expectedIndex)
          .join(''),
      contextAfter:
        difference.contextAfter ?? expectedCharacters.slice(endIndex, endIndex + 8).join(''),
      tailOmission:
        difference.tailOmission ??
        (difference.type === 'MISSING' && endIndex === expectedCharacters.length),
    }
  })
}

export default function RecitationReportPage() {
  const [attemptId, setAttemptId] = useState(0)
  const [attempt, setAttempt] = useState<RecitationAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const audioRef = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null)

  useLoad(options => setAttemptId(Number(options.id)))

  useEffect(() => {
    if (!attemptId) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const current = await recitationApi.getAttempt(attemptId)
        if (!active) return
        setAttempt(current)
        setLoading(false)
        if (!TERMINAL_STATUSES.has(current.status)) timer = setTimeout(load, 2000)
      } catch (error) {
        if (!active) return
        setLoading(false)
        Taro.showToast({
          title: error instanceof Error ? error.message : t('recitation.reportFailed'),
          icon: 'none',
        })
      }
    }
    void load()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [attemptId])

  useEffect(
    () => () => {
      audioRef.current?.destroy()
      audioRef.current = null
    },
    [],
  )

  const playAudio = () => {
    if (!attempt?.audioUrl) return
    audioRef.current?.destroy()
    const audio = Taro.createInnerAudioContext()
    audio.src = attempt.audioUrl
    audio.play()
    audioRef.current = audio
  }

  if (loading) {
    return (
      <View className="page">
        <NavBar title={t('recitation.report')} showBack />
        <PageState
          kind="loading"
          title={t('recitation.processing')}
          description={t('recitation.processingHint')}
        />
      </View>
    )
  }
  if (!attempt) {
    return (
      <View className="page">
        <NavBar title={t('recitation.report')} showBack />
        <PageState kind="error" title={t('recitation.reportFailed')} />
      </View>
    )
  }
  if (attempt.status === 'FAILED') {
    return (
      <View className="page">
        <NavBar title={t('recitation.report')} showBack />
        <PageState
          kind="error"
          title={t('recitation.recognitionFailed')}
          description={attempt.errorMessage || t('recitation.tryAgain')}
        />
      </View>
    )
  }
  if (attempt.status !== 'SUCCEEDED' || !attempt.result) {
    return (
      <View className="page">
        <NavBar title={t('recitation.report')} showBack />
        <PageState
          kind="loading"
          title={t('recitation.processing')}
          description={t('recitation.processingHint')}
        />
      </View>
    )
  }

  const result = attempt.result
  const differences = groupReportDifferences(result.differences, result.normalizedExpected)
  return (
    <View className="page recitation-report-page">
      <NavBar title={t('recitation.report')} showBack />
      <View className="recitation-report-content">
        <View className="recitation-score-card">
          <Text className="recitation-score-label">{t('recitation.accuracy')}</Text>
          <Text className="recitation-score-value">
            {Number(attempt.score ?? result.score).toFixed(1)}
          </Text>
          <Text className="recitation-score-unit">/ 100</Text>
        </View>

        <View className="recitation-stats-row">
          <View className="recitation-stat">
            <Text>{result.correctCount}</Text>
            <Text>{t('recitation.correct')}</Text>
          </View>
          <View className="recitation-stat">
            <Text>{result.missingCount}</Text>
            <Text>{t('recitation.missing')}</Text>
          </View>
          <View className="recitation-stat">
            <Text>{result.wrongCount}</Text>
            <Text>{t('recitation.wrong')}</Text>
          </View>
          <View className="recitation-stat">
            <Text>{result.extraCount}</Text>
            <Text>{t('recitation.extra')}</Text>
          </View>
        </View>

        {attempt.audioUrl ? (
          <Button block variant="secondary" onClick={playAudio}>
            {t('recitation.playAudio')}
          </Button>
        ) : null}

        <View className="recitation-report-section">
          <Text className="recitation-report-title">{t('recitation.transcript')}</Text>
          <Text className="recitation-report-text">{attempt.transcript}</Text>
        </View>

        <View className="recitation-report-section">
          <View className="recitation-report-heading">
            <Text className="recitation-report-title">{t('recitation.differences')}</Text>
            <Text className="recitation-report-count">
              {t('recitation.differenceCount', { count: differences.length })}
            </Text>
          </View>
          {differences.length === 0 ? (
            <Text className="recitation-perfect">{t('recitation.perfect')}</Text>
          ) : (
            differences.map((difference, index) => (
              <View
                key={`${difference.expectedIndex}-${index}`}
                className={`recitation-difference recitation-difference--${difference.type.toLowerCase()}`}
              >
                <View className="recitation-difference-heading">
                  <Text className="recitation-difference-badge">{differenceLabel(difference)}</Text>
                  <Text className="recitation-difference-position">
                    {t('recitation.differencePosition', {
                      position: difference.expectedIndex + 1,
                    })}
                  </Text>
                </View>
                {difference.tailOmission ? (
                  <Text className="recitation-tail-warning">{t('recitation.tailOmission')}</Text>
                ) : null}
                {difference.contextBefore || difference.contextAfter ? (
                  <Text className="recitation-difference-context">
                    {difference.contextBefore}
                    {difference.expected ? (
                      <Text className="recitation-difference-focus">{difference.expected}</Text>
                    ) : null}
                    {difference.contextAfter}
                  </Text>
                ) : null}
                <Text className="recitation-difference-detail">{differenceText(difference)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  )
}
