// Centralized stacking scale. Leaflet panes go up to 700 (popups 800),
// so every app overlay must sit safely above that.
// Onboarding coach is BELOW modals so opening a property card during onboarding
// renders the buy sheet on top of the hint, not behind it.
export const Z = {
  mapOverlay: 500,            // chips/legends drawn over the map
  onboardingCoach: 900_000,   // coachmark hint (non-blocking, sits over map)
  modal: 1_000_000,           // PropertyCard, LuckEvent, DailyTick, etc.
  onboardingFull: 1_500_000,  // full-screen onboarding welcome/outro
  toast: 2_000_000,           // toasts always on top
} as const;
