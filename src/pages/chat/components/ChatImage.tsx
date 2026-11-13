import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { SkeletonBlock } from '@/components/Skeleton'
import { cachedChatImage, loadChatImage, type CachedChatImage } from '@/utils/chatImageCache'
import { getSessionVersion } from '@/utils/privateCache'
import { logImageFailure } from '@/utils/imageDiagnostics'
import { t, useLocale } from '@/i18n'
import type { ImageToolResult } from '../imageMessage'

let previewFileId = 0

export function ChatImage({
  result,
  onLayout,
}: {
  result: ImageToolResult & { preview?: boolean }
  onLayout?: () => void
}) {
  useLocale()
  const { url, preview } = result
  const [displayed, setDisplayed] = useState<CachedChatImage | undefined>(() =>
    !preview ? cachedChatImage(url) : undefined,
  )
  const [failed, setFailed] = useState(false)
  const ownedFiles = useRef(new Set<string>())

  useEffect(() => {
    let live = true
    const session = getSessionVersion()
    setFailed(false)
    const load = async () => {
      if (!preview) return loadChatImage(url)
      if (process.env.TARO_ENV !== 'weapp') return loadChatImage(url)
      const match = /^data:image\/(png|jpeg|webp|gif);base64,/.exec(url)
      const directory = Taro.env?.USER_DATA_PATH
      if (!match || !directory) throw new Error('Invalid local image preview')
      const fs = Taro.getFileSystemManager()
      const path = `${directory}/agent-preview-${Date.now()}-${++previewFileId}.${match[1]}`
      await new Promise<void>((resolve, reject) =>
        fs.writeFile({
          filePath: path,
          data: url.slice(match[0].length),
          encoding: 'base64',
          success: () => resolve(),
          fail: reject,
        }),
      )
      if (!live || session !== getSessionVersion()) {
        fs.unlink({ filePath: path, fail: () => undefined })
        throw new Error('Image request ended')
      }
      ownedFiles.current.add(path)
      const image = await Taro.getImageInfo({ src: path })
      return { src: path, width: image.width, height: image.height }
    }
    void load()
      .then(image => {
        if (live && session === getSessionVersion()) setDisplayed(image)
      })
      .catch(error => {
        if (!live || session !== getSessionVersion()) return
        logImageFailure(preview ? '' : url, error?.errMsg)
        setFailed(true)
      })
    return () => {
      live = false
    }
  }, [url, preview])

  useEffect(
    () => () => {
      const fs = ownedFiles.current.size ? Taro.getFileSystemManager() : null
      for (const filePath of ownedFiles.current) fs?.unlink({ filePath, fail: () => undefined })
      ownedFiles.current.clear()
    },
    [],
  )

  useEffect(() => {
    onLayout?.()
  }, [displayed, failed, onLayout])

  const scale = displayed ? Math.min(1, 200 / displayed.width, 240 / displayed.height) : 1
  const width = displayed ? Math.round(displayed.width * scale) : 192
  const height = displayed ? Math.round(displayed.height * scale) : 192

  if (!displayed && failed)
    return (
      <View className="msg-generated-image-status">
        <Text>{t('ui.libraryLoadError')}</Text>
      </View>
    )
  return (
    <View
      className="msg-generated-image"
      style={{ width: `${width}px`, height: `${height}px` }}
      ariaRole="button"
      ariaLabel={result.title || t('chat.generatedImage')}
      onClick={
        displayed
          ? () => void Taro.previewImage({ current: displayed.src, urls: [displayed.src] })
          : undefined
      }
    >
      {displayed ? (
        <Image
          className="msg-generated-image-content"
          src={displayed.src}
          mode="aspectFit"
          style={{ width: `${width}px`, height: `${height}px` }}
        />
      ) : (
        <View className="msg-generated-image-skeleton">
          <SkeletonBlock width="100%" height="100%" />
        </View>
      )}
    </View>
  )
}
