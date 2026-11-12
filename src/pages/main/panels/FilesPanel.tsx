import { API_ORIGIN } from '@/api/http'
import { absoluteMediaUrl } from '@/pages/chat/imageMessage'
import { logImageFailure } from '@/utils/imageDiagnostics'
import { Skeleton, SkeletonBlock } from '@/components/Skeleton'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { authApi } from '@/api/auth'
import { libraryApi, type LibraryImage } from '@/api/library'
import { NavBar } from '@/components/NavBar'
import { t, useLocale } from '@/i18n'
import { ensureLogin, useUserStore } from '@/store/user'

export function FilesPanel({
  active,
  refreshVersion,
}: {
  active: boolean
  refreshVersion: number
}) {
  useLocale()
  const username = useUserStore(state => state.user?.username)
  const signedIn = authApi.isLoggedIn()

  return (
    <View className={`main-panel main-panel--files ${active ? 'is-active' : ''}`} hidden={!active}>
      <NavBar title={t('ui.files')} />
      {signedIn ? (
        <LibraryList key={`${username}:${refreshVersion}`} active={active} />
      ) : (
        <View className="library-status">
          <Text>{t('ui.librarySignIn')}</Text>
          <View className="library-action" onClick={() => ensureLogin()}>
            {t('ui.signIn')}
          </View>
        </View>
      )}
    </View>
  )
}

function LibraryList({ active }: { active: boolean }) {
  const [attempt, setAttempt] = useState(0)
  const [images, setImages] = useState<LibraryImage[]>([])
  const [visited, setVisited] = useState(active)
  useEffect(() => {
    if (active) setVisited(true)
  }, [active])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!visited) return
    let cancelled = false
    void libraryApi
      .images()
      .then(next => {
        if (cancelled) return
        setImages(next.map(image => ({ ...image, url: absoluteMediaUrl(image.url, API_ORIGIN) })))
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [visited, attempt])

  return (
    <ScrollView scrollY className="main-panel__scroll">
      <View className="library-content">
        <View className="library-grid">
          {images.map(image => (
            <LibraryThumbnail
              key={`${image.id}:${image.url}`}
              image={image}
              onPreview={() =>
                Taro.previewImage({ current: image.url, urls: images.map(item => item.url) })
              }
            />
          ))}
        </View>

        {status === 'loading' && <Skeleton layout="images" count={9} />}
        {status === 'error' && (
          <View className="library-status">
            <Text>{t('ui.libraryLoadError')}</Text>
            <View
              className="library-action"
              onClick={() => {
                setStatus('loading')
                setAttempt(attempt + 1)
              }}
            >
              {t('ui.retry')}
            </View>
          </View>
        )}
        {status === 'ready' && images.length === 0 && (
          <View className="library-status">{t('ui.libraryNoImages')}</View>
        )}
      </View>
    </ScrollView>
  )
}

function LibraryThumbnail({ image, onPreview }: { image: LibraryImage; onPreview: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  return (
    <View className="library-thumbnail" onClick={state === 'ready' ? onPreview : state === 'error' ? () => { setState('loading'); setAttempt(n => n + 1) } : undefined}>
      {state === 'loading' && <SkeletonBlock height="100%" />}
      {state === 'error' && (
        <View className="library-thumbnail-error">
          <Text>{t('ui.libraryLoadError')}</Text>
          <Text>{t('ui.retry')}</Text>
        </View>
      )}
      <Image
        key={attempt}
        className={`library-image ${state === 'ready' ? 'is-ready' : ''}`}
        mode="aspectFill"
        lazyLoad
        src={image.url}
        ariaLabel={image.originalName}
        onLoad={() => setState('ready')}
        onError={event => { logImageFailure(image.url, event.detail?.errMsg); setState('error') }}
      />
    </View>
  )
}
