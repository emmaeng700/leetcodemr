import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import SetLearnContent from '@/components/SetLearnContent'

interface Props {
  params: Promise<{ index: string }>
}

export default async function Learn2QuestionPage({ params }: Props) {
  const { index } = await params
  const idx = Math.max(0, parseInt(index, 10) || 0)
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100dvh-56px)] items-center justify-center text-gray-400 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    }>
      <SetLearnContent set={2} index={idx} />
    </Suspense>
  )
}
