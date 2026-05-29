let inbound: string | null = null
let outbound: string | null = null

export function openDescriptionEditor(text: string) {
  inbound = text
  outbound = null
}

export function consumeInbound(): string | null {
  const v = inbound
  inbound = null
  return v
}

export function setOutbound(text: string) {
  outbound = text
}

export function consumeOutbound(): string | null {
  const v = outbound
  outbound = null
  return v
}
