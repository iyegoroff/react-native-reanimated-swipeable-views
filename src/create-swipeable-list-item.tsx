import React from 'react'
import { SwipeableProps } from './swipeable'

export function createSwipeableListItem<P extends Pick<SwipeableProps, 'onChange'>, C>(
  Component: React.ComponentType<P>
) {
  type Props<P, C> = P & {
    readonly itemKey: string
    readonly onMount: (itemKey: string, ref: React.RefObject<C>) => void
    readonly onUnmount: (itemKey: string) => void
    readonly onOpen: (itemKey: string) => void
  }

  return class ListItem extends React.Component<Props<P, C>> {
    private readonly ref = React.createRef<C>()

    componentDidMount() {
      this.props.onMount(this.props.itemKey, this.ref)
    }

    componentWillUnmount() {
      this.props.onUnmount(this.props.itemKey)
    }

    render() {
      return <Component {...this.props} ref={this.ref} onChange={this.onChange} />
    }

    private readonly onChange: Props<P, C>['onChange'] = (options) => {
      const { onOpen, onChange, itemKey } = this.props

      if (options.action === 'opening-threshold-passed') {
        onOpen(itemKey)
      }

      onChange?.(options)
    }
  }
}
