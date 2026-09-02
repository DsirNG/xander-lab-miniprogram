import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { TabBar } from '@/components/TabBar'
import { NavBar } from '@/components/NavBar'
import { authApi } from '@/api/auth'
import { profileApi } from '@/api/profile'
import { formatPoints } from '@/api/points'
import { t } from '@/i18n'
import { useUserStore } from '@/store/user'
import './index.scss'

function showToast(title: string) {
  Taro.showToast({ title, icon: 'none' })
}

function ProfileMenuRow({
  icon,
  label,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
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
      <Icon name="right" className="menu-arrow-icon" />
    </View>
  )
}

export default function Profile() {
  const user = useUserStore(state => state.user)
  const setUser = useUserStore(state => state.setUser)
  const [balance, setBalance] = useState<number | null>(null)
  const [blogCount, setBlogCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    if (!authApi.isLoggedIn()) {
      setUser(null)
      setBalance(null)
      setBlogCount(null)
      return
    }

    profileApi
      .overview()
      .then(result => {
        setUser(result.user)
        setBalance(result.points)
        setBlogCount(result.blogCount)
      })
      .catch(() => {
        if (!authApi.isLoggedIn()) setUser(null)
        setBalance(null)
        setBlogCount(null)
      })
  })

  const navigate = (url: string) => {
    Taro.navigateTo({ url })
  }

  const navigateForUser = (url: string) => {
    navigate(user ? url : '/pages/login/index')
  }

  const handleWechatLogin = async () => {
    if (user) {
      navigate('/pages/account-settings/index')
      return
    }
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
      navigate('/pages/login/index')
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) {
        showToast(t('login.wxCredentialFailed'))
        return
      }
      const response = await authApi.wechatLogin(loginResult.code)
      if (response.pendingBind) {
        navigate('/pages/login/index?autologin=1')
        return
      }
      setUser(response.userInfo ?? null)
      showToast(t('login.loginSuccess'))
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const showComingSoon = () => showToast(t('profile.comingSoon'))

  return (
    <View className="page profile-page">
      <NavBar left={<Text className="profile-nav-title">{t('profile.title')}</Text>} />

      <View
        className={`profile-head${loading ? ' profile-head--loading' : ''}`}
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

      <View className="profile-stats-card">
        <View
          className="profile-stat"
          hoverClass="profile-stat--pressed"
          onClick={() => navigateForUser('/pages/points/index')}
        >
          <View className="profile-stat-label">
            <Icon name="points" />
            <Text>{t('profile.points')}</Text>
          </View>
          <Text className="profile-stat-value">
            {balance == null ? '--' : formatPoints(balance)}
          </Text>
        </View>
        <View className="profile-stat-divider" />
        <View
          className="profile-stat"
          hoverClass="profile-stat--pressed"
          onClick={() => navigateForUser('/pages/blog-manage/index')}
        >
          <View className="profile-stat-label">
            <Icon name="article" />
            <Text>{t('profile.blogCount')}</Text>
          </View>
          <Text className="profile-stat-value">{blogCount == null ? '--' : blogCount}</Text>
        </View>
      </View>

      <View className="profile-menu-group profile-menu-group--primary">
        <ProfileMenuRow
          icon="star"
          label={t('profile.subscription')}
          onClick={() => navigateForUser('/pages/subscription/index')}
        />
        <ProfileMenuRow
          icon="star"
          label={t('profile.recitation')}
          onClick={() => navigateForUser('/pages/recitation/index')}
        />
        <ProfileMenuRow
          icon="calendar"
          label={t('profile.plans')}
          onClick={() => navigateForUser('/pages/plans/index')}
        />
        <ProfileMenuRow
          icon="article"
          label={t('profile.blogs')}
          onClick={() => navigateForUser('/pages/blog-manage/index')}
        />
      </View>

      <View className="profile-menu-group profile-menu-group--secondary">
        <ProfileMenuRow
          icon="chat"
          label={t('profile.notifications')}
          onClick={() => navigateForUser('/pages/notifications/index')}
        />
        <ProfileMenuRow icon="star" label={t('profile.favorites')} onClick={showComingSoon} />
        <ProfileMenuRow icon="discover" label={t('profile.help')} onClick={showComingSoon} />
        <ProfileMenuRow icon="chat" label={t('profile.feedback')} onClick={showComingSoon} />
        <ProfileMenuRow
          icon="user"
          label={t('profile.settings')}
          onClick={() => navigateForUser('/pages/account-settings/index')}
        />
      </View>

      <TabBar active="user" />
    </View>
  )
}
