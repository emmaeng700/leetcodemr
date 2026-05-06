import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const ALLOWED = new Set([
  'LeetMastery_By_Pattern_Python_Only_6up_Landscape.pdf',
  'LeetMastery_By_Pattern_Python_Only_Print_6up_Landscape.pdf',
  'LeetMastery_DSA_SystemDesign_Behavioral_Print_6up_Landscape.pdf',
])

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file') ?? ''

  if (!ALLOWED.has(file)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filePath = path.join(process.cwd(), 'public', 'pdfs', file)

  let data: Buffer
  try {
    data = await readFile(filePath)
  } catch {
    return new NextResponse('File not found', { status: 404 })
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Length': String(data.byteLength),
    },
  })
}
