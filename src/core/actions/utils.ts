import { ChatCompletion } from 'openai/resources/chat/completions/completions'

// Safely parse a JSON string without throwing, returns null if the string is not valid JSON
export function safeParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Extract the text content from an OpenAI response}
export function getResponseText(response: ChatCompletion): string {
  return response.choices[0]?.message?.content ?? '' //check the first choice for content, return empty string if not found
}
