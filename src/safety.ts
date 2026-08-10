export const EMERGENCY_NOTICE =
  "Doorknob is not a symptom checker or triage service. Call 999 for a life-threatening emergency. Use NHS 111 when you need urgent medical help but are not sure what to do.";

export const MODEL_ALERT_LIMITATION =
  "A model may sometimes display an extra urgent-help warning, but it can miss emergencies. Never rely on Doorknob to decide whether it is safe to wait.";

export const WORRY_QUESTION =
  "Sometimes there is a worry underneath — something you are afraid this might be, or afraid of happening. If there is, what is it? It will go at the top of your brief.";

export function hasAskedWorryQuestion(answers: ReadonlyArray<{ isWorry: boolean }>): boolean {
  return answers.some((item) => item.isWorry);
}
