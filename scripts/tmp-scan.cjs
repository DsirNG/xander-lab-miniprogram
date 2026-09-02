const fs = require('fs')
const files = ['taro.js', 'runtime.js', 'common.js', 'vendors.js', 'index.js', 'comp.js']
for (const f of files) {
  let s
  try {
    s = fs.readFileSync('dist/' + f, 'utf8')
  } catch (e) {
    console.log(f, 'MISSING')
    continue
  }
  const pats = [
    ['8,0,22', s.indexOf('8,0,22') !== -1],
    ['a=[', s.indexOf('a=[') !== -1],
    ['nn:', s.indexOf('nn:') !== -1],
    ['nn=', s.indexOf('nn=') !== -1],
    ['createVNode', s.indexOf('createVNode') !== -1],
    ['TaroElement', s.indexOf('TaroElement') !== -1],
    ['getNodeType', s.indexOf('getNodeType') !== -1],
  ]
  console.log(
    f.padEnd(12),
    pats
      .filter(p => p[1])
      .map(p => p[0])
      .join(', '),
  )
}

const s = fs.readFileSync('dist/taro.js', 'utf8')
console.log('--- taro.js element registration ---')
const m = s.match(/var\s+\w+\s*=\s*\{\s*view[\s\S]{0,2000}?\}/)
const m2 = s.match(/\{view:[^}]{0,800}/)
console.log('m2:', m2 ? m2[0] : 'none')
const m3 = s.match(/type:"view"[\s\S]{0,500}/)
console.log('m3:', m3 ? m3[0].slice(0, 400) : 'none')
