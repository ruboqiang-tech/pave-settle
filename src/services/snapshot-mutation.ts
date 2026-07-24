import type { BusinessSnapshot } from './analytics.service'

export async function mutateAndReloadSnapshot(
  mutation: () => Promise<unknown>,
  reload: () => Promise<BusinessSnapshot>,
): Promise<BusinessSnapshot> {
  await mutation()
  return reload()
}
