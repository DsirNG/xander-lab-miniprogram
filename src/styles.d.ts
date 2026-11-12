declare module '*.scss' {}

declare namespace JSX {
  interface IntrinsicElements {
    'native-chat-drawer': {
      className?: string
      opened: boolean
      enabled: boolean
      travel: number
      onGesturephase: (event: { detail: { phase: 'start' | 'end'; open?: boolean } }) => void
      children?: import('react').ReactNode
    }
  }
}
