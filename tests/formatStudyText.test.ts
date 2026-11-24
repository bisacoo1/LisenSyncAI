import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StudyMarkdown from '../src/components/StudyMarkdown'
import { formatStudyText } from '../src/lib/formatStudyText'

describe('formatStudyText', () => {
  it('turns extracted LaTeX notation into readable plain text', () => {
    expect(formatStudyText(
      'Labs: $\\text{HbA}_{1\\text{c}}$, $\\text{eGFR} < 30\\text{ mL/min}$, $< 25\\%$, and $$C_{max}$$.',
    )).toBe('Labs: HbA1c, eGFR < 30 mL/min, < 25%, and Cmax.')
  })

  it('formats common math commands and keeps ordinary text unchanged', () => {
    expect(formatStudyText('Dose: \\(\\frac{1}{2} \\times 4\\) mg; usual text.'))
      .toBe('Dose: 1/2 × 4 mg; usual text.')
    expect(formatStudyText('F = $\\frac{AUC_{extravascular} / Dose_{extravascular}}{AUC_{IV} / Dose_{IV}}$'))
      .toBe('F = (AUCextravascular / Doseextravascular)/(AUCIV / DoseIV)')
  })

  it('cleans chemical subscripts and charge notation', () => {
    expect(formatStudyText('Na^+/K^+/2Cl^- cotransporter and H_2O.'))
      .toBe('Na+/K+/2Cl- cotransporter and H2O.')
  })

  it('preserves ordinary braces and renders Markdown formatting and tables', () => {
    expect(formatStudyText('Use {x: 1} and **bold** text.')).toBe('Use {x: 1} and **bold** text.')
    expect(formatStudyText('F = {AUC_{extravascular} / Dose_{extravascular}}{AUC_{IV} / Dose_{IV}}'))
      .toBe('F = (AUCextravascular / Doseextravascular) (AUCIV / DoseIV)')

    const markdown = '### Key points\n\n- **Bold** detail\n\nFormula: $$C_{max}$$\n\n| A | B |\n| - | - |\n| 1 | 2 |'
    const markup = renderToStaticMarkup(createElement(StudyMarkdown, null, markdown))
    expect(markup).toContain('<h3>Key points</h3>')
    expect(markup).toContain('<strong>Bold</strong>')
    expect(markup).toContain('<table>')
    expect(markup).toContain('Formula: Cmax')
    expect(markup).not.toContain('$')
  })
})
