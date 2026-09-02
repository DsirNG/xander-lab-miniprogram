import { Text } from '@tarojs/components'
import {
  PLAN_STATUS_CLASS,
  PLAN_STATUS_TEXT,
  RUN_STATUS_CLASS,
  RUN_STATUS_TEXT,
} from '@/utils/format'

export function PlanStatusBadge({ status }: { status: string }) {
  return (
    <Text className={`badge ${PLAN_STATUS_CLASS[status] || 'badge-gray'}`}>
      {PLAN_STATUS_TEXT[status] || status}
    </Text>
  )
}

export function RunStatusBadge({ status }: { status: string }) {
  return (
    <Text className={`badge ${RUN_STATUS_CLASS[status] || 'badge-gray'}`}>
      {RUN_STATUS_TEXT[status] || status}
    </Text>
  )
}
