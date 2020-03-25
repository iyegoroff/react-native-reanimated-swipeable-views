import React from 'react'
import { View, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native'
import {
  PanGestureHandler,
  State as GestureState,
  PanGestureHandlerGestureEvent
} from 'react-native-gesture-handler'
import OriginalSwipeable from 'react-native-gesture-handler/Swipeable'
import Animated, {
  and,
  neq,
  set,
  block,
  Value,
  multiply,
  divide,
  sqrt,
  pow,
  sub,
  add,
  greaterThan,
  cond,
  event,
  interpolate,
  Extrapolate,
  lessThan,
  acos,
  eq,
  color,
  debug,
  lessOrEq,
  Clock,
  clockRunning,
  startClock,
  spring,
  stopClock
} from 'react-native-reanimated'

type Props = {
  readonly renderLeftActions?: () => React.ReactNode
  readonly renderRightActions?: () => React.ReactNode
}

type State = {
  readonly translateX?: Animated.Node<number>
  readonly color?: Animated.Node<number>
  readonly gestureState?: Animated.Node<GestureState>
  readonly panGestureEvent?: (event: PanGestureHandlerGestureEvent) => void
  readonly leftWidth: number
  readonly rightOffset: number
  readonly width: number
}

function runSpring(
  clock: Clock,
  value: Animated.Value<number>,
  velocity: Animated.Value<number>,
  dest: Animated.Adaptable<number>
) {
  const state = {
    finished: new Value(0),
    velocity: new Value(0),
    position: new Value(0),
    time: new Value(0)
  }

  const config = {
    damping: 7,
    mass: 1,
    stiffness: 121.6,
    overshootClamping: false,
    restSpeedThreshold: 0.001,
    restDisplacementThreshold: 0.001,
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

// tslint:disable-next-line: no-class
class Swipeable extends React.Component<Props, State> {

  private readonly leftWidth = new Value(0)
  private readonly rightOffset = new Value(0)
  private readonly width = new Value(0)

  constructor(props: Props) {
    // tslint:disable-next-line: no-expression-statement
    super(props)

    const offset = new Value(0)
    const col = new Value(0)
    const translateX = new Value(0)
    const velocityX = new Value(0)
    const gestureState = new Value(GestureState.UNDETERMINED)
    // const clock = new Clock()
    const panGestureEvent = event([{
      nativeEvent: ({
        translationX: x,
        velocityX: velocity,
        state
      }: {
        readonly translationX: number,
        readonly velocityX: number,
        readonly state: GestureState
      }) => (
        block([
          set(translateX, add(x, offset)),
          cond(eq(state, GestureState.END), [
            set(offset, add(offset, x)),
            set(velocityX, velocity),
            // stopClock(clock),
            cond(greaterThan(translateX, 0), [
              set(translateX, 0),
              set(col, color(255, 0, 0)) // translateX downto 0
            ]),
            cond(lessThan(translateX, 0), [
              set(translateX, this.width),
              set(col, color(0, 0, 255)) // -> translateX to width
            ]),
            cond(eq(translateX, 0), [
              set(col, color(0, 0, 0))
            ]),
            cond(greaterThan(translateX, divide(this.leftWidth, 2)), [
              set(translateX, this.leftWidth),
              set(col, color(127, 255, 127)) // -> translateX to leftWidth
            ]),
            cond(greaterThan(translateX, this.leftWidth), [
              set(translateX, this.leftWidth),
              set(col, color(255, 255, 0)) // translateX downto leftWidth
            ]),
            cond(lessThan(translateX, sub(0, divide(sub(this.width, this.rightOffset), 2))), [
              set(translateX, sub(this.width, this.rightOffset)),
              set(col, color(125, 125, 255)) // translateX downto (width - rightOffset)
            ]),
            cond(and(lessThan(translateX, sub(this.rightOffset, this.width)), neq(this.width, 0)), [
              set(translateX, sub(this.width, this.rightOffset)),
              set(col, color(255, 255, 255)) // translateX to (width - rightOffset)
            ])
          ])
        ])
      )
    }])

    this.state = {
      leftWidth: 0,
      rightOffset: 0,
      width: 0,
      translateX,
      gestureState,
      panGestureEvent,
      color: col
    }
  }

  readonly onLeftLayout = ({ nativeEvent: { layout: { x } } }: LayoutChangeEvent) => {
    console.warn(`left ${x}`)
    this.setState({
      leftWidth: x
    })
  }

  readonly onRightLayout = ({ nativeEvent: { layout: { x } } }: LayoutChangeEvent) => {
    console.warn(`right ${x}`)
    this.setState({
      rightOffset: x
    })
  }

  readonly onLayout = ({ nativeEvent: { layout: { width } } }: LayoutChangeEvent) => {
    console.warn(`width ${width}`)
    this.setState({
      width
    })
  }

  render() {
    console.warn('render')
    const { panGestureEvent, translateX, color, leftWidth, rightOffset, width } = this.state
    const { children, renderLeftActions, renderRightActions } = this.props

    const leftWidthNode = leftWidth !== 0 && (
      <Animated.Code>
        {() => set(this.leftWidth, leftWidth)}
      </Animated.Code>
    )

    const rightOffsetNode = rightOffset !== 0 && (
      <Animated.Code>
        {() => set(this.rightOffset, rightOffset)}
      </Animated.Code>
    )

    const left = renderLeftActions !== undefined && (
      <View style={styles.leftActions}>
        {leftWidthNode}
        {renderLeftActions()}
        <View onLayout={this.onLeftLayout} />
      </View>
    )

    const right = renderRightActions !== undefined && (
      <View style={styles.rightActions}>
        {rightOffsetNode}
        {renderRightActions()}
        <View onLayout={this.onRightLayout} />
      </View>
    )

    return (
      <PanGestureHandler
        maxPointers={1}
        onGestureEvent={panGestureEvent}
        onHandlerStateChange={panGestureEvent}
      >
        <Animated.View
          onLayout={this.onLayout}
        >
          {width !== 0 && (
            <Animated.Code>
              {() => set(this.width, width)}
            </Animated.Code>
          )}
          {left}
          {right}
          <Animated.View
            style={{
              backgroundColor: color,
              transform: [
                { translateX }
              ]
            }}
          >
            {children}
          </Animated.View>
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

const actions = (
  <>
    <View
      style={{
        width: 50,
        height: 100,
        backgroundColor: 'yellow'
      }}
    />
    <View
      style={{
        width: 50,
        height: 100,
        backgroundColor: 'purple'
      }}
    />
  </>
)

const App = () => (
  <View style={{
    width: '100%',
    height: '100%',
    backgroundColor: 'green'
  }}>
    <Swipeable
      renderLeftActions={() => actions}
      renderRightActions={() => actions}
    >
      <View
        style={{
          width: '100%',
          height: 100
        }}
      />
    </Swipeable>
    <OriginalSwipeable
      renderLeftActions={() => actions}
      renderRightActions={() => actions}
    >
      <View
        style={{
          width: '100%',
          height:  100,
          backgroundColor: 'red'
        }}
      />
    </OriginalSwipeable>
  </View>
)

export default App
