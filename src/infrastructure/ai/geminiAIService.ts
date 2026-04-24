import type { AIService } from "../../domain/ai/AIService.ts"
import type { ContextObjectEntity } from "../../domain/contextObject/ContextObjectEntity.ts"
import type { AILearnResponse, GeneratedContextObject, GeneratedQuiz } from "../../domain/types.ts"
import { AIUnavailableError } from "../../errors/index.ts"

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
const GENERATE_CONTENT_PATH = (model: string) => `/models/${model}:generateContent`

type GeminiContent = {
  parts: { text: string }[]
  role?: string
}

type GeminiRequest = {
  system_instruction?: { parts: { text: string }[] }
  contents: GeminiContent[]
  generation_config?: {
    response_mime_type?: string
    temperature?: number
  }
}

type GeminiResponse = {
  candidates: {
    content: {
      parts: { text: string }[]
    }
    finishReason: string
  }[]
}

export class GeminiAIService implements AIService {
  private readonly apiKey: string

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable")
    this.apiKey = apiKey
  }

  private async call(model: string, request: GeminiRequest): Promise<string> {
    const url = `${GEMINI_API_BASE}${GENERATE_CONTENT_PATH(model)}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new AIUnavailableError(`Gemini API error ${response.status}: ${error}`)
    }

    const data = (await response.json()) as GeminiResponse
    const text = data.candidates[0]?.content?.parts[0]?.text
    if (!text) throw new AIUnavailableError("Empty response from Gemini API")

    return text
  }

  private async callWithRetry(model: string, request: GeminiRequest): Promise<string> {
    try {
      return await this.call(model, request)
    } catch {
      try {
        return await this.call(model, request)
      } catch (err) {
        throw new AIUnavailableError(`Gemini API request failed after retry: ${String(err)}`)
      }
    }
  }

  private parseJSON<T>(text: string): T {
    try {
      return JSON.parse(text) as T
    } catch {
      throw new AIUnavailableError("Malformed AI response: not valid JSON")
    }
  }

  async generateContextObjects(
    pieces: { expression: string; annotation: string }[]
  ): Promise<GeneratedContextObject[]> {
    const promptText = await Bun.file("src/prompts/generateContextObjects.txt").text()

    const text = await this.callWithRetry("gemini-2.5-flash-lite", {
      system_instruction: { parts: [{ text: promptText }] },
      contents: [{ parts: [{ text: JSON.stringify(pieces) }], role: "user" }],
      generation_config: { response_mime_type: "application/json" },
    })

    const parsed = this.parseJSON<{ context_objects: unknown[] }>(text)
    if (!parsed.context_objects || !Array.isArray(parsed.context_objects)) {
      throw new AIUnavailableError("Missing context_objects in Gemini response")
    }
    return parsed.context_objects as GeneratedContextObject[]
  }

  async generateQuizzes(contextObjects: ContextObjectEntity[]): Promise<GeneratedQuiz[]> {
    const promptText = await Bun.file("src/prompts/generateQuizzes.txt").text()

    const text = await this.callWithRetry("gemini-2.5-flash-lite", {
      system_instruction: { parts: [{ text: promptText }] },
      contents: [{ parts: [{ text: JSON.stringify(contextObjects) }], role: "user" }],
      generation_config: { response_mime_type: "application/json" },
    })

    const parsed = this.parseJSON<{ quizzes: unknown[] }>(text)
    if (!parsed.quizzes || !Array.isArray(parsed.quizzes)) {
      throw new AIUnavailableError("Missing quizzes in Gemini response")
    }
    return parsed.quizzes as GeneratedQuiz[]
  }

  async askAI(contextObject: ContextObjectEntity, question: string): Promise<AILearnResponse> {
    const promptText = await Bun.file("src/prompts/askAI.txt").text()

    const text = await this.callWithRetry("gemini-2.5-flash-lite", {
      system_instruction: { parts: [{ text: promptText }] },
      contents: [
        {
          parts: [{ text: JSON.stringify({ contextObject, question }) }],
          role: "user",
        },
      ],
      generation_config: { response_mime_type: "application/json" },
    })

    const parsed = this.parseJSON<AILearnResponse>(text)
    if (!parsed.explanation || !Array.isArray(parsed.examples)) {
      throw new AIUnavailableError("Malformed AI learn response")
    }
    return parsed
  }
}
