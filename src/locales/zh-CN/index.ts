import monitor from './monitor';
import gate from './gate';
import locator from './locator';
import guarder from './guarder';

export default {
  sideBar: '侧栏',
  content: 'socket列表',
  win1: '归类信息',
  win2: '详情信息',
  'sideBar.monitor': 'Monitor',
  'sideBar.guarder': 'Guarder',
  'sideBar.Locator': 'Locator',
  'fullScreen.exit': '退出全屏',
  'fullScreen.enter': '进入全屏',
  'controls.start': '开始捕获',
  'controls.stop': '停止捕获',
  'controls.clear': '清除数据',
  'controls.clearSuccess': '数据清除失败',
  'controls.clearFailure': '数据清除成功',
  ...monitor,
  ...gate,
  ...locator,
  ...guarder
};
