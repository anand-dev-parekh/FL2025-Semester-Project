import { http } from "./http";

export async function requestWiseAdvice({ prompt, systemPrompt, context } = {}) {
  const body = {
    prompt,
  };
  if (systemPrompt) {
    body.system_prompt = systemPrompt;
  }
  if (Array.isArray(context) && context.length > 0) {
    body.context = context;
  }
  return http("/api/ai/respond", {
    method: "POST",
    body,
  });
}
