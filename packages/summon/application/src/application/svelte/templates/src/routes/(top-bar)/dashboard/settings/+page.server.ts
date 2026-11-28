import type { Actions } from "./$types";

/**
 * The settings form's fallback without JavaScript. Saving stores nothing, so
 * the page redisplays as it was.
 */
export const actions: Actions = {
  save: () => ({ saved: true }),
};
