import type { UserInfo } from './auth'
import { request } from './http'

export type ProfileOverview = {
  user: UserInfo
  points: number
  blogCount: number
}

export const profileApi = {
  overview: () => request<ProfileOverview>('/api/profile/overview'),
}
