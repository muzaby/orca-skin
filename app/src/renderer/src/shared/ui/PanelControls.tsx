import { forwardRef } from 'react'
import { useI18n } from '../i18n'
import { Button, type ButtonProps } from './Button'

type PanelControlProps = Omit<
  ButtonProps,
  'children' | 'iconOnly' | 'leadingIcon' | 'trailingIcon' | 'title' | 'aria-label'
>

export const PanelExpandButton = forwardRef<
  HTMLButtonElement,
  Omit<PanelControlProps, 'expanded' | 'pressed'> & { expanded: boolean; targetLabel?: string }
>(function PanelExpandButton({ expanded, targetLabel, size = 'small', ...props }, ref) {
  const { tr } = useI18n()
  const label = tr(expanded ? 'common.restorePanel' : 'common.expandPanel')
  return (
    <Button
      {...props}
      ref={ref}
      size={size}
      iconOnly
      leadingIcon={expanded ? 'collapse' : 'expand'}
      pressed={expanded}
      aria-pressed={expanded}
      aria-expanded={expanded}
      title={label}
      aria-label={
        targetLabel
          ? tr(expanded ? 'common.restoreNamedPanel' : 'common.expandNamedPanel', {
              label: targetLabel
            })
          : label
      }
    />
  )
})

export const PanelCloseButton = forwardRef<
  HTMLButtonElement,
  PanelControlProps & { label?: string }
>(function PanelCloseButton({ label, size = 'small', ...props }, ref) {
  const { tr } = useI18n()
  return (
    <Button
      {...props}
      ref={ref}
      size={size}
      iconOnly
      leadingIcon="x"
      title={tr('common.close')}
      aria-label={label ?? tr('common.close')}
    />
  )
})
