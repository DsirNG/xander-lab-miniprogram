const mainPages = [
  'pages/main/index',
  'pages/login/index',
  'pages/legal/index',
]

const secondaryRoots = [
  'pages/scan-login',
  'pages/blog-detail',
  'pages/plans',
  'pages/plan-detail',
  'pages/plan-create',
  'pages/publish',
  'pages/blog-manage',
  'pages/points',
  'pages/orders',
  'pages/subscription',
  'pages/notifications',
  'pages/account-settings',
  'pages/account-profile',
  'pages/account-profile-edit',
  'pages/security-center',
  'pages/security-edit',
  'pages/recitation',
  'pages/recitation-practice',
  'pages/recitation-report',
  'pages/recitation-history',
]

const isWeapp = process.env.TARO_ENV === 'weapp'

export default defineAppConfig({
  renderer: 'webview',
  pages: isWeapp ? mainPages : [...mainPages, ...secondaryRoots.map(root => `${root}/index`)],
  ...(isWeapp
    ? { usingComponents: { 'native-chat-drawer': './native/chat-drawer/index' },
        darkmode: true, themeLocation: 'theme.json', subPackages: secondaryRoots.map(root => ({ root, pages: ['index'] })) }
    : {}),
  window: {
    navigationStyle: 'custom',
    navigationBarBackgroundColor: isWeapp ? '@windowBackground' : '#ffffff',
    navigationBarTextStyle: isWeapp ? '@navigationText' : 'black',
    backgroundColor: isWeapp ? '@windowBackground' : '#ffffff',
    backgroundTextStyle: isWeapp ? '@backgroundText' : 'dark',
  },
})
