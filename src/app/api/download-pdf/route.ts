import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const ALLOWED: Record<string, string> = {
  'LeetMastery_Study_Order.epub':              'application/epub+zip',
  'LeetMastery_Study_Order_2x2_Landscape.pdf': 'application/pdf',
}

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file') ?? ''
  const mime = ALLOWED[file]

  if (!mime) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filePath = path.join(process.cwd(), 'public', 'pdfs', file)

  let data: Buffer
  try {
    data = await readFile(filePath)
  } catch {
    return new NextResponse('File not found', { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Length': String(data.byteLength),
    },
  })
}
