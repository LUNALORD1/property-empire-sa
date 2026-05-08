// Centralized stacking scale. Leaflet panes go up to 700 (popups 800),
// so every app overlay must sit safely above that.
export const Z = {
  mapOverlay: 500,        // chips/legends drawn over the map but below modals
  modal: 1_000_000,       // standard modal layer (PropertyCard, LuckEvent, DailyTick)
  onboardingCoach: 1_500_000, // onboarding coachmarks (above modal so the user sees the hint)
  onboardingFull: 1_500_001,  // onboarding full-screen welcome / outro
  toast: 2_000_000,       // toasts always on top
} as const;
