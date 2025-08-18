import monitor from './monitor';
import gate from './gate';
import locator from './locator';
import guarder from './guarder';

export default {
  sideBar: 'side bar',
  content: 'socket list',
  win1: 'category information',
  win2: 'detail information',
  'sideBar.monitor': 'Monitor',
  'sideBar.guarder': 'Guarder',
  'sideBar.Locator': 'Locator',
  'fullScreen.exit': 'exit fullscreen',
  'fullScreen.enter': 'enter fullscreen',
  'controls.start': 'Start Capture',
  'controls.stop': 'Stop Capture',
  'controls.clear': 'Clear Data',
  'controls.clearSuccess': 'Data cleared successfully',
  'controls.clearFailure': 'Failed to clear data',
  'controls.help': 'Help',
  ...monitor,
  ...gate,
  ...locator,
  ...guarder
};
