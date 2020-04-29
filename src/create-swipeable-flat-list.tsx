import React from 'react'
import { FlatList, ListRenderItemInfo, FlatListProps } from 'react-native'
import { assertIsDefined } from 'ts-is-defined'
import { SwipeableMethods, SwipeableProps } from './swipeable'
import { createSwipeableListItem } from './create-swipeable-list-item'

export function createSwipeableFlatList<
  SP extends Pick<SwipeableProps, 'onChange' | 'direction'>,
  SC extends SwipeableMethods
>(Component: React.ComponentClass<SP>) {
  type ListProps<T> = {
    readonly swipeableProps:
      | Omit<SP, 'direction'>
      | ((info: Omit<ListRenderItemInfo<T>, 'separators'>) => Omit<SP, 'direction'>)
    readonly allowMultiOpen: boolean
  } & FlatListProps<T>

  const ListItem = createSwipeableListItem<SP, SC>(Component)

  return class List<T extends { readonly key?: string }> extends React.Component<ListProps<T>> {
    private readonly ref = React.createRef<FlatList<T>>()
    private readonly itemRefs: { [key: string]: React.RefObject<SC> | undefined } = {}

    static readonly defaultProps = {
      allowMultiOpen: true
    }

    render() {
      return <FlatList {...this.props} ref={this.ref} renderItem={this.renderItem} />
    }

    private readonly renderItem = (info: ListRenderItemInfo<T>) => {
      const { item, index } = info
      const key = item.key ?? this.props.keyExtractor?.(item, index)

      assertIsDefined(key, 'item key should be defined!')

      return (
        <ListItem
          {...this.swipeableProps(info)}
          itemKey={key}
          onMount={this.itemMounted}
          onUnmount={this.itemUnmounted}
          onOpen={this.itemOpened}
        >
          {this.props.renderItem?.(info)}
        </ListItem>
      )
    }

    openTrailing = (itemKey: string) => {
      this.itemRefs[itemKey]?.current?.openTrailing()
    }

    openLeading = (itemKey: string) => {
      this.itemRefs[itemKey]?.current?.openLeading()
    }

    close = (itemKey: string) => {
      this.itemRefs[itemKey]?.current?.close()
    }

    openAllTrailing() {
      Object.keys(this.itemRefs).forEach(this.openTrailing)
    }

    openAllLeading() {
      Object.keys(this.itemRefs).forEach(this.openLeading)
    }

    closeAll() {
      Object.keys(this.itemRefs).forEach(this.close)
    }

    private readonly swipeableProps = (info: Omit<ListRenderItemInfo<T>, 'separators'>) => {
      const { swipeableProps, horizontal } = this.props

      return {
        ...((typeof swipeableProps === 'function' ? swipeableProps(info) : swipeableProps) as SP),
        direction: horizontal ?? false ? ('vertical' as const) : ('horizontal' as const)
      }
    }

    private readonly itemMounted = (itemKey: string, ref: React.RefObject<SC>) => {
      this.itemRefs[itemKey] = ref
    }

    private readonly itemUnmounted = (itemKey: string) => {
      this.itemRefs[itemKey] = undefined
    }

    private readonly itemOpened = (itemKey: string) => {
      const { allowMultiOpen } = this.props

      Object.keys(this.itemRefs).forEach((key: string) => {
        if (key !== itemKey && !allowMultiOpen) {
          this.itemRefs[key]?.current?.close()
        }
      })
    }

    readonly scrollToEnd: FlatList<T>['scrollToEnd'] = (...args) =>
      this.ref.current?.scrollToEnd(...args)

    readonly scrollToIndex: FlatList<T>['scrollToIndex'] = (...args) =>
      this.ref.current?.scrollToIndex(...args)

    readonly scrollToItem: FlatList<T>['scrollToItem'] = (...args) =>
      this.ref.current?.scrollToItem(...args)

    readonly scrollToOffset: FlatList<T>['scrollToOffset'] = (...args) =>
      this.ref.current?.scrollToOffset(...args)

    readonly recordInteraction: FlatList<T>['recordInteraction'] = (...args) =>
      this.ref.current?.recordInteraction(...args)

    readonly flashScrollIndicators: FlatList<T>['flashScrollIndicators'] = (...args) =>
      this.ref.current?.flashScrollIndicators(...args)

    readonly getScrollResponder: FlatList<T>['getScrollResponder'] = (...args) =>
      this.ref.current?.getScrollResponder(...args)

    readonly getNativeScrollRef: FlatList<T>['getNativeScrollRef'] = (...args) =>
      this.ref.current?.getNativeScrollRef(...args)

    readonly getScrollableNode: FlatList<T>['getScrollableNode'] = (...args) =>
      this.ref.current?.getScrollableNode(...args)

    readonly setNativeProps: FlatList<T>['setNativeProps'] = (...args) =>
      this.ref.current?.setNativeProps(...args)
  }
}
