import { current } from './servers.js';

/** Browser tests run against their own server and data directory, never the developer's. */
export const APP_ORIGIN = current.origin;
export const COLLABORATION_URL = current.collaboration;
