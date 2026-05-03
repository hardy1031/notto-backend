export type LearnInput = {
  userId: string
  question: string
}

export type LearnOutput = {
  answer: string
}

export async function LearnUseCase(_input: LearnInput): Promise<LearnOutput> {
  return { answer: "This feature is currently under development." }
}
