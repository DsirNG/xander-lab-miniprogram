const fs = require('fs')
const b = fs.readFileSync('dist/base.wxml', 'utf8')

const re = /<template name="(tmpl_\d+_\d+)"(?:[^>]*)>([\s\S]*?)<\/template>/g
let m,
  count = 0
const map = new Map()
while ((m = re.exec(b)) !== null) {
  const tag = (m[2].match(/<([a-z\-]+)/) || ['', '?'])[1]
  map.set(m[1], tag)
  count++
}
console.log('total templates:', count)
for (const [name, tag] of map) console.log(name.padEnd(12), tag)
