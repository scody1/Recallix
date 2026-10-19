import React from 'react';

interface MathFormattedTextProps {
  text: string;
  className?: string;
}

// Convert common LaTeX math symbols and Unicode math into clean HTML representations
function replaceMathSymbols(str: string): string {
  return str
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\degree/g, '°')
    .replace(/\^\\circ/g, '°');
}

/**
 * Parses and renders text with mathematical expressions:
 * - \frac{a}{b} -> stacked fraction
 * - \sqrt{x} or \sqrt[n]{x} -> styled radical
 * - x^{n} or x^2 -> superscript
 * - x_{n} or x_1 -> subscript
 * - Math symbols (\times, \div, \pm, \pi, etc.)
 * - Preserves Hindi & English text with standard typography
 */
export const MathFormattedText: React.FC<MathFormattedTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split lines to detect tabular or block structures
  const lines = text.split('\n');

  return (
    <span className={`inline-block font-sans ${className}`}>
      {lines.map((line, lIdx) => {
        const isTableLine = line.includes('|') && line.trim().startsWith('|');

        return (
          <React.Fragment key={lIdx}>
            {lIdx > 0 && <br />}
            {isTableLine ? (
              <span className="font-mono text-[11px] bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800 inline-block my-0.5 whitespace-pre">
                {line}
              </span>
            ) : (
              renderLineWithMath(replaceMathSymbols(line))
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
};

// Regex patterns for math tokens
// 1. Fractions: \frac{num}{den}
// 2. Square roots: \sqrt[root]{content} or \sqrt{content} or √(content)
// 3. Superscripts: ^{content} or ^(\d+) or ^[0-9a-zA-Z]
// 4. Subscripts: _{content} or _(\d+) or _[0-9a-zA-Z]
function renderLineWithMath(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let remaining = line;
  let keyIndex = 0;

  // Regex matching \frac{...}{...} OR \sqrt{...} OR \sqrt[...]{...} OR \^{...} OR ^{...} OR _{...}
  const mathRegex = /(\\frac\{([^{}]+)\}\{([^{}]+)\})|(\\sqrt(?:\[([^\]]+)\])?\{([^{}]+)\})|(\^\{([^{}]+)\}|\^([0-9a-zA-Z+−-]+))|(_\{([^{}]+)\}|_([0-9a-zA-Z+−-]+))/;

  while (remaining.length > 0) {
    const match = remaining.match(mathRegex);
    if (!match || match.index === undefined) {
      tokens.push(<span key={keyIndex++}>{remaining}</span>);
      break;
    }

    // Push text before match
    if (match.index > 0) {
      tokens.push(<span key={keyIndex++}>{remaining.slice(0, match.index)}</span>);
    }

    if (match[1]) {
      // Fraction: \frac{num}{den}
      const num = match[2];
      const den = match[3];
      tokens.push(
        <span
          key={keyIndex++}
          className="inline-flex flex-col text-center align-middle mx-1 text-[0.88em] leading-tight font-serif"
          style={{ verticalAlign: '-0.35em' }}
        >
          <span className="border-b border-current px-0.5 pb-0.5 text-center">{num}</span>
          <span className="px-0.5 pt-0.5 text-center">{den}</span>
        </span>
      );
    } else if (match[4]) {
      // Root: \sqrt[root]{content} or \sqrt{content}
      const rootIndex = match[5];
      const content = match[6];
      tokens.push(
        <span key={keyIndex++} className="inline-flex items-center align-middle mx-0.5">
          {rootIndex ? (
            <sup className="text-[0.65em] font-sans -mr-0.5 font-semibold">{rootIndex}</sup>
          ) : null}
          <span className="text-[1.15em] font-serif leading-none select-none">√</span>
          <span className="border-t border-current pl-0.5 pr-1 text-[0.95em] leading-tight font-sans">
            {content}
          </span>
        </span>
      );
    } else if (match[7]) {
      // Superscript: ^{content} or ^x
      const exp = match[8] || match[9];
      tokens.push(
        <sup key={keyIndex++} className="text-[0.72em] font-mono font-medium align-super ml-0.5">
          {exp}
        </sup>
      );
    } else if (match[10]) {
      // Subscript: _{content} or _x
      const sub = match[11] || match[12];
      tokens.push(
        <sub key={keyIndex++} className="text-[0.72em] font-mono font-medium align-sub ml-0.5">
          {sub}
        </sub>
      );
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return tokens;
}
