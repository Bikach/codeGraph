import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import type { ResponseEvaluation } from './types.js';

const CLAUDE_PATH = `${os.homedir()}/.claude/local/claude`;

interface EvaluationResult {
  score: number;
  reasoning: string;
}

/**
 * Evaluates a response using Claude to score it from 1-10
 */
export async function evaluateResponse(
  scenario: { name: string; description: string },
  prompt: string,
  response: string,
  toolsUsed: string[],
  expectedTool?: string
): Promise<ResponseEvaluation> {
  const usedCorrectTool = expectedTool
    ? toolsUsed.some(t => t === expectedTool || t.includes(expectedTool.replace('mcp__codegraph__', '')))
    : true;

  const evaluationPrompt = `You are evaluating a code analysis response. Score it from 1-10 based on:
- Completeness: Does it answer the question fully?
- Accuracy: Is the information correct and relevant?
- Usefulness: Would this help a developer?

Scenario: ${scenario.name}
Task: ${scenario.description}
Prompt: ${prompt}

Response to evaluate:
"""
${response.substring(0, 2000)}${response.length > 2000 ? '...(truncated)' : ''}
"""

Respond ONLY with valid JSON in this exact format:
{"score": <1-10>, "reasoning": "<one sentence explanation>"}`;

  const args = [
    '-p',
    '--output-format', 'text',
    '--model', 'haiku',
    '--max-turns', '1',
    evaluationPrompt,
  ];

  try {
    const result = spawnSync(CLAUDE_PATH, args, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });

    const output = result.stdout?.trim() || '';

    // Try to parse JSON from the response
    const jsonMatch = output.match(/\{[\s\S]*"score"[\s\S]*"reasoning"[\s\S]*\}/);
    if (jsonMatch && jsonMatch[0]) {
      const parsed: EvaluationResult = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(10, Math.max(1, parsed.score)),
        reasoning: parsed.reasoning,
        usedCorrectTool,
      };
    }

    // Fallback: try to extract score from text
    const scoreMatch = output.match(/(\d+)\s*\/?\s*10|score[:\s]+(\d+)/i);
    if (scoreMatch) {
      const scoreStr = scoreMatch[1] ?? scoreMatch[2] ?? '5';
      const score = parseInt(scoreStr, 10);
      return {
        score: Math.min(10, Math.max(1, score)),
        reasoning: 'Score extracted from response',
        usedCorrectTool,
      };
    }

    // Default fallback
    return {
      score: 5,
      reasoning: 'Could not parse evaluation response',
      usedCorrectTool,
    };
  } catch {
    return {
      score: 5,
      reasoning: 'Evaluation failed',
      usedCorrectTool,
    };
  }
}
