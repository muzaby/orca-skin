import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';

// Sandbox preload 는 eval() 사용 불가. dev/prod 모두 inline-source-map 으로 통일.
// (electron-forge plugin-webpack 의 기본 dev devtool 인 'eval-source-map' 이 sandbox 와 충돌)
export const preloadConfig: Configuration = {
  module: {
    rules,
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['.js', '.ts'],
  },
};
