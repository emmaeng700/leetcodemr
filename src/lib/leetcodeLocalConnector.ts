export async function lcFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(path, init)
}
