const fs = require('fs')
const base = fs.readFileSync('dist/base.wxml', 'utf8')
const utils = fs.readFileSync('dist/utils.wxs', 'utf8')

const templates = new Set()
for (const m of base.matchAll(/<template name="([^"]+)"/g)) templates.add(m[1])

const aArr = utils.match(/var a = (\[[^\]]*\])/)[1]
const bArr = utils.match(/var b = (\[[^\]]*\])/)[1]
const nums = [...new Set([...JSON.parse(aArr), ...JSON.parse(bArr)])]

const missing = []
for (const n of nums) {
  for (let l = 0; l < 15; l++) {
    if (!templates.has(`tmpl_${l}_${n}`)) {
      missing.push(`tmpl_${l}_${n}`)
    }
  }
}
console.log('wxs 引用的节点类型:', nums.join(','))
console.log('base.wxml 模板总数:', templates.size)
console.log('缺失的模板 (depth 0-14):', missing.length ? missing.join(', ') : '无')
