import { OnboardingButtons, useDemoCode, useDismiss, useNextClick } from '.'
import { onboardingPaths } from 'routes/Onboarding/paths'
import { useSettingsAuthContext } from 'hooks/useSettingsAuthContext'
import { Themes, getSystemTheme } from 'lib/theme'
import { bracket } from 'lib/exampleKcl'
import { createAndOpenNewProject } from 'lib/desktopFS'
import { isDesktop } from 'lib/isDesktop'
import { useNavigate, useRouteLoaderData } from 'react-router-dom'
import { codeManager, kclManager } from 'lib/singletons'
import { APP_NAME } from 'lib/constants'
import { useState } from 'react'
import { IndexLoaderData } from 'lib/types'
import { PATHS } from 'lib/paths'
import { useFileContext } from 'hooks/useFileContext'
import { useLspContext } from 'components/LspProvider'

/**
 * Show either a welcome screen or a warning screen
 * depending on if the user has code in the editor.
 */
export default function OnboardingIntroduction() {
  const [shouldShowWarning, setShouldShowWarning] = useState(
    codeManager.code !== '' && codeManager.code !== bracket
  )

  return shouldShowWarning ? (
    <OnboardingResetWarning setShouldShowWarning={setShouldShowWarning} />
  ) : (
    <OnboardingIntroductionInner />
  )
}

interface OnboardingResetWarningProps {
  setShouldShowWarning: (arg: boolean) => void
}

function OnboardingResetWarning(props: OnboardingResetWarningProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-content-center bg-chalkboard-110/50">
      <div className="max-w-3xl p-8 rounded bg-chalkboard-10 dark:bg-chalkboard-90">
        {!isDesktop() ? (
          <OnboardingWarningWeb {...props} />
        ) : (
          <OnboardingWarningDesktop {...props} />
        )}
      </div>
    </div>
  )
}

function OnboardingWarningDesktop(props: OnboardingResetWarningProps) {
  const navigate = useNavigate()
  const dismiss = useDismiss()
  const loaderData = useRouteLoaderData(PATHS.FILE) as IndexLoaderData
  const { context: fileContext } = useFileContext()
  const { onProjectClose, onProjectOpen } = useLspContext()

  async function onAccept() {
    onProjectClose(
      loaderData.file || null,
      fileContext.project.path || null,
      false
    )
    await createAndOpenNewProject({ onProjectOpen, navigate })
    props.setShouldShowWarning(false)
  }

  return (
    <>
      <h1 className="flex flex-wrap items-center gap-4 text-3xl font-bold">
        Would you like to create a new project?
      </h1>
      <section className="my-12">
        <p className="my-4">
          You have some content in this project that we don't want to overwrite.
          If you would like to create a new project, please click the button
          below.
        </p>
      </section>
      <OnboardingButtons
        className="mt-6"
        dismiss={dismiss}
        next={onAccept}
        nextText="Make a new project"
      />
    </>
  )
}

function OnboardingWarningWeb(props: OnboardingResetWarningProps) {
  const dismiss = useDismiss()

  return (
    <>
      <h1 className="text-3xl font-bold text-warn-80 dark:text-warn-10">
        Replaying onboarding resets your code
      </h1>
      <p className="my-4">
        We see you have some of your own code written in this project. Please
        save it somewhere else before continuing the onboarding.
      </p>
      <OnboardingButtons
        className="mt-6"
        dismiss={dismiss}
        next={async () => {
          // We do want to update both the state and editor here.
          codeManager.updateCodeStateEditor(bracket)
          await codeManager.writeToFile()

          kclManager.isFirstRender = true
          await kclManager.executeCode(true).then(() => {
            kclManager.isFirstRender = false
          })
          props.setShouldShowWarning(false)
        }}
        nextText="Overwrite code and continue"
      />
    </>
  )
}

function OnboardingIntroductionInner() {
  // Reset the code to the bracket code
  useDemoCode()

  const {
    settings: {
      state: {
        context: {
          app: { theme },
        },
      },
    },
  } = useSettingsAuthContext()
  const getLogoTheme = () =>
    theme.current === Themes.Light ||
    (theme.current === Themes.System && getSystemTheme() === Themes.Light)
      ? '-dark'
      : ''
  const dismiss = useDismiss()
  const next = useNextClick(onboardingPaths.CAMERA)

  return (
    <div className="fixed inset-0 z-50 grid place-content-center bg-chalkboard-110/50">
      <div className="max-w-3xl p-8 rounded bg-chalkboard-10 dark:bg-chalkboard-90">
        <h1 className="flex flex-wrap items-center gap-4 text-3xl font-bold">
          <img
            src={`${isDesktop() ? '.' : ''}/zma-logomark${getLogoTheme()}.svg`}
            alt={APP_NAME}
            className="h-20 max-w-full"
          />
          <span className="px-3 py-1 text-base rounded-full bg-primary/10 text-primary">
            Alpha
          </span>
        </h1>
        <section className="my-12">
          <p className="my-4">
            Welcome to {APP_NAME}! This is a hardware design tool that lets you
            edit visually, with code, or both. It's powered by the KittyCAD
            Design API, the first API created for anyone to build hardware
            design tools. The 3D view is not running on your computer, but is
            instead being streamed to you from an instance of our Geometry
            Engine on a remote GPU as video.
          </p>
          <p className="my-4">
            This is an alpha release, so you will encounter bugs and missing
            features. You can read our{' '}
            <a
              href="https://gist.github.com/jgomez720/5cd53fb7e8e54079f6dc0d2625de5393"
              target="_blank"
              rel="noreferrer noopener"
            >
              expectations for alpha users here
            </a>
            , and please give us feedback on your experience{' '}
            <a
              href="https://discord.com/invite/JQEpHR7Nt2"
              target="_blank"
              rel="noreferrer noopener"
            >
              our Discord
            </a>
            ! We are trying to release as early as possible to get feedback from
            users like you.
          </p>
          <p>
            As you go through the onboarding, we'll be changing and resetting
            your code occasionally, so that we can reference specific code
            features. So hold off on writing production KCL code until you're
            done with the onboarding 😉
          </p>
        </section>
        <OnboardingButtons
          currentSlug={onboardingPaths.INDEX}
          className="mt-6"
          dismiss={dismiss}
          next={next}
          nextText="Mouse Controls"
        />
      </div>
    </div>
  )
}
