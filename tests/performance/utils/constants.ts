import * as path from "path"
import * as fs from "fs"

export const AUTH_DIR = path.join(__dirname, "../.auth")
export const AUTH_STATE_PATH = path.join(AUTH_DIR, "user.json")

export function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })
}

export function authStateExists(): boolean {
  return fs.existsSync(AUTH_STATE_PATH)
}
