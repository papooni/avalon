/**
 * Public site settings used for SEO: canonical URLs, sitemap, social cards.
 * SITE_URL is read at build time, so rebuild after changing it.
 */
export const SITE_URL = (process.env.SITE_URL ?? 'https://avalon.sytes.net').replace(/\/+$/, '');

export const SITE = {
  description:
    'Play Avalon Night free in your browser: a social deduction game of hidden loyalties for 5 to 10 players. Everyone joins on their own phone with a room code. No download, no account.',
  keywords: [
    'Avalon Night',
    'Avalon online',
    'hidden role game',
    'social deduction game',
    'party game online',
    'Merlin and the Assassin',
    'play with friends on your phone',
    'free browser game',
    '5 to 10 players',
  ],
  locale: 'en_US',
  /** Optional Google Search Console verification token. */
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION,
};
