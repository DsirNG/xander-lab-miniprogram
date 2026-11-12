import { request } from './http'

export type LibraryImage = { id: number; url: string; originalName: string }
export const libraryApi = {
  images: () => request<LibraryImage[]>('/api/blog/media/images?scope=all'),
}
