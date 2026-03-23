import OpenAI from 'openai'

// Single OpenAI client shared across all actions
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
