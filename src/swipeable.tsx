import React from 'react'
import { View, StyleSheet, ViewStyle, LayoutChangeEvent, Platform } from 'react-native'
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerProperties
} from 'react-native-gesture-handler'
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
  defined,
  proc
} from 'react-native-reanimated'

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

type Item = 'leading' | 'trailing'

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

const dragging = proc(
  (
    gestureState: Animated.Node<GestureState>,
    gestureEvent: Animated.Node<GestureState>,
    translation: Animated.Node<number>,
    activeSpring: Animated.Node<Spring>,
    reset: Animated.Node<number>,
    active: Animated.Node<number>,
    end: Animated.Node<number>
  ) =>
    cond(
      eq(gestureState, GestureState.BEGAN),
      reset,

      cond(
        eq(gestureState, GestureState.ACTIVE),
        active,

        cond(
          and(
            or(
              not(and(eq(gestureEvent, GestureState.BEGAN), eq(translation, 0))),
              +(Platform.OS === 'ios')
            ),
            or(
              eq(gestureState, GestureState.END),
              and(
                not(
                  and(
                    or(eq(activeSpring, Spring.middle), eq(activeSpring, Spring.none)),
                    eq(translation, 0)
                  )
                ),
                eq(gestureState, GestureState.CANCELLED)
              ),
              eq(gestureState, GestureState.FAILED)
            )
          ),
          end,
          translation
        )
      )
    )
)

type SwipeableItemProps = {
  readonly gapSize: Animated.Node<number>
  readonly itemWidth: Animated.Node<number>
  readonly item?: Item
  readonly translation?: Animated.Node<number>
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
    readonly method: AnimationMethod
  }) => void
}

export type SwipeableMethods = {
  readonly openTrailing: () => void
  readonly openLeading: () => void
  readonly close: () => void
}

export class Swipeable extends React.Component<SwipeableProps> implements SwipeableMethods {
  private readonly leadingSize = new Value<number>(0)
  private readonly trailingOffset = new Value<number>(0)
  private readonly size = new Value<number>(0)
  private readonly transition = new Value<Transition>(Transition.none)
  private readonly resetSpring = new Value<0 | 1>(0)
  private readonly translation: Animated.Node<number>
  private readonly panGestureEvent: (event: PanGestureHandlerGestureEvent) => void
  private readonly leadingItemProps: SwipeableItemProps
  private readonly trailingItemProps: SwipeableItemProps
  private readonly thumbStyle: Animated.AnimateStyle<ViewStyle>
  private readonly leadingItemStyle: Animated.AnimateStyle<ViewStyle>
  private readonly trailingItemStyle: Animated.AnimateStyle<ViewStyle>

  constructor(props: SwipeableProps) {
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
      onChange
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
    const gestureEvent = new Value<GestureState>(GestureState.UNDETERMINED)
    const gestureState = new Value<GestureState>(GestureState.UNDETERMINED)
    const translation = new Value(0)
    const translationState = new Value(TranslationState.closed)
    const clock = new Clock()
    const dragOffset = new Value(0)
    const velocity = new Value(0)
    const activeSpring = new Value(Spring.none)
    const activeLimit = new Value(Limit.none)
    const nextDragPos = add(translation, sub(dragOffset, prevDragOffset))
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
              state: gestureEvent
            }
          : {
              translationY: dragOffset,
              velocityY: velocity,
              state: gestureEvent
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
                item: 'trailing',
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
                item: 'trailing',
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
                item: 'trailing',
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
                item: 'trailing',
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
                item: 'leading',
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
                item: 'leading',
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
                item: 'leading',
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
                item: 'leading',
                action: 'closed',
                method
              })
            )
          ]
        )
      ])

    const reset = block([
      stopClock(clock),
      set(activeSpring, Spring.none),
      set(activeLimit, Limit.none),
      set(dragOffset, 0),
      set(velocity, 0),
      set(prevDragOffset, 0),
      translation
    ])

    const snapLeading = cond(
      and(not(overshootTrailing), lessThan(translation, snapPoints.leading)),
      set(translation, snapPoints.leading)
    )

    const snapTrailing = cond(
      and(not(overshootLeading), greaterThan(translation, snapPoints.trailing)),
      set(translation, snapPoints.trailing)
    )

    const active = block([
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
    ])

    const end = block([
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
    ])

    const dragAnimation = dragging(
      gestureState,
      gestureEvent,
      translation,
      activeSpring,
      reset,
      active,
      end
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
      cond(
        +(Platform.OS === 'ios'),
        set(gestureState, gestureEvent),
        cond(
          neq(gestureEvent, GestureState.BEGAN),
          set(
            gestureState,
            cond(
              and(
                eq(gestureEvent, GestureState.ACTIVE),
                neq(gestureState, GestureState.ACTIVE),
                neq(gestureState, GestureState.BEGAN)
              ),
              GestureState.BEGAN,
              gestureEvent
            )
          )
        )
      ),
      cond(eq(this.resetSpring, 1), [set(this.resetSpring, 0), reset]),
      cond(eq(this.transition, Transition.none), dragAnimation, transition)
    ])

    this.thumbStyle = {
      transform: [
        isHorizontal ? { translateX: this.translation } : { translateY: this.translation }
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    this.leadingItemStyle = {
      ...(isHorizontal ? styles.leadingHorizontalItem : styles.leadingVerticalItem),
      zIndex: cond(greaterThan(this.translation, snapPoints.middle), 0, -1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    this.trailingItemStyle = {
      ...(isHorizontal ? styles.trailingHorizontalItem : styles.trailingVerticalItem),
      zIndex: cond(lessThan(this.translation, snapPoints.middle), 0, -1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    this.leadingItemProps = {
      gapSize: max(this.translation, 0),
      itemWidth: this.leadingSize,
      item: 'leading',
      translation: this.translation
    }

    this.trailingItemProps = {
      gapSize: max(multiply(this.translation, -1), 0),
      itemWidth: sub(this.size, this.trailingOffset),
      item: 'trailing',
      translation: this.translation
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

    return block([
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
    ])
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
      panGestureHandlerProps,
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
        {...panGestureHandlerProps}
        onGestureEvent={this.panGestureEvent}
        onHandlerStateChange={this.panGestureEvent}
      >
        <Animated.View
          onLayout={this.onLayout}
          style={
            (clippingEnabled ? styles.clippedContainer : styles.container) as Animated.AnimateStyle<
              ViewStyle
            >
          }
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
