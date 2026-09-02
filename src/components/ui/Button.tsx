import type { ComponentProps } from 'react'
import { Button as TaroButton } from '@tarojs/components'
import './Button.scss'

type NativeButtonProps = ComponentProps<typeof TaroButton>

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends Omit<NativeButtonProps, 'className' | 'size'> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  hoverClass,
  ...props
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    block ? 'ui-button--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <TaroButton {...props} className={classes} hoverClass={hoverClass ?? 'ui-button--pressed'} />
  )
}
