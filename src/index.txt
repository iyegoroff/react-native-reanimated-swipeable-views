import React from 'react'
import { FlatListProps, SectionListProps } from 'react-native'

declare class SwipeableFlatList<Item> extends React.Component<FlatListProps<Item>> {}
declare class SwipeableSectionList<Item> extends React.Component<SectionListProps<Item>> {}

type FlatList<Item> = React.ComponentType<FlatListProps<Item>>
export function withSwipeableListItems<Item>(list: FlatList<Item>): FlatList<Item>

type SectionList<Item> = React.ComponentType<SectionListProps<Item>>
export function withSwipeableListItems<Item>(list: SectionList<Item>): SectionList<Item>
