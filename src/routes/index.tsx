import { createHashRouter, RouteObject } from 'react-router';
import Layout from '@/layouts';
import Guarder from '@/pages/Guarder';
import Tracer from '@/pages/Tracer';
import Analyzer from '@/pages/Analyzer';
import ErrorPage from '@/pages/ErrorPage'; // 引入 ErrorPage

export const routerObjects: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <Analyzer />,
        index: true,
      },
      {
        path: 'guarder',
        element: <Guarder />,
      },
      {
        path: 'locator',
        element: <Tracer />,
      },
    ],
  },
];
const Router = createHashRouter(routerObjects);
export default Router;
