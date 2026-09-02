const fs = require('fs')
const s = fs.readFileSync('dist/base.wxml', 'utf8')
const names = [
  'tmpl_0_0',
  'tmpl_0_1',
  'tmpl_0_2',
  'tmpl_0_3',
  'tmpl_0_4',
  'tmpl_0_5',
  'tmpl_0_6',
  'tmpl_0_7',
  'tmpl_0_8',
  'tmpl_0_9',
  'tmpl_0_13',
  'tmpl_0_14',
  'tmpl_0_22',
  'tmpl_0_27',
  'tmpl_0_33',
  'tmpl_0_35',
  'tmpl_0_63',
  'tmpl_0_66',
  'tmpl_0_69',
  'tmpl_0_70',
  'tmpl_0_75',
  'tmpl_0_76',
]
names.forEach(t => console.log(t.padEnd(10), s.indexOf('<template name="' + t + '"') !== -1))
