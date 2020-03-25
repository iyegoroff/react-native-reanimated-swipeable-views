// tslint:disable: no-expression-statement

import React, { useCallback, useEffect } from 'react'
import { Swipeable } from 'react-native-gesture-handler'

type Props = React.ComponentProps<typeof Swipeable> & {
  readonly itemKey: string
  readonly onWillOpen: (itemKey: string) => void
  readonly onUnmount: (itemKey: string) => void
}

const RefSwipeableItem = (
  {
    itemKey,
    onWillOpen,
    onUnmount,
    onSwipeableWillOpen,
    ...restProps
  }: Props & { readonly children: React.ReactNode },
  forwardedRef?: React.Ref<Swipeable>
) => {

  const willOpen = useCallback(() => {
    onWillOpen(itemKey)
    onSwipeableWillOpen?.()
  }, [onWillOpen, itemKey, onSwipeableWillOpen])

  useEffect(() => () => onUnmount(itemKey), [onUnmount, itemKey])

  return (
    <Swipeable
      {...restProps}
      onSwipeableWillOpen={willOpen}
      ref={forwardedRef}
    />
  )
}

export const SwipeableItem = React.forwardRef(RefSwipeableItem)
