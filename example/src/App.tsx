import React from 'react'
import {
  View,
  StyleSheet,
  ViewStyle,
  LayoutChangeEvent,
  StatusBar,
  FlatListProps,
  Text,
  ListRenderItemInfo
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
  divide
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
  leadingOpened,
  leadingClosed,
  trailingOpened,
  trailingClosed
}

enum AnimationState {
  finished,
  running
}

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
  readonly onChange?: (options: {
    readonly item: Item
    readonly action: 'open' | 'close'
    readonly method: AnimationMethod
  }) => void
  readonly onAnimationStart?: () => void
  readonly onAnimationEnd?: () => void
}

class Swipeable extends React.Component<Props> {
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
      onAnimationStart,
      onAnimationEnd
    } = props

    const hasLeadingItem = renderLeadingItem !== undefined
    const hasTrailingItem = renderTrailingItem !== undefined

    let start = Date.now()

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
    const animationState = new Value(AnimationState.finished)
    const clock = new Clock()
    const dragOffset = new Value(0)
    const velocity = new Value(0)
    const activeSpring = new Value(Spring.none)
    const activeLimit = new Value(Limit.none)
    const nextDragPos = add(translation, sub(dragOffset, prevDragOffset))
    const animationChange = (
      from: AnimationState,
      to: AnimationState,
      handler: (() => void) | undefined
    ) =>
      cond(eq(animationState, from), [
        set(animationState, to),

        cond(
          eq(+(handler !== undefined), 1),
          call([], () => handler?.())
        )
      ])
    const animationStart = animationChange(
      AnimationState.finished,
      AnimationState.running,
      onAnimationStart
    )
    const animationEnd = animationChange(
      AnimationState.running,
      AnimationState.finished,
      onAnimationEnd
    )
    const runSpringTransition = (dest: Animated.Node<number>) =>
      this.runSpring({
        clock,
        value: translation,
        velocity,
        dest,
        animationEnd
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
      cond(and(neq(this.size, 0), eq(+(onChange !== undefined), 1)), [
        cond<TranslationState>(
          and(
            neq(translationState, TranslationState.trailingOpened),
            lessOrEq(translation, snapPoints.leading),
            eq(+hasTrailingItem, 1)
          ),
          [
            set(translationState, TranslationState.trailingOpened),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'right' : 'bottom',
                action: 'open',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          and(
            neq(translationState, TranslationState.leadingOpened),
            greaterOrEq(translation, snapPoints.trailing),
            eq(+hasLeadingItem, 1)
          ),
          [
            set(translationState, TranslationState.leadingOpened),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'left' : 'top',
                action: 'open',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          and(
            eq(translationState, TranslationState.trailingOpened),
            greaterOrEq(translation, snapPoints.middle),
            eq(+hasTrailingItem, 1)
          ),
          [
            set(translationState, TranslationState.trailingClosed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'right' : 'bottom',
                action: 'close',
                method
              })
            )
          ]
        ),

        cond<TranslationState>(
          and(
            eq(translationState, TranslationState.leadingOpened),
            lessOrEq(translation, snapPoints.middle),
            eq(+hasLeadingItem, 1)
          ),
          [
            set(translationState, TranslationState.leadingClosed),
            call([], () =>
              onChange?.({
                item: isHorizontal ? 'left' : 'top',
                action: 'close',
                method
              })
            )
          ]
        )
      ])

    const reset = [
      stopClock(clock),
      animationStart,
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
      cond(and(eq(activeLimit, Limit.none), neq(dragOffset, 0), eq(+limitsEnabled, 1)), [
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

        cond(eq(+hasLeadingItem, 0), set(activeLimit, Limit.trailing)),

        cond(eq(+hasTrailingItem, 0), set(activeLimit, Limit.leading))
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
                lessOrEq(add(translation, multiply(inertia, velocity)), thresholds.trailing),
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

    const dragAnimation = cond(
      eq(gestureState, GestureState.BEGAN),
      reset,

      cond(
        eq(gestureState, GestureState.ACTIVE),
        active,

        cond(
          or(
            eq(gestureState, GestureState.END),
            eq(gestureState, GestureState.CANCELLED),
            eq(gestureState, GestureState.FAILED)
          ),
          end,
          translation
        )
      )
    )

    const runTimingTransition = (dest: Animated.Node<number>) =>
      cond(
        eq(translation, dest),
        translation,
        this.runTiming({
          clock,
          value: translation,
          dest,
          transition: this.transition,
          animationEnd
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
      ]
    }

    this.leadingItemStyle = {
      ...(isHorizontal ? styles.leadingHorizontalItem : styles.leadingVerticalItem),
      zIndex: cond(greaterThan(this.translation, snapPoints.middle), 0, -1)
    }

    this.trailingItemStyle = {
      ...(isHorizontal ? styles.trailingHorizontalItem : styles.trailingVerticalItem),
      zIndex: cond(lessThan(this.translation, snapPoints.middle), 0, -1)
    }

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

    console.warn(`init ${Date.now() - start}`)
    start = Date.now()
  }

  private runTiming({
    clock,
    value,
    dest,
    transition,
    animationEnd
  }: {
    clock: Clock
    value: Animated.Value<number>
    dest: Animated.Node<number>
    transition: Animated.Value<Transition>
    animationEnd: Animated.Node<number>
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

    return [
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
        block<Transition>([stopClock(clock), animationEnd, set(transition, Transition.none)])
      ),
      state.position
    ]
  }

  private runSpring({
    clock,
    value,
    velocity,
    dest,
    animationEnd
  }: {
    clock: Clock
    value: Animated.Value<number>
    velocity: Animated.Value<number>
    dest: Animated.Node<number>
    animationEnd: Animated.Node<number>
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
      cond(state.finished, [stopClock(clock), animationEnd]),
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
      clippingEnabled = true
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

    return (
      <PanGestureHandler
        {...panGestureHandlerConfig}
        maxPointers={1}
        activeOffsetX={[-20, 20]}
        onGestureEvent={this.panGestureEvent}
        onHandlerStateChange={this.panGestureEvent}
      >
        <Animated.View
          onLayout={this.onLayout}
          style={clippingEnabled ? styles.clippedContainer : styles.container}
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

type VerticalSwipeableProps = Omit<
  Props,
  | 'direction'
  | 'renderLeadingItem'
  | 'renderTrailingItem'
  | 'leadingThreshold'
  | 'trailingThreshold'
  | 'overshootLeading'
  | 'overshootTrailing'
> & {
  readonly renderTopItem?: Props['renderLeadingItem']
  readonly renderBottomItem?: Props['renderTrailingItem']
  readonly overshootTop?: Props['overshootLeading']
  readonly overshootBottom?: Props['overshootTrailing']
  readonly topThreshold?: Props['leadingThreshold']
  readonly bottomThreshold?: Props['trailingThreshold']
}

const Vertical = (
  {
    renderTopItem,
    renderBottomItem,
    overshootTop,
    overshootBottom,
    topThreshold,
    bottomThreshold,
    ...props
  }: VerticalSwipeableProps & { readonly children?: React.ReactNode },
  forwardedRef?: React.Ref<Swipeable>
) => (
  <Swipeable
    {...props}
    ref={forwardedRef}
    direction={'vertical'}
    renderLeadingItem={renderTopItem}
    renderTrailingItem={renderBottomItem}
    overshootLeading={overshootTop}
    overshootTrailing={overshootBottom}
    leadingThreshold={topThreshold}
    trailingThreshold={bottomThreshold}
  />
)

const VerticalSwipeable = React.forwardRef(Vertical)

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

const VerticalActions = () => (
  <>
    <View
      style={{
        height: '50%',
        backgroundColor: 'yellow'
      }}
    />
    <View
      style={{
        height: '50%',
        backgroundColor: 'purple'
      }}
    />
  </>
)

type ListProps<T> = {} & FlatListProps<T>

class SwipeableFlatList<T> extends React.Component<ListProps<T>> {
  private readonly ref = React.createRef<FlatList<T>>()
  private readonly panConfig: PanGestureHandlerProperties

  constructor(props: ListProps<T>) {
    super(props)

    this.panConfig = {
      waitFor: this.ref
    }
  }

  render() {
    console.warn('r')
    const { ...props } = this.props
    return <FlatList {...props} ref={this.ref} renderItem={this.renderItem} />
  }

  private readonly renderItem = (info: ListRenderItemInfo<T>) => {
    // console.warn(`ri`)
    // return <View>{this.props.renderItem?.(info)}</View>
    return (
      <HorizontalSwipeable
        panGestureHandlerConfig={this.panConfig}
        renderLeftItem={Actions}
        renderRightItem={Actions}
      >
        {this.props.renderItem?.(info)}
      </HorizontalSwipeable>
    )
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
    items: Array(50)
      .fill(0)
      .map((_, i) => ({ key: `${i}` }))
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
