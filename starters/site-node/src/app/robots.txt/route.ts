import { cms } from '@/cms'

export const dynamic = 'force-static'

export async function GET() {
  return new Response((await cms.robots()) ?? '', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
