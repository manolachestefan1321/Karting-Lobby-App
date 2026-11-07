/** The instant first view only exists on the website (see shell.web.ts). */
export function removeInstantShell(): void {}
export function shellWasShown(): boolean {
  return false;
}
