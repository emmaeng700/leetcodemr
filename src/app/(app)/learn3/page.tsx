import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function Learn3Page({ searchParams }: Props) {
  const sp = await searchParams
  const tab = sp.tab === 'cycles' ? 'cycles' : 'questions'
  redirect(`/learn?set=3&tab=${tab}`)
}
