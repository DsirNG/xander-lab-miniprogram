const fs = require('fs')
const path = require('path')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith('.js')) out.push(p)
  }
  return out
}

const files = walk('dist')
const modern = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const checks = [
    ['arrow fn', /\w\s*=>/],
    ['optional chaining', /\?\./],
    ['nullish coalesce', /\?\?/],
    ['async/await', /\basync\b|\bawait\b/],
    ['let/const', /\b(?:let|const)\s+[A-Za-z_$]/],
    ['template literal', /`[^`]*\$\{/],
    ['class fields', /\bclass\b.*\{[^}]*\s=/],
    ['spread', /\.\.\./],
    ['nullish assign', /\?\?=/],
    ['logical assign', /&&=| \|\|=/],
  ]
  for (const [name, re] of checks) {
    if (re.test(s)) modern.push(`${f}: ${name}`)
  }
}
console.log('modern syntax hits:', modern.length ? modern.join('\n') : 'NONE')
