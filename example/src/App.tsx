import React from 'react'
import { View, StyleSheet, ViewStyle, LayoutChangeEvent, StatusBar } from 'react-native'
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerGestureEvent
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
  not
} from 'react-native-reanimated'

enum Spring {
  none,
  left,
  center,
  right
}

enum Limit {
  none,
  left,
  right
}

const limitThreshold = 0.1

type Props = {
  readonly renderLeftActions?: () => React.ReactNode
  readonly renderRightActions?: () => React.ReactNode
  readonly overshootLeft?: boolean
  readonly overshootRight?: boolean
  readonly leftThreshold?: number
  readonly rightThreshold?: number
  readonly disableLimits?: boolean
  readonly inertia?: number
  readonly springConfig?: Omit<Animated.SpringConfig, 'toValue'>
}

class Swipeable extends React.Component<Props> {
  private readonly leftWidth = new Value<number>(0)
  private readonly rightOffset = new Value<number>(0)
  private readonly width = new Value<number>(0)
  private readonly translateX: Animated.Node<number> = new Value(0)
  private readonly activeTranslateX = new Value<number>(0)
  private readonly panGestureEvent: (event: PanGestureHandlerGestureEvent) => void
  private readonly containerStyle: Animated.AnimateStyle<ViewStyle>
  private readonly dragOffset = new Value<number>(0)
  private readonly prevDragOffset = new Value<number>(0)
  private readonly velocity = new Value<number>(0)
  private readonly gestureState = new Value(GestureState.UNDETERMINED)
  private readonly activeSpring = new Value<Spring>(Spring.none)
  private readonly activeLimit = new Value<Limit>(Limit.none)
  private readonly stopClock = new Value<0 | 1>(0)
  private readonly stopDrag = new Value<0 | 1>(0)

