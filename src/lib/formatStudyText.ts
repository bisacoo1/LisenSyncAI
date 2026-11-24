const mathSymbols: Record<string, string> = {
  approx: '≈',
  alpha: 'α',
  beta: 'β',
  cdot: '·',
  Delta: 'Δ',
  degree: '°',
  gamma: 'γ',
  ge: '≥',
  geq: '≥',
  infty: '∞',
  le: '≤',
  leq: '≤',
  left: '',
  leftrightarrow: '↔',
  leftarrow: '←',
  mu: 'μ',
  neq: '≠',
  pm: '±',
  quad: ' ',
  qquad: ' ',
  right: '',
  rightarrow: '→',
  sim: '≈',
  times: '×',
  to: '→',
}

const textCommands = /\\(?:text|mathrm|operatorname|mathbf|mathit|mbox|ce)\s*\{([^{}]*)\}/g

function formatFraction(_match: string, numerator: string, denominator: string): string {
  const wrap = (part: string) => /[\/=+×−-]/.test(part) ? `(${part})` : part
  return `${wrap(numerator)}/${wrap(denominator)}`
}

export function formatStudyText(value: string): string {
  let formatted = value
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$]*)\$/g, '$1')

  for (let pass = 0; pass < 4; pass += 1) {
    formatted = formatted.replace(textCommands, '$1')
  }

  return formatted
    .replace(/\\\\/g, '\n')
    .replace(/([_^])\{([^{}]+)\}/g, '$1$2')
    .replace(/[_^]/g, '')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, formatFraction)
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√$1')
    .replace(/\{([^{}]+)\}/g, (match, group: string) => /[\/=+×−-]/.test(group) ? `(${group})` : match)
    .replace(/\)\(/g, ') (')
    .replace(/\\([a-zA-Z]+)\b/g, (_match, command: string) => mathSymbols[command] ?? '')
    .replace(/\\([%&_{}#])/g, '$1')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
}
