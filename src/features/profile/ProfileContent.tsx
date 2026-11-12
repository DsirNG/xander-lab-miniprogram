import { FilingNotice } from '@/components/FilingNotice'
import { Skeleton } from '@/components/Skeleton'
import {
  getSessionVersion,
  privateCacheKeys,
  readPrivateCache,
  writePrivateCache,
} from '@/utils/privateCache'
import { ensureLogin } from '@/store/user'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { authApi } from '@/api/auth'
import { formatPoints } from '@/api/points'
import { profileApi, type ProfileOverview } from '@/api/profile'
import { tokenStorage } from '@/api/http'
import { Icon } from '@/components/Icon'
import { usePanelActive } from '@/hooks/usePanelActive'
import { t, useLocale } from '@/i18n'

import { useUserStore } from '@/store/user'

function ProfileMenuRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  value?: ReactNode
  onClick: () => void
}) {
  return (
    <View
      className="menu-row profile-menu-row"
      hoverClass="profile-menu-row--pressed"
      onClick={onClick}
    >
      <View className="menu-icon">
        <Icon name={icon} />
      </View>
      <Text className="menu-label">{label}</Text>
      {value != null ? <View className="profile-menu-value">{value}</View> : null}
      <Icon name="right" className="menu-arrow-icon" />
    </View>
  )
}

export type ProfileContentProps = {
  /** True while the Profile panel is the visible MainShell panel. */
  active: boolean
  refreshVersion?: number
}

export function ProfileContent({ active, refreshVersion = 0 }: ProfileContentProps) {
  useLocale()
  const user = useUserStore(state => state.user)
  const loaded = useUserStore(state => state.loaded)
  const [loadingSummary, setLoadingSummary] = useState(() => authApi.isLoggedIn())
  const setUser = useUserStore(state => state.setUser)
  const [summary, setSummary] = useState(() =>
    readPrivateCache<Pick<ProfileOverview, 'points' | 'blogCount'>>(
      privateCacheKeys.profileSummary,
    ),
  )
  const balance = summary?.points ?? null
  const overviewRequestRef = useRef(false)
  const overviewFreshRef = useRef({ token: '', at: 0 })
  const handledRefreshVersionRef = useRef(refreshVersion)

  const clearOverview = useCallback(() => {
    setUser(null)
    setSummary(null)
  }, [setUser])

  const refreshOverview = useCallback(
    async (force = false) => {
      if (!authApi.isLoggedIn()) {
        clearOverview()
        setLoadingSummary(false)
        return
      }

      const token = tokenStorage.getAccessToken()
      const session = getSessionVersion()
      const cached = overviewFreshRef.current
      if (
        overviewRequestRef.current ||
        (!force && cached.token === token && Date.now() - cached.at < 60_000)
      )
        return
      overviewRequestRef.current = true
      setLoadingSummary(true)
      try {
        const result = await profileApi.overview()
        if (session !== getSessionVersion()) return
        overviewFreshRef.current = { token, at: Date.now() }
        setUser(result.user)
        const next = { points: result.points, blogCount: result.blogCount }
        writePrivateCache(privateCacheKeys.profileSummary, next, session)
        setSummary(next)
      } catch {
        if (session !== getSessionVersion()) return
        if (!authApi.isLoggedIn()) setUser(null)
        if (!authApi.isLoggedIn()) {
          setSummary(null)
        }
      } finally {
        overviewRequestRef.current = false
        setLoadingSummary(false)
      }
    },
    [clearOverview, setUser],
  )

  usePanelActive(active, { onShow: refreshOverview })

  useEffect(() => {
    if (refreshVersion === handledRefreshVersionRef.current) return
    if (!active) return

    handledRefreshVersionRef.current = refreshVersion
    void refreshOverview(true)
  }, [active, refreshOverview, refreshVersion])

  const navigate = useCallback((url: string) => {
    void Taro.navigateTo({ url })
  }, [])

  const navigateForUser = useCallback(
    (url: string) => {
      if (ensureLogin(() => navigate(url))) navigate(url)
    },
    [navigate],
  )

  const handleWechatLogin = () => navigateForUser('/pages/account-profile/index')

  return (
    <View className="page profile-page">
      {!user && !loaded && authApi.isLoggedIn() ? (
        <Skeleton layout="profile" />
      ) : (
        <View
          className="profile-head"
          hoverClass="profile-head--pressed"
          onClick={handleWechatLogin}
        >
          <View className="profile-avatar">
            {user?.avatar ? (
              <Image className="profile-avatar-img" src={user.avatar} mode="aspectFill" />
            ) : (
              <Text>{user ? user.nickname?.charAt(0) || 'X' : 'X'}</Text>
            )}
          </View>
          <View className="profile-identity">
            <View className="profile-name-line">
              <Text className="profile-name">{user ? user.nickname : t('profile.guest')}</Text>
              <Text className="profile-badge">
                {user ? user.tier || t('profile.member') : t('profile.signIn')}
              </Text>
            </View>
            <Text className="profile-role">
              {user ? user.username : t('profile.guestDescription')}
            </Text>
          </View>
        </View>
      )}
      <Text className="profile-section-title">{t('profile.assetsGroup')}</Text>
      <View className="profile-menu-group">
        <ProfileMenuRow
          icon="points"
          label={t('profile.points')}
          value={
            balance == null ? (
              loadingSummary ? (
                <Skeleton layout="profileValue" />
              ) : (
                '--'
              )
            ) : (
              formatPoints(balance)
            )
          }
          onClick={() => navigateForUser('/pages/points/index')}
        />
        <ProfileMenuRow
          icon="crown"
          label={t('profile.subscription')}
          onClick={() => navigateForUser('/pages/subscription/index')}
        />
        <ProfileMenuRow icon="receipt" label={t('orders.title')} onClick={() => navigateForUser('/pages/orders/index')} />
      </View>

      <Text className="profile-section-title">{t('preferences.workspaceGroup')}</Text>
      <View className="profile-menu-group">
        <ProfileMenuRow
          icon="article"
          label={t('profile.blogs')}
          onClick={() => navigateForUser('/pages/blog-manage/index')}
        />
        <ProfileMenuRow
          icon="calendar"
          label={t('profile.plans')}
          onClick={() => navigateForUser('/pages/plans/index')}
        />
        <ProfileMenuRow
          icon="bell"
          label={t('profile.notifications')}
          onClick={() => navigateForUser('/pages/notifications/index')}
        />
      </View>

      <Text className="profile-section-title">{t('profile.generalGroup')}</Text>
      <View className="profile-menu-group">
        <ProfileMenuRow
          icon="settings"
          label={t('profile.settings')}
          onClick={() => navigate('/pages/account-settings/index')}
        />
      </View>
      <FilingNotice />
    </View>
  )
}
