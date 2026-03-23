import { z } from 'zod'
import { openai } from './openaiClient'
import { safeParseJSON, getResponseText } from './utils'
import { ActionConfigMap } from '../../types/pipeline'

const MAX_TEXT_LENGTH = 10000

const ResponseSchema = z.object({
  tags: z.array(z.string().nonempty()).min(1),
})

export async function tagExtractAction(
  payload: Record<string, unknown>,
  config: ActionConfigMap['tag_extract']
): Promise<Record<string, unknown>> {
  const text = payload.text as string

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text too long: ${text.length} characters (max ${MAX_TEXT_LENGTH})`
    )
  }

  const maxTags = config.maxTags ?? 5

  // Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 200,
    messages: [
      {
        role: 'system', // instructions for the model, including the required response format
        content: `You are a tag extraction assistant.
Extract the ${maxTags} most important topics, keywords, or entities from the given text.
Respond ONLY with this exact JSON format — no extra text, no markdown:
{"tags": ["tag1", "tag2", "tag3"]}`,
      },
      {
        role: 'user', // the input text to extract tags from
        content: text,
      },
    ],
  })

  // Parse the response
  const raw = getResponseText(response)
  const parsed = safeParseJSON(raw)
  const result = ResponseSchema.safeParse(parsed)

  // If OpenAI returned something unexpected, fail with a clear message
  if (!result.success) {
    throw new Error(`Unexpected response from OpenAI: ${raw}`)
  }

  return {
    tags: result.data.tags,
    count: result.data.tags.length,
  }
}
