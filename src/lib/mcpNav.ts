export type McpTab = 'mock' | 'patterns' | 'clipboard'

export const MCP_TAB_KEYS: McpTab[] = ['mock', 'patterns', 'clipboard']

export function mcpTabUrl(tab: McpTab, extra?: Record<string, string | number>): string {
  const params = new URLSearchParams({ tab })
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, String(value))
    }
  }
  return `/mcp?${params}`
}

export function isMcpPath(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/')
}

export function isMcpSectionPath(pathname: string): boolean {
  return isMcpPath(pathname)
    || pathname.startsWith('/mock')
    || pathname.startsWith('/patterns')
    || pathname.startsWith('/clipboard')
}
