import { AIUnavailableError } from "../errors/index.ts"
import type { AIRepository } from "../repositories/aiRepository.ts"
import type {
  AILearnResponse,
  ContextObject,
  GeneratedContextObject,
  GeneratedQuiz,
} from "../repositories/types.ts"

export class MockAIRepository implements AIRepository {
  async generateContextObjects(_noteContent: string): Promise<GeneratedContextObject[]> {
    return [
      {
        expression: "なるほど",
        baseMeaning: "I see / I understand",
        actualNuance:
          "Used to show comprehension or acknowledgment. Can sound dismissive in formal contexts.",
        tone: "neutral",
        formality: "casual",
        isSlang: false,
        exampleDialogue: [
          { speaker: "A", text: "明日の会議は中止になりました。" },
          { speaker: "B", text: "なるほど、わかりました。" },
        ],
      },
      {
        expression: "やばい",
        baseMeaning: "Dangerous / terrible (originally), now also means awesome / amazing",
        actualNuance: "Highly versatile slang. Context determines positive or negative meaning.",
        tone: "casual",
        formality: "casual",
        isSlang: true,
        exampleDialogue: [
          { speaker: "A", text: "このラーメン、やばくない？" },
          { speaker: "B", text: "めっちゃやばい！最高！" },
        ],
      },
    ]
  }

  async generateQuizzes(contextObjects: ContextObject[]): Promise<GeneratedQuiz[]> {
    const quizzes: GeneratedQuiz[] = []
    for (let i = 0; i < contextObjects.length; i++) {
      const co = contextObjects[i]
      if (!co) continue
      quizzes.push({
        contextObjectIndex: i,
        type: "choose_context",
        questionSentence: `Which situation best fits the expression "${co.expression}"?`,
        answer: co.actualNuance,
      })
      quizzes.push({
        contextObjectIndex: i,
        type: "fill_metadata",
        questionSentence: `What is the base meaning of "${co.expression}"?`,
        answer: co.baseMeaning,
      })
    }
    return quizzes
  }

  async askAI(contextObject: ContextObject, question: string): Promise<AILearnResponse> {
    return {
      explanation: `This is a mock explanation for "${contextObject.expression}" in response to: ${question}`,
      examples: [
        `Example usage of ${contextObject.expression} in context 1.`,
        `Example usage of ${contextObject.expression} in context 2.`,
      ],
      relatedExpressions: ["関連表現1", "関連表現2"],
    }
  }
}

export class RealAIRepository implements AIRepository {
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

  async generateContextObjects(noteContent: string): Promise<GeneratedContextObject[]> {
    const promptText = await Bun.file("src/prompts/generateContextObjects.txt").text()

    const result = await this.callWithRetry(async () => {
      const response = await this.client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        system: [{ type: "text", text: promptText, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: noteContent }],
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

  async generateQuizzes(contextObjects: ContextObject[]): Promise<GeneratedQuiz[]> {
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

  async askAI(contextObject: ContextObject, question: string): Promise<AILearnResponse> {
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
