// Lightweight PDF text extraction using pdfjs-dist via CDN (avoids bundling worker config complexity).
// For scanned/image-only PDFs this may return limited text.

declare global {
  interface Window {
    pdfjsLib?: any
  }
}

async function ensurePdfJs(): Promise<any> {
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load PDF.js'))
    document.head.appendChild(s)
  })
  const lib = window.pdfjsLib
  if (!lib) throw new Error('PDF.js not available')
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  return lib
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const lib = await ensurePdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await lib.getDocument({ data: buf }).promise
  let text = ''
  const maxPages = Math.min(pdf.numPages, 40)
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((it: any) => it.str).join(' ')
    text += pageText + '\n'
    if (text.length > 30000) break
  }
  return text.trim()
}
