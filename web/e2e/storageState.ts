// Shared between playwright.config.ts (which points every project's default
// context at this file) and auth.setup.ts (which is the only thing that
// ever writes it) - one path to keep in sync rather than two copies drifting.
export const STORAGE_STATE_PATH = 'e2e/.auth/user.json'
