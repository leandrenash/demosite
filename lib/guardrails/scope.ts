export const isOffTopic = (text: string): boolean => {
  const deny = /(politics|finance|crypto|stocks|gaming|celebrity|music|sports|movies|tv)/i;
  const allow = /(patient|symptom|vitals|assessment|history|medication|allergy|exam|triage|clinical|nurse|doctor|paramedic|emergency|ward|icu)/i;
  return deny.test(text) && !allow.test(text);
};


