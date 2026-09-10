export interface GoogleAccount {
  name: string
  email: string
  avatarInitial: string
}

export const DEMO_GOOGLE_ACCOUNT: GoogleAccount = {
  name: 'Nguyen Minh Anh',
  email: 'minhanh.nguyen@gmail.com',
  avatarInitial: 'M',
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const authService = {
  async signInWithGoogle(): Promise<GoogleAccount> {
    await delay(1200)
    return DEMO_GOOGLE_ACCOUNT
  },
}
