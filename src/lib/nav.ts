// Navigation to and from the full-screen exercise editor (#/log/<date>/x/<logId>).
// Done / back return to wherever it was opened from (day screen, Home feed) via history,
// or to the day screen when the page was opened directly (reload, shared link).

let openedInApp = false

export const exerciseHref = (date: string, logId: string) => `#/log/${date}/x/${logId}`

export function markOpenedInApp() {
  openedInApp = true
}

export function openExercise(date: string, logId: string, replace = false) {
  openedInApp = true
  const href = exerciseHref(date, logId)
  if (replace) window.location.replace(href)
  else window.location.hash = href
}

export function closeExercise(date: string) {
  if (openedInApp && window.history.length > 1) {
    openedInApp = false
    window.history.back()
  } else {
    window.location.replace(`#/log/${date}`)
  }
}

// "Change exercise" screen on top of the exercise screen: returns there after a pick or close.
let changeOpenedInApp = false

export function openChangeExercise(date: string, logId: string) {
  changeOpenedInApp = true
  window.location.hash = `${exerciseHref(date, logId)}/change`
}

export function closeChangeExercise(date: string, logId: string) {
  if (changeOpenedInApp && window.history.length > 1) {
    changeOpenedInApp = false
    window.history.back()
  } else {
    window.location.replace(exerciseHref(date, logId))
  }
}