  constructor(props: Props) {
    super(props)

    const {
      overshootLeft = true,
      overshootRight = true,
      leftThreshold = 0.5,
      rightThreshold = 0.5,
      disableLimits = false,
      inertia = 0.1,
      renderLeftActions,
      renderRightActions
    } = props

    const hasLeftActions = renderLeftActions !== undefined
    const hasRightActions = renderRightActions !== undefined

    const snapPoints = {
      left: hasRightActions ? sub(this.rightOffset, this.width) : new Value(0),
      leftThreshold: hasRightActions
        ? multiply(sub(this.rightOffset, this.width), leftThreshold)
        : new Value(0),
      center: 0,
      rightThreshold: hasLeftActions ? multiply(this.leftWidth, rightThreshold) : new Value(0),
      right: hasLeftActions ? this.leftWidth : new Value(0)
    }
    const clock = new Clock()
    const nextDragX = add(this.activeTranslateX, sub(this.dragOffset, this.prevDragOffset))
    const nextLeftSpringX = this.runSpring(
      clock,
      this.activeTranslateX,
      this.velocity,
      snapPoints.left
    )
    const nextCenterSpringX = this.runSpring(
      clock,
      this.activeTranslateX,
      this.velocity,
      snapPoints.center
    )
    const nextRightSpringX = this.runSpring(
      clock,
      this.activeTranslateX,
      this.velocity,
      snapPoints.right
    )

    this.panGestureEvent = event([
      {
        nativeEvent: {
          translationX: this.dragOffset,
          velocityX: this.velocity,
          state: this.gestureState
        }
      }
    ])

    const began = [
      stopClock(clock),
      set(this.stopDrag, 0),
      set(this.activeSpring, Spring.none),
      set(this.dragOffset, 0),
      set(this.velocity, 0),
      set(this.activeLimit, Limit.none),
      this.activeTranslateX
    ] as const

    const active = [
      cond(eq(this.stopDrag, 0), [
        cond(
          and(eq(this.activeLimit, Limit.none), neq(this.dragOffset, 0), neq(+disableLimits, 1)),
          set(
            this.activeLimit,
            cond(
              eq(this.activeTranslateX, 0),
              cond(
                greaterThan(this.dragOffset, 0),
                cond(neq(+hasRightActions, 1), Limit.left, this.activeLimit),
                cond(neq(+hasLeftActions, 1), Limit.right, this.activeLimit)
              ),
              cond(
                greaterThan(this.activeTranslateX, limitThreshold),
                Limit.left,
                cond(
                  lessThan(this.activeTranslateX, -limitThreshold),
                  Limit.right,
                  this.activeLimit
                )
              )
            )
          ),
          this.activeLimit
        ),

        cond(eq(this.activeLimit, Limit.left), [
          set(this.activeTranslateX, cond(greaterThan(nextDragX, 0), nextDragX, 0)),
          cond(
            and(not(overshootLeft), greaterThan(this.activeTranslateX, snapPoints.right)),
            set(this.activeTranslateX, snapPoints.right)
          )
        ]),

        cond(eq(this.activeLimit, Limit.right), [
          set(this.activeTranslateX, cond(lessThan(nextDragX, 0), nextDragX, 0)),
          cond(
            and(not(overshootRight), lessThan(this.activeTranslateX, snapPoints.left)),
            set(this.activeTranslateX, snapPoints.left)
          )
        ]),

        cond(eq(this.activeLimit, Limit.none), [
          set(this.activeTranslateX, nextDragX),
          cond(
            and(not(overshootLeft), greaterThan(this.activeTranslateX, snapPoints.right)),
            set(this.activeTranslateX, snapPoints.right)
          ),
          cond(
            and(not(overshootRight), lessThan(this.activeTranslateX, snapPoints.left)),
            set(this.activeTranslateX, snapPoints.left)
          )
        ]),

        set(this.prevDragOffset, this.dragOffset)
      ]),

      this.activeTranslateX
    ] as const

    const end = [
      cond(eq(this.stopClock, 1), [stopClock(clock), set(this.stopClock, 0)]),

      set(this.prevDragOffset, 0),

      cond(
        or(
          eq(this.activeSpring, Spring.left),
          and(
            lessOrEq(
              add(this.activeTranslateX, multiply(inertia, this.velocity)),
              snapPoints.leftThreshold
            ),
            eq(this.activeSpring, Spring.none)
          )
        ),
        [
          set(this.activeSpring, Spring.left),
          set(
            this.activeTranslateX,
            cond(
              and(lessThan(nextLeftSpringX, 0), eq(this.activeLimit, Limit.left)),
              0,
              cond(
                and(not(overshootLeft), lessThan(nextLeftSpringX, snapPoints.left)),
                snapPoints.left,
                nextLeftSpringX
              )
            )
          )
        ],

        cond(
          or(
            eq(this.activeSpring, Spring.center),
            and(
              lessOrEq(
                add(this.activeTranslateX, multiply(inertia, this.velocity)),
                snapPoints.rightThreshold
              ),
              eq(this.activeSpring, Spring.none)
            )
          ),
          [
            set(this.activeSpring, Spring.center),
            set(
              this.activeTranslateX,
              cond(
                or(
                  and(lessThan(nextCenterSpringX, 0), eq(this.activeLimit, Limit.left)),
                  and(greaterThan(nextCenterSpringX, 0), eq(this.activeLimit, Limit.right))
                ),
                0,
                nextCenterSpringX
              )
            )
          ],

          cond(
            or(eq(this.activeSpring, Spring.right), eq(this.activeSpring, Spring.none)),
            [
              set(this.activeSpring, Spring.right),
              set(
                this.activeTranslateX,
                cond(
                  and(greaterThan(nextRightSpringX, 0), eq(this.activeLimit, Limit.right)),
                  0,
                  cond(
                    and(not(overshootRight), greaterThan(nextRightSpringX, snapPoints.right)),
                    snapPoints.right,
                    nextRightSpringX
                  )
                )
              )
            ],
            this.activeTranslateX
          )
        )
      )
    ] as const

    this.translateX = cond(
      eq(this.gestureState, GestureState.BEGAN),
      began,

      cond(
        eq(this.gestureState, GestureState.ACTIVE),
        active,

        cond(
          or(
            eq(this.gestureState, GestureState.END),
            eq(this.gestureState, GestureState.CANCELLED),
            eq(this.gestureState, GestureState.FAILED)
          ),
          end,
          this.activeTranslateX
        )
      )
    )

    this.containerStyle = {
      backgroundColor: 'blue',
      transform: [{ translateX: this.translateX }]
    }
  }

