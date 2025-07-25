import { createHashRouter, RouteObject } from 'react-router';
import Layout from '@/layouts';
import Guarder from '@/pages/Guarder';
import Locator from '@/pages/Locator';
import Monitor from '@/pages/Monitor';
import ErrorPage from '@/pages/ErrorPage'; // 引入 ErrorPage

export const routerObjects: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <Monitor />,
        index: true,
      },
      {
        path: 'guarder',
        element: <Guarder />,
      },
      {
        path: 'locator',
        element: <Locator />,
      },
    ],
  },
];
const Router = createHashRouter(routerObjects);
export default Router;
