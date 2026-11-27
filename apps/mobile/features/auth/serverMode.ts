/** The public Folio build uses local storage and Google Drive. */
export const folioServerEnabled =
  process.env.EXPO_PUBLIC_FOLIO_SERVER_ENABLED === "true";
