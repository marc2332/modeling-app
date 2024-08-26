import { createMachine, assign } from 'xstate'
import { Models } from '@kittycad/lib'
import withBaseURL from '../lib/withBaseURL'
import { isDesktop } from 'lib/isDesktop'
import {
  VITE_KC_API_BASE_URL,
  VITE_KC_DEV_TOKEN,
  VITE_KC_SKIP_AUTH,
  DEV,
} from 'env'
import {
  getUser as getUserDesktop,
  readTokenFile,
  writeTokenFile,
} from 'lib/desktop'
import { COOKIE_NAME } from 'lib/constants'

const SKIP_AUTH = VITE_KC_SKIP_AUTH === 'true' && DEV

const LOCAL_USER: Models['User_type'] = {
  id: '8675309',
  name: 'Test User',
  email: 'kittycad.sidebar.test@example.com',
  image: 'https://placekitten.com/200/200',
  created_at: 'yesteryear',
  updated_at: 'today',
  company: 'Test Company',
  discord: 'Test User#1234',
  github: 'testuser',
  phone: '555-555-5555',
  first_name: 'Test',
  last_name: 'User',
  can_train_on_data: false,
  is_service_account: false,
}

export interface UserContext {
  user?: Models['User_type']
  token?: string
}

export type Events =
  | {
      type: 'Log out'
    }
  | {
      type: 'Log in'
      token?: string
    }

export const TOKEN_PERSIST_KEY = 'TOKEN_PERSIST_KEY'
const persistedToken =
  VITE_KC_DEV_TOKEN ||
  getCookie(COOKIE_NAME) ||
  localStorage?.getItem(TOKEN_PERSIST_KEY) ||
  ''

export const authMachine = createMachine<UserContext, Events>(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QEECuAXAFgOgMabFwGsBJAMwBkB7KGCEgOwGIIqGxsBLBgNyqI75CRALQAbGnRHcA2gAYAuolAAHKrE7pObZSAAeiAIwBmAEzYA7ABYAbAFZTcgBzGbN44adWANCACeiKbGdthypk4AnBFyVs6uQXYAvom+aFh4BMTk1LSQjExgAE6FVIXYKmIAhuhkpQC2GcLikpDSDPJKSCBqGlo6XQYIrk7YETYWctYRxmMWFk6+AUPj2I5OdjZyrnZOFmbJqRg4Ern0zDkABFQYHbo9mtoMuoOGFhHYxlZOhvbOsUGGRaIL4WbBONzWQxWYwWOx2H4HEBpY4tCAAeQwTEuskUd3UD36oEGIlMNlCuzk8Js0TcVisgP8iG2lmcGysb0mW3ByRSIAYVAgcF0yLxvUez0QIms5ImVJpNjpDKWxmw9PGdLh4Te00+iORjSylFRjFFBKeA0QThGQWcexMwWhniBCGiqrepisUVMdlszgieqO2BOdBNXXufXNRKMHtGVuphlJkXs4Wdriso2CCasdgipOidID6WDkAx6FNEYlCAT5jmcjrckMdj2b3GzpsjbBMVMWezDbGPMSQA */
    id: 'Auth',
    initial: 'checkIfLoggedIn',
    states: {
      checkIfLoggedIn: {
        id: 'check-if-logged-in',
        invoke: {
          src: 'getUser',
          id: 'check-logged-in',
          onDone: [
            {
              target: 'loggedIn',
              actions: assign((context, event) => ({
                user: event.data.user,
                token: event.data.token || context.token,
              })),
            },
          ],
          onError: [
            {
              target: 'loggedOut',
              actions: assign({
                user: () => undefined,
              }),
            },
          ],
        },
      },
      loggedIn: {
        entry: ['goToIndexPage'],
        on: {
          'Log out': {
            target: 'loggedOut',
            actions: () => {
              if (isDesktop()) writeTokenFile('')
            },
          },
        },
      },
      loggedOut: {
        entry: ['goToSignInPage'],
        on: {
          'Log in': {
            target: 'checkIfLoggedIn',
            actions: assign({
              token: (_, event) => {
                const token = event.token || ''
                return token
              },
            }),
          },
        },
      },
    },
    schema: { events: {} as { type: 'Log out' } | { type: 'Log in' } },
    predictableActionArguments: true,
    preserveActionOrder: true,
    context: {
      token: persistedToken,
    },
  },
  {
    actions: {},
    services: { getUser },
    guards: {},
    delays: {},
  }
)

async function getUser(context: UserContext) {
  const token = await getAndSyncStoredToken(context)
  const url = withBaseURL('/user')
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
  }

  if (!token && isDesktop()) return Promise.reject(new Error('No token found'))
  if (token) headers['Authorization'] = `Bearer ${token}`

  if (SKIP_AUTH) {
    // For local tests
    if (localStorage.getItem('FORCE_NO_IMAGE')) {
      LOCAL_USER.image = ''
    }

    return {
      user: LOCAL_USER,
      token,
    }
  }

  const userPromise = !isDesktop()
    ? fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers,
      })
        .then((res) => res.json())
        .catch((err) => console.error('error from Browser getUser', err))
    : getUserDesktop(context.token ?? '', VITE_KC_API_BASE_URL)

  const user = await userPromise

  // Necessary here because we use Kurt's API key in CI
  if (localStorage.getItem('FORCE_NO_IMAGE')) {
    user.image = ''
  }

  if ('error_code' in user) return Promise.reject(new Error(user.message))

  return {
    user: user as Models['User_type'],
    token,
  }
}

function getCookie(cname: string): string | null {
  if (isDesktop()) {
    return null
  }

  let name = cname + '='
  let decodedCookie = decodeURIComponent(document.cookie)
  let ca = decodedCookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') {
      c = c.substring(1)
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length)
    }
  }
  return null
}

async function getAndSyncStoredToken(context: UserContext): Promise<string> {
  // dev mode
  if (VITE_KC_DEV_TOKEN) return VITE_KC_DEV_TOKEN

  const token =
    context.token && context.token !== ''
      ? context.token
      : getCookie(COOKIE_NAME) || localStorage?.getItem(TOKEN_PERSIST_KEY) || ''
  if (token) {
    // has just logged in, update storage
    localStorage.setItem(TOKEN_PERSIST_KEY, token)
    isDesktop() && writeTokenFile(token)
    return token
  }
  if (!isDesktop()) return ''
  const fileToken = isDesktop() ? await readTokenFile() : ''
  // prefer other above, but file will ensure login persists after app updates
  if (!fileToken) return ''
  // has token in file, update localStorage
  localStorage.setItem(TOKEN_PERSIST_KEY, fileToken)
  return fileToken
}
