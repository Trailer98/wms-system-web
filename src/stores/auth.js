import { defineStore } from 'pinia'

// Only the token survives a page reload (localStorage); user/roles/permissions are re-fetched via
// /auth/me on next navigation (see router beforeEach) so a role/permission change server-side is
// picked up the next time the tab is refreshed, without needing a separate persisted profile that
// could go stale.
const TOKEN_KEY = 'wms-auth-token'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: null,
    roles: [],
    permissions: []
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    hasPermission: (state) => (code) => state.permissions.includes(code)
  },
  actions: {
    setSession({ token, user, roles, permissions }) {
      this.token = token
      this.user = user
      this.roles = roles || []
      this.permissions = permissions || []
      localStorage.setItem(TOKEN_KEY, token)
    },
    setProfile({ user, roles, permissions }) {
      this.user = user
      this.roles = roles || []
      this.permissions = permissions || []
    },
    clear() {
      this.token = ''
      this.user = null
      this.roles = []
      this.permissions = []
      localStorage.removeItem(TOKEN_KEY)
    }
  }
})
