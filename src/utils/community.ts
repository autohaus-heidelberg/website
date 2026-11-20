import communityJson from '@/community.json'
import { localData } from '@/utils/localPreview'

export type EventKind = 'concert' | 'community'

export interface TypedEvent {
  /** Fehlt bei älteren events.json-Einträgen → Konzert. */
  type?: string
}

export interface HelpRequestPublic {
  title: string
  text: string
}

export const COMMUNITY_LABEL = 'Treffen'

export function isCommunity(event: TypedEvent): boolean {
  return event.type === 'community'
}

/** Konzertlisten (Termine, Vergangene, Flyer) zeigen keine Community-Treffen. */
export function concertsOnly<T extends TypedEvent>(events: T[]): T[] {
  return events.filter(e => !isCommunity(e))
}

export function communityOnly<T extends TypedEvent>(events: T[]): T[] {
  return events.filter(isCommunity)
}

const localCommunity = localData<{ helpRequests: HelpRequestPublic[] }>('community')

// Lokal (Dev) ersetzen die Gesuche aus der Datenbank die veröffentlichten; sonst gilt community.json
export const helpRequests: HelpRequestPublic[] = localCommunity?.helpRequests ?? communityJson.helpRequests
