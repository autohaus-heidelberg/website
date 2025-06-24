// NOTE: do not add a trailing comma or the script will fail
import eventsJson from './events.json';

export type Event = {
  // Unique id, this is used in the URL so URLencoded is better
  id: string;
  date: string;
  title: string;
  // path to image
  img?: string;
  descriptionShort: string;
  descriptionLong?: string;
  fee?: string;
  feeAk?: string;
  /* Link to the ticket shop, i.e. https://pretix.eu/carousel/131124Crocodiles/ */
  shopLink?: string;
  artists: Array<{
    name: string;
    image?: string;
    link?: string;
    description?: string;
    soundcloud?: string;
    youtube?: string;
    bandcamp?: string;
  }>;
};

export const events: Event[] = eventsJson;
