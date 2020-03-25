// import { FlatListProps, SectionListProps } from 'react-native'

// type FlatList<Item> = React.ComponentType<FlatListProps<Item>>

// type SectionList<Item> = React.ComponentType<SectionListProps<Item>>

// export function withSwipeableListItems<Item>(list: SectionList<Item>): SectionList<Item>

// export function withSwipeableListItems<Item>(list: FlatList<Item>): FlatList<Item>

// export function withSwipeableListItems<Item>(
//   list: FlatList<Item> | SectionList<Item>
// ): FlatList<Item> | SectionList<Item> {
//   return list
// }

// // tslint:disable: no-this no-class no-expression-statement no-if-statement no-object-mutation

// import React from 'react'
// import { FlatListProps, FlatList, ListRenderItem, Animated } from 'react-native'
// import { Swipeable } from 'react-native-gesture-handler'
// import { assertDefined } from '../utils/asserts'
// import { SwipeableItem } from './SwipeableItem'

// type Props<Item> = FlatListProps<Item> & {
//   readonly closed?: boolean
//   readonly renderRightActions: (
//     item: Item,
//     progressAnimatedValue: Animated.AnimatedInterpolation,
//     dragAnimatedValue: Animated.AnimatedInterpolation
//   ) => React.ReactNode
// }

// export class SwipeableList<Item> extends React.Component<Props<Item>> {

//   // tslint:disable-next-line: readonly-keyword
//   private readonly swipables: { [key: string]: Swipeable | undefined } = {}

//   render(): React.ReactNode {
//     console.warn('list')
//     const { renderRightActions, ...props } = this.props
//     return (
//       <FlatList
//         {...props}
//         renderItem={this.renderItem}
//       />
//     )
//   }

//   componentDidUpdate(): void {
//     if (this.props.closed) {
//       Object.keys(this.swipables).forEach((k) => {
//         this.swipables[k]?.close()
//       })
//     }
//   }

//   private readonly keyExtractor: NonNullable<FlatListProps<Item>['keyExtractor']> = (
//     item,
//     index
//   ) => {
//     const { keyExtractor } = this.props

//     const key = keyExtractor !== undefined
//       ? keyExtractor(item, index)
//       : (item as { readonly key?: string }).key

//     assertDefined(key, 'key')

//     return key
//   }

//   private readonly onSwipeableOpen = (key: string) => {
//     Object.keys(this.swipables).forEach((k) => {
//       if (k !== key) {
//         this.swipables[k]?.close()
//       }
//     })
//   }

//   private readonly removeSwipeable = (itemKey: string) => {
//     this.swipables[itemKey] = undefined
//   }

//   private readonly renderRightActions: Props<Item>['renderRightActions'] = (
//     item,
//     progress,
//     drag
//   ) => (
//     this.props.renderRightActions(item, progress, drag)
//   )

//   private readonly renderItem: ListRenderItem<Item> = (info) => {
//     const { renderItem } = this.props
//     const props = swipeableProps(info)
//     const content = renderItem(info)
//     const { item, index } = info
//     const key = this.keyExtractor(item, index)

//     console.warn('item')

//     return props === undefined ? (
//       content
//     ) : (
//       <SwipeableItem
//         {...props}
//         ref={(ref: Swipeable | null) => {
//           if (ref) {
//             this.swipables[key] = ref
//           }
//         }}
//         onWillOpen={this.onSwipeableOpen}
//         itemKey={key}
//         onUnmount={this.removeSwipeable}
//       >
//         {content}
//       </SwipeableItem>
//     )
//   }
// }

