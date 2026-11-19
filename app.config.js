// This directory is a monorepo, not the mobile Expo project.
// Fail before Expo selects its default AppEntry and tries to import a missing App.
throw new Error(
  "Start Folio from the project root with: npm start -- --clear\nFor a native Android development build use: npm run android\nFor direct Expo CLI commands first run: cd apps/mobile",
);
