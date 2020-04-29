import React from 'react'
import Swipeable, { SwipeableProperties } from 'react-native-gesture-handler/Swipeable'
import { SwipeableMethods, SwipeableProps } from './swipeable'

export class AdaptedSwipeable
  extends React.Component<SwipeableProperties & Pick<SwipeableProps, 'onChange' | 'direction'>>
  implements SwipeableMethods {
  private readonly ref = React.createRef<Swipeable>()

  public render() {
    return (
      <Swipeable {...this.props} ref={this.ref} onSwipeableWillOpen={this.onSwipeableWillOpen} />
    )
  }

  public openLeading() {
    this.ref.current?.openLeft()
  }

  public openTrailing() {
    this.ref.current?.openRight()
  }

  public close() {
    this.ref.current?.close()
  }

  private readonly onSwipeableWillOpen: SwipeableProperties['onSwipeableWillOpen'] = (...args) => {
    const { onChange, onSwipeableWillOpen } = this.props

    onChange?.({
      item: 'leading',
      action: 'opening-threshold-passed',
      method: 'drag'
    })

    onSwipeableWillOpen?.(...args)
  }
}
