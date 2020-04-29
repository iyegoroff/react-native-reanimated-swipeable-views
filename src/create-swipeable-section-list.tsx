import React from 'react'
import { SectionList, SectionListRenderItemInfo, SectionListProps } from 'react-native'
import { assertIsDefined } from 'ts-is-defined'
import { SwipeableMethods, SwipeableProps } from './swipeable'
import { createSwipeableListItem } from './create-swipeable-list-item'

export function createSwipeableSectionList<
  P extends Pick<SwipeableProps, 'onChange' | 'direction'>,
  C extends SwipeableMethods
>(Component: React.ComponentClass<P>) {
  type ListProps<T> = {
    readonly swipeableProps:
      | Omit<P, 'direction'>
      | ((info: Omit<SectionListRenderItemInfo<T>, 'separators'>) => Omit<P, 'direction'>)
    readonly allowMultiOpen: boolean
  } & SectionListProps<T>

  const ListItem = createSwipeableListItem<P, C>(Component)

  return class List<T extends { readonly key?: string }> extends React.Component<ListProps<T>> {
    private readonly ref = React.createRef<SectionList<T>>()
    private readonly itemRefs: { [key: string]: React.RefObject<C> | undefined } = {}

    static readonly defaultProps = {
      allowMultiOpen: true
    }

    render() {
      return <SectionList {...this.props} ref={this.ref} renderItem={this.renderItem} />
    }

    private readonly renderItem = (info: SectionListRenderItemInfo<T>) => {
      const { item, section, index } = info
      const key = item.key ?? this.props.keyExtractor?.(item, index)

      assertIsDefined(key, 'item key should be defined!')
      assertIsDefined(section.key, 'section key should be defined!')

      return (
        <ListItem
          {...this.swipeableProps(info)}
          itemKey={`${section.key}:${key}`}
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

    private readonly swipeableProps = (info: Omit<SectionListRenderItemInfo<T>, 'separators'>) => {
      const { swipeableProps, horizontal } = this.props

      return {
        ...((typeof swipeableProps === 'function' ? swipeableProps(info) : swipeableProps) as P),
        direction: horizontal ?? false ? ('vertical' as const) : ('horizontal' as const)
      }
    }

    private readonly itemMounted = (itemKey: string, ref: React.RefObject<C>) => {
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

    readonly scrollToLocation: SectionList['scrollToLocation'] = (...args) =>
      this.ref.current?.scrollToLocation(...args)

    readonly recordInteraction: SectionList['recordInteraction'] = (...args) =>
      this.ref.current?.recordInteraction(...args)

    readonly flashScrollIndicators: SectionList['flashScrollIndicators'] = (...args) =>
      this.ref.current?.flashScrollIndicators(...args)

    readonly getScrollResponder: SectionList['getScrollResponder'] = (...args) =>
      this.ref.current?.getScrollResponder(...args)

    readonly getScrollableNode: SectionList['getScrollableNode'] = (...args) =>
      this.ref.current?.getScrollableNode(...args)
  }
}
