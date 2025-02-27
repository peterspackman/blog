import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';

interface MathProps {
  math: string;
  inline?: boolean;
}

const MathFormula: React.FC<MathProps> = ({ math, inline = true }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      katex.render(math, containerRef.current, {
        throwOnError: false,
        displayMode: !inline,
      });
    }
  }, [math, inline]);

  return <span ref={containerRef} />;
};

export default MathFormula;
