import { readdirSync, writeFileSync } from 'fs'

const dir = 'public/description-images'
const files = readdirSync(dir).filter(f => !f.startsWith('.'))
const paths = files.map(f => `/description-images/${f}`).sort()
writeFileSync('public/description-images-manifest.json', JSON.stringify(paths))
console.log(`Wrote public/description-images-manifest.json (${paths.length} images)`)
