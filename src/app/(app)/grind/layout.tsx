import '@/styles/grind-shell.css'

export default function GrindLayout({ children }: { children: React.ReactNode }) {
  return <div className="grind-shell min-h-dvh">{children}</div>
}
