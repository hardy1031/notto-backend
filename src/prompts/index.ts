export const GENERATE_CONTEXT_OBJECTS_PROMPT = `You are a language learning assistant. Analyze the provided text and extract vocabulary expressions worth studying.

For each expression, return a JSON object with the following structure:
{
  "context_objects": [
    {
      "expression": "the expression or phrase",
      "baseMeaning": "literal or dictionary meaning",
      "actualNuance": "how it's actually used in context",
      "tone": "emotional tone (e.g. casual, serious, humorous)",
      "formality": "casual | neutral | formal",
      "isSlang": true or false,
      "exampleDialogue": [
        { "speaker": "A", "text": "example sentence" },
        { "speaker": "B", "text": "response" }
      ]
    }
  ]
}

Return ONLY valid JSON. No explanation, no markdown, no code blocks.`

export const GENERATE_QUIZZES_PROMPT = `You are a language learning quiz generator. Given a list of context objects, generate quizzes to test the learner's understanding.

For each context object, generate 1-2 quizzes. Use the index of the context object in the input array as context_object_index.

Return a JSON object:
{
  "quizzes": [
    {
      "contextObjectIndex": 0,
      "type": "choose_context | choose_pronunciation | fill_metadata",
      "questionSentence": "the question text",
      "answer": "the correct answer",
      "choicePool": ["the correct answer", "distractor 1", "distractor 2", "distractor 3", "distractor 4", "distractor 5", "distractor 6", "distractor 7", "distractor 8", "distractor 9"]
    }
  ]
}

The "choicePool" array must contain exactly 10 strings. The correct answer must be included among the choices. The other 9 choices should be plausible but incorrect distractors appropriate to the quiz type.

Quiz types:
- choose_context: Test understanding of when/how to use the expression
- choose_pronunciation: Test pronunciation or reading of the expression
- fill_metadata: Test knowledge of meaning, nuance, or formality

Return ONLY valid JSON. No explanation, no markdown, no code blocks.`
