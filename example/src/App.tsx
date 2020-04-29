import React from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  // SectionListData,
  StatusBar,
  Button,
  StyleSheet
} from 'react-native'
import Animated, { min, divide } from 'react-native-reanimated'
import {
  SwipeableItemProps,
  AdaptedSwipeableFlatList,
  SwipeableSectionList,
  Swipeable
} from 'react-native-reanimated-swipeable-views'
import { WaitForGroup } from 'react-native-gesture-handler'

const touch = () => {
  console.warn('TOUCH!')
}

const Actions = ({ gapSize, itemWidth, item }: SwipeableItemProps) => {
  return (
    <>
      <View
        style={{
          flexDirection: item === 'trailing' ? 'row-reverse' : 'row',
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
        >
          <TouchableOpacity onPress={touch}>
            <View
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'gray'
              }}
            />
          </TouchableOpacity>
        </Animated.View>
        <Animated.View
          style={{
            backgroundColor: 'yellow',
            width: min(divide(gapSize, 2), divide(itemWidth, 2))
            // transform: [{ translateX: divide(gapSize, -4) }, { scaleX: min(divide(gapSize, 100), 1) }]
          }}
        >
          <TouchableOpacity onPress={touch}>
            <View
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'white'
              }}
            />
          </TouchableOpacity>
        </Animated.View>
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

const SimpleActions = () => (
  <>
    <View
      style={{
        width: '50%',
        backgroundColor: 'yellow'
      }}
    />
    <View
      style={{
        width: '50%',
        backgroundColor: 'purple'
      }}
    />
  </>
)

const Item = ({ item }: { readonly item: { readonly key: string } }) => (
  <View
    style={{
      height: 150,
      backgroundColor: 'wheat',
      padding: 10,
      justifyContent: 'center'
    }}
  >
    <Text>{item.key}</Text>
  </View>
)

// const SectionHeader = ({
//   section
// }: {
//   readonly section: SectionListData<{ readonly key: string }>
// }) => (
//   <View
//     style={{
//       height: 15,
//       backgroundColor: 'cyan',
//       padding: 5,
//       justifyContent: 'center'
//     }}
//   >
//     <Text>{section.key}</Text>
//   </View>
// )

const Separator = () => (
  <View
    style={{
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'black'
    }}
  />
)

class App extends React.Component<
  {},
  {
    readonly items: ReadonlyArray<{ readonly key: string }>
    readonly sections: ReadonlyArray<{
      readonly key: string
      readonly data: ReadonlyArray<{ readonly key: string }>
    }>
  }
> {
  private readonly rf = React.createRef<AdaptedSwipeableFlatList<{ readonly key: string }>>()
  private readonly rf2 = React.createRef<SwipeableSectionList<{ readonly key: string }>>()
  private readonly wait = React.createRef<WaitForGroup>()

  state = {
    items: Array(5)
      .fill(0)
      .map((_, i) => ({ key: `${i}` })),
    sections: Array(2)
      .fill(0)
      .map((_, i) => ({
        key: `${i}`,
        data: Array(2)
          .fill(0)
          .map((__, j) => ({ key: `${j}` }))
      }))
  }

  blockJS = () => {
    setTimeout(() => {
      this.rf.current?.openAllLeading()
      setTimeout(() => {
        this.rf.current?.closeAll()
        this.rf.current?.scrollToEnd()
      }, 3000)
    }, 5000)
  }

  // componentDidMount() {
  //   setTimeout(() => {
  //     this.rf.current?.openAllLeading()
  //     setTimeout(() => {
  //       this.rf.current?.closeAll()
  //     }, 3000)
  //   }, 5000)
  // }

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
        <Swipeable
          direction={'horizontal'}
          renderLeadingItem={Actions}
          renderTrailingItem={Actions}
        >
          <Item item={{ key: '123' }} />
        </Swipeable>
        <Button title={'blockjs'} onPress={this.blockJS} />
        {/* <Swipeable
          {...{
            springConfig: {
              ...SpringUtils.makeDefaultConfig(),
              mass: 0.1,
              damping: 20,
              stiffness: 0.5
            },
            itemKey: '10',
            direction: 'horizontal',
            renderLeadingItem: Actions,
            renderTrailingItem: Actions,
            panGestureHandlerConfig: {
              ref: this.r1,
              waitFor: [this.r2, this.r3]
            }
          }}
        >
          <Item item={{ key: '10' }} />
        </Swipeable>
        <Swipeable
          {...{
            springConfig: {
              ...SpringUtils.makeDefaultConfig(),
              mass: 0.1,
              damping: 20,
              stiffness: 0.5
            },
            itemKey: '1',
            direction: 'horizontal',
            renderLeadingItem: Actions,
            renderTrailingItem: Actions,
            panGestureHandlerConfig: {
              ref: this.r2,
              waitFor: [this.r1, this.r3]
            }
          }}
        >
          <Item item={{ key: '1' }} />
        </Swipeable>
        <Swipeable
          {...{
            springConfig: {
              ...SpringUtils.makeDefaultConfig(),
              mass: 0.1,
              damping: 20,
              stiffness: 0.5
            },
            itemKey: '2',
            direction: 'horizontal',
            renderLeadingItem: Actions,
            renderTrailingItem: Actions,
            panGestureHandlerConfig: {
              ref: this.r3,
              waitFor: [this.r1, this.r2]
            }
          }}
        >
          <Item item={{ key: '2' }} />
        </Swipeable> */}
        {/* <SwipeableSectionList
          allowMultiOpen={false}
          swipeableProps={{
            panGestureHandlerProps: {
              waitForGroup: 'test'
            },
            renderLeadingItem: Actions,
            renderTrailingItem: Actions
            // renderLeftActions: SimpleActions,
            // renderRightActions: SimpleActions
          }}
          renderSectionHeader={SectionHeader}
          sections={this.state.sections}
          renderItem={Item}
          ItemSeparatorComponent={Separator}
          ref={this.rf2}
        /> */}
        <WaitForGroup ref={this.wait} />
        <AdaptedSwipeableFlatList
          allowMultiOpen={false}
          swipeableProps={{
            // springConfig: {
            //   ...SpringUtils.makeDefaultConfig(),
            //   mass: 0.1,
            //   damping: 20,
            //   stiffness: 0.5
            // },
            // panGestureHandlerProps: {
            //   waitForGroup: 'test'
            // },
            // renderLeadingItem: Actions,
            // renderTrailingItem: Actions
            waitForGroup: this.wait,
            renderLeftActions: SimpleActions,
            renderRightActions: SimpleActions
          }}
          data={this.state.items}
          renderItem={Item}
          ItemSeparatorComponent={Separator}
          ref={this.rf}
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
