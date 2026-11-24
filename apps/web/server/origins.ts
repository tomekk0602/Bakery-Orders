/** Origins allowed to call the API with a session: the staff app on the web (dev) and its native scheme. */
export const TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS ?? "http://localhost:8081,bakerystaff://")
  .split(",")
  .filter(Boolean);
