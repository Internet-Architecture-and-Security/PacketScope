import React from 'react';
import { history, type IRoute } from '@umijs/max';
import { Result, Button } from 'antd';

const Exception: React.FC<{
  children: React.ReactNode;
  route?: IRoute;
  notFound?: React.ReactNode;
  noAccessible?: React.ReactNode;
  unAccessible?: React.ReactNode;
  noFound?: React.ReactNode;
}> = (props) =>
  // render custom 404
  (!props.route && (props.noFound || props.notFound)) ||
  // render custom 403
  (props.route?.unaccessible && (props.unAccessible || props.noAccessible)) ||
  // render default exception
  ((!props.route || props.route?.unaccessible) && (
    <Result
      status={props.route ? '403' : '404'}
      title={props.route ? '403' : '404'}
      subTitle={props.route ? '抱歉，你无权访问该页面' : '抱歉，你访问的页面不存在'}
      extra={
        <Button type="primary" onClick={() => history.push('/')}>
          返回首页
        </Button>
      }
    />
  )) ||
  // normal render
  props.children;

export default Exception;
