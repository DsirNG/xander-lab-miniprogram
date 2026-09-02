import { request, uploadFile } from './http'

export type RecitationMaterial = {
  id: number
  title: string
  content: string
  characterCount: number
  knowledgeType: 'RECITATION' | 'CONCEPT' | 'MATH'
  testMode: 'AUDIO_RECITATION' | 'AI_QA' | 'PRACTICE'
  masteryScore: number
  masteryLevel: 'NEW' | 'FAMILIAR' | 'RECALLING' | 'APPLYING' | 'MASTERED'
  reviewCount: number
  lastReviewAt?: string
  nextReviewAt?: string
  createdAt: string
  updatedAt: string
}

export type RecitationDifference = {
  type: 'MISSING' | 'WRONG' | 'EXTRA'
  expected: string
  actual: string
  expectedIndex: number
  contextBefore?: string
  contextAfter?: string
  tailOmission?: boolean
}

export type RecitationResult = {
  normalizedExpected: string
  normalizedActual: string
  correctCount: number
  missingCount: number
  wrongCount: number
  extraCount: number
  score: number
  differences: RecitationDifference[]
}

export type RecitationAttempt = {
  id: number
  materialId: number
  status: 'UPLOADING' | 'PENDING' | 'SUBMITTING' | 'PROCESSING' | 'POLLING' | 'SUCCEEDED' | 'FAILED'
  audioUrl?: string
  transcript?: string
  result?: RecitationResult
  score?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export const recitationApi = {
  listMaterials: () => request<RecitationMaterial[]>('/api/recitations/materials'),
  getMaterial: (id: number) => request<RecitationMaterial>(`/api/recitations/materials/${id}`),
  createMaterial: (
    title: string,
    content: string,
    knowledgeType: RecitationMaterial['knowledgeType'] = 'RECITATION',
  ) =>
    request<RecitationMaterial>('/api/recitations/materials', {
      method: 'POST',
      data: {
        title,
        content,
        knowledgeType,
        testMode:
          knowledgeType === 'RECITATION'
            ? 'AUDIO_RECITATION'
            : knowledgeType === 'MATH'
              ? 'PRACTICE'
              : 'AI_QA',
      },
    }),
  createAttempt: (materialId: number, filePath: string) =>
    uploadFile<RecitationAttempt>(`/api/recitations/materials/${materialId}/attempts`, filePath),
  listAttempts: (materialId: number) =>
    request<RecitationAttempt[]>(`/api/recitations/materials/${materialId}/attempts`),
  getAttempt: (id: number) => request<RecitationAttempt>(`/api/recitations/attempts/${id}`),
}
