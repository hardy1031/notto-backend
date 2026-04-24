import type { AIService } from "../../domain/ai/AIService.ts"
import type { ContextObjectEntity } from "../../domain/contextObject/ContextObjectEntity.ts"
import type { AILearnResponse, GeneratedContextObject, GeneratedQuiz } from "../../domain/types.ts"
import { AIUnavailableError } from "../../errors/index.ts"

export class GeminiAIService implements AIService {
  private client: import("@anthropic-ai/sdk").Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY environment variable")
    // Dynamic import handled at usage time
    const Anthropic = require("@anthropic-ai/sdk")
    this.client = new Anthropic.default({ apiKey })
  }

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch {
      try {
        return await fn()
      } catch (err) {
        throw new AIUnavailableError(`AI request failed after retry: ${String(err)}`)
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

    const result = await this.callWithRetry(async () => {
      const response = await this.client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        system: [{ type: "text", text: promptText, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(pieces) }],
      })
      const content = response.content[0]
      if (!content || content.type !== "text") {
        throw new AIUnavailableError("Unexpected AI response format")
      }
      const parsed = this.parseJSON<{ context_objects: unknown[] }>(content.text)
      if (!parsed.context_objects || !Array.isArray(parsed.context_objects)) {
        throw new AIUnavailableError("Missing context_objects in AI response")
      }
      return parsed.context_objects as GeneratedContextObject[]
    })

    return result
  }

  async generateQuizzes(contextObjects: ContextObjectEntity[]): Promise<GeneratedQuiz[]> {
    const promptText = await Bun.file("src/prompts/generateQuizzes.txt").text()

    const result = await this.callWithRetry(async () => {
      const response = await this.client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        system: [{ type: "text", text: promptText, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(contextObjects) }],
      })
      const content = response.content[0]
      if (!content || content.type !== "text") {
        throw new AIUnavailableError("Unexpected AI response format")
      }
      const parsed = this.parseJSON<{ quizzes: unknown[] }>(content.text)
      if (!parsed.quizzes || !Array.isArray(parsed.quizzes)) {
        throw new AIUnavailableError("Missing quizzes in AI response")
      }
      return parsed.quizzes as GeneratedQuiz[]
    })

    return result
  }

  async askAI(contextObject: ContextObjectEntity, question: string): Promise<AILearnResponse> {
    const promptText = await Bun.file("src/prompts/askAI.txt").text()

    const result = await this.callWithRetry(async () => {
      const response = await this.client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: [{ type: "text", text: promptText, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: JSON.stringify({ contextObject, question }),
          },
        ],
      })
      const content = response.content[0]
      if (!content || content.type !== "text") {
        throw new AIUnavailableError("Unexpected AI response format")
      }
      const parsed = this.parseJSON<AILearnResponse>(content.text)
      if (!parsed.explanation || !Array.isArray(parsed.examples)) {
        throw new AIUnavailableError("Malformed AI learn response")
      }
      return parsed
    })

    return result
  }
}
