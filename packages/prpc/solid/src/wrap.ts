import { getRequestEvent, isServer } from 'solid-js/web'
import type { ExpectedFn } from './types'
import { PRPCClientError } from './error'

export async function tryAndWrap<Fn extends ExpectedFn<any, any>>(
  queryFn: Fn,
  input: any,
  handleResponse = genHandleResponse()
) {
  try {
    const response = await queryFn({
      payload: input
        ? typeof input === 'function'
          ? input()
          : input
        : undefined,
    } as any)
    if (response instanceof Response) {
      handleResponse?.(response)
      const url = response.headers.get('location')
      if (response.headers.get('X-Prpc-Error') === '1') {
        const error = await optionalData(response)
        throw new PRPCClientError(error.error.message, error.error)
      } else if (!isRedirectResponse(response) || !url) {
        return await optionalData(response)
      }
    }
    return response
  } catch (e: any) {
    if (e instanceof PRPCClientError) throw e
    throw new PRPCClientError(e.message, e)
  }
}

export const optionalData = async (response: Response) => {
  try {
    return await response.clone().json()
  } catch {
    return await response.clone().text()
  }
}

const redirectStatusCodes = new Set([204, 301, 302, 303, 307, 308])

export function isRedirectResponse(response: Response): response is Response {
  return (
    response &&
    response instanceof Response &&
    redirectStatusCodes.has(response.status)
  )
}

export const genHandleResponse = () => {
  const event = getRequestEvent()
  return (response: Response) => {
    if (isServer && event) {
      if ((event as any).response) {
        response.headers.forEach((value, key) => {
          if (key === 'content-type') return
          ;(event as any).response.headers.set(key, value)
        })
      }
    }
  }
}
