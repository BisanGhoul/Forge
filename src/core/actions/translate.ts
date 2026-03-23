import { z } from 'zod'
import { openai } from './openaiClient'
import { safeParseJSON, getResponseText } from './utils'
import { ActionConfigMap } from '../../types/pipeline'

const MAX_TEXT_LENGTH = 10000

const ResponseSchema = z.object({
  translatedText: z.string().nonempty(),
  detectedLanguage: z.string().nonempty(),
})

export async function translateAction(
  payload: Record<string, unknown>,
  config: ActionConfigMap['translate']
): Promise<Record<string, unknown>> {
  const text = payload.text as string

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text too long: ${text.length} characters (max ${MAX_TEXT_LENGTH})`
    )
  }

  const targetLanguage = config.targetLanguage

  // Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1000,
    messages: [
      {
        role: 'system', // instructions for the model, including the required response format
        content: `You are a translation assistant.
Translate the given text to ${targetLanguage}.
Respond ONLY with this exact JSON format — no extra text, no markdown:
{"translatedText": "translation here", "detectedLanguage": "source language name"}`,
      },
      {
        role: 'user', // the input text to translate
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
    translatedText: result.data.translatedText,
    targetLanguage,
    detectedLanguage: result.data.detectedLanguage,
  }
}
