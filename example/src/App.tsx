import React from 'react'
import {
  View,
  StyleSheet,
  ViewStyle,
  LayoutChangeEvent,
  StatusBar,
  FlatListProps,
  Text,
  ListRenderItemInfo,
  Button
} from 'react-native'
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerProperties,
  FlatList
} from 'react-native-gesture-handler'
import OriginalSwipeable from 'react-native-gesture-handler/Swipeable'
import Animated, {
  and,
  or,
  set,
  Value,
  multiply,
  sub,
  add,
  cond,
  event,
  eq,
  lessOrEq,
  Clock,
  clockRunning,
  startClock,
  spring,
  stopClock,
  SpringUtils,
  neq,
  greaterThan,
  lessThan,
  greaterOrEq,
  not,
  block,
  timing,
  Easing,
  call,
  max,
  min,
  divide,
  defined,
  proc
} from 'react-native-reanimated'
import invariant from 'ts-tiny-invariant'

function assertDefined<T>(value: T, message: string): asserts value is NonNullable<T> {
  invariant(value !== undefined && value !== null, message)
}

enum Spring {
  none,
  leading,
  middle,
  trailing
}

enum Limit {
  none,
  leading,
  trailing
}

enum Transition {
  none,
  openLeading,
  openTrailing,
  close
}

enum TranslationState {
  closed,
  leadingOpeningThresholdPassed,
  leadingOpened,
  leadingClosingThresholdPassed,
  leadingClosed,
  trailingOpeningThresholdPassed,
  trailingOpened,
  trailingClosingThresholdPassed,
  trailingClosed
}

const panGestureHandlerActiveOffset = [-20, 20]
const limitThreshold = 0.1

const defaultSwipeableSpringConfig = SpringUtils.makeConfigFromBouncinessAndSpeed({
  ...SpringUtils.makeDefaultConfig(),
  bounciness: 0,
  speed: 5
})

const defaultSwipeableTransitionConfig = {
  duration: 200,
  easing: Easing.linear
}

type Item = 'left' | 'right' | 'top' | 'bottom'

type AnimationMethod = 'drag' | 'swipe' | 'transition'

const isTrailingOpeningThresholdPassed = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    leadingThreshold: Animated.Node<number>,
    leadingSnapPoint: Animated.Node<number>,
    hasTrailingItem: boolean
  ) =>
    and(
      or(
        eq(translationState, TranslationState.trailingClosed),
        eq(translationState, TranslationState.leadingClosed),
        eq(translationState, TranslationState.closed),
        eq(translationState, TranslationState.trailingClosingThresholdPassed)
      ),
      and(lessOrEq(translation, leadingThreshold), greaterThan(translation, leadingSnapPoint)),
      defined(hasTrailingItem)
    )
)

const isTrailingOpened = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    leadingSnapPoint: Animated.Node<number>,
    hasTrailingItem: boolean
  ) =>
    and(
      eq(translationState, TranslationState.trailingOpeningThresholdPassed),
      lessOrEq(translation, leadingSnapPoint),
      defined(hasTrailingItem)
    )
)

const isTrailingClosingThresholdPassed = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    leadingThreshold: Animated.Node<number>,
    middleSnapPoint: Animated.Node<number>,
    hasTrailingItem: boolean
  ) =>
    and(
      or(
        eq(translationState, TranslationState.trailingOpened),
        eq(translationState, TranslationState.trailingOpeningThresholdPassed)
      ),
      and(lessThan(translation, middleSnapPoint), greaterThan(translation, leadingThreshold)),
      defined(hasTrailingItem)
    )
)

const isTrailingClosed = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    middleSnapPoint: Animated.Node<number>,
    hasTrailingItem: boolean
  ) =>
    and(
      eq(translationState, TranslationState.trailingClosingThresholdPassed),
      greaterOrEq(translation, middleSnapPoint),
      defined(hasTrailingItem)
    )
)

const isLeadingOpeningThresholdPassed = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    trailingThreshold: Animated.Node<number>,
    trailingSnapPoint: Animated.Node<number>,
    hasLeadingItem: boolean
  ) =>
    and(
      or(
        eq(translationState, TranslationState.leadingClosed),
        eq(translationState, TranslationState.trailingClosed),
        eq(translationState, TranslationState.closed),
        eq(translationState, TranslationState.leadingClosingThresholdPassed)
      ),
      and(greaterOrEq(translation, trailingThreshold), lessThan(translation, trailingSnapPoint)),
      defined(hasLeadingItem)
    )
)

