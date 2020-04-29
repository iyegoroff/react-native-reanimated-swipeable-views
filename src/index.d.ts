import React from 'react'
import {
  FlatListProps,
  SectionListProps,
  SectionListRenderItemInfo,
  ListRenderItemInfo,
  FlatList,
  SectionList
} from 'react-native'
import { SwipeableProperties } from 'react-native-gesture-handler/Swipeable'
import Animated from 'react-native-reanimated'
import { PanGestureHandlerProperties } from 'react-native-gesture-handler'

type Item = 'leading' | 'trailing'

export type SwipeableItemProps = {
  readonly gapSize: Animated.Node<number>
  readonly itemWidth: Animated.Node<number>
  readonly item?: Item
}

export type SwipeableProps = {
  readonly direction: 'vertical' | 'horizontal'
  readonly renderLeadingItem?: React.ComponentType<SwipeableItemProps>
  readonly renderTrailingItem?: React.ComponentType<SwipeableItemProps>
  readonly overshootLeading?: boolean
  readonly overshootTrailing?: boolean
  readonly leadingThreshold?: number
  readonly trailingThreshold?: number
  readonly limitsEnabled?: boolean
  readonly clippingEnabled?: boolean
  readonly inertia?: number
  readonly springConfig?: Omit<Animated.SpringConfig, 'toValue'>
  readonly transitionConfig?: Omit<Animated.TimingConfig, 'toValue'>
  readonly panGestureHandlerProps?: PanGestureHandlerProperties
  readonly onChange?: (options: {
    readonly item: Item
    readonly action: 'opened' | 'closed' | 'opening-threshold-passed' | 'closing-threshold-passed'
    readonly method: 'drag' | 'swipe' | 'transition'
  }) => void
}

export declare class Swipeable extends React.Component<SwipeableProps> {
  openTrailing(): void
  openLeading(): void
  close(): void
}

type ListProps<Props, Info> = {
  readonly swipeableProps:
    | Omit<Props, 'direction'>
    | ((info: Omit<Info, 'separators'>) => Omit<Props, 'direction'>)
  readonly allowMultiOpen?: boolean
}

export declare class SwipeableFlatList<T> extends React.Component<
  ListProps<SwipeableProps, ListRenderItemInfo<T>> & FlatListProps<T>
> {
  openTrailing(itemKey: string): void
  openLeading(itemKey: string): void
  close(itemKey: string): void
  openAllTrailing(): void
  openAllLeading(): void
  closeAll(): void
  readonly scrollToEnd: FlatList<T>['scrollToEnd']
  readonly scrollToIndex: FlatList<T>['scrollToIndex']
  readonly scrollToItem: FlatList<T>['scrollToItem']
  readonly scrollToOffset: FlatList<T>['scrollToOffset']
  readonly recordInteraction: FlatList<T>['recordInteraction']
  readonly flashScrollIndicators: FlatList<T>['flashScrollIndicators']
  readonly getScrollResponder: FlatList<T>['getScrollResponder']
  readonly getNativeScrollRef: FlatList<T>['getNativeScrollRef']
  readonly getScrollableNode: FlatList<T>['getScrollableNode']
  readonly setNativeProps: FlatList<T>['setNativeProps']
}

export declare class AdaptedSwipeableFlatList<T> extends React.Component<
  ListProps<SwipeableProperties, ListRenderItemInfo<T>> & FlatListProps<T>
> {
  openTrailing(itemKey: string): void
  openLeading(itemKey: string): void
  close(itemKey: string): void
  openAllTrailing(): void
  openAllLeading(): void
  closeAll(): void
  readonly scrollToEnd: FlatList<T>['scrollToEnd']
  readonly scrollToIndex: FlatList<T>['scrollToIndex']
  readonly scrollToItem: FlatList<T>['scrollToItem']
  readonly scrollToOffset: FlatList<T>['scrollToOffset']
  readonly recordInteraction: FlatList<T>['recordInteraction']
  readonly flashScrollIndicators: FlatList<T>['flashScrollIndicators']
  readonly getScrollResponder: FlatList<T>['getScrollResponder']
  readonly getNativeScrollRef: FlatList<T>['getNativeScrollRef']
  readonly getScrollableNode: FlatList<T>['getScrollableNode']
  readonly setNativeProps: FlatList<T>['setNativeProps']
}

export declare class SwipeableSectionList<T> extends React.Component<
  ListProps<SwipeableProps, SectionListRenderItemInfo<T>> & SectionListProps<T>
> {
  openTrailing(itemKey: string): void
  openLeading(itemKey: string): void
  close(itemKey: string): void
  openAllTrailing(): void
  openAllLeading(): void
  closeAll(): void
  readonly scrollToLocation: SectionList<T>['scrollToLocation']
  readonly recordInteraction: SectionList<T>['recordInteraction']
  readonly flashScrollIndicators: SectionList<T>['flashScrollIndicators']
  readonly getScrollResponder: SectionList<T>['getScrollResponder']
  readonly getScrollableNode: SectionList<T>['getScrollableNode']
}

export declare class AdaptedSwipeableSectionList<T> extends React.Component<
  ListProps<SwipeableProperties, SectionListRenderItemInfo<T>> & SectionListProps<T>
> {
  openTrailing(itemKey: string): void
  openLeading(itemKey: string): void
  close(itemKey: string): void
  openAllTrailing(): void
  openAllLeading(): void
  closeAll(): void
  readonly scrollToLocation: SectionList<T>['scrollToLocation']
  readonly recordInteraction: SectionList<T>['recordInteraction']
  readonly flashScrollIndicators: SectionList<T>['flashScrollIndicators']
  readonly getScrollResponder: SectionList<T>['getScrollResponder']
  readonly getScrollableNode: SectionList<T>['getScrollableNode']
}
