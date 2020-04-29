import { createSwipeableFlatList } from './create-swipeable-flat-list'
import { createSwipeableSectionList } from './create-swipeable-section-list'
import { Swipeable } from './swipeable'
import { AdaptedSwipeable } from './adapted-swipeable'

export { Swipeable } from './swipeable'

export class SwipeableFlatList<T extends { readonly key?: string }> extends createSwipeableFlatList<
  React.ComponentProps<typeof Swipeable>,
  Swipeable
>(Swipeable)<T> {}

export class AdaptedSwipeableFlatList<
  T extends { readonly key?: string }
> extends createSwipeableFlatList<React.ComponentProps<typeof AdaptedSwipeable>, AdaptedSwipeable>(
  AdaptedSwipeable
)<T> {}

export class SwipeableSectionList<
  T extends { readonly key?: string }
> extends createSwipeableSectionList<React.ComponentProps<typeof Swipeable>, Swipeable>(Swipeable)<
  T
> {}

export class AdaptedSwipeableSectionList<
  T extends { readonly key?: string }
> extends createSwipeableSectionList<
  React.ComponentProps<typeof AdaptedSwipeable>,
  AdaptedSwipeable
>(AdaptedSwipeable)<T> {}
