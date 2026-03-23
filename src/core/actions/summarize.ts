import { z } from 'zod'
import { openai } from './openaiClient'
import { safeParseJSON, getResponseText } from './utils'
import { ActionConfigMap } from '../../types/pipeline'

const MAX_TEXT_LENGTH = 10000 // ~7,500 tokens, well within limits

// What we expect OpenAI to return
const ResponseSchema = z.object({
  summary: z.string().nonempty(),
})

export async function summarizeAction(
  payload: Record<string, unknown>,
  config: ActionConfigMap['summarize']
): Promise<Record<string, unknown>> {
  const text = payload.text as string // openai expects a string

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text too long: ${text.length} characters (max ${MAX_TEXT_LENGTH})`
    )
  }

  const maxLength = config.maxLength ?? 200

  // Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      {
        role: 'system', // instructions for the model, including the required response format
        content: `You are a summarization assistant. 
                Summarize the given text in ${maxLength} characters or less.
                Respond ONLY with this exact JSON format — no extra text, no markdown:
                {"summary": "your summary here"}`,
      },
      {
        role: 'user', // the input text to summarize
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
    summary: result.data.summary,
    original_length: text.length,
    summary_length: result.data.summary.length,
  }
}