const isLeadingOpened = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    trailingSnapPoint: Animated.Node<number>,
    hasLeadingItem: boolean
  ) =>
    and(
      eq(translationState, TranslationState.leadingOpeningThresholdPassed),
      greaterOrEq(translation, trailingSnapPoint),
      defined(hasLeadingItem)
    )
)

const isLeadingClosingThresholdPassed = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    trailingThreshold: Animated.Node<number>,
    middleSnapPoint: Animated.Node<number>,
    hasLeadingItem: boolean
  ) =>
    and(
      or(
        eq(translationState, TranslationState.leadingOpened),
        eq(translationState, TranslationState.leadingOpeningThresholdPassed)
      ),
      and(greaterThan(translation, middleSnapPoint), lessThan(translation, trailingThreshold)),
      defined(hasLeadingItem)
    )
)

const isLeadingClosed = proc(
  (
    translationState: Animated.Node<TranslationState>,
    translation: Animated.Node<number>,
    middleSnapPoint: Animated.Node<number>,
    hasLeadingItem: boolean
  ) =>
    and(
      eq(translationState, TranslationState.leadingClosingThresholdPassed),
      lessOrEq(translation, middleSnapPoint),
      defined(hasLeadingItem)
    )
)

type SwipeableItemProps = {
  readonly gapSize: Animated.Node<number>
  readonly itemWidth: Animated.Node<number>
  readonly item?: Item
}

type Props = {
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
  readonly panGestureHandlerConfig?: PanGestureHandlerProperties
  readonly onDragStart?: () => void
  readonly onDragEnd?: () => void
  readonly onChange?: (options: {
    readonly item: Item
    readonly action: 'opened' | 'closed' | 'opening-threshold-passed' | 'closing-threshold-passed'
    readonly method: AnimationMethod
  }) => void
}

class Swipeable extends React.Component<Props> {
  private readonly leadingSize = new Value<number>(0)
  private readonly trailingOffset = new Value<number>(0)
  private readonly size = new Value<number>(0)
  private readonly transition = new Value<Transition>(Transition.none)
  private readonly resetSpring = new Value<0 | 1>(0)
  private readonly dragEnabled = new Value<0 | 1>(1)
  private readonly translation: Animated.Node<number>
  private readonly panGestureEvent: (event: PanGestureHandlerGestureEvent) => void
  private readonly leadingItemProps: SwipeableItemProps
  private readonly trailingItemProps: SwipeableItemProps
  private readonly thumbStyle: Animated.AnimateStyle<ViewStyle>
  private readonly leadingItemStyle: Animated.AnimateStyle<ViewStyle>
  private readonly trailingItemStyle: Animated.AnimateStyle<ViewStyle>

