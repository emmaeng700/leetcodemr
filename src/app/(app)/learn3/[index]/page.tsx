import SetLearnContent from '@/components/SetLearnContent'

interface Props {
  params: Promise<{ index: string }>
}

export default async function Learn3QuestionPage({ params }: Props) {
  const { index } = await params
  const idx = Math.max(0, parseInt(index, 10) || 0)
  return <SetLearnContent set={3} index={idx} />
}
