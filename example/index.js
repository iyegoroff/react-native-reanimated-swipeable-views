/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './build/App';
import {name as appName} from './app.json';

import MessageQueue from 'react-native/Libraries/BatchedBridge/MessageQueue.js';

let count = 0;
const spyFunction = msg => {
  if (msg.module === 'ReanimatedModule') {
    console.log(++count, msg);
  }
};

MessageQueue.spy(spyFunction);

AppRegistry.registerComponent(appName, () => App);
