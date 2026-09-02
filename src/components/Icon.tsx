import { Image } from '@tarojs/components'

const icons = {
  discover: require('@/assets/icons/discover.svg'),
  article: require('@/assets/icons/article.svg'),
  chat: require('@/assets/icons/chat.svg'),
  calendar: require('@/assets/icons/calendar.svg'),
  star: require('@/assets/icons/star.svg'),
  user: require('@/assets/icons/user.svg'),
  search: require('@/assets/icons/search.svg'),
  eye: require('@/assets/icons/eye.svg'),
  back: require('@/assets/icons/back.svg'),
  home: require('@/assets/icons/home.svg'),
  more: require('@/assets/icons/more.svg'),
  plus: require('@/assets/icons/plus.svg'),
  send: require('@/assets/icons/send.svg'),
  play: require('@/assets/icons/play.svg'),
  pause: require('@/assets/icons/pause.svg'),
  trash: require('@/assets/icons/trash.svg'),
  edit: require('@/assets/icons/edit.svg'),
  refresh: require('@/assets/icons/refresh.svg'),
  clock: require('@/assets/icons/clock.svg'),
  right: require('@/assets/icons/right.svg'),
  logout: require('@/assets/icons/logout.svg'),
  points: require('@/assets/icons/points.svg'),
  close: require('@/assets/icons/close.svg'),
}

export function Icon({ name, className = '' }: { name: keyof typeof icons; className?: string }) {
  return <Image className={`icon ${className}`} src={icons[name]} mode="aspectFit" />
}