  constructor(props: Props) {
    super(props)

    const {
      direction,
      overshootLeading = true,
      overshootTrailing = true,
      leadingThreshold = 0.5,
      trailingThreshold = 0.5,
      limitsEnabled = true,
      inertia = 0.1,
      renderLeadingItem,
      renderTrailingItem,
      onChange,
      onDragStart,
      onDragEnd
    } = props

    const hasLeadingItem = renderLeadingItem !== undefined
    const hasTrailingItem = renderTrailingItem !== undefined

    const snapPoints = {
      leading: hasTrailingItem ? sub(this.trailingOffset, this.size) : new Value(0),
      middle: new Value(0),
      trailing: hasLeadingItem ? this.leadingSize : new Value(0)
    }
    const thresholds = {
      leading: hasTrailingItem
        ? multiply(sub(this.trailingOffset, this.size), leadingThreshold)
        : new Value(0),
      trailing: hasLeadingItem ? multiply(this.leadingSize, trailingThreshold) : new Value(0)
    }
    const prevDragOffset = new Value(0)
    const gestureState = new Value(GestureState.UNDETERMINED)
    const translation = new Value(0)
    const translationState = new Value(TranslationState.closed)
    const clock = new Clock()
    const dragOffset = new Value(0)
    const velocity = new Value(0)
    const activeSpring = new Value(Spring.none)
    const activeLimit = new Value(Limit.none)
    const nextDragPos = add(translation, sub(dragOffset, prevDragOffset))
    const dragEnded = new Value(1)
    const runSpringTransition = (dest: Animated.Node<number>) =>
      this.runSpring({
        clock,
        value: translation,
        velocity,
        dest
      })
    const nextLeadingSpringPos = runSpringTransition(snapPoints.leading)
    const nextMiddleSpringPos = runSpringTransition(snapPoints.middle)
    const nextTrailingSpringPos = runSpringTransition(snapPoints.trailing)
    const isHorizontal = direction === 'horizontal'

    this.panGestureEvent = event([
      {
        nativeEvent: isHorizontal
          ? {
              translationX: dragOffset,
              velocityX: velocity,
              state: gestureState
            }
          : {
              translationY: dragOffset,
              velocityY: velocity,
              state: gestureState
            }
      }
    ])

    const onChangeCall = (method: AnimationMethod) =>
      cond(and(neq(this.size, 0), defined(onChange !== undefined)), [
        cond<TranslationState>(
          isTrailingOpeningThresholdPassed(
            translationState,
            translation,
            thresholds.leading,
            snapPoints.leading,
            hasTrailingItem
          ),
          [
            set(translationState, TranslationState.trailingOpeningThresholdPassed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'right' : 'bottom',
                action: 'opening-threshold-passed',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isTrailingOpened(translationState, translation, snapPoints.leading, hasTrailingItem),
          [
            set(translationState, TranslationState.trailingOpened),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'right' : 'bottom',
                action: 'opened',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isTrailingClosingThresholdPassed(
            translationState,
            translation,
            thresholds.leading,
            snapPoints.middle,
            hasTrailingItem
          ),
          [
            set(translationState, TranslationState.trailingClosingThresholdPassed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'right' : 'bottom',
                action: 'closing-threshold-passed',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isTrailingClosed(translationState, translation, snapPoints.middle, hasTrailingItem),
          [
            set(translationState, TranslationState.trailingClosed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'right' : 'bottom',
                action: 'closed',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isLeadingOpeningThresholdPassed(
            translationState,
            translation,
            thresholds.trailing,
            snapPoints.trailing,
            hasLeadingItem
          ),
          [
            set(translationState, TranslationState.leadingOpeningThresholdPassed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'left' : 'top',
                action: 'opening-threshold-passed',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isLeadingOpened(translationState, translation, snapPoints.trailing, hasLeadingItem),
          [
            set(translationState, TranslationState.leadingOpened),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'left' : 'top',
                action: 'opened',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isLeadingClosingThresholdPassed(
            translationState,
            translation,
            thresholds.trailing,
            snapPoints.middle,
            hasLeadingItem
          ),
          [
            set(translationState, TranslationState.leadingClosingThresholdPassed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'left' : 'top',
                action: 'closing-threshold-passed',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          isLeadingClosed(translationState, translation, snapPoints.middle, hasLeadingItem),
          [
            set(translationState, TranslationState.leadingClosed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'left' : 'top',
                action: 'closed',
                method
              })
            )
          ]
        )
      ])

    const reset = [
      stopClock(clock),
      set(activeSpring, Spring.none),
      set(activeLimit, Limit.none),
      set(dragOffset, 0),
      set(velocity, 0),
      set(prevDragOffset, 0),
      translation
    ] as const

    const snapLeading = cond(
      and(not(overshootTrailing), lessThan(translation, snapPoints.leading)),
      set(translation, snapPoints.leading)
    )

    const snapTrailing = cond(
      and(not(overshootLeading), greaterThan(translation, snapPoints.trailing)),
      set(translation, snapPoints.trailing)
    )

    const active = [
      cond(and(eq(activeLimit, Limit.none), neq(dragOffset, 0), defined(limitsEnabled)), [
        set(
          activeLimit,
          cond(
            eq(translation, 0),
            cond(greaterThan(dragOffset, 0), Limit.leading, Limit.trailing),
            cond(
              greaterThan(translation, limitThreshold),
              Limit.leading,
              cond(lessThan(translation, -limitThreshold), Limit.trailing, activeLimit)
            )
          )
        ),

        cond(not(hasLeadingItem), set(activeLimit, Limit.trailing)),

        cond(not(hasTrailingItem), set(activeLimit, Limit.leading))
      ]),

      cond(eq(activeLimit, Limit.leading), [
        set(translation, cond(greaterThan(nextDragPos, 0), nextDragPos, 0)),
        snapTrailing
      ]),

      cond(eq(activeLimit, Limit.trailing), [
        set(translation, cond(lessThan(nextDragPos, 0), nextDragPos, 0)),
        snapLeading
      ]),

      cond(eq(activeLimit, Limit.none), [set(translation, nextDragPos), snapTrailing, snapLeading]),

      set(prevDragOffset, dragOffset),

      onChangeCall('drag'),

      translation
    ] as const

    const end = [
      set(prevDragOffset, 0),

      set(
        translation,
        cond(
          or(
            eq(activeSpring, Spring.leading),
            and(
              lessOrEq(add(translation, multiply(inertia, velocity)), thresholds.leading),
              eq(activeSpring, Spring.none)
            )
          ),
          cond(
            and(lessThan(nextLeadingSpringPos, 0), eq(activeLimit, Limit.leading)),
            0,
            cond(
              and(not(overshootLeading), lessThan(nextLeadingSpringPos, snapPoints.leading)),
              snapPoints.leading,
              [set(activeSpring, Spring.leading), nextLeadingSpringPos]
            )
          ),

          cond(
            or(
              eq(activeSpring, Spring.middle),
              and(
                lessThan(add(translation, multiply(inertia, velocity)), thresholds.trailing),
                eq(activeSpring, Spring.none)
              )
            ),
            cond(
              or(
                and(lessThan(nextMiddleSpringPos, 0), eq(activeLimit, Limit.leading)),
                and(greaterThan(nextMiddleSpringPos, 0), eq(activeLimit, Limit.trailing))
              ),
              0,
              [set(activeSpring, Spring.middle), nextMiddleSpringPos]
            ),

            cond(
              or(eq(activeSpring, Spring.trailing), eq(activeSpring, Spring.none)),
              cond(
                and(greaterThan(nextTrailingSpringPos, 0), eq(activeLimit, Limit.trailing)),
                0,
                cond(
                  and(
                    not(overshootTrailing),
                    greaterThan(nextTrailingSpringPos, snapPoints.trailing)
                  ),
                  snapPoints.trailing,
                  [set(activeSpring, Spring.trailing), nextTrailingSpringPos]
                )
              ),
              translation
            )
          )
        )
      ),

      onChangeCall('swipe'),

      translation
    ] as const

    const checkDragEnd = cond(and(defined(onDragEnd !== undefined), eq(dragEnded, 0)), [
      set(dragEnded, 1),
      call([], () => onDragEnd?.())
    ])

    const dragAnimation = cond(
      eq(this.dragEnabled, 1),
      cond(
        eq(gestureState, GestureState.BEGAN),
        [
          cond(
            defined(onDragStart !== undefined),
            call([], () => onDragStart?.())
          ),
          set(dragEnded, 0),
          reset
        ],

        cond(
          eq(gestureState, GestureState.ACTIVE),
          active,

          cond(
            or(
              eq(gestureState, GestureState.END),
              eq(gestureState, GestureState.CANCELLED),
              eq(gestureState, GestureState.FAILED)
            ),
            [checkDragEnd, end],
            translation
          )
        )
      ),
      [checkDragEnd, translation]
    )

    const runTimingTransition = (dest: Animated.Node<number>) =>
      cond(
        eq(translation, dest),
        [set(this.transition, Transition.none), translation],
        this.runTiming({
          clock,
          value: translation,
          dest,
          transition: this.transition
        })
      )

    const transition = [
      set(
        translation,
        cond(
          eq(this.transition, Transition.close),
          runTimingTransition(snapPoints.middle),

          cond(
            eq(this.transition, Transition.openLeading),
            runTimingTransition(snapPoints.trailing),

            cond(
              eq(this.transition, Transition.openTrailing),
              runTimingTransition(snapPoints.leading),
              translation
            )
          )
        )
      ),

      onChangeCall('transition'),

      translation
    ]

    this.translation = block([
      cond(eq(this.resetSpring, 1), [set(this.resetSpring, 0), reset]),
      cond(eq(this.transition, Transition.none), dragAnimation, transition)
    ])

    this.thumbStyle = {
      transform: [
        isHorizontal ? { translateX: this.translation } : { translateY: this.translation }
      ] as any
    }

    this.leadingItemStyle = {
      ...(isHorizontal ? styles.leadingHorizontalItem : styles.leadingVerticalItem),
      zIndex: cond(greaterThan(this.translation, snapPoints.middle), 0, -1)
    } as any

    this.trailingItemStyle = {
      ...(isHorizontal ? styles.trailingHorizontalItem : styles.trailingVerticalItem),
      zIndex: cond(lessThan(this.translation, snapPoints.middle), 0, -1)
    } as any

    this.leadingItemProps = {
      gapSize: max(this.translation, 0),
      itemWidth: this.leadingSize,
      item: isHorizontal ? 'left' : 'top'
    }

    this.trailingItemProps = {
      gapSize: max(multiply(this.translation, -1), 0),
      itemWidth: sub(this.size, this.trailingOffset),
      item: isHorizontal ? 'right' : 'bottom'
    }
  }

  private runTiming({
    clock,
    value,
    dest,
    transition
  }: {
    clock: Clock
    value: Animated.Value<number>
    dest: Animated.Node<number>
    transition: Animated.Value<Transition>
  }) {
    const state = {
      finished: new Value(0),
      frameTime: new Value(0),
      position: new Value(0),
      time: new Value(0)
    }

    const config = {
      ...(this.props.transitionConfig ?? defaultSwipeableTransitionConfig),
      toValue: new Value(0)
    }

    return block([
      cond(clockRunning(clock), 0, [
        set(state.finished, 0),
        set(state.frameTime, 0),
        set(state.time, 0),
        set(state.position, value),
        set(config.toValue, dest),
        startClock(clock)
      ]),
      timing(clock, state, config),
      cond(
        state.finished,
        block<Transition>([stopClock(clock), set(transition, Transition.none)])
      ),
      state.position
    ])
  }

  private runSpring({
    clock,
    value,
    velocity,
    dest
  }: {
    clock: Clock
    value: Animated.Value<number>
    velocity: Animated.Value<number>
    dest: Animated.Node<number>
  }) {
    const state = {
      finished: new Value(0),
      velocity: new Value(0),
      position: new Value(0),
      time: new Value(0)
    }

    const config = {
      ...(this.props.springConfig ?? defaultSwipeableSpringConfig),
      toValue: new Value(0)
    }

    return [
      cond(clockRunning(clock), 0, [
        set(state.finished, 0),
        set(state.time, 0),
        set(state.velocity, velocity),
        set(state.position, value),
        set(config.toValue, dest),
        startClock(clock)
      ]),
      spring(clock, state, config),
      cond(state.finished, stopClock(clock)),
      state.position
    ]
  }

  public openLeading() {
    this.resetSpring.setValue(1)
    this.transition.setValue(Transition.openLeading)
  }

  public openTrailing() {
    this.resetSpring.setValue(1)
    this.transition.setValue(Transition.openTrailing)
  }

  public close() {
    this.resetSpring.setValue(1)
    this.transition.setValue(Transition.close)
  }

  public enableDrag() {
    this.dragEnabled.setValue(1)
  }

  public disableDrag() {
    this.dragEnabled.setValue(0)
  }

  private readonly onLeadingLayout = ({
    nativeEvent: {
      layout: { x, y }
    }
  }: LayoutChangeEvent) => {
    this.leadingSize.setValue(this.props.direction === 'horizontal' ? x : y)
  }

  private readonly onTrailingLayout = ({
    nativeEvent: {
      layout: { x, y }
    }
  }: LayoutChangeEvent) => {
    this.trailingOffset.setValue(this.props.direction === 'horizontal' ? x : y)
  }

  private readonly onLayout = ({
    nativeEvent: {
      layout: { width, height }
    }
  }: LayoutChangeEvent) => {
    this.size.setValue(this.props.direction === 'horizontal' ? width : height)
  }

  render(): JSX.Element {
    const {
      children,
      renderLeadingItem: LeadingItem,
      renderTrailingItem: TrailingItem,
      panGestureHandlerConfig,
      clippingEnabled = true,
      direction
    } = this.props

    const leading =
      LeadingItem !== undefined ? (
        <Animated.View style={this.leadingItemStyle}>
          <LeadingItem {...this.leadingItemProps} />
          <View onLayout={this.onLeadingLayout} />
        </Animated.View>
      ) : (
        false
      )

    const trailing =
      TrailingItem !== undefined ? (
        <Animated.View style={this.trailingItemStyle}>
          <TrailingItem {...this.trailingItemProps} />
          <View onLayout={this.onTrailingLayout} />
        </Animated.View>
      ) : (
        false
      )

    const activeOffset: PanGestureHandlerProperties =
      direction === 'horizontal'
        ? { activeOffsetX: panGestureHandlerActiveOffset }
        : { activeOffsetY: panGestureHandlerActiveOffset }

    return (
      <PanGestureHandler
        {...activeOffset}
        {...panGestureHandlerConfig}
        maxPointers={1}
        onGestureEvent={this.panGestureEvent}
        onHandlerStateChange={this.panGestureEvent}
      >
        <Animated.View
          onLayout={this.onLayout}
          style={(clippingEnabled ? styles.clippedContainer : styles.container) as any}
        >
          {leading}
          {trailing}
          <Animated.View style={this.thumbStyle}>{children}</Animated.View>
        </Animated.View>
      </PanGestureHandler>
    )
  }
}

type Styles = {
  readonly leadingHorizontalItem: ViewStyle
  readonly trailingHorizontalItem: ViewStyle
  readonly leadingVerticalItem: ViewStyle
  readonly trailingVerticalItem: ViewStyle
  readonly container: ViewStyle
  readonly clippedContainer: ViewStyle
}

const styles = StyleSheet.create<Styles>({
  container: {},
  clippedContainer: {
    overflow: 'hidden'
  },
  leadingHorizontalItem: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    position: 'absolute'
  },
  trailingHorizontalItem: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row-reverse',
    position: 'absolute'
  },
  leadingVerticalItem: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
    position: 'absolute'
  },
  trailingVerticalItem: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column-reverse',
    position: 'absolute'
  }
})

type HorizontalSwipeableProps = Omit<
  Props,
  | 'direction'
  | 'renderLeadingItem'
  | 'renderTrailingItem'
  | 'leadingThreshold'
  | 'trailingThreshold'
  | 'overshootLeading'
  | 'overshootTrailing'
> & {
  readonly renderLeftItem?: Props['renderLeadingItem']
  readonly renderRightItem?: Props['renderTrailingItem']
  readonly overshootLeft?: Props['overshootLeading']
  readonly overshootRight?: Props['overshootTrailing']
  readonly leftThreshold?: Props['leadingThreshold']
  readonly rightThreshold?: Props['trailingThreshold']
}

const Horizontal = (
  {
    renderLeftItem,
    renderRightItem,
    overshootLeft,
    overshootRight,
    leftThreshold,
    rightThreshold,
    ...props
  }: HorizontalSwipeableProps & { readonly children?: React.ReactNode },
  forwardedRef?: React.Ref<Swipeable>
) => (
  <Swipeable
    {...props}
    ref={forwardedRef}
    direction={'horizontal'}
    renderLeadingItem={renderLeftItem}
    renderTrailingItem={renderRightItem}
    overshootLeading={overshootLeft}
    overshootTrailing={overshootRight}
    leadingThreshold={leftThreshold}
    trailingThreshold={rightThreshold}
  />
)

const HorizontalSwipeable = React.forwardRef(Horizontal)

// type VerticalSwipeableProps = Omit<
//   Props,
//   | 'direction'
//   | 'renderLeadingItem'
//   | 'renderTrailingItem'
//   | 'leadingThreshold'
//   | 'trailingThreshold'
//   | 'overshootLeading'
//   | 'overshootTrailing'
// > & {
//   readonly renderTopItem?: Props['renderLeadingItem']
//   readonly renderBottomItem?: Props['renderTrailingItem']
//   readonly overshootTop?: Props['overshootLeading']
//   readonly overshootBottom?: Props['overshootTrailing']
//   readonly topThreshold?: Props['leadingThreshold']
//   readonly bottomThreshold?: Props['trailingThreshold']
// }

// const Vertical = (
//   {
//     renderTopItem,
//     renderBottomItem,
//     overshootTop,
//     overshootBottom,
//     topThreshold,
//     bottomThreshold,
//     ...props
//   }: VerticalSwipeableProps & { readonly children?: React.ReactNode },
//   forwardedRef?: React.Ref<Swipeable>
// ) => (
//   <Swipeable
//     {...props}
//     ref={forwardedRef}
//     direction={'vertical'}
//     renderLeadingItem={renderTopItem}
//     renderTrailingItem={renderBottomItem}
//     overshootLeading={overshootTop}
//     overshootTrailing={overshootBottom}
//     leadingThreshold={topThreshold}
//     trailingThreshold={bottomThreshold}
//   />
// )

// const VerticalSwipeable = React.forwardRef(Vertical)

const Actions = ({ gapSize, itemWidth, item }: SwipeableItemProps) => {
  return (
    <>
      <View
        style={{
          flexDirection: item === 'right' ? 'row-reverse' : 'row',
          width: '100%',
          backgroundColor: 'lightgray'
        }}
      >
        <Animated.View
          style={{
            backgroundColor: 'red',
            width: min(divide(gapSize, 2), divide(itemWidth, 2))
            // transform: [{ translateX: divide(gapSize, -4) }, { scaleX: min(divide(gapSize, 100), 1) }]
          }}
        />
        <Animated.View
          style={{
            backgroundColor: 'yellow',
            width: min(divide(gapSize, 2), divide(itemWidth, 2))
            // transform: [{ translateX: divide(gapSize, -4) }, { scaleX: min(divide(gapSize, 100), 1) }]
          }}
        />
        {/* <Animated.View
          style={{
            flex: 1,
            width: '100%',
            backgroundColor: 'red',
            transform: [{ scale: min(divide(gapSize, 100), 1) }]
          }}
        /> */}
      </View>
      {/* <View
        style={{
          width: 50,
          backgroundColor: 'purple'
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            width: '100%',
            backgroundColor: 'wheat',
            transform: [{ scale: min(divide(gapSize, 100), 1) }]
          }}
        />
      </View> */}
    </>
  )
}

// const VerticalActions = () => (
//   <>
//     <View
//       style={{
//         height: '50%',
//         backgroundColor: 'yellow'
//       }}
//     />
//     <View
//       style={{
//         height: '50%',
//         backgroundColor: 'purple'
//       }}
//     />
//   </>
// )

type FlatListItemProps = Props & {
  readonly itemKey: string
  readonly onMount: (itemKey: string, ref: React.RefObject<Swipeable>) => void
  readonly onUnmount: (itemKey: string) => void
  readonly onOpen: (itemKey: string) => void
  readonly onStartDrag: (itemKey: string) => void
  readonly onEndDrag: () => void
}

class SwipeableFlatListItem extends React.Component<FlatListItemProps> {
  private readonly ref = React.createRef<Swipeable>()

  componentDidMount() {
    this.props.onMount(this.props.itemKey, this.ref)
  }

  componentWillUnmount() {
    this.props.onUnmount(this.props.itemKey)
  }

  render() {
    return (
      <Swipeable
        {...this.props}
        ref={this.ref}
        onChange={this.onChange}
        onDragStart={this.onDragStart}
        onDragEnd={this.onDragEnd}
      />
    )
  }

  private readonly onDragStart = () => {
    const { onDragStart, onStartDrag, itemKey } = this.props

    onStartDrag(itemKey)
    onDragStart?.()
  }

  private readonly onDragEnd = () => {
    const { onDragEnd, onEndDrag } = this.props

    onEndDrag()
    onDragEnd?.()
  }

  private readonly onChange: Props['onChange'] = (options) => {
    const { onOpen, onChange, itemKey } = this.props

    if (options.action === 'opening-threshold-passed') {
      onOpen(itemKey)
    }

    onChange?.(options)
  }
}

type ListProps<T> = {} & FlatListProps<T>

class SwipeableFlatList<T extends { readonly key?: string }> extends React.Component<ListProps<T>> {
  private readonly ref = React.createRef<FlatList<T>>()
  private readonly panConfig: PanGestureHandlerProperties
  private readonly itemRefs: { [key: string]: React.RefObject<Swipeable> | undefined } = {}

  constructor(props: ListProps<T>) {
    super(props)

    this.panConfig = {
      waitFor: this.ref
    }
  }

  render() {
    const { ...props } = this.props
    return <FlatList {...props} ref={this.ref} renderItem={this.renderItem} />
  }

  private readonly renderItem = (info: ListRenderItemInfo<T>) => {
    const key = info.item.key ?? this.props.keyExtractor?.(info.item, info.index)

    assertDefined(key, 'item key should be defined!')

    return (
      <SwipeableFlatListItem
        direction={'horizontal'}
        panGestureHandlerConfig={this.panConfig}
        renderLeadingItem={Actions}
        renderTrailingItem={Actions}
        itemKey={key}
        onMount={this.itemMounted}
        onUnmount={this.itemUnmounted}
        onOpen={this.itemOpened}
        onStartDrag={this.dragStarted}
        onEndDrag={this.dragEnded}
      >
        {this.props.renderItem?.(info)}
      </SwipeableFlatListItem>
    )
  }

  private readonly dragStarted = (itemKey: string) => {
    console.warn(`start ${itemKey}`)
    Object.keys(this.itemRefs).forEach((key: string) => {
      if (key !== itemKey) {
        this.itemRefs[key]?.current?.disableDrag()
      } else {
        // this.itemRefs[key]?.current?.disableDrag()
      }
    })
  }

  private readonly dragEnded = () => {
    console.warn(`end`)
    Object.keys(this.itemRefs).forEach((key: string) => {
      this.itemRefs[key]?.current?.enableDrag()
    })
  }

  private readonly itemMounted = (itemKey: string, ref: React.RefObject<Swipeable>) => {
    this.itemRefs[itemKey] = ref
  }

  private readonly itemUnmounted = (itemKey: string) => {
    this.itemRefs[itemKey] = undefined
  }

  private readonly itemOpened = (itemKey: string) => {
    Object.keys(this.itemRefs).forEach((key: string) => {
      if (key !== itemKey) {
        this.itemRefs[key]?.current?.close()
      }
    })
  }
}

const Item = ({ item }: { readonly item: { readonly key: string } }) => (
  <View
    style={{
      height: 50,
      backgroundColor: 'wheat',
      padding: 10,
      justifyContent: 'center'
    }}
  >
    <Text>{item.key}</Text>
  </View>
)

const Separator = () => (
  <View
    style={{
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'black'
    }}
  />
)

class App extends React.Component<{}, { readonly items: ReadonlyArray<{ readonly key: string }> }> {
  private readonly horizontalSwipeable = React.createRef<Swipeable>()
  private readonly verticalSwipeable = React.createRef<Swipeable>()
  private readonly orig = React.createRef<OriginalSwipeable>()

  state = {
    items: Array(3)
      .fill(0)
      .map((_, i) => ({ key: `${i}` }))
  }

  blockJS = () => {
    const start = new Date()
    let end = new Date()
    while (end.getTime() - start.getTime() < 20000) {
      end = new Date()
    }
  }

  componentDidMount() {
    // setTimeout(() => {
    //   this.horizontalSwipeable.current?.openLeading()
    //   this.verticalSwipeable.current?.openLeading()
    //   this.orig.current?.openLeft()
    //   setTimeout(() => {
    //     this.horizontalSwipeable.current?.close()
    //     this.verticalSwipeable.current?.close()
    //     this.orig.current?.close()
    //   }, 3000)
    // }, 5000)
  }

  render() {
    console.warn('render')
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'green'
        }}
      >
        <StatusBar hidden={true} />
        <Button title={'blockjs'} onPress={this.blockJS} />
        <SwipeableFlatList
          data={this.state.items}
          renderItem={Item}
          ItemSeparatorComponent={Separator}
        />
        {/* {this.state.items.map((item) => (
          <HorizontalSwipeable key={item.key} renderLeftItem={Actions} renderRightItem={Actions}>
            <Item item={item} />
          </HorizontalSwipeable>
        ))} */}
        {/* <HorizontalSwipeable
          ref={this.horizontalSwipeable}
          renderLeftItem={Actions}
          renderRightItem={Actions}
          // panGestureHandlerConfig={{
          //   enabled: this.state.limitsEnabled
          // }}
          // onAnimationEnd={() => console.warn('END')}
          // onAnimationStart={() => console.warn('START')}
          // limitsEnabled={this.state.limitsEnabled}
          // onChange={({ item, action, method }) => {
          //   console.warn(`${method} did ${action} ${item}`)
          // }}
          // overshootLeft={false}
          // overshootRight={false}
          // limitsEnabled={false}
          // dragEnabled={false}
          // springConfig={SpringUtils.makeDefaultConfig()}
          // transitionConfig={{
          //   duration: 1000
          // }}
        >
          <View
            style={{
              backgroundColor: 'blue',
              width: '100%',
              height: 100
            }}
          />
        </HorizontalSwipeable> */}
        {/* <OriginalSwipeable
          ref={this.orig}
          renderLeftActions={Actions}
          renderRightActions={Actions}
          // overshootLeft={false}
          // overshootRight={false}
          // onSwipeableClose={() => console.warn('close')}
          // onSwipeableOpen={() => console.warn('open')}
          // onSwipeableWillClose={() => console.warn('Will close')}
          // onSwipeableWillOpen={() => console.warn('did open')}
          leftThreshold={25}
          rightThreshold={25}
        >
          <View
            style={{
              width: '100%',
              height: 100,
              backgroundColor: 'red'
            }}
          />
        </OriginalSwipeable> */}
        {/* <VerticalSwipeable
          ref={this.verticalSwipeable}
          renderTopItem={VerticalActions}
          renderBottomItem={VerticalActions}
          overshootTop={false}
          overshootBottom={false}
          limitsEnabled={false}
          // onChange={({ item, action }) => {
          //   console.warn(`will ${action} ${item}`)
          // }}
          // limitsEnabled={false}
          // dragEnabled={false}
          // springConfig={SpringUtils.makeDefaultConfig()}
          // transitionConfig={{
          //   duration: 1000
          // }}
        >
          <View
            style={{
              backgroundColor: 'gray',
              width: '100%',
              height: 300
            }}
          />
        </VerticalSwipeable> */}
      </View>
    )
  }
}

export default App