  private runSpring(
    clock: Clock,
    value: Animated.Adaptable<number>,
    velocity: Animated.Adaptable<number>,
    dest: Animated.Adaptable<number>
  ) {
    const state = {
      finished: new Value(0),
      velocity: new Value(0),
      position: new Value(0),
      time: new Value(0)
    }

    const config = {
      ...(this.props.springConfig ??
        SpringUtils.makeConfigFromBouncinessAndSpeed({
          ...SpringUtils.makeDefaultConfig(),
          bounciness: 0,
          speed: 1
        })),
      toValue: new Value(0)
    }

    return [
      cond(clockRunning(clock), 0, [
        set(state.finished, 0),
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

  public openLeft() {
    this.activeLimit.setValue(Limit.left)
    this.activeSpring.setValue(Spring.none)
    this.velocity.setValue(0)
    this.activeTranslateX.setValue(51)
    this.stopClock.setValue(1)
    this.stopDrag.setValue(1)
    this.dragOffset.setValue(0)
    this.prevDragOffset.setValue(0)
    this.gestureState.setValue(GestureState.END)
  }

  public closeLeft() {
    this.activeLimit.setValue(Limit.left)
    this.activeSpring.setValue(Spring.none)
    this.velocity.setValue(0)
    this.activeTranslateX.setValue(49)
    this.stopClock.setValue(1)
    this.stopDrag.setValue(1)
    this.dragOffset.setValue(0)
    this.prevDragOffset.setValue(0)
    this.gestureState.setValue(GestureState.END)
  }

  private readonly onLeftLayout = ({
    nativeEvent: {
      layout: { x }
    }
  }: LayoutChangeEvent) => {
    this.leftWidth.setValue(x)
  }

  private readonly onRightLayout = ({
    nativeEvent: {
      layout: { x }
    }
  }: LayoutChangeEvent) => {
    this.rightOffset.setValue(x)
  }

  private readonly onLayout = ({
    nativeEvent: {
      layout: { width }
    }
  }: LayoutChangeEvent) => {
    this.width.setValue(width)
  }

  render(): JSX.Element {
    const { children, renderLeftActions, renderRightActions } = this.props

    const left =
      renderLeftActions !== undefined ? (
        <View style={styles.leftActions}>
          {renderLeftActions()}
          <View onLayout={this.onLeftLayout} />
        </View>
      ) : (
        false
      )

    const right =
      renderRightActions !== undefined ? (
        <View style={styles.rightActions}>
          {renderRightActions()}
          <View onLayout={this.onRightLayout} />
        </View>
      ) : (
        false
      )

    return (
      <PanGestureHandler
        maxPointers={1}
        onGestureEvent={this.panGestureEvent}
        onHandlerStateChange={this.panGestureEvent}
      >
        <Animated.View onLayout={this.onLayout}>
          {left}
          {right}
          <Animated.View style={this.containerStyle}>{children}</Animated.View>
        </Animated.View>
      </PanGestureHandler>
    )
  }
}

type Styles = {
  readonly leftActions: ViewStyle
  readonly rightActions: ViewStyle
}

const styles = StyleSheet.create<Styles>({
  leftActions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row'
  },
  rightActions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row-reverse'
  }
})

const Actions = () => (
  <>
    <View
      style={{
        width: 50,
        backgroundColor: 'yellow'
      }}
    />
    <View
      style={{
        width: 50,
        backgroundColor: 'purple'
      }}
    />
  </>
)

class App extends React.Component<{}> {
  private readonly swipeable = React.createRef<Swipeable>()

  componentDidMount() {
    setInterval(() => {
      const { current } = this.swipeable
      current?.openLeft()
      setTimeout(() => {
        current?.closeLeft()
      }, 1000)
    }, 3000)
  }

  render() {
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'green'
        }}
      >
        <StatusBar hidden={true} />
        <Swipeable
          ref={this.swipeable}
          renderLeftActions={Actions}
          renderRightActions={Actions}
          overshootLeft={false}
          overshootRight={false}
          disableLimits={false}
          // springConfig={SpringUtils.makeDefaultConfig()}
        >
          <View
            style={{
              width: '100%',
              height: 100
            }}
          />
        </Swipeable>
        <OriginalSwipeable
          renderLeftActions={Actions}
          renderRightActions={Actions}
          overshootLeft={false}
          overshootRight={false}
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
        </OriginalSwipeable>
      </View>
    )
  }
}

export default App
