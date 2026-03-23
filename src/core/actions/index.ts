import { summarizeAction } from './summarize'
import { translateAction } from './translate'
import { tagExtractAction } from './tagExtract'
import { ActionConfigMap } from '../../types/pipeline'

// Registry maps action type strings to their handler functions
const actionRegistry = {
  summarize: summarizeAction,
  translate: translateAction,
  tag_extract: tagExtractAction,
} as const

// Valid action types are derived directly from the registry keys
export type RegisteredActionType = keyof typeof actionRegistry

export async function runAction(
  actionType: RegisteredActionType,
  payload: Record<string, unknown>,
  config: ActionConfigMap[RegisteredActionType]
): Promise<Record<string, unknown>> {
  const action = actionRegistry[actionType]
  return action(payload, config as never)
}
